// ==UserScript==
// @name         TravelLine & Bnovo ID Finder
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  Finds and displays TravelLine hotel code or Bnovo UID from network requests
// @author       Mr Vi
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mrvi0/hl-tempermonkey/main/hotel-id-finder/tl_bnovo_finder.js
// @downloadURL  https://raw.githubusercontent.com/mrvi0/hl-tempermonkey/main/hotel-id-finder/tl_bnovo_finder.js
// ==/UserScript==

(function() {
    'use strict';

    let foundIdInfo = null; // Will store { type: 'travelline'/'bnovo', code: '...', alias: '...' }
    const displayElementId = 'tl-bnovo-id-display-9a8b7c'; // Unique ID

    function displayFoundId(info) {
        if (!info || !info.type || !info.code) return;

        let displayText = '';
        if (info.type === 'travelline') {
            displayText = info.alias ? `${info.alias}_${info.code}` : `travelline_${info.code}`;
        } else if (info.type === 'bnovo') {
            displayText = `bnovo_${info.code}`;
        } else {
            return; // Unknown type
        }

        let displayDiv = document.getElementById(displayElementId);

        if (!displayDiv) {
            displayDiv = document.createElement('div');
            displayDiv.id = displayElementId;
            document.body.appendChild(displayDiv);

            GM_addStyle(`
                #${displayElementId} {
                    position: fixed !important;
                    top: 10px !important;
                    right: 10px !important;
                    background-color: rgba(40, 40, 40, 0.85) !important;
                    color: white !important;
                    padding: 8px 12px !important;
                    border-radius: 5px !important;
                    font-size: 14px !important;
                    font-family: Arial, sans-serif !important;
                    z-index: 2147483647 !important; /* Max z-index */
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3) !important;
                    cursor: default !important;
                    text-align: right !important;
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                }
                
                #${displayElementId} .id-text {
                    margin-right: 8px !important;
                }
                
                #${displayElementId} .external-link-btn {
                    background-color: rgba(255, 255, 255, 0.2) !important;
                    color: white !important;
                    border: 1px solid rgba(255, 255, 255, 0.3) !important;
                    border-radius: 3px !important;
                    padding: 4px 8px !important;
                    font-size: 12px !important;
                    cursor: pointer !important;
                    text-decoration: none !important;
                    transition: background-color 0.2s !important;
                }
                
                #${displayElementId} .external-link-btn:hover {
                    background-color: rgba(255, 255, 255, 0.3) !important;
                }
            `);
        }

        // Clear existing content
        displayDiv.innerHTML = '';

        // Add ID text
        const idText = document.createElement('span');
        idText.className = 'id-text';
        idText.textContent = displayText;
        displayDiv.appendChild(idText);

        // Add Hotellab button for both types
        const hotellabBtn = document.createElement('a');
        hotellabBtn.className = 'external-link-btn';
        hotellabBtn.textContent = 'HL';
        hotellabBtn.target = '_blank';
        hotellabBtn.href = `https://admin.hotellab.io/hotel?id=${info.code}&source=${info.type}`;
        displayDiv.appendChild(hotellabBtn);

        // Add ReservationSteps button only for bnovo
        if (info.type === 'bnovo') {
            const reservationBtn = document.createElement('a');
            reservationBtn.className = 'external-link-btn';
            reservationBtn.textContent = 'RS';
            reservationBtn.target = '_blank';
            reservationBtn.href = `https://reservationsteps.ru/rooms/index/${info.code}`;
            displayDiv.appendChild(reservationBtn);
        }

        console.log(`[ID Finder] Displaying: ${displayText}`);
    }

    function extractAliasFromScripts() {
        // Ищем скрипты с TravelLine интеграцией
        const scripts = document.querySelectorAll('script[type="text/javascript"]');
        
        for (const script of scripts) {
            const content = script.textContent || script.innerHTML;
            
            // Ищем паттерн: 'setContext', 'TL-INT-...', "ru"
            // Пример: ['setContext', 'TL-INT-cosmosgroup.' + 5881, "ru"]
            const aliasMatch = content.match(/setContext['"]\s*,\s*['"]([^'"]+)['"]/);
            
            if (aliasMatch && aliasMatch[1]) {
                let alias = aliasMatch[1];
                // Убираем возможные суффиксы типа '. + 5881' или просто '.5881'
                alias = alias.replace(/\s*\.\s*\+\s*\d+/, '').replace(/\.\d+$/, '');
                
                // Проверяем что это похоже на alias (начинается с TL-INT-)
                if (alias.startsWith('TL-INT-')) {
                    console.log(`[ID Finder] Found alias: ${alias}`);
                    return alias;
                }
            }
        }
        
        return null;
    }

    function extractIdInfoFromUrl(urlString) {
        try {
            const url = new URL(urlString);

            // 1. Check for Bnovo (public-api.reservationsteps.ru)
            // Example: https://public-api.reservationsteps.ru/v1/api/closed_dates_with_reasons?uid=17308a7d-cd35-4ec4-8b2f-c96e646720f4&...
            if (url.hostname.includes('reservationsteps.ru')) {
                if (url.searchParams.has('uid')) {
                    const uid = url.searchParams.get('uid');
                    // Basic check for UUID format (8-4-4-4-12 hex chars)
                    if (uid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) {
                        return { type: 'bnovo', code: uid };
                    }
                }
            }
            // 2. Check for TravelLine (tlintegration.ru)
            // Example: https://ru-ibe.tlintegration.ru/visitors-online-widget/v1/online?hotel=12041
            // Example: https://ru-ibe.tlintegration.ru/ApiWebDistribution/AvailabilityCalendar/rate_plan_booking_rules?hotel=45639&...
            else if (url.hostname.includes('tlintegration.ru')) {
                const paramsToCheck = ['hotel', 'hotelcode'];
                for (const param of paramsToCheck) {
                    if (url.searchParams.has(param)) {
                        const code = url.searchParams.get(param);
                        if (code && /^\d+$/.test(code)) { // Ensure it's a number
                            // Попробуем найти alias в скриптах
                            const alias = extractAliasFromScripts();
                            return { type: 'travelline', code: code, alias: alias };
                        }
                    }
                }
            }

        } catch (e) {
            // Invalid URL or other error, ignore for cleaner console
            // console.warn('[ID Finder] Error parsing URL:', urlString, e);
        }
        return null;
    }

    function processUrl(urlString) {
        const newIdInfo = extractIdInfoFromUrl(urlString);

        if (newIdInfo) {
            // If new info is different from already found, or nothing was found yet
            if (!foundIdInfo || newIdInfo.type !== foundIdInfo.type || newIdInfo.code !== foundIdInfo.code) {
                console.log(`[ID Finder] Found new ID: ${newIdInfo.type}_${newIdInfo.code} from URL: ${urlString}`);
                foundIdInfo = newIdInfo;
                displayFoundId(foundIdInfo);
            } else {
                // Same info, ensure it's displayed (e.g., if element was removed)
                displayFoundId(foundIdInfo);
            }
        } else if (foundIdInfo) {
            // Current URL doesn't have relevant ID, but we already found one, so ensure it's displayed
            displayFoundId(foundIdInfo);
        }
    }

    // 1. Intercept Fetch API
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        if (args[0]) {
            let url = (typeof args[0] === 'string') ? args[0] : args[0].url;
            if (url) processUrl(url);
        }
        return originalFetch.apply(this, args);
    };

    // 2. Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...restArgs) {
        if (url) {
            processUrl(url.toString()); // Ensure it's a string
        }
        return originalXHROpen.apply(this, [method, url, ...restArgs]);
    };

    // 3. Check existing performance entries (resources already loaded)
    function checkExistingResources() {
        // If we already found something, we can re-display it,
        // but the main goal here is to find an ID if interceptors missed it.
        // The `processUrl` logic will handle if it's a new or same ID.
        if (window.performance && typeof window.performance.getEntriesByType === 'function') {
            const resources = window.performance.getEntriesByType("resource");
            for (const resource of resources) {
                processUrl(resource.name); // resource.name is the URL
                if (foundIdInfo && document.getElementById(displayElementId)) {
                    // If we found an ID and it's displayed, we can be less aggressive.
                    // However, another resource might contain a *different* ID.
                    // So, continue processing all relevant resources.
                }
            }
        }
        
        // Также проверим alias в скриптах, если у нас есть TravelLine ID но нет alias
        if (foundIdInfo && foundIdInfo.type === 'travelline' && !foundIdInfo.alias) {
            const alias = extractAliasFromScripts();
            if (alias) {
                foundIdInfo.alias = alias;
                displayFoundId(foundIdInfo);
            }
        }
        
        // Ensure display if found by initial check
        if (foundIdInfo) {
            displayFoundId(foundIdInfo);
        }
    }

    // Run checks
    checkExistingResources(); // Initial check
    
    // Также проверим alias сразу при загрузке
    const initialAlias = extractAliasFromScripts();
    if (initialAlias && foundIdInfo && foundIdInfo.type === 'travelline' && !foundIdInfo.alias) {
        foundIdInfo.alias = initialAlias;
        displayFoundId(foundIdInfo);
    }

    // Additional checks with small delay for resources loading slightly after 'document-idle'
    setTimeout(checkExistingResources, 1000);
    setTimeout(checkExistingResources, 3000);

    console.log('[ID Finder] Initialized. Listening for TravelLine/Bnovo IDs...');

})();