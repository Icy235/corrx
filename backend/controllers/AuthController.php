<?php
/**
 * Контроллер для аутентификации и управления сессиями
 * 
 * Обрабатывает логин, верификацию токена, логаут.
 * 
 */

class AuthController {
    private $userModel;
    
    public function __construct() {
        // Инициализация модели пользователя.
        $this->userModel = new User();
    }
    
    /**
     * Вход пользователя в систему
     * С rate limiting (max 5 attempts per 5 min).
     */
    public function login() {
        Response::checkMethod('POST');
        
        // Rate limiting
        session_start();
        $attemptKey = 'login_attempts_' . $_SERVER['REMOTE_ADDR'];
        $attempts = $_SESSION[$attemptKey] ?? 0;
        if ($attempts >= 5) {
            Response::error('Too many login attempts. Try again later.', 429); // Rate limit
        }
        
        // Получаем данные из запроса
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || json_last_error() !== JSON_ERROR_NONE) {
            Response::error('Invalid JSON data', 400);
        }
        
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';
        
        if (DatabaseConfig::LOG_ENABLED) {
            Logger::info("Login attempt", ['username' => $username]);
        }
        
        // Валидация входных данных
        if (empty($username) || empty($password) || strlen($username) < 3 || strlen($password) < 8) {
            $_SESSION[$attemptKey] = $attempts + 1;
            Response::error('Invalid username or password length', 400);
        }
        
        // Поиск пользователя
        $user = $this->userModel->findByUsername($username);
        
        if (!$user) {
            $_SESSION[$attemptKey] = $attempts + 1;
            if (DatabaseConfig::LOG_ENABLED) {
                Logger::warning("Login failed: User not found", ['username' => $username]);
            }
            Response::error('Invalid username or password', 401);
        }
        
        // Проверка пароля
        if (!$this->userModel->verifyPassword($password, $user['password'])) {
            $_SESSION[$attemptKey] = $attempts + 1;
            if (DatabaseConfig::LOG_ENABLED) {
                Logger::warning("Login failed: Invalid password", ['username' => $username]);
            }
            Response::error('Invalid username or password', 401);
        }
        
        // Проверка активности аккаунта
        if (!$user['is_active']) {
            if (DatabaseConfig::LOG_ENABLED) {
                Logger::warning("Login failed: Account inactive", ['username' => $username]);
            }
            Response::error('Account is inactive', 401);
        }
        
        // Обновление времени последнего входа
        $this->userModel->updateLastLogin($user['id']);
        
        // Получение настроек пользователя
        $settings = $this->userModel->getSettings($user['id']) ?? [];
        
        // Генерация JWT токена
        $tokenPayload = [
            'user_id' => $user['id'],
            'username' => $user['username'],
            'role' => $user['role'],
            'exp' => time() + DatabaseConfig::JWT_EXPIRE
        ];
        
        $token = JWT::generate($tokenPayload);
        
        // Подготовка данных пользователя для ответа
        $userData = [
            'id' => $user['id'],
            'username' => $user['username'],
            'full_name' => $user['full_name'] ?? '',
            'email' => $user['email'] ?? '',
            'phone' => $user['phone'] ?? '',
            'role' => $user['role'],
            'last_login' => $user['last_login']
        ];
        
        $responseData = [
            'token' => $token,
            'user' => $userData,
            'settings' => $settings
        ];
        
        if (DatabaseConfig::LOG_ENABLED) {
            Logger::info("Login successful", [
                'user_id' => $user['id'],
                'username' => $user['username'],
                'role' => $user['role']
            ]);
            
            Logger::userAction($user['id'], 'login', 'User logged in successfully');
        }
        
        // Reset attempts on success
        unset($_SESSION[$attemptKey]);
        
        Response::success($responseData, 'Login successful');
    }
    
    /**
     * Проверка валидности токена
     * С дополнительной проверкой payload.
     */
    public function verifyToken() {
        Response::checkMethod('POST');
        
        $input = json_decode(file_get_contents('php://input'), true);
        $token = $input['token'] ?? null;
        
        if (!$token) {
            Response::error('Token is required', 400);
        }
        
        $payload = JWT::validate($token);
        
        if (!$payload || !isset($payload['user_id']) || !isset($payload['username']) || !isset($payload['role'])) {
            Response::error('Invalid or expired token', 401);
        }
        
        // Получаем актуальные данные пользователя
        $user = $this->userModel->findById($payload['user_id']);
        
        if (!$user) {
            Response::error('User not found', 401);
        }
        
        $settings = $this->userModel->getSettings($user['id']) ?? [];
        
        $responseData = [
            'user' => $user,
            'settings' => $settings
        ];
        
        if (DatabaseConfig::LOG_ENABLED) {
            Logger::debug("Token verified", ['user_id' => $user['id']]);
        }
        
        Response::success($responseData, 'Token is valid');
    }
    
    /**
     * Выход пользователя (на клиенте просто удаляем токен)
     * Логируем действие.
     */
    public function logout() {
        Response::checkMethod('POST');
        
        $user = AuthMiddleware::authenticate();
        
        if (DatabaseConfig::LOG_ENABLED) {
            Logger::userAction($user['id'], 'logout', 'User logged out');
        }
        
        Response::success(null, 'Logout successful');
    }
}
?>