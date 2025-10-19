<?php
/**
 * Контроллер для управления сметами
 * 
 * Этот контроллер обрабатывает все операции со сметами: создание, чтение, обновление, удаление.
 * Все методы используют аутентификацию через AuthMiddleware.
 * 
 */

class SmetaController {
    private $smetaModel;
    
    public function __construct() {
        // Инициализация модели смет.
        $this->smetaModel = new Smeta();
    }
    
    /**
     * Создание новой сметы
     * Метод проверяет POST, аутентифицирует пользователя, валидирует JSON input.
     */
    public function create() {
        Response::checkMethod('POST');
        
        $user = AuthMiddleware::authenticate();
        $input = json_decode(file_get_contents('php://input'), true);
        
    // Валидация
        if (empty($input['customer']['company'])) {
            Response::error('Company is required', 400);
        }
        if (empty($input['production']['length']) || !is_numeric($input['production']['length']) || $input['production']['length'] <= 0) {
            Response::error('Building length is required and must be numeric', 400);
        }
        if (empty($input['production']['width']) || !is_numeric($input['production']['width']) || $input['production']['width'] <= 0) {
            Response::error('Building width is required and must be numeric', 400);
        }
        if (empty($input['production']['foundation'])) {
            Response::error('Foundation type is required', 400);
        }
        if (empty($input['production']['walls'])) {
            Response::error('Wall type is required', 400);
        }
        
        // Санитизация данных (для примера, модели должны обрабатывать).
        $input['customer']['company'] = htmlspecialchars($input['customer']['company'], ENT_QUOTES, 'UTF-8');
        
        $smetaId = $this->smetaModel->create($user['id'], $input);
        
        if ($smetaId) {
            Logger::userAction($user['id'], 'create_smeta', "Created smeta #$smetaId for {$input['customer']['company']}");
            
            Response::success(['smeta_id' => $smetaId], 'Smeta created successfully');
        } else {
            Response::error('Failed to create smeta', 500);
        }
    }
    


 
    /**
     * Получение списка смет пользователя
     * С пагинацией и форматированием для карточек.
     */
    public function getUserSmetas() {
        Response::checkMethod('GET');
        
        $user = AuthMiddleware::authenticate();
        
        // Параметры пагинации с валидацией
        $limit = min((int)($_GET['limit'] ?? 50), 100); // Максимум 100 записей
        $offset = max((int)($_GET['offset'] ?? 0), 0); // Не отрицательный
        
        $smetas = $this->smetaModel->getUserSmetas($user['id'], $limit, $offset);
        
        // Форматируем данные для отображения в карточках
        $formattedSmetas = array_map(function($smeta) {
            $customerData = json_decode($smeta['customer_data'], true) ?? [];
            $productionData = json_decode($smeta['production_data'], true) ?? [];
            
            return [
                'id' => $smeta['id'],
                'company' => $customerData['company'] ?? 'Не указано',
                'parameters' => $this->formatParameters($productionData),
                'price' => $this->calculatePrice($productionData),
                'status' => $smeta['status'] ?? 'draft', // Default status
                'created_at' => $smeta['created_at']
            ];
        }, $smetas);
        
        if (DatabaseConfig::LOG_ENABLED) {
            Logger::debug("Smetas retrieved", [
                'user_id' => $user['id'],
                'count' => count($formattedSmetas)
            ]);
        }
        
        Response::success($formattedSmetas, 'Smetas retrieved successfully');
    }
    
    /**
     * Получение деталей конкретной сметы
     * С валидацией ID и форматированием данных.
     */

    public function getSmetaDetails() {
        Response::checkMethod('GET');
        
        $user = AuthMiddleware::authenticate();
        
        // Получаем ID сметы из GET параметров
        $smetaId = $_GET['id'] ?? null;
        
        if (!$smetaId || !is_numeric($smetaId)) {
            Response::error('Smeta ID is required and must be numeric', 400);
        }
        
        // Получаем смету через модель
        $smeta = $this->smetaModel->findById((int)$smetaId, $user['id']);
        
        if (!$smeta) {
            Response::error('Smeta not found or access denied', 404);
        }
        
        // Форматируем данные для отображения
        $formattedSmeta = [
            'id' => $smeta['id'],
            'customer' => $smeta['customer_data'] ?? [],
            'production' => $smeta['production_data'] ?? [],
            'installation' => $smeta['installation_data'] ?? [],
            'additional_options' => $smeta['additional_options'] ?? [],
            'geolocation' => $smeta['geolocation_data'] ?? [],
            'status' => $smeta['status'],
            'created_at' => $smeta['created_at'],
            'updated_at' => $smeta['updated_at'],
            'calculated_prices' => $this->calculateDetailedPrices($smeta)
        ];
        
        if (DatabaseConfig::LOG_ENABLED) {
            Logger::debug("Smeta details retrieved", [
                'user_id' => $user['id'],
                'smeta_id' => $smetaId
            ]);
        }
        
        Response::success($formattedSmeta, 'Smeta details retrieved successfully');
    }
        
    /**
     * Обновление сметы
     * С валидацией ID и input.
     */
    public function update() {
        Response::checkMethod('POST');
        
        $user = AuthMiddleware::authenticate();
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || json_last_error() !== JSON_ERROR_NONE) {
            Response::error('Invalid JSON data', 400);
        }
        
        $smetaId = $input['id'] ?? null;
        
        if (!$smetaId || !is_numeric($smetaId)) {
            Response::error('Smeta ID is required and must be numeric', 400);
        }
        
        // Санитизация
        if (isset($input['customer']['company'])) {
            $input['customer']['company'] = htmlspecialchars($input['customer']['company'], ENT_QUOTES, 'UTF-8');
        }
        
