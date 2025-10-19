<?php
/**
 * Контроллер для управления пользователями и настройками
 * 
 * Обрабатывает профиль, настройки, создание пользователей (для админов).
 * 
 */

class UserController {
    private $userModel;
    
    public function __construct() {
        // Инициализация модели.
        $this->userModel = new User();
    }
    
    /**
     * Получение профиля текущего пользователя
     */
    public function getProfile() {
        Response::checkMethod('GET');
        
        $user = AuthMiddleware::authenticate();
        
        if (DatabaseConfig::LOG_ENABLED) {
            Logger::debug("Profile retrieved", ['user_id' => $user['id']]);
        }
        
        Response::success($user, 'Profile retrieved successfully');
    }
    
    /**
     * Обновление профиля пользователя
     * С валидацией полей.
     */
    public function updateProfile() {
        Response::checkMethod('POST');
        
        $user = AuthMiddleware::authenticate();
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || json_last_error() !== JSON_ERROR_NONE) {
            Response::error('Invalid JSON data', 400);
        }
        
        // Валидация email если предоставлен
        if (isset($input['email']) && !filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email format', 400);
        }
        
        // Валидация phone если предоставлен
        if (isset($input['phone']) && !preg_match('/^\+?[0-9]{10,15}$/', $input['phone'])) {
            Response::error('Invalid phone format', 400);
        }
        
        // Санитизация
        if (isset($input['full_name'])) {
            $input['full_name'] = htmlspecialchars($input['full_name'], ENT_QUOTES, 'UTF-8');
        }
        
        $result = $this->userModel->updateProfile($user['id'], $input);
        
        if ($result) {
            // Получаем обновленные данные
            $updatedUser = $this->userModel->findById($user['id']);
            
            Logger::userAction($user['id'], 'update_profile', 'Profile updated successfully');
            
            Response::success($updatedUser, 'Profile updated successfully');
        } else {
            Response::error('Failed to update profile', 500);
        }
    }
    
    /**
     * Смена пароля пользователя
     * С проверкой сложности (минимум 8 символов, 1 цифра, 1 буква).
     */
    public function changePassword() {
        Response::checkMethod('POST');
        
        $user = AuthMiddleware::authenticate();
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || json_last_error() !== JSON_ERROR_NONE) {
            Response::error('Invalid JSON data', 400);
        }
        
        $currentPassword = $input['current_password'] ?? '';
        $newPassword = $input['new_password'] ?? '';
        
        // Валидация паролей
        if (empty($currentPassword) || empty($newPassword)) {
            Response::error('Current password and new password are required', 400);
        }
        
        if (strlen($newPassword) < 8 || !preg_match('/[0-9]/', $newPassword) || !preg_match('/[a-zA-Z]/', $newPassword)) {
            Response::error('New password must be at least 8 characters long, contain at least one digit and one letter', 400);
        }
        
        $result = $this->userModel->changePassword($user['id'], $currentPassword, $newPassword);
        
        if ($result) {
            Logger::userAction($user['id'], 'change_password', 'Password changed successfully');
            
            Response::success(null, 'Password changed successfully');
        } else {
            Response::error('Current password is incorrect', 400);
        }
    }
    
    /**
     * Получение настроек пользователя
     */
    public function getSettings() {
        Response::checkMethod('GET');
        
        $user = AuthMiddleware::authenticate();
        $settings = $this->userModel->getSettings($user['id']) ?? [];
        
        Response::success($settings, 'Settings retrieved successfully');
    }
    
    /**
     * Обновление настроек пользователя
     * С валидацией значений настроек.
     */
    public function updateSettings() {
        Response::checkMethod('POST');
        
        $user = AuthMiddleware::authenticate();
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || json_last_error() !== JSON_ERROR_NONE) {
            Response::error('Invalid JSON data', 400);
        }
        
        // Разрешенные настройки
        $allowedSettings = [
            'theme' => 'string', // e.g., 'light', 'dark'
            'auto_logout' => 'boolean',
            'caching_enabled' => 'boolean',
            'notifications_enabled' => 'boolean'
        ];
        
        $settingsToUpdate = [];
        foreach ($allowedSettings as $setting => $type) {
            if (isset($input[$setting])) {
                if ($type === 'boolean' && !is_bool($input[$setting])) {
                    Response::error("Invalid type for $setting", 400);
                } elseif ($type === 'string' && !is_string($input[$setting])) {
                    Response::error("Invalid type for $setting", 400);
                }
                $settingsToUpdate[$setting] = $input[$setting];
            }
        }
        
        if (empty($settingsToUpdate)) {
            Response::error('No valid settings provided', 400);
        }
        
        $result = $this->userModel->updateSettings($user['id'], $settingsToUpdate);
        
        if ($result) {
            $updatedSettings = $this->userModel->getSettings($user['id']);
            
            Logger::userAction($user['id'], 'update_settings', 'User settings updated');
            
            Response::success($updatedSettings, 'Settings updated successfully');
        } else {
            Response::error('Failed to update settings', 500);
        }
    }
    
    /**
     * Создание нового пользователя (только для админов)
     * С проверкой уникальности username и сложности пароля.
     */
    public function createUser() {
        Response::checkMethod('POST');
        
        $admin = AuthMiddleware::requireAdmin();
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || json_last_error() !== JSON_ERROR_NONE) {
            Response::error('Invalid JSON data', 400);
        }
        
        // Обязательные поля
        $requiredFields = ['username', 'password'];
        foreach ($requiredFields as $field) {
            if (empty($input[$field])) {
                Response::error("Field '$field' is required", 400);
            }
        }
        
        // Валидация username
        if (strlen($input['username']) < 3) {
            Response::error('Username must be at least 3 characters long', 400);
        }
        
        // Валидация пароля
        if (strlen($input['password']) < 8 || !preg_match('/[0-9]/', $input['password']) || !preg_match('/[a-zA-Z]/', $input['password'])) {
            Response::error('Password must be at least 8 characters long, contain at least one digit and one letter', 400);
        }
        
        // Проверка уникальности username
        if ($this->userModel->findByUsername($input['username'])) {
            Response::error('Username already exists', 409);
        }
        
        $userId = $this->userModel->createUser($input);
        
        if ($userId) {
            Logger::userAction($admin['id'], 'create_user', "Created user: {$input['username']}");
            
            Response::success(['user_id' => $userId], 'User created successfully');
        } else {
            Response::error('Failed to create user', 500);
        }
    }
}
?>