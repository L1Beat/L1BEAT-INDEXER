import { Link } from 'react-router-dom'

export default function NotFound() {
    return (
        <div className="py-8 px-4 md:px-8">
            <div className="max-w-2xl mx-auto text-center">
                <div className="mb-8">
                    <h1 className="text-9xl font-bold text-gray-200">404</h1>
                    <h2 className="text-3xl font-bold text-gray-900 mt-4">Page Not Found</h2>
                    <p className="text-gray-600 mt-4">
                        The page you're looking for doesn't exist or has been moved.
                    </p>
                </div>

                <Link
                    to="/"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                    ← Back to Home
                </Link>

                <div className="mt-8 pt-8 border-t border-gray-200">
                    <p className="text-sm text-gray-500">
                        Available pages:
                    </p>
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                        <Link to="/sync-status" className="text-blue-700 hover:underline text-sm">Sync Status</Link>
                        <span className="text-gray-400">•</span>
                        <Link to="/rpc" className="text-blue-700 hover:underline text-sm">RPC Demo</Link>
                        <span className="text-gray-400">•</span>
                        <Link to="/icm-gas-usage" className="text-blue-700 hover:underline text-sm">ICM Gas Usage</Link>
                        <span className="text-gray-400">•</span>
                        <Link to="/tps" className="text-blue-700 hover:underline text-sm">TPS</Link>
                        <span className="text-gray-400">•</span>
                        <Link to="/cumulative-txs" className="text-blue-700 hover:underline text-sm">Cumulative Txs</Link>
                        <span className="text-gray-400">•</span>
                        <Link to="/daily-message-volume" className="text-blue-700 hover:underline text-sm">Daily Messages</Link>
                        <span className="text-gray-400">•</span>
                        <Link to="/leaderboard" className="text-blue-700 hover:underline text-sm">Leaderboard</Link>
                        <span className="text-gray-400">•</span>
                        <Link to="/ictt-transfers" className="text-blue-700 hover:underline text-sm">ICTT Transfers</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
