import { getApiGlobalLeaderboardDay, getApiGlobalLeaderboardWeek } from "./client/sdk.gen"
import { type GetApiGlobalLeaderboardDayResponses } from "./client/types.gen"
import { useQuery } from '@tanstack/react-query'
import ExampleCard from "./components/ExampleCard"
import ErrorComponent from "./components/ErrorComponent"

type LeaderboardData = GetApiGlobalLeaderboardDayResponses[200]

type ChainPair = {
    chain1: string
    chain2: string
    chain1Name: string
    chain2Name: string
    messagesIn: number
    messagesOut: number
    totalMessages: number
}

function processLeaderboardData(data: LeaderboardData): ChainPair[] {
    const pairMap = new Map<string, ChainPair>()

    data.forEach(item => {
        const fromId = item.fromChain
        const toId = item.toChain
        const fromName = item.fromName
        const toName = item.toName
        const count = item.messageCount

        // Create a consistent pair key (alphabetically sorted)
        const [id1, id2, name1, name2] = fromId < toId
            ? [fromId, toId, fromName, toName]
            : [toId, fromId, toName, fromName]
        const pairKey = `${id1}-${id2}`

        let pair = pairMap.get(pairKey)
        if (!pair) {
            pair = {
                chain1: id1,
                chain2: id2,
                chain1Name: name1,
                chain2Name: name2,
                messagesIn: 0,
                messagesOut: 0,
                totalMessages: 0
            }
            pairMap.set(pairKey, pair)
        }

        // Determine direction relative to chain1
        if (fromId === id1) {
            pair.messagesOut += count
        } else {
            pair.messagesIn += count
        }
        pair.totalMessages += count
    })

    // Convert to array and sort by total messages descending
    return Array.from(pairMap.values()).sort((a, b) => b.totalMessages - a.totalMessages)
}

function LeaderboardTable({ data }: { data: ChainPair[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Chain 1
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Chain 2
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Messages In
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Messages Out
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Messages
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((pair, index) => {
                        const showChain1Id = pair.chain1Name === pair.chain1
                        const showChain2Id = pair.chain2Name === pair.chain2
                        const chain1Display = showChain1Id ? pair.chain1 : pair.chain1Name
                        const chain2Display = showChain2Id ? pair.chain2 : pair.chain2Name

                        return (
                            <tr key={`${pair.chain1}-${pair.chain2}-${index}`} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm">
                                    <span className={showChain1Id ? "font-mono text-gray-600" : "font-medium text-gray-900"}>
                                        {chain1Display}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-sm">
                                    <span className={showChain2Id ? "font-mono text-gray-600" : "font-medium text-gray-900"}>
                                        {chain2Display}
                                    </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium">
                                    {pair.messagesIn.toLocaleString()}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium">
                                    {pair.messagesOut.toLocaleString()}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium">
                                    {pair.totalMessages.toLocaleString()}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function DailyLeaderboard() {
    const { data, error, isError, isLoading } = useQuery<LeaderboardData>({
        queryKey: ['leaderboardDay'],
        queryFn: async () => {
            const res = await getApiGlobalLeaderboardDay()
            if (res.data) {
                return res.data
            }
            throw new Error('Failed to fetch daily leaderboard data')
        }
    })

    if (isError) {
        return <ErrorComponent message={error?.message || 'Failed to load daily message flows'} />
    }

    if (isLoading || !data) {
        return <div className="text-center py-8">Loading daily message flows...</div>
    }

    if (data.length === 0) {
        return <div className="text-center py-8 text-gray-500">No message flows in the last 24 hours</div>
    }

    const processedData = processLeaderboardData(data)
    return <LeaderboardTable data={processedData} />
}

function WeeklyLeaderboard() {
    const { data, error, isError, isLoading } = useQuery<LeaderboardData>({
        queryKey: ['leaderboardWeek'],
        queryFn: async () => {
            const res = await getApiGlobalLeaderboardWeek()
            if (res.data) {
                return res.data
            }
            throw new Error('Failed to fetch weekly leaderboard data')
        }
    })

    if (isError) {
        return <ErrorComponent message={error?.message || 'Failed to load weekly message flows'} />
    }

    if (isLoading || !data) {
        return <div className="text-center py-8">Loading weekly message flows...</div>
    }

    if (data.length === 0) {
        return <div className="text-center py-8 text-gray-500">No message flows in the last 7 days</div>
    }

    const processedData = processLeaderboardData(data)
    return <LeaderboardTable data={processedData} />
}

export default function Leaderboard() {
    return (
        <div className="py-8 px-4 md:px-8">
            <div className="flex flex-col gap-4 mb-8">
                <h1 className="text-3xl font-bold">🔄 Message Flow Leaderboard</h1>

                <div className="border border-gray-200 rounded-xl bg-white p-6">
                    <div className="mb-3 text-base">Inter-Chain Message Flows</div>
                    <p className="text-sm mb-3">
                        Track message flows between chain pairs in the network:
                    </p>
                    <ul className="space-y-1">
                        <li><span className="font-semibold">Chain Pairs:</span> Shows bidirectional message flows between chains</li>
                        <li><span className="font-semibold">Messages In:</span> Messages received by Chain 1 from Chain 2</li>
                        <li><span className="font-semibold">Messages Out:</span> Messages sent from Chain 1 to Chain 2</li>
                        <li><span className="font-semibold">Total Messages:</span> Sum of all messages between the chain pair</li>
                        <li><span className="font-semibold">Sorted by:</span> Total message count (descending)</li>
                    </ul>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <ExampleCard
                    name="Daily Message Flows"
                    curlString={`curl -X GET "${window.location.origin}/api/leaderboard/day"`}
                >
                    <DailyLeaderboard />
                </ExampleCard>

                <ExampleCard
                    name="Weekly Message Flows"
                    curlString={`curl -X GET "${window.location.origin}/api/leaderboard/week"`}
                >
                    <WeeklyLeaderboard />
                </ExampleCard>
            </div>
        </div>
    )
}
