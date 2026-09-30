# Инструкция по установке

## Шаг 1: Подготовка базы данных

1. Создайте базу данных MySQL на вашем хостинге
2. Выполните SQL скрипт `database.sql` для создания таблицы:

```sql
CREATE TABLE IF NOT EXISTS `url_collector` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `url` TEXT NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_type` (`type`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Шаг 2: Загрузка PHP скрипта

1. Загрузите файл `api.php` на ваш веб-хостинг
2. Убедитесь, что PHP имеет доступ к MySQL
3. Запишите URL скрипта (например: `https://yourdomain.com/api.php`)

**Важно**: Для безопасности рекомендуется:
- Использовать HTTPS
- Настроить переменные окружения для данных БД (опционально)
- Ограничить доступ к скрипту по IP (опционально)

## Шаг 3: Установка Tampermonkey скрипта

1. Откройте Tampermonkey
2. Создайте новый скрипт
3. Скопируйте содержимое `url_collector.user.js`
4. Сохраните скрипт

## Шаг 4: Настройка подключения

1. Откройте меню Tampermonkey (иконка расширения)
2. Выберите скрипт "URL Collector for TravelLine & Ostrovok"
3. Выберите **⚙️ Settings (API & Database)**
4. Введите данные:
   - **API URL**: URL вашего PHP скрипта
   - **Database Host**: обычно `localhost` или IP сервера
   - **Database Name**: имя вашей базы данных
   - **Database Username**: имя пользователя MySQL
   - **Database Password**: пароль MySQL

## Шаг 5: Проверка работы

1. Откройте любой сайт с TravelLine или Ostrovok
2. Откройте консоль браузера (F12)
3. Проверьте логи: `[URL Collector] Saved: ...`
4. Через минуту данные должны синхронизироваться с БД
5. Проверьте таблицу в БД - должны появиться записи

## Устранение проблем

### Скрипт не собирает данные
- Проверьте, что домен не в списке исключенных
- Откройте консоль браузера и проверьте ошибки
- Убедитесь, что скрипт активен в Tampermonkey

### Синхронизация не работает
- Проверьте настройки подключения (меню Settings)
- Проверьте, что API URL доступен
- Проверьте логи PHP скрипта на сервере
- Проверьте права доступа пользователя MySQL к базе данных

### Дубликаты в БД
- Проверьте, что таблица создана с PRIMARY KEY на поле `id`
- Проверьте логи PHP скрипта
- Убедитесь, что используется последняя версия скрипта

