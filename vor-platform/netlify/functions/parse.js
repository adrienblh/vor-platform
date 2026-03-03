/**
 * Netlify Function: /api/parse
 * POST { raw_text, filename?, source_type? }
 * Returns { document_id?, line_items[] }
 *
 * Uses heuristic parser by default.
 * Set ENABLE_LLM=true + OPENAI_API_KEY or ANTHROPIC_API_KEY in env to enable LLM adapter.
 */

// We inline the parser here since Netlify functions can't import from src/
// In a real monorepo you'd use a shared package.

const KNOWN_UNITS = [
  'м3','м²','м2','м','км','л','т','кг','г',
  'п.м.','пм','п/м','шт','шт.','компл','компл.',
  'га','кв.м','кв.км','чел-ч','маш-ч','чел-см',
  'рейс','ткм','кВт','кВтч','МВт','объект','этаж',
]

const CODE_RE = /^\s*(\d+(?:\.\d+)*(?:-\d+)?)\s+/
const NUM_RE = /(\d[\d\s]*[,.]?\d*)\s*(?:м3|м²|м2|т\b|кг|шт|п\.м\.|га|кВт|маш-ч|чел-ч|компл|рейс|ткм|км|м\b)/i
const FILE_RE = /[\w\-]+\.(?:pdf|dwg|xlsx?|docx?|jpg|png)/i
const PAGE_RE = /(?:стр|страниц|лист)[.\s]*(\d[\d\s\-,]*)/i

function parseCommaDecimal(str) {
  if (!str) return null
  const v = parseFloat(str.replace(/\s/g, '').replace(',', '.'))
  return isNaN(v) ? null : v
}

function normalizeUnit(raw) {
  if (!raw) return null
  const lower = raw.trim().toLowerCase()
  const match = KNOWN_UNITS.find(u => u.toLowerCase() === lower || lower.includes(u.toLowerCase()))
  return match || raw.trim()
}

