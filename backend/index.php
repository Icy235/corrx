<?php
/**
 * Главная точка входа API системы Corrx
 * 
 * Маршрутизация запросов, подключение файлов.
 * 
 */

 // В релизе отключаем отображение ошибок
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Подключаем конфигурацию
require_once __DIR__ . '/config/database.php';

// Проверяем наличие CorsMiddleware
if (!class_exists('CorsMiddleware')) {
    error_log("Fatal error: CorsMiddleware class not found");
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
    exit();
}

// Устанавливаем CORS заголовки
CorsMiddleware::handle();

// Content type
header("Content-Type: application/json; charset=utf-8");

// Обработка preflight запросов - уже в CorsMiddleware

try {
    // Базовый путь к файлам
    $basePath = __DIR__;
    
    // Подключаем необходимые файлы с правильными путями
    require_once $basePath . '/config/database.php';
    require_once $basePath . '/utils/Response.php';
    require_once $basePath . '/utils/Logger.php';
    require_once $basePath . '/utils/JWT.php';
    require_once $basePath . '/models/Database.php';
    require_once $basePath . '/models/User.php';
    require_once $basePath . '/models/Smeta.php';
    require_once $basePath . '/middleware/AuthMiddleware.php';
    require_once $basePath . '/controllers/AuthController.php';
    require_once $basePath . '/controllers/UserController.php';
    require_once $basePath . '/controllers/SmetaController.php';

    // Простая маршрутизация
    $requestUri = $_SERVER['REQUEST_URI'];
    $path = parse_url($requestUri, PHP_URL_PATH);
    
    // Убираем /backend из пути
    $path = str_replace('/backend', '', $path);
    $path = trim($path, '/');
    $pathSegments = explode('/', $path);
    
    $controllerName = $pathSegments[0] ?? '';
    $method = $pathSegments[1] ?? 'index';
    
    // Маршрутизация запросов
    switch ($controllerName) {
        case 'auth':
            $authController = new AuthController();
            switch ($method) {
                case 'login':
                    $authController->login();
                    break;
                case 'verify':
                    $authController->verifyToken();
                    break;
                case 'logout':
                    $authController->logout();
                    break;
                default:
                    Response::error('Auth endpoint not found: ' . $method, 404);
            }
            break;
            
        case 'user':
            $userController = new UserController();
            switch ($method) {
                case 'profile':
                    $userController->getProfile();
                    break;
                case 'settings':
                    $userController->getSettings();
                    break;
                case 'update-profile':
                    $userController->updateProfile();
                    break;
                case 'change-password':
                    $userController->changePassword();
                    break;
                case 'update-settings':
                    $userController->updateSettings();
                    break;
                default:
                    Response::error('User endpoint not found: ' . $method, 404);
            }
            break;
            
        case 'smeta':
            $smetaController = new SmetaController();
            switch ($method) {
                case 'create':
                    $smetaController->create();
                    break;
                case 'getUserSmetas':
                    $smetaController->getUserSmetas();
                    break;
                case 'getSmetaDetails':
                    $smetaController->getSmetaDetails();
                    break;
                case 'update':
                    $smetaController->update();
                    break;
                case 'delete':
                    $smetaController->delete();
                    break;
                case 'updateStatus':
                    $smetaController->updateStatus();
                    break;
                case 'search':
                    $smetaController->search();
                    break;
                default:
                    Response::error('Smeta endpoint not found: ' . $method, 404);
            }
            break;
            
        case '':
            // Health check
            Response::success([
                'version' => '1.0.0',
                'timestamp' => date('Y-m-d H:i:s'),
                'status' => 'running',
                'endpoints' => [
                    'POST /auth/login' => 'User authentication',
                    'POST /auth/verify' => 'Verify token',
                    'POST /auth/logout' => 'User logout',
                    'GET /user/profile' => 'Get user profile',
                    'GET /user/settings' => 'Get user settings',
                    'POST /user/update-profile' => 'Update user profile',
                    'POST /user/change-password' => 'Change password',
                    'POST /user/update-settings' => 'Update user settings',
                    'POST /smeta/create' => 'Create new smeta',
                    'GET /smeta/getUserSmetas' => 'Get user smetas',
                    'GET /smeta/getSmetaDetails' => 'Get smeta details',
                    'POST /smeta/update' => 'Update smeta',
                    'POST /smeta/delete' => 'Delete smeta',
                    'POST /smeta/updateStatus' => 'Update smeta status',
                    'GET /smeta/search' => 'Search smetas'
                ]
            ], 'Corrx API is running');
            break;
            
        default:
            Response::error('Endpoint not found: ' . $controllerName, 404);
    }
    
} catch (Exception $e) {
    if (DatabaseConfig::LOG_ENABLED) {
        error_log("API Error: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
    }
    Response::error('Server error: ' . $e->getMessage(), 500);
}
?>