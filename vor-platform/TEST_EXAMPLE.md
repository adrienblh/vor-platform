# VОР Parser — Test Input & Expected Output

## Test Input (paste into textarea)

```
Объект: Реконструкция автодороги М-10, участок 44–67 км
Дата составления: 15.01.2024
Составил: Иванов А.В. / ГИП
Проверил: Сидоров П.К. / ГИП

1 Подготовительные работы
1.1 Расчистка полосы отвода от кустарника га 12,50 Работа
1.1-2 Срезка растительного слоя грунта автогрейдером м2 356 472,30 Работа
1.2 Разработка грунта экскаватором в отвал м3 48 200,00 Работа
2 Устройство земляного полотна
2.1 Устройство насыпи из привозного грунта м3 96 000,00 (96000*1,0) Работа
2.1-3 Уплотнение грунта насыпи виброкатком м2 192 000,00 маш-ч 1600,00 Работа
3 Дорожная одежда
3.1 Щебень фракции 40-70 мм т 25 680,50 Материал
3.1-2 Устройство щебёночного основания м2 48 200,00 ЕП-10/2024-ПМ.pdf стр 14 16 Работа
3.2 Асфальтобетонная смесь тип Б т 18 340,20 (18340*1,0) Материал
3.3 Укладка нижнего слоя а/б покрытия м2 48 200,00 Работа
4 Водоотводные сооружения
4.1 Трубы железобетонные d=1000 мм шт 24 Материал
4.2 Монтаж ж/б труб d=1000 мм шт 24 Работа
4.2.1-39 Перевозка грунта автосамосвалами ткм 144 600,00 Перевозка
```

---

## Expected Parsed Output (JSON)

```json
{
  "metadata": {
    "project": "Реконструкция автодороги М-10, участок 44–67 км",
    "date": "15.01.2024",
    "author": "Иванов А.В. / ГИП",
    "reviewer": "Сидоров П.К. / ГИП"
  },
  "line_items": [
    {
      "code": "1.1",
      "name": "Расчистка полосы отвода от кустарника",
      "unit": "га",
      "qty_raw": "12,50",
      "qty_value": 12.5,
      "formula": null,
      "ref_drawings": null,
      "file_name": null,
      "pages": null,
      "comment": null,
      "item_type": "Работа",
      "warnings": [],
      "confidence": 90
    },
    {
      "code": "1.1-2",
      "name": "Срезка растительного слоя грунта автогрейдером",
      "unit": "м2",
      "qty_raw": "356 472,30",
      "qty_value": 356472.3,
      "formula": null,
      "ref_drawings": null,
      "file_name": null,
      "pages": null,
      "comment": null,
      "item_type": "Работа",
      "warnings": [],
      "confidence": 90
    },
    {
      "code": "2.1",
      "name": "Устройство насыпи из привозного грунта",
      "unit": "м3",
      "qty_raw": "96 000,00",
      "qty_value": 96000.0,
      "formula": "(96000*1,0)",
      "ref_drawings": null,
      "file_name": null,
      "pages": null,
      "comment": null,
      "item_type": "Работа",
      "warnings": [],
      "confidence": 90
    },
    {
      "code": "3.1",
      "name": "Щебень фракции 40-70 мм",
      "unit": "т",
      "qty_raw": "25 680,50",
      "qty_value": 25680.5,
      "formula": null,
      "ref_drawings": null,
      "file_name": null,
      "pages": null,
      "comment": null,
      "item_type": "Материал",
      "warnings": [],
      "confidence": 90
    },
    {
      "code": "3.1-2",
      "name": "Устройство щебёночного основания",
      "unit": "м2",
      "qty_raw": "48 200,00",
      "qty_value": 48200.0,
      "formula": null,
      "ref_drawings": null,
      "file_name": "ЕП-10/2024-ПМ.pdf",
      "pages": "14 16",
      "comment": null,
      "item_type": "Работа",
      "warnings": [],
      "confidence": 90
    },
    {
      "code": "4.2.1-39",
      "name": "Перевозка грунта автосамосвалами",
      "unit": "ткм",
      "qty_raw": "144 600,00",
      "qty_value": 144600.0,
      "formula": null,
      "ref_drawings": null,
      "file_name": null,
      "pages": null,
      "comment": null,
      "item_type": "Перевозка",
      "warnings": [],
      "confidence": 90
    }
  ]
}
```

## Notes on Parser Behavior

- `1.1-2` → stored as code string `"1.1-2"` (never parsed as float)
- `356 472,30` → normalized to `356472.3` (space thousands, comma decimal)
- `(96000*1,0)` → captured as formula string, not evaluated
- `ЕП-10/2024-ПМ.pdf` → extracted as file_name
- `стр 14 16` → pages `"14 16"`
- Section headers (`1 Подготовительные работы`) get `warnings: ["Не распознан номер позиции"]`
  since they lack a proper code+content structure
- `item_type` detected from trailing keyword OR content heuristics
