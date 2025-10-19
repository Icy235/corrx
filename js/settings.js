/**
 * CORRX - СТРАНИЦА НАСТРОЕК ПОЛЬЗОВАТЕЛЯ
 * 
 * ФУНКЦИОНАЛ:
 * ✅ Загрузка и отображение настроек пользователя
 * ✅ Обновление профиля и настроек
 * ✅ Смена пароля с валидацией
 * ✅ Выход из системы
 * ✅ Проверка авторизации
 * 
 * API ЭНДПОИНТЫ:
 * GET /user/profile - получение профиля
 * POST /user/update-profile - обновление профиля
 * POST /user/change-password - смена пароля
 * GET /user/settings - получение настроек
 * POST /user/update-settings - обновление настроек
 */

document.addEventListener('DOMContentLoaded', function() {
    // ==================== КОНСТАНТЫ И КОНФИГУРАЦИЯ ====================
const CONFIG = {
    // Правильный путь к API
    API_BASE_URL: 'https://corrx.morylis.ru/backend',
    ENDPOINTS: {
        // Auth endpoints
        LOGIN: '/auth/login',
        VERIFY: '/auth/verify',
        // User endpoints  
        PROFILE: '/user/profile',
        SETTINGS: '/user/settings',
        UPDATE_PROFILE: '/user/update-profile',
        CHANGE_PASSWORD: '/user/change-password',
        UPDATE_SETTINGS: '/user/update-settings',
        // Smeta endpoints
        CREATE_SMETA: '/smeta/create',
        GET_SMETAS: '/smeta/getUserSmetas',
        GET_SMETA_DETAILS: '/smeta/getSmetaDetails',
        UPDATE_SMETA: '/smeta/update',
        DELETE_SMETA: '/smeta/delete',
        UPDATE_STATUS: '/smeta/updateStatus',
        SEARCH_SMETA: '/smeta/search'
    },
    REQUEST_TIMEOUT: 10000
};

    // ==================== DOM ELEMENTS ====================
    const userInfoSection = document.getElementById('userInfo');
    const settingsSection = document.getElementById('settingsSection');
    const logoutBtn = document.getElementById('logoutBtn');
    const profileForm = document.getElementById('profileForm');
    const passwordForm = document.getElementById('passwordForm');
    const settingsForm = document.getElementById('settingsForm');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');

    // ==================== ПЕРЕМЕННЫЕ СОСТОЯНИЯ ====================
    let currentUser = null;
    let userSettings = null;

    // ==================== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ====================
    initSettingsPage();

    /**
     * Инициализация страницы настроек
     */
    async function initSettingsPage() {
        console.log('⚙️ Инициализация страницы настроек...');
        
        // Проверяем авторизацию
        const isAuthenticated = await checkAuthentication();
        
        if (!isAuthenticated) {
            console.log('❌ Пользователь не авторизован, перенаправление на страницу входа');
            redirectToLogin();
            return;
        }

        // Загружаем данные пользователя и настройки
        await loadUserData();
        setupEventListeners();
        initSafeAreas();
        
        console.log('✅ Страница настроек инициализирована');
    }

    /**
     * Проверка авторизации пользователя
     */
    async function checkAuthentication() {
        const token = localStorage.getItem('userToken');
        const userSession = sessionStorage.getItem('isLoggedIn');
        
        console.log('🔐 Проверка авторизации...');
        console.log('Token:', token ? 'present' : 'missing');
        console.log('Session:', userSession);

        if (!token || userSession !== 'true') {
            console.log('❌ Нет токена или сессии');
            return false;
        }

        try {
            console.log('🌐 Проверка валидности токена...');
            const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.VERIFY_TOKEN, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token: token })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('✅ Токен валиден, пользователь авторизован');
                    currentUser = result.data.user;
                    return true;
                }
            }
            
            console.log('❌ Токен невалиден');
            return false;
            
        } catch (error) {
            console.error('🌐 Ошибка проверки токена:', error);
            // В демо-режиме проверяем наличие демо-пользователя
            const demoUser = sessionStorage.getItem('user');
            if (demoUser) {
                console.log('🎭 Используется демо-режим');
                currentUser = JSON.parse(demoUser);
                return true;
            }
            return false;
        }
    }

    /**
     * Загрузка данных пользователя и настроек
     */
    async function loadUserData() {
        console.log('📥 Загрузка данных пользователя...');
        
        try {
            await Promise.all([
                loadUserProfile(),
                loadUserSettings()
            ]);
            
            updateUI();
            showSuccess('Данные успешно загружены');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            showError('Ошибка загрузки данных: ' + error.message);
        }
    }

    /**
     * Загрузка профиля пользователя
     */
    async function loadUserProfile() {
        const token = localStorage.getItem('userToken');
        
        try {
            const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.PROFILE, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success && result.data) {
                currentUser = result.data.user;
                console.log('✅ Профиль пользователя загружен:', currentUser.username);
            } else {
                throw new Error(result.message || 'Ошибка загрузки профиля');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
            
            // Fallback на демо-данные
            const demoUser = sessionStorage.getItem('user');
            if (demoUser) {
                currentUser = JSON.parse(demoUser);
                console.log('🎭 Используются демо-данные профиля');
            } else {
                throw error;
            }
        }
    }

    /**
     * Загрузка настроек пользователя
     */
    async function loadUserSettings() {
        const token = localStorage.getItem('userToken');
        
        try {
            const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.SETTINGS, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success && result.data) {
                userSettings = result.data.settings;
                console.log('✅ Настройки пользователя загружены');
            } else {
                throw new Error(result.message || 'Ошибка загрузки настроек');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки настроек:', error);
            
            // Fallback на демо-настройки
            const demoSettings = localStorage.getItem('userSettings');
            if (demoSettings) {
                userSettings = JSON.parse(demoSettings);
                console.log('🎭 Используются демо-настройки');
            } else {
                // Настройки по умолчанию
                userSettings = {
                    theme: 'light',
                    auto_logout: true,
                    caching_enabled: true,
                    notifications_enabled: true
                };
                console.log('⚙️ Используются настройки по умолчанию');
            }
        }
    }

    /**
     * Настройка обработчиков событий
     */
    function setupEventListeners() {
        // Кнопка выхода
        logoutBtn.addEventListener('click', handleLogout);
        
        // Форма профиля
        profileForm.addEventListener('submit', handleProfileUpdate);
        
        // Форма смены пароля
        passwordForm.addEventListener('submit', handlePasswordChange);
        
        // Форма настроек
        settingsForm.addEventListener('submit', handleSettingsUpdate);
        
        // Валидация форм в реальном времени
        setupFormValidation();
        
        // Обработка системных событий
        window.addEventListener('online', handleConnectionRestored);
        window.addEventListener('offline', handleConnectionLost);
    }

    /**
     * Настройка валидации форм
     */
    function setupFormValidation() {
        // Валидация email
        const emailInput = profileForm.querySelector('input[type="email"]');
        if (emailInput) {
            emailInput.addEventListener('blur', validateEmail);
        }
        
        // Валидация паролей
        const passwordInputs = passwordForm.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(input => {
            input.addEventListener('input', () => clearFieldError(input));
            input.addEventListener('blur', () => validatePasswordField(input));
        });
    }

    /**
     * Обновление интерфейса
     */
    function updateUI() {
        if (!currentUser) return;
        
        // Обновляем информацию о пользователе
        updateUserInfo();
        
        // Заполняем форму профиля
        fillProfileForm();
        
        // Заполняем форму настроек
        fillSettingsForm();
    }

    /**
     * Обновление информации о пользователе
     */
    function updateUserInfo() {
        const userInfoHTML = `
            <div class="user-avatar">
                <div class="avatar-placeholder">
                    ${currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : currentUser.username.charAt(0).toUpperCase()}
                </div>
            </div>
            <div class="user-details">
                <h3 class="user-name">${currentUser.full_name || currentUser.username}</h3>
                <p class="user-username">@${currentUser.username}</p>
                <p class="user-role">${currentUser.role === 'admin' ? 'Администратор' : 'Пользователь'}</p>
                ${currentUser.isDemo ? '<p class="demo-badge">Демо-режим</p>' : ''}
            </div>
        `;
        
        userInfoSection.innerHTML = userInfoHTML;
    }

    /**
     * Заполнение формы профиля
     */
    function fillProfileForm() {
        const fullNameInput = profileForm.querySelector('input[name="full_name"]');
        const emailInput = profileForm.querySelector('input[name="email"]');
        const phoneInput = profileForm.querySelector('input[name="phone"]');
        
        if (fullNameInput) fullNameInput.value = currentUser.full_name || '';
        if (emailInput) emailInput.value = currentUser.email || '';
        if (phoneInput) phoneInput.value = currentUser.phone || '';
    }

    /**
     * Заполнение формы настроек
     */
    function fillSettingsForm() {
        if (!userSettings) return;
        
        const themeSelect = settingsForm.querySelector('select[name="theme"]');
        const autoLogoutToggle = settingsForm.querySelector('input[name="auto_logout"]');
        const cachingToggle = settingsForm.querySelector('input[name="caching_enabled"]');
        const notificationsToggle = settingsForm.querySelector('input[name="notifications_enabled"]');
        
        if (themeSelect) themeSelect.value = userSettings.theme || 'light';
        if (autoLogoutToggle) autoLogoutToggle.checked = userSettings.auto_logout !== false;
        if (cachingToggle) cachingToggle.checked = userSettings.caching_enabled !== false;
        if (notificationsToggle) notificationsToggle.checked = userSettings.notifications_enabled !== false;
    }

    // ==================== ОБРАБОТЧИКИ ФОРМ ====================

    /**
     * Обработка обновления профиля
     */
    async function handleProfileUpdate(e) {
        e.preventDefault();
        
        if (!validateProfileForm()) {
            showError('Пожалуйста, исправьте ошибки в форме');
            return;
        }

        const formData = new FormData(profileForm);
        const profileData = {
            full_name: formData.get('full_name').trim(),
            email: formData.get('email').trim(),
            phone: formData.get('phone').trim()
        };

        setFormLoading(profileForm, true);
        clearMessages();

        try {
            console.log('📤 Отправка обновления профиля...');
            
            const token = localStorage.getItem('userToken');
            const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.UPDATE_PROFILE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(profileData)
            });

            const result = await response.json();
            
            if (result.success) {
                // Обновляем данные пользователя
                Object.assign(currentUser, profileData);
                updateUserInfo();
                showSuccess('Профиль успешно обновлен');
                console.log('✅ Профиль обновлен');
            } else {
                throw new Error(result.message || 'Ошибка обновления профиля');
            }
            
        } catch (error) {
            console.error('❌ Ошибка обновления профиля:', error);
            showError('Ошибка обновления профиля: ' + error.message);
        } finally {
            setFormLoading(profileForm, false);
        }
    }

    /**
     * Обработка смены пароля
     */
    async function handlePasswordChange(e) {
        e.preventDefault();
        
        if (!validatePasswordForm()) {
            showError('Пожалуйста, исправьте ошибки в форме');
            return;
        }

        const formData = new FormData(passwordForm);
        const passwordData = {
            current_password: formData.get('current_password'),
            new_password: formData.get('new_password'),
            confirm_password: formData.get('confirm_password')
        };

        setFormLoading(passwordForm, true);
        clearMessages();

        try {
            console.log('📤 Отправка смены пароля...');
            
            const token = localStorage.getItem('userToken');
            const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.CHANGE_PASSWORD, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    current_password: passwordData.current_password,
                    new_password: passwordData.new_password
                })
            });

            const result = await response.json();
            
            if (result.success) {
                passwordForm.reset();
                showSuccess('Пароль успешно изменен');
                console.log('✅ Пароль изменен');
            } else {
                throw new Error(result.message || 'Ошибка смены пароля');
            }
            
        } catch (error) {
            console.error('❌ Ошибка смены пароля:', error);
            showError('Ошибка смены пароля: ' + error.message);
        } finally {
            setFormLoading(passwordForm, false);
        }
    }

    /**
     * Обработка обновления настроек
     */
    async function handleSettingsUpdate(e) {
        e.preventDefault();
        
        const formData = new FormData(settingsForm);
        const settingsData = {
            theme: formData.get('theme'),
            auto_logout: formData.get('auto_logout') === 'on',
            caching_enabled: formData.get('caching_enabled') === 'on',
            notifications_enabled: formData.get('notifications_enabled') === 'on'
        };

        setFormLoading(settingsForm, true);
        clearMessages();

        try {
            console.log('📤 Отправка обновления настроек...');
            
            const token = localStorage.getItem('userToken');
            const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.UPDATE_SETTINGS, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(settingsData)
            });

            const result = await response.json();
            
            if (result.success) {
                // Обновляем настройки
                userSettings = settingsData;
                localStorage.setItem('userSettings', JSON.stringify(settingsData));
                applySettings(settingsData);
                showSuccess('Настройки успешно сохранены');
                console.log('✅ Настройки обновлены');
            } else {
                throw new Error(result.message || 'Ошибка сохранения настроек');
            }
            
        } catch (error) {
            console.error('❌ Ошибка обновления настроек:', error);
            showError('Ошибка сохранения настроек: ' + error.message);
        } finally {
            setFormLoading(settingsForm, false);
        }
    }

    /**
     * Применение настроек
     */
    function applySettings(settings) {
        // Применяем тему
        document.documentElement.setAttribute('data-theme', settings.theme);
        
        // Сохраняем настройки в localStorage
        localStorage.setItem('appSettings', JSON.stringify(settings));
        
        console.log('⚙️ Настройки применены:', settings.theme);
    }

    // ==================== ВАЛИДАЦИЯ ====================

    /**
     * Валидация формы профиля
     */
    function validateProfileForm() {
        const emailInput = profileForm.querySelector('input[type="email"]');
        const email = emailInput?.value.trim();
        
        if (email && !validateEmail(emailInput)) {
            return false;
        }
        
        return true;
    }

    /**
     * Валидация email
     */
    function validateEmail(input) {
        const email = input.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (email && !emailRegex.test(email)) {
            markFieldInvalid(input, 'Введите корректный email адрес');
            return false;
        }
        
        markFieldValid(input);
        return true;
    }

    /**
     * Валидация формы пароля
     */
    function validatePasswordForm() {
        const currentPassword = passwordForm.querySelector('input[name="current_password"]');
        const newPassword = passwordForm.querySelector('input[name="new_password"]');
        const confirmPassword = passwordForm.querySelector('input[name="confirm_password"]');
        
        let isValid = true;
        
        // Проверка текущего пароля
        if (!currentPassword.value.trim()) {
            markFieldInvalid(currentPassword, 'Введите текущий пароль');
            isValid = false;
        }
        
        // Проверка нового пароля
        if (newPassword.value.length < 8) {
            markFieldInvalid(newPassword, 'Пароль должен содержать минимум 8 символов');
            isValid = false;
        }
        
        // Проверка подтверждения пароля
        if (newPassword.value !== confirmPassword.value) {
            markFieldInvalid(confirmPassword, 'Пароли не совпадают');
            isValid = false;
        }
        
        return isValid;
    }

    /**
     * Валидация поля пароля
     */
    function validatePasswordField(input) {
        if (input.name === 'new_password' && input.value.length < 8) {
            markFieldInvalid(input, 'Пароль должен содержать минимум 8 символов');
            return false;
        }
        
        markFieldValid(input);
        return true;
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

    /**
     * Выход из системы
     */
    function handleLogout() {
        console.log('🚪 Выход из системы...');
        
        // Очищаем хранилища
        sessionStorage.clear();
        localStorage.removeItem('userToken');
        localStorage.removeItem('userSettings');
        localStorage.removeItem('rememberedUser');
        
        // Перенаправляем на страницу входа
        redirectToLogin();
    }

    /**
     * Перенаправление на страницу входа
     */
    function redirectToLogin() {
        window.location.href = 'login_page.html';
    }

    /**
     * Установка состояния загрузки для формы
     */
    function setFormLoading(form, loading) {
        const submitButton = form.querySelector('button[type="submit"]');
        const buttonText = submitButton.querySelector('.button-text');
        const loadingSpinner = submitButton.querySelector('.loading-spinner');
        
        if (loading) {
            submitButton.disabled = true;
            buttonText.style.display = 'none';
            loadingSpinner.style.display = 'block';
        } else {
            submitButton.disabled = false;
            buttonText.style.display = 'block';
            loadingSpinner.style.display = 'none';
        }
    }

    /**
     * Пометка поля как невалидного
     */
    function markFieldInvalid(input, message) {
        const container = input.closest('.input_container');
        container.classList.remove('valid');
        container.classList.add('invalid');
        
        removeFieldError(container);
        showFieldError(container, message);
    }

    /**
     * Пометка поля как валидного
     */
    function markFieldValid(input) {
        const container = input.closest('.input_container');
        container.classList.remove('invalid');
        container.classList.add('valid');
        removeFieldError(container);
    }

    /**
     * Очистка ошибки поля
     */
    function clearFieldError(input) {
        const container = input.closest('.input_container');
        container.classList.remove('invalid', 'valid');
        removeFieldError(container);
    }

    /**
     * Удаление сообщения об ошибке поля
     */
    function removeFieldError(container) {
        const existingError = container.nextElementSibling;
        if (existingError && existingError.classList.contains('field-error')) {
            existingError.remove();
        }
    }

    /**
     * Показ сообщения об ошибке поля
     */
    function showFieldError(container, message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        container.parentNode.insertBefore(errorElement, container.nextSibling);
    }

    /**
     * Показ сообщения об ошибке
     */
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
    }

    /**
     * Показ сообщения об успехе
     */
    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        
        // Авто-скрытие через 3 секунды
        setTimeout(clearMessages, 3000);
    }

    /**
     * Очистка сообщений
     */
    function clearMessages() {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
    }

    /**
     * Обработка восстановления соединения
     */
    function handleConnectionRestored() {
        console.log('📶 Соединение восстановлено');
        showSuccess('Соединение восстановлено');
    }

    /**
     * Обработка потери соединения
     */
    function handleConnectionLost() {
        console.warn('📶 Потеряно интернет-соединение');
        showError('Потеряно интернет-соединение');
    }

    /**
     * Инициализация safe areas для мобильных устройств
     */
    function initSafeAreas() {
        function updateSafeAreas() {
            const root = document.documentElement;
            root.style.setProperty('--safe-area-top', 'env(safe-area-inset-top, 0px)');
            root.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom, 0px)');
        }
        
        updateSafeAreas();
        window.addEventListener('resize', updateSafeAreas);
        window.addEventListener('orientationchange', updateSafeAreas);
    }
});