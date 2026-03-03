/**
 * VOR Heuristic Parser
 * Parses raw text extracted from PDF into structured ВОР line items.
 * No external API calls – pure regex + rules.
 */

// ─── Units whitelist ────────────────────────────────────────────────────────
const KNOWN_UNITS = [
  'м3', 'м²', 'м2', 'м', 'км', 'дм3', 'см3', 'л',
  'т', 'кг', 'г',
  'п.м.', 'пм', 'п/м',
  'шт', 'шт.', 'компл', 'компл.',
  'га', 'кв.м', 'кв.км',
  'чел-ч', 'маш-ч', 'чел-см',
  'рейс', 'ткм',
  'кВт', 'кВтч', 'МВт',
  'объект', 'этаж', 'секция', 'пролёт', 'пролет',
  'уп', 'уп.', 'рул', 'рул.',
]

// ─── Item type keywords ────────────────────────────────────────────────────
const ITEM_TYPE_MAP = {
  'Работа': /работ[аыеи]?|монтаж|демонтаж|устройство|разработка|прокладка|укладка|установка|сборка|разборка|бурение|сварка/i,
  'Материал': /материал|поставка|конструкци|труб[аы]|арматур|бетон|кирпич|металл|профил|плит[аы]|кабел|провод|утеплител/i,
  'Перевозка': /перевозк|транспортировк|доставк|вывоз|завоз/i,
}

// ─── Row code pattern ─────────────────────────────────────────────────────
//  Matches: 1, 1.1, 1.1.2, 4.2.1-39, 6.1.1-2 etc.
const CODE_RE = /^\s*(\d+(?:\.\d+)*(?:-\d+)?)\s+/

// ─── Numeric value (comma or dot decimal) ────────────────────────────────
const NUM_RE = /(\d[\d\s]*[,.]?\d*)\s*(?:м3|м²|м2|т\b|кг|шт|п\.м\.|га|кВт|маш-ч|чел-ч|компл|рейс|ткм|км|м\b)/i

// ─── Formula detection ────────────────────────────────────────────────────
const FORMULA_RE = /[=×x*\(\)\/\+\-]\s*[\d,\.]+|[\d,\.]+\s*[×x*\/]\s*[\d,\.]/

// ─── File reference ───────────────────────────────────────────────────────
const FILE_RE = /[\w\-]+\.(?:pdf|dwg|xlsx?|docx?|jpg|png)/i
const PAGE_RE = /(?:стр|страниц|лист|sheet|page)[.\s]*(\d[\d\s\-,]*)/i

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function parseCommaDecimal(str) {
  if (!str) return null
  const clean = str.replace(/\s/g, '').replace(',', '.')
  const v = parseFloat(clean)
  return isNaN(v) ? null : v
}

function normalizeUnit(raw) {
  if (!raw) return null
  const lower = raw.trim().toLowerCase()
  const match = KNOWN_UNITS.find(u => u.toLowerCase() === lower || lower.includes(u.toLowerCase()))
  return match || raw.trim()
}

function detectItemType(text) {
  // Explicit keyword at end of string (common in PDF tables)
  const endWord = text.match(/\b(Работа|Материал|Перевозка)\s*$/i)
  if (endWord) return endWord[1]

  for (const [type, re] of Object.entries(ITEM_TYPE_MAP)) {
    if (re.test(text)) return type
  }
  return null
}

function computeConfidence(item) {
  let score = 100
  if (!item.code) score -= 10
  if (!item.name || item.name.length < 5) score -= 20
  if (!item.unit) score -= 20
  if (item.qty_value === null) score -= 20
  if (!item.item_type) score -= 10
  score -= (item.warnings?.length || 0) * 5
  return Math.max(0, Math.min(100, score))
}

// ─────────────────────────────────────────────────────────────────────────
// Metadata (header) extraction
// ─────────────────────────────────────────────────────────────────────────

export function extractMetadata(text) {
  const meta = {}
  const fields = [
    ['date', /Дата\s+составления[:\s]+([^\n\r]+)/i],
    ['author', /Составил[:\s]+([^\n\r]+)/i],
    ['reviewer', /Проверил[:\s]+([^\n\r]+)/i],
    ['basis', /Основани[еяю][:\s]+([^\n\r]+)/i],
    ['project', /Объект[:\s]+([^\n\r]+)/i],
  ]
  for (const [key, re] of fields) {
    const m = text.match(re)
    if (m) meta[key] = m[1].trim()
  }
  return meta
}

// ─────────────────────────────────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────────────────────────────────

