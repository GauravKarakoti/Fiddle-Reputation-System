import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Outlets from './pages/Outlets'
import Reviews from './pages/Reviews'
import Insights from './pages/Insights'
import Comparison from './pages/Comparison'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/outlets"    element={<Outlets />} />
            <Route path="/reviews"    element={<Reviews />} />
            <Route path="/comparison" element={<Comparison />} />
            <Route path="/insights"   element={<Insights />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
