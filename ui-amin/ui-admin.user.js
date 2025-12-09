// ==UserScript==
// @name         UI Admin Helper
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  Утилита для управления отображением архивных блоков в Django Admin
// @author       Mr Vi
// @match        https://app.hotellab.io/ru/AdminOnly/mainApp/hotels/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://github.com/mrvi0/hl-tempermonkey/raw/refs/heads/main/ui-amin/ui-admin.user.js
// @downloadURL  https://github.com/mrvi0/hl-tempermonkey/raw/refs/heads/main/ui-amin/ui-admin.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ===== CONFIGURATION =====
    const STORAGE_KEY = 'ui_admin_show_archived';
    const DEFAULT_SHOW_ARCHIVED = false; // По умолчанию скрываем архивные блоки
    const STORAGE_KEY_ROOM_CATEGORIES = 'ui_admin_show_room_categories';
    const DEFAULT_SHOW_ROOM_CATEGORIES = true; // По умолчанию показываем категории номеров
    const STORAGE_KEY_USERS = 'ui_admin_show_users';
    const DEFAULT_SHOW_USERS = true; // По умолчанию показываем пользователей
    const STORAGE_KEY_EMAIL_COLLAPSED = 'ui_admin_emailmessage_collapsed';
    const DEFAULT_EMAIL_COLLAPSED = false; // По умолчанию развернут
    
    // Конфигурация сворачиваемых блоков
    const COLLAPSIBLE_BLOCKS = [
        { id: 'id_emailmessage', storageKey: 'ui_admin_emailmessage_collapsed' },
        { id: 'id_pms_interface_reservations_config', storageKey: 'ui_admin_pms_interface_reservations_config_collapsed' },
        { id: 'id_pms_interface_config', storageKey: 'ui_admin_pms_interface_config_collapsed' },
        { id: 'id_report_config', storageKey: 'ui_admin_report_config_collapsed' },
        { id: 'id_custom_calendar_config', storageKey: 'ui_admin_custom_calendar_config_collapsed' },
        { id: 'id_extension', storageKey: 'ui_admin_extension_collapsed' },
        { id: 'id_travel_db_token', storageKey: 'ui_admin_travel_db_token_collapsed' },
        { id: 'id_pms_config', storageKey: 'ui_admin_pms_config_collapsed' },
        { id: 'id_blocks_config', storageKey: 'ui_admin_blocks_config_collapsed' },
        { id: 'id_statistics_config', storageKey: 'ui_admin_statistics_config_collapsed' }
    ];

    // ===== STYLES =====
    const styles = `
        /* Кнопка настроек */
        #ui-admin-settings-btn {
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 48px;
            height: 48px;
            background: #417690;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }

        #ui-admin-settings-btn:hover {
            background: #205067;
        }

        #ui-admin-settings-btn svg {
            width: 24px;
            height: 24px;
            fill: #fff;
        }

        /* Popup настроек */
        #ui-admin-popup {
            position: fixed;
            bottom: 80px;
            left: 20px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            padding: 20px;
            min-width: 280px;
            z-index: 10001;
            font-family: Arial, Helvetica, sans-serif;
            display: none;
        }

        #ui-admin-popup.visible {
            display: block;
        }

        #ui-admin-popup h3 {
            margin: 0 0 15px 0;
            padding: 0 0 10px 0;
            border-bottom: 1px solid #eee;
            font-size: 14px;
            font-weight: 600;
            color: #333;
        }

        .ui-admin-setting-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f0f0f0;
        }

        .ui-admin-setting-row:last-child {
            border-bottom: none;
        }

        .ui-admin-setting-label {
            font-size: 13px;
            color: #666;
            flex: 1;
        }

        .ui-admin-toggle-btn {
            width: 50px;
            height: 28px;
            background: #ccc;
            border: none;
            border-radius: 14px;
            cursor: pointer;
            position: relative;
            transition: background 0.3s;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .ui-admin-toggle-btn.active {
            background: #417690;
        }

        .ui-admin-toggle-btn svg {
            width: 18px;
            height: 18px;
            fill: #fff;
            transition: opacity 0.3s;
        }

        .ui-admin-toggle-btn .icon-eye {
            display: none;
        }

        .ui-admin-toggle-btn .icon-eye-off {
            display: inline-block;
        }

        .ui-admin-toggle-btn.active .icon-eye {
            display: inline-block;
        }

        .ui-admin-toggle-btn.active .icon-eye-off {
            display: none;
        }

        /* Overlay для закрытия popup */
        #ui-admin-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            display: none;
        }

        #ui-admin-overlay.visible {
            display: block;
        }

        /* Скрытие архивных блоков */
        .ui-admin-archived-hidden {
            display: none !important;
        }

        /* Скрытие блоков */
        .ui-admin-hidden {
            display: none !important;
        }

        /* Кнопка сворачивания блока */
        .ui-admin-collapse-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 2px 4px;
            margin-left: 8px;
            display: inline-flex;
            align-items: center;
            vertical-align: middle;
            color: #417690;
            transition: color 0.2s;
        }

        .ui-admin-collapse-btn:hover {
            color: #205067;
        }

        .ui-admin-collapse-btn svg {
            width: 16px;
            height: 16px;
            fill: currentColor;
            transition: transform 0.2s;
        }

        .ui-admin-collapse-btn.collapsed svg {
            transform: rotate(-90deg);
        }

    `;

    // ===== SVG ICONS =====
    const icons = {
        settings: `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
            </svg>
        `,
        eye: `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
        `,
        eyeOff: `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
            </svg>
        `,
        chevronDown: `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
            </svg>
        `
    };

    // ===== MAIN CODE =====
    
    function init() {
        // Добавляем стили
        GM_addStyle(styles);

        // Получаем сохраненные настройки
        const showArchived = GM_getValue(STORAGE_KEY, DEFAULT_SHOW_ARCHIVED);
        const showRoomCategories = GM_getValue(STORAGE_KEY_ROOM_CATEGORIES, DEFAULT_SHOW_ROOM_CATEGORIES);
        const showUsers = GM_getValue(STORAGE_KEY_USERS, DEFAULT_SHOW_USERS);

        // Создаем UI элементы
        createSettingsButton();
        createPopup();
        
        // Инициализируем состояние
        toggleArchivedBlocks(showArchived);
        toggleRoomCategories(showRoomCategories);
        toggleUsers(showUsers);
        
        // Инициализируем сворачивание блоков
        initCollapsibleBlocks();
    }

    function createSettingsButton() {
        const btn = document.createElement('button');
        btn.id = 'ui-admin-settings-btn';
        btn.innerHTML = icons.settings;
        btn.title = 'Настройки UI Admin';
        btn.addEventListener('click', togglePopup);
        document.body.appendChild(btn);
    }

    function createPopup() {
        // Overlay для закрытия по клику вне popup
        const overlay = document.createElement('div');
        overlay.id = 'ui-admin-overlay';
        overlay.addEventListener('click', closePopup);
        document.body.appendChild(overlay);

        // Popup
        const popup = document.createElement('div');
        popup.id = 'ui-admin-popup';
        
        const showArchived = GM_getValue(STORAGE_KEY, DEFAULT_SHOW_ARCHIVED);
        const showRoomCategories = GM_getValue(STORAGE_KEY_ROOM_CATEGORIES, DEFAULT_SHOW_ROOM_CATEGORIES);
        const showUsers = GM_getValue(STORAGE_KEY_USERS, DEFAULT_SHOW_USERS);
        
        popup.innerHTML = `
            <h3>Настройки</h3>
            <div class="ui-admin-setting-row">
                <span class="ui-admin-setting-label">Архивные сезоны</span>
                <button class="ui-admin-toggle-btn ${showArchived ? 'active' : ''}" data-setting="showArchived">
                    <span class="icon-eye">${icons.eye}</span>
                    <span class="icon-eye-off">${icons.eyeOff}</span>
                </button>
            </div>
            <div class="ui-admin-setting-row">
                <span class="ui-admin-setting-label">Категории номеров</span>
                <button class="ui-admin-toggle-btn ${showRoomCategories ? 'active' : ''}" data-setting="showRoomCategories">
                    <span class="icon-eye">${icons.eye}</span>
                    <span class="icon-eye-off">${icons.eyeOff}</span>
                </button>
            </div>
            <div class="ui-admin-setting-row">
                <span class="ui-admin-setting-label">Пользователи</span>
                <button class="ui-admin-toggle-btn ${showUsers ? 'active' : ''}" data-setting="showUsers">
                    <span class="icon-eye">${icons.eye}</span>
                    <span class="icon-eye-off">${icons.eyeOff}</span>
                </button>
            </div>
        `;

        // Обработчики переключения
        const toggleBtns = popup.querySelectorAll('.ui-admin-toggle-btn');
        toggleBtns.forEach(function(toggleBtn) {
            toggleBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const setting = this.getAttribute('data-setting');
                
                if (setting === 'showArchived') {
                    const newValue = !GM_getValue(STORAGE_KEY, DEFAULT_SHOW_ARCHIVED);
                    GM_setValue(STORAGE_KEY, newValue);
                    updateToggleButton(this, newValue);
                    toggleArchivedBlocks(newValue);
                } else if (setting === 'showRoomCategories') {
                    const newValue = !GM_getValue(STORAGE_KEY_ROOM_CATEGORIES, DEFAULT_SHOW_ROOM_CATEGORIES);
                    GM_setValue(STORAGE_KEY_ROOM_CATEGORIES, newValue);
                    updateToggleButton(this, newValue);
                    toggleRoomCategories(newValue);
                } else if (setting === 'showUsers') {
                    const newValue = !GM_getValue(STORAGE_KEY_USERS, DEFAULT_SHOW_USERS);
                    GM_setValue(STORAGE_KEY_USERS, newValue);
                    updateToggleButton(this, newValue);
                    toggleUsers(newValue);
                }
            });
        });

        document.body.appendChild(popup);
    }

    function updateToggleButton(toggleBtn, isActive) {
        if (toggleBtn) {
            if (isActive) {
                toggleBtn.classList.add('active');
            } else {
                toggleBtn.classList.remove('active');
            }
        }
    }

    function togglePopup(e) {
        e.stopPropagation();
        const popup = document.getElementById('ui-admin-popup');
        const overlay = document.getElementById('ui-admin-overlay');
        
        if (popup.classList.contains('visible')) {
            closePopup();
        } else {
            popup.classList.add('visible');
            overlay.classList.add('visible');
        }
    }

    function closePopup() {
        const popup = document.getElementById('ui-admin-popup');
        const overlay = document.getElementById('ui-admin-overlay');
        popup.classList.remove('visible');
        overlay.classList.remove('visible');
    }

    function toggleArchivedBlocks(showArchived) {
        // Находим все блоки с классом dynamic-hotelSeasonsConfigs
        const blocks = document.querySelectorAll('.inline-related.dynamic-hotelSeasonsConfigs');
        
        blocks.forEach(block => {
            // Ищем checkbox is_archived внутри блока
            const archivedCheckbox = block.querySelector('input[type="checkbox"][id*="-is_archived"]');
            
            if (archivedCheckbox && archivedCheckbox.checked) {
                if (showArchived) {
                    block.classList.remove('ui-admin-archived-hidden');
                } else {
                    block.classList.add('ui-admin-archived-hidden');
                }
            }
        });
    }

    function toggleRoomCategories(showRoomCategories) {
        // Находим блок категорий номеров
        const roomCategoriesBlock = document.getElementById('hotelRoomsTypesTrnsit-group');
        
        if (roomCategoriesBlock) {
            if (showRoomCategories) {
                roomCategoriesBlock.classList.remove('ui-admin-hidden');
                roomCategoriesBlock.style.display = '';
            } else {
                roomCategoriesBlock.classList.add('ui-admin-hidden');
                roomCategoriesBlock.style.display = 'none';
            }
        }
    }

    function toggleUsers(showUsers) {
        // Находим блок пользователей
        const usersBlock = document.getElementById('Hotels_owner-group');
        
        if (usersBlock) {
            if (showUsers) {
                usersBlock.classList.remove('ui-admin-hidden');
                usersBlock.style.display = '';
            } else {
                usersBlock.classList.add('ui-admin-hidden');
                usersBlock.style.display = 'none';
            }
        }
    }

    function initCollapsibleBlocks() {
        let initializedCount = 0;
        
        // Инициализируем все блоки из конфигурации
        COLLAPSIBLE_BLOCKS.forEach(function(blockConfig) {
            const blockId = blockConfig.id;
            
            // Ищем блок по разным селекторам
            let block = document.querySelector('.form-row.field-' + blockId.replace('id_', ''));
            
            // Если не нашли, пробуем найти по textarea ID
            if (!block) {
                const textarea = document.querySelector('textarea#' + blockId);
                if (textarea) {
                    block = textarea.closest('.form-row');
                }
            }
            
            // Если все еще не нашли, ищем любой блок с таким textarea
            if (!block) {
                const textarea = document.querySelector('textarea[id="' + blockId + '"]');
                if (textarea) {
                    // Ищем родительский form-row
                    let parent = textarea.parentElement;
                    while (parent && !parent.classList.contains('form-row')) {
                        parent = parent.parentElement;
                    }
                    block = parent;
                }
            }
            
            if (!block) {
                // Блок еще не загружен
                return;
            }
            
            // Проверяем, не добавлена ли уже кнопка
            if (block.querySelector('.ui-admin-collapse-btn[data-block-id="' + blockId + '"]')) {
                // Кнопка уже есть, обновляем состояние
                const collapseBtn = block.querySelector('.ui-admin-collapse-btn[data-block-id="' + blockId + '"]');
                const elementsToHide = getElementsToHideForBlock(block, blockId);
                
                if (elementsToHide.length > 0) {
                    const isCollapsed = GM_getValue(blockConfig.storageKey, false);
                    elementsToHide.forEach(el => {
                        if (el) el.style.display = isCollapsed ? 'none' : '';
                    });
                    collapseBtn.classList.toggle('collapsed', isCollapsed);
                }
                initializedCount++;
                return;
            }
            
            // Ищем label
            const label = block.querySelector('label[for="' + blockId + '"]');
            
            if (!label) {
                // Label еще не найден, попробуем позже
                return;
            }
            
            // Функция для получения всех элементов для скрытия
            function getElementsToHideForBlock(blockElement, elementId) {
                const elements = [];
                
                // Ищем textarea
                const textarea = blockElement.querySelector('textarea[id="' + elementId + '"]');
                if (textarea) {
                    elements.push(textarea);
                }
                
                // Ищем JSON editor контейнеры
                // Пробуем разные варианты ID для jsoneditor
                const editorId1 = elementId + '_jsoneditor';
                const editorId2 = elementId.replace('id_', 'id_') + '_jsoneditor';
                
                const editor1 = blockElement.querySelector('#' + editorId1);
                const editor2 = blockElement.querySelector('[id*="' + elementId + '"][id*="jsoneditor"]');
                const editor3 = blockElement.querySelector('.outer_jsoneditor');
                const editor4 = blockElement.querySelector('[id*="jsoneditor"]');
                
                if (editor1) elements.push(editor1);
                if (editor2 && !elements.includes(editor2)) elements.push(editor2);
                if (editor3 && !elements.includes(editor3)) elements.push(editor3);
                if (editor4 && !elements.includes(editor4)) elements.push(editor4);
                
                // Если ничего не найдено, пробуем скрыть все после label
                if (elements.length === 0) {
                    const parentDiv = label.closest('div');
                    if (parentDiv) {
                        let current = label.nextSibling;
                        while (current) {
                            if (current.nodeType === 1 && !current.classList.contains('ui-admin-collapse-btn')) {
                                elements.push(current);
                            }
                            current = current.nextSibling;
                        }
                    }
                }
                
                return elements;
            }
            
            const elementsToHide = getElementsToHideForBlock(block, blockId);
            
            // Создаем кнопку сворачивания
            const collapseBtn = document.createElement('button');
            collapseBtn.type = 'button';
            collapseBtn.className = 'ui-admin-collapse-btn';
            collapseBtn.setAttribute('data-block-id', blockId);
            collapseBtn.innerHTML = icons.chevronDown;
            collapseBtn.title = 'Свернуть/Развернуть';
            
            // Вставляем кнопку сразу после label
            label.insertAdjacentElement('afterend', collapseBtn);
            block.classList.add('ui-admin-collapse-initialized');
            
            // Загружаем сохраненное состояние
            const isCollapsed = GM_getValue(blockConfig.storageKey, false);
            
            if (isCollapsed && elementsToHide.length > 0) {
                collapseBtn.classList.add('collapsed');
                elementsToHide.forEach(el => {
                    if (el) el.style.display = 'none';
                });
            }
            
            // Обработчик клика
            collapseBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const currentElementsToHide = getElementsToHideForBlock(block, blockId);
                if (currentElementsToHide.length === 0) return;
                
                const firstElement = currentElementsToHide[0];
                const collapsed = firstElement ? firstElement.style.display === 'none' : false;
                
                if (collapsed) {
                    // Разворачиваем
                    currentElementsToHide.forEach(el => {
                        if (el) el.style.display = '';
                    });
                    collapseBtn.classList.remove('collapsed');
                    GM_setValue(blockConfig.storageKey, false);
                } else {
                    // Сворачиваем
                    currentElementsToHide.forEach(el => {
                        if (el) el.style.display = 'none';
                    });
                    collapseBtn.classList.add('collapsed');
                    GM_setValue(blockConfig.storageKey, true);
                }
            });
            
            initializedCount++;
        });
        
        return initializedCount > 0;
    }

    function observePageChanges() {
        // Отслеживаем изменения на странице (для динамически добавляемых элементов)
        const observer = new MutationObserver(function(mutations) {
            const showArchived = GM_getValue(STORAGE_KEY, DEFAULT_SHOW_ARCHIVED);
            
            // Проверяем, были ли изменения в структуре DOM или в checkbox'ах
            let shouldUpdate = false;
            
            mutations.forEach(function(mutation) {
                // Если добавились новые узлы
                if (mutation.addedNodes.length > 0) {
                    shouldUpdate = true;
                }
                
                // Если изменились атрибуты (например, checked у checkbox)
                if (mutation.type === 'attributes' && mutation.attributeName === 'checked') {
                    shouldUpdate = true;
                }
            });
            
            if (shouldUpdate) {
                // Небольшая задержка для обработки всех изменений
                setTimeout(function() {
                    const showArchived = GM_getValue(STORAGE_KEY, DEFAULT_SHOW_ARCHIVED);
                    const showRoomCategories = GM_getValue(STORAGE_KEY_ROOM_CATEGORIES, DEFAULT_SHOW_ROOM_CATEGORIES);
                    const showUsers = GM_getValue(STORAGE_KEY_USERS, DEFAULT_SHOW_USERS);
                    toggleArchivedBlocks(showArchived);
                    toggleRoomCategories(showRoomCategories);
                    toggleUsers(showUsers);
                    initCollapsibleBlocks();
                }, 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['checked']
        });

        // Дополнительный observer для сворачиваемых блоков
        const collapseObserver = new MutationObserver(function() {
            initCollapsibleBlocks();
        });
        
        collapseObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Также отслеживаем изменения checkbox'ов напрямую через события
        document.addEventListener('change', function(e) {
            if (e.target && e.target.type === 'checkbox' && e.target.id && e.target.id.includes('-is_archived')) {
                const showArchived = GM_getValue(STORAGE_KEY, DEFAULT_SHOW_ARCHIVED);
                toggleArchivedBlocks(showArchived);
            }
        });
        
        // Периодическая проверка для сворачиваемых блоков (fallback)
        let checkCount = 0;
        const maxChecks = 20; // 20 секунд
        
        const checkInterval = setInterval(function() {
            checkCount++;
            const emailBlock = document.querySelector('.form-row.field-emailmessage');
            const hasButton = emailBlock && emailBlock.querySelector('.ui-admin-collapse-btn');
            
            if (emailBlock && !hasButton) {
                initCollapsibleBlocks();
            }
            
            if (checkCount >= maxChecks || hasButton) {
                clearInterval(checkInterval);
            }
        }, 1000);
    }

    // Инициализация при загрузке страницы
    function initializeScript() {
        init();
        observePageChanges();
        
        // Пытаемся инициализировать сворачиваемые блоки с задержкой
        // на случай, если элементы загружаются динамически
        setTimeout(function() {
            initCollapsibleBlocks();
        }, 500);
        
        setTimeout(function() {
            initCollapsibleBlocks();
        }, 1500);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initializeScript();
        });
    } else {
        initializeScript();
    }

})();