function detectItemType(text) {
  if (/\b(Работа)\b/i.test(text)) return 'Работа'
  if (/\b(Материал|поставк)\b/i.test(text)) return 'Материал'
  if (/\b(Перевозк|транспортировк)\b/i.test(text)) return 'Перевозка'
  return null
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

function extractMetadata(text) {
  const meta = {}
  const fields = [
    ['date',     /Дата\s+составления[:\s]+([^\n\r]+)/i],
    ['author',   /Составил[:\s]+([^\n\r]+)/i],
    ['reviewer', /Проверил[:\s]+([^\n\r]+)/i],
    ['basis',    /Основани[еяю][:\s]+([^\n\r]+)/i],
    ['project',  /Объект[:\s]+([^\n\r]+)/i],
  ]
  for (const [key, re] of fields) {
    const m = text.match(re)
    if (m) meta[key] = m[1].trim()
  }
  return meta
}

function parseVOR(rawText) {
  if (!rawText?.trim()) return { line_items: [], metadata: {} }
  const metadata = extractMetadata(rawText)

  let text = rawText
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/\u00AD/g, '').replace(/\u2010/g, '-')

  const rawLines = text.split('\n')
  const rows = []
  let current = null

  for (const line of rawLines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const codeMatch = trimmed.match(CODE_RE)
    if (codeMatch) {
      if (current) rows.push(current)
      current = { code: codeMatch[1], raw: trimmed, extra: [] }
    } else if (current) {
      current.extra.push(trimmed)
      current.raw += ' ' + trimmed
    } else {
      rows.push({ code: null, raw: trimmed, extra: [] })
    }
  }
  if (current) rows.push(current)

  const line_items = []

  for (const row of rows) {
    if (!row.raw || row.raw.length < 3) continue
    const full = row.raw
    const warnings = []
    const code = row.code || null
    if (!code) warnings.push('Не распознан номер позиции')

    let workText = full
    let item_type = null
    const typeMatch = full.match(/\b(Работа|Материал|Перевозка)\s*$/i)
    if (typeMatch) {
      item_type = typeMatch[1]
      workText = full.slice(0, full.lastIndexOf(typeMatch[0])).trim()
    } else {
      item_type = detectItemType(full)
    }

    let unit = null
    for (const u of KNOWN_UNITS) {
      const re = new RegExp(`\\b${u.replace('.', '\\.')}\\b`, 'i')
      if (re.test(workText)) { unit = u; break }
    }
    if (!unit) warnings.push('Не определена единица измерения')

    let qty_raw = null, qty_value = null
    const qtyMatch = workText.match(NUM_RE)
    if (qtyMatch) {
      qty_raw = qtyMatch[1].trim()
      qty_value = parseCommaDecimal(qty_raw)
    } else {
      const nums = [...workText.matchAll(/(?<![.\d])([\d]+[,.]?[\d]*)\s*(?=[^,.\d]|$)/g)]
      if (nums.length > 0) {
        qty_raw = nums[nums.length - 1][1]
        qty_value = parseCommaDecimal(qty_raw)
      }
    }
    if (qty_value === null) warnings.push('Не определён объём работ')

    const fileMatch = workText.match(FILE_RE)
    const file_name = fileMatch ? fileMatch[0] : null
    const pageMatch = workText.match(PAGE_RE)
    const pages = pageMatch ? pageMatch[1].trim() : null

    let name = workText
      .replace(CODE_RE, '')
      .replace(new RegExp(`\\b${(unit || '').replace('.', '\\.')}\\b`, 'i'), '')
      .replace(/\b\d[\d,.\s]+\b/, '')
      .replace(FILE_RE, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (code && name.startsWith(code)) name = name.slice(code.length).trim()

    const item = {
      code, name: name || null, unit: normalizeUnit(unit),
      qty_raw: qty_raw || null, qty_value,
      formula: null, ref_drawings: null, file_name, pages,
      comment: null, item_type, warnings,
      _raw_row_text: full,
    }
    item.confidence = computeConfidence(item)
    line_items.push(item)
  }

  return { line_items, metadata }
}

// ─────────────────────────────────────────────
// Optional LLM adapter (disabled by default)
// ─────────────────────────────────────────────

async function parseWithLLM(rawText) {
  const key = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
  if (!key) throw new Error('No LLM API key configured')

  // Using Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        system: `You are a structured data extractor for Russian construction documents.
Extract a ВОР (Ведомость объёмов работ) table from the provided text.
Return ONLY a valid JSON array of objects with these keys:
code, name, unit, qty_raw, qty_value (number|null), formula, ref_drawings, file_name, pages, comment, item_type ("Работа"|"Материал"|"Перевозка"|null), warnings (string[]).
No markdown, no explanation — just the JSON array.`,
        messages: [{ role: 'user', content: rawText }],
      }),
    })
    const data = await res.json()
    const text = data.content?.[0]?.text || '[]'
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  }

  // Using OpenAI (fallback)
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Extract ВОР rows from Russian construction text. Return JSON: { "items": [...] }',
        },
        { role: 'user', content: rawText },
      ],
    }),
  })
  const data = await res.json()
  const json = JSON.parse(data.choices[0].message.content)
  return json.items || []
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  try {
    const { raw_text, filename, source_type } = JSON.parse(event.body || '{}')

    if (!raw_text?.trim()) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'raw_text is required' }),
      }
    }

    let line_items, metadata

    if (process.env.ENABLE_LLM === 'true') {
      try {
        line_items = await parseWithLLM(raw_text)
        metadata = extractMetadata(raw_text)
      } catch (e) {
        console.warn('LLM parse failed, falling back to heuristic:', e.message)
        ;({ line_items, metadata } = parseVOR(raw_text))
      }
    } else {
      ;({ line_items, metadata } = parseVOR(raw_text))
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ line_items, metadata, count: line_items.length }),
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message }),
    }
  }
}
