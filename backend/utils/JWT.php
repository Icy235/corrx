<?php
/**
 * JWT (JSON Web Token) утилита для аутентификации
 * 
 * Генерация и валидация токенов.
 * 
 */

class JWT {
    /**
     * Генерация JWT токена
     * Кодирует header и payload, подписывает.
     */
    public static function generate($payload) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode($payload);
        
        $base64Header = self::base64UrlEncode($header);
        $base64Payload = self::base64UrlEncode($payload);
        
        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, DatabaseConfig::JWT_SECRET, true);
        $base64Signature = self::base64UrlEncode($signature);
        
        return $base64Header . "." . $base64Payload . "." . $base64Signature;
    }
    
    /**
     * Валидация JWT токена
     * Проверяет структуру, подпись, exp, обязательные поля.
     */
    public static function validate($token) {
        // Разделяем токен на части
        $tokenParts = explode('.', $token);
        
        if (count($tokenParts) != 3) {
            return false;
        }
        
        list($base64Header, $base64Payload, $base64Signature) = $tokenParts;
        
        // Проверяем подпись
        $signature = self::base64UrlDecode($base64Signature);
        $expectedSignature = hash_hmac('sha256', $base64Header . "." . $base64Payload, DatabaseConfig::JWT_SECRET, true);
        
        if (!hash_equals($signature, $expectedSignature)) {
            return false;
        }
        
        // Декодируем payload
        $payload = json_decode(self::base64UrlDecode($base64Payload), true);
        
        // Проверяем обязательные поля
        if (!isset($payload['user_id']) || !is_int($payload['user_id']) ||
            !isset($payload['username']) || !is_string($payload['username']) ||
            !isset($payload['role']) || !is_string($payload['role'])) {
            return false;
        }
        
        // Проверяем expiration time
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return false;
        }
        
        return $payload;
    }
    
    /**
     * Base64 URL encode
     * Безопасная кодировка для URL.
     */
    private static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    /**
     * Base64 URL decode
     * Декодировка с padding.
     */
    private static function base64UrlDecode($data) {
        return base64_decode(str_pad(strtr($data, '-_', '+/'), strlen($data) % 4, '=', STR_PAD_RIGHT));
    }
}
?>