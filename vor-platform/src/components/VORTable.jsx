import { useState, useCallback, useRef } from 'react'
import {
  AlertTriangle, Plus, Trash2, GripVertical,
  ChevronUp, ChevronDown, Filter, Search, X
} from 'lucide-react'

const ITEM_TYPES = ['Работа', 'Материал', 'Перевозка', 'Прочее']

const COLUMNS = [
  { key: 'code',         label: '№',          width: 80,  type: 'text' },
  { key: 'name',         label: 'Наименование', width: 300, type: 'textarea' },
  { key: 'unit',         label: 'Ед.изм.',    width: 80,  type: 'text' },
  { key: 'qty_raw',      label: 'Объём',       width: 110, type: 'text' },
  { key: 'formula',      label: 'Формула',     width: 200, type: 'text' },
  { key: 'ref_drawings', label: 'Чертежи',     width: 150, type: 'text' },
  { key: 'file_name',    label: 'Файл',        width: 150, type: 'text' },
  { key: 'pages',        label: 'Страницы',    width: 100, type: 'text' },
  { key: 'comment',      label: 'Коммент.',    width: 150, type: 'text' },
  { key: 'item_type',    label: 'Тип',         width: 110, type: 'select' },
]

function typeClass(t) {
  if (!t) return 'tag-other'
  if (t === 'Работа') return 'tag-work'
  if (t === 'Материал') return 'tag-material'
  if (t === 'Перевозка') return 'tag-transport'
  return 'tag-other'
}

function ConfidenceBar({ value }) {
  const color = value >= 70 ? '#5f8a7b' : value >= 40 ? '#f59e0b' : '#e05e28'
  return (
    <div className="confidence-bar w-12">
      <div style={{ width: `${value}%`, background: color, height: '4px', borderRadius: '2px', transition: 'width 0.3s' }} />
    </div>
  )
}

