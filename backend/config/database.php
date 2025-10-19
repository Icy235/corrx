<?php
/**
 * Конфигурация базы данных Corrx System
 * 
 * Содержит настройки для подключения к БД, JWT и CORS.
 * Использует переменные окружения из .env файла.
 * 
 */

// Загружаем переменные окружения из .env файла
class EnvLoader {
    private static $loaded = false;
    
    public static function load($path = null) {
        if (self::$loaded) return;
        
        $path = $path ?? __DIR__ . '/../../.env';
        
        if (file_exists($path)) {
            $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                if (strpos(trim($line), '#') === 0) continue;
                
                list($name, $value) = self::parseLine($line);
                if ($name !== null) {
                    $_ENV[$name] = $value;
                    $_SERVER[$name] = $value;
                    putenv("$name=$value");
                }
            }
        } else {
            // Для обратной совместимости - можно убрать в будущем
            error_log(".env file not found at: $path");
        }
        
        self::$loaded = true;
    }
    
    private static function parseLine($line) {
        $line = trim($line);
        if (empty($line)) return [null, null];
        
        $parts = explode('=', $line, 2);
        if (count($parts) !== 2) return [null, null];
        
        $name = trim($parts[0]);
        $value = trim($parts[1]);
        
        // Удаляем кавычки если есть
        if (preg_match('/^"(.+)"$/', $value, $matches)) {
            $value = $matches[1];
        } elseif (preg_match('/^\'(.+)\'$/', $value, $matches)) {
            $value = $matches[1];
        }
        
        return [$name, $value];
    }
}

// Загружаем .env файл
EnvLoader::load();

class DatabaseConfig {
    // Настройки базы данных из .env
    const DB_HOST = self::getEnv('DB_HOST', '127.0.0.1');
    const DB_NAME = self::getEnv('DB_NAME', 'corrx_corrx');
    const DB_USER = self::getEnv('DB_USER', 'root');
    const DB_PASS = self::getEnv('DB_PASS', '');
    const DB_CHARSET = 'utf8mb4';
    
    // JWT настройки из .env
    const JWT_SECRET = self::getEnv('JWT_SECRET', 'default-secret-key-change-in-production');
    const JWT_ALGORITHM = 'HS256';
    const JWT_EXPIRE = 86400; // 24 часа
    
    // Настройки CORS
    const ALLOWED_ORIGINS = self::getAllowedOrigins();
    
    // Настройки системы
    const DEMO_MODE = self::getEnv('DEMO_MODE', 'false') === 'true';
    const LOG_ENABLED = self::getEnv('LOG_ENABLED', 'true') === 'true';
    const APP_ENV = self::getEnv('APP_ENV', 'production');
    
    /**
     * Получение значения переменной окружения
     */
    private static function getEnv($key, $default = null) {
        // Пробуем разные источники в порядке приоритета
        $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
        return $value !== false ? $value : $default;
    }
    
    /**
     * Получение разрешенных доменов для CORS
     */
    private static function getAllowedOrigins() {
        $origins = self::getEnv('ALLOWED_ORIGINS');
        if ($origins) {
            return array_map('trim', explode(',', $origins));
        }
        
        // Значения по умолчанию
        return [
            'https://corrx.morylis.ru',
            'http://localhost:3000', 
            'http://corrx.morylis.ru',
            'http://localhost:8080'
        ];
    }
    
    /**
     * Проверка конфигурации (для отладки)
     */
    public static function validateConfig() {
        $errors = [];
        
        if (empty(self::DB_NAME)) {
            $errors[] = 'DB_NAME is not set';
        }
        
        if (empty(self::JWT_SECRET) || self::JWT_SECRET === 'default-secret-key-change-in-production') {
            $errors[] = 'JWT_SECRET is not set or using default value';
        }
        
        if (self::APP_ENV === 'production' && in_array('http://localhost', self::ALLOWED_ORIGINS)) {
            $errors[] = 'Localhost origins should be removed in production';
        }
        
        return $errors;
    }
}

// Автозагрузка классов
spl_autoload_register(function ($class_name) {
    $directories = [
        __DIR__ . '/../controllers/',
        __DIR__ . '/../models/',
        __DIR__ . '/../middleware/',
        __DIR__ . '/../utils/'
    ];
    
    foreach ($directories as $directory) {
        $file = $directory . $class_name . '.php';
        if (file_exists($file)) {
            require_once $file;
            return;
        }
    }
    
    // Логируем ошибку, если класс не найден
    if (DatabaseConfig::LOG_ENABLED) {
        error_log("Class not found: $class_name in directories: " . implode(', ', $directories));
    }
});

// Валидация конфигурации при запуске
if (DatabaseConfig::LOG_ENABLED && DatabaseConfig::APP_ENV !== 'production') {
    $configErrors = DatabaseConfig::validateConfig();
    if (!empty($configErrors)) {
        error_log("Configuration warnings: " . implode(', ', $configErrors));
    }
}
?>