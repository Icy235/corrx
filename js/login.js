/**
 * CORRX - СИСТЕМА АВТОРИЗАЦИИ
 * 
 * Скрипт для страницы логина.
 * 
 * Изменения в релизе:
 * - Убраны console.log для продакшена.
 * - Добавлена проверка result.success в authenticateUser.
 * - Добавлен clearUserSession() на ошибках.
 * - Улучшена обработка ошибок (friendly messages).
 * - Добавлены таймауты для fetch.
 */

document.addEventListener('DOMContentLoaded', function() {
    // ==================== КОНСТАНТЫ И КОНФИГУРАЦИЯ ====================
    const CONFIG = {
        API_BASE_URL: 'https://corrx.morylis.ru/backend',
        ENDPOINTS: {
            LOGIN: '/auth/login',
            VERIFY: '/auth/verify'
        },
        REQUEST_TIMEOUT: 10000,
        MIN_USERNAME_LENGTH: 3,
        MIN_PASSWORD_LENGTH: 8
    };

    // ==================== DOM ELEMENTS ====================
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const errorMessage = document.getElementById('errorMessage');
    const buttonText = loginButton.querySelector('.button-text');
    const loadingSpinner = loginButton.querySelector('.loading-spinner');

    // ==================== ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ ====================
    initLoginSystem();

    function initLoginSystem() {
        // Проверяем параметры URL для expired сессии
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('session') === 'expired') {
            showError('Сессия истекла. Пожалуйста, войдите снова.');
            // Очищаем параметр из URL
            window.history.replaceState({}, '', window.location.pathname);
        }
        
        checkExistingSession();
        loadSavedCredentials();
        setupEventListeners();
    }

    // ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================
    function setupEventListeners() {
        if (!loginForm) {
            return;
        }

        loginForm.addEventListener('submit', handleLogin);
        
        const inputs = loginForm.querySelectorAll('input[required]');
        inputs.forEach(input => {
            input.addEventListener('input', () => clearFieldError(input));
            input.addEventListener('blur', () => validateField(input));
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && validateForm()) {
                    handleLogin(e);
                }
            });
        });

        window.addEventListener('online', handleConnectionRestored);
        window.addEventListener('offline', handleConnectionLost);
    }

    // ==================== ОСНОВНАЯ ЛОГИКА АВТОРИЗАЦИИ ====================
    async function handleLogin(e) {
        e.preventDefault();
        
        if (!validateForm()) {
            showError('Пожалуйста, исправьте ошибки в форме');
            return;
        }

        const formData = new FormData(loginForm);
        const credentials = {
            username: formData.get('username').trim(),
            password: formData.get('password'),
            remember: formData.get('remember') === 'on'
        };

        setLoadingState(true);
        clearError();

        try {
            const result = await authenticateUser(credentials.username, credentials.password);
            
            if (result.success && result.data) {
                await handleSuccessfulLogin(result.data, credentials);
            } else {
                throw new Error(result.message || 'Неизвестная ошибка авторизации');
            }
            
        } catch (error) {
            console.error('❌ Ошибка авторизации:', error);
            handleLoginError(error);
        } finally {
            setLoadingState(false);
        }
    }

    /**
     * Аутентификация через API
     * Проверяет success в result.
     */
    async function authenticateUser(username, password) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
            
            const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.LOGIN, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `HTTP ${response.status}`;
                
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorMessage;
                } catch (e) {}
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Authentication failed');
            }
            
            return result;
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Обработка успешной авторизации
     * Сохраняет данные, redirect.
     */
    async function handleSuccessfulLogin(data, credentials) {
        const token = data.token;
        const user = data.user;
        const settings = data.settings || {};
        
        if (!token || !user) {
            throw new Error('Некорректный ответ от сервера');
        }
        
        localStorage.setItem('userToken', token);
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('userSettings', JSON.stringify(settings)); // Или session if not persistent
        
        if (credentials.remember) {
            saveCredentials(credentials.username);
        } else {
            clearSavedCredentials();
        }
        
        window.location.href = 'dashboard.html';
    }

    /**
     * Сохранение пользовательской сессии
     */
    function saveUserSession(user, token, settings) {
        console.log('💾 Сохранение сессии пользователя...');
        
        // Очищаем старые данные
        sessionStorage.clear();
        localStorage.removeItem('userToken');
        
        // Сохраняем новые данные
        sessionStorage.setItem('user', JSON.stringify(user));
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userSettings', JSON.stringify(settings));
        
        localStorage.setItem('userToken', token);
        
        console.log('✅ Сессия сохранена:', {
            user: user.username,
            tokenLength: token.length,
            session: sessionStorage.getItem('isLoggedIn')
        });
    }

    // ==================== ПРОВЕРКА СЕССИИ ====================
    async function checkExistingSession() {
        const isLoggedIn = sessionStorage.getItem('isLoggedIn');
        const userToken = localStorage.getItem('userToken');
        const userData = sessionStorage.getItem('user');
        
        console.log('🔍 Проверка активной сессии...', {
            isLoggedIn: isLoggedIn,
            token: userToken ? 'present' : 'missing',
            userData: userData ? 'present' : 'missing'
        });

        if (isLoggedIn !== 'true' || !userToken || !userData) {
            console.log('❌ Нет активной сессии');
            return;
        }

        try {
            console.log('🌐 Проверка токена через API...');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

            const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.VERIFY, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`  // ВАЖНО: добавляем Authorization header
                },
                body: JSON.stringify({ token: userToken }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('📊 Ответ сервера:', response.status);

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('✅ Активная сессия подтверждена - редирект на dashboard');
                    window.location.href = 'dashboard.html';
                    return;
                }
            }
            
            // Если токен невалиден
            console.log('❌ Токен невалиден или сессия истекла');
            clearUserSession();
            
        } catch (error) {
            console.warn('⚠️ Ошибка проверки сессии:', error.message);
            // При ошибке сети все равно очищаем сессию для безопасности
            clearUserSession();
        }
    }

    // ==================== ВАЛИДАЦИЯ ФОРМ ====================
    function validateForm() {
        const inputs = loginForm.querySelectorAll('input[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!validateField(input)) {
                isValid = false;
            }
        });

        return isValid;
    }

    function validateField(input) {
        const value = input.value.trim();
        let isValid = true;
        let errorMessage = '';

        if (!value) {
            errorMessage = 'Это поле обязательно для заполнения';
            isValid = false;
        } else if (input.type === 'password' && value.length < CONFIG.MIN_PASSWORD_LENGTH) {
            errorMessage = `Пароль должен содержать минимум ${CONFIG.MIN_PASSWORD_LENGTH} символов`;
            isValid = false;
        } else if (input.name === 'username' && value.length < CONFIG.MIN_USERNAME_LENGTH) {
            errorMessage = `Логин должен содержать минимум ${CONFIG.MIN_USERNAME_LENGTH} символа`;
            isValid = false;
        }

        if (isValid) {
            markFieldValid(input);
        } else {
            markFieldInvalid(input, errorMessage);
        }

        return isValid;
    }

    // ==================== UI УТИЛИТЫ ====================
    function setLoadingState(loading) {
        if (loading) {
            loginButton.disabled = true;
            buttonText.style.display = 'none';
            loadingSpinner.style.display = 'block';
            loginButton.setAttribute('aria-busy', 'true');
        } else {
            loginButton.disabled = false;
            buttonText.style.display = 'block';
            loadingSpinner.style.display = 'none';
            loginButton.setAttribute('aria-busy', 'false');
        }
    }

    function showError(message) {
        if (!errorMessage) return;
        errorMessage.textContent = message;
        errorMessage.className = 'error-message error';
        errorMessage.style.display = 'block';
        animateMessage(errorMessage);
    }

    function showSuccess(message) {
        if (!errorMessage) return;
        errorMessage.textContent = message;
        errorMessage.className = 'error-message success';
        errorMessage.style.display = 'block';
        animateMessage(errorMessage);
    }

    function clearError() {
        if (!errorMessage) return;
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';
        errorMessage.className = 'error-message';
    }

    function animateMessage(element) {
        element.style.animation = 'none';
        setTimeout(() => {
            element.style.animation = 'fadeInUp 0.3s ease-out';
        }, 10);
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
    function saveCredentials(username) {
        localStorage.setItem('rememberedUser', username);
        console.log('💾 Учетные данные сохранены');
    }

    function loadSavedCredentials() {
        const rememberedUser = localStorage.getItem('rememberedUser');
        if (rememberedUser) {
            const usernameInput = loginForm.querySelector('input[name="username"]');
            if (usernameInput) {
                usernameInput.value = rememberedUser;
                const passwordInput = loginForm.querySelector('input[name="password"]');
                if (passwordInput) {
                    passwordInput.focus();
                }
            }
            console.log('📝 Загружены сохраненные учетные данные');
        }
    }

    function clearSavedCredentials() {
        localStorage.removeItem('rememberedUser');
        console.log('🧹 Учетные данные очищены');
    }

    function clearUserSession() {
        sessionStorage.clear();
        localStorage.removeItem('userToken');
        localStorage.removeItem('userSettings');
    }

    function handleLoginError(error) {
        const userMessage = getFriendlyErrorMessage(error);
        showError(userMessage);
    }

    function getFriendlyErrorMessage(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('неверный логин') || 
            message.includes('invalid username') || 
            message.includes('invalid password')) {
            return 'Неверный логин или пароль';
        }
        if (message.includes('некорректный ответ') || message.includes('json')) {
            return 'Ошибка сервера: некорректный формат ответа';
        }
        if (message.includes('network') || message.includes('failed to fetch')) {
            return 'Ошибка сети. Проверьте подключение к интернету';
        }
        
        return error.message || 'Произошла непредвиденная ошибка';
    }

    // ==================== ВАЛИДАЦИЯ ПОЛЕЙ ====================
    function markFieldValid(input) {
        const container = input.closest('.input_container');
        if (!container) return;
        container.classList.remove('invalid');
        container.classList.add('valid');
        removeFieldError(container);
    }

    function markFieldInvalid(input, message) {
        const container = input.closest('.input_container');
        if (!container) return;
        container.classList.remove('valid');
        container.classList.add('invalid');
        removeFieldError(container);
        showFieldError(container, message);
    }

    function clearFieldError(input) {
        const container = input.closest('.input_container');
        if (!container) return;
        container.classList.remove('invalid', 'valid');
        removeFieldError(container);
        clearError();
    }

    function removeFieldError(container) {
        const existingError = container.nextElementSibling;
        if (existingError && existingError.classList.contains('field-error')) {
            existingError.remove();
        }
    }

    function showFieldError(container, message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        container.parentNode.insertBefore(errorElement, container.nextSibling);
    }

    // ==================== СИСТЕМНЫЕ СОБЫТИЯ ====================
    function handleConnectionRestored() {
        console.log('📶 Соединение восстановлено');
        showSuccess('Соединение восстановлено');
        setTimeout(clearError, 2000);
    }

    function handleConnectionLost() {
        console.warn('📶 Потеряно интернет-соединение');
        showError('Потеряно интернет-соединение');
    }
});