# Инструкция по отладке

## Проверка работы скрипта

### 1. Проверка в браузере (консоль)

1. Откройте консоль браузера (F12)
2. Перейдите на сайт с TravelLine или Ostrovok
3. Проверьте логи:
   - `[URL Collector] Saved: ...` - данные сохраняются локально
   - `[URL Collector] Syncing X entries to database...` - начинается синхронизация
   - `[URL Collector] ✅ Success! Synced X entries` - успешная синхронизация

### 2. Принудительная синхронизация

1. Откройте меню Tampermonkey
2. Выберите **🔄 Force Sync**
3. Проверьте консоль браузера на наличие ошибок

### 3. Проверка настроек

1. Откройте меню Tampermonkey
2. Выберите **⚙️ Settings (API & Database)**
3. Убедитесь, что все поля заполнены:
   - API URL должен быть полным (например: `https://yourdomain.com/api.php`)
   - Database Host (обычно `localhost`)
   - Database Name
   - Database Username
   - Database Password

### 4. Проверка логов PHP

Найдите файл логов PHP на вашем сервере (обычно в `/var/log/php/` или через панель хостинга) и проверьте записи:
- `URL Collector API: Received request...`
- `URL Collector API: Database connected successfully`
- `URL Collector API: Insert result - added: X, skipped: Y`

### 5. Типичные ошибки

#### Ошибка: "API URL not configured"
- **Решение**: Настройте API URL через меню Settings

#### Ошибка: "Database configuration incomplete"
- **Решение**: Заполните все поля в настройках (host, dbname, username, password)

#### Ошибка: "Failed to connect to database"
- **Решение**: 
  - Проверьте правильность данных подключения
  - Убедитесь, что MySQL сервер доступен
  - Проверьте права пользователя MySQL

#### Ошибка: "Network error during sync"
- **Решение**:
  - Проверьте, что API URL доступен (откройте в браузере)
  - Проверьте CORS настройки на сервере
  - Проверьте, что PHP скрипт загружен и работает

#### Ошибка: "No entries provided or invalid format"
- **Решение**: Проверьте, что данные собираются (логи `[URL Collector] Saved: ...`)

#### Ошибка: "Specified key was too long"
- **Решение**: Убедитесь, что таблица создана с `VARCHAR(191)` для поля `id`

### 6. Тестирование API напрямую

Вы можете протестировать API скрипт напрямую через curl или Postman:

```bash
curl -X POST https://yourdomain.com/api.php \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      {
        "id": "test_123",
        "url": "https://example.com",
        "type": "travelline"
      }
    ],
    "db_config": {
      "host": "localhost",
      "dbname": "your_database",
      "username": "your_user",
      "password": "your_password"
    }
  }'
```

Ожидаемый ответ:
```json
{
  "success": true,
  "added": 1,
  "skipped": 0,
  "total": 1,
  "errors": []
}
```

### 7. Проверка таблицы в БД

Выполните SQL запрос:
```sql
SELECT * FROM `url_collector` ORDER BY `created_at` DESC LIMIT 10;
```

Если записи есть, но не добавляются новые:
- Проверьте логи PHP на наличие ошибок
- Проверьте, что ID не превышает 191 символ
- Проверьте, что тип данных правильный (travelline или ostrovok)

### 8. Включение отладки в PHP

Если нужно больше информации, добавьте в начало `api.php`:

```php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
```

**Внимание**: Отключите отладку на продакшене!

