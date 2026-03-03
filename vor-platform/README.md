# ВОР Platform — Ведомость объёмов работ

> **GPT-like dashboard for analysts to generate structured VОР tables from PDF text.**
> Stack: Vite + React · Supabase · Netlify Functions · Tailwind CSS

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React SPA)                      │
│                                                             │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │  Dashboard  │   │   VORTable   │   │   ExportBar     │  │
│  │  (input +   │   │  (editable   │   │  (XLSX/CSV/JSON)│  │
│  │   history)  │   │   inline)    │   │                 │  │
│  └──────┬──────┘   └──────────────┘   └─────────────────┘  │
│         │                                                    │
│  ┌──────▼──────────────────────────────────────────────┐    │
│  │           src/lib/parser.js (heuristic)             │    │
│  │  ─ code regex · unit whitelist · qty normalization  │    │
│  └──────┬──────────────────────────────────────────────┘    │
└─────────┼───────────────────────────────────────────────────┘
          │ supabase-js
┌─────────▼───────────────────────────────────────────────────┐
│                    Supabase (Postgres)                       │
│  tables: documents · line_items · exports                   │
│  RLS: anon all-access (MVP) → add auth later                │
└─────────────────────────────────────────────────────────────┘

          Netlify Function: POST /api/parse
          (same heuristic parser, + optional LLM adapter)
```

### Data Flow

1. Analyst pastes PDF text into textarea
2. `parser.js` runs client-side: splits on row codes, extracts unit/qty/type
3. Results displayed in editable `VORTable`
4. On "Generate", document + line_items saved to Supabase
5. Export to XLSX/CSV/JSON via browser download
6. History tab fetches past documents from Supabase

---

## Setup Instructions

### 1. Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. In **SQL Editor**, run the migration:
   ```sql
   -- paste contents of: supabase/migrations/001_initial_schema.sql
   ```
3. Copy **Project URL** and **anon public key** from Settings → API

### 2. Local Development

```bash
# Clone and install
git clone <your-repo>
cd vor-platform
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run dev server
npm run dev
# Open http://localhost:5173
```

To test Netlify Functions locally:
```bash
npm install -g netlify-cli
netlify dev
# Opens on http://localhost:8888
```

### 3. Netlify Deployment

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login and link project
netlify login
netlify init

# Set environment variables
netlify env:set VITE_SUPABASE_URL     "https://xxx.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "eyJ..."

# Deploy
netlify deploy --build --prod
```

Or connect your GitHub repo to Netlify and it will auto-deploy.

**Build settings in Netlify dashboard:**
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

### 4. Enable LLM Extraction (Optional)

To use Claude (Anthropic) for smarter parsing:
```bash
netlify env:set ENABLE_LLM true
netlify env:set ANTHROPIC_API_KEY "sk-ant-..."
netlify deploy --build --prod
```

The heuristic parser is used client-side. The Netlify function is the LLM-enabled endpoint.
To use the function from the frontend, replace `parseVOR(rawText)` calls with:
```js
const res = await fetch('/api/parse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ raw_text: rawText })
})
const { line_items, metadata } = await res.json()
```

---

## Security Notes

| Concern | Current (MVP) | Recommended Later |
|---|---|---|
| Auth | None — anon access | Supabase Auth (email / SSO) |
| RLS | All-anon policies | `auth.uid() = created_by` |
| API abuse | None | Netlify rate limits + Supabase quotas |
| File uploads | txt only | Validate MIME + size limits |
| Raw text storage | Full text in DB | Consider encryption at rest |

**RLS trade-off:** Current policies let any anonymous user read/write all documents.
This is intentional for the MVP to avoid friction. When adding auth:
1. Add `created_by uuid references auth.users` column
2. Replace anon policies with: `using (auth.uid() = created_by)`

---

## Project Structure

```
vor-platform/
├── src/
│   ├── lib/
│   │   ├── parser.js        # Heuristic VОР parser (core logic)
│   │   ├── exportXLSX.js    # SheetJS XLSX export
│   │   └── supabase.js      # DB client + CRUD helpers
│   ├── components/
│   │   ├── Layout.jsx       # App shell + nav
│   │   ├── VORTable.jsx     # Editable table (search, filter, drag)
│   │   └── ExportBar.jsx    # XLSX / CSV / JSON export buttons
│   ├── pages/
│   │   ├── Dashboard.jsx    # Main page (input + results + history)
│   │   └── DocumentView.jsx # Saved document viewer
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── netlify/
│   └── functions/
│       └── parse.js         # Serverless parse endpoint (+ LLM adapter)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── netlify.toml
├── vite.config.js
├── tailwind.config.js
├── TEST_EXAMPLE.md          # Sample input + expected output
└── .env.example
```

---

## Parser: How It Works

The heuristic parser (`src/lib/parser.js`) processes raw text in these steps:

1. **Normalize** — fix line endings, remove soft hyphens
2. **Split rows** — detect code patterns `^\d+(\.\d+)*(-\d+)?` as row starts; continuation lines are merged
3. **Per-row extraction:**
   - **code** — first token matching the code regex
   - **item_type** — trailing keyword (Работа/Материал/Перевозка) or content heuristics
   - **unit** — whitelist scan (м3, м2, т, шт, га, ткм, etc.)
   - **qty** — number immediately preceding the unit; comma-decimal support (356 472,30 → 356472.3)
   - **formula** — text containing math operators (×, *, /, =)
   - **file_name** — `*.pdf`, `*.dwg`, etc.
   - **pages** — text after `стр` / `страниц` / `лист`
   - **name** — remainder after stripping all extracted tokens
4. **Confidence score** — 100% minus deductions for missing fields
5. **Warnings** — human-readable strings for each missing/suspicious field

Codes like `1.1-2`, `4.2.1-39` are stored **as strings** — never coerced to float.
