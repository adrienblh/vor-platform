import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Sparkles, Upload, X, AlertCircle, CheckCircle2,
  Clock, FileText, ChevronRight, Loader2
} from 'lucide-react'
import { parseVOR } from '../lib/parser.js'
import { saveDocument, saveLineItems, getDocuments } from '../lib/supabase.js'
import { format } from 'date-fns'
import VORTable from '../components/VORTable.jsx'
import ExportBar from '../components/ExportBar.jsx'

export default function Dashboard() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [tab, setTab] = useState(searchParams.get('tab') === 'history' ? 'history' : 'new')
  const [rawText, setRawText] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState(null) // { document, line_items, metadata }
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Demo mode if no Supabase env
  const isDemo = !import.meta.env.VITE_SUPABASE_URL

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const docs = await getDocuments()
      setHistory(docs)
    } catch (e) {
      console.error(e)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'history') loadHistory()
  }, [tab, loadHistory])

  const handleFileUpload = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => setRawText(e.target.result)
    reader.readAsText(file, 'UTF-8')
  }

  const handleGenerate = async () => {
    if (!rawText.trim()) return
    setParsing(true)
    setSaveError(null)

    try {
      const { line_items, metadata } = parseVOR(rawText)

      let documentId = null

      if (!isDemo) {
        try {
          const doc = await saveDocument({
            title: metadata.project || `ВОР ${new Date().toLocaleDateString('ru-RU')}`,
            source_type: 'paste',
            source_filename: null,
            raw_text: rawText,
            metadata,
          })
          documentId = doc.id
          if (line_items.length > 0) {
            await saveLineItems(documentId, line_items)
          }
        } catch (e) {
          setSaveError('Не удалось сохранить в Supabase — работаем локально.')
        }
      }

      setResult({ documentId, line_items, metadata, rawText })
    } finally {
      setParsing(false)
    }
  }

  const handleTextLoad = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-ink-800 pb-0">
        {['new', 'history'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            {t === 'new' ? '+ Новая выгрузка' : 'История'}
          </button>
        ))}
      </div>

      {/* ─── NEW TAB ─────────────────────────────────────────── */}
      {tab === 'new' && (
        <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6 items-start">
          {/* Input panel */}
          <div className="panel p-5 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl tracking-wider text-ink-100">
                ВВОД ДАННЫХ
              </h2>
              <div className="group relative">
                <button className="text-ink-500 hover:text-amber-400 transition-colors text-xs font-mono">
                  [?] Колонки ВОР
                </button>
                <div className="absolute right-0 top-6 w-72 bg-ink-800 border border-ink-700 rounded-lg p-3 text-xs font-mono text-ink-300 z-20 hidden group-hover:block shadow-xl">
                  <p className="text-amber-400 mb-2 font-semibold">Ожидаемые колонки:</p>
                  {['№ п.п.', 'Наименование работ', 'Ед. изм.', 'Объём / Кол-во', 'Формула расчёта', 'Ссылка на чертежи', 'Имя файла', 'Страницы', 'Комментарий', 'Тип позиции'].map(c => (
                    <div key={c} className="py-0.5 border-b border-ink-700/50">· {c}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Drag/drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setDragOver(false)
                handleFileUpload(e.dataTransfer.files?.[0])
              }}
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                dragOver ? 'border-amber-500 bg-amber-500/5' : 'border-ink-700 hover:border-ink-600'
              }`}
            >
              <Upload size={20} className="mx-auto mb-2 text-ink-500" />
              <p className="text-ink-400 text-sm">
                Перетащите TXT/PDF (текст) сюда
              </p>
              <label className="mt-2 inline-block cursor-pointer">
                <span className="text-amber-400 hover:text-amber-300 text-sm underline underline-offset-2">
                  или выберите файл
                </span>
                <input
                  type="file"
                  accept=".txt,.csv,.text"
                  className="hidden"
                  onChange={handleTextLoad}
                />
              </label>
            </div>

            <div className="relative">
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="Вставьте текст из PDF (раздел ВОР)…&#10;&#10;Пример:&#10;1.1 Земляные работы м3 356472,30&#10;1.1-2 Разработка грунта экскаватором м3 12500,00 Работа"
                rows={14}
                className="w-full bg-ink-950 border border-ink-700 rounded-lg px-4 py-3 text-sm font-mono text-ink-200 placeholder-ink-600 outline-none focus:border-amber-500/50 resize-none leading-relaxed"
              />
              {rawText && (
                <button
                  onClick={() => setRawText('')}
                  className="absolute top-2 right-2 text-ink-600 hover:text-ink-400"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-ink-600 text-xs font-mono">
                {rawText.length > 0 && `${rawText.split('\n').length} строк · ${rawText.length} симв.`}
              </span>
              <button
                onClick={handleGenerate}
                disabled={!rawText.trim() || parsing}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {parsing ? (
                  <><Loader2 size={16} className="animate-spin" /> Анализ…</>
                ) : (
                  <><Sparkles size={16} /> Создать ВОР</>
                )}
              </button>
            </div>

            {isDemo && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Демо-режим:</strong> переменные окружения Supabase не найдены.
                  Данные сохраняются только локально.
                </span>
              </div>
            )}
            {saveError && (
              <div className="flex items-start gap-2 p-3 bg-rust-500/10 border border-rust-500/30 rounded-lg text-xs text-rust-300">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                {saveError}
              </div>
            )}
          </div>

          {/* Results panel */}
          <div className="space-y-4 min-w-0">
            {result ? (
              <>
                {/* Stats bar */}
                <div className="flex flex-wrap items-center gap-4 px-1">
                  <ResultStat
                    icon={<CheckCircle2 size={14} className="text-sage-400" />}
                    label="Позиций"
                    value={result.line_items.length}
                  />
                  <ResultStat
                    icon={<AlertCircle size={14} className="text-amber-400" />}
                    label="С предупреждениями"
                    value={result.line_items.filter(i => i.warnings?.length > 0).length}
                  />
                  <ResultStat
                    label="Ср. уверенность"
                    value={
                      result.line_items.length > 0
                        ? Math.round(result.line_items.reduce((s, i) => s + (i.confidence || 0), 0) / result.line_items.length) + '%'
                        : '—'
                    }
                  />
                  {result.metadata && Object.keys(result.metadata).length > 0 && (
                    <MetadataBadge meta={result.metadata} />
                  )}
                </div>

                <ExportBar
                  items={result.line_items}
                  metadata={result.metadata}
                  documentId={result.documentId}
                />

                <VORTable
                  items={result.line_items}
                  onUpdate={(updated) => setResult(r => ({ ...r, line_items: updated }))}
                />
              </>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      )}

      {/* ─── HISTORY TAB ─────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="animate-slide-up">
          {historyLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="panel p-5 h-32 shimmer-line rounded-lg" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-20 text-ink-500">
              <History_icon size={40} className="mx-auto mb-3 opacity-30" />
              <p>История пуста. Создайте первую выгрузку.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map(doc => (
                <HistoryCard key={doc.id} doc={doc} onClick={() => navigate(`/document/${doc.id}`)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultStat({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {icon}
      <span className="text-ink-400">{label}:</span>
      <span className="text-ink-100 font-mono font-medium">{value}</span>
    </div>
  )
}

function MetadataBadge({ meta }) {
  return (
    <div className="group relative ml-auto">
      <button className="flex items-center gap-1.5 px-3 py-1 bg-ink-800 rounded text-xs text-ink-400 hover:text-ink-200 transition-colors">
        <FileText size={12} />
        Мета
      </button>
      <div className="absolute right-0 top-8 w-72 bg-ink-800 border border-ink-700 rounded-lg p-3 text-xs z-20 hidden group-hover:block shadow-xl space-y-1.5">
        {Object.entries(meta).map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-ink-500 w-24 flex-shrink-0">{k}:</span>
            <span className="text-ink-200 font-mono">{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HistoryCard({ doc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="panel p-5 text-left hover:border-ink-600 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-amber-500" />
          <span className="font-medium text-ink-200 text-sm line-clamp-1">
            {doc.title || 'Без названия'}
          </span>
        </div>
        <ChevronRight size={14} className="text-ink-600 group-hover:text-amber-400 transition-colors flex-shrink-0" />
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-500">
        <Clock size={11} />
        {format(new Date(doc.created_at), 'dd.MM.yyyy HH:mm')}
      </div>
      <div className="mt-2 text-xs font-mono text-ink-600 uppercase">
        {doc.source_type}
        {doc.source_filename && ` · ${doc.source_filename}`}
      </div>
    </button>
  )
}

function EmptyState() {
  return (
    <div className="panel flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-ink-800 flex items-center justify-center mb-4">
        <Sparkles size={28} className="text-ink-500" />
      </div>
      <p className="text-ink-400 text-lg font-medium">Результат появится здесь</p>
      <p className="text-ink-600 text-sm mt-1 max-w-xs">
        Вставьте текст из PDF и нажмите «Создать ВОР»
      </p>
    </div>
  )
}

// local alias to avoid import conflict
function History_icon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
    </svg>
  )
}
