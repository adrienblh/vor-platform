import { useState } from 'react'
import { Download, FileJson, FileText, Table2, Check } from 'lucide-react'
import { exportXLSX } from '../lib/exportXLSX.js'
import { toCSV, toJSON } from '../lib/parser.js'
import { logExport } from '../lib/supabase.js'

export default function ExportBar({ items, metadata = {}, documentId }) {
  const [done, setDone] = useState(null)

  const flash = (type) => {
    setDone(type)
    setTimeout(() => setDone(null), 1800)
  }

  const handleXLSX = () => {
    exportXLSX(items, 'ВОР.xlsx', metadata)
    if (documentId) logExport({ document_id: documentId, type: 'xlsx' })
    flash('xlsx')
  }

  const handleCSV = () => {
    const csv = toCSV(items)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'ВОР.csv'; a.click()
    URL.revokeObjectURL(url)
    if (documentId) logExport({ document_id: documentId, type: 'csv' })
    flash('csv')
  }

  const handleJSON = () => {
    const json = toJSON(items)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'ВОР.json'; a.click()
    URL.revokeObjectURL(url)
    if (documentId) logExport({ document_id: documentId, type: 'json' })
    flash('json')
  }

  const Btn = ({ type, icon, label, onClick }) => {
    const isDone = done === type
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded text-sm border transition-all duration-150 active:scale-95 ${
          isDone
            ? 'border-sage-500/50 bg-sage-500/10 text-sage-400'
            : 'border-ink-700 bg-ink-800 text-ink-300 hover:text-ink-100 hover:border-ink-600'
        }`}
      >
        {isDone ? <Check size={15} /> : icon}
        {label}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-ink-500 text-sm flex items-center gap-1.5">
        <Download size={14} />
        Экспорт:
      </span>
      <Btn type="xlsx" icon={<Table2 size={15} />} label="XLSX" onClick={handleXLSX} />
      <Btn type="csv" icon={<FileText size={15} />} label="CSV" onClick={handleCSV} />
      <Btn type="json" icon={<FileJson size={15} />} label="JSON" onClick={handleJSON} />
    </div>
  )
}