export default function VORTable({ items, onUpdate }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showWarningsOnly, setShowWarningsOnly] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)
  const tableRef = useRef(null)

  const updateCell = useCallback((idx, key, value) => {
    const updated = items.map((item, i) => {
      if (i !== idx) return item
      const newItem = { ...item, [key]: value }
      // Recompute qty_value if qty_raw changed
      if (key === 'qty_raw') {
        const n = parseFloat(value.replace(',', '.'))
        newItem.qty_value = isNaN(n) ? null : n
      }
      // Recompute warnings
      const warnings = []
      if (!newItem.unit) warnings.push('Не определена единица измерения')
      if (newItem.qty_value === null && !newItem.qty_raw) warnings.push('Не определён объём работ')
      if (!newItem.item_type) warnings.push('Не определён тип позиции')
      newItem.warnings = warnings
      return newItem
    })
    onUpdate(updated)
  }, [items, onUpdate])

  const addRow = () => {
    onUpdate([...items, {
      code: '', name: '', unit: '', qty_raw: '', qty_value: null,
      formula: '', ref_drawings: '', file_name: '', pages: '',
      comment: '', item_type: null, warnings: ['Новая строка — заполните данные'],
      confidence: 0,
    }])
  }

  const removeRow = (idx) => {
    onUpdate(items.filter((_, i) => i !== idx))
  }

  const moveRow = (idx, dir) => {
    const arr = [...items]
    const target = idx + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
    onUpdate(arr)
  }

  // Drag reorder
  const onDragStart = (idx) => setDragIdx(idx)
  const onDragOver = (e, idx) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const arr = [...items]
    const [moved] = arr.splice(dragIdx, 1)
    arr.splice(idx, 0, moved)
    setDragIdx(idx)
    onUpdate(arr)
  }

  // Filter
  const filtered = items.filter((item, i) => {
    if (filterType && item.item_type !== filterType) return false
    if (showWarningsOnly && (!item.warnings || item.warnings.length === 0)) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (item.code || '').toLowerCase().includes(q) ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.unit || '').toLowerCase().includes(q) ||
        (item.item_type || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="panel overflow-hidden flex flex-col" style={{ maxHeight: '75vh' }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-ink-800 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Search size={14} className="text-ink-500 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по тексту…"
            className="bg-transparent text-sm text-ink-200 placeholder-ink-600 outline-none flex-1 min-w-0"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-ink-600 hover:text-ink-400">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-ink-800 border border-ink-700 text-ink-300 text-xs rounded px-2 py-1 outline-none"
          >
            <option value="">Все типы</option>
            {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <button
            onClick={() => setShowWarningsOnly(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${
              showWarningsOnly ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'btn-ghost'
            }`}
          >
            <AlertTriangle size={12} />
            Предупреждения
          </button>
        </div>

        <button onClick={addRow} className="btn-primary text-xs px-3 py-1.5">
          <Plus size={14} /> Строка
        </button>
      </div>

      {/* Count */}
      <div className="px-4 py-1.5 text-xs text-ink-600 border-b border-ink-800/50 flex-shrink-0">
        {filtered.length !== items.length
          ? `Показано ${filtered.length} из ${items.length} позиций`
          : `${items.length} позиций`
        }
      </div>

      {/* Table scroll container */}
      <div className="overflow-auto flex-1" ref={tableRef}>
        <table className="vor-table w-full border-collapse" style={{ minWidth: '1200px' }}>
          <thead>
            <tr>
              <th style={{ width: 40 }} className="text-center">#</th>
              {COLUMNS.map(col => (
                <th key={col.key} style={{ width: col.width }}>{col.label}</th>
              ))}
              <th style={{ width: 80 }} className="text-center">Уверен.</th>
              <th style={{ width: 80 }} className="text-center">Действ.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, visIdx) => {
              // Find real index in items array
              const realIdx = items.indexOf(item)
              return (
                <TableRow
                  key={realIdx}
                  item={item}
                  realIdx={realIdx}
                  visIdx={visIdx}
                  updateCell={updateCell}
                  removeRow={removeRow}
                  moveRow={moveRow}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                />
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-ink-500 text-sm">
            <Filter size={20} className="mx-auto mb-2 opacity-40" />
            Нет позиций по фильтру
          </div>
        )}
      </div>
    </div>
  )
}

function TableRow({ item, realIdx, visIdx, updateCell, removeRow, moveRow, onDragStart, onDragOver }) {
  const [editing, setEditing] = useState(null)
  const hasWarnings = item.warnings && item.warnings.length > 0

  return (
    <tr
      draggable
      onDragStart={() => onDragStart(realIdx)}
      onDragOver={e => onDragOver(e, realIdx)}
      className={hasWarnings ? 'bg-amber-500/5' : ''}
    >
      {/* Row number */}
      <td className="text-center">
        <div className="flex items-center justify-center gap-0.5">
          <GripVertical size={12} className="text-ink-700 cursor-grab" />
          <span className="text-ink-600 text-xs font-mono">{visIdx + 1}</span>
        </div>
      </td>

      {/* Data cells */}
      {COLUMNS.map(col => (
        <td key={col.key} className={editing === col.key ? 'bg-ink-800/60' : ''}>
          {col.type === 'select' ? (
            <select
              value={item[col.key] || ''}
              onChange={e => updateCell(realIdx, col.key, e.target.value)}
              className="bg-transparent text-xs font-mono text-ink-200 outline-none w-full"
            >
              <option value="">—</option>
              {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          ) : col.type === 'textarea' ? (
            <textarea
              value={item[col.key] || ''}
              onChange={e => updateCell(realIdx, col.key, e.target.value)}
              onFocus={() => setEditing(col.key)}
              onBlur={() => setEditing(null)}
              className="cell-input"
              rows={2}
            />
          ) : (
            <input
              value={item[col.key] || ''}
              onChange={e => updateCell(realIdx, col.key, e.target.value)}
              onFocus={() => setEditing(col.key)}
              onBlur={() => setEditing(null)}
              className="cell-input"
            />
          )}
        </td>
      ))}

      {/* Confidence */}
      <td className="text-center">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-mono text-ink-500">{item.confidence ?? 0}%</span>
          <ConfidenceBar value={item.confidence ?? 0} />
        </div>
      </td>

      {/* Actions */}
      <td>
        <div className="flex items-center gap-1 justify-center">
          {hasWarnings && (
            <div className="group relative">
              <AlertTriangle size={14} className="text-amber-500 cursor-help" />
              <div className="absolute bottom-5 right-0 w-56 bg-ink-800 border border-amber-500/30 rounded p-2 text-xs text-amber-300 z-10 hidden group-hover:block shadow-xl">
                {item.warnings.map((w, i) => <div key={i}>· {w}</div>)}
              </div>
            </div>
          )}
          <button onClick={() => moveRow(realIdx, -1)} className="text-ink-600 hover:text-ink-300 p-0.5">
            <ChevronUp size={13} />
          </button>
          <button onClick={() => moveRow(realIdx, 1)} className="text-ink-600 hover:text-ink-300 p-0.5">
            <ChevronDown size={13} />
          </button>
          <button onClick={() => removeRow(realIdx)} className="text-ink-700 hover:text-rust-400 p-0.5">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function ConfidenceBar({ value }) {
  const color = value >= 70 ? '#5f8a7b' : value >= 40 ? '#f59e0b' : '#e05e28'
  return (
    <div className="confidence-bar w-12">
      <div style={{ width: `${value}%`, background: color, height: '4px', borderRadius: '2px' }} />
    </div>
  )
}
