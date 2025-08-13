

// Custom function to shorten hash strings
const shortenHash = (hash: string, showBytes = 2): string => {
    if (hash.length <= showBytes * 2) {
        return hash
    }
    return `${hash.slice(0, 2 + showBytes * 2)}...${hash.slice(-showBytes * 2)}`
}

export default function ShortHash({ hash }: { hash: string }) {
    return <span>{shortenHash(hash)}</span>
}
