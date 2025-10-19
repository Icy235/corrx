<?php
/**
 * Класс для работы с базой данных PDO MySQL
 */

class Database {
    private $pdo;
    private static $instance = null;
    
    // Приватный конструктор (Singleton)
    private function __construct() {
        try {
            $dsn = "mysql:host=" . DatabaseConfig::DB_HOST . ";dbname=" . DatabaseConfig::DB_NAME . ";charset=" . DatabaseConfig::DB_CHARSET;
            $this->pdo = new PDO($dsn, DatabaseConfig::DB_USER, DatabaseConfig::DB_PASS);
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            
            Logger::info("Database connection established");
        } catch (PDOException $e) {
            Logger::error("Database connection failed: " . $e->getMessage());
            Response::error('Database connection error', 500);
        }
    }
    
    // Получение экземпляра (Singleton)
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    // Получение PDO объекта
    public function getPdo() {
        return $this->pdo;
    }
    
    // Выполнение запроса с параметрами
    public function query($sql, $params = []) {
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            Logger::error("Query failed: " . $e->getMessage() . " | SQL: " . $sql);
            throw $e;
        }
    }
    
    // Получение одной записи
    public function fetch($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetch();
    }
    
    // Получение всех записей
    public function fetchAll($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetchAll();
    }
    
    // Вставка записи и возврат ID
    public function insert($table, $data) {
        $columns = implode(', ', array_keys($data));
        $placeholders = ':' . implode(', :', array_keys($data));
        
        $sql = "INSERT INTO $table ($columns) VALUES ($placeholders)";
        $this->query($sql, $data);
        
        return $this->pdo->lastInsertId();
    }
    
    // Обновление записи
    public function update($table, $data, $where, $whereParams = []) {
        $setParts = [];
        foreach (array_keys($data) as $column) {
            $setParts[] = "$column = :$column";
        }
        $setClause = implode(', ', $setParts);
        
        $sql = "UPDATE $table SET $setClause WHERE $where";
        $params = array_merge($data, $whereParams);
        
        $stmt = $this->query($sql, $params);
        return $stmt->rowCount();
    }
    
    // Начало транзакции
    public function beginTransaction() {
        return $this->pdo->beginTransaction();
    }
    
    // Подтверждение транзакции
    public function commit() {
        return $this->pdo->commit();
    }
    
    // Откат транзакции
    public function rollBack() {
        return $this->pdo->rollBack();
    }
}
?>