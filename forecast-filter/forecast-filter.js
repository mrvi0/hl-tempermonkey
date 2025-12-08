// ==UserScript==
// @name         HotelLab Forecast Filter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Фильтрация отелей по статусам прогнозов (Красный, Желтый, Зеленый)
// @author       Mr Vi
// @match        https://app.hotellab.io/lk/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hotellab.io
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('[HotelLab Filter] Скрипт запущен');

    // Ждем полной загрузки DataTables
    let attempts = 0;
    const maxAttempts = 40; // 20 секунд максимум

    const waitForTable = setInterval(() => {
        attempts++;
        
        const table = document.getElementById('hotelsTable');
        const wrapper = document.getElementById('hotelsTable_wrapper');
        const tbody = table ? table.querySelector('tbody tr') : null;
        
        console.log(`[HotelLab Filter] Попытка ${attempts}: table=${!!table}, wrapper=${!!wrapper}, tbody=${!!tbody}`);
        
        // Проверяем что и таблица и DataTables wrapper загружены
        if (table && wrapper && tbody) {
            console.log('[HotelLab Filter] Таблица найдена, инициализация фильтров...');
            clearInterval(waitForTable);
            // Даем DataTables еще немного времени на полную инициализацию
            setTimeout(initFilters, 1000);
        } else if (attempts >= maxAttempts) {
            console.error('[HotelLab Filter] Таблица не загрузилась за отведенное время');
            clearInterval(waitForTable);
        }
    }, 500);

    function initFilters() {
        console.log('[HotelLab Filter] Начало инициализации фильтров');
        
        // Проверяем, не добавлены ли уже фильтры
        if (document.getElementById('forecast-filter')) {
            console.log('[HotelLab Filter] Фильтры уже добавлены');
            return;
        }
        
        // Находим панель поиска
        const searchPanel = document.getElementById('hotelsTable_filter');
        if (!searchPanel) {
            console.error('[HotelLab Filter] Не найдена панель поиска');
            return;
        }
        
        console.log('[HotelLab Filter] Создание контейнера фильтров');
        
        // Создаем контейнер для всех фильтров
        const filterContainer = document.createElement('div');
        filterContainer.id = 'hotellab-filter-container';
        filterContainer.style.cssText = `
            display: inline-flex;
            gap: 15px;
            align-items: center;
            margin-right: 20px;
            padding: 8px 15px;
            background: #e3f2fd;
            border-radius: 4px;
            border: 1px solid #2196F3;
        `;
        
        // Заголовок
        const title = document.createElement('span');
        title.textContent = '🔍 Фильтры:';
        title.style.cssText = 'font-weight: bold; margin-right: 10px; color: #1976D2;';
        filterContainer.appendChild(title);
        
        // Фильтр "Дата прогноза"
        const forecastWrapper = createFilterWrapper('Дата прогноза:', 'forecast-filter');
        filterContainer.appendChild(forecastWrapper);
        
        // Фильтр "Дата загрузки"
        const loadWrapper = createFilterWrapper('Дата загрузки:', 'load-filter');
        filterContainer.appendChild(loadWrapper);
        
        // Фильтр "Дата отправки отчёта"
        const reportWrapper = createFilterWrapper('Отчёт:', 'report-filter');
        filterContainer.appendChild(reportWrapper);
        
        // Кнопка сброса
        const resetBtn = document.createElement('button');
        resetBtn.textContent = '🔄 Сбросить';
        resetBtn.style.cssText = `
            padding: 6px 12px;
            background: #26a69a;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            margin-left: 10px;
        `;
        
        resetBtn.addEventListener('mouseover', () => {
            resetBtn.style.background = '#2bbbad';
        });
        
        resetBtn.addEventListener('mouseout', () => {
            resetBtn.style.background = '#26a69a';
        });
        
        resetBtn.addEventListener('click', resetAllFilters);
        filterContainer.appendChild(resetBtn);
        
        // Настраиваем панель поиска для правильного отображения
        searchPanel.style.cssText = `
            display: flex;
            align-items: center;
        `;
        
        // Добавляем контейнер в начало панели поиска (слева)
        searchPanel.insertBefore(filterContainer, searchPanel.firstChild);
        console.log('[HotelLab Filter] Фильтры успешно добавлены на страницу!');

        // Инициализируем фильтрацию
        setupFilterLogic();
    }
    
    function createFilterWrapper(labelText, id) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 5px;';
        
        const label = document.createElement('label');
        label.textContent = labelText;
        label.style.cssText = 'font-size: 13px; font-weight: 500; margin: 0;';
        
        const select = createFilterDropdown(id);
        
        wrapper.appendChild(label);
        wrapper.appendChild(select);
        
        return wrapper;
    }
    
    function resetAllFilters() {
        console.log('[HotelLab Filter] Сброс всех фильтров');
        
        const ff = document.getElementById('forecast-filter');
        const lf = document.getElementById('load-filter');
        const rf = document.getElementById('report-filter');
        
        if (ff) ff.value = 'all';
        if (lf) lf.value = 'all';
        if (rf) rf.value = 'all';

        // Показываем все строки
        const rows = document.querySelectorAll('#hotelsTable tbody tr');
        rows.forEach(row => row.style.display = '');

        // Обновляем счетчик
        const info = document.getElementById('hotelsTable_info');
        if (info) {
            const total = rows.length;
            info.textContent = `Показано ${total} из ${total} записей`;
        }
        
        console.log('[HotelLab Filter] Фильтры сброшены');
    }

    function createFilterDropdown(id) {
        const select = document.createElement('select');
        select.id = id;
        select.style.cssText = `
            padding: 5px 10px;
            border: 1px solid #9e9e9e;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            min-width: 140px;
            font-size: 12px;
            height: 30px;
        `;
        
        select.className = 'browser-default';

        // Опции фильтра
        const options = [
            { value: 'all', text: 'Все' },
            { value: 'red', text: '🔴 Красный' },
            { value: 'yellow', text: '🟡 Желтый' },
            { value: 'green', text: '🟢 Зеленый' },
            { value: 'white', text: '⚪ Белый' }
        ];

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            select.appendChild(option);
        });

        return select;
    }

    function setupFilterLogic() {
        console.log('[HotelLab Filter] Настройка логики фильтрации');
        
        const forecastFilter = document.getElementById('forecast-filter');
        const loadFilter = document.getElementById('load-filter');
        const reportFilter = document.getElementById('report-filter');

        if (!forecastFilter || !loadFilter || !reportFilter) {
            console.error('[HotelLab Filter] Не найдены элементы фильтров!');
            return;
        }

        console.log('[HotelLab Filter] Фильтры найдены, добавление обработчиков');

        // Определяем индексы колонок
        const FORECAST_COL = 4; // Дата прогноза
        const LOAD_COL = 5; // Дата загрузки
        const REPORT_COL = 6; // Дата отправки отчёта

        function applyFilters() {
            console.log('[HotelLab Filter] Применение фильтров...');
            const forecastValue = forecastFilter.value;
            const loadValue = loadFilter.value;
            const reportValue = reportFilter.value;

            const rows = document.querySelectorAll('#hotelsTable tbody tr');

            rows.forEach(row => {
                let showRow = true;

                // Проверяем фильтр "Дата прогноза"
                if (forecastValue !== 'all') {
                    const forecastCell = row.cells[FORECAST_COL];
                    if (!matchesFilter(forecastCell, forecastValue)) {
                        showRow = false;
                    }
                }

                // Проверяем фильтр "Дата загрузки"
                if (showRow && loadValue !== 'all') {
                    const loadCell = row.cells[LOAD_COL];
                    if (!matchesFilter(loadCell, loadValue)) {
                        showRow = false;
                    }
                }

                // Проверяем фильтр "Дата отправки отчёта"
                if (showRow && reportValue !== 'all') {
                    const reportCell = row.cells[REPORT_COL];
                    if (!matchesFilter(reportCell, reportValue)) {
                        showRow = false;
                    }
                }

                // Показываем или скрываем строку
                row.style.display = showRow ? '' : 'none';
            });

            updateVisibleCount();
            
            const visibleCount = Array.from(rows).filter(row => row.style.display !== 'none').length;
            console.log(`[HotelLab Filter] Фильтрация завершена. Показано ${visibleCount} из ${rows.length} строк`);
        }

        function matchesFilter(cell, filterValue) {
            if (!cell) return false;

            const className = cell.className || '';

            switch(filterValue) {
                case 'red':
                    return className.includes('red');
                case 'yellow':
                    return className.includes('amber');
                case 'green':
                    return className.includes('light-green') || className.includes('green');
                case 'white':
                    // Белый - это ячейки без специальных классов card-panel
                    return !className.includes('card-panel');
                default:
                    return true;
            }
        }

        function updateVisibleCount() {
            const rows = document.querySelectorAll('#hotelsTable tbody tr');
            const visibleRows = Array.from(rows).filter(row => row.style.display !== 'none').length;
            const totalRows = rows.length;

            // Обновляем info если есть
            const info = document.getElementById('hotelsTable_info');
            if (info) {
                info.textContent = `Показано ${visibleRows} из ${totalRows} записей`;
            }
        }

        // Добавляем обработчики событий
        forecastFilter.addEventListener('change', applyFilters);
        loadFilter.addEventListener('change', applyFilters);
        reportFilter.addEventListener('change', applyFilters);
        
        console.log('[HotelLab Filter] Фильтры полностью настроены и готовы к работе!');
    }

    // Следим за обновлениями таблицы (когда обновляется статус)
    const observer = new MutationObserver(() => {
        // Если фильтры активны, переприменяем их
        const forecastFilter = document.getElementById('forecast-filter');
        if (forecastFilter && forecastFilter.value !== 'all') {
            forecastFilter.dispatchEvent(new Event('change'));
        }
    });

    // Наблюдаем за изменениями в tbody
    const tbody = document.querySelector('#hotelsTable tbody');
    if (tbody) {
        observer.observe(tbody, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

})();

