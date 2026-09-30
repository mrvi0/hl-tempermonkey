# UI tokens — CANON: Retro (dark)

Источник правды для визуала userscripts в этом репо.

| | |
|---|---|
| **Палитра** | `retro` (обязательная для production UI) |
| **Mode** | Dark only |
| **UI font** | `"Source Sans 3", system-ui, sans-serif` |
| **Mono** | `"JetBrains Mono", ui-monospace, monospace` |
| **Living preview** | [`index.html`](./index.html) |

Другие палитры в `index.html` — только для сравнения. В код скриптов копировать **Retro**.

Исходный набор Retro (ColorHex): `#666547` `#fb2e01` `#6fcb9f` `#ffe28a` `#fffeb3`.

---

## CSS variables (копировать в userscript)

Префикс `--hlt-` в скриптах; в UI-kit те же значения без префикса (`--accent` и т.д.).

```css
:root {
  --hlt-font-ui: "Source Sans 3", system-ui, sans-serif;
  --hlt-font-mono: "JetBrains Mono", ui-monospace, monospace;

  --hlt-page-bg: #0f1419;
  --hlt-panel: #1a222b;
  --hlt-surface: #151c24;
  --hlt-input-bg: #121820;
  --hlt-text: #e8eef3;
  --hlt-muted: #9aa8b5;
  --hlt-border: #2d3a46;

  --hlt-accent: #6fcb9f;
  --hlt-accent-hover: #8fd9b5;
  --hlt-accent-soft: #666547;
  --hlt-accent-soft-fg: #ffe28a;
  --hlt-accent-contrast: #0c1a14;
  --hlt-accent-mid: #6fcb9f;
  --hlt-accent-strong: #fb2e01;
  --hlt-accent-strong-contrast: #1a0500;

  --hlt-danger: #fb2e01;
  --hlt-ok: #4ade80;
  --hlt-warn: #ffe28a;

  --hlt-diff-del-bg: #4a1208;
  --hlt-diff-del-fg: #ff8a6e;
  --hlt-diff-add-bg: #1e3a30;
  --hlt-diff-add-fg: #6fcb9f;

  --hlt-cal-range-bg: #666547;
  --hlt-cal-range-fg: #fffeb3;

  --hlt-radius-ctl: 8px;
  --hlt-radius-card: 12px;
  --hlt-radius-btn: 8px;
  --hlt-radius-launcher: 10px;
  --hlt-z-dock: 99990;
  --hlt-z-overlay: 99995;
  --hlt-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
}
```

В Tampermonkey Google Fonts не подключать без нужды — допустим system fallback:

```css
--hlt-font-ui: "Source Sans 3", system-ui, -apple-system, "Segoe UI", sans-serif;
```

---

## Кнопки (шкала)

| Class (UI-kit) | Роль | Цвет |
|---|---|---|
| `.btn` | нейтральная | border / input-bg |
| `.btn-accent-soft` | мягкий акцент | soft olive + soft-fg |
| `.btn-primary` | основной | accent mint `#6fcb9f` |
| `.btn-accent-strong` | сильный CTA | `#fb2e01` |
| `.btn-launcher` | открытие toolkit | как primary, heavier |
| `.btn-danger` / `.btn-ghost` / `.btn-icon` | спец. |

---

## Компоненты (использовать из UI-kit)

Кнопки · input/select/textarea · **range** · checkbox · radio · **toggle** · **tabs** · **tooltip** · **dropdown** · **pagination** · status/pill/toast · **diff** · **calendar** (in-range / selected) · table sticky · card/modal/full-shell · loader/skeleton/empty · **один** toolkit launcher (не три отдельные кнопки на странице).

UI Admin — **не** плавающая кнопка; опции через Tampermonkey `GM_registerMenuCommand`.

Классы в userscripts: префикс `hlt-` (например `hlt-btn-primary`), чтобы не конфликтовать с Django Admin.

---

## Альтернативы в preview (не канон)

`navy-lime` · `navy-coral` · `coral-algae` · `coral-teal` · `beach` · `cappuccino`
