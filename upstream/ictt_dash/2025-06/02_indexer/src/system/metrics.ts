import SQLite3 from 'better-sqlite3'
import { z } from "@hono/zod-openapi"
import { cacheStatement } from '../lib/statementCache'

const createMetricsTableSQL = `
CREATE TABLE IF NOT EXISTS metrics (
    frequency TEXT NOT NULL,
    bucket INTEGER NOT NULL,
    dimension1 TEXT NOT NULL,
    dimension2 TEXT NOT NULL DEFAULT '',
    dimension3 TEXT NOT NULL DEFAULT '',
    dimension4 TEXT NOT NULL DEFAULT '',
    dimension5 TEXT NOT NULL DEFAULT '',
    value INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (frequency, bucket, dimension1, dimension2, dimension3, dimension4, dimension5)
) WITHOUT ROWID;
`

export function initialize(db: SQLite3.Database) {
    db.exec(createMetricsTableSQL)
}

export const Frequency = z.enum(['1h', '1d', '1w', '1m', 'total'])

// Get Monday of the week containing the given timestamp
function getMondayOfWeek(timestamp: number): number {
    const date = new Date(timestamp * 1000)
    const dayOfWeek = date.getUTCDay() // 0 = Sunday, 1 = Monday, etc.
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Convert to Monday = 0
    const monday = new Date(date)
    monday.setUTCDate(date.getUTCDate() - daysToSubtract)
    monday.setUTCHours(0, 0, 0, 0)
    return Math.floor(monday.getTime() / 1000)
}

// Get week number since epoch (weeks starting on Monday)
function getWeekNumber(timestamp: number): number {
    const mondayTimestamp = getMondayOfWeek(timestamp)
    // Epoch was Thursday Jan 1, 1970. First Monday was Jan 5, 1970
    const firstMondayEpoch = 345600 // Jan 5, 1970 00:00:00 UTC
    return Math.floor((mondayTimestamp - firstMondayEpoch) / (7 * 24 * 3600))
}

// Convert week number back to Monday timestamp
function weekNumberToTimestamp(weekNumber: number): number {
    const firstMondayEpoch = 345600 // Jan 5, 1970 00:00:00 UTC
    return firstMondayEpoch + (weekNumber * 7 * 24 * 3600)
}

// Get month number since epoch
function getMonthNumber(timestamp: number): number {
    const date = new Date(timestamp * 1000)
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth()
    return (year - 1970) * 12 + month
}

// Convert month number back to first day of month timestamp
function monthNumberToTimestamp(monthNumber: number): number {
    const year = 1970 + Math.floor(monthNumber / 12)
    const month = monthNumber % 12
    const firstOfMonth = new Date(Date.UTC(year, month, 1))
    return Math.floor(firstOfMonth.getTime() / 1000)
}

function getBucketAndSize(frequency: z.infer<typeof Frequency>, timestamp: number): { bucket: number; size: number } {
    switch (frequency) {
        case '1h':
            const hourBucket = Math.floor(timestamp / 3600) * 3600
            return { bucket: hourBucket, size: 3600 }

        case '1d':
            const dayBucket = Math.floor(timestamp / 86400) * 86400
            return { bucket: dayBucket, size: 86400 }

        case '1w':
            const weekNumber = getWeekNumber(timestamp)
            return { bucket: weekNumber, size: 604800 }

        case '1m':
            const monthNumber = getMonthNumber(timestamp)
            return { bucket: monthNumber, size: 2592000 } // Approximate for display

        case 'total':
            return { bucket: 0, size: 0 }

        default:
            throw new Error(`Unsupported frequency: ${frequency}`)
    }
}

function bucketToTimestamp(frequency: z.infer<typeof Frequency>, bucket: number): number {
    switch (frequency) {
        case '1h':
        case '1d':
            return bucket
        case '1w':
            return weekNumberToTimestamp(bucket)
        case '1m':
            return monthNumberToTimestamp(bucket)
        case 'total':
            return 0
        default:
            throw new Error(`Unsupported frequency: ${frequency}`)
    }
}

