import { ResponsiveSankey } from '@nivo/sankey'
import { type GetApiGlobalLeaderboardDayResponses, type GetApiGlobalLeaderboardWeekResponses } from '../client/types.gen'

type FlowData = GetApiGlobalLeaderboardDayResponses[200] | GetApiGlobalLeaderboardWeekResponses[200]

interface SankeyNode {
    id: string
    nodeColor?: string
}

interface SankeyLink {
    source: string
    target: string
    value: number
}

interface SankeyData {
    nodes: SankeyNode[]
    links: SankeyLink[]
}

export default function SankeyChart({ data }: { data: FlowData }) {
    // Transform API data into Nivo Sankey format with forced bipartite layout
    const transformData = (flows: FlowData): { sankeyData: SankeyData, circularFlows: FlowData } => {
        const senderSet = new Set<string>()
        const receiverSet = new Set<string>()
        const links: SankeyLink[] = []
        const circularFlows: FlowData = []

        flows.forEach(flow => {
            // Check for circular reference
            if (flow.fromChain === flow.toChain) {
                circularFlows.push(flow)
                return
            }

            // Track senders and receivers
            senderSet.add(flow.fromName)
            receiverSet.add(flow.toName)
        })

        // Create nodes with prefixes to ensure they're unique
        const nodes: SankeyNode[] = []

        // Add all senders on the left
        senderSet.forEach(sender => {
            nodes.push({
                id: `sender_${sender}`,
                nodeColor: 'hsl(210, 70%, 50%)'
            })
        })

        // Add all receivers on the right
        receiverSet.forEach(receiver => {
            nodes.push({
                id: `receiver_${receiver}`,
                nodeColor: 'hsl(30, 70%, 50%)'
            })
        })

        // Create links with prefixed IDs
        flows.forEach(flow => {
            if (flow.fromChain !== flow.toChain) {
                links.push({
                    source: `sender_${flow.fromName}`,
                    target: `receiver_${flow.toName}`,
                    value: flow.messageCount
                })
            }
        })

        return { sankeyData: { nodes, links }, circularFlows }
    }

    const { sankeyData, circularFlows } = transformData(data)

    // Calculate dynamic height based on number of nodes
    const nodeCount = sankeyData.nodes.length
    const baseHeight = 400
    const heightPerNode = 30
    const maxHeight = 1200
    const dynamicHeight = Math.min(baseHeight + (nodeCount * heightPerNode), maxHeight)

    return (
        <div>
            <div className="w-full" style={{ height: `${dynamicHeight}px` }}>
                <ResponsiveSankey
                    data={sankeyData}
                    margin={{ top: 40, right: 160, bottom: 40, left: 50 }}
                    align="justify"
                    colors={{ scheme: 'category10' }}
                    nodeOpacity={1}
                    nodeHoverOthersOpacity={0.35}
                    nodeThickness={18}
                    nodeSpacing={24}
                    nodeBorderWidth={0}
                    nodeBorderColor={{
                        from: 'color',
                        modifiers: [['darker', 0.8]]
                    }}
                    nodeBorderRadius={3}
                    linkOpacity={0.5}
                    linkHoverOthersOpacity={0.1}
                    linkContract={3}
                    enableLinkGradient={true}
                    labelPosition="outside"
                    labelOrientation="vertical"
                    labelPadding={16}
                    labelTextColor={{
                        from: 'color',
                        modifiers: [['darker', 1]]
                    }}
                    label={node => {
                        const name = node.id.replace(/^(sender_|receiver_)/, '')
                        if (name.length > 20) {
                            return name.slice(0, 4) + '...' + name.slice(-4)
                        }
                        return name
                    }}
                    animate={true}
                    motionConfig="gentle"
                    legends={[
                        {
                            anchor: 'bottom-right',
                            direction: 'column',
                            translateX: 130,
                            itemWidth: 100,
                            itemHeight: 14,
                            itemDirection: 'right-to-left',
                            itemsSpacing: 2,
                            itemTextColor: '#999',
                            symbolSize: 14,
                            effects: [
                                {
                                    on: 'hover',
                                    style: {
                                        itemTextColor: '#000'
                                    }
                                }
                            ]
                        }
                    ]}
                />
            </div>
            {circularFlows.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                    <span className="font-medium text-gray-700">Excluded circular messages: </span>
                    <span className="text-gray-600">
                        {circularFlows.map((flow, index) => (
                            <span key={index}>
                                {flow.fromName} - {flow.messageCount} message{flow.messageCount !== 1 ? 's' : ''}
                                {index < circularFlows.length - 1 ? ', ' : ''}
                            </span>
                        ))}
                    </span>
                </div>
            )}
        </div>
    )
}
