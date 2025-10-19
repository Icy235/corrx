<?php
/**
 * Модель пользователя системы Corrx
 */

class User {
    private $db;
    
    public function __construct() {
        $this->db = Database::getInstance();
    }
    
    /**
     * Поиск пользователя по логину
     */
    public function findByUsername($username) {
        $sql = "SELECT * FROM users WHERE username = :username AND is_active = 1";
        return $this->db->fetch($sql, ['username' => $username]);
    }
    
    /**
     * Поиск пользователя по ID
     */
    public function findById($id) {
        $sql = "SELECT id, username, full_name, email, phone, role, created_at, last_login 
                FROM users WHERE id = :id AND is_active = 1";
        return $this->db->fetch($sql, ['id' => $id]);
    }
    
    /**
     * Обновление времени последнего входа
     */
    public function updateLastLogin($userId) {
        $sql = "UPDATE users SET last_login = NOW() WHERE id = :id";
        return $this->db->query($sql, ['id' => $userId]);
    }
    
    /**
     * Проверка пароля
     */
    public function verifyPassword($password, $hashedPassword) {
        return password_verify($password, $hashedPassword);
    }
    
    /**
     * Получение настроек пользователя
     */
    public function getSettings($userId) {
        $sql = "SELECT * FROM user_settings WHERE user_id = :user_id";
        $settings = $this->db->fetch($sql, ['user_id' => $userId]);
        
        // Настройки по умолчанию, если не найдены
        if (!$settings) {
            $settings = [
                'theme' => 'light',
                'auto_logout' => true,
                'caching_enabled' => true,
                'notifications_enabled' => true
            ];
        }
        
        return $settings;
    }
    
    /**
     * Обновление настроек пользователя
     */
    public function updateSettings($userId, $settings) {
        // Проверяем существование настроек
        $existing = $this->db->fetch(
            "SELECT id FROM user_settings WHERE user_id = :user_id", 
            ['user_id' => $userId]
        );
        
        if ($existing) {
            // Обновляем существующие настройки
            return $this->db->update('user_settings', $settings, 'user_id = :user_id', ['user_id' => $userId]);
        } else {
            // Создаем новые настройки
            $settings['user_id'] = $userId;
            return $this->db->insert('user_settings', $settings);
        }
    }
    
    /**
     * Обновление профиля пользователя
     */
    public function updateProfile($userId, $profileData) {
        $allowedFields = ['full_name', 'email', 'phone'];
        $dataToUpdate = [];
        
        foreach ($allowedFields as $field) {
            if (isset($profileData[$field])) {
                $dataToUpdate[$field] = $profileData[$field];
            }
        }
        
        if (!empty($dataToUpdate)) {
            return $this->db->update('users', $dataToUpdate, 'id = :id', ['id' => $userId]);
        }
        
        return false;
    }
    
    /**
     * Смена пароля пользователя
     */
    public function changePassword($userId, $currentPassword, $newPassword) {
        // Получаем текущий пароль
        $user = $this->db->fetch(
            "SELECT password FROM users WHERE id = :id", 
            ['id' => $userId]
        );
        
        if (!$user || !$this->verifyPassword($currentPassword, $user['password'])) {
            return false;
        }
        
        // Хешируем новый пароль
        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
        
        // Обновляем пароль
        return $this->db->update(
            'users', 
            ['password' => $hashedPassword], 
            'id = :id', 
            ['id' => $userId]
        );
    }
    
    /**
     * Создание нового пользователя (для админов)
     */
    public function createUser($userData) {
        // Валидация обязательных полей
        if (empty($userData['username']) || empty($userData['password'])) {
            return false;
        }
        
        // Хеширование пароля
        $userData['password'] = password_hash($userData['password'], PASSWORD_DEFAULT);
        
        // Установка значений по умолчанию
        $userData['is_active'] = 1;
        $userData['role'] = $userData['role'] ?? 'user';
        
        try {
            $userId = $this->db->insert('users', $userData);
            
            // Создаем настройки по умолчанию для нового пользователя
            if ($userId) {
                $this->db->insert('user_settings', ['user_id' => $userId]);
            }
            
            return $userId;
        } catch (PDOException $e) {
            Logger::error("User creation failed: " . $e->getMessage());
            return false;
        }
    }
}
?>