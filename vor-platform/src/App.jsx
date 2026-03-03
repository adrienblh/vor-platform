import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import DocumentView from './pages/DocumentView.jsx'
import Layout from './components/Layout.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/document/:id" element={<DocumentView />} />
      </Route>
    </Routes>
  )
}
