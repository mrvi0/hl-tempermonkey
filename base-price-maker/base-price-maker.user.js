// ==UserScript==
// @name         Base Price Maker
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Генератор base_price из min_price или max_price с настройкой процента или значения для JSON редакторов на странице
// @author       Mr Vi
// @match        https://app.hotellab.io/ru/AdminOnly/mainApp/hotels/*
// @match        https://app.hotellab.ru/ru/AdminOnly/mainApp/hotels/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mrvi0/hl-tempermonkey/main/base-price-maker/base-price-maker.user.js
// @downloadURL https://raw.githubusercontent.com/mrvi0/hl-tempermonkey/main/base-price-maker/base-price-maker.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ===== CONFIGURATION =====
    const STORAGE_KEY_SOURCE = 'base_price_maker_source';
    const STORAGE_KEY_MODE = 'base_price_maker_mode';
    const STORAGE_KEY_VALUE = 'base_price_maker_value';
    const DEFAULT_SOURCE = 'min_price';
    const DEFAULT_MODE = 'percent';
    const DEFAULT_VALUE = '100';

    // ===== STYLES =====
    const styles = `
        /* Кнопка открытия UI */
        #base-price-maker-btn {
            position: fixed !important;
            bottom: 80px !important;
            left: 20px !important;
            width: 48px !important;
            height: 48px !important;
            background: #417690 !important;
            border: none !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
            z-index: 10000 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: background 0.2s !important;
            font-size: 18px !important;
            color: #fff !important;
            font-weight: bold !important;
        }

        #base-price-maker-btn:hover {
            background: #205067 !important;
        }

        /* Popup UI */
        #base-price-maker-popup {
            position: fixed !important;
            bottom: 140px !important;
            left: 20px !important;
            background: #fff !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
            padding: 20px !important;
            min-width: 350px !important;
            max-width: 600px !important;
            max-height: calc(100vh - 200px) !important;
            overflow-y: auto !important;
            z-index: 10001 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            display: none !important;
        }

        #base-price-maker-popup.visible {
            display: block !important;
        }

        #base-price-maker-popup h3 {
            margin: 0 0 15px 0 !important;
            padding: 0 0 10px 0 !important;
            border-bottom: 1px solid #eee !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            color: #333 !important;
        }

        .base-price-maker-section {
            margin-bottom: 20px !important;
        }

        .base-price-maker-section:last-child {
            margin-bottom: 0 !important;
        }

        .base-price-maker-label {
            display: block !important;
            font-size: 13px !important;
            color: #666 !important;
            margin-bottom: 8px !important;
            font-weight: 500 !important;
        }

        .base-price-maker-select,
        .base-price-maker-input {
            width: 100% !important;
            padding: 8px 12px !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            box-sizing: border-box !important;
        }

        .base-price-maker-select:focus,
        .base-price-maker-input:focus {
            outline: none !important;
            border-color: #417690 !important;
        }

        .base-price-maker-toggle-group {
            display: flex !important;
            gap: 10px !important;
            margin-bottom: 10px !important;
        }

        .base-price-maker-toggle-btn {
            flex: 1 !important;
            padding: 8px 16px !important;
            border: 1px solid #ddd !important;
            background: #fff !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 13px !important;
            transition: all 0.2s !important;
            text-align: center !important;
        }

        .base-price-maker-toggle-btn.active {
            background: #417690 !important;
            color: #fff !important;
            border-color: #417690 !important;
        }

        .base-price-maker-toggle-btn:hover {
            border-color: #417690 !important;
        }

        .base-price-maker-input-group {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }

        .base-price-maker-input-group .base-price-maker-input {
            flex: 1 !important;
        }

        .base-price-maker-suffix {
            font-size: 13px !important;
            color: #666 !important;
            min-width: 30px !important;
        }

        .base-price-maker-actions {
            display: flex !important;
            gap: 10px !important;
            margin-top: 20px !important;
        }

        .base-price-maker-btn {
            flex: 1 !important;
            padding: 10px 16px !important;
            border: none !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: background 0.2s !important;
        }

        .base-price-maker-btn-primary {
            background: #417690 !important;
            color: #fff !important;
        }

        .base-price-maker-btn-primary:hover {
            background: #205067 !important;
        }

        .base-price-maker-btn:disabled {
            background: #ccc !important;
            cursor: not-allowed !important;
        }

        .base-price-maker-editors-list {
            max-height: 200px !important;
            overflow-y: auto !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
            padding: 10px !important;
            background: #f9f9f9 !important;
            margin-top: 10px !important;
        }

        .base-price-maker-editor-item {
            padding: 8px !important;
            margin-bottom: 5px !important;
            background: #fff !important;
            border-radius: 3px !important;
            font-size: 12px !important;
            border-left: 3px solid #417690 !important;
        }

        .base-price-maker-editor-item:last-child {
            margin-bottom: 0 !important;
        }

        .base-price-maker-result {
            margin-top: 15px !important;
            padding: 10px !important;
            background: #f0f8ff !important;
            border: 1px solid #b0d4f1 !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            color: #333 !important;
        }

        .base-price-maker-error {
            margin-top: 15px !important;
            padding: 10px !important;
            background: #ffe6e6 !important;
            border: 1px solid #ff9999 !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            color: #cc0000 !important;
        }

        .base-price-maker-success {
            margin-top: 15px !important;
            padding: 10px !important;
            background: #d4edda !important;
            border: 1px solid #c3e6cb !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            color: #155724 !important;
        }

        /* Overlay для закрытия popup */
        #base-price-maker-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 10000 !important;
            display: none !important;
        }

        #base-price-maker-overlay.visible {
            display: block !important;
        }
    `;

    // ===== MAIN CODE =====
    
    function init() {
        // Добавляем стили
        GM_addStyle(styles);

        // Создаем UI элементы
        createButton();
        createPopup();
    }

    function createButton() {
        // Проверяем, не создана ли уже кнопка
        if (document.getElementById('base-price-maker-btn')) {
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'base-price-maker-btn';
        btn.innerHTML = 'BP';
        btn.title = 'Base Price Maker';
        btn.addEventListener('click', togglePopup);
        document.body.appendChild(btn);
    }

    function createPopup() {
        // Проверяем, не создан ли уже popup
        if (document.getElementById('base-price-maker-popup')) {
            return;
        }

        // Overlay для закрытия по клику вне popup
        const overlay = document.createElement('div');
        overlay.id = 'base-price-maker-overlay';
        overlay.addEventListener('click', closePopup);
        document.body.appendChild(overlay);

        // Popup
        const popup = document.createElement('div');
        popup.id = 'base-price-maker-popup';
        
        const source = GM_getValue(STORAGE_KEY_SOURCE, DEFAULT_SOURCE);
        const mode = GM_getValue(STORAGE_KEY_MODE, DEFAULT_MODE);
        const value = GM_getValue(STORAGE_KEY_VALUE, DEFAULT_VALUE);
        
        popup.innerHTML = `
            <h3>Base Price Maker</h3>
            
            <div class="base-price-maker-section">
                <label class="base-price-maker-label">Источник данных:</label>
                <select id="base-price-source" class="base-price-maker-select">
                    <option value="min_price" ${source === 'min_price' ? 'selected' : ''}>min_price</option>
                    <option value="max_price" ${source === 'max_price' ? 'selected' : ''}>max_price</option>
                </select>
            </div>

            <div class="base-price-maker-section">
                <label class="base-price-maker-label">Режим расчета:</label>
                <div class="base-price-maker-toggle-group">
                    <button class="base-price-maker-toggle-btn ${mode === 'percent' ? 'active' : ''}" data-mode="percent">
                        Процент (%)
                    </button>
                    <button class="base-price-maker-toggle-btn ${mode === 'value' ? 'active' : ''}" data-mode="value">
                        Значение
                    </button>
                </div>
                <div class="base-price-maker-input-group">
                    <input type="number" id="base-price-value" class="base-price-maker-input" value="${value}" step="0.01">
                    <span class="base-price-maker-suffix" id="base-price-suffix">${mode === 'percent' ? '%' : ''}</span>
                </div>
            </div>

            <div class="base-price-maker-section">
                <label class="base-price-maker-label">Найденные JSON редакторы:</label>
                <div id="base-price-editors-list" class="base-price-maker-editors-list">
                    <div style="text-align: center; color: #999; padding: 20px;">Нажмите "Найти редакторы" для поиска</div>
                </div>
            </div>

            <div class="base-price-maker-actions">
                <button class="base-price-maker-btn base-price-maker-btn-primary" id="base-price-find-btn">
                    Найти редакторы
                </button>
                <button class="base-price-maker-btn base-price-maker-btn-primary" id="base-price-process-btn" disabled>
                    Обработать
                </button>
            </div>

            <div id="base-price-result"></div>
        `;

        // Обработчики
        const sourceSelect = popup.querySelector('#base-price-source');
        const modeBtns = popup.querySelectorAll('.base-price-maker-toggle-btn');
        const valueInput = popup.querySelector('#base-price-value');
        const suffixSpan = popup.querySelector('#base-price-suffix');
        const findBtn = popup.querySelector('#base-price-find-btn');
        const processBtn = popup.querySelector('#base-price-process-btn');
        const resultDiv = popup.querySelector('#base-price-result');
        const editorsListDiv = popup.querySelector('#base-price-editors-list');

        // Переключение режима
        modeBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                modeBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                const newMode = this.getAttribute('data-mode');
                GM_setValue(STORAGE_KEY_MODE, newMode);
                suffixSpan.textContent = newMode === 'percent' ? '%' : '';
                updateValueInput(valueInput, newMode);
            });
        });

        // Сохранение значения
        valueInput.addEventListener('input', function() {
            GM_setValue(STORAGE_KEY_VALUE, this.value);
        });

        // Сохранение источника
        sourceSelect.addEventListener('change', function() {
            GM_setValue(STORAGE_KEY_SOURCE, this.value);
        });

        // Поиск редакторов
        findBtn.addEventListener('click', function() {
            findJSONEditors();
        });

        // Обработка JSON редакторов
        processBtn.addEventListener('click', function() {
            processJSONEditors();
        });

        document.body.appendChild(popup);
    }

    function updateValueInput(input, mode) {
        const currentValue = parseFloat(input.value) || 0;
        if (mode === 'percent' && currentValue > 100) {
            input.value = '100';
        }
    }

    function getEditorName(textarea) {
        const name = textarea.getAttribute('name') || textarea.id || 'Unknown';
        let displayName = name.replace('id_', '').replace(/_/g, ' ');

        // Специальная обработка для сезонов
        if (name.includes('hotelSeasonsConfigs')) {
            const seasonIndex = name.match(/hotelSeasonsConfigs-(\d+)-config/);
            if (seasonIndex) {
                const seasonNameInput = document.getElementById(`id_hotelSeasonsConfigs-${seasonIndex[1]}-name`);
                if (seasonNameInput && seasonNameInput.value) {
                    displayName = `Сезон: ${seasonNameInput.value}`;
                } else {
                    displayName = `Сезон ${parseInt(seasonIndex[1]) + 1}`;
                }
            }
        }

        return displayName;
    }

    let foundEditors = [];

    function findJSONEditors() {
        const popup = document.getElementById('base-price-maker-popup');
        const editorsListDiv = popup.querySelector('#base-price-editors-list');
        const processBtn = popup.querySelector('#base-price-process-btn');
        const resultDiv = popup.querySelector('#base-price-result');

        // Находим все JSON редакторы
        const jsonEditors = document.querySelectorAll('.for_jsoneditor');
        
        foundEditors = [];
        
        jsonEditors.forEach((textarea) => {
            try {
                const jsonText = textarea.value;
                if (!jsonText || !jsonText.trim()) {
                    return;
                }

                const jsonData = JSON.parse(jsonText);
                const editorName = getEditorName(textarea);
                
                foundEditors.push({
                    textarea: textarea,
                    editorName: editorName,
                    data: jsonData
                });
            } catch (e) {
                // Игнорируем невалидные JSON
                console.warn('Невалидный JSON в редакторе:', textarea.id, e);
            }
        });

        // Обновляем список
        if (foundEditors.length === 0) {
            editorsListDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">JSON редакторы не найдены</div>';
            processBtn.disabled = true;
            showError(resultDiv, 'JSON редакторы не найдены на странице');
        } else {
            editorsListDiv.innerHTML = foundEditors.map((editor, index) => {
                return `<div class="base-price-maker-editor-item">${index + 1}. ${escapeHtml(editor.editorName)}</div>`;
            }).join('');
            processBtn.disabled = false;
            showSuccess(resultDiv, `Найдено JSON редакторов: ${foundEditors.length}`);
        }
    }

    function processJSONEditors() {
        const popup = document.getElementById('base-price-maker-popup');
        const resultDiv = popup.querySelector('#base-price-result');
        const sourceSelect = popup.querySelector('#base-price-source');
        const modeBtns = popup.querySelectorAll('.base-price-maker-toggle-btn');
        const valueInput = popup.querySelector('#base-price-value');
        const processBtn = popup.querySelector('#base-price-process-btn');

        if (foundEditors.length === 0) {
            showError(resultDiv, 'Сначала найдите JSON редакторы');
            return;
        }

        // Определяем источник и режим
        const source = sourceSelect.value;
        const activeModeBtn = Array.from(modeBtns).find(btn => btn.classList.contains('active'));
        const mode = activeModeBtn ? activeModeBtn.getAttribute('data-mode') : 'percent';
        const value = parseFloat(valueInput.value);

        if (isNaN(value)) {
            showError(resultDiv, 'Введите корректное значение');
            return;
        }

        // Обрабатываем каждый редактор
        let processedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        processBtn.disabled = true;
        processBtn.textContent = 'Обработка...';

        foundEditors.forEach((editor, index) => {
            try {
                // Получаем актуальные данные из textarea
                const currentText = editor.textarea.value;
                if (!currentText || !currentText.trim()) {
                    skippedCount++;
                    return;
                }

                let config = JSON.parse(currentText);
                let hasChanges = false;

                // Обрабатываем конфиг
                if (Array.isArray(config)) {
                    // Массив профилей
                    config.forEach((profile) => {
                        if (processProfile(profile, source, mode, value)) {
                            hasChanges = true;
                        }
                    });
                } else if (typeof config === 'object' && config !== null) {
                    // Один профиль
                    if (processProfile(config, source, mode, value)) {
                        hasChanges = true;
                    }
                }

                if (hasChanges) {
                    // Обновляем JSON редактор
                    const newJsonString = JSON.stringify(config, null, 2);
                    editor.textarea.value = newJsonString;

                    // Обновляем через window.jsonEditors
                    const editorDivId = editor.textarea.id + '_jsoneditor';
                    if (window.jsonEditors && window.jsonEditors[editorDivId]) {
                        try {
                            window.jsonEditors[editorDivId].set(config);
                        } catch (e) {
                            console.error('Ошибка обновления JSON редактора:', e);
                        }
                    }

                    // Вызываем события для синхронизации
                    editor.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    editor.textarea.dispatchEvent(new Event('change', { bubbles: true }));

                    processedCount++;
                } else {
                    skippedCount++;
                }
            } catch (e) {
                console.error(`Ошибка обработки редактора ${editor.editorName}:`, e);
                errorCount++;
            }
        });

        processBtn.disabled = false;
        processBtn.textContent = 'Обработать';

        // Показываем результат
        const message = `Обработано: ${processedCount}, Пропущено: ${skippedCount}${errorCount > 0 ? ', Ошибок: ' + errorCount : ''}`;
        if (errorCount > 0) {
            showError(resultDiv, message);
        } else if (processedCount > 0) {
            showSuccessMessage(resultDiv, message);
        } else {
            showSuccess(resultDiv, 'Изменений не требуется');
        }
    }

    function processProfile(profile, source, mode, value) {
        if (!profile || typeof profile !== 'object') {
            return false;
        }

        // Проверяем наличие источника
        if (!profile[source] || typeof profile[source] !== 'object') {
            return false;
        }

        const sourceData = profile[source];
        const basePrice = {};

        // Обрабатываем каждую пару ключ-значение в source
        for (const key in sourceData) {
            if (sourceData.hasOwnProperty(key)) {
                const sourceValues = sourceData[key];
                
                if (Array.isArray(sourceValues)) {
                    // Обрабатываем массив значений
                    basePrice[key] = sourceValues.map(sourceValue => {
                        return calculateBasePrice(sourceValue, mode, value);
                    });
                } else if (typeof sourceValues === 'number') {
                    // Одно значение
                    basePrice[key] = [calculateBasePrice(sourceValues, mode, value)];
                } else {
                    // Сохраняем как есть, если не число и не массив
                    basePrice[key] = sourceValues;
                }
            }
        }

        // Создаем или перезаписываем base_price
        profile.base_price = basePrice;
        return true;
    }

    function calculateBasePrice(sourceValue, mode, value) {
        if (typeof sourceValue !== 'number' || isNaN(sourceValue)) {
            return sourceValue;
        }

        if (mode === 'percent') {
            // Процент от значения
            return Math.round(sourceValue * (value / 100));
        } else {
            // Абсолютное значение (сложение или вычитание)
            return Math.round(sourceValue + value);
        }
    }

    function showError(resultDiv, message) {
        resultDiv.innerHTML = `<div class="base-price-maker-error">${escapeHtml(message)}</div>`;
    }

    function showSuccess(resultDiv, message) {
        resultDiv.innerHTML = `<div class="base-price-maker-result">${escapeHtml(message)}</div>`;
    }

    function showSuccessMessage(resultDiv, message) {
        resultDiv.innerHTML = `<div class="base-price-maker-success">${escapeHtml(message)}</div>`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function togglePopup(e) {
        e.stopPropagation();
        const popup = document.getElementById('base-price-maker-popup');
        const overlay = document.getElementById('base-price-maker-overlay');
        
        if (popup.classList.contains('visible')) {
            closePopup();
        } else {
            popup.classList.add('visible');
            overlay.classList.add('visible');
        }
    }

    function closePopup() {
        const popup = document.getElementById('base-price-maker-popup');
        const overlay = document.getElementById('base-price-maker-overlay');
        if (popup) popup.classList.remove('visible');
        if (overlay) overlay.classList.remove('visible');
    }

    // Инициализация при загрузке страницы
    function initializeScript() {
        init();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initializeScript();
        });
    } else {
        initializeScript();
    }

})();
