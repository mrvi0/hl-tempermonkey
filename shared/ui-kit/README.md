# UI Kit

Интерактивный справочник стилей для Tampermonkey-скриптов HotelLab / RevLab.

- **Preview:** [index.html](./index.html) (открыть из Windows через `\\wsl$\…\shared\ui-kit\index.html`)
- **Канон токенов:** [TOKENS.md](./TOKENS.md) — палитра **`retro`**, dark only
- **Паттерны кода:** [../PATTERNS.md](../PATTERNS.md)

## Для агента / разработчика

При любой UI-работе в userscripts этого репо:

1. Читать `shared/ui-kit/TOKENS.md` (Retro)
2. Смотреть компоненты в `index.html`
3. Копировать CSS-переменные `--hlt-*` и паттерны классов в `.user.js`
4. Не изобретать новую палитру, пока пользователь явно не попросит сменить канон

Admin JSON Toolkit = один launcher на странице, вкладки внутри.  
Hide Elements = меню расширения Tampermonkey, не dock на странице.

Логирование: см. [`../logging/`](../logging/) (`HLTLog`, Retro badges в console).
