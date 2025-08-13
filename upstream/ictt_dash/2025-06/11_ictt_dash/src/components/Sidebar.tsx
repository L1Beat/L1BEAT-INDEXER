import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { Menu, X, ChevronDown, ChevronRight, BarChart3, Activity, ArrowLeftRight, ExternalLink, FileText } from 'lucide-react'

interface MenuItem {
    label: string
    path: string
    icon?: React.ReactNode
    external?: boolean
}

interface MenuGroup {
    title: string
    items: MenuItem[]
    icon?: React.ReactNode
}

const menuGroups: MenuGroup[] = [
    {
        title: 'Analytics',
        icon: <BarChart3 size={18} />,
        items: [
            { label: 'Leaderboard', path: '/leaderboard' },
            { label: 'TPS', path: '/tps' },
            { label: 'Cumulative Txs', path: '/cumulative-txs' },
            { label: 'Chain Comparison', path: '/chain-comparison' }
        ]
    },
    {
        title: 'Cross-Chain',
        icon: <ArrowLeftRight size={18} />,
        items: [
            { label: 'Daily Messages', path: '/daily-message-volume' },
            { label: 'ICM Gas Usage', path: '/icm-gas-usage' },
            { label: 'ICM vs LZ', path: '/messaging-comparison' },
            { label: 'ICTT Transfers', path: '/ictt-transfers' },
            { label: 'ICTT List', path: '/ictt-transfers-list' }
        ]
    },
    {
        title: 'System',
        icon: <Activity size={18} />,
        items: [
            { label: 'Sync Status', path: '/sync-status' },
            { label: 'RPC Demo', path: '/rpc' }
        ]
    },
    {
        title: 'Documentation',
        icon: <FileText size={18} />,
        items: [
            { label: 'API Docs', path: '/api/docs', external: true, icon: <ExternalLink size={16} /> }
        ]
    }
]

interface SidebarProps {
    isMobileMenuOpen: boolean
    setIsMobileMenuOpen: (open: boolean) => void
}

export default function Sidebar({ isMobileMenuOpen, setIsMobileMenuOpen }: SidebarProps) {
    const location = useLocation()
    const [expandedGroups, setExpandedGroups] = useState<string[]>(
        menuGroups.map(g => g.title) // All groups expanded by default
    )

    const toggleGroup = (groupTitle: string) => {
        setExpandedGroups(prev =>
            prev.includes(groupTitle)
                ? prev.filter(g => g !== groupTitle)
                : [...prev, groupTitle]
        )
    }

    const isActive = (path: string) => {
        if (path === '/leaderboard' && location.pathname === '/') return true
        return location.pathname === path
    }

    const MenuContent = () => (
        <nav className="h-full overflow-y-auto">
            <div className="p-4">
                <h1 className="text-xl font-bold mb-6">Indexer</h1>
                <div className="space-y-6">
                    {menuGroups.map(group => (
                        <div key={group.title}>
                            <button
                                onClick={() => toggleGroup(group.title)}
                                className="flex items-center justify-between w-full text-left mb-2 hover:bg-gray-100 rounded px-2 py-1 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    {group.icon}
                                    <span className="font-semibold text-sm">{group.title}</span>
                                </div>
                                {expandedGroups.includes(group.title) ?
                                    <ChevronDown size={16} /> :
                                    <ChevronRight size={16} />
                                }
                            </button>
                            {expandedGroups.includes(group.title) && (
                                <div className="ml-6 space-y-1">
                                    {group.items.map(item => (
                                        item.external ? (
                                            <a
                                                key={item.path}
                                                href={item.path}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between px-2 py-1.5 rounded text-sm hover:bg-gray-100 transition-colors"
                                            >
                                                <span>{item.label}</span>
                                                {item.icon}
                                            </a>
                                        ) : (
                                            <Link
                                                key={item.path}
                                                to={item.path}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className={`block px-2 py-1.5 rounded text-sm transition-colors ${isActive(item.path)
                                                    ? 'bg-blue-100 font-semibold'
                                                    : 'hover:bg-gray-100'
                                                    }`}
                                            >
                                                {item.label}
                                            </Link>
                                        )
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </nav>
    )

    return (
        <>
            {/* Mobile burger button */}
            <div className="lg:hidden fixed top-4 left-4 z-50">
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`
        fixed top-0 left-0 h-full bg-white shadow-lg z-40 transition-transform duration-300 ease-in-out
        w-64
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
                <MenuContent />
            </aside>
        </>
    )
}
