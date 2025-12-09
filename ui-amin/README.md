# Настройка автоматических обновлений для UI Admin Helper

## Вариант 1: GitHub (Рекомендуется) ⭐

### Шаг 1: Создайте репозиторий на GitHub

1. Перейдите на [GitHub](https://github.com) и создайте новый репозиторий
2. Назовите его, например, `tempermoneky` или `hotellab-scripts`
3. Сделайте репозиторий **публичным** (Public) - это важно для raw URLs

### Шаг 2: Загрузите файл скрипта

1. Загрузите файл `ui-admin.user.js` в репозиторий
2. Убедитесь, что файл находится в папке `ui-amin/` (или в корне)

### Шаг 3: Получите Raw URL

1. Откройте файл `ui-admin.user.js` на GitHub
2. Нажмите кнопку **"Raw"** (справа вверху)
3. Скопируйте URL из адресной строки
   - Пример: `https://raw.githubusercontent.com/your-username/tempermoneky/main/ui-amin/ui-admin.user.js`

### Шаг 4: Обновите скрипт

1. Откройте файл `ui-admin.user.js` локально
2. Замените `YOUR_USERNAME` и `YOUR_REPO` на реальные значения:
   ```javascript
   // @updateURL    https://raw.githubusercontent.com/your-username/tempermoneky/main/ui-amin/ui-admin.user.js
   // @downloadURL  https://raw.githubusercontent.com/your-username/tempermoneky/main/ui-amin/ui-admin.user.js
   ```
3. Сохраните файл и загрузите обновленную версию на GitHub

### Шаг 5: Установка для коллег

Коллеги должны:
1. Установить скрипт из GitHub (через Raw URL)
2. В Tampermonkey Dashboard → Settings → включить "Check for updates" (Every day)
3. При обновлении версии скрипта они увидят уведомление и смогут обновиться одной кнопкой

---

## Вариант 2: GreasyFork (Специализированная платформа)

### Преимущества:
- ✅ Автоматические обновления встроены
- ✅ Версионирование
- ✅ Статистика использования
- ✅ Комментарии и обсуждения

### Как использовать:

1. Зарегистрируйтесь на [GreasyFork](https://greasyfork.org/)
2. Создайте новый скрипт
3. Вставьте код из `ui-admin.user.js`
4. Опубликуйте скрипт
5. GreasyFork автоматически добавит `@updateURL` и `@downloadURL`

**Важно:** Удалите строки `@updateURL` и `@downloadURL` из скрипта перед загрузкой на GreasyFork - они добавятся автоматически.

---

## Вариант 3: Pastebin / Gist (Быстро, но менее надежно)

### GitHub Gist:

1. Перейдите на [gist.github.com](https://gist.github.com)
2. Создайте новый Gist
3. Вставьте код скрипта
4. Нажмите "Create public gist"
5. Нажмите "Raw" и скопируйте URL
6. Используйте этот URL в `@updateURL` и `@downloadURL`

**Формат URL:** `https://gist.githubusercontent.com/USERNAME/GIST_ID/raw/FILENAME`

---

## Как это работает для коллег

1. **Первая установка:**
   - Коллега устанавливает скрипт через Raw URL или GreasyFork
   - Tampermonkey запоминает `@updateURL`

2. **Проверка обновлений:**
   - Tampermonkey периодически проверяет `@updateURL`
   - Сравнивает версию в мета-блоке с текущей установленной
   - Если версия выше - показывает уведомление

3. **Обновление:**
   - Коллега видит уведомление: "Доступна новая версия"
   - Нажимает "Обновить"
   - Скрипт автоматически загружается с `@downloadURL`

---

## Настройки Tampermonkey для коллег

В Dashboard → Settings:
- ✅ **Check for updates**: Every day (или Every hour для тестирования)
- ✅ **Show update notification**: Yes
- ✅ **Update check mode**: Smart (рекомендуется)

---

## Важно при обновлении версии

При каждом обновлении скрипта:

1. **Увеличьте версию** в мета-блоке:
   ```javascript
   // @version      1.4.0  →  // @version      1.4.1
   ```

2. **Загрузите обновленный файл** на GitHub/GreasyFork

3. **Коллеги получат уведомление** автоматически при следующей проверке

---

## Пример финального мета-блока (GitHub)

```javascript
// ==UserScript==
// @name         UI Admin Helper
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  Утилита для управления отображением архивных блоков в Django Admin
// @author       Mr Vi
// @match        https://app.hotellab.io/ru/AdminOnly/mainApp/hotels/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/your-username/tempermoneky/main/ui-amin/ui-admin.user.js
// @downloadURL  https://raw.githubusercontent.com/your-username/tempermoneky/main/ui-amin/ui-admin.user.js
// ==/UserScript==
```

Замените `your-username` и `tempermoneky` на ваши реальные значения!

