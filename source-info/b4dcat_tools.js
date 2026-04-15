// ==UserScript==
// @name         HotelLab Rate Shopper & Calendar Enhancement (B4DCAT TOOLS)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Adds provider labels (T/B/O) to Rate Shopper (header, popover) and Calendar (next to competitor prices). Integrates controls.
// @author       Mr Vi
// @match        https://app.hotellab.ru/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mrvi0/hl-tempermonkey/main/source-info/b4dcat_tools.js
// @downloadURL  https://raw.githubusercontent.com/mrvi0/hl-tempermonkey/main/source-info/b4dcat_tools.js
// ==/UserScript==

(function() {
    'use strict';

    // настройки
    let DEBUG = false;
    let labelsVisible = true;
    let popoverLabelsVisible = true;
    let calendarLabelsVisible = true;

    // константы
    const MAX_ATTEMPTS_HEADER = 15;
    const MAX_ATTEMPTS_CALENDAR = 10;
    const SCRIPT_MENU_ITEM_CLASS = 'hotellab-script-menu-item';
    const SCRIPT_GROUP_ID = 'b4dcat-tools-group';
    const SCRIPT_GROUP_TITLE = 'B4DCAT TOOLS';
    const SETTINGS_ICON_CLICK_TARGET_SELECTOR = 'div[role="menuitem"][data-menu-id*="settings"]';
    const MENU_POPUP_SELECTOR = 'div.ant-menu-submenu-popup.ant-menu-light';
    const MENU_CHECK_DELAY_AFTER_CLICK = 300;
    const COMPETITOR_POPOVER_SELECTOR = 'div.ant-popover:has(div.competitors-table)';
    const POPOVER_LABEL_CLASS = 'popover-provider-label';
    const CALENDAR_LABEL_CLASS = 'calendar-provider-label';
    const CALENDAR_TABLE_BODY_SELECTOR = '.main-content .ant-table-tbody';

    // состояние
    let rateShopperHotelData = {};
    let calendarCompetitorData = {};
    let headerApplicationAttempts = 0;
    let calendarApplicationAttempts = 0;
    let isApplyingHeaderLabels = false;
    let isApplyingCalendarLabels = false;
    let menuGroupAdded = false;
    let settingsIconListenerAdded = false;

    // убираем пробелы из названий отелей
    function normalizeHotelName(name) {
        return name ? name.replace(/\s+$/, '') : '';
    }

    function debugLog(...args) {
        if (DEBUG) { console.log('[B4DCAT TOOLS v2.0]', ...args); }
    }

    debugLog('Скрипт запущен');

    // стили для меток
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .provider-label { display: inline-block; margin-left: 5px; padding: 1px 4px; border-radius: 3px; font-size: 10px; font-weight: bold; vertical-align: middle; }
        .provider-tl { background-color: #a8d1ff; color: #0057b8; }
        .provider-b { background-color: #b3c6ff; color: #0011aa; }
        .provider-o { background-color: #b3ffb3; color: #006600; }
        .${POPOVER_LABEL_CLASS} { display: inline-block; font-weight: bold; font-size: 10px; color: #fff; border-radius: 2px; padding: 0px 3px; margin-right: 4px; line-height: 1.2; vertical-align: middle; }
        .${POPOVER_LABEL_CLASS}-T { background-color: #52a3ff; }
        .${POPOVER_LABEL_CLASS}-B { background-color: #0011aa; }
        .${POPOVER_LABEL_CLASS}-O { background-color: #00b899; }
        .${CALENDAR_LABEL_CLASS} { display: inline-block; font-weight: bold; font-size: 9px; color: #fff; border-radius: 2px; padding: 0px 2px; margin-right: 3px; line-height: 1.1; vertical-align: text-bottom; opacity: 0.85; }
        .${CALENDAR_LABEL_CLASS}-T { background-color: #52a3ff; }
        .${CALENDAR_LABEL_CLASS}-B { background-color: #0011aa; }
        .${CALENDAR_LABEL_CLASS}-O { background-color: #00b899; }
        .${SCRIPT_MENU_ITEM_CLASS} .ant-menu-title-content span[id^="hotellab-"] { cursor: pointer; display: inline-block; width: 100%; }
        .${SCRIPT_MENU_ITEM_CLASS}.hotellab-status-item .ant-menu-title-content span { cursor: default; opacity: 0.8; font-size: 11px; white-space: normal; }
        li.${SCRIPT_MENU_ITEM_CLASS}.hotellab-status-item { margin-top: 5px; padding-top: 4px !important; padding-bottom: 4px !important; border-top: 1px solid #f0f0f0; height: auto !important; }
        #${SCRIPT_GROUP_ID} .ant-menu-item-group-title { color: #5553CE; text-transform: uppercase; }
        #${SCRIPT_GROUP_ID} .ant-menu-item-group-title svg { margin-right: 8px; vertical-align: middle; }
    `;
    document.head.appendChild(styleElement);

    // обработка данных Rate Shopper
    function processRateShopperResponse(data) {
        const currentHotelData = {}; let hotelsProcessed = 0;
        if (Array.isArray(data?.data?.categories_data)) {
            data.data.categories_data.forEach(category => {
                const categoryData = category.data;
                if (categoryData && typeof categoryData === 'object') {
                    Object.values(categoryData).forEach(dateData => {
                        if (dateData?.competitors && Array.isArray(dateData.competitors)) {
                            dateData.competitors.forEach(competitor => {
                                if (competitor.id && competitor.name) {
                                    const normalizedName = normalizeHotelName(competitor.name);
                                    if (normalizedName && !currentHotelData[normalizedName]) {
                                        let providerType = 'o';
                                        if (competitor.id.startsWith('travelline_')) providerType = 'tl';
                                        else if (competitor.id.startsWith('bnovo_')) providerType = 'b';
                                        currentHotelData[normalizedName] = { id: competitor.id, providerType: providerType };
                                        hotelsProcessed++;
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
        if (hotelsProcessed > 0) {
            rateShopperHotelData = currentHotelData;
            debugLog(`Rate Shopper данные обновлены. Отелей: ${Object.keys(rateShopperHotelData).length}`);
            headerApplicationAttempts = 0;
            applyHeaderLabelsWithRetry();
            applyLabelsToVisiblePopovers();
        }
    }

    // добавление меток в заголовки таблицы
    function applyHeaderLabelsToTable() {
        if (isApplyingHeaderLabels) return false;
        isApplyingHeaderLabels = true;
        try {
            if (!labelsVisible) { 
                document.querySelectorAll('.provider-label').forEach(label => label.remove()); 
                updateScriptStatus(); 
                isApplyingHeaderLabels = false; 
                return true; 
            }
            const allHeaders = document.querySelectorAll('.ant-table-thead th');
            if (allHeaders.length === 0) { 
                updateScriptStatus('Заголовки Rate Shopper не найдены'); 
                isApplyingHeaderLabels = false; 
                return false; 
            }
            let labelsAppliedCount = 0; 
            let headersProcessedCount = 0; 
            const processedTexts = new Set(); 
            const columnsToSkip = ['Дата', 'Отклонение от медианы', 'Текущая цена', 'Медиана конкурентов', 'Средняя цена', 'Действие', ''];
            
            allHeaders.forEach(headerCell => {
                const existingLabel = headerCell.querySelector('.provider-label'); 
                if (existingLabel) { existingLabel.remove(); }
                
                let hotelName = headerCell.textContent?.trim(); 
                if (!hotelName || columnsToSkip.includes(hotelName) || hotelName.includes('%')) return;
                
                const normalizedHotelName = normalizeHotelName(hotelName);
                if (processedTexts.has(normalizedHotelName)) return; // пропускаем дубликаты
                
                headersProcessedCount++; 
                processedTexts.add(normalizedHotelName);
                
                const hotelData = rateShopperHotelData[normalizedHotelName];
                
                if (hotelData) {
                    const providerType = hotelData.providerType;
                    const label = document.createElement('span'); 
                    label.className = `provider-label provider-${providerType}`; 
                    label.textContent = providerType === 'b' ? 'bnovo' : providerType.toUpperCase();
                    const innerContent = headerCell.querySelector('.ant-table-column-title, div:not([class]) > span'); 
                    (innerContent || headerCell).appendChild(label);
                    labelsAppliedCount++;
                } else {
                    debugLog(`Отель не найден в данных: "${hotelName}" (нормализованное: "${normalizedHotelName}")`);
                }
            });
            
            updateScriptStatus();
            if (headersProcessedCount > 0 && labelsAppliedCount === 0 && Object.keys(rateShopperHotelData).length > 0) { 
                debugLog('ВНИМАНИЕ: Заголовки найдены, но метки не добавлены.'); 
            }
            isApplyingHeaderLabels = false; 
            return true;
        } catch (error) { 
            console.error('[B4DCAT TOOLS] Ошибка добавления меток в заголовки:', error); 
            updateScriptStatus('Ошибка добавления меток в заголовки'); 
            isApplyingHeaderLabels = false; 
            return false; 
        }
    }

    // повторные попытки добавления меток в заголовки
    function applyHeaderLabelsWithRetry() {
        if (Object.keys(rateShopperHotelData).length === 0 && headerApplicationAttempts === 0) { 
            updateScriptStatus('Ожидание данных Rate Shopper...'); 
            return; 
        }
        if (headerApplicationAttempts >= MAX_ATTEMPTS_HEADER) { 
            debugLog('Достигнуто максимальное количество попыток для заголовков.'); 
            updateScriptStatus(`Макс попыток заголовков (${MAX_ATTEMPTS_HEADER})`); 
            return; 
        }
        headerApplicationAttempts++;
        requestAnimationFrame(() => {
            const success = applyHeaderLabelsToTable();
            if (!success && document.querySelector('.ant-table-thead th') === null && headerApplicationAttempts < MAX_ATTEMPTS_HEADER) {
                const delay = Math.min(1000, 200 * headerApplicationAttempts);
                debugLog(`Заголовки Rate Shopper не найдены. Повтор через ${delay}мс...`);
                setTimeout(applyHeaderLabelsWithRetry, delay);
            } else { 
                updateScriptStatus(); 
            }
        });
    }

    // обработка данных календаря
    function processNewCalendarResponse(data) {
        const currentCompetitorData = {}; 
        let competitorsProcessed = 0;
        if (Array.isArray(data?.data?.categories_data)) {
            data.data.categories_data.forEach(category => {
                if (category?.data && typeof category.data === 'object') {
                    Object.values(category.data).forEach(dateData => {
                        if (dateData?.competitors && Array.isArray(dateData.competitors)) {
                            dateData.competitors.forEach(competitor => {
                                if (competitor.id && !currentCompetitorData[competitor.id]) {
                                    let providerType = 'O';
                                    if (competitor.id.startsWith('travelline_')) providerType = 'T';
                                    else if (competitor.id.startsWith('bnovo_')) providerType = 'B';
                                    const normalizedName = normalizeHotelName(competitor.name);
                                    currentCompetitorData[competitor.id] = { name: normalizedName, providerType: providerType };
                                    competitorsProcessed++;
                                }
                            });
                        }
                    });
                }
            });
        }
        if (competitorsProcessed > 0) {
            calendarCompetitorData = currentCompetitorData;
            debugLog(`Данные календаря обновлены. Конкурентов: ${Object.keys(calendarCompetitorData).length}`);
            calendarApplicationAttempts = 0;
            applyCalendarLabelsWithRetry();
        } else {
            debugLog("Данные конкурентов в ответе календаря не найдены.");
        }
    }

    // добавление меток в календарь
    function applyLabelsToCalendarTable() {
        if (isApplyingCalendarLabels) return false;
        isApplyingCalendarLabels = true;
        try {
            if (!calendarLabelsVisible) {
                document.querySelectorAll(`.${CALENDAR_LABEL_CLASS}`).forEach(label => label.remove());
                updateScriptStatus(); 
                isApplyingCalendarLabels = false; 
                return true;
            }
            const tableBody = document.querySelector(CALENDAR_TABLE_BODY_SELECTOR);
            if (!tableBody) { 
                updateScriptStatus('Тело таблицы календаря не найдено'); 
                isApplyingCalendarLabels = false; 
                return false; 
            }

            let labelsApplied = 0;
            const priceSpans = tableBody.querySelectorAll('td.ignore span.ant-typography');

            priceSpans.forEach(priceSpan => {
                let competitorId = null;
                const cell = priceSpan.closest('td');
                const ellipsisButton = cell?.querySelector('button .anticon-ellipsis');
                const tooltipTrigger = ellipsisButton?.closest('button') || cell;

                const tooltipId = tooltipTrigger?.getAttribute('aria-describedby');
                if (tooltipId) {
                    const tooltipContent = document.getElementById(tooltipId)?.textContent;
                }
                
                if (!competitorId) {
                    const parentWithKey = priceSpan.closest('[data-competitor-id]');
                    if (parentWithKey) competitorId = parentWithKey.dataset.competitorId;
                }

                if (!competitorId) return;

                const priceBlock = priceSpan.closest('.price-block') || priceSpan.parentElement;
                priceBlock?.querySelector(`.${CALENDAR_LABEL_CLASS}`)?.remove();

                const competitorInfo = calendarCompetitorData[competitorId];
                let providerLetter = 'O';
                if (competitorInfo) {
                    if (competitorInfo.providerType === 'T') providerLetter = 'T';
                    else if (competitorInfo.providerType === 'B') providerLetter = 'B';
                } else {
                    debugLog(`Данные календаря не найдены для ID: ${competitorId}`);
                }

                const labelSpan = document.createElement('span');
                labelSpan.className = `${CALENDAR_LABEL_CLASS} ${CALENDAR_LABEL_CLASS}-${providerLetter}`;
                labelSpan.textContent = providerLetter;
                priceSpan.parentNode.insertBefore(labelSpan, priceSpan);
                labelsApplied++;
            });

            debugLog(`Добавлено ${labelsApplied} меток в календарь.`);
            updateScriptStatus();
            isApplyingCalendarLabels = false;
            return true;
        } catch (error) {
            console.error('[B4DCAT TOOLS] Ошибка добавления меток в календарь:', error);
            updateScriptStatus('Ошибка добавления меток в календарь');
            isApplyingCalendarLabels = false; 
            return false;
        }
    }

    // повторные попытки добавления меток в календарь
    function applyCalendarLabelsWithRetry() {
        if (Object.keys(calendarCompetitorData).length === 0 && calendarApplicationAttempts === 0) { 
            updateScriptStatus('Ожидание данных календаря...'); 
            return; 
        }
        if (calendarApplicationAttempts >= MAX_ATTEMPTS_CALENDAR) { 
            debugLog('Достигнуто максимальное количество попыток для календаря.'); 
            updateScriptStatus(`Макс попыток календаря (${MAX_ATTEMPTS_CALENDAR})`); 
            return; 
        }
        calendarApplicationAttempts++;
        requestAnimationFrame(() => {
            const success = applyLabelsToCalendarTable();
            if (!success && document.querySelector(CALENDAR_TABLE_BODY_SELECTOR) === null && calendarApplicationAttempts < MAX_ATTEMPTS_CALENDAR) {
                const delay = Math.min(1000, 300 * calendarApplicationAttempts);
                debugLog(`Тело таблицы календаря не найдено. Повтор через ${delay}мс...`);
                setTimeout(applyCalendarLabelsWithRetry, delay);
            } else { 
                updateScriptStatus(); 
            }
        });
    }

    // добавление меток в попапы
    function applyLabelsToPopover(popoverElement) {
        if (!popoverLabelsVisible || !popoverElement) return;
        const tableRows = popoverElement.querySelectorAll('.competitors-table tbody tr[data-row-key]');
        if (tableRows.length === 0) return;
        tableRows.forEach(row => {
            const nameCell = row.querySelector('td:first-child');
            const rowKey = row.dataset.rowKey;
            if (!nameCell || !rowKey) return;
            const existingPopoverLabel = nameCell.querySelector(`.${POPOVER_LABEL_CLASS}`);
            if (existingPopoverLabel) { existingPopoverLabel.remove(); }
            let providerLetter = 'O';
            if (rowKey.startsWith('travelline_')) providerLetter = 'T';
            else if (rowKey.startsWith('bnovo_')) providerLetter = 'B';
            else if (rowKey.startsWith('otel_')) return;
            const labelSpan = document.createElement('span');
            labelSpan.className = `${POPOVER_LABEL_CLASS} ${POPOVER_LABEL_CLASS}-${providerLetter}`;
            labelSpan.textContent = providerLetter;
            nameCell.insertBefore(labelSpan, nameCell.firstChild);
        });
    }

    function applyLabelsToVisiblePopovers() {
        if (!popoverLabelsVisible) { 
            document.querySelectorAll(`.${POPOVER_LABEL_CLASS}`).forEach(label => label.remove()); 
            return; 
        }
        const visiblePopovers = document.querySelectorAll(`${COMPETITOR_POPOVER_SELECTOR}:not(.ant-popover-hidden)`);
        visiblePopovers.forEach(popover => applyLabelsToPopover(popover));
    }

    // обновление текста пунктов меню
    function updateToggleLabelsItemText() { 
        const item = document.getElementById('hotellab-toggle-labels-item'); 
        if (item) item.textContent = labelsVisible ? 'Скрыть в шапке (TL/b)' : 'Показать в шапке (TL/b)'; 
    }
    function updateTogglePopoverLabelsItemText() { 
        const item = document.getElementById('hotellab-toggle-popover-labels-item'); 
        if (item) item.textContent = popoverLabelsVisible ? 'Скрыть в попапе (T/B/O)' : 'Показать в попапе (T/B/O)'; 
    }
    function updateToggleCalendarLabelsItemText() { 
        const item = document.getElementById('hotellab-toggle-calendar-labels-item'); 
        if (item) item.textContent = calendarLabelsVisible ? 'Скрыть в календаре (T/B/O)' : 'Показать в календаре (T/B/O)'; 
    }
    function updateToggleDebugItemText() { 
        const item = document.getElementById('hotellab-toggle-debug-item'); 
        if (item) item.textContent = DEBUG ? 'Отключить Debug Log' : 'Включить Debug Log'; 
    }

    // обновление статуса скрипта
    function updateScriptStatus(message = null) { 
        try { 
            const statusEl = document.getElementById('hotellab-script-status'); 
            if (statusEl) { 
                if (message) { 
                    statusEl.textContent = message; 
                } else { 
                    const labelStatus = labelsVisible ? 'Шапка вкл.' : 'Шапка выкл.'; 
                    const popoverStatus = popoverLabelsVisible ? 'Попап вкл.' : 'Попап выкл.'; 
                    const calendarStatus = calendarLabelsVisible ? 'Календ. вкл.' : 'Календ. выкл.'; 
                    const hotelCount = Object.keys(rateShopperHotelData).length; 
                    statusEl.textContent = `(${hotelCount} отелей | ${labelStatus} | ${popoverStatus} | ${calendarStatus}${DEBUG ? ' | Debug' : ''})`; 
                } 
            } 
        } catch (e) { /* ignore */ } 
    }

    // добавление элементов управления в меню
    function addControlsToMenu(menuPopupElement) {
        if (!document.body.contains(menuPopupElement) || menuPopupElement.offsetParent === null) { return false; }
        const mainMenuUl = menuPopupElement.querySelector('ul.ant-menu.ant-menu-sub.ant-menu-vertical');
        if (!mainMenuUl) { console.error('[B4DCAT TOOLS] Не найден основной UL меню.'); return false; }
        if (mainMenuUl.querySelector(`#${SCRIPT_GROUP_ID}`)) {
            updateToggleLabelsItemText(); 
            updateTogglePopoverLabelsItemText(); 
            updateToggleCalendarLabelsItemText(); 
            updateToggleDebugItemText(); 
            updateScriptStatus(); 
            menuGroupAdded = true; 
            return true;
        }
        debugLog('Добавление группы элементов управления в меню.');
        const groupLi = document.createElement('li'); 
        groupLi.className = 'ant-menu-item-group'; 
        groupLi.id = SCRIPT_GROUP_ID; 
        groupLi.setAttribute('role', 'presentation'); 
        const groupTitleDiv = document.createElement('div'); 
        groupTitleDiv.className = 'ant-menu-item-group-title'; 
        groupTitleDiv.setAttribute('role', 'presentation'); 
        const toolIconSvg = `<svg viewBox="64 64 896 896" focusable="false" data-icon="tool" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M876.6 239.5c-.5-.9-1.2-1.8-2-2.5-5-5-13.1-5-18.1 0L684.2 409.3l-67.9-67.9L788.7 169c.8-.8 1.4-1.6 2-2.5 3.6-6.1 1.6-13.9-4.5-17.5-98.2-58-226.8-44.7-311.3 39.7-67 67-89.2 162-66.5 247.4l-293 293c-3 3-2.8 7.9.3 11l169.7 169.7c3.1 3.1 8.1 3.3 11 .3l292.9-292.9c85.5 22.8 180.5.7 247.6-66.4 84.4-84.5 97.7-213.1 39.7-311.3zM786 499.8c-58.1 58.1-145.3 69.3-214.6 33.6l-8.8 8.8-.1-.1-274 274.1-79.2-79.2 230.1-230.1s0 .1.1.1l52.8-52.8c-35.7-69.3-24.5-156.5 33.6-214.6a184.2 184.2 0 01144-53.5L537 318.9a32.05 32.05 0 000 45.3l124.5 124.5a32.05 32.05 0 0045.3 0l132.8-132.8c3.7 51.8-14.4 104.8-53.6 143.9z"></path></svg>`; 
        groupTitleDiv.innerHTML = `<div class="ant-flex css-jyjc0i ant-flex-align-center" style="gap: 10px;">${toolIconSvg}${SCRIPT_GROUP_TITLE}</div>`; 
        const groupListUl = document.createElement('ul'); 
        groupListUl.className = 'ant-menu-item-group-list'; 
        groupListUl.setAttribute('role', 'group');
        
        function createMenuItem(id, text, onClick) { 
            const item = document.createElement('li'); 
            item.className = `ant-menu-item ant-menu-item-only-child ${SCRIPT_MENU_ITEM_CLASS}`; 
            item.setAttribute('role', 'menuitem'); 
            item.innerHTML = `<span class="ant-menu-title-content"><span id="${id}">${text}</span></span>`; 
            item.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                onClick(); 
                const menuRoot = e.target.closest('.ant-menu-submenu-popup'); 
                if (menuRoot) menuRoot.style.display = 'none'; 
                setTimeout(() => { 
                    if (menuRoot) menuRoot.style.display = ''; 
                }, 200); 
            }); 
            return item; 
        }
        
        function createStatusItem() { 
            const item = document.createElement('li'); 
            item.className = `ant-menu-item ant-menu-item-disabled ${SCRIPT_MENU_ITEM_CLASS} hotellab-status-item`; 
            item.setAttribute('role', 'menuitem'); 
            item.innerHTML = `<span class="ant-menu-title-content"><span id="hotellab-script-status"></span></span>`; 
            return item; 
        }
        
        // добавление пунктов меню
        groupListUl.appendChild(createMenuItem('hotellab-apply-item', 'Применить метки сейчас', () => { 
            headerApplicationAttempts = 0; 
            calendarApplicationAttempts = 0; 
            applyHeaderLabelsWithRetry(); 
            applyCalendarLabelsWithRetry(); 
            applyLabelsToVisiblePopovers(); 
        }));
        groupListUl.appendChild(createMenuItem('hotellab-toggle-labels-item', '', () => { 
            labelsVisible = !labelsVisible; 
            updateToggleLabelsItemText(); 
            applyHeaderLabelsToTable(); 
            updateScriptStatus(); 
        }));
        groupListUl.appendChild(createMenuItem('hotellab-toggle-popover-labels-item', '', () => { 
            popoverLabelsVisible = !popoverLabelsVisible; 
            updateTogglePopoverLabelsItemText(); 
            applyLabelsToVisiblePopovers(); 
            updateScriptStatus(); 
        }));
        groupListUl.appendChild(createMenuItem('hotellab-toggle-calendar-labels-item', '', () => { 
            calendarLabelsVisible = !calendarLabelsVisible; 
            updateToggleCalendarLabelsItemText(); 
            if (calendarLabelsVisible) { 
                calendarApplicationAttempts = 0; 
                applyCalendarLabelsWithRetry(); 
            } else { 
                document.querySelectorAll(`.${CALENDAR_LABEL_CLASS}`).forEach(l => l.remove()); 
            } 
            updateScriptStatus(); 
        }));
        groupListUl.appendChild(createMenuItem('hotellab-toggle-debug-item', '', () => { 
            DEBUG = !DEBUG; 
            updateToggleDebugItemText(); 
            updateScriptStatus(); 
            console.log(`[B4DCAT TOOLS] Debug режим переключен на: ${DEBUG}`);
        }));
        groupListUl.appendChild(createStatusItem());
        groupLi.appendChild(groupTitleDiv); 
        groupLi.appendChild(groupListUl);
        try { 
            const divider = document.createElement('li'); 
            divider.className = 'ant-menu-item-divider'; 
            divider.setAttribute('role','separator'); 
            mainMenuUl.appendChild(divider); 
            mainMenuUl.appendChild(groupLi); 
            menuGroupAdded = true;
            updateToggleLabelsItemText(); 
            updateTogglePopoverLabelsItemText(); 
            updateToggleCalendarLabelsItemText(); 
            updateToggleDebugItemText(); 
            updateScriptStatus(`${SCRIPT_GROUP_TITLE} Готов`);
            debugLog(`Группа меню "${SCRIPT_GROUP_TITLE}" успешно добавлена.`); 
            return true;
        } catch (error) { 
            console.error('[B4DCAT TOOLS] Ошибка добавления группы меню:', error); 
            menuGroupAdded = false; 
            return false; 
        }
    }

    // перехват API запросов
    const interceptUrlRateShopper = '/privat/api/rate-shopper/';
    const interceptUrlCalendar = '/privat/api/new-calendar/';
    const originalFetch = window.fetch;
    window.fetch = function(input, options) {
        const url = (typeof input === 'string' ? input : input?.url) ?? '';
        const isRateShopperReq = url.includes(interceptUrlRateShopper);
        const isCalendarReq = url.includes(interceptUrlCalendar);

        if (isRateShopperReq || isCalendarReq) {
            debugLog(`Перехват Fetch ${isRateShopperReq ? 'RateShopper' : 'Calendar'} запроса:`, url);
        }

        const promise = originalFetch.apply(this, arguments);

        if (isRateShopperReq || isCalendarReq) {
            promise.then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    clone.text().then(text => {
                        if (text) {
                            try {
                                const data = JSON.parse(text);
                                if (isRateShopperReq) {
                                    processRateShopperResponse(data);
                                } else if (isCalendarReq) {
                                    processNewCalendarResponse(data);
                                }
                            } catch(e) {
                                console.error('[B4DCAT TOOLS] Ошибка парсинга ответа API:', e, 'URL:', url);
                            }
                        }
                    }).catch(err => console.error('[B4DCAT TOOLS] Ошибка чтения fetch текста:', err));
                } else { 
                    debugLog(`Fetch запрос не удался: ${response.status} для ${url}`);
                }
            }).catch(error => { 
                console.error('[B4DCAT TOOLS] Ошибка перехвата fetch:', error); 
            });
        }
        return promise;
    };

    // попытка добавления элементов управления в меню
    function attemptToAddMenuControls() { 
        if (menuGroupAdded) return; 
        const menuPopup = document.querySelector(MENU_POPUP_SELECTOR); 
        if (menuPopup && menuPopup.offsetParent !== null) { 
            addControlsToMenu(menuPopup); 
        } 
    }
    
    function handleSettingsIconClick() { 
        setTimeout(attemptToAddMenuControls, MENU_CHECK_DELAY_AFTER_CLICK); 
    }
    
    function setupSettingsClickListener() { 
        if (settingsIconListenerAdded) return; 
        const settingsClickTarget = document.querySelector(SETTINGS_ICON_CLICK_TARGET_SELECTOR); 
        if (settingsClickTarget) { 
            settingsClickTarget.addEventListener('click', handleSettingsIconClick, { capture: true }); 
            settingsIconListenerAdded = true; 
            debugLog("Слушатель клика добавлен к цели настроек."); 
        } else { 
            setTimeout(setupSettingsClickListener, 2000); 
        } 
    }

    // отслеживание изменений DOM
    let tableObserverDebounceTimer = null;
    const observer = new MutationObserver((mutations) => {
        let tableChanged = false;
        let popoverToShow = null;

        for (const mutation of mutations) {
            // проверка изменения видимости попапа
            if (mutation.type === 'attributes' && mutation.attributeName === 'class' && mutation.target.matches?.(COMPETITOR_POPOVER_SELECTOR)) {
                const popoverElement = mutation.target;
                const isNowVisible = !popoverElement.classList.contains('ant-popover-hidden');
                const wasVisible = mutation.oldValue?.includes('ant-popover-hidden');
                if (isNowVisible && wasVisible !== false) {
                    debugLog("Observer: Попап конкурентов стал видимым:", popoverElement);
                    popoverToShow = popoverElement;
                }
            }

            // проверка изменений содержимого таблицы
            if (!tableChanged && mutation.type === 'childList' && mutation.target?.closest) {
                if (mutation.target.closest('.ant-table-tbody') ||
                   (mutation.target.closest('.ant-spin-container') && [...mutation.addedNodes, ...mutation.removedNodes].some(n => n.nodeType === Node.ELEMENT_NODE && n.classList?.contains('ant-spin'))))
                { tableChanged = true; }
            }
        }

        // обработка обнаруженных изменений
        if (popoverToShow) { applyLabelsToPopover(popoverToShow); }

        if (tableChanged) {
            clearTimeout(tableObserverDebounceTimer);
            debugLog("Обнаружено изменение таблицы, отложенное обновление меток...");
            tableObserverDebounceTimer = setTimeout(() => {
                debugLog('Применение меток после обнаруженного изменения таблицы.');
                headerApplicationAttempts = 0;
                calendarApplicationAttempts = 0;
                applyHeaderLabelsWithRetry();
                applyCalendarLabelsWithRetry();
                applyLabelsToVisiblePopovers();
            }, 500);
        }
    });

    // запуск наблюдателя
    function startObservers() { 
        const observeTarget = document.body; 
        if (observeTarget) { 
            debugLog("Запуск MutationObserver на document body."); 
            observer.observe(observeTarget, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true }); 
        } else { 
            debugLog("Не найден document body для наблюдения. Повтор..."); 
            setTimeout(startObservers, 3000); 
        } 
    }

    // инициализация
    function initialize() { 
        debugLog('Инициализация компонентов скрипта...'); 
        updateScriptStatus('Инициализация...'); 
        setupSettingsClickListener(); 
        startObservers(); 
        updateScriptStatus('Готов. Ожидание данных...'); 
    }
    
    if (document.readyState === 'complete' || document.readyState === 'interactive') { 
        setTimeout(initialize, 150); 
    } else { 
        window.addEventListener('load', () => setTimeout(initialize, 150), { once: true }); 
    }

})();