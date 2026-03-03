/**
 * XLSX export using SheetJS (xlsx package).
 * Produces a styled workbook matching the VОР table format.
 */
import * as XLSX from 'xlsx'

const COLUMNS = [
  { key: 'code',         label: '№ п.п.',                      width: 10 },
  { key: 'name',         label: 'Наименование работ, ресурсов, затрат', width: 50 },
  { key: 'unit',         label: 'Ед. изм.',                    width: 10 },
  { key: 'qty_raw',      label: 'Объём (строка)',               width: 18 },
  { key: 'qty_value',    label: 'Объём (число)',                width: 15 },
  { key: 'formula',      label: 'Формула расчёта',             width: 35 },
  { key: 'ref_drawings', label: 'Ссылка на чертежи',           width: 25 },
  { key: 'file_name',    label: 'Имя файла',                   width: 25 },
  { key: 'pages',        label: 'Страницы',                    width: 15 },
  { key: 'comment',      label: 'Комментарий',                 width: 30 },
  { key: 'item_type',    label: 'Тип позиции',                 width: 15 },
]

export function exportXLSX(items, filename = 'ВОР.xlsx', metadata = {}) {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: VОР table ────────────────────────────────────────────────
  const headerRow = COLUMNS.map(c => c.label)
  const dataRows = items.map(item =>
    COLUMNS.map(c => {
      const v = item[c.key]
      return v === null || v === undefined ? '' : v
    })
  )

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])

  // Column widths
  ws['!cols'] = COLUMNS.map(c => ({ wch: c.width }))

  // Freeze top row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  XLSX.utils.book_append_sheet(wb, ws, 'ВОР')

  // ── Sheet 2: Metadata ─────────────────────────────────────────────────
  if (Object.keys(metadata).length > 0) {
    const metaData = [
      ['Поле', 'Значение'],
      ['Дата составления', metadata.date || ''],
      ['Составил', metadata.author || ''],
      ['Проверил', metadata.reviewer || ''],
      ['Основание', metadata.basis || ''],
      ['Объект', metadata.project || ''],
    ]
    const wsMeta = XLSX.utils.aoa_to_sheet(metaData)
    wsMeta['!cols'] = [{ wch: 25 }, { wch: 50 }]
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Метаданные')
  }

  XLSX.writeFile(wb, filename)
}
