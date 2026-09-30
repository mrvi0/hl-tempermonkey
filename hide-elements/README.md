# Hide Elements

> Бывший **UI Admin Helper**. Скрытие блоков на странице AdminOnly hotel change через меню Tampermonkey.  
> JSON Search / Base Price / Competitors — в [`../admin-json-toolkit/`](../admin-json-toolkit/).

## Возможности

### Меню расширения (Tampermonkey → Hide Elements)

| Пункт | По умолчанию | Storage key |
|---|---|---|
| 👁 Архивные сезоны | скрыты | `ui_admin_show_archived` |
| 👁 Категории номеров | показаны | `ui_admin_show_room_categories` |
| 👁 Пользователи | показаны | `ui_admin_show_users` |
| ↺ Сбросить все настройки | — | сброс тумблеров + collapse JSON |

Ключи `ui_admin_*` сохранены для совместимости с прежними установками.

### На странице

Кнопки сворачивания у label top-level JSON-конфигов (`emailmessage`, `pms_config`, …). Состояние — отдельные `ui_admin_*_collapsed` ключи.

На странице **нет** плавающей кнопки настроек.

## Установка

1. Tampermonkey / Violentmonkey  
2. Новый скрипт ← вставить [`hide-elements.user.js`](./hide-elements.user.js)  
3. Отключить старый **UI Admin Helper**, если ещё установлен  
4. Открыть `…/AdminOnly/mainApp/hotels/*/change/` → меню расширения

## Версия

**2.0.0** — rename, TM menu instead of floating popup, без HLTLog.

## Автор

**Mr Vi** · лицензия: [`../LICENSE`](../LICENSE)
