<?php
/**
 * Модель для работы со сметами системы Corrx
 */

class Smeta {
    private $db;
    
    public function __construct() {
        $this->db = Database::getInstance();
    }
    
    /**
     * Создание новой сметы
     */
    public function create($userId, $smetaData) {
        $data = [
            'user_id' => $userId,
            'customer_data' => json_encode($smetaData['customer'] ?? [], JSON_UNESCAPED_UNICODE),
            'production_data' => json_encode($smetaData['production'] ?? [], JSON_UNESCAPED_UNICODE),
            'installation_data' => json_encode($smetaData['installation'] ?? [], JSON_UNESCAPED_UNICODE),
            'additional_options' => json_encode($smetaData['additionalOptions'] ?? [], JSON_UNESCAPED_UNICODE),
            'geolocation_data' => json_encode($smetaData['geolocation'] ?? [], JSON_UNESCAPED_UNICODE),
            'status' => 'draft',
            'created_at' => date('Y-m-d H:i:s')
        ];
        
        try {
            $smetaId = $this->db->insert('smeta', $data);
            
            Logger::info("Smeta created", [
                'user_id' => $userId,
                'smeta_id' => $smetaId,
                'customer' => $smetaData['customer']['company'] ?? 'Unknown'
            ]);
            
            return $smetaId;
        } catch (PDOException $e) {
            Logger::error("Smeta creation failed: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Получение смет пользователя
     */
   public function getUserSmetas($userId, $limit = 50, $offset = 0) {
        $sql = "SELECT * FROM smeta WHERE user_id = :user_id 
                ORDER BY created_at DESC 
                LIMIT :limit OFFSET :offset";
        
        $stmt = $this->db->getPdo()->prepare($sql);
        $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
        
    /**
     * Получение конкретной сметы
     */
    public function findById($smetaId, $userId = null) {
        $sql = "SELECT * FROM smeta WHERE id = :id";
        $params = ['id' => $smetaId];
        
        // Если передан user_id, проверяем принадлежность сметы
        if ($userId) {
            $sql .= " AND user_id = :user_id";
            $params['user_id'] = $userId;
        }
        
        $smeta = $this->db->fetch($sql, $params);
        
        if ($smeta) {
            // Декодируем JSON данные
            $smeta['customer_data'] = json_decode($smeta['customer_data'], true) ?? [];
            $smeta['production_data'] = json_decode($smeta['production_data'], true) ?? [];
            $smeta['installation_data'] = json_decode($smeta['installation_data'], true) ?? [];
            $smeta['additional_options'] = json_decode($smeta['additional_options'], true) ?? [];
            $smeta['geolocation_data'] = json_decode($smeta['geolocation_data'], true) ?? [];
        }
        
        return $smeta;
    }
    
    /**
     * Обновление сметы
     */
    public function update($smetaId, $userId, $smetaData) {
        $data = [
            'customer_data' => json_encode($smetaData['customer'] ?? [], JSON_UNESCAPED_UNICODE),
            'production_data' => json_encode($smetaData['production'] ?? [], JSON_UNESCAPED_UNICODE),
            'installation_data' => json_encode($smetaData['installation'] ?? [], JSON_UNESCAPED_UNICODE),
            'additional_options' => json_encode($smetaData['additionalOptions'] ?? [], JSON_UNESCAPED_UNICODE),
            'geolocation_data' => json_encode($smetaData['geolocation'] ?? [], JSON_UNESCAPED_UNICODE),
            'status' => $smetaData['status'] ?? 'draft',
            'updated_at' => date('Y-m-d H:i:s')
        ];
        
        return $this->db->update(
            'smeta', 
            $data, 
            'id = :id AND user_id = :user_id', 
            ['id' => $smetaId, 'user_id' => $userId]
        );
    }
    
    /**
     * Удаление сметы
     */
    public function delete($smetaId, $userId) {
        $sql = "DELETE FROM smeta WHERE id = :id AND user_id = :user_id";
        $result = $this->db->query($sql, ['id' => $smetaId, 'user_id' => $userId]);
        
        if ($result->rowCount() > 0) {
            Logger::info("Smeta deleted", [
                'user_id' => $userId,
                'smeta_id' => $smetaId
            ]);
            return true;
        }
        
        return false;
    }
    
    /**
     * Обновление статуса сметы
     */
    public function updateStatus($smetaId, $userId, $status) {
        $allowedStatuses = ['draft', 'pending', 'in-progress', 'completed', 'archived'];
        
        if (!in_array($status, $allowedStatuses)) {
            return false;
        }
        
        return $this->db->update(
            'smeta',
            ['status' => $status, 'updated_at' => date('Y-m-d H:i:s')],
            'id = :id AND user_id = :user_id',
            ['id' => $smetaId, 'user_id' => $userId]
        );
    }
    
    /**
     * Поиск смет по компании заказчика
     */
    public function searchByCompany($userId, $searchTerm) {
        $sql = "SELECT * FROM smeta 
                WHERE user_id = :user_id 
                AND customer_data LIKE :search 
                ORDER BY created_at DESC";
        
        return $this->db->fetchAll($sql, [
            'user_id' => $userId,
            'search' => '%' . $searchTerm . '%'
        ]);
    }
    
    /**
     * Получение количества смет пользователя
     */
    public function getCount($userId) {
        $sql = "SELECT COUNT(*) as count FROM smeta WHERE user_id = :user_id";
        $result = $this->db->fetch($sql, ['user_id' => $userId]);
        return $result['count'] ?? 0;
    }
}
?>