import Products from './components/Products'
import Calculator from './components/Calculator'

function App() {
  return (
    <div className="bg-white">
      <header className="border-b">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">Трекер макросов</h1>
        </div>
      </header>
      <main>
        <Products />
        <Calculator />
      </main>
    </div>
  )
}

export default App
