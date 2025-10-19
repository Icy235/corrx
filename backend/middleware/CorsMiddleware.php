<?php
class CorsMiddleware {
    public static function handle() {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowedOrigins = DatabaseConfig::ALLOWED_ORIGINS;
        error_log("CORS Debug: Received Origin = " . ($origin === '' ? 'empty' : $origin));
        error_log("CORS Debug: Allowed Origins = " . implode(', ', $allowedOrigins));
        
        if ($origin === '' || in_array($origin, $allowedOrigins, true)) {
            header("Access-Control-Allow-Origin: " . ($origin === '' ? '*' : $origin));
            error_log("CORS Debug: Origin allowed");
        } else {
            error_log("CORS Debug: Origin rejected");
            Response::error('Origin not allowed', 403);
        }
        
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
        header("Access-Control-Allow-Credentials: true");
        header("Access-Control-Max-Age: 86400");
        header("Vary: Origin");
        
        if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
            http_response_code(204);
            exit();
        }
    }
}
?>