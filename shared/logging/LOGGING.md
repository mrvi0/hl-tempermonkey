# HLT Console Logging

Канон логирования для userscripts. Preview: [`index.html`](./index.html).

Модуль: [`hlt-log.js`](./hlt-log.js) — копировать в userscript или подключать в демо.

## Зачем

Единый стиль: namespace + уровень + `%c` Retro + **коды ошибок с русским описанием**.

## API

```js
const log = HLTLog.create({ ns: 'Toolkit' });
const jsr = log.child('JSR');

jsr.debug('Скан поля', { id: 'id_…' });
jsr.info('Старт поиска', { term: 'hotel_title' });
jsr.ok('Замена выполнена', { configs: 3, hits: 12 });

// Ошибки — по коду (русский title + hint + CODE):
jsr.fail('JSR_INVALID_JSON', { id: '…', cause: err });
// Console:
// [HLT:Toolkit/JSR] ERROR Невалидный JSON в редакторе  [JSR_INVALID_JSON]
// [HLT:Toolkit/JSR] hint Исправь синтаксис в textarea / JSONEditor и повтори
// { code, hint, id, cause: { name, message, stack } }

jsr.event('sync.parsing.start', { seasons: 4 });
jsr.group('classify records', () => {
  jsr.table([{ kind: 'season', title: 'High' }], 'records');
});
```

### `fail(code, payload?)`

1. Берёт запись из `HLTLog.ERRORS[code]`
2. Пишет **русский `title`** как сообщение
3. Добавляет бейдж **`[CODE]`**
4. Отдельным debug-логом — **`hint`** (что делать)
5. В payload кладёт `code`, `hint` и твои поля; `cause: Error` сериализуется в `{ name, message, stack }`

Уровень берётся из каталога (`error` или `warn`).  
Неизвестный код → `UNKNOWN` + имя кода в title.

Список кодов: `HLTLog.codes()` / объект `HLTLog.ERRORS` / кнопка на demo-странице.

### Namespaces

| `ns` | Модуль |
|---|---|
| `Toolkit` | shell / dock |
| `Toolkit/JSR` | JSON Search |
| `Toolkit/BP` | Base Price |
| `Toolkit/Competitors` | Competitors |
| `UIAdmin` | UI Admin |

### Уровни

`debug` < `info` < `ok` < `warn` < `error`  
`setLevel('warn')` пересчитывается на каждый emit.

### Цвета (Retro)

| | |
|---|---|
| NS | `#666547` / `#ffe28a` |
| ok | `#6fcb9f` |
| warn | `#ffe28a` |
| error | `#fb2e01` |

## Русский vs английский

| Что | Язык |
|---|---|
| `title` / `hint` в каталоге, тексты `ok`/`info` в наших скриптах | **русский** |
| Стабильный `CODE` | английский SCREAMING_SNAKE |
| `Error.message` / stack от браузера | как есть (часто EN) — в `cause` |

Так можно: человекочитаемо по-русски, а код остаётся стабильным для поиска/фильтров.

## Правила

1. Новые ошибки — сначала запись в `ERRORS`, потом `log.fail('CODE', …)`.
2. Не логировать секреты / CSRF / полные FormData.
3. Успешные мутации — `ok`.
4. Один `ns` на модуль.

## Demo

[`index.html`](./index.html) → F12 Console → кнопки ошибок и «Список кодов (RU)».

## Нагрузка на страницу

Практически нулевая для Admin:

- модуль ~10–15 KB текста, один раз при загрузке скрипта;
- каждый лог — один `console.*` (браузер и так буферизует консоль);
- по умолчанию в Toolkit уровень **`info`** — `debug` только при включённом debug-toggle JSR;
- не логировать в горячих циклах на каждый `input` без throttle.

Тяжёлое на странице — JSON parse / DOM / POST, не HLTLog.

## Где уже подключено

- `admin-json-toolkit/admin-json-toolkit.user.js` — `Toolkit` / `JSR` / `BP` / `Competitors` (legacy `log()` → bridge)
- `ui-admin/ui-admin.user.js` — `UIAdmin`
