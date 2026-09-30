# 🔧 Техническая документация

## 📋 Спецификация

| Параметр | Значение |
|----------|----------|
| **Версия** | 2.0.0 |
| **Тип** | Tampermonkey Userscript |
| **Размер** | ~100KB |
| **Язык** | JavaScript ES6+ |
| **Зависимости** | Tampermonkey 4.0+ |
| **Браузеры** | Chrome 80+, Firefox 75+, Edge 80+, Safari 13+ |
| **Платформа** | HotelLab (https://app.hotellab.io) |

## 🏗️ Архитектура

### Основные компоненты

```
JSON Editor Global Search
├── 🎨 UI Layer
│   ├── Modal Window
│   ├── Search Controls
│   ├── Diff Preview
│   └── Pagination
├── 🔍 Search Engine
│   ├── Text Search
│   ├── Regex Search
│   └── Block Search
├── 🔄 Replace Engine
│   ├── Global Replace
│   ├── Single Config Replace
│   └── Preview Generation
└── 🐛 Debug System
    ├── Logging Levels
    ├── Debug Toggle
    └── Console Output
```

### Глобальные переменные

```javascript
// Состояние поиска
let currentResults = [];      // Результаты поиска
let currentPage = 0;          // Текущая страница
let searchTerm = '';          // Термин поиска
let replaceTerm = '';         // Термин замены

// Состояние diff режима
let isDiffMode = false;       // Режим предварительного просмотра
let diffResults = [];         // Результаты для diff
let diffPage = 0;             // Текущая страница diff

// Debug режим
let debugMode = false;        // Включен ли debug
```

## 🔍 Алгоритмы поиска

### 1. Обычный поиск

```javascript
function performTextSearch(text, searchTerm, caseSensitive) {
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(escapeRegExp(searchTerm), flags);
    return text.match(regex);
}
```

**Особенности**:
- Экранирование специальных символов
- Поддержка регистра
- Глобальный поиск

### 2. Регулярные выражения

```javascript
function performRegexSearch(text, pattern, caseSensitive) {
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);
    return text.match(regex);
}
```

**Особенности**:
- Полная поддержка regex синтаксиса
- Обработка ошибок
- Валидация паттернов

### 3. Блочный поиск

```javascript
function performBlockSearch(text, searchTerm, caseSensitive) {
    const normalizedText = normalizeTextForBlockSearch(text);
    const normalizedSearch = normalizeTextForBlockSearch(searchTerm);
    const searchText = caseSensitive ? normalizedSearch : normalizedSearch.toLowerCase();
    const regex = new RegExp(escapeRegExp(searchText), caseSensitive ? 'g' : 'gi');
    return normalizedText.match(regex);
}
```

**Особенности**:
- Нормализация пробелов и переносов
- Игнорирование форматирования
- Сохранение структуры JSON

## 🔄 Алгоритмы замены

### 1. Глобальная замена

```javascript
function executeGlobalReplace() {
    diffResults.forEach(result => {
        const currentText = result.textarea.value;
        const newText = performReplacement(currentText, searchTerm, replaceTerm);
        updateTextarea(result, newText);
    });
}
```

**Особенности**:
- Обработка всех конфигов
- Обновление JSON редакторов
- Подсчет изменений

### 2. Замена в конкретном конфиге

```javascript
function replaceInCurrentConfig() {
    const currentResult = diffResults[diffPage];
    const currentText = currentResult.textarea.value;
    const newText = performReplacement(currentText, searchTerm, replaceTerm);
    updateTextarea(currentResult, newText);
}
```

**Особенности**:
- Работа с одним конфигом
- Обновление diff preview
- Синхронизация состояния

## 🎨 UI Компоненты

### Модальное окно

```css
.hl-json-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

**Особенности**:
- Полноэкранный режим
- Flexbox layout
- Высокий z-index

### Diff Preview

```css
.hl-json-diff-container {
    border: 1px solid #ddd;
    border-radius: 5px;
    max-height: 400px;
    display: flex;
    flex-direction: column;
}
```

**Особенности**:
- Двухпанельный интерфейс
- Цветовая подсветка изменений
- Скроллируемое содержимое

### Пагинация

```css
.hl-json-pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 20px 0 0 0;
    gap: 10px;
    flex-shrink: 0;
}
```

**Особенности**:
- Фиксированное положение
- Центрированное выравнивание
- Адаптивные кнопки

## 🐛 Система логирования

### Уровни логирования

```javascript
function log(level, message, ...args) {
    // Фильтрация по debug режиму
    if (!debugMode && (level === 'DEBUG' || level === 'INFO')) {
        return;
    }
    
    // Цветовое кодирование
    const colors = {
        'SUCCESS': '#28a745',
        'ERROR': '#dc3545',
        'INFO': '#007cba',
        'DEBUG': '#007cba'
    };
    
    // Форматированный вывод
    console.log(/* ... */);
}
```

**Уровни**:
- 🟢 **SUCCESS** - успешные операции
- 🔴 **ERROR** - ошибки выполнения
- 🔵 **INFO** - важная информация
- 🟡 **DEBUG** - техническая информация

### Debug режим

```javascript
function createDebugToggle() {
    const debugToggle = document.createElement('div');
    debugToggle.className = 'hl-json-debug-toggle';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = debugMode;
    
    checkbox.addEventListener('change', (e) => {
        debugMode = e.target.checked;
        log('INFO', `Debug режим ${debugMode ? 'включен' : 'выключен'}`);
    });
}
```

**Особенности**:
- Переключатель в UI
- Сохранение состояния
- Условное логирование

## 🔧 Производительность

### Оптимизации

1. **Ленивая загрузка**
   - Скрипт загружается только на нужных страницах
   - UI создается по требованию

2. **Эффективный поиск**
   - Использование регулярных выражений
   - Кэширование результатов
   - Батчевая обработка

3. **Оптимизированный DOM**
   - Минимальные перерисовки
   - Виртуализация для больших списков
   - Event delegation

### Ограничения

- **Максимальный размер JSON**: ~10MB
- **Максимальное количество конфигов**: ~1000
- **Таймаут поиска**: 30 секунд
- **Память**: ~50MB для больших конфигураций

## 🛡️ Безопасность

### Валидация входных данных

```javascript
function validateSearchInput(searchTerm, replaceTerm) {
    if (!searchTerm || searchTerm.length > 1000) {
        throw new Error('Invalid search term');
    }
    
    if (replaceTerm && replaceTerm.length > 1000) {
        throw new Error('Invalid replace term');
    }
}
```

### Санитизация

```javascript
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### Ограничения доступа

- Работает только на страницах HotelLab
- Не имеет доступа к внешним ресурсам
- Не сохраняет данные локально

## 🔄 Жизненный цикл

### Инициализация

1. **Проверка окружения**
2. **Загрузка стилей**
3. **Создание UI элементов**
4. **Регистрация событий**

### Выполнение

1. **Получение входных данных**
2. **Валидация параметров**
3. **Выполнение поиска/замены**
4. **Обновление UI**

### Завершение

1. **Очистка ресурсов**
2. **Сброс состояния**
3. **Уведомления пользователя**

## 📊 Мониторинг

### Метрики производительности

- Время выполнения поиска
- Количество найденных результатов
- Время выполнения замены
- Использование памяти

### Логирование ошибок

- Автоматическое логирование ошибок
- Стек вызовов
- Контекст выполнения
- Предложения по исправлению

---

**Примечание**: Данная документация предназначена для разработчиков и технических специалистов, работающих с кодом скрипта.
