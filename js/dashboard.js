
/**
 * CORRX - ПАНЕЛЬ УПРАВЛЕНИЯ СМЕТАМИ
 * 
 * Этот скрипт управляет дашбордом: загрузка смет, поиск, UI обновления.
 * 
 * Изменения в релизе:
 * - Исправлена проверка токена: добавлена проверка result.success в verifyTokenWithAPI.
 * - В checkAuthentication, в catch не всегда используем userData, только для network errors.
 * - Добавлен clearUserSession() перед redirectToLogin() везде.
 * - Убраны console.log для продакшена (оставлены только errors).
 * - Добавлены таймауты и abort controllers для всех fetch.
 * - Обработка 401 в loadSmetas и других calls: clear and redirect.
 * - Исправлена бесконечная переадресация.
 * - Убрано отображение роли.
 * - Добавлена ленивая загрузка с IntersectionObserver.
 * - Добавлены фильтры по статусу.
 * - Добавлено модальное окно для удаления.
 * - Добавлена подсветка результатов поиска.
 * - Добавлен skeleton loading.
 * - Добавлена отправка отчёта об ошибке в Telegram-бота.
 * - Добавлены тост-уведомления и улучшена доступность.
 * - Добавлено логирование ошибок на сервер.
 * - Добавлена анимация раскрытия поиска.
 * - Добавлено сообщение о результатах поиска.
 * - Улучшены анимации карточек.
 * - Добавлено динамическое приветствие по времени суток.
 * - Поиск закрывается по клику вне области.
 * - Генерация карточек смет из базы данных.
 * - Переход на view_smeta.html при клике на карточку.
 */

