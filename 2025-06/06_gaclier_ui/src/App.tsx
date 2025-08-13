import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home/Home'
import Block from './pages/Block/Block'
import NotFound from './components/NotFound'
import Tx from './pages/Tx/Tx'

function App() {
    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center space-x-8">
                            <Link to="/" className="text-xl font-bold text-gray-800">
                                My App
                            </Link>
                            <div className="flex space-x-4">
                                <Link
                                    to="/"
                                    className="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                                >
                                    Home
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <main>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/block/:blockId" element={<Block />} />
                    <Route path="/tx/:txHash" element={<Tx />} />
                    <Route path="/404" element={<NotFound />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </main>
        </div>
    )
}

export default App
