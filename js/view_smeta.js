/**
 * ЛОГИКА СТРАНИЦЫ ПРОСМОТРА ДЕТАЛЕЙ СМЕТЫ (ПОЛНАЯ ВЕРСИЯ)
 */

// Константы для расчетов (примерные формулы)
const CALCULATION_CONSTANTS = {
    // Производство
    PROFLE_SHEET_PRICE_PER_KG: 150,
    WOOD_PRICE_PER_CUBIC_METER: 15000,
    BOLT_PRICE_PER_UNIT: 50,
    CONNECTION_PRICE_PER_UNIT: 500,
    EMBED_PRICE_PER_UNIT: 1500,

    // Монтаж
    WORKER_PRICE_PER_DAY: 5000,
    EQUIPMENT_PRICE_PER_DAY: 10000,
    ACCOMMODATION_PRICE_PER_DAY: 5000,
    TRANSPORTATION_PRICE_PER_KM: 500,

    // Фундамент
    CONCRETE_PRICE_PER_CUBIC_METER: 5000,
    REBAR_PRICE_PER_KG: 50,
    FORMWORK_PRICE_PER_SQ_M: 1000,
    PILE_PRICE_PER_UNIT: 5000,
    CHANNEL_PRICE_PER_M: 1000,

    // Наценка (прибыль)
    PROFIT_MARGIN: 0.2 // 20%
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 view_smeta.js загружен');

    // ==================== КОНСТАНТЫ И КОНФИГУРАЦИЯ ====================
    const CONFIG = {
        API_BASE_URL: 'https://corrx.morylis.ru/backend',
        ENDPOINTS: {
            VERIFY: '/auth/verify',
            GET_SMETA_DETAILS: '/smeta/getSmetaDetails',
            UPDATE_STATUS: '/smeta/updateStatus'
        }
    };

    // ==================== ПЕРЕМЕННЫЕ СОСТОЯНИЯ ====================
    let currentSmeta = null;
    let smetaId = null;

    // ==================== ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ ====================
    initApp();

    async function initApp() {
        console.log('🚀 Инициализация приложения...');
        
        // Получаем ID сметы из URL
        smetaId = getSmetaIdFromURL();
        if (!smetaId) {
            console.error('❌ ID сметы не найден в URL');
            showError('ID сметы не указан');
            return;
        }
        console.log('📋 ID сметы:', smetaId);

        // Упрощенная проверка авторизации
        if (!await checkAuth()) {
            console.log('❌ Пользователь не авторизован');
            return;
        }

        // Загружаем данные сметы
        await loadSmetaData();
        
        // Инициализируем UI
        initUI();
        
        console.log('✅ Приложение инициализировано');
    }

    function getSmetaIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    async function checkAuth() {
        const token = localStorage.getItem('userToken');
        const userSession = sessionStorage.getItem('isLoggedIn');
        
        console.log('🔐 Проверка авторизации:', {
            hasToken: !!token,
            tokenLength: token ? token.length : 0,
            userSession: userSession
        });

        // Базовая проверка наличия токена и сессии
        if (!token || userSession !== 'true') {
            console.log('❌ Нет токена или сессии, перенаправляем на логин');
            redirectToLogin();
            return false;
        }

        // Проверяем токен через API
        try {
            console.log('🔄 Проверка токена через API...');
            const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.VERIFY, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token: token })
            });

            console.log('📡 Статус ответа проверки токена:', response.status);

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Токен валиден:', result.success);
                if (result.success) {
                    return true;
                }
            } else {
                console.log('❌ Токен невалиден, статус:', response.status);
            }
        } catch (error) {
            console.error('❌ Ошибка при проверке токена:', error);
        }

        // Если дошли сюда, значит авторизация не прошла
        console.log('❌ Авторизация не пройдена, очищаем данные и перенаправляем');
        clearAuthData();
        redirectToLogin();
        return false;
    }

    async function loadSmetaData() {
        try {
            console.log('🔄 Загрузка данных сметы...');
            const token = localStorage.getItem('userToken');
            
            if (!token) {
                throw new Error('Токен не найден');
            }

            const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.GET_SMETA_DETAILS}?id=${smetaId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('📡 Статус ответа загрузки сметы:', response.status);

            if (response.status === 401) {
                throw new Error('Токен недействителен');
            }

            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }

            const result = await response.json();
            console.log('📊 Ответ сервера:', result);
            
            if (result.success && result.data) {
                currentSmeta = result.data;
                console.log('✅ Данные сметы получены:', currentSmeta);
                displaySmetaData();
            } else {
                throw new Error(result.message || 'Смета не найдена');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки сметы:', error);
            showError('Ошибка загрузки сметы: ' + error.message);
        }
    }

    function displaySmetaData() {
        if (!currentSmeta) {
            console.error('❌ Нет данных для отображения');
            return;
        }

        console.log('🎨 Отображение данных сметы...');

        // Обновляем заголовок
        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) {
            pageTitle.textContent = `Смета №${currentSmeta.id}`;
        }

        // Отображаем данные
        displayCustomerData();
        displayGeneralInfo();
        displaySmetaSections();
        
        console.log('✅ Данные сметы отображены');
    }

    function displayCustomerData() {
        const customer = currentSmeta.customer || {};
        const infoContainer = document.querySelector('.info-container');
        
        if (!infoContainer) return;

        console.log('👤 Данные заказчика:', customer);

        let html = '';
        let hasData = false;

        // Компания
        if (customer.company) {
            html += `
                <div class="info-item">
                    <img src="assets/icons/briefcase.svg" alt="Компания">
                    <span class="info-label">Компания:</span>
                    <span class="info-value">${escapeHtml(customer.company)}</span>
                </div>
            `;
            hasData = true;
        }

        // Контакты
        const contacts = customer.contacts || {};
        if (contacts.names && contacts.names.length > 0) {
            html += `
                <div class="info-item">
                    <img src="assets/icons/user.svg" alt="ФИО">
                    <span class="info-label">Контактное лицо:</span>
                    <span class="info-value">${escapeHtml(contacts.names.join(', '))}</span>
                </div>
            `;
            hasData = true;
        }

        if (contacts.phones && contacts.phones.length > 0) {
            html += `
                <div class="info-item">
                    <img src="assets/icons/phone.svg" alt="Телефон">
                    <span class="info-label">Телефон:</span>
                    <span class="info-value">${escapeHtml(contacts.phones.join(', '))}</span>
                </div>
            `;
            hasData = true;
        }

        if (contacts.emails && contacts.emails.length > 0) {
            html += `
                <div class="info-item">
                    <img src="assets/icons/mail.svg" alt="Почта">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${escapeHtml(contacts.emails.join(', '))}</span>
                </div>
            `;
            hasData = true;
        }

        // Адрес из геолокации
        const geolocation = currentSmeta.geolocation || {};
        if (geolocation.address) {
            html += `
                <div class="info-item">
                    <img src="assets/icons/map.svg" alt="Адрес">
                    <span class="info-label">Адрес:</span>
                    <span class="info-value">${escapeHtml(geolocation.address)}</span>
                </div>
            `;
            hasData = true;
        }

        // Особые пожелания
        const additionalOptions = currentSmeta.additional_options || {};
        const specialRequests = additionalOptions.specialRequests || {};
        if (specialRequests.text) {
            html += `
                <div class="info-item">
                    <img src="assets/icons/favorite.svg" alt="Пожелания">
                    <span class="info-label">Особые пожелания:</span>
                    <span class="info-value">${escapeHtml(specialRequests.text)}</span>
                </div>
            `;
            hasData = true;
        }

        infoContainer.innerHTML = html;

        // Скрываем секцию заказчика, если нет данных
        const customerSection = document.querySelector('.form-section');
        if (customerSection && !hasData) {
            customerSection.style.display = 'none';
            console.log('👤 Секция заказчика скрыта (нет данных)');
        } else {
            console.log('👤 Секция заказчика отображена');
        }
    }

    function displayGeneralInfo() {
        const generalInfo = currentSmeta.calculated_prices || {};
        const production = currentSmeta.production || {};
        
        console.log('📊 Общие сведения:', { generalInfo, production });
        
        updateStatusDisplay(currentSmeta.status);
        
        const foundationType = production.foundation || 'Не указан';
        const foundationElement = document.querySelector('.info-row:nth-child(2) .info-value');
        if (foundationElement) {
            foundationElement.textContent = foundationType;
        }
        
        if (generalInfo.total_with_vat) {
            const element = document.querySelector('.info-row:nth-child(3) .price-value');
            if (element) {
                element.textContent = formatPrice(generalInfo.total_with_vat);
            }
        }
        
        if (generalInfo.total_without_vat) {
            const element = document.querySelector('.info-row:nth-child(4) .price-value');
            if (element) {
                element.textContent = formatPrice(generalInfo.total_without_vat);
            }
        }
        
        if (generalInfo.price_per_m2) {
            const element = document.querySelector('.info-row:nth-child(5) .price-value');
            if (element) {
                element.textContent = formatPrice(generalInfo.price_per_m2) + '/м²';
            }
        }
    }

    function displaySmetaSections() {
        if (!currentSmeta) return;

        console.log('🏗️ Отображение секций сметы...');
        
        const production = currentSmeta.production || {};
        const installation = currentSmeta.installation || {};
        const additionalOptions = currentSmeta.additional_options || {};
        const geolocation = currentSmeta.geolocation || {};

        // Рассчитываем и отображаем производство
        calculateAndDisplayProduction(production);

        // Рассчитываем и отображаем монтаж
        calculateAndDisplayInstallation(installation, geolocation);

        // Отображаем выбранный тип фундамента
        displaySelectedFoundation(production, additionalOptions);

        // Рассчитываем и отображаем прибыль
        calculateAndDisplayProfit(production);
    }

    function calculateAndDisplayProduction(production) {
        const length = parseFloat(production.length) || 0;
        const width = parseFloat(production.width) || 0;
        const area = length * width;

        console.log('🏭 Данные производства:', { length, width, area });

        if (area === 0) {
            const section = document.querySelector('.smeta-section:nth-child(1)');
            if (section) section.style.display = 'none';
            return;
        }

        // Основные параметры
        updateParamValue('area', area, 'м²');
        updateParamValue('width', width, 'м');
        updateParamValue('length', length, 'м');

        // Расчетные значения (примерные формулы)
        const totalWeight = area * 20; // Пример: 20 кг/м²
        const productionCost = area * CALCULATION_CONSTANTS.PROFLE_SHEET_PRICE_PER_KG * 0.8;

        updateParamValue('total-weight', totalWeight, 'кг');
        updateParamValue('weight-per-m2', (totalWeight / area).toFixed(2), 'кг/м²');
        updateParamValue('production-cost-per-m2', productionCost / area, '₽/м²');
        updateParamValue('total-production-cost', productionCost, '₽');

        // Обновляем цену секции
        const sectionPrice = document.querySelector('.smeta-section:nth-child(1) .section-price');
        if (sectionPrice) {
            sectionPrice.textContent = formatPrice(productionCost);
        }
    }

    function calculateAndDisplayInstallation(installation, geolocation) {
        if (!installation.enabled) {
            const section = document.querySelector('.smeta-section:nth-child(2)');
            if (section) section.style.display = 'none';
            return;
        }

        const distance = parseFloat(installation.distance) || 0;
        const production = currentSmeta.production || {};
        const area = (parseFloat(production.length) || 0) * (parseFloat(production.width) || 0);

        console.log('🔧 Данные монтажа:', { distance, area });

        // Расчет стоимости монтажа
        const workers = 4;
        const days = Math.ceil(area / 100);
        const workerCost = workers * days * CALCULATION_CONSTANTS.WORKER_PRICE_PER_DAY;
        const equipmentCost = days * CALCULATION_CONSTANTS.EQUIPMENT_PRICE_PER_DAY;
        const transportCost = distance * CALCULATION_CONSTANTS.TRANSPORTATION_PRICE_PER_KM;
        const accommodationCost = installation.workerAccommodation ? workers * days * CALCULATION_CONSTANTS.ACCOMMODATION_PRICE_PER_DAY : 0;

        const totalInstallationCost = workerCost + equipmentCost + transportCost + accommodationCost;

        // Заполняем данные
        updateParamValue('workers', workers, 'чел');
        updateParamValue('days', days, 'дней');
        updateParamValue('worker-cost', workerCost, '₽');
        updateParamValue('equipment-cost', equipmentCost, '₽');
        updateParamValue('distance', distance, 'км');
        updateParamValue('transport-cost', transportCost, '₽');
        updateParamValue('accommodation-cost', accommodationCost, '₽');

        // Обновляем цену секции
        const sectionPrice = document.querySelector('.smeta-section:nth-child(2) .section-price');
        if (sectionPrice) {
            sectionPrice.textContent = formatPrice(totalInstallationCost);
        }
    }

    function displaySelectedFoundation(production, additionalOptions) {
        const foundationType = production.foundation;
        console.log('🏗️ Выбранный тип фундамента:', foundationType);
        
        // Скрываем все секции фундамента
        document.querySelectorAll('.foundation-section').forEach(section => {
            section.style.display = 'none';
        });

        // Показываем только выбранный тип
        const selectedSection = document.querySelector(`[data-foundation-type="${foundationType}"]`);
        if (selectedSection) {
            selectedSection.style.display = 'block';
            calculateAndDisplayFoundation(foundationType, production, additionalOptions);
            console.log('✅ Отображен фундамент:', foundationType);
        } else {
            console.log('❌ Секция фундамента не найдена для типа:', foundationType);
        }
    }

    function calculateAndDisplayFoundation(foundationType, production, additionalOptions) {
        const length = parseFloat(production.length) || 0;
        const width = parseFloat(production.width) || 0;
        const area = length * width;
        const perimeter = 2 * (length + width);

        let foundationCost = 0;

        switch (foundationType) {
            case 'slab':
                // Расчет для плиты
                const concreteVolume = area * 0.15; // 150мм толщина
                const concreteCost = concreteVolume * CALCULATION_CONSTANTS.CONCRETE_PRICE_PER_CUBIC_METER;
                const rebarWeight = area * 20; // 20 кг/м² арматуры
                const rebarCost = rebarWeight * CALCULATION_CONSTANTS.REBAR_PRICE_PER_KG;
                const formworkArea = perimeter * 0.3; // Примерная площадь опалубки
                const formworkCost = formworkArea * CALCULATION_CONSTANTS.FORMWORK_PRICE_PER_SQ_M;

                foundationCost = concreteCost + rebarCost + formworkCost;

                updateParamValue('concrete-volume', concreteVolume.toFixed(2), 'м³');
                updateParamValue('concrete-cost', concreteCost, '₽');
                updateParamValue('rebar-weight', rebarWeight, 'кг');
                updateParamValue('rebar-cost', rebarCost, '₽');
                updateParamValue('formwork-area', formworkArea.toFixed(2), 'м²');
                updateParamValue('formwork-cost', formworkCost, '₽');
                break;

            case 'piles':
                // Расчет для свай
                const pilesCount = Math.ceil(perimeter / 3); // Свая каждые 3 метра
                const pilesCost = pilesCount * CALCULATION_CONSTANTS.PILE_PRICE_PER_UNIT;
                const channelLength = perimeter;
                const channelCost = channelLength * CALCULATION_CONSTANTS.CHANNEL_PRICE_PER_M;

                foundationCost = pilesCost + channelCost;

                updateParamValue('piles-count', pilesCount, 'шт');
                updateParamValue('channel-length', channelLength, 'м');
                updateParamValue('piles-cost', pilesCost, '₽');
                updateParamValue('channel-cost', channelCost, '₽');
                break;

            case 'strip':
                // Расчет для ленточного фундамента
                const stripConcreteVolume = perimeter * 0.6 * 0.3; // Ширина 0.6м, высота 0.3м
                const stripConcreteCost = stripConcreteVolume * CALCULATION_CONSTANTS.CONCRETE_PRICE_PER_CUBIC_METER;
                const stripRebarWeight = perimeter * 15; // 15 кг/м арматуры
                const stripRebarCost = stripRebarWeight * CALCULATION_CONSTANTS.REBAR_PRICE_PER_KG;
                const stripFormworkArea = perimeter * 0.6;
                const stripFormworkCost = stripFormworkArea * CALCULATION_CONSTANTS.FORMWORK_PRICE_PER_SQ_M;

                foundationCost = stripConcreteCost + stripRebarCost + stripFormworkCost;

                updateParamValue('strip-concrete-volume', stripConcreteVolume.toFixed(2), 'м³');
                updateParamValue('strip-concrete-cost', stripConcreteCost, '₽');
                updateParamValue('strip-rebar-weight', stripRebarWeight, 'кг');
                updateParamValue('strip-rebar-cost', stripRebarCost, '₽');
                updateParamValue('strip-formwork-area', stripFormworkArea.toFixed(2), 'м²');
                updateParamValue('strip-formwork-cost', stripFormworkCost, '₽');
                break;
        }

        // Дополнительные работы
        const electricsCost = additionalOptions.electrics ? 25000 : 0;
        const insulationCost = additionalOptions.insulation ? 20000 : 0;
        const prepWorkCost = 15000;

        const totalFoundationCost = foundationCost + electricsCost + insulationCost + prepWorkCost;

        // Обновляем цены в подсекциях
        const foundationSubsections = document.querySelectorAll(`[data-foundation-type="${foundationType}"] .subsection`);
        if (foundationSubsections[0]) {
            const subsectionPrice = foundationSubsections[0].querySelector('.subsection-price');
            if (subsectionPrice) subsectionPrice.textContent = formatPrice(foundationCost);
        }
        if (foundationSubsections[1]) {
            const subsectionPrice = foundationSubsections[1].querySelector('.subsection-price');
            if (subsectionPrice) subsectionPrice.textContent = formatPrice(electricsCost);
        }
        if (foundationSubsections[2]) {
            const subsectionPrice = foundationSubsections[2].querySelector('.subsection-price');
            if (subsectionPrice) subsectionPrice.textContent = formatPrice(insulationCost);
        }
        if (foundationSubsections[3]) {
            const subsectionPrice = foundationSubsections[3].querySelector('.subsection-price');
            if (subsectionPrice) subsectionPrice.textContent = formatPrice(prepWorkCost);
        }

        // Обновляем общую цену секции
        const sectionPrice = document.querySelector(`[data-foundation-type="${foundationType}"] .section-price`);
        if (sectionPrice) {
            sectionPrice.textContent = formatPrice(totalFoundationCost);
        }
    }

    function calculateAndDisplayProfit(production) {
        const length = parseFloat(production.length) || 0;
        const width = parseFloat(production.width) || 0;
        const area = length * width;

        if (area === 0) {
            const section = document.querySelector('.smeta-section:last-child');
            if (section) section.style.display = 'none';
            return;
        }

        // Примерный расчет прибыли
        const productionCost = area * CALCULATION_CONSTANTS.PROFLE_SHEET_PRICE_PER_KG * 0.8;
        const installationCost = 350000;
        const foundationCost = 180000;

        const totalCost = productionCost + installationCost + foundationCost;
        const profit = totalCost * CALCULATION_CONSTANTS.PROFIT_MARGIN;
        const sellingPrice = totalCost + profit;

        updateParamValue('cost-per-m2', totalCost / area, '₽/м²');
        updateParamValue('total-cost', totalCost, '₽');
        updateParamValue('profit-per-m2', profit / area, '₽/м²');
        updateParamValue('total-profit', profit, '₽');

        const sectionPrice = document.querySelector('.smeta-section:last-child .section-price');
        if (sectionPrice) {
            sectionPrice.textContent = formatPrice(profit);
        }
    }

    function initUI() {
        console.log('🎨 Инициализация UI компонентов...');
        initCollapsibleSections();
        initActionButtons();
        initSearch();
        initModals();
        initSelectors();
        console.log('✅ UI компоненты инициализированы');
    }

    function initCollapsibleSections() {
        const sectionHeaders = document.querySelectorAll('.section-header');
        sectionHeaders.forEach(header => {
            header.addEventListener('click', function() {
                const section = this.closest('.smeta-section');
                section.classList.toggle('active');
            });
        });
        
        const subsectionHeaders = document.querySelectorAll('.subsection-header');
        subsectionHeaders.forEach(header => {
            header.addEventListener('click', function() {
                const subsection = this.closest('.subsection');
                subsection.classList.toggle('active');
            });
        });
    }

    function initActionButtons() {
        const shareBtn = document.querySelector('.share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', function() {
                document.getElementById('shareModal').classList.add('active');
            });
        }
        
        const editBtn = document.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', function() {
                window.location.href = `create_new_smeta.html?edit=true&id=${smetaId}`;
            });
        }
    }

    function initSearch() {
        const searchContainer = document.querySelector('.search-container');
        const searchInput = document.querySelector('.search-input');
        const searchClear = document.querySelector('.search-clear');
        
        if (searchClear) {
            searchClear.addEventListener('click', function() {
                searchInput.value = '';
                clearSearchHighlights();
                searchInput.focus();
            });
        }
        
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const searchTerm = this.value.trim().toLowerCase();
                if (searchTerm.length > 0) {
                    performSearch(searchTerm);
                } else {
                    clearSearchHighlights();
                }
            });
        }
    }

    function initModals() {
        const shareModal = document.getElementById('shareModal');
        const closeShareModal = document.getElementById('closeShareModal');
        const generateProposal = document.getElementById('generateProposal');
        const sendAsText = document.getElementById('sendAsText');
        
        const textPreviewModal = document.getElementById('textPreviewModal');
        const closeTextPreview = document.getElementById('closeTextPreview');
        const copyAllText = document.getElementById('copyAllText');
        
        if (closeShareModal) {
            closeShareModal.addEventListener('click', function() {
                shareModal.classList.remove('active');
            });
        }
        
        if (closeTextPreview) {
            closeTextPreview.addEventListener('click', function() {
                textPreviewModal.classList.remove('active');
            });
        }
        
        if (shareModal) {
            shareModal.addEventListener('click', function(e) {
                if (e.target === shareModal) {
                    shareModal.classList.remove('active');
                }
            });
        }
        
        if (textPreviewModal) {
            textPreviewModal.addEventListener('click', function(e) {
                if (e.target === textPreviewModal) {
                    textPreviewModal.classList.remove('active');
                }
            });
        }
        
        if (generateProposal) {
            generateProposal.addEventListener('click', function() {
                generateCommercialProposal();
                shareModal.classList.remove('active');
            });
        }
        
        if (sendAsText) {
            sendAsText.addEventListener('click', function() {
                showTextPreview();
                shareModal.classList.remove('active');
            });
        }
        
        if (copyAllText) {
            copyAllText.addEventListener('click', function() {
                copySmetaText();
            });
        }
    }

    function initSelectors() {
        const statusOptions = document.querySelectorAll('.status-option');
        statusOptions.forEach(option => {
            option.addEventListener('click', function() {
                const status = this.getAttribute('data-status');
                updateSmetaStatus(status);
            });
        });
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

    function updateParamValue(paramName, value, unit) {
        const element = document.querySelector(`[data-param="${paramName}"] .param-value`);
        if (element) {
            if (typeof value === 'number') {
                element.textContent = formatNumber(value);
            } else {
                element.textContent = value;
            }
            const unitElement = element.querySelector('.unit');
            if (unitElement) {
                unitElement.textContent = unit;
            }
        }
    }

    function formatNumber(value) {
        return new Intl.NumberFormat('ru-RU').format(value);
    }

    async function updateSmetaStatus(status) {
        try {
            const token = localStorage.getItem('userToken');
            
            if (!token) {
                throw new Error('Токен не найден');
            }

            const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.UPDATE_STATUS, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    id: smetaId,
                    status: status
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                updateStatusDisplay(status);
                showNotification(`Статус изменен на: "${getStatusText(status)}"`, 'success');
            } else {
                throw new Error(result.message || 'Ошибка обновления статуса');
            }
            
        } catch (error) {
            console.error('❌ Ошибка обновления статуса:', error);
            showNotification('Ошибка обновления статуса: ' + error.message, 'error');
        }
    }

    function updateStatusDisplay(status) {
        const statusOptions = document.querySelectorAll('.status-option');
        statusOptions.forEach(option => {
            option.classList.remove('active');
            if (option.getAttribute('data-status') === status) {
                option.classList.add('active');
            }
        });
    }

    function performSearch(searchTerm) {
        clearSearchHighlights();
        
        const searchableElements = document.querySelectorAll('.info-item, .param-item, .subsection-header, .section-header');
        
        searchableElements.forEach(element => {
            const text = element.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                element.style.backgroundColor = 'rgba(94, 123, 0, 0.1)';
                
                let currentElement = element;
                while (currentElement) {
                    if (currentElement.classList.contains('subsection')) {
                        currentElement.classList.add('active');
                        const section = currentElement.closest('.smeta-section');
                        if (section) section.classList.add('active');
                    }
                    if (currentElement.classList.contains('smeta-section')) {
                        currentElement.classList.add('active');
                    }
                    currentElement = currentElement.parentElement;
                }
            }
        });
    }

    function clearSearchHighlights() {
        document.querySelectorAll('.info-item, .param-item, .subsection-header, .section-header').forEach(el => {
            el.style.backgroundColor = '';
        });
    }

    function showTextPreview() {
        const text = formatSmetaAsText();
        document.getElementById('smetaTextContent').textContent = text;
        document.getElementById('textPreviewModal').classList.add('active');
    }

    function copySmetaText() {
        const text = document.getElementById('smetaTextContent').textContent;
        
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Текст сметы скопирован в буфер обмена!', 'success');
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Текст сметы скопирован в буфер обмена!', 'success');
        });
    }

    function generateCommercialProposal() {
        showNotification('Генерация коммерческого предложения...', 'info');
        // Здесь будет логика генерации КП
    }

    function formatSmetaAsText() {
        if (!currentSmeta) return 'Данные сметы не загружены';
        
        let text = `СМЕТА №${currentSmeta.id}\n`;
        text += `Дата формирования: ${new Date().toLocaleDateString('ru-RU')}\n`;
        text += `====================\n\n`;
        
        text += `ЗАКАЗЧИК:\n`;
        const customer = currentSmeta.customer || {};
        if (customer.company) text += `  Компания: ${customer.company}\n`;
        
        const contacts = customer.contacts || {};
        if (contacts.names) text += `  Контактное лицо: ${contacts.names.join(', ')}\n`;
        if (contacts.phones) text += `  Телефон: ${contacts.phones.join(', ')}\n`;
        if (contacts.emails) text += `  Email: ${contacts.emails.join(', ')}\n`;
        
        text += `\nОБЩИЕ СВЕДЕНИЯ:\n`;
        text += `  Статус: ${getStatusText(currentSmeta.status)}\n`;
        
        const production = currentSmeta.production || {};
        if (production.foundation) text += `  Тип фундамента: ${production.foundation}\n`;
        
        const prices = currentSmeta.calculated_prices || {};
        if (prices.total_with_vat) text += `  Итоговая стоимость (с НДС): ${formatPrice(prices.total_with_vat)}\n`;
        if (prices.total_without_vat) text += `  Итоговая стоимость (без НДС): ${formatPrice(prices.total_without_vat)}\n`;
        if (prices.price_per_m2) text += `  Стоимость м²: ${formatPrice(prices.price_per_m2)}/м²\n`;
        
        text += `\n====================\n`;
        text += `Сформировано в системе Corrx\n`;
        
        return text;
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close">×</button>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: 'Unbounded', sans-serif;
            font-size: 0.9rem;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        document.body.appendChild(notification);
        
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-state';
        errorDiv.innerHTML = `
            <div class="error-icon">⚠️</div>
            <h3>Ошибка</h3>
            <p>${message}</p>
            <button class="retry-btn" onclick="location.reload()">Повторить</button>
        `;
        
        document.querySelector('.view-main').innerHTML = '';
        document.querySelector('.view-main').appendChild(errorDiv);
    }

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

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function clearAuthData() {
        localStorage.removeItem('userToken');
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('user');
    }

    function redirectToLogin() {
        console.log('🔀 Перенаправление на страницу входа');
        window.location.href = 'login_page.html';
    }

    // ==================== СТИЛИ ДЛЯ АНИМАЦИЙ ====================
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .notification-close {
            background: none;
            border: none;
            color: white;
            font-size: 1.2rem;
            cursor: pointer;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
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
        
        .retry-btn {
            background: #5E7B00;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-family: 'Unbounded', sans-serif;
            margin-top: 20px;
        }
    `;
    document.head.appendChild(style);
});