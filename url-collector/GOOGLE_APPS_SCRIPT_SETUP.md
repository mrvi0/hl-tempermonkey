# Настройка Google Apps Script для записи в Google Sheets

## Проблема
Google Sheets API v4 требует OAuth2 для записи данных. API ключ работает только для чтения.

## Решение
Использовать Google Apps Script Web App, который будет принимать POST запросы и записывать данные в таблицу.

## Инструкция по настройке

### Шаг 1: Создать Google Apps Script проект

1. Откройте https://script.google.com/
2. Нажмите "New Project"
3. Вставьте следующий код:

```javascript
function doPost(e) {
  try {
    // Получаем данные из запроса
    const data = JSON.parse(e.postData.contents);
    const values = data.values || [];
    
    if (values.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No data provided'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ID вашей таблицы
    const SPREADSHEET_ID = '1H1mi5O6JmK9OmbTSWAydouJ2o8R_P0f8BiOEoidds7M';
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
    
    // Проверяем наличие заголовков
    const lastRow = sheet.getLastRow();
    if (lastRow === 0 || sheet.getRange(1, 1).getValue() !== 'ID') {
      // Добавляем заголовки если их нет
      sheet.getRange(1, 1, 1, 3).setValues([['ID', 'URL', 'Type']]);
    }
    
    // Получаем все существующие данные для проверки дублей
    // Используем getDataRange() для получения всех данных, включая пустые строки
    const dataRange = sheet.getDataRange();
    const allData = dataRange.getValues();
    const existingKeys = new Set();
    
    // Пропускаем заголовок и проверяем все строки
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      if (row[0] && row[1]) {
        // Создаем ключ: ID + URL (trim для удаления пробелов)
        const key = String(row[0]).trim() + '|' + String(row[1]).trim();
        existingKeys.add(key);
      }
    }
    
    // Фильтруем дубликаты из входящих данных
    const newValues = [];
    const seenInRequest = new Set(); // Для проверки дублей внутри одного запроса
    
    values.forEach(row => {
      if (row[0] && row[1]) {
        // Нормализуем данные (trim для удаления пробелов)
        const id = String(row[0]).trim();
        const url = String(row[1]).trim();
        const key = id + '|' + url;
        
        // Проверяем дубликаты: и в существующих данных, и в текущем запросе
        if (!existingKeys.has(key) && !seenInRequest.has(key)) {
          newValues.push([id, url, row[2] || '']);
          existingKeys.add(key); // Добавляем в существующие, чтобы избежать дублей в следующих запросах
          seenInRequest.add(key); // Добавляем в текущий запрос
        }
      }
    });
    
    if (newValues.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        added: 0,
        skipped: values.length,
        message: 'All entries were duplicates'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Добавляем только новые данные
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newValues.length, 3).setValues(newValues);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      added: newValues.length,
      skipped: values.length - newValues.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput('URL Collector Web App is running').setMimeType(ContentService.MimeType.TEXT);
}
```

### Шаг 2: Сохранить проект

1. Нажмите "Save" (Ctrl+S)
2. Дайте проекту имя, например "URL Collector Web App"

### Шаг 3: Развернуть как Web App

1. Нажмите "Deploy" → "New deployment"
2. Выберите тип: "Web app"
3. Настройки:
   - **Description**: "URL Collector API"
   - **Execute as**: "Me" (ваш аккаунт)
   - **Who has access**: "Anyone" (чтобы можно было отправлять запросы без авторизации)
4. Нажмите "Deploy"
5. **ВАЖНО**: Скопируйте **Web App URL** - это будет ваш endpoint

### Шаг 4: Обновить скрипт

Замените в скрипте `url_collector.user.js`:
- `GOOGLE_SHEETS_WEB_APP_URL` на URL из шага 3

## Безопасность

Если хотите добавить простую защиту, можно добавить проверку токена в Apps Script:

```javascript
const SECRET_TOKEN = 'your-secret-token-here';

function doPost(e) {
  const token = e.parameter.token;
  if (token !== SECRET_TOKEN) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Unauthorized'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  // ... остальной код
}
```

И передавать токен в запросах из скрипта.

