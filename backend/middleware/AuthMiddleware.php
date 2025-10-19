<?php
/**
 * Middleware для проверки JWT аутентификации
 * 
 * Проверяет токен из headers или body.
 * 
 */

class AuthMiddleware {
    /**
     * Проверка аутентификации пользователя
     * Ищет токен в headers или body, валидирует, проверяет пользователя.
     */
    public static function authenticate() {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        error_log("Auth Debug: Authorization Header = $authHeader");
        if (!$authHeader || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            error_log("Auth Debug: No token provided");
            Response::error('No token provided', 401);
        }
        $token = $matches[1];
        
        
        // Альтернативный способ - токен в теле запроса для POST
        if (!$token && $_SERVER['REQUEST_METHOD'] === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $token = $input['token'] ?? null;
        }
        
        if (!$token) {
            if (DatabaseConfig::LOG_ENABLED) {
                Logger::warning("Authentication failed: No token provided");
            }
            Response::error('Authentication token required', 401);
        }
        
        // Валидация токена
        $payload = JWT::validate($token);
        if (!$payload || !isset($payload['user_id']) || !isset($payload['username']) || !isset($payload['role'])) {
            if (DatabaseConfig::LOG_ENABLED) {
                Logger::warning("Authentication failed: Invalid token");
            }
            Response::error('Invalid or expired token', 401);
        }
        
        // Проверяем существование пользователя
        $userModel = new User();
        $user = $userModel->findById($payload['user_id']);
        
        if (!$user) {
            if (DatabaseConfig::LOG_ENABLED) {
                Logger::warning("Authentication failed: User not found", ['user_id' => $payload['user_id']]);
            }
            Response::error('User not found', 401);
        }
        
        if (DatabaseConfig::LOG_ENABLED) {
            Logger::debug("User authenticated", [
                'user_id' => $user['id'],
                'username' => $user['username']
            ]);
        }
        
        return $user;
    }
    
    /**
     * Проверка роли администратора
     * Вызывает authenticate и проверяет role.
     */
    public static function requireAdmin() {
        $user = self::authenticate();
        
        if ($user['role'] !== 'admin') {
            if (DatabaseConfig::LOG_ENABLED) {
                Logger::warning("Admin access denied", [
                    'user_id' => $user['id'],
                    'role' => $user['role']
                ]);
            }
            Response::error('Admin access required', 403);
        }
        
        return $user;
    }
}
?>