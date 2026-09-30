# URL Collector для TravelLine и Ostrovok

Tampermonkey скрипт для сбора URL с идентификаторами TravelLine и Ostrovok и сохранения их в MySQL базу данных.

## Установка

1. Установите скрипт `url_collector.user.js` в Tampermonkey
2. Загрузите `api.php` на ваш веб-хостинг
3. Выполните SQL скрипт `database.sql` в вашей MySQL базе данных
4. Настройте подключение через меню Tampermonkey: **Settings (API & Database)**

## Настройка

После установки скрипта:

1. Откройте меню Tampermonkey (иконка расширения)
2. Выберите скрипт "URL Collector for TravelLine & Ostrovok"
3. Выберите пункт меню **⚙️ Settings (API & Database)**
4. Введите:
   - **API URL**: URL вашего PHP скрипта (например: `https://yourdomain.com/api.php`)
   - **Database Host**: хост MySQL (обычно `localhost`)
   - **Database Name**: имя базы данных
   - **Database Username**: имя пользователя MySQL
   - **Database Password**: пароль MySQL

## Структура базы данных

Таблица `url_collector`:
- `id` (VARCHAR, PRIMARY KEY) - уникальный идентификатор
- `url` (TEXT) - URL страницы
- `type` (VARCHAR) - тип (travelline, ostrovok)
- `created_at` (TIMESTAMP) - дата создания
- `updated_at` (TIMESTAMP) - дата обновления

## Функции

- **Автоматический сбор**: Скрипт работает в фоне на всех сайтах
- **Проверка дубликатов**: Дубликаты предотвращаются на уровне базы данных (PRIMARY KEY)
- **Периодическая синхронизация**: Данные отправляются в БД раз в минуту
- **Меню управления**: Доступно через меню Tampermonkey:
  - ⚙️ Settings (API & Database) - настройки подключения
  - 🗑️ Clear Storage - очистка локального хранилища
  - 📊 Show Stats - статистика собранных данных
  - 🔄 Force Sync - принудительная синхронизация
  - 📤 Sync All from Storage - синхронизация всех данных из хранилища

## Безопасность

- Данные подключения к БД хранятся локально в Tampermonkey (GM_setValue/GM_getValue)
- Пароль БД не хранится в коде скрипта
- PHP скрипт проверяет данные перед вставкой в БД
- Дубликаты предотвращаются на уровне БД (PRIMARY KEY constraint)

## Исключенные домены

Скрипт не работает на следующих доменах:
- yandex.ru, yandex.com, ya.ru
- google.com, google.ru
- docs.google.com, sheets.google.com, script.google.com
- app.hotellab.io, admin.hotellab.ru, app.hotellab.ru

## Формат ID

- **TravelLine**: `travelline_12345` (где 12345 - код отеля)
- **Ostrovok**: `hotel_name` (название отеля из URL, без префикса)
