import { Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Sync from './Sync'
import RpcExamples from './RpcExamples'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ICMGasUsage from './ICMGasUsage'
import TPS from './TPS'
import CumulativeTxs from './CumulativeTxs'
import DailyMessageVolume from './DailyMessageVolume'
import Leaderboard from './Leaderboard'
import ICTTTransfers from './ICTTTransfers'
import ICTTTransfersList from './ICTTTransfersList'
import MessagingComparison from './MessagingComparison'
import ChainComparison from './ChainComparison'
import NotFound from './NotFound'
import Sidebar from './components/Sidebar'


function App() {
  const queryClient = new QueryClient()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar 
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        
        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Main content area */}
        <div className="lg:ml-64 min-h-screen">
          <main className="p-4 lg:p-8">
            <Routes>
              <Route path="/" element={<Navigate to="/leaderboard" replace />} />
              
              {/* Analytics */}
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/tps" element={<TPS />} />
              <Route path="/cumulative-txs" element={<CumulativeTxs />} />
              <Route path="/chain-comparison" element={<ChainComparison />} />
              
              {/* User Analytics - Placeholder routes for future components */}
              <Route path="/daily-active-addresses" element={
                <div className="text-center py-16">
                  <h2 className="text-2xl font-bold text-gray-700 mb-4">👥 Daily Active Addresses</h2>
                  <p className="text-gray-600">Component coming soon - will use the Daily Active Addresses API</p>
                </div>
              } />
              <Route path="/user-analytics" element={
                <div className="text-center py-16">
                  <h2 className="text-2xl font-bold text-gray-700 mb-4">📊 User Period Analytics</h2>
                  <p className="text-gray-600">Component coming soon - will use the Active Addresses Period API</p>
                </div>
              } />
              
              {/* Network Efficiency - Placeholder routes for future components */}
              <Route path="/gas-usage" element={
                <div className="text-center py-16">
                  <h2 className="text-2xl font-bold text-gray-700 mb-4">⛽ Gas Usage Analytics</h2>
                  <p className="text-gray-600">Component coming soon - will use the Gas Usage APIs</p>
                </div>
              } />
              <Route path="/gas-analytics" element={
                <div className="text-center py-16">
                  <h2 className="text-2xl font-bold text-gray-700 mb-4">📈 Advanced Gas Analytics</h2>
                  <p className="text-gray-600">Component coming soon - comprehensive gas analysis dashboard</p>
                </div>
              } />
              
              {/* Cross-Chain */}
              <Route path="/daily-message-volume" element={<DailyMessageVolume />} />
              <Route path="/icm-gas-usage" element={<ICMGasUsage />} />
              <Route path="/messaging-comparison" element={<MessagingComparison />} />
              <Route path="/icm-messages" element={
                <div className="text-center py-16">
                  <h2 className="text-2xl font-bold text-gray-700 mb-4">📨 ICM Messages</h2>
                  <p className="text-gray-600">Component coming soon - will use the Teleporter API</p>
                </div>
              } />
              <Route path="/ictt-transfers" element={<ICTTTransfers />} />
              <Route path="/ictt-transfers-list" element={<ICTTTransfersList />} />
              
              {/* System */}
              <Route path="/sync-status" element={<Sync />} />
              <Route path="/rpc" element={<RpcExamples />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App
