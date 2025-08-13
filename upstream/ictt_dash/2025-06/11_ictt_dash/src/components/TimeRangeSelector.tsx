import { type FC } from 'react'

interface TimeRangeSelectorProps {
    startTs: number
    endTs: number
    onStartTsChange: (timestamp: number) => void
    onEndTsChange: (timestamp: number) => void
    className?: string
}

const TimeRangeSelector: FC<TimeRangeSelectorProps> = ({
    startTs,
    endTs,
    onStartTsChange,
    onEndTsChange,
    className = ''
}) => {
    const formatTimestampForInput = (ts: number): string => {
        if (ts === 0) return new Date(0).toISOString().slice(0, 16)
        return new Date(ts * 1000).toISOString().slice(0, 16)
    }

    const handleStartDateTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const dateTime = new Date(event.target.value)
        onStartTsChange(Math.floor(dateTime.getTime() / 1000))
    }

    const handleEndDateTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const dateTime = new Date(event.target.value)
        onEndTsChange(Math.floor(dateTime.getTime() / 1000))
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

    // Quick presets
    const setPreset = (days: number) => {
        const now = Math.floor(Date.now() / 1000)
        onEndTsChange(now)
        onStartTsChange(now - (days * 86400))
    }

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={() => setPreset(7)}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                    Last 7 days
                </button>
                <button
                    onClick={() => setPreset(30)}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                    Last 30 days
                </button>
                <button
                    onClick={() => setPreset(90)}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                    Last 3 months
                </button>
                <button
                    onClick={() => setPreset(180)}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                    Last 6 months
                </button>
            </div>

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
                    <input
                        type="number"
                        value={startTs}
                        onChange={handleStartTsChange}
                        className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Unix timestamp"
                    />
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
                    <input
                        type="number"
                        value={endTs}
                        onChange={handleEndTsChange}
                        className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Unix timestamp"
                    />
                </div>
            </div>
        </div>
    )
}

export default TimeRangeSelector
