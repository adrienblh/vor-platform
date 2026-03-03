import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { getDocument, getLineItems } from '../lib/supabase.js'
import VORTable from '../components/VORTable.jsx'
import ExportBar from '../components/ExportBar.jsx'
import { format } from 'date-fns'

export default function DocumentView() {
  const { id } = useParams()
  const [doc, setDoc] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [d, li] = await Promise.all([getDocument(id), getLineItems(id)])
        setDoc(d)
        // Enrich with confidence (not stored in DB, recompute)
        setItems(li.map(i => ({
          ...i,
          confidence: computeConfidence(i),
        })))
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin text-ink-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-screen-2xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 p-4 bg-rust-500/10 border border-rust-500/30 rounded-lg text-rust-300">
          <AlertCircle size={18} />
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/" className="btn-ghost text-sm">
          <ArrowLeft size={15} /> Назад
        </Link>
        <div>
          <h1 className="font-display text-2xl tracking-wider text-ink-100">
            {doc.title || 'Без названия'}
          </h1>
          <p className="text-ink-500 text-sm font-mono mt-0.5">
            {format(new Date(doc.created_at), 'dd.MM.yyyy HH:mm')} · {items.length} позиций
          </p>
        </div>
      </div>

      {doc.metadata && Object.keys(doc.metadata).length > 0 && (
        <div className="panel px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
          {Object.entries(doc.metadata).map(([k, v]) => (
            <div key={k}>
              <div className="text-ink-500 text-xs uppercase font-mono mb-0.5">{k}</div>
              <div className="text-ink-200">{v}</div>
            </div>
          ))}
        </div>
      )}

      <ExportBar items={items} metadata={doc.metadata || {}} documentId={id} />

      <VORTable items={items} onUpdate={setItems} />
    </div>
  )
}

function computeConfidence(item) {
  let s = 100
  if (!item.code) s -= 10
  if (!item.name || item.name.length < 5) s -= 20
  if (!item.unit) s -= 20
  if (item.qty_value === null) s -= 20
  if (!item.item_type) s -= 10
  s -= (item.warnings?.length || 0) * 5
  return Math.max(0, Math.min(100, s))
}
