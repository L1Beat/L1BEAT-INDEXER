import { type FC } from 'react'

interface TimeRangeSelectorProps {
    startTs: number
    endTs: number
    onStartTsChange: (timestamp: number) => void
    onEndTsChange: (timestamp: number) => void
    className?: string
    label?: string
    showPresets?: boolean
    showTimestampInputs?: boolean
}

const TimeRangeSelector: FC<TimeRangeSelectorProps> = ({
    startTs,
    endTs,
    onStartTsChange,
    onEndTsChange,
    className = '',
    label = 'Time Range',
    showPresets = true,
    showTimestampInputs = false
}) => {
    const formatTimestampForInput = (ts: number): string => {
        try {
            if (ts === 0) return new Date(0).toISOString().slice(0, 16)
            const date = new Date(ts * 1000)
            if (isNaN(date.getTime())) return ''
            return date.toISOString().slice(0, 16)
        } catch {
            return ''
        }
    }

    const handleStartDateTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const dateTime = new Date(event.target.value)
            if (!isNaN(dateTime.getTime())) {
                onStartTsChange(Math.floor(dateTime.getTime() / 1000))
            }
        } catch {
            // Ignore invalid dates
        }
    }

    const handleEndDateTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const dateTime = new Date(event.target.value)
            if (!isNaN(dateTime.getTime())) {
                onEndTsChange(Math.floor(dateTime.getTime() / 1000))
            }
        } catch {
            // Ignore invalid dates
        }
    }

    const handleStartTsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(event.target.value)
        if (!isNaN(value) && value >= 0) {
            onStartTsChange(value)
        }
    }

    const handleEndTsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(event.target.value)
        if (!isNaN(value) && value >= 0) {
            onEndTsChange(value)
        }
    }

    // Quick presets for L1BEAT INDEXER analytics
    const setPreset = (days: number) => {
        const now = Math.floor(Date.now() / 1000)
        onEndTsChange(now)
        onStartTsChange(now - (days * 86400))
    }

    const formatDateRange = (): string => {
        try {
            const startDate = new Date(startTs * 1000)
            const endDate = new Date(endTs * 1000)
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 'Invalid Range'
            
            return `${startDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            })} - ${endDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            })}`
        } catch {
            return 'Invalid Range'
        }
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {label && (
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">{label}</h3>
                    <span className="text-sm text-gray-500">{formatDateRange()}</span>
                </div>
            )}

            {showPresets && (
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setPreset(7)}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-md transition-colors"
                    >
                        📅 Last 7 days
                    </button>
                    <button
                        onClick={() => setPreset(30)}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-md transition-colors"
                    >
                        📆 Last 30 days
                    </button>
                    <button
                        onClick={() => setPreset(90)}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-md transition-colors"
                    >
                        🗓️ Last 3 months
                    </button>
                    <button
                        onClick={() => setPreset(180)}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-md transition-colors"
                    >
                        📊 Last 6 months
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Time
                    </label>
                    <input
                        type="datetime-local"
                        value={formatTimestampForInput(startTs)}
                        onChange={handleStartDateTimeChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {showTimestampInputs && (
                        <input
                            type="number"
                            value={startTs}
                            onChange={handleStartTsChange}
                            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Unix timestamp"
                        />
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Time
                    </label>
                    <input
                        type="datetime-local"
                        value={formatTimestampForInput(endTs)}
                        onChange={handleEndDateTimeChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {showTimestampInputs && (
                        <input
                            type="number"
                            value={endTs}
                            onChange={handleEndTsChange}
                            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Unix timestamp"
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

export default TimeRangeSelector
