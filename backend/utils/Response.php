<?php
/**
 * Утилита для стандартизированных HTTP ответов
 */

class Response {
    /**
     * Успешный ответ
     */
    public static function success($data = null, $message = 'Success', $code = 200) {
        self::send([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'timestamp' => time()
        ], $code);
    }
    
    /**
     * Ответ с ошибкой
     */
    public static function error($message = 'Error', $code = 400, $details = null) {
        self::send([
            'success' => false,
            'message' => $message,
            'error' => [
                'code' => $code,
                'details' => $details
            ],
            'timestamp' => time()
        ], $code);
    }
    
    /**
     * Отправка JSON ответа
     */
    private static function send($data, $code = 200) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        
        // CORS headers
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
    
    /**
     * Проверка метода запроса
     */
    public static function checkMethod($allowedMethods) {
        $method = $_SERVER['REQUEST_METHOD'];
        
        if (!in_array($method, (array)$allowedMethods)) {
            self::error('Method not allowed', 405);
        }
        
        // Обработка preflight CORS запросов
        if ($method === 'OPTIONS') {
            self::success(null, 'CORS preflight', 200);
        }
    }
}
?>