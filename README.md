
# CorrX - Система управления строительными сметами
<img width="1280" height="640" alt="CorrxDescr" src="https://github.com/user-attachments/assets/618b2927-7b28-4c1d-a5ad-2f75d4760ecb" />

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![PHP](https://img.shields.io/badge/PHP-8.3.6-green.svg)
![MariaDB](https://img.shields.io/badge/MariaDB-10.11.13-orange.svg)


Веб-приложение для автоматизации создания и управления сметами на строительство быстровозводимых ангаров. Система предназначена для строительных компаний и позволяет быстро рассчитывать стоимость проектов, управлять заказами и взаимодействовать с клиентами.

## 🌟 Основные функции

### 🔐 Аутентификация и безопасность
- **JWT-аутентификация** с защитой от brute-force атак
- **Ролевая модель** (user/admin)
- **Автоматический выход** при неактивности
- **Безопасное хранение паролей** (bcrypt)

### 📋 Управление сметами
- **Создание смет** с детальными параметрами:
  - Данные заказчика (компания, контакты)
  - Параметры производства (длина, ширина, тип фундамента, стены)
  - Опции монтажа (техника, проживание рабочих, расстояние)
  - Дополнительные опции (утепление, электрика, сваи)
  - Геолокация базы (интеграция с Яндекс.Картами)
- **Просмотр и редактирование** существующих смет
- **Поиск и фильтрация** по статусам и компании
- **Изменение статусов** (черновик, на согласовании, в работе, завершена, архив)

### 💰 Расчет стоимости
- Автоматический расчет стоимости на основе параметров
- Разделение на производство, монтаж, фундамент, дополнительные работы
- Расчет с НДС и без НДС
- Стоимость за квадратный метр

### 👥 Управление пользователями
- Создание новых пользователей (для администраторов)
- Управление ролями и настройками
- Просмотр статистики и логов

### ⚙️ Настройки системы
- Персонализация профиля
- Настройки приложения (тема, кэширование, уведомления)
- Смена пароля
- Экспорт данных

## 🛠️ Технический стек

### Frontend
- **HTML5** с семантической разметкой
- **CSS3** с кастомными свойствами (переменными)
- **Vanilla JavaScript** (ES6+)
- **Адаптивный дизайн** (mobile-first)
- **Шрифты**: Tektur, Unbounded (Google Fonts)
- **Иконки**: SVG векторные иконки

### Backend
- **PHP 8.3.6** (чистый PHP, без фреймворков)
- **MariaDB 10.11.13** (MySQL-совместимая)
- **Apache** веб-сервер

### Безопасность
- **JWT токены** для аутентификации
- **CORS политики**
- **Rate limiting** (ограничение попыток входа)
- **Подготовленные SQL-запросы** (PDO)
- **Валидация и санитизация** входных данных

## 🗄️ Структура базы данных

### Таблица `users`
```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    is_active TINYINT(1) DEFAULT 1,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);
```

### Таблица `smeta`
```sql
CREATE TABLE smeta (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    customer_data JSON,
    production_data JSON,
    installation_data JSON,
    additional_options JSON,
    geolocation_data JSON,
    status ENUM('draft', 'pending', 'in-progress', 'completed', 'archived') DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Таблица `user_settings`
```sql
CREATE TABLE user_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    theme VARCHAR(20) DEFAULT 'light',
    auto_logout BOOLEAN DEFAULT TRUE,
    caching_enabled BOOLEAN DEFAULT TRUE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Таблица `debug_logs`
```sql
CREATE TABLE debug_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    level ENUM('info', 'warning', 'error', 'debug'),
    message TEXT,
    context JSON,
    user_id INT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🏗️ Архитектура приложения

### Frontend структура
```
public_html/
├── index.html (редирект на login)
├── login_page.html (страница входа)
├── dashboard.html (главная панель)
├── create_new_smeta.html (создание сметы)
├── view_smeta.html (просмотр сметы)
├── settings.html (настройки)
├── css/ (стили)
├── js/ (клиентские скрипты)
├── assets/icons/ (иконки)
└── backend/ (API)
```

### Backend структура (MVC-подобная)
```
backend/
├── index.php (точка входа API)
├── config/database.php (конфигурация БД)
├── controllers/ (логика приложения)
│   ├── AuthController.php
│   ├── UserController.php
│   └── SmetaController.php
├── models/ (работа с данными)
│   ├── Database.php
│   ├── User.php
│   └── Smeta.php
├── middleware/ (промежуточное ПО)
│   ├── AuthMiddleware.php
│   └── CorsMiddleware.php
└── utils/ (вспомогательные классы)
    ├── JWT.php
    ├── Logger.php
    └── Response.php
```

## 🔌 API Endpoints

### Аутентификация
- `POST /auth/login` - вход в систему
- `POST /auth/verify` - проверка токена
- `POST /auth/logout` - выход из системы

### Пользователи
- `GET /user/profile` - получение профиля
- `POST /user/update-profile` - обновление профиля
- `POST /user/change-password` - смена пароля
- `GET /user/settings` - получение настроек
- `POST /user/update-settings` - обновление настроек
- `POST /user/create` - создание пользователя (admin only)

### Сметы
- `POST /smeta/create` - создание сметы
- `GET /smeta/getUserSmetas` - список смет пользователя
- `GET /smeta/getSmetaDetails` - детали сметы
- `POST /smeta/update` - обновление сметы
- `POST /smeta/delete` - удаление сметы
- `POST /smeta/updateStatus` - обновление статуса
- `GET /smeta/search` - поиск смет

## 🚀 Установка и развертывание

### Требования
- PHP 8.0+
- MariaDB 10.3+ или MySQL 8.0+
- Apache с mod_rewrite
- Composer (для зависимостей)

### Шаги установки

1. **Клонировать репозиторий**
```bash
git clone https://github.com/icy235/corrx.git
cd corrx
```

2. **Настроить виртуальный хост Apache**
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /path/to/corrx-system/public_html
    <Directory /path/to/corrx-system/public_html>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

3. **Импортировать структуру БД**
```sql
CREATE DATABASE corrx_corrx;
USE corrx_corrx;
-- Импортируйте SQL структуру из database_schema.sql
```

4. **Настроить конфигурацию**
Отредактируйте `backend/config/database.php`:
```php
const DB_HOST = 'localhost';
const DB_NAME = 'corrx_corrx';
const DB_USER = 'your_username';
const DB_PASS = 'your_password';
const JWT_SECRET = 'your-secret-key';
```

5. **Установить зависимости**
```bash
composer install
```

6. **Настроить права доступа**
```bash
chmod 755 -R public_html/
chmod 644 backend/config/database.php
```

## 🔒 Безопасность

### Реализованные меры защиты
- **Аутентификация**: JWT с expiration
- **Авторизация**: ролевая модель
- **Валидация**: проверка всех входных данных
- **SQL инъекции**: подготовленные запросы через PDO
- **XSS**: санитизация HTML-вывода
- **Rate limiting**: ограничение попыток входа
- **CORS**: контроль доменов доступа

### Рекомендации для продакшена
- Использовать HTTPS
- Настроить .env для конфиденциальных данных
- Регулярное обновление зависимостей
- Мониторинг логов безопасности
- Резервное копирование БД

## 📈 Производительность

### Оптимизации
- Кэширование настроек пользователя
- Пагинация списков смет
- Минимизация JSON данных
- Оптимизированные SQL-запросы

### Мониторинг
- Детальное логирование действий
- Отслеживание ошибок
- Анализ производительности запросов

## 🐛 Отладка

Система включает комплексное логирование:
- Логи аутентификации
- Действия пользователей
- Ошибки приложения
- Отладочная информация

## 📄 Лицензия

© 2025 CorrX System. Все права защищены.

## 🤝 Поддержка

При возникновении вопросов или обнаружении ошибок создавайте issue в репозитории проекта.

---

*Версия: 1.0.0 | Последнее обновление: Октябрь 2025*
