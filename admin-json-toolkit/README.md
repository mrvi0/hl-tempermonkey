# Admin JSON Toolkit

Единый userscript для Django Admin страниц отеля (HotelLab / RevLab):

1. **JSON Search & Replace** — поиск/замена, sync parsing / intercept / price edges  
2. **Base Price Maker** — генерация `base_price`  
3. **Competitors** — визуальный редактор конкурентов, категорий и перенос в сезоны  

## Установка

1. Откройте [`admin-json-toolkit.user.js`](./admin-json-toolkit.user.js)
2. Создайте новый скрипт в Tampermonkey и вставьте код
3. Убедитесь, что старые скрипты JSON Search / Base Price / Competitors **выключены**, иначе будут дубли кнопок

## Match

- `https://app.hotellab.io/*/AdminOnly/mainApp/hotels/*`
- `https://app.revlab.ru/*/AdminOnly/mainApp/hotels/*`

## UI

Одна панель справа снизу (dock): JSON Search · Конкуренты · BP.  
Канон стилей: Retro — [`../shared/ui-kit/TOKENS.md`](../shared/ui-kit/TOKENS.md).  
Логи: `HLTLog` — [`../shared/logging/LOGGING.md`](../shared/logging/LOGGING.md) (в консоли `[HLT:Toolkit/…]`, debug через toggle JSR).

**Hide Elements** — отдельный скрипт: [`../hide-elements/`](../hide-elements/).
