# Tampermonkey Scripts для HotelLab

Коллекция пользовательских скриптов для HotelLab / RevLab и связанных систем.

## Структура

| Папка | Назначение |
|---|---|
| [admin-json-toolkit/](./admin-json-toolkit/) | **Admin JSON Toolkit** — поиск/замена JSON, Base Price, редактор конкурентов |
| [hide-elements/](./hide-elements/) | **Hide Elements** — скрытие блоков AdminOnly через меню TM (бывший UI Admin) |
| [url-collector/](./url-collector/) | Сборщик URL (TravelLine / Ostrovok) |
| [forecast-filter/](./forecast-filter/) | Фильтр прогнозов в ЛК HotelLab |
| [source-info/](./source-info/) | B4DCAT Tools — метки провайдеров в Rate Shopper / Calendar |
| [hotel-id-finder/](./hotel-id-finder/) | Поиск ID отелей TL / Bnovo / Booking |
| [page-speed/](./page-speed/) | Замер скорости страницы и критичных XHR |
| [starfederation-lib-parser/](./starfederation-lib-parser/) | Парсер справочника Звёздной Федерации |
| [personal/](./personal/) | Личные скрипты |
| [shared/](./shared/) | Справочники: паттерны кода, UI-kit (не ставятся в Tampermonkey) |
| [_deprecated/](./_deprecated/) | Устаревшие скрипты (не для установки) |

## Shared

- [shared/PATTERNS.md](./shared/PATTERNS.md) — повторяющиеся модули и соглашения для новых скриптов
- [shared/ui-kit/](./shared/ui-kit/) — **UI kit** (канон стилей **Retro**, dark)
  - [TOKENS.md](./shared/ui-kit/TOKENS.md) — CSS-токены (обязательно при любой UI-работе)
  - [index.html](./shared/ui-kit/index.html) — интерактивный каталог компонентов
  - [README.md](./shared/ui-kit/README.md)
- [shared/logging/](./shared/logging/) — **логирование в консоли**
  - [LOGGING.md](./shared/logging/LOGGING.md) — API и правила
  - [hlt-log.js](./shared/logging/hlt-log.js) — модуль для copy-paste
  - [index.html](./shared/logging/index.html) — симуляции действий/ошибок

Открыть UI-kit из Windows:  
`\\wsl$\Ubuntu\home\vi\projects\tempermoneky\shared\ui-kit\index.html`  

Логирование demo:  
`\\wsl$\Ubuntu\home\vi\projects\tempermoneky\shared\logging\index.html`

Cursor подхватывает канон через [`.cursor/rules/ui-kit-retro.mdc`](./.cursor/rules/ui-kit-retro.mdc) (`alwaysApply`).

## Быстрый старт

1. Установите [Tampermonkey](https://www.tampermonkey.net/) или [Violentmonkey](https://violentmonkey.github.io/)
2. Откройте `.user.js` нужного проекта
3. Создайте скрипт в расширении, вставьте код, сохраните

## Лицензия

См. [LICENSE](./LICENSE). Коммерческое использование без указания автора запрещено.

Автор: **Mr Vi**
