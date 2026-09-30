-- SQL скрипт для создания таблицы URL Collector
-- Выполните этот скрипт в вашей MySQL базе данных

CREATE TABLE IF NOT EXISTS `url_collector` (
  `id` VARCHAR(191) NOT NULL PRIMARY KEY COMMENT 'Уникальный идентификатор (travelline_123, ostrovok_hotel_name)',
  `url` TEXT NOT NULL COMMENT 'URL страницы',
  `type` VARCHAR(50) NOT NULL COMMENT 'Тип (travelline, ostrovok)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Дата создания',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Дата обновления',
  INDEX `idx_type` (`type`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Таблица для хранения собранных URL с ID';