document.addEventListener('DOMContentLoaded', function() {
    // ==================== КОНСТАНТЫ И КОНФИГУРАЦИЯ ====================
    const CONFIG = {
        API_BASE_URL: 'https://corrx.morylis.ru/backend',
        ENDPOINTS: {
            LOGIN: '/auth/login',
            VERIFY: '/auth/verify',
            PROFILE: '/user/profile',
            SETTINGS: '/user/settings',
            UPDATE_PROFILE: '/user/update-profile',
            CHANGE_PASSWORD: '/user/change-password',
            UPDATE_SETTINGS: '/user/update-settings',
            CREATE_SMETA: '/smeta/create',
            GET_SMETAS: '/smeta/getUserSmetas',
            GET_SMETA_DETAILS: '/smeta/getSmetaDetails',
            UPDATE_SMETA: '/smeta/update',
            DELETE_SMETA: '/smeta/delete',
            UPDATE_STATUS: '/smeta/updateStatus',
            SEARCH_SMETA: '/smeta/search',
            LOG_ERROR: '/log/error'
        },
        REQUEST_TIMEOUT: 10000,
        TELEGRAM_BOT_TOKEN: '8451376003:AAFhYOSfKx35w5Ie73jKFuiNORP2UkVN468',
        TELEGRAM_CHAT_ID: '1983883397'
    };

    // ==================== DOM ELEMENTS ====================
    const smetaList = document.getElementById('smetaList');
    const emptyState = document.getElementById('emptyState');
    const smetaCount = document.getElementById('smetaCount');
    const searchInput = document.getElementById('searchInput');
    const userNameElement = document.getElementById('userName');
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    const statusFilter = document.getElementById('statusFilter');
    const deleteModal = document.getElementById('deleteModal');
    const toastContainer = document.getElementById('toastContainer');
    const searchContainer = document.getElementById('searchContainer');
    const welcomeContainer = document.querySelector('.welcome-container');
    const searchResultsInfo = document.getElementById('searchResultsInfo');
    const dashboardContainer = document.querySelector('.dashboard-container');

    // ==================== ПЕРЕМЕННЫЕ СОСТОЯНИЯ ====================
    let allSmetas = [];
    let currentUser = null;
    let isInitializing = false;
    let lastError = null;

    // ==================== ЛЕНИВАЯ ЗАГРУЗКА ====================
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    // ==================== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ====================
    initDashboard();

    /**
     * Инициализация панели управления
     */
    async function initDashboard() {
        if (isInitializing) {
            return;
        }
        
        isInitializing = true;
        
        try {
            // Проверка авторизации
            const isAuthenticated = await checkAuthentication();
            
            if (!isAuthenticated) {
                redirectToLogin();
                return;
            }
            
            // Обновляем UI с данными пользователя
            updateUserInterface();
            
            // Загрузка смет
            await loadSmetas();
            setupEventListeners();
            
        } catch (error) {
            console.error('❌ Критическая ошибка инициализации:', error);
            lastError = error;
            showErrorState('Ошибка инициализации: ' + error.message);
            logErrorToServer(error, 'initDashboard');
        } finally {
            isInitializing = false;
        }
    }

    /**
     * Обновление пользовательского интерфейса
     */
    function updateUserInterface() {
        if (!currentUser) {
            console.error('❌ currentUser не определён в updateUserInterface');
            return;
        }

        if (userNameElement) {
            userNameElement.textContent = currentUser.full_name || currentUser.username || 'Пользователь';
        } else {
            console.error('❌ userNameElement не найден в DOM');
        }

        if (document.querySelector('.welcome-greeting')) {
            document.querySelector('.welcome-greeting').textContent = getTimeBasedGreeting();
        }
    }

    /**
     * Получение приветствия по времени суток
     */
    function getTimeBasedGreeting() {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) {
            return 'Доброе утро';
        } else if (hour >= 12 && hour < 17) {
            return 'Добрый день';
        } else if (hour >= 17 && hour < 22) {
            return 'Добрый вечер';
        } else {
            return 'Доброй ночи';
        }
    }

    /**
     * Проверка авторизации пользователя
     */
    async function checkAuthentication() {
        const token = localStorage.getItem('userToken');
        const userSession = sessionStorage.getItem('isLoggedIn');
        const userData = sessionStorage.getItem('user');
        
        if (!token || userSession !== 'true' || !userData) {
            return false;
        }

        try {
            const isValid = await verifyTokenWithAPI(token);
            if (isValid) {
                return true;
            }
        } catch (error) {
            console.error('❌ Ошибка проверки токена через API:', error);
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                if (userData) {
                    try {
                        currentUser = JSON.parse(userData);
                        return true;
                    } catch (e) {
                        console.error('❌ Ошибка парсинга userData:', e);
                    }
                }
            }
        }
        
        return false;
    }

    /**
     * Проверка токена через API
     */
    async function verifyTokenWithAPI(token) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
            
            const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.VERIFY, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token: token }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Invalid token');
            }
            
            sessionStorage.setItem('user', JSON.stringify(result.data.user));
            currentUser = result.data.user;
            
            return true;
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Загрузка списка смет
     */
    /**
 * Загрузка списка смет
 */
    async function loadSmetas() {
        try {
            showLoadingState();
            const token = localStorage.getItem('userToken');
            if (!token) {
                console.error('No token found, redirecting to login');
                clearUserSession();
                redirectToLogin();
                return;
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
            
            const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.GET_SMETAS}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 401) {
                    console.error('401 Unauthorized, redirecting to login');
                    clearUserSession();
                    redirectToLogin();
                    return;
                }
                throw new Error(`HTTP ошибка: ${response.status}`);
            }

            const result = await response.json();
            console.log('📥 Ответ API /smeta/getUserSmetas:', JSON.stringify(result, null, 2)); // Дебаг ответа

            if (result.success && Array.isArray(result.data)) {
                allSmetas = result.data.map(smeta => {
                    // Проверка на наличие обязательных полей
                    if (!smeta.company || !smeta.parameters) {
                        console.warn(`⚠️ Некорректные данные для сметы ID ${smeta.id}:`, smeta);
                    }
                    return {
                        id: smeta.id || 0,
                        company: smeta.company || 'Не указан',
                        parameters: smeta.parameters || 'Не указаны',
                        price: smeta.price || 0,
                        status: smeta.status || 'draft',
                        created_at: smeta.created_at || new Date().toISOString()
                    };
                });
                console.log('📋 allSmetas:', JSON.stringify(allSmetas, null, 2)); // Дебаг allSmetas
                displaySmetas(allSmetas);
                updateSmetaCount(allSmetas.length);
            } else {
                throw new Error(result.message || 'Ошибка получения смет: некорректный формат ответа');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки смет:', error);
            lastError = error;
            showErrorState('Ошибка загрузки данных: ' + error.message);
            logErrorToServer(error, 'loadSmetas');
        }
    }

    /**
     * Отображение списка смет
     */
    function displaySmetas(smetas) {
        if (!smetas || smetas.length === 0) {
            showEmptyState();
            return;
        }

        console.log('🎨 Рендеринг смет:', smetas.length); // Дебаг количества смет

        const smetasHTML = smetas.map((smeta, index) => {
            console.log(`🖌️ Рендеринг карточки ID ${smeta.id}:`, smeta); // Дебаг каждой карточки
            return `
            <a href="view_smeta.html?id=${smeta.id}" class="estimate-card-link" data-smeta-id="${smeta.id}" style="animation-delay: ${index * 0.1}s">
                <div class="estimate-card">
                    <div class="card-section">
                        <span class="card-label">Заказчик:</span>
                        <span class="card-value company-name">${escapeHtml(smeta.company)}</span>
                    </div>
                    <div class="card-section">
                        <div class="card-row">
                            <span class="card-label">Параметры:</span>
                        </div>
                        <span class="card-value">${escapeHtml(smeta.parameters)}</span>
                    </div>
                    <div class="card-section">
                        <span class="card-label">Сумма:</span>
                        <span class="card-value price">В разработке</span>
                    </div>
                    <div class="card-footer">
                        <div class="status-info">
                            <span class="card-label">Статус:</span>
                            <span class="status-badge ${getStatusClass(smeta.status)}">${getStatusText(smeta.status)}</span>
                        </div>
                        <div class="date-info">
                            <span class="card-label">Создана:</span>
                            <span class="date-value">${formatDate(smeta.created_at)}</span>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="action-btn delete-btn" aria-label="Удалить" data-smeta-id="${smeta.id}">
                            <img src="assets/icons/trash.svg" alt="Удалить">
                        </button>
                    </div>
                </div>
            </a>
        `;
        }).join('');

        smetaList.innerHTML = smetasHTML;
        smetaList.style.display = 'block';
        emptyState.style.display = 'none';
        errorState.style.display = 'none';
        searchResultsInfo.style.display = 'none';

        smetaList.querySelectorAll('.estimate-card-link').forEach(card => {
            card.classList.add('lazy-load');
            observer.observe(card);
        });

        const firstCard = smetaList.querySelector('.estimate-card-link');
        if (firstCard) firstCard.focus();

        setupActionHandlers();

        if (statusFilter.value || searchInput.value) {
            filterSmetas();
        }
    }

    // ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================

    /**
     * Настройка обработчиков событий
     */
    function setupEventListeners() {
        // Поиск смет
        if (searchInput) {
            searchInput.addEventListener('input', debounce(handleSearch, 300));
            searchContainer.addEventListener('click', toggleSearch);
        }

        // Закрытие поиска по клику вне области
        if (dashboardContainer) {
            dashboardContainer.addEventListener('click', (e) => {
                if (!searchContainer.contains(e.target) && searchContainer.classList.contains('expanded')) {
                    closeSearch();
                }
            });
        }

        // Закрытие поиска по Esc
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && searchContainer.classList.contains('expanded')) {
                closeSearch();
            }
        });

        // Фильтр по статусу
        if (statusFilter) {
            statusFilter.addEventListener('change', filterSmetas);
        }

        // Обработка системных событий
        window.addEventListener('online', handleConnectionRestored);
        window.addEventListener('offline', handleConnectionLost);

        // Обработчик модального окна
        setupModalHandlers();
    }

    /**
     * Раскрытие поиска
     */
    function toggleSearch(e) {
        if (e.target === searchInput) return;
        if (searchContainer.classList.contains('expanded')) return;
        
        searchContainer.classList.add('expanded');
        searchInput.focus();
        welcomeContainer.classList.add('hidden');
    }

    /**
     * Закрытие поиска
     */
    function closeSearch() {
        searchContainer.classList.remove('expanded');
        searchInput.value = '';
        welcomeContainer.classList.remove('hidden');
        filterSmetas();
    }

    /**
     * Настройка обработчиков для кнопок действий
     */
    function setupActionHandlers() {
        const deleteButtons = document.querySelectorAll('.delete-btn');
        
        deleteButtons.forEach(button => {
            button.addEventListener('click', handleDeleteSmeta);
        });
    }

    /**
     * Настройка обработчиков модального окна
     */
    function setupModalHandlers() {
        const cancelBtn = deleteModal?.querySelector('.cancel-btn');
        const confirmBtn = deleteModal?.querySelector('.confirm-btn');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                deleteModal.style.display = 'none';
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                const smetaId = confirmBtn.dataset.smetaId;
                deleteModal.style.display = 'none';
                if (smetaId) await confirmDeleteSmeta(smetaId);
            });
        }
    }

    /**
     * Обработка удаления сметы
     */
    async function handleDeleteSmeta(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const cardLink = e.target.closest('.estimate-card-link');
        const smetaId = cardLink.dataset.smetaId;
        
        if (!smetaId) {
            console.error('❌ ID сметы не найден');
            showToast('Ошибка: ID сметы не найден', 'error');
            return;
        }

        deleteModal.style.display = 'block';
        const confirmBtn = deleteModal.querySelector('.confirm-btn');
        confirmBtn.dataset.smetaId = smetaId;
    }

    /**
     * Подтверждение удаления сметы
     */
    async function confirmDeleteSmeta(smetaId) {
        try {
            console.log(`🗑️ Удаление сметы ID: ${smetaId}`);
            
            const token = localStorage.getItem('userToken');
            
            if (!token) {
                throw new Error('Токен не найден');
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

            const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.DELETE_SMETA, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id: smetaId }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.status === 401) {
                clearUserSession();
                redirectToLogin();
                return;
            }

            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                const cardLink = smetaList.querySelector(`[data-smeta-id="${smetaId}"]`);
                if (cardLink) {
                    cardLink.style.opacity = '0';
                    cardLink.style.transform = 'translateX(-100%)';
                    setTimeout(() => {
                        allSmetas = allSmetas.filter(smeta => smeta.id != smetaId);
                        displaySmetas(allSmetas);
                        updateSmetaCount(allSmetas.length);
                    }, 300);
                }
                
                showToast('Смета успешно удалена', 'success');
            } else {
                throw new Error(result.message || 'Ошибка удаления сметы');
            }
            
        } catch (error) {
            console.error('❌ Ошибка удаления сметы:', error);
            showToast('Ошибка удаления сметы: ' + error.message, 'error');
            logErrorToServer(error, 'handleDeleteSmeta');
        }
    }

    /**
     * Обработка поиска смет
     */
    function handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (!searchTerm) {
            filterSmetas();
            return;
        }

        const filteredSmetas = allSmetas.filter(smeta => {
            const company = smeta.company || '';
            const parameters = smeta.parameters || '';
            return company.toLowerCase().includes(searchTerm) || 
                   parameters.toLowerCase().includes(searchTerm);
        });

        displaySmetas(filteredSmetas);
        updateSmetaCount(filteredSmetas.length, allSmetas.length);
        highlightSearchMatches(searchTerm);
        updateSearchResultsInfo(filteredSmetas.length, searchTerm);
    }

    /**
     * Фильтрация смет по статусу
     */
    function filterSmetas() {
        const status = statusFilter.value;
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        let filteredSmetas = allSmetas;
        
        if (status) {
            filteredSmetas = filteredSmetas.filter(smeta => smeta.status === status);
        }
        
        if (searchTerm) {
            filteredSmetas = filteredSmetas.filter(smeta => {
                const company = smeta.company || '';
                const parameters = smeta.parameters || '';
                return company.toLowerCase().includes(searchTerm) || 
                       parameters.toLowerCase().includes(searchTerm);
            });
        }
        
        displaySmetas(filteredSmetas);
        updateSmetaCount(filteredSmetas.length, allSmetas.length);
        if (searchTerm) {
            highlightSearchMatches(searchTerm);
            updateSearchResultsInfo(filteredSmetas.length, searchTerm);
        } else {
            searchResultsInfo.style.display = 'none';
        }
    }

    /**
     * Подсветка совпадений поиска
     */
    function highlightSearchMatches(term) {
        const companyNames = document.querySelectorAll('.company-name');
        companyNames.forEach(name => {
            const text = name.textContent;
            const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
            name.innerHTML = text.replace(regex, '<mark class="search-highlight">$1</mark>');
        });
    }

    /**
     * Обновление информации о результатах поиска
     */
    function updateSearchResultsInfo(count, term) {
        searchResultsInfo.style.display = 'block';
        searchResultsInfo.textContent = count === 0 
            ? `По запросу "${term}" ничего не найдено` 
            : `Найдено ${count} смет${count === 1 ? 'а' : count < 5 ? 'ы' : ''} по запросу "${term}"`;
    }

    /**
     * Экранирование для RegExp
     */
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Debounce функция для поиска
     */
    function debounce(func, delay) {
        let timeout;
        return function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, arguments), delay);
        };
    }

    /**
     * Показать состояние загрузки
     */
    function showLoadingState() {
        if (smetaList) {
            smetaList.innerHTML = `
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
            `;
            smetaList.style.display = 'block';
        }
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        if (errorState) {
            errorState.style.display = 'none';
        }
        searchResultsInfo.style.display = 'none';
    }

    /**
     * Показать состояние "нет смет"
     */
    function showEmptyState() {
        if (smetaList) {
            smetaList.style.display = 'none';
        }
        if (emptyState) {
            emptyState.style.display = 'block';
        }
        if (errorState) {
            errorState.style.display = 'none';
        }
        searchResultsInfo.style.display = 'none';
        updateSmetaCount(0);
    }

    /**
     * Показать состояние ошибки
     */
    function showErrorState(message) {
        if (smetaList) {
            smetaList.style.display = 'none';
        }
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        if (errorState && errorMessage) {
            errorState.style.display = 'block';
            errorMessage.textContent = escapeHtml(message);
        }
        searchResultsInfo.style.display = 'none';
    }

    /**
     * Обновить счетчик смет
     */
    function updateSmetaCount(currentCount, totalCount = null) {
        if (smetaCount) {
            if (totalCount !== null && currentCount < totalCount) {
                smetaCount.textContent = `${currentCount} из ${totalCount} смет`;
            } else {
                const countText = currentCount === 0 ? 'Нет смет' : 
                                currentCount === 1 ? '1 смета' : 
                                `${currentCount} смет`;
                smetaCount.textContent = countText;
            }
        }
    }

    /**
     * Показать toast уведомление
     */
    function showToast(message, type = 'info') {
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        toast.style.cssText = `
            padding: 12px 20px;
            border-radius: 8px;
            font-family: 'Unbounded', sans-serif;
            font-size: 0.9rem;
            color: white;
            background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#5E7B00' : '#3498db'};
            margin-bottom: 10px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }, 100);
    }

    /**
     * Отправка отчёта об ошибке в Telegram
     */
    async function reportError() {
        if (!lastError) {
            showToast('Нет сохранённой ошибки для отправки', 'error');
            return;
        }

        try {
            const userInfo = currentUser ? {
                id: currentUser.id,
                username: currentUser.username,
                full_name: currentUser.full_name,
                email: currentUser.email || 'Не указан'
            } : { error: 'Пользователь не авторизован' };

            const errorInfo = {
                message: lastError.message,
                stack: lastError.stack || 'Отсутствует',
                url: window.location.href,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            };

            const message = `
<b>Отчёт об ошибке</b>
<b>Пользователь:</b>
ID: ${userInfo.id || 'Неизвестно'}
Имя: ${userInfo.full_name || userInfo.username || 'Неизвестно'}
Email: ${userInfo.email}
<b>Ошибка:</b>
Сообщение: ${errorInfo.message}
Стек: ${errorInfo.stack}
URL: ${errorInfo.url}
Время: ${errorInfo.timestamp}
User-Agent: ${errorInfo.userAgent}
            `;

            const response = await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: CONFIG.TELEGRAM_CHAT_ID,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            if (!response.ok) {
                throw new Error(`Ошибка отправки в Telegram: ${response.status}`);
            }

            showToast('Отчёт об ошибке отправлен', 'success');
        } catch (error) {
            console.error('❌ Ошибка отправки отчёта в Telegram:', error);
            showToast('Не удалось отправить отчёт', 'error');
            logErrorToServer(error, 'reportError');
        }
    }

    /**
     * Логирование ошибок на сервер
     */
    async function logErrorToServer(error, context) {
        try {
            const token = localStorage.getItem('userToken');
            const errorData = {
                message: error.message,
                stack: error.stack || 'Отсутствует',
                context: context,
                url: window.location.href,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                userId: currentUser?.id || 'Неизвестно'
            };

            await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.LOG_ERROR, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(errorData)
            });
        } catch (e) {
            console.error('❌ Ошибка логирования на сервер:', e);
        }
    }

    /**
     * Форматирование даты
     */
    function formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (e) {
            return 'Неизвестно';
        }
    }

    /**
     * Форматирование цены
     */
    function formatPrice(price) {
        if (!price || price === 0) {
            return 'Не рассчитано';
        }
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(price);
    }

    /**
     * Получить текст статуса
     */
    function getStatusText(status) {
        const statusMap = {
            'draft': 'Черновик',
            'pending': 'На согласовании',
            'in-progress': 'В работе',
            'completed': 'Завершена',
            'archived': 'Архив'
        };
        return statusMap[status] || 'Черновик';
    }

    /**
     * Получить CSS класс статуса
     */
    function getStatusClass(status) {
        const classMap = {
            'draft': 'pending',
            'pending': 'pending',
            'in-progress': 'in-progress',
            'completed': 'completed',
            'archived': 'completed'
        };
        return classMap[status] || 'pending';
    }

    /**
     * Экранирование HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Очистка пользовательской сессии
     */
    function clearUserSession() {
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('userSettings');
        localStorage.removeItem('userToken');
        localStorage.removeItem('userSettings');
    }

    /**
     * Перенаправление на страницу входа
     */
    function redirectToLogin() {
        clearUserSession();
        window.location.href = 'login_page.html?session=expired';
    }

    /**
     * Обработка восстановления соединения
     */
    function handleConnectionRestored() {
        console.log('📶 Соединение восстановлено');
        showToast('Соединение восстановлено', 'success');
        initDashboard();
    }

    /**
     * Обработка потери соединения
     */
    function handleConnectionLost() {
        console.warn('📶 Потеряно интернет-соединение');
        showToast('Потеряно интернет-соединение', 'error');
    }

    // ==================== ГЛОБАЛЬНЫЕ ФУНКЦИИ ====================
    window.reportError = reportError;

    // ==================== СТИЛИ ДЛЯ АНИМАЦИЙ ====================
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes fadeInUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulse {
            0% { background-color: #f8f8f8; }
            50% { background-color: #e0e0e0; }
            100% { background-color: #f8f8f8; }
        }
        .skeleton-card {
            background: #f8f8f8;
            border-radius: 15px;
            padding: 20px;
            height: 150px;
            margin-bottom: 15px;
            animation: pulse 1.5s infinite;
        }
        .error-state {
            text-align: center;
            padding: 40px 20px;
            color: #e74c3c;
        }
        .error-icon {
            font-size: 3rem;
            margin-bottom: 20px;
        }
        .retry-btn, .report-btn {
            background: #5E7B00;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-family: 'Unbounded', sans-serif;
            margin: 10px;
        }
        .report-btn {
            background: #e74c3c;
        }
        .retry-btn:hover {
            background: #4a6100;
        }
        .report-btn:hover {
            background: #c0392b;
        }
        .estimate-card-link {
            display: block;
            text-decoration: none;
            color: inherit;
            transition: all 0.3s ease;
            opacity: 0;
        }
        .estimate-card-link.visible {
            animation: fadeInUp 0.5s ease-out forwards;
        }
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        .modal-content {
            background: #fff;
            border-radius: 12px;
            padding: 20px;
            max-width: 400px;
            width: 90%;
            text-align: center;
        }
        .modal-actions {
            display: flex;
            justify-content: space-around;
            margin-top: 20px;
        }
        .modal-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-family: 'Unbounded', sans-serif;
        }
        .cancel-btn {
            background: #ccc;
        }
        .confirm-btn {
            background: #e74c3c;
            color: white;
        }
        .cancel-btn:hover {
            background: #bbb;
        }
        .confirm-btn:hover {
            background: #c0392b;
        }
        .search-highlight {
            background: #fff3cd;
            color: #1a1a1a;
            padding: 2px 4px;
            border-radius: 4px;
        }
        .toast-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
        }
        .filter-container {
            margin: 10px 0;
        }
        #statusFilter {
            padding: 8px;
            border-radius: 8px;
            border: 1px solid #ccc;
            font-family: 'Unbounded', sans-serif;
            font-size: 0.9rem;
        }
    `;
    document.head.appendChild(style);
});
