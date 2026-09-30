// ==UserScript==
// @name         URL Collector for TravelLine & Ostrovok
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Collects URLs with TravelLine or Ostrovok IDs and saves them to MySQL database
// @author       Mr Vi
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ===== STORAGE KEYS =====
    const STORAGE = {
        ENTRIES: 'url_collector_entries',
        INDEX: 'url_collector_index',
        PENDING_SYNC: 'url_collector_pending_sync',
        SYNCED_INDEX: 'url_collector_synced_index',
        API_URL: 'url_collector_api_url',
        DB_CONFIG: 'url_collector_db_config'
    };

    // ===== UI FOR SETTINGS =====
    function showSettingsDialog() {
        const currentApiUrl = getApiUrl();
        const currentDbConfig = getDbConfig();
        
        const apiUrl = prompt(
            'Enter API URL (PHP script URL):\n\nExample: https://yourdomain.com/api.php',
            currentApiUrl
        );
        
        if (apiUrl === null) return; // User cancelled
        
        if (apiUrl && !apiUrl.match(/^https?:\/\//)) {
            alert('Invalid URL format. Must start with http:// or https://');
            return;
        }
        
        setApiUrl(apiUrl || '');
        
        // Database configuration
        const dbHost = prompt('Database Host:', currentDbConfig.host || 'localhost');
        if (dbHost === null) return;
        
        const dbName = prompt('Database Name:', currentDbConfig.dbname || '');
        if (dbName === null) return;
        
        const dbUser = prompt('Database Username:', currentDbConfig.username || '');
        if (dbUser === null) return;
        
        const dbPass = prompt('Database Password:', currentDbConfig.password || '');
        if (dbPass === null) return;
        
        setDbConfig({
            host: dbHost || '',
            dbname: dbName || '',
            username: dbUser || '',
            password: dbPass || ''
        });
        
        alert('Settings saved!');
        console.log('[URL Collector] Settings updated');
    }
    
    // ===== GLOBAL FUNCTIONS (available even on excluded domains) =====
    // These functions work independently and are available everywhere
    function setupGlobalFunctions() {
        const functions = {
            showSettings: function() {
                showSettingsDialog();
            },
            clearStorage: function() {
                // Clear new keys
                GM_setValue(STORAGE.ENTRIES, []);
                GM_setValue(STORAGE.INDEX, []);
                GM_setValue(STORAGE.PENDING_SYNC, []);
                GM_setValue(STORAGE.SYNCED_INDEX, []);
                
                // Clear old keys from previous version
                GM_setValue('url_collector_data', []);
                GM_setValue('url_collector_index', []);
                GM_setValue('url_collector_pending_sync', []);
                GM_setValue('url_collector_sync_index', []);
                
                console.log('[URL Collector] Storage cleared (all keys)');
            },
            getStats: function() {
                const entries = GM_getValue(STORAGE.ENTRIES, []);
                const pending = GM_getValue(STORAGE.PENDING_SYNC, []);
                const stats = {
                    total: entries.length,
                    pending: pending.length,
                    byType: {}
                };
                entries.forEach(e => {
                    stats.byType[e.type] = (stats.byType[e.type] || 0) + 1;
                });
                console.log('[URL Collector] Stats:', stats);
                return stats;
            },
            forceSync: function() {
                syncToDatabase(true);
            },
            syncAll: function() {
                function normalizeUrl(urlString, type) {
                    try {
                        const url = new URL(urlString);
                        let normalized = `${url.protocol}//${url.hostname}${url.pathname}`;
                        if (type === 'ostrovok') {
                            normalized = normalized.replace(/\/$/, '');
                        } else {
                            if (url.search) normalized += url.search;
                        }
                        return normalized;
                    } catch (e) {
                        return urlString.split('#')[0];
                    }
                }
                
                const entries = GM_getValue(STORAGE.ENTRIES, []);
                const syncedIndex = new Set(GM_getValue(STORAGE.SYNCED_INDEX, []));
                const pending = GM_getValue(STORAGE.PENDING_SYNC, []);
                
                let added = 0;
                entries.forEach(entry => {
                    const normalizedUrl = normalizeUrl(entry.url, entry.type);
                    const indexKey = `${entry.type}_${entry.code}_${normalizedUrl}`;
                    
                    if (!syncedIndex.has(indexKey)) {
                        const alreadyPending = pending.some(p => {
                            const pNormalized = normalizeUrl(p.url, p.type);
                            return `${p.type}_${p.code}_${pNormalized}` === indexKey;
                        });
                        
                        if (!alreadyPending) {
                            pending.push(entry);
                            syncedIndex.add(indexKey);
                            added++;
                        }
                    }
                });
                
                if (added > 0) {
                    GM_setValue(STORAGE.PENDING_SYNC, pending);
                    console.log(`[URL Collector] Added ${added} entries to sync queue (will sync in next cycle)`);
                } else {
                    console.log('[URL Collector] No unsynced entries found');
                }
            }
        };

        // Export to unsafeWindow
        try {
            if (typeof unsafeWindow !== 'undefined') {
                unsafeWindow.urlCollectorShowSettings = functions.showSettings;
                unsafeWindow.clearUrlCollectorStorage = functions.clearStorage;
                unsafeWindow.getUrlCollectorStats = functions.getStats;
                unsafeWindow.forceUrlCollectorSync = functions.forceSync;
                unsafeWindow.syncAllUrlCollectorFromStorage = functions.syncAll;
            }
        } catch (e) {}

        // Also try window
        try {
            window.urlCollectorShowSettings = functions.showSettings;
            window.clearUrlCollectorStorage = functions.clearStorage;
            window.getUrlCollectorStats = functions.getStats;
            window.forceUrlCollectorSync = functions.forceSync;
            window.syncAllUrlCollectorFromStorage = functions.syncAll;
        } catch (e) {}

        // Inject script for page context
        try {
            const script = document.createElement('script');
            script.innerHTML = `
                (function() {
                    window.clearUrlCollectorStorage = function() {
                        document.dispatchEvent(new CustomEvent('urlCollectorClear'));
                    };
                    window.getUrlCollectorStats = function() {
                        document.dispatchEvent(new CustomEvent('urlCollectorStats'));
                    };
                    window.forceUrlCollectorSync = function() {
                        document.dispatchEvent(new CustomEvent('urlCollectorForceSync'));
                    };
                    window.syncAllUrlCollectorFromStorage = function() {
                        document.dispatchEvent(new CustomEvent('urlCollectorSyncAll'));
                    };
                })();
            `;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
        } catch (e) {}

        // Listen for events
        document.addEventListener('urlCollectorClear', functions.clearStorage);
        document.addEventListener('urlCollectorStats', functions.getStats);
        document.addEventListener('urlCollectorForceSync', functions.forceSync);
        document.addEventListener('urlCollectorSyncAll', functions.syncAll);

        console.log('[URL Collector] Global functions available:');
        console.log('  - clearUrlCollectorStorage()');
        console.log('  - getUrlCollectorStats()');
        console.log('  - forceUrlCollectorSync()');
        console.log('  - syncAllUrlCollectorFromStorage()');
        
        // Register Tampermonkey menu commands
        // Use setTimeout to ensure Tampermonkey is ready
        setTimeout(() => {
            registerMenuCommands(functions);
        }, 100);
    }
    
    // ===== TAMPERMONKEY MENU =====
    function registerMenuCommands(functions) {
        // Register only once
        if (menuCommandsRegistered) {
            return;
        }
        
        try {
            // Settings
            GM_registerMenuCommand('⚙️ Settings (API & Database)', function() {
                functions.showSettings();
            });
            
            // Clear Storage
            GM_registerMenuCommand('🗑️ Clear Storage', function() {
                if (confirm('Clear all storage data?')) {
                    functions.clearStorage();
                    alert('Storage cleared!');
                }
            });
            
            // Show Stats
            GM_registerMenuCommand('📊 Show Stats', function() {
                const stats = functions.getStats();
                const message = `Total: ${stats.total}\nPending: ${stats.pending}\n\nBy type:\n${JSON.stringify(stats.byType, null, 2)}`;
                alert(message);
            });
            
            // Force Sync
            GM_registerMenuCommand('🔄 Force Sync', function() {
                functions.forceSync();
            });
            
            // Sync All
            GM_registerMenuCommand('📤 Sync All from Storage', function() {
                functions.syncAll();
            });
            
            menuCommandsRegistered = true;
            console.log('[URL Collector] Menu commands registered in Tampermonkey');
        } catch (e) {
            console.error('[URL Collector] Could not register menu commands:', e);
            // Don't set flag if registration failed, so we can try again
        }
    }

    // Setup global functions FIRST (before any other initialization)
    // Call immediately - GM_registerMenuCommand works at any time
    setupGlobalFunctions();

    // ===== CONFIGURATION =====
    const CONFIG = {
        EXCLUDED_DOMAINS: [
            'yandex.ru', 'yandex.com', 'ya.ru',
            'google.com', 'google.ru',
            'docs.google.com', 'sheets.google.com', 'script.google.com',
            'app.hotellab.io', 'admin.hotellab.ru', 'app.hotellab.ru'
        ],
        SYNC_INTERVAL: 60000 // 1 minute
    };
    
    // Получаем настройки из хранилища
    function getApiUrl() {
        return GM_getValue(STORAGE.API_URL, '');
    }
    
    function getDbConfig() {
        return GM_getValue(STORAGE.DB_CONFIG, {
            host: '',
            dbname: '',
            username: '',
            password: ''
        });
    }
    
    function setApiUrl(url) {
        GM_setValue(STORAGE.API_URL, url);
    }
    
    function setDbConfig(config) {
        GM_setValue(STORAGE.DB_CONFIG, config);
    }

    // ===== STATE =====
    let isSyncing = false;
    let syncIntervalId = null;
    let processedPages = new Set();
    let menuCommandsRegistered = false;
    let syncStarted = false; // Prevent multiple intervals
    let initialized = false; // Prevent multiple initializations

    // ===== MIGRATION =====
    function migrateOldData() {
        // Check for old storage keys and migrate
        const oldData = GM_getValue('url_collector_data', null);
        if (oldData && Array.isArray(oldData) && oldData.length > 0) {
            console.log(`[URL Collector] Migrating ${oldData.length} entries from old storage...`);
            
            const newEntries = GM_getValue(STORAGE.ENTRIES, []);
            const newIndex = new Set(GM_getValue(STORAGE.INDEX, []));
            const newSyncedIndex = new Set(GM_getValue(STORAGE.SYNCED_INDEX, []));
            
            oldData.forEach(entry => {
                if (entry.id && entry.url && entry.type && entry.code) {
                    const normalizedUrl = normalizeUrl(entry.url, entry.type);
                    const indexKey = `${entry.type}_${entry.code}_${normalizedUrl}`;
                    
                    if (!newIndex.has(indexKey)) {
                        newEntries.push({
                            id: entry.id,
                            url: normalizedUrl,
                            type: entry.type,
                            code: entry.code,
                            timestamp: entry.timestamp || Date.now()
                        });
                        newIndex.add(indexKey);
                        newSyncedIndex.add(indexKey); // Mark as synced if it was in old synced_index
                    }
                }
            });
            
            GM_setValue(STORAGE.ENTRIES, newEntries);
            GM_setValue(STORAGE.INDEX, Array.from(newIndex));
            GM_setValue(STORAGE.SYNCED_INDEX, Array.from(newSyncedIndex));
            
            // Clear old keys
            GM_setValue('url_collector_data', []);
            GM_setValue('url_collector_index', []);
            GM_setValue('url_collector_pending_sync', []);
            GM_setValue('url_collector_sync_index', []);
            
            console.log(`[URL Collector] Migration complete: ${newEntries.length} entries`);
        }
        
        // Migrate old Ostrovok IDs (remove ostrovok_ prefix)
        const entries = GM_getValue(STORAGE.ENTRIES, []);
        const index = GM_getValue(STORAGE.INDEX, []);
        const syncedIndex = GM_getValue(STORAGE.SYNCED_INDEX, []);
        let updated = false;
        
        entries.forEach(entry => {
            if (entry.type === 'ostrovok' && entry.id && entry.id.startsWith('ostrovok_')) {
                // Update ID to remove prefix
                const oldId = entry.id;
                entry.id = entry.code;
                
                // Update index keys
                const normalizedUrl = normalizeUrl(entry.url, entry.type);
                const oldIndexKey = `ostrovok_${entry.code}_${normalizedUrl}`;
                const newIndexKey = `${entry.type}_${entry.code}_${normalizedUrl}`;
                
                // Update in index array
                const indexPos = index.indexOf(oldIndexKey);
                if (indexPos !== -1) {
                    index[indexPos] = newIndexKey;
                }
                
                // Update in synced_index array
                const syncedPos = syncedIndex.indexOf(oldIndexKey);
                if (syncedPos !== -1) {
                    syncedIndex[syncedPos] = newIndexKey;
                }
                
                updated = true;
            }
        });
        
        if (updated) {
            GM_setValue(STORAGE.ENTRIES, entries);
            GM_setValue(STORAGE.INDEX, index);
            GM_setValue(STORAGE.SYNCED_INDEX, syncedIndex);
            console.log('[URL Collector] Updated Ostrovok IDs (removed prefix)');
        }
    }

    // ===== INITIALIZATION =====
    function init() {
        // Prevent multiple initializations
        if (initialized) {
            console.log('[URL Collector] Already initialized, skipping...');
            return;
        }
        
        // Check if domain is excluded
        if (isDomainExcluded()) {
            console.log('[URL Collector] Domain excluded, data collection disabled');
            initialized = true; // Mark as initialized even on excluded domain
            return;
        }

        // Initialize storage
        if (!GM_getValue(STORAGE.ENTRIES)) GM_setValue(STORAGE.ENTRIES, []);
        if (!GM_getValue(STORAGE.INDEX)) GM_setValue(STORAGE.INDEX, []);
        if (!GM_getValue(STORAGE.PENDING_SYNC)) GM_setValue(STORAGE.PENDING_SYNC, []);
        if (!GM_getValue(STORAGE.SYNCED_INDEX)) GM_setValue(STORAGE.SYNCED_INDEX, []);
        
        // Migrate old data if exists
        migrateOldData();

        // Setup network interceptors
        setupNetworkInterceptors();

        // Process current page
        processCurrentPage();

        // Start periodic sync
        startPeriodicSync();

        initialized = true;
        console.log('[URL Collector] Initialized');
    }

    // ===== DOMAIN CHECK =====
    function isDomainExcluded() {
        const hostname = window.location.hostname.toLowerCase();
        return CONFIG.EXCLUDED_DOMAINS.some(domain => 
            hostname === domain || hostname.endsWith('.' + domain)
        );
    }

    // ===== ID EXTRACTION =====
    function extractOstrovokId(url) {
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('ostrovok.ru')) {
                const match = urlObj.pathname.match(/\/hotel\/.*\/mid\d+\/([^\/]+)\/?$/);
                return match ? match[1] : null;
            }
        } catch (e) {}
        return null;
    }

    function extractIdFromNetworkUrl(urlString) {
        try {
            const url = new URL(urlString);
            
            // TravelLine
            if (url.hostname.includes('tlintegration.ru')) {
                for (const param of ['hotel', 'hotelcode']) {
                    if (url.searchParams.has(param)) {
                        const code = url.searchParams.get(param);
                        if (code && /^\d+$/.test(code)) {
                            console.log(`[URL Collector] Found TravelLine ID: ${code} from URL: ${urlString}`);
                            return { type: 'travelline', code: code };
                        }
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    // ===== URL NORMALIZATION =====
    function normalizeUrl(urlString, type) {
        try {
            const url = new URL(urlString);
            let normalized = `${url.protocol}//${url.hostname}${url.pathname}`;
            
            // Remove trailing slash for ostrovok
            if (type === 'ostrovok') {
                normalized = normalized.replace(/\/$/, '');
            } else {
                // For travelline, keep query params
                if (url.search) normalized += url.search;
            }
            
            return normalized;
        } catch (e) {
            return urlString.split('#')[0].split('?')[0];
        }
    }

    function formatId(info) {
        if (!info || !info.type || !info.code) return null;
        // Ostrovok IDs should be without prefix
        if (info.type === 'ostrovok') {
            return info.code;
        }
        return `${info.type}_${info.code}`;
    }

    // ===== PROCESSING =====
    function processCurrentPage() {
        const currentUrl = window.location.href;
        
        // Check Ostrovok
        const ostrovokId = extractOstrovokId(currentUrl);
        if (ostrovokId) {
            const info = { type: 'ostrovok', code: ostrovokId };
            const normalizedUrl = normalizeUrl(currentUrl, 'ostrovok');
            const pageKey = `ostrovok_${ostrovokId}_${normalizedUrl}`;
            
            if (!processedPages.has(pageKey)) {
                processedPages.add(pageKey);
                saveEntry(info, currentUrl);
            }
        }
    }

    function processNetworkUrl(urlString) {
        const idInfo = extractIdFromNetworkUrl(urlString);
        if (!idInfo) return;

        let currentUrl = window.location.href;
        
        // For TravelLine, if we're on API domain, try to get the real page URL
        if (!currentUrl || 
            currentUrl.includes('tlintegration.ru') ||
            currentUrl.startsWith('about:') ||
            currentUrl.startsWith('chrome-extension:') ||
            currentUrl.startsWith('moz-extension:')) {
            
            // Try multiple times to get the real page URL
            const tryGetRealUrl = (attempts = 0) => {
                if (attempts > 10) {
                    console.warn(`[URL Collector] Could not get real URL for ${idInfo.type} ${idInfo.code} after ${attempts} attempts`);
                    return;
                }
                
                setTimeout(() => {
                    // Try multiple sources for the real URL
                    let docUrl = null;
                    
                    // Try window.top if we're in iframe
                    try {
                        if (window.top && window.top !== window && window.top.location.href) {
                            docUrl = window.top.location.href;
                        }
                    } catch (e) {}
                    
                    // Try document.referrer
                    if (!docUrl && document.referrer) {
                        docUrl = document.referrer;
                    }
                    
                    // Try document.location
                    if (!docUrl) {
                        docUrl = document.location?.href || window.location.href;
                    }
                    
                    if (docUrl && 
                        !docUrl.includes('tlintegration.ru') &&
                        !docUrl.startsWith('about:') &&
                        !docUrl.startsWith('chrome-extension:') &&
                        !docUrl.startsWith('moz-extension:')) {
                        const normalizedUrl = normalizeUrl(docUrl, idInfo.type);
                        const pageKey = `${idInfo.type}_${idInfo.code}_${normalizedUrl}`;
                        if (!processedPages.has(pageKey)) {
                            processedPages.add(pageKey);
                            saveEntry(idInfo, docUrl);
                            console.log(`[URL Collector] Saved ${idInfo.type} from network request: ${idInfo.code} - ${docUrl}`);
                        }
                    } else {
                        // Try again
                        tryGetRealUrl(attempts + 1);
                    }
                }, attempts === 0 ? 100 : attempts < 5 ? 500 : 1000); // First try after 100ms, then every 500ms, then every 1s
            };
            
            tryGetRealUrl();
            return;
        }

        // Normal case - we're on a real page
        const normalizedUrl = normalizeUrl(currentUrl, idInfo.type);
        const pageKey = `${idInfo.type}_${idInfo.code}_${normalizedUrl}`;
        
        if (!processedPages.has(pageKey)) {
            processedPages.add(pageKey);
            saveEntry(idInfo, currentUrl);
            console.log(`[URL Collector] Saved ${idInfo.type} from network request: ${idInfo.code} - ${currentUrl}`);
        }
    }

    // ===== SAVING =====
    function saveEntry(idInfo, url) {
        if (!idInfo || !idInfo.type || !idInfo.code) return;

        const normalizedUrl = normalizeUrl(url, idInfo.type);
        const id = formatId(idInfo);
        if (!id) return;

        // Get storage
        const entries = GM_getValue(STORAGE.ENTRIES, []);
        const index = new Set(GM_getValue(STORAGE.INDEX, []));
        const syncedIndex = new Set(GM_getValue(STORAGE.SYNCED_INDEX, []));
        const pending = GM_getValue(STORAGE.PENDING_SYNC, []);

        // Check duplicates by ID only (one ID = one entry, regardless of URL parameters)
        const existingEntry = entries.find(e => 
            e.type === idInfo.type && 
            e.code === idInfo.code
        );
        
        if (existingEntry) {
            // Already have this ID, skip (prevent duplicates from different URL parameters like dates)
            console.log(`[URL Collector] Duplicate ID: ${id} (existing URL: ${existingEntry.url}, new URL: ${normalizedUrl})`);
            return;
        }

        const indexKey = `${idInfo.type}_${idInfo.code}_${normalizedUrl}`;

        // Check if we already have this exact entry (double-check)
        if (index.has(indexKey) || syncedIndex.has(indexKey)) {
            console.log(`[URL Collector] Duplicate: ${id} - ${normalizedUrl}`);
            return;
        }

        // Check if already in pending queue (by ID only)
        const alreadyPending = pending.some(p => 
            p.type === idInfo.type && 
            p.code === idInfo.code
        );

        if (alreadyPending) {
            console.log(`[URL Collector] Already in queue: ${id}`);
            return;
        }

        // Add to storage
        const entry = {
            id: id,
            url: normalizedUrl,
            type: idInfo.type,
            code: idInfo.code,
            timestamp: Date.now()
        };

        entries.push(entry);
        index.add(indexKey);

        // Add to pending sync (don't mark as synced yet!)
        pending.push(entry);

        // Save
        GM_setValue(STORAGE.ENTRIES, entries);
        GM_setValue(STORAGE.INDEX, Array.from(index));
        GM_setValue(STORAGE.PENDING_SYNC, pending);

        console.log(`[URL Collector] Saved: ${id} - ${normalizedUrl}`);
    }

    // ===== SYNC TO DATABASE =====
    function syncToDatabase(force = false) {
        if (isSyncing && !force) {
            console.log('[URL Collector] Sync already in progress, skipping...');
            return;
        }

        const pending = GM_getValue(STORAGE.PENDING_SYNC, []);
        if (pending.length === 0) {
            if (force) {
                console.log('[URL Collector] No pending entries to sync');
            }
            return;
        }

        const apiUrl = getApiUrl();
        const dbConfig = getDbConfig();
        
        if (!apiUrl) {
            console.warn('[URL Collector] API URL not configured. Use Settings menu to configure.');
            if (force) {
                alert('API URL not configured!\n\nPlease use "Settings (API & Database)" menu to configure.');
            }
            return;
        }
        
        if (!dbConfig.host || !dbConfig.dbname || !dbConfig.username) {
            console.warn('[URL Collector] Database configuration incomplete. Use Settings menu to configure.');
            if (force) {
                alert('Database configuration incomplete!\n\nPlease use "Settings (API & Database)" menu to configure.');
            }
            return;
        }

        // Prepare entries for sync (only id, url, type)
        const toSync = pending.map(entry => ({
            id: entry.id,
            url: entry.url,
            type: entry.type
        }));

        isSyncing = true;
        console.log(`[URL Collector] Syncing ${toSync.length} entries to database...`);
        console.log('[URL Collector] API URL:', apiUrl);
        console.log('[URL Collector] DB Config:', { host: dbConfig.host, dbname: dbConfig.dbname, username: dbConfig.username, password: '***' });
        console.log('[URL Collector] First entry sample:', toSync[0]);

        const requestData = {
            entries: toSync,
            db_config: dbConfig
        };
        
        console.log('[URL Collector] Request data size:', JSON.stringify(requestData).length, 'bytes');

        // Remove from pending immediately to prevent double-sending
        GM_setValue(STORAGE.PENDING_SYNC, []);

        GM_xmlhttpRequest({
            method: 'POST',
            url: apiUrl,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(requestData),
            onload: function(response) {
                isSyncing = false;
                
                console.log('[URL Collector] ✅ Response received!');
                console.log('[URL Collector] Response status:', response.status);
                console.log('[URL Collector] Response headers:', response.responseHeaders);
                console.log('[URL Collector] Response text:', response.responseText);
                
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const result = JSON.parse(response.responseText);
                        console.log('[URL Collector] Parsed result:', result);
                        
                        if (result.success) {
                            console.log(`[URL Collector] ✅ Success! Synced ${result.added || 0} entries (${result.skipped || 0} skipped, ${result.total || 0} total)`);
                            if (result.errors && result.errors.length > 0) {
                                console.warn('[URL Collector] ⚠️ Some errors occurred:', result.errors);
                            }
                        } else {
                            console.error(`[URL Collector] ❌ Sync failed: ${result.error}`);
                            // Restore entries to pending on failure
                            const currentPending = GM_getValue(STORAGE.PENDING_SYNC, []);
                            toSync.forEach(entry => {
                                if (!currentPending.find(e => e.id === entry.id)) {
                                    currentPending.push(entry);
                                }
                            });
                            GM_setValue(STORAGE.PENDING_SYNC, currentPending);
                            if (force) {
                                alert(`Sync failed: ${result.error}`);
                            }
                        }
                    } catch (e) {
                        console.error('[URL Collector] ❌ Failed to parse response:', e);
                        console.error('[URL Collector] Response was:', response.responseText);
                        // Restore entries to pending on parse error
                        const currentPending = GM_getValue(STORAGE.PENDING_SYNC, []);
                        toSync.forEach(entry => {
                            if (!currentPending.find(e => e.id === entry.id)) {
                                currentPending.push(entry);
                            }
                        });
                        GM_setValue(STORAGE.PENDING_SYNC, currentPending);
                        if (force) {
                            alert('Failed to parse server response. Check console for details.');
                        }
                    }
                } else {
                    isSyncing = false;
                    console.error(`[URL Collector] ❌ Sync failed with status ${response.status}`);
                    console.error('[URL Collector] Response:', response.responseText);
                    
                    // Проверяем, это 404 ошибка
                    if (response.status === 404) {
                        console.error('[URL Collector] ❌ File not found (404). Check that api.php is uploaded to the server.');
                        if (force) {
                            alert('❌ API file not found (404)\n\n' +
                                  'The file api.php is not found on the server.\n\n' +
                                  'Please check:\n' +
                                  '1. File api.php is uploaded to: ' + apiUrl + '\n' +
                                  '2. File is in the correct directory\n' +
                                  '3. File permissions are correct (644 or 755)\n' +
                                  '4. URL in settings is correct');
                        }
                    } else {
                        if (force) {
                            alert(`Sync failed with status ${response.status}\n\nResponse: ${response.responseText.substring(0, 200)}`);
                        }
                    }
                    
                    // Restore entries to pending on failure
                    const currentPending = GM_getValue(STORAGE.PENDING_SYNC, []);
                    toSync.forEach(entry => {
                        if (!currentPending.find(e => e.id === entry.id)) {
                            currentPending.push(entry);
                        }
                    });
                    GM_setValue(STORAGE.PENDING_SYNC, currentPending);
                }
            },
            onerror: function(error) {
                isSyncing = false;
                console.error('[URL Collector] ❌ Network error during sync:', error);
                console.error('[URL Collector] Error details:', JSON.stringify(error, null, 2));
                console.error('[URL Collector] Error type:', error.error);
                console.error('[URL Collector] Error message:', error.message);
                // Restore entries to pending on error
                const currentPending = GM_getValue(STORAGE.PENDING_SYNC, []);
                toSync.forEach(entry => {
                    if (!currentPending.find(e => e.id === entry.id)) {
                        currentPending.push(entry);
                    }
                });
                GM_setValue(STORAGE.PENDING_SYNC, currentPending);
                if (force) {
                    alert('Network error during sync.\n\nError: ' + (error.error || error.message || 'Unknown error') + '\n\nCheck console for details.');
                }
            },
            ontimeout: function() {
                isSyncing = false;
                console.error('[URL Collector] ❌ Request timeout');
                // Restore entries to pending on timeout
                const currentPending = GM_getValue(STORAGE.PENDING_SYNC, []);
                toSync.forEach(entry => {
                    if (!currentPending.find(e => e.id === entry.id)) {
                        currentPending.push(entry);
                    }
                });
                GM_setValue(STORAGE.PENDING_SYNC, currentPending);
                if (force) {
                    alert('Request timeout. Server may be slow or unavailable.');
                }
            }
        });
    }

    // ===== NETWORK INTERCEPTORS =====
    function setupNetworkInterceptors() {
        // Fetch
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            if (args[0]) {
                const url = typeof args[0] === 'string' ? args[0] : args[0].url;
                if (url) processNetworkUrl(url);
            }
            return originalFetch.apply(this, args);
        };

        // XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            if (url) processNetworkUrl(url.toString());
            return originalXHROpen.apply(this, [method, url, ...rest]);
        };

        // Performance entries
        setTimeout(() => {
            if (window.performance?.getEntriesByType) {
                window.performance.getEntriesByType('resource').forEach(resource => {
                    processNetworkUrl(resource.name);
                });
            }
        }, 1000);
    }

    // ===== PERIODIC SYNC =====
    function startPeriodicSync() {
        // Prevent multiple intervals
        if (syncStarted) {
            console.log('[URL Collector] Periodic sync already started');
            return;
        }
        
        if (syncIntervalId) {
            clearInterval(syncIntervalId);
            syncIntervalId = null;
        }
        
        const apiUrl = getApiUrl();
        const dbConfig = getDbConfig();
        
        if (!apiUrl || !dbConfig.host || !dbConfig.dbname || !dbConfig.username) {
            console.warn('[URL Collector] Sync disabled: API URL or Database configuration not set. Use Settings menu to configure.');
            return;
        }

        // Start periodic sync - every minute
        syncIntervalId = setInterval(() => syncToDatabase(false), CONFIG.SYNC_INTERVAL);
        syncStarted = true;
        
        console.log('[URL Collector] Periodic sync started (every 1 minute)');
    }


    // ===== START =====
    init();
})();