        $result = $this->smetaModel->update((int)$smetaId, $user['id'], $input);
        
        if ($result) {
            Logger::userAction($user['id'], 'update_smeta', "Updated smeta #$smetaId");
            
            Response::success(null, 'Smeta updated successfully');
        } else {
            Response::error('Failed to update smeta', 500);
        }
    }
    
    /**
     * Удаление сметы
     * Поддержка POST и DELETE, валидация ID.
     */
    public function delete() {
        Response::checkMethod(['POST', 'DELETE']);
        
        $user = AuthMiddleware::authenticate();
        $input = json_decode(file_get_contents('php://input'), true);
        
        $smetaId = $input['id'] ?? $_GET['id'] ?? null;
        
        if (!$smetaId || !is_numeric($smetaId)) {
            Response::error('Smeta ID is required and must be numeric', 400);
        }
        
        $result = $this->smetaModel->delete((int)$smetaId, $user['id']);
        
        if ($result) {
            Logger::userAction($user['id'], 'delete_smeta', "Deleted smeta #$smetaId");
            
            Response::success(null, 'Smeta deleted successfully');
        } else {
            Response::error('Smeta not found or access denied', 404);
        }
    }
    
    /**
     * Обновление статуса сметы
     * Валидация статуса (допустимые значения).
     */
    public function updateStatus() {
        Response::checkMethod('POST');
        
        $user = AuthMiddleware::authenticate();
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || json_last_error() !== JSON_ERROR_NONE) {
            Response::error('Invalid JSON data', 400);
        }
        
        $smetaId = $input['id'] ?? null;
        $status = $input['status'] ?? null;
        
        if (!$smetaId || !is_numeric($smetaId) || !$status) {
            Response::error('Smeta ID and status are required', 400);
        }
        
        // Допустимые статусы
        $allowedStatuses = ['draft', 'pending', 'in-progress', 'completed', 'archived'];
        if (!in_array($status, $allowedStatuses)) {
            Response::error('Invalid status', 400);
        }
        
        $result = $this->smetaModel->updateStatus((int)$smetaId, $user['id'], $status);
        
        if ($result) {
            Logger::userAction($user['id'], 'update_smeta_status', "Updated smeta #$smetaId status to $status");
            
            Response::success(null, 'Smeta status updated successfully');
        } else {
            Response::error('Failed to update smeta status', 500);
        }
    }
    
    /**
     * Поиск смет по компании
     * С санитизацией searchTerm для предотвращения инъекций.
     */
    public function search() {
        Response::checkMethod('GET');
        
        $user = AuthMiddleware::authenticate();
        $searchTerm = $_GET['q'] ?? '';
        
        if (empty($searchTerm)) {
            Response::error('Search term is required', 400);
        }
        
        // Санитизация
        $searchTerm = htmlspecialchars($searchTerm, ENT_QUOTES, 'UTF-8');
        
        $smetas = $this->smetaModel->searchByCompany($user['id'], $searchTerm);
        
        Response::success($smetas, 'Search completed successfully');
    }
    
    /**
     * Форматирование параметров для карточки
     * Обработка нулевых значений.
     */
    private function formatParameters($productionData) {
        $length = $productionData['length'] ?? 0;
        $width = $productionData['width'] ?? 0;
        $area = $length * $width;
        
        if ($area == 0) {
            return 'Не указаны параметры';
        }
        
        return "{$length}×{$width}м ({$area} м²)";
    }
    
    /**
     * Расчет примерной стоимости
     * Базовая логика с множителями по фундаменту.
     */
    private function calculatePrice($productionData) {
        $length = intval($productionData['length'] ?? 0);
        $width = intval($productionData['width'] ?? 0);
        $area = $length * $width;
        
        if ($area === 0) return 0;
        
        // Базовая стоимость за м²
        $basePrice = 15000;
        
        // Множители в зависимости от типа фундамента
        $foundationMultipliers = [
            'slab' => 1.2,
            'piles' => 1.1,
            'strip' => 1.15,
            'none' => 1.0
        ];
        
        $foundation = $productionData['foundation'] ?? 'none';
        $multiplier = $foundationMultipliers[$foundation] ?? 1.0;
        
        return round($area * $basePrice * $multiplier);
    }
    
 
    /**
     * Расчет детализированных цен для просмотра сметы
     * С расчетом с/без НДС.
     */
    private function calculateDetailedPrices($smeta) {
        // Данные уже декодированы в модели, используем их напрямую
        $productionData = $smeta['production_data'] ?? [];
        $installationData = $smeta['installation_data'] ?? [];
        $additionalOptions = $smeta['additional_options'] ?? [];
        
        $length = intval($productionData['length'] ?? 0);
        $width = intval($productionData['width'] ?? 0);
        $area = $length * $width;
        
        if ($area === 0) {
            return [
                'total_with_vat' => 0,
                'total_without_vat' => 0,
                'price_per_m2' => 0
            ];
        }
        
        // Базовые расчеты
        $basePricePerM2 = 15000; // Базовая стоимость за м²
        $foundationMultipliers = [
            'slab' => 1.2,
            'piles' => 1.1,
            'strip' => 1.15,
            'none' => 1.0
        ];
        
        $foundation = $productionData['foundation'] ?? 'none';
        $multiplier = $foundationMultipliers[$foundation] ?? 1.0;
        
        $basePrice = round($area * $basePricePerM2 * $multiplier);
        $priceWithoutVAT = round($basePrice / 1.2); // Без НДС (20%)
        $pricePerM2 = round($basePrice / $area);
        
        return [
            'total_with_vat' => $basePrice,
            'total_without_vat' => $priceWithoutVAT,
            'price_per_m2' => $pricePerM2
        ];
    }
}
?>