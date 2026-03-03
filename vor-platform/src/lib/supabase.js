import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing env vars VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — running in offline/demo mode.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────

export async function saveDocument({ title, source_type, source_filename, raw_text, metadata }) {
  const { data, error } = await supabase
    .from('documents')
    .insert([{ title, source_type, source_filename, raw_text, metadata }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getDocuments() {
  const { data, error } = await supabase
    .from('documents')
    .select('id, created_at, title, source_type, source_filename, metadata')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data || []
}

export async function getDocument(id) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────
// Line items
// ─────────────────────────────────────────────

export async function saveLineItems(documentId, items) {
  const rows = items.map((item, i) => ({
    document_id: documentId,
    row_index: i,
    code: item.code || null,
    name: item.name || null,
    unit: item.unit || null,
    qty_raw: item.qty_raw || null,
    qty_value: item.qty_value ?? null,
    formula: item.formula || null,
    ref_drawings: item.ref_drawings || null,
    file_name: item.file_name || null,
    pages: item.pages || null,
    comment: item.comment || null,
    item_type: item.item_type || null,
    warnings: item.warnings || [],
  }))

  const { data, error } = await supabase
    .from('line_items')
    .insert(rows)
    .select()
  if (error) throw error
  return data || []
}

export async function getLineItems(documentId) {
  const { data, error } = await supabase
    .from('line_items')
    .select('*')
    .eq('document_id', documentId)
    .order('row_index', { ascending: true })
  if (error) throw error
  return data || []
}

export async function updateLineItem(id, patch) {
  const { data, error } = await supabase
    .from('line_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteLineItem(id) {
  const { error } = await supabase.from('line_items').delete().eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────
// Exports log
// ─────────────────────────────────────────────

export async function logExport({ document_id, type }) {
  await supabase.from('exports').insert([{ document_id, type }])
}
