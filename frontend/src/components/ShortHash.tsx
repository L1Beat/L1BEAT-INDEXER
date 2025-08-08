import { useState } from 'react'

interface ShortHashProps {
    hash: string
}

export default function ShortHash({ hash }: ShortHashProps) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(hash)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    if (!navigator.clipboard) return hash

    if (!hash) return null

    // Remove 0x prefix if present for processing
    const cleanHash = hash.startsWith('0x') ? hash.slice(2) : hash

    // Take first 4 and last 4 characters
    const shortHash = `0x${cleanHash.slice(0, 4)}...${cleanHash.slice(-4)}`

    return (
        <>
            <span>{shortHash}</span>
            <button
                onClick={handleCopy}
                type="button"
                className="ml-2 cursor-pointer"
                title="Copy full hash"
            >
                {copied ? '✓' : '📋'}
            </button>
        </>
    )
}
