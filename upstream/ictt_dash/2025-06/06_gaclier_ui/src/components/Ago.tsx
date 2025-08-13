import TimeAgo, { type FormatStyleName } from "javascript-time-ago"
import { useEffect } from "react"
import { useState } from "react"
import en from "javascript-time-ago/locale/en"

TimeAgo.addDefaultLocale(en)
const timeAgo = new TimeAgo('en-US')

function ago(timestamp: number, format: FormatStyleName = "mini") {
    const date = new Date(timestamp)
    return timeAgo.format(date, format)
}

export default function Ago({ timestamp, format = "mini" }: { timestamp: number, format?: FormatStyleName }) {
    const [, setCurrentTime] = useState(Date.now())

    useEffect(() => {
        const getRefreshInterval = () => {
            const ageInMs = Date.now() - timestamp
            const oneMinute = 60 * 1000
            const oneHour = 60 * 60 * 1000

            if (ageInMs < oneMinute) {
                return 1000 // 1 second
            } else if (ageInMs < oneHour) {
                return 10000 // 10 seconds
            } else {
                return null // No refresh
            }
        }

        const interval = getRefreshInterval()

        if (interval === null) {
            return // No cleanup needed
        }

        const intervalId = setInterval(() => {
            setCurrentTime(Date.now())
        }, interval)

        return () => clearInterval(intervalId)
    }, [timestamp])

    return <time dateTime={new Date(timestamp).toISOString()} className="font-mono">
        {ago(timestamp, format)}
    </time>
}
