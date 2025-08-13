export default function TimeTimestamp({ timestamp }: { timestamp: number }) {
    return <>
        <span>{new Date(timestamp * 1000).toLocaleString()}</span>
        <br />
        <span className="text-xs text-gray-500">{timestamp}</span>
    </>
}
