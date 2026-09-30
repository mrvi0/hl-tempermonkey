<?php
/**
 * API endpoint для URL Collector
 * Принимает данные от Tampermonkey скрипта и сохраняет их в MySQL
 * 
 * Настройка:
 * 1. Загрузите этот файл на ваш веб-хостинг
 * 2. Убедитесь, что PHP имеет доступ к MySQL
 * 3. Настройте подключение к БД в начале файла (или используйте переменные окружения)
 */

// Устанавливаем заголовки для CORS и JSON (ВАЖНО: до любого вывода!)
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS, GET');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 3600');
header('Access-Control-Allow-Credentials: false');

// Включаем вывод ошибок для отладки (отключите на продакшене!)
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Логируем начало запроса
error_log("URL Collector API: Request received - Method: " . $_SERVER['REQUEST_METHOD'] . ", URI: " . $_SERVER['REQUEST_URI']);

// Обработка preflight запросов (CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    error_log("URL Collector API: OPTIONS preflight request");
    http_response_code(200);
    exit;
}

// Разрешаем GET для тестирования, POST для работы
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Простой тест доступности API
    echo json_encode([
        'success' => true,
        'message' => 'URL Collector API is working!',
        'method' => 'GET',
        'timestamp' => date('Y-m-d H:i:s'),
        'server' => $_SERVER['SERVER_NAME'] ?? 'unknown',
        'php_version' => phpversion()
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Разрешаем только POST запросы для реальной работы
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed. Use POST for data or GET for testing.']);
    exit;
}

// ===== КОНФИГУРАЦИЯ БД =====
// ВАЖНО: Эти данные будут переопределены данными из запроса
// Но для безопасности можно использовать переменные окружения или отдельный config файл
$DB_CONFIG = [
    'host' => getenv('DB_HOST') ?: 'localhost',
    'dbname' => getenv('DB_NAME') ?: '',
    'username' => getenv('DB_USER') ?: '',
    'password' => getenv('DB_PASS') ?: '',
    'charset' => 'utf8mb4'
];

// ===== ФУНКЦИИ =====

/**
 * Подключение к базе данных
 */
function getDbConnection($config) {
    try {
        $dsn = "mysql:host={$config['host']};dbname={$config['dbname']};charset={$config['charset']}";
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        
        error_log("URL Collector API: Connecting to MySQL - host: {$config['host']}, dbname: {$config['dbname']}, user: {$config['username']}");
        
        $pdo = new PDO($dsn, $config['username'], $config['password'], $options);
        
        error_log("URL Collector API: PDO connection established");
        return $pdo;
    } catch (PDOException $e) {
        $errorMsg = "Database connection error: " . $e->getMessage() . " (Code: " . $e->getCode() . ")";
        error_log($errorMsg);
        error_log("URL Collector API: Connection failed - DSN: " . $dsn);
        return null;
    }
}

/**
 * Вставка записей в БД с проверкой дубликатов
 */
function insertEntries($pdo, $entries) {
    if (empty($entries)) {
        return ['added' => 0, 'skipped' => 0, 'errors' => []];
    }
    
    $added = 0;
    $skipped = 0;
    $errors = [];
    
    // Используем INSERT IGNORE для предотвращения дубликатов
    // или ON DUPLICATE KEY UPDATE для обновления существующих
    $sql = "INSERT INTO `url_collector` (`id`, `url`, `type`) 
            VALUES (:id, :url, :type)
            ON DUPLICATE KEY UPDATE 
                `url` = VALUES(`url`),
                `updated_at` = CURRENT_TIMESTAMP";
    
    $stmt = $pdo->prepare($sql);
    
    foreach ($entries as $entry) {
        // Валидация данных
        if (empty($entry['id']) || empty($entry['url']) || empty($entry['type'])) {
            $errors[] = "Invalid entry: missing required fields";
            continue;
        }
        
        // Валидация типа
        if (!in_array($entry['type'], ['travelline', 'ostrovok'])) {
            $errors[] = "Invalid type: {$entry['type']}";
            continue;
        }
        
        // Ограничение длины ID (191 для utf8mb4 в MySQL)
        if (strlen($entry['id']) > 191) {
            $errors[] = "ID too long (max 191 chars): " . substr($entry['id'], 0, 50) . "...";
            continue;
        }
        
        // Проверяем, существует ли запись (для статистики)
        $checkStmt = $pdo->prepare("SELECT `id` FROM `url_collector` WHERE `id` = :id");
        $checkStmt->execute(['id' => $entry['id']]);
        $exists = $checkStmt->fetch();
        
        try {
            $stmt->execute([
                'id' => $entry['id'],
                'url' => $entry['url'],
                'type' => $entry['type']
            ]);
            
            if ($exists) {
                $skipped++;
            } else {
                $added++;
            }
        } catch (PDOException $e) {
            // Проверяем, это дубликат или другая ошибка
            if ($e->getCode() == 23000) { // Integrity constraint violation
                $skipped++;
            } else {
                error_log("Insert error for entry {$entry['id']}: " . $e->getMessage());
                $errors[] = "Error inserting {$entry['id']}: " . $e->getMessage();
            }
        }
    }
    
    return [
        'added' => $added,
        'skipped' => $skipped,
        'errors' => $errors
    ];
}

// ===== ОСНОВНАЯ ЛОГИКА =====

try {
    // Получаем данные из запроса
    $input = file_get_contents('php://input');
    error_log("URL Collector API: Received request, input length: " . strlen($input));
    
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("URL Collector API: JSON decode error: " . json_last_error_msg());
        throw new Exception('Invalid JSON: ' . json_last_error_msg());
    }
    
    error_log("URL Collector API: JSON decoded successfully");
    
    // Проверяем наличие данных подключения к БД
    if (empty($data['db_config'])) {
        error_log("URL Collector API: Missing db_config");
        throw new Exception('Database configuration is required');
    }
    
    $dbConfig = $data['db_config'];
    error_log("URL Collector API: DB config received: host=" . $dbConfig['host'] . ", dbname=" . $dbConfig['dbname'] . ", username=" . $dbConfig['username']);
    
    // Валидация конфигурации БД
    $requiredFields = ['host', 'dbname', 'username', 'password'];
    foreach ($requiredFields as $field) {
        if (empty($dbConfig[$field])) {
            error_log("URL Collector API: Missing field: {$field}");
            throw new Exception("Missing required database field: {$field}");
        }
    }
    
    // Объединяем конфигурацию БД
    $finalConfig = array_merge($DB_CONFIG, $dbConfig);
    
    // Подключаемся к БД
    error_log("URL Collector API: Attempting database connection...");
    $pdo = getDbConnection($finalConfig);
    if (!$pdo) {
        error_log("URL Collector API: Database connection failed");
        throw new Exception('Failed to connect to database');
    }
    error_log("URL Collector API: Database connected successfully");
    
    // Проверяем наличие записей для вставки
    if (empty($data['entries']) || !is_array($data['entries'])) {
        error_log("URL Collector API: No entries or invalid format");
        throw new Exception('No entries provided or invalid format');
    }
    
    error_log("URL Collector API: Processing " . count($data['entries']) . " entries");
    
    // Вставляем записи
    $result = insertEntries($pdo, $data['entries']);
    
    error_log("URL Collector API: Insert result - added: " . $result['added'] . ", skipped: " . $result['skipped'] . ", errors: " . count($result['errors']));
    
    // Возвращаем результат
    $response = [
        'success' => true,
        'added' => $result['added'],
        'skipped' => $result['skipped'],
        'total' => count($data['entries']),
        'errors' => $result['errors']
    ];
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    
} catch (Exception $e) {
    http_response_code(400);
    $errorResponse = [
        'success' => false,
        'error' => $e->getMessage()
    ];
    
    error_log("URL Collector API Error: " . $e->getMessage());
    error_log("URL Collector API Error trace: " . $e->getTraceAsString());
    
    echo json_encode($errorResponse, JSON_UNESCAPED_UNICODE);
}