export function parseVOR(rawText) {
  if (!rawText || !rawText.trim()) return { line_items: [], metadata: {} }

  const metadata = extractMetadata(rawText)

  // Normalize line endings, fix soft hyphens
  let text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00AD/g, '') // soft hyphen
    .replace(/\u2010/g, '-')

  // Split into candidate rows: a new row starts when we see a code pattern at the start
  const rawLines = text.split('\n')
  const rows = []
  let current = null

  for (const line of rawLines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const codeMatch = trimmed.match(CODE_RE)
    if (codeMatch) {
      if (current) rows.push(current)
      current = {
        code: codeMatch[1],
        raw: trimmed,
        extra: [],
      }
    } else if (current) {
      current.extra.push(trimmed)
      current.raw += ' ' + trimmed
    } else {
      // Before first code — likely header text, skip or accumulate
      rows.push({ code: null, raw: trimmed, extra: [] })
    }
  }
  if (current) rows.push(current)

  const line_items = []

  for (const row of rows) {
    if (!row.raw || row.raw.length < 3) continue

    const full = row.raw
    const warnings = []

    // ── Code ──
    const code = row.code || null
    if (!code) warnings.push('Не распознан номер позиции')

    // ── Item type (strip from end if present) ──
    let workText = full
    let item_type = null
    const typeMatch = full.match(/\b(Работа|Материал|Перевозка)\s*$/i)
    if (typeMatch) {
      item_type = typeMatch[1]
      workText = full.slice(0, full.lastIndexOf(typeMatch[0])).trim()
    } else {
      item_type = detectItemType(full)
    }

    // ── Unit ──
    let unit = null
    for (const u of KNOWN_UNITS) {
      // look for unit as standalone word
      const re = new RegExp(`\\b${u.replace('.', '\\.')}\\b`, 'i')
      if (re.test(workText)) {
        unit = u
        break
      }
    }
    if (!unit) warnings.push('Не определена единица измерения')

    // ── Quantity ──
    let qty_raw = null
    let qty_value = null
    const qtyMatch = workText.match(NUM_RE)
    if (qtyMatch) {
      qty_raw = qtyMatch[1].trim()
      qty_value = parseCommaDecimal(qty_raw)
    } else {
      // fallback: last standalone number in the line
      const nums = [...workText.matchAll(/(?<![.\d])([\d]+[,.]?[\d]*)\s*(?=[^,.\d]|$)/g)]
      if (nums.length > 0) {
        const last = nums[nums.length - 1]
        qty_raw = last[1]
        qty_value = parseCommaDecimal(qty_raw)
      }
    }
    if (qty_value === null) warnings.push('Не определён объём работ')

    // ── Formula ──
    let formula = null
    const fMatch = workText.match(FORMULA_RE)
    if (fMatch) {
      // grab from first formula-like char to end of number sequence
      const fi = workText.search(FORMULA_RE)
      formula = workText.slice(Math.max(0, fi - 20), fi + 80).trim()
    }

    // ── File name ──
    const fileMatch = workText.match(FILE_RE)
    const file_name = fileMatch ? fileMatch[0] : null

    // ── Pages ──
    const pageMatch = workText.match(PAGE_RE)
    const pages = pageMatch ? pageMatch[1].trim() : null

    // ── Name (what's left after stripping code, unit, qty etc.) ──
    let name = workText
      .replace(CODE_RE, '')
      .replace(new RegExp(`\\b${(unit || '').replace('.', '\\.')}\\b`, 'i'), '')
      .replace(/\b\d[\d,.\s]+\b/, '')
      .replace(FILE_RE, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    // Remove code prefix from name if present
    if (code && name.startsWith(code)) name = name.slice(code.length).trim()

    const item = {
      code,
      name: name || null,
      unit: normalizeUnit(unit),
      qty_raw: qty_raw || null,
      qty_value,
      formula,
      ref_drawings: null,
      file_name,
      pages,
      comment: null,
      item_type,
      warnings,
      _raw_row_text: full,
      confidence: 0,
    }

    item.confidence = computeConfidence(item)
    line_items.push(item)
  }

  return { line_items, metadata }
}

// ─────────────────────────────────────────────────────────────────────────
// Export helpers
// ─────────────────────────────────────────────────────────────────────────

export function toCSV(items) {
  const headers = [
    '№ п.п.', 'Наименование работ', 'Ед. изм.', 'Объём (строка)', 'Объём (число)',
    'Формула', 'Ссылка на чертежи', 'Имя файла', 'Страницы', 'Комментарий',
    'Тип позиции', 'Предупреждения'
  ]
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const rows = items.map(i => [
    i.code, i.name, i.unit, i.qty_raw, i.qty_value,
    i.formula, i.ref_drawings, i.file_name, i.pages, i.comment,
    i.item_type, (i.warnings || []).join('; ')
  ].map(escape).join(','))

  return [headers.map(escape).join(','), ...rows].join('\n')
}

export function toJSON(items) {
  return JSON.stringify(items.map(i => {
    const { _raw_row_text, confidence, ...rest } = i
    return rest
  }), null, 2)
}