export function getMetrics(db: SQLite3.Database, frequency: z.infer<typeof Frequency>, dimensions: string[], limit: number) {
    if (dimensions.length === 0 || dimensions.length > 5) {
        throw new Error('Must provide 1-5 dimensions')
    }

    // Pad dimensions array to 5 elements with empty strings
    const paddedDimensions = [...dimensions, '', '', '', '', ''].slice(0, 5)

    // Special handling for total frequency
    if (frequency === 'total') {
        const metrics = cacheStatement(db, `
            SELECT bucket, value 
            FROM metrics 
            WHERE frequency = ? 
            AND dimension1 = ? 
            AND dimension2 = ?
            AND dimension3 = ?
            AND dimension4 = ?
            AND dimension5 = ?
        `).all(frequency, ...paddedDimensions) as { bucket: number; value: number }[]

        return [{
            timestamp: 0,
            value: metrics.length > 0 ? metrics[0].value : 0
        }]
    }

    // Calculate current bucket info
    const now = Math.floor(Date.now() / 1000)
    const currentBucketInfo = getBucketAndSize(frequency, now)

    // Calculate start bucket
    let startBucket: number
    if (frequency === '1w') {
        startBucket = currentBucketInfo.bucket - limit + 1
    } else if (frequency === '1m') {
        startBucket = currentBucketInfo.bucket - limit + 1
    } else {
        // For 1h and 1d, calculate backwards from current bucket
        startBucket = currentBucketInfo.bucket - (currentBucketInfo.size * (limit - 1))
    }

    // Get existing metrics using cached statement
    const metrics = cacheStatement(db, `
        SELECT bucket, value 
        FROM metrics 
        WHERE frequency = ? 
        AND bucket >= ? 
        AND dimension1 = ? 
        AND dimension2 = ?
        AND dimension3 = ?
        AND dimension4 = ?
        AND dimension5 = ?
        ORDER BY bucket ASC
    `).all(frequency, startBucket, ...paddedDimensions) as { bucket: number; value: number }[]

    // Create array of all timestamps
    const result = []
    for (let i = 0; i < limit; i++) {
        let bucket: number
        if (frequency === '1w' || frequency === '1m') {
            bucket = startBucket + i
        } else {
            bucket = startBucket + (i * currentBucketInfo.size)
        }

        const existingMetric = metrics.find(m => m.bucket === bucket)
        result.push({
            timestamp: bucketToTimestamp(frequency, bucket),
            value: existingMetric ? existingMetric.value : 0
        })
    }

    return result
}

export function incrementMetric(db: SQLite3.Database, timestamp: number, dimensions: string[], value: number) {
    if (dimensions.length === 0 || dimensions.length > 5) {
        throw new Error('Must provide 1-5 dimensions')
    }

    // Pad dimensions array to 5 elements with empty strings
    const paddedDimensions = [...dimensions, '', '', '', '', ''].slice(0, 5)

    const frequencies: z.infer<typeof Frequency>[] = ['1h', '1d', '1w', '1m', 'total']
    const statement = cacheStatement(db, `
        INSERT INTO metrics (frequency, bucket, dimension1, dimension2, dimension3, dimension4, dimension5, value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (frequency, bucket, dimension1, dimension2, dimension3, dimension4, dimension5)
        DO UPDATE SET value = value + excluded.value
    `)

    for (const frequency of frequencies) {
        const { bucket } = getBucketAndSize(frequency, timestamp)
        statement.run(frequency, bucket, ...paddedDimensions, value)
    }
}

export function getUniqueDimensionValues(
    db: SQLite3.Database,
    dimensionIndex: number,
    filters: { [key: string]: string } = {}
): string[] {
    if (dimensionIndex < 1 || dimensionIndex > 5) {
        throw new Error('Dimension index must be between 1 and 5')
    }

    const dimensionColumn = `dimension${dimensionIndex}`
    let whereClause = `WHERE ${dimensionColumn} != ''`
    const params: string[] = []

    // Add filters for other dimensions
    for (const [key, value] of Object.entries(filters)) {
        whereClause += ` AND ${key} = ?`
        params.push(value)
    }

    const query = `
        SELECT DISTINCT ${dimensionColumn} as value 
        FROM metrics 
        ${whereClause}
    `

    const results = cacheStatement(db, query).all(...params) as { value: string }[]
    return results.map(r => r.value)
}
