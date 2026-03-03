import { Outlet, Link, useLocation } from 'react-router-dom'
import { FileSpreadsheet, History, PlusCircle } from 'lucide-react'

export default function Layout() {
  const loc = useLocation()

  return (
    <div className="min-h-screen flex flex-col bg-ink-950">
      {/* Top bar */}
      <header className="border-b border-ink-800 bg-ink-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-ink-950" />
            </div>
            <span className="font-display text-2xl tracking-widest text-ink-100 group-hover:text-amber-400 transition-colors">
              ВОР
            </span>
            <span className="text-ink-500 text-xs font-mono mt-0.5 hidden sm:block">
              / Ведомость объёмов работ
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm transition-colors ${
                loc.pathname === '/'
                  ? 'bg-ink-800 text-ink-100'
                  : 'text-ink-400 hover:text-ink-200 hover:bg-ink-900'
              }`}
            >
              <PlusCircle size={15} />
              <span className="hidden sm:block">Новая</span>
            </Link>
            <Link
              to="/?tab=history"
              className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm transition-colors ${
                loc.search.includes('history')
                  ? 'bg-ink-800 text-ink-100'
                  : 'text-ink-400 hover:text-ink-200 hover:bg-ink-900'
              }`}
            >
              <History size={15} />
              <span className="hidden sm:block">История</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink-900 py-4 px-6">
        <p className="text-ink-600 text-xs font-mono text-center">
          VОР Platform · MVP · No auth · Supabase + Netlify
        </p>
      </footer>
    </div>
  )
}
