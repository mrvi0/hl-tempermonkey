# Shared patterns for HotelLab userscripts

Справочник для copy-paste в новые Tampermonkey-скрипты.  
**Не** подключается как runtime-модуль — TM обычно один файл на скрипт.

Канон UI-токенов: [ui-kit/TOKENS.md](./ui-kit/TOKENS.md) — палитра **`retro`** (dark).  
Preview компонентов: [ui-kit/index.html](./ui-kit/index.html).  
Канон логов: [logging/LOGGING.md](./logging/LOGGING.md) · demo [logging/index.html](./logging/index.html) · [`hlt-log.js`](./logging/hlt-log.js).  
Правило для агента: `.cursor/rules/ui-kit-retro.mdc`.

---

## 1. Metadata / match

Admin JSON Toolkit и Hide Elements:

```
// @match  https://app.hotellab.io/*/AdminOnly/mainApp/hotels/*
// @match  https://app.revlab.ru/*/AdminOnly/mainApp/hotels/*
```

Узкий change-only (если нужен только form отеля):

```
// @match  https://app.*.ru/*/AdminOnly/mainApp/hotels/*/change/*
```

`@grant none` — по умолчанию для toolkit.  
`GM_setValue` / `GM_getValue` — только если нужны настройки между сессиями (Hide Elements).

Оборачивать всё в IIFE:

```js
(function () {
  'use strict';
  // ...
})();
```

---

## 2. Поиск JSON-редакторов

**Канон:** сначала `.for_jsoneditor`, fallback по `textarea[name]` / содержимому.

```js
function findJsonTextareas(root = document) {
  const byClass = [...root.querySelectorAll('textarea.for_jsoneditor')];
  if (byClass.length) return byClass;
  const CONFIG_RE = /parsing|categorys|concurents|standart_category/;
  return [...root.querySelectorAll('textarea[name], input[name]')]
    .filter((el) => CONFIG_RE.test(el.value || ''));
}
```

Исторически:

| Скрипт | Селектор |
|---|---|
| JSON Search / Base Price | `.for_jsoneditor` |
| Competitors | `textarea[name], input[name]` + regex по value |

---

## 3. Человекочитаемое имя редактора / сезона

```js
function getEditorLabel(textarea) {
  const name = textarea.getAttribute('name') || textarea.id || 'Unknown';
  let displayName = name.replace(/^id_/, '').replace(/_/g, ' ');

  if (name.includes('hotelSeasonsConfigs')) {
    const m = name.match(/hotelSeasonsConfigs-(\d+)-config/);
    if (m) {
      const seasonNameInput = document.getElementById(
        `id_hotelSeasonsConfigs-${m[1]}-name`
      );
      displayName = seasonNameInput?.value
        ? `Сезон: ${seasonNameInput.value}`
        : `Сезон ${Number(m[1]) + 1}`;
    }
  }
  return displayName;
}
```

Для «источник цен» Competitors дополнительно смотрит label / соседние поля (`Источник цен`, `price source`) в предках DOM — см. `extractRecordHumanName` в toolkit.

---

## 4. Запись JSON обратно в страницу

```js
function writeJson(textarea, value) {
  const text =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  textarea.value = text;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));

  // HotelLab JSONEditor instance (если есть)
  const editorDivId = textarea.id + '_jsoneditor';
  const editors = window.jsonEditors;
  if (editors && editors[editorDivId] && typeof editors[editorDivId].set === 'function') {
    try {
      editors[editorDivId].set(
        typeof value === 'string' ? JSON.parse(value) : value
      );
    } catch (_) { /* ignore parse/UI sync errors */ }
  }
}
```

**POST формы Django** (как в Competitors) — отдельный opt-in, не дефолт для search/replace:

```js
async function postAdminForm(form) {
  const url = new URL(form.getAttribute('action') || location.href, location.href).toString();
  const response = await fetch(url, {
    method: 'POST',
    body: new FormData(form),
    credentials: 'same-origin',
    redirect: 'follow',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const html = await response.text();
  if (/errorlist|Please correct the error/i.test(html)) {
    throw new Error('Django validation error');
  }
}
```

Правило: text tools (JSR, Base Price) только пишут в поля; user жмёт Save.  
Structured editor (Competitors) может POST’ить явно по кнопке «Сохранить».

---

## 5. escapeHtml / toast

```js
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message, { error = false } = {}) {
  const el = document.createElement('div');
  el.className = 'hlt-toast' + (error ? ' hlt-toast-error' : '');
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => el.remove(), 2500);
}
```

Стили toast — из TOKENS (`--hlt-*`).

---

## 6. Floating dock

Один стек кнопок справа снизу (не разрозненные top-right / bottom-right):

```html
<div id="hlt-dock">
  <button type="button" class="hlt-dock-btn" data-open="jsr">JSON</button>
  <button type="button" class="hlt-dock-btn" data-open="competitors">Конкуренты</button>
  <button type="button" class="hlt-dock-btn" data-open="bp">BP</button>
</div>
```

Hide Elements **не** входит в этот dock — отдельный скрипт, тумблеры только в меню Tampermonkey.

Z-index: dock `99990`, overlays `99995+`.

---

## 7. Структура конфигов (доменная модель)

Повторяющиеся ключи в JSON отеля:

- `parsing[]` / элементы с `selfID`, `concurents`, …
- `concurents` (орфография как в бэкенде)
- `standart_category` / `categorys` (исторические опечатки в данных — не «исправлять» ключи)
- `history`, `forecast_history`
- сезоны: `hotelSeasonsConfigs-N-config`
- источники: `price_sources_hotels-N-config` или блоки с названием «Источник цен»

Sync parsing (JSR) vs copy to selected seasons (Competitors) — разные UX, одна модель данных.

---

## 8. Чеклист нового AdminOnly-скрипта

1. `@match` на оба домена  
2. IIFE + `'use strict'`  
3. `findJsonTextareas` / `writeJson` / `getEditorLabel` / `escapeHtml`  
4. CSS-переменные из TOKENS, префикс классов `hlt-`  
5. Кнопка в `#hlt-dock` или явный отказ (свой угол)  
6. Не дублировать Base Price / Competitors / JSR — расширять toolkit  
7. Логи через `HLTLog` ([logging/LOGGING.md](./logging/LOGGING.md))

---

## 9. Логирование

Канон: [logging/LOGGING.md](./logging/LOGGING.md), модуль [logging/hlt-log.js](./logging/hlt-log.js).  
Demo симуляций: [logging/index.html](./logging/index.html).

```js
const log = HLTLog.create({ ns: 'Toolkit/JSR' });
log.ok('search done', { matches: 5 });
log.error('invalid JSON', err);
```

Namespaces: `Toolkit`, `Toolkit/JSR`, `Toolkit/BP`, `Toolkit/Competitors`, `UIAdmin`.  
Уровни: `debug` · `info` · `ok` · `warn` · `error` (+ `group` / `table` / `time`).
