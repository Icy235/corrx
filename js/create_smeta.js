/**
 * ЛОГИКА ФОРМЫ СОЗДАНИЯ НОВОЙ СМЕТЫ
 * 
 * ФУНКЦИОНАЛ:
 * ✅ Динамические поля контактов (добавление/удаление)
 * ✅ Интеграция с Yandex Maps API для геолокации
 * ✅ Валидация формы перед отправкой
 * ✅ Отправка данных на новый API endpoint
 * ✅ Обработка ответов от сервера
 * 
 * СТРУКТУРА ФОРМЫ:
 * - Заказчик: компания, контакты (FIO, телефоны, emails)
 * - Производство: параметры ангара, фундамент, стены
 * - Монтаж: включение, оборудование, проживание, расстояние
 * - Доп. опции: утепление, электрика, сваи, особые пожелания
 * - Геолокация: адрес через Yandex Maps
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
        REQUEST_TIMEOUT: 10000
    };

    // Map variables
    let map = null;
    let placemark = null;
    let geocoder = null;
    let selectedAddress = '';
    let selectedCoords = null;

    // DOM elements
    const mapModal = document.getElementById('map-modal');
    const openMapBtn = document.getElementById('open-map-btn');
    const closeMapModal = document.getElementById('close-map-modal');
    const cancelMap = document.getElementById('cancel-map');
    const confirmLocation = document.getElementById('confirm-location');
    const addressInput = document.getElementById('address-input');
    const addressText = document.getElementById('address-text');
    const selectedAddressDiv = document.getElementById('selected-address');
    const mapSearchInput = document.getElementById('map-search-input');

    // Initialize the application
    initApp();

    function initApp() {
        initDropdowns();
        initToggles();
        initContactFields();
        initMapHandlers();
        initCreateButton();
        initSafeAreas();
        
        console.log('🚀 Форма создания сметы инициализирована');
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ КОМПОНЕНТОВ ====================

    function initDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown');
        
        dropdowns.forEach(dropdown => {
            const toggle = dropdown.querySelector('.dropdown-toggle');
            const menu = dropdown.querySelector('.dropdown-menu');
            
            toggle.addEventListener('click', function(e) {
                e.stopPropagation();
                dropdowns.forEach(otherDropdown => {
                    if (otherDropdown !== dropdown) {
                        otherDropdown.classList.remove('active');
                    }
                });
                dropdown.classList.toggle('active');
            });
            
            const items = menu.querySelectorAll('.dropdown-item');
            items.forEach(item => {
                item.addEventListener('click', function() {
                    const value = this.getAttribute('data-value');
                    const text = this.textContent.trim();
                    
                    // Обновляем текст и класс selected
                    const dropdownText = toggle.querySelector('.dropdown-text');
                    dropdownText.textContent = text;
                    dropdownText.setAttribute('data-selected-value', value); // Сохраняем значение
                    items.forEach(i => i.classList.remove('selected'));
                    this.classList.add('selected');
                    
                    // Убираем ошибку валидации
                    dropdown.classList.remove('invalid');
                    const errorMsg = dropdown.querySelector('.error-message');
                    if (errorMsg) errorMsg.remove();
                    
                    dropdown.classList.remove('active');
                });
            });
        });
        
        document.addEventListener('click', function() {
            dropdowns.forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        });
    }

    function initToggles() {
        const installationToggle = document.getElementById('installation-toggle');
        const installationExtra = document.getElementById('installation-extra');

        if (installationToggle && installationExtra) {
            installationToggle.addEventListener('change', function() {
                installationExtra.style.display = this.checked ? 'block' : 'none';
                if (!this.checked) {
                    document.getElementById('customer-equipment-toggle').checked = false;
                    document.getElementById('worker-accommodation-toggle').checked = false;
                }
            });
        }

        const specialRequestsToggle = document.getElementById('special-requests-toggle');
        const specialRequestsExtra = document.getElementById('special-requests-extra');

        if (specialRequestsToggle && specialRequestsExtra) {
            specialRequestsToggle.addEventListener('change', function() {
                specialRequestsExtra.style.display = this.checked ? 'block' : 'none';
            });
        }

        const geolocationToggle = document.getElementById('geolocation-toggle');
        const geolocationExtra = document.getElementById('geolocation-extra');

        if (geolocationToggle && geolocationExtra) {
            geolocationToggle.addEventListener('change', function() {
                geolocationExtra.style.display = this.checked ? 'block' : 'none';
                if (!this.checked) {
                    addressInput.value = '';
                    selectedAddress = '';
                    selectedCoords = null;
                    selectedAddressDiv.style.display = 'none';
                }
            });
        }
    }

    function initContactFields() {
        document.querySelectorAll('.add-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const type = this.getAttribute('data-type');
                addContactField(type, this);
            });
        });

        function addContactField(type, addButton) {
            const fieldConfig = {
                name: {
                    icon: 'assets/icons/user.svg',
                    placeholder: 'ФИО',
                    alt: 'ФИО'
                },
                phone: {
                    icon: 'assets/icons/phone.svg',
                    placeholder: 'Номер телефона',
                    alt: 'Телефон'
                },
                email: {
                    icon: 'assets/icons/mail.svg',
                    placeholder: 'Почта',
                    alt: 'Почта'
                }
            };

            const config = fieldConfig[type];
            if (!config) return;

            const currentField = addButton.closest('.contact-field');
            const newField = document.createElement('div');
            newField.className = 'contact-field additional-contact';
            newField.innerHTML = `
                <div class="input_container">
                    <img src="${config.icon}" alt="${config.alt}">
                    <input class="input_area" type="${type === 'email' ? 'email' : type === 'phone' ? 'tel' : 'text'}" placeholder="${config.placeholder}">
                    <button class="field-action-btn remove-btn" data-type="${type}">
                        <img src="assets/icons/trash.svg" alt="Удалить">
                    </button>
                </div>
            `;

            currentField.parentElement.insertBefore(newField, currentField.nextSibling);

            const newRemoveBtn = newField.querySelector('.remove-btn');
            newRemoveBtn.addEventListener('click', function() {
                newField.remove();
            });

            if (currentField.classList.contains('original-field')) {
                const currentAddBtn = currentField.querySelector('.add-btn');
                currentAddBtn.remove();
                
                const currentRemoveBtn = document.createElement('button');
                currentRemoveBtn.className = 'field-action-btn remove-btn';
                currentRemoveBtn.setAttribute('data-type', type);
                currentRemoveBtn.innerHTML = '<img src="assets/icons/trash.svg" alt="Удалить">';
                currentField.querySelector('.input_container').appendChild(currentRemoveBtn);

                currentRemoveBtn.addEventListener('click', function() {
                    const newOriginalField = document.createElement('div');
                    newOriginalField.className = 'contact-field original-field';
                    newOriginalField.setAttribute('data-type', type);
                    newOriginalField.innerHTML = `
                        <div class="input_container">
                            <img src="${config.icon}" alt="${config.alt}">
                            <input class="input_area" type="${type === 'email' ? 'email' : type === 'phone' ? 'tel' : 'text'}" placeholder="${config.placeholder}">
                            <button class="field-action-btn add-btn" data-type="${type}">
                                <img src="assets/icons/add.svg" alt="Добавить">
                            </button>
                        </div>
                    `;

                    currentField.parentElement.insertBefore(newOriginalField, currentField);
                    currentField.remove();

                    const newAddBtn = newOriginalField.querySelector('.add-btn');
                    newAddBtn.addEventListener('click', function() {
                        addContactField(type, this);
                    });
                });
            }
        }
    }

    // ==================== КАРТА И ГЕОЛОКАЦИЯ ====================

    function initMapHandlers() {
        openMapBtn.addEventListener('click', function() {
            mapModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            initYandexMap();
        });

        closeMapModal.addEventListener('click', closeMapModalHandler);
        cancelMap.addEventListener('click', closeMapModalHandler);

        confirmLocation.addEventListener('click', function() {
            if (selectedAddress && selectedCoords) {
                addressInput.value = selectedAddress;
                closeMapModalHandler();
            } else {
                showToast('Выберите местоположение на карте', 'error');
            }
        });

        mapSearchInput.addEventListener('input', debounce(function(e) {
            const query = e.target.value.trim();
            if (query.length > 2) {
                searchAddress(query);
            }
        }, 500));
    }

    function closeMapModalHandler() {
        mapModal.style.display = 'none';
        document.body.style.overflow = '';
        if (placemark && map) {
            map.geoObjects.remove(placemark);
            placemark = null;
        }
        selectedAddress = '';
        selectedCoords = null;
        selectedAddressDiv.style.display = 'none';
        confirmLocation.disabled = true;
        mapSearchInput.value = '';
    }

    function initYandexMap() {
        if (typeof ymaps === 'undefined') {
            console.error('Yandex Maps API not loaded');
            showToast('Ошибка загрузки карт', 'error');
            return;
        }

        ymaps.ready(() => {
            geocoder = ymaps.geocode;

            if (!map) {
                map = new ymaps.Map('yandex-map', {
                    center: [59.939095, 30.315868],
                    zoom: 10,
                    controls: ['zoomControl', 'fullscreenControl']
                });

                map.events.add('click', function(e) {
                    const coords = e.get('coords');
                    selectedCoords = coords;
                    getAddressByCoords(coords);
                    
                    if (!placemark) {
                        placemark = createPlacemark(coords);
                        map.geoObjects.add(placemark);
                    } else {
                        placemark.geometry.setCoordinates(coords);
                    }
                });
            } else {
                map.setCenter([59.939095, 30.315868], 10);
            }
        });
    }

    function createPlacemark(coords) {
        return new ymaps.Placemark(coords, {
            balloonContent: 'Выбранное местоположение'
        }, {
            preset: 'islands#icon',
            iconColor: '#5E7B00',
            draggable: true
        });
    }

    function getAddressByCoords(coords) {
        if (!geocoder) return;

        geocoder(coords).then(function(res) {
            const firstGeoObject = res.geoObjects.get(0);
            if (firstGeoObject) {
                selectedAddress = firstGeoObject.getAddressLine();
                updateSelectedAddress(selectedAddress);
                
                if (placemark) {
                    placemark.properties.set('balloonContent', selectedAddress);
                }
                
                confirmLocation.disabled = false;
            }
        }).catch(error => {
            console.error('Geocoding error:', error);
            selectedAddress = `Координаты: ${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
            updateSelectedAddress(selectedAddress);
            confirmLocation.disabled = false;
        });
    }

    function searchAddress(query) {
        if (!geocoder) return;

        geocoder(query).then(function(res) {
            const geoObjects = res.geoObjects;
            if (geoObjects.getLength() > 0) {
                const firstObject = geoObjects.get(0);
                const coords = firstObject.geometry.getCoordinates();
                const address = firstObject.getAddressLine();
                
                selectedCoords = coords;
                selectedAddress = address;
                
                updateSelectedAddress(address);
                
                if (!placemark) {
                    placemark = createPlacemark(coords);
                    map.geoObjects.add(placemark);
                } else {
                    placemark.geometry.setCoordinates(coords);
                    placemark.properties.set('balloonContent', address);
                }
                
                map.setCenter(coords, 15, { checkZoomRange: true });
                confirmLocation.disabled = false;
            }
        }).catch(error => {
            console.error('Search address error:', error);
            showToast('Ошибка поиска адреса', 'error');
        });
    }

    function updateSelectedAddress(address) {
        addressText.textContent = address;
        selectedAddressDiv.style.display = 'block';
        const modalBody = document.querySelector('.modal-body');
        modalBody.scrollTop = modalBody.scrollHeight;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ==================== СОЗДАНИЕ СМЕТЫ ====================

    function initCreateButton() {
        const createBtn = document.querySelector('.create-btn');
        createBtn.addEventListener('click', async function() {
            if (!validateForm()) {
                showToast('Пожалуйста, заполните все обязательные поля', 'error');
                return;
            }

            const formData = collectFormData();
            
            try {
                const token = localStorage.getItem('userToken');
                
                if (!token) {
                    showToast('Ошибка авторизации. Пожалуйста, войдите снова.', 'error');
                    setTimeout(() => {
                        window.location.href = 'login_page.html?session=expired';
                    }, 2000);
                    return;
                }

                console.log('🌐 Отправка сметы на сервер:', JSON.stringify(formData));

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

                const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.CREATE_SMETA, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(formData),
                    credentials: 'include', // Добавлено для передачи куки
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                console.log('📥 Ответ от сервера:', response.status, response.statusText);

                if (response.status === 401) {
                    throw new Error('Токен недействителен. Пожалуйста, войдите снова.');
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                console.log('📊 Результат создания:', result);
                
                if (result.success) {
                    showToast('Смета успешно создана!', 'success');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1500);
                } else {
                    throw new Error(result.message || 'Ошибка при создании сметы');
                }
            } catch (error) {
                console.error('❌ Ошибка:', error);
                showToast(error.message || 'Ошибка при сохранении сметы', 'error');
                
                if (error.message.includes('токен') || error.message.includes('авторизац') || error.message.includes('401')) {
                    setTimeout(() => {
                        window.location.href = 'login_page.html?session=expired';
                    }, 2000);
                }
                logErrorToServer(error, 'createSmeta');
            }
        });
    }




    // Функция для пометки поля как некорректного и отображения сообщения об ошибке
    function markInvalid(element, message) {
        if (!element) return;
        element.classList.add('invalid');
        
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = message;
        
        element.parentNode.insertBefore(errorMessage, element.nextSibling);
    }

    // ==================== ВАЛИДАЦИЯ ФОРМЫ ====================

   function validateForm() {
        let isValid = true;
        
        document.querySelectorAll('.invalid').forEach(el => {
            el.classList.remove('invalid');
        });
        document.querySelectorAll('.error-message').forEach(el => {
            el.remove();
        });

        // Validate company
        const companyInput = document.querySelector('.input_area[placeholder="Компания *"]');
        if (!companyInput?.value.trim()) {
            markInvalid(companyInput.closest('.input_container'), 'Компания обязательна для заполнения');
            isValid = false;
        }

        // Validate length
        const lengthInput = document.querySelector('.input_area[placeholder="Длина ангара *"]');
        if (!lengthInput?.value.trim() || isNaN(lengthInput.value) || parseFloat(lengthInput.value) <= 0) {
            markInvalid(lengthInput.closest('.input_container'), 'Введите корректную длину ангара');
            isValid = false;
        }

        // Validate dropdowns
        const dropdownsToValidate = [
            { selector: '[data-dropdown="width"]', name: 'Ширина пролета', requireNumeric: true },
            { selector: '[data-dropdown="foundation"]', name: 'Тип фундамента', requireNumeric: false },
            { selector: '[data-dropdown="walls"]', name: 'Торцевые стены', requireNumeric: false }
        ];

        dropdownsToValidate.forEach(({ selector, name, requireNumeric }) => {
            const dropdown = document.querySelector(selector)?.closest('.dropdown');
            if (!dropdown) {
                showToast(`Ошибка: не найден dropdown для ${name}`, 'error');
                isValid = false;
                return;
            }
            const selectedItem = dropdown.querySelector('.dropdown-menu .dropdown-item.selected');
            const dropdownText = dropdown.querySelector('.dropdown-text');
            if (!selectedItem || !dropdownText.textContent.trim() || dropdownText.textContent === `${name} *`) {
                markInvalid(dropdown, `${name} обязателен для заполнения`);
                isValid = false;
            } else if (requireNumeric) {
                const value = parseFloat(selectedItem.getAttribute('data-value'));
                if (isNaN(value) || value <= 0) {
                    markInvalid(dropdown, `${name} должен быть положительным числом`);
                    isValid = false;
                }
            }
        });

        // Validate geolocation if enabled
        const geolocationToggle = document.getElementById('geolocation-toggle');
        if (geolocationToggle?.checked && !selectedAddress) {
            markInvalid(document.getElementById('geolocation-extra'), 'Выберите адрес на карте');
            isValid = false;
        }

        return isValid;
    }

    // ==================== СБОР ДАННЫХ ФОРМЫ ====================

   function collectFormData() {
        const contacts = {
            names: [],
            phones: [],
            emails: []
        };

        document.querySelectorAll('.contact-field').forEach(field => {
            const input = field.querySelector('.input_area');
            const placeholder = input.placeholder;
            const value = input.value.trim();
            
            if (value) {
                if (placeholder.includes('ФИО')) contacts.names.push(value);
                else if (placeholder.includes('телефона')) contacts.phones.push(value);
                else if (placeholder.includes('Почта')) contacts.emails.push(value);
            }
        });

        const installationToggle = document.getElementById('installation-toggle');
        const customerEquipmentToggle = document.getElementById('customer-equipment-toggle');
        const workerAccommodationToggle = document.getElementById('worker-accommodation-toggle');
        const insulationToggle = document.getElementById('insulation-toggle');
        const electricsToggle = document.getElementById('electrics-toggle');
        const pilesToggle = document.getElementById('piles-toggle');
        const specialRequestsToggle = document.getElementById('special-requests-toggle');
        const geolocationToggle = document.getElementById('geolocation-toggle');

        const specialRequestsText = document.querySelector('#special-requests-extra textarea')?.value.trim() || '';

        const distanceInput = document.querySelector('.input_area[placeholder="Расстояние до базы"]');
        const distance = distanceInput ? parseFloat(distanceInput.value) || '' : '';

        // Извлечение значений для width (число), foundation и walls (строки)
        const widthDropdown = document.querySelector('[data-dropdown="width"] .dropdown-text');
        const foundationDropdown = document.querySelector('[data-dropdown="foundation"] .dropdown-text');
        const wallsDropdown = document.querySelector('[data-dropdown="walls"] .dropdown-text');

        return {
            customer: {
                company: document.querySelector('.input_area[placeholder="Компания *"]').value.trim(),
                contacts: contacts
            },
            production: {
                length: parseFloat(document.querySelector('.input_area[placeholder="Длина ангара *"]').value) || 0,
                width: widthDropdown && widthDropdown.getAttribute('data-selected-value') ? parseFloat(widthDropdown.getAttribute('data-selected-value')) : 0,
                foundation: foundationDropdown && foundationDropdown.textContent.trim() !== 'Тип фундамента *' ? foundationDropdown.textContent.trim() : '',
                walls: wallsDropdown && wallsDropdown.textContent.trim() !== 'Торцевые стены *' ? wallsDropdown.textContent.trim() : ''
            },
            installation: {
                enabled: installationToggle ? installationToggle.checked : false,
                customerEquipment: customerEquipmentToggle ? customerEquipmentToggle.checked : false,
                workerAccommodation: workerAccommodationToggle ? workerAccommodationToggle.checked : false,
                distance: distance
            },
            additional_options: {
                insulation: insulationToggle ? insulationToggle.checked : false,
                electrics: electricsToggle ? electricsToggle.checked : false,
                piles: pilesToggle ? pilesToggle.checked : false,
                specialRequests: {
                    enabled: specialRequestsToggle ? specialRequestsToggle.checked : false,
                    text: specialRequestsText
                }
            },
            geolocation: {
                enabled: geolocationToggle ? geolocationToggle.checked : false,
                address: addressInput.value.trim(),
                coords: selectedCoords || null
            }
        };
    }
    // ==================== ЛОГИРОВАНИЕ ОШИБОК ====================

    async function logErrorToServer(error, context) {
        try {
            const token = localStorage.getItem('userToken');
            const errorData = {
                message: error.message,
                stack: error.stack || 'Отсутствует',
                context: context,
                url: window.location.href,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            };

            await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.LOG_ERROR, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(errorData),
                credentials: 'include'
            });
        } catch (e) {
            console.error('❌ Ошибка логирования на сервер:', e);
        }
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: 'Unbounded', sans-serif;
            font-size: 0.9rem;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

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
        
        .error-message {
            color: #e74c3c;
            font-size: 0.8rem;
            margin-top: 5px;
            padding: 0 10px;
        }
        
        .input_container.invalid {
            border-color: #e74c3c !important;
            box-shadow: 0 0 0 2px rgba(231, 76, 60, 0.1) !important;
        }
        
        .dropdown.invalid .dropdown-toggle {
            border-color: #e74c3c !important;
            box-shadow: 0 0 0 2px rgba(231, 76, 60, 0.1) !important;
        }
    `;
    document.head.appendChild(style);
});