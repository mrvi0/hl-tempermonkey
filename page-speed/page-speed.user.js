// ==UserScript==
// @name         Page Speed (HotelLab / RevLab)
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Скорость страницы + критичные XHR/fetch (учёт реально pending через перехват fetch/XHR в странице); hotellab.io / revlab.ru; детали в консоль
// @author       Mr Vi
// @match        *://*.hotellab.io/*
// @match        *://hotellab.io/*
// @match        *://*.revlab.ru/*
// @match        *://revlab.ru/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-start
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hotellab.io
// @updateURL    https://raw.githubusercontent.com/mrvi0/hl-tempermonkey/main/page-speed/page-speed.user.js
// @downloadURL  https://raw.githubusercontent.com/mrvi0/hl-tempermonkey/main/page-speed/page-speed.user.js
// ==/UserScript==

(function () {
    'use strict';

    /** Реальный window страницы (Tampermonkey sandbox): перехват сети только здесь видит запросы приложения. */
    const UW = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    const STORAGE_SHOW_COUNTER = 'page_speed_show_counter';
    const LOG_PREFIX = '[Page Speed]';
    const BADGE_ID = 'hl-page-speed-badge-7f3a2c';

    // ===== Настройка: только свои домены + пути «данных» (счётчики/аналитика с других хостов не учитываются) =====
    /** RegExp на pathname (без хоста), чтобы совпадало и app.revlab.ru, и app.hotellab.io и т.д. */
    const CRITICAL_PATH_REGEXES = [
        { label: 'rate-shopper gateway', re: /^\/gateway\/revenue\/rate-shopper\/\d+\/\d+\/?(?:\?.*)?$/i },
        { label: 'AdminOnly hotel change', re: /^\/ru\/AdminOnly\/mainApp\/hotels\/[0-9a-f-]+\/change\/?(?:\?.*)?$/i },
    ];
    /** Макс. ожидание после window load, пока ищем критичные ресурсы (мс). */
    const CRITICAL_WATCH_MAX_MS = 60000;
    /**
     * Если ни один запрос ещё не попал в buffer под шаблоны — не завершать замер раньше этого срока
     * (иначе XHR/fetch, который появляется в Performance только после ответа, обрежется «тишиной»).
     */
    const CRITICAL_NO_MATCH_SETTLE_MS = 15000;
    /** Сколько мс подряд без новых совпадений / без роста responseEnd — считаем замер завершённым (есть хотя бы один критичный запрос). */
    const CRITICAL_WATCH_QUIET_MS = 900;
    /** Интервал опроса buffer Resource Timing (мс). */
    const CRITICAL_POLL_MS = 200;

    /** @type {{ nav: PerformanceNavigationTiming | null, paints: PerformanceEntry[], collectedAt: number, critical?: CriticalBlock } | null} */
    let lastSnapshot = null;

    /** @typedef {{ label: string, re: RegExp }} CriticalPathDef */
    /**
     * @typedef {{
     *   status: 'pending' | 'settled',
     *   settledReason?: string,
     *   pageLoadEndMs: number,
     *   extendedReadyMs: number,
     *   resources: PerformanceResourceTiming[],
     *   maxCriticalResponseEnd: number,
     *   watchStartedAt: number,
     *   watchEndedAt?: number,
     *   hookPendingAtSettle?: number,
     *   lastHookDrainMs?: number,
     * }} CriticalBlock
     */

    let criticalWatchTimer = null;
    let criticalWatchQuietSince = 0;
    let criticalWatchLastSig = '';
    /** @type {PerformanceObserver | null} */
    let resourceObserver = null;
    /** Инкремент в stopCriticalWatch / begin: старые tick/notify не трогают состояние после settle. */
    let criticalWatchGeneration = 0;
    /** Активные fetch/XHR под CRITICAL_PATH_REGEXES (страница могла не попасть ещё в Performance buffer). */
    let criticalHookPendingCount = 0;
    /** performance.now() в момент, когда счётчик pending снова стал 0 после >0 в этом цикле наблюдения. */
    let lastCriticalHookDrainPerformanceMs = 0;
    /** Вызывается из хуков: обновить quiet и пересчитать. */
    let criticalWatchNotify = function () {};

    function getShowCounter() {
        return GM_getValue(STORAGE_SHOW_COUNTER, true);
    }

    function setShowCounter(show) {
        GM_setValue(STORAGE_SHOW_COUNTER, show);
        applyCounterVisibility();
    }

    function formatMs(ms) {
        if (ms == null || Number.isNaN(ms) || ms < 0) return '—';
        if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
        return `${Math.round(ms)} ms`;
    }

    function delta(nav, start, end) {
        if (!nav) return NaN;
        const a = nav[start];
        const b = nav[end];
        if (a == null || b == null) return NaN;
        return b - a;
    }

    function collectPaintEntries() {
        try {
            return performance.getEntriesByType('paint');
        } catch {
            return [];
        }
    }

    function isAllowedAppHost(hostname) {
        if (!hostname) return false;
        const h = String(hostname).toLowerCase();
        return (
            h === 'hotellab.io' ||
            h.endsWith('.hotellab.io') ||
            h === 'revlab.ru' ||
            h.endsWith('.revlab.ru')
        );
    }

    /**
     * @param {string} name - performance entry name (URL)
     * @returns {{ host: string, pathnameWithSearch: string } | null}
     */
    function parseResourceUrl(name) {
        try {
            const u = new URL(name, UW.location.href);
            if (!isAllowedAppHost(u.hostname)) return null;
            return { host: u.hostname, pathnameWithSearch: u.pathname + u.search };
        } catch {
            return null;
        }
    }

    /**
     * @param {string} name
     * @returns {CriticalPathDef | null}
     */
    function matchCriticalDefinition(name) {
        const parsed = parseResourceUrl(name);
        if (!parsed) return null;
        for (let i = 0; i < CRITICAL_PATH_REGEXES.length; i++) {
            const def = CRITICAL_PATH_REGEXES[i];
            if (def.re.test(parsed.pathnameWithSearch)) return def;
        }
        return null;
    }

    /**
     * @param {Request | URL | string} input
     * @returns {string} абсолютный URL или пустая строка
     */
    function hrefFromFetchInput(input) {
        try {
            if (typeof input === 'string') return new URL(input, UW.location.href).href;
            if (typeof URL !== 'undefined' && input instanceof URL) return input.href;
            if (input && typeof input === 'object' && typeof (/** @type {any} */ (input)).url === 'string') {
                return new URL((/** @type {any} */ (input)).url, UW.location.href).href;
            }
        } catch {
            return '';
        }
        return '';
    }

    function bumpHookPending(delta) {
        const prev = criticalHookPendingCount;
        criticalHookPendingCount = Math.max(0, criticalHookPendingCount + delta);
        if (prev > 0 && criticalHookPendingCount === 0) {
            lastCriticalHookDrainPerformanceMs = performance.now();
        }
        criticalWatchQuietSince = performance.now();
        try {
            criticalWatchNotify();
        } catch {
            /* ignore */
        }
    }

    function installNetworkHooks() {
        try {
            const origFetch = UW.fetch;
            if (typeof origFetch === 'function' && !(/** @type {any} */ (origFetch)).__pageSpeedWrapped) {
                const wrapped = function pageSpeedFetch(input, init) {
                    const href = hrefFromFetchInput(input);
                    const track = href && matchCriticalDefinition(href);
                    if (!track) {
                        return origFetch.call(UW, input, init);
                    }
                    bumpHookPending(1);
                    let p;
                    try {
                        p = origFetch.call(UW, input, init);
                    } catch (err) {
                        bumpHookPending(-1);
                        throw err;
                    }
                    if (p && typeof p.finally === 'function') {
                        p.finally(() => {
                            bumpHookPending(-1);
                        });
                    } else if (p && typeof p.then === 'function') {
                        p.then(
                            () => {
                                bumpHookPending(-1);
                            },
                            () => {
                                bumpHookPending(-1);
                            }
                        );
                    } else {
                        bumpHookPending(-1);
                    }
                    return p;
                };
                (/** @type {any} */ (wrapped)).__pageSpeedWrapped = true;
                UW.fetch = wrapped;
            }
        } catch {
            /* ignore */
        }

        try {
            const XHR = UW.XMLHttpRequest;
            if (!XHR || !XHR.prototype) return;
            const proto = XHR.prototype;
            if ((/** @type {any} */ (proto.send)).__pageSpeedWrapped) return;
            const origOpen = proto.open;
            const origSend = proto.send;
            proto.open = function pageSpeedXhrOpen(method, url, async, user, password) {
                try {
                    this.__pageSpeedUrl = new URL(String(url), UW.location.href).href;
                } catch {
                    this.__pageSpeedUrl = String(url);
                }
                return origOpen.apply(this, arguments);
            };
            proto.send = function pageSpeedXhrSend(body) {
                const href = this.__pageSpeedUrl || '';
                const track = href && matchCriticalDefinition(href);
                if (track) {
                    bumpHookPending(1);
                    this.addEventListener('loadend', () => bumpHookPending(-1), { once: true });
                }
                return origSend.apply(this, arguments);
            };
            (/** @type {any} */ (proto.send)).__pageSpeedWrapped = true;
        } catch {
            /* ignore */
        }
    }

    installNetworkHooks();

    /**
     * @returns {PerformanceResourceTiming[]}
     */
    function getAllResourceEntries() {
        try {
            return /** @type {PerformanceResourceTiming[]} */ (performance.getEntriesByType('resource'));
        } catch {
            return [];
        }
    }

    /**
     * @param {PerformanceResourceTiming[]} entries
     */
    function criticalResourceSignature(entries) {
        const matched = entries.filter((e) => matchCriticalDefinition(e.name));
        if (!matched.length) return '0';
        return matched
            .map((e) => {
                const re = e.responseEnd != null ? e.responseEnd.toFixed(1) : '0';
                return `${e.name}|${re}`;
            })
            .sort()
            .join('§');
    }

    /**
     * @param {PerformanceNavigationTiming | null} nav
     * @param {number} [watchStartedAt]
     * @param {number} [hookTimelineMs] — performance.now() в момент слива очереди fetch/XHR (или «сейчас», если ещё pending)
     * @returns {CriticalBlock}
     */
    function buildCriticalBlock(nav, resources, settled, reason, watchStartedAt, hookTimelineMs) {
        const pageLoadEndMs = nav && nav.loadEventEnd > 0 ? nav.loadEventEnd : 0;
        let maxCriticalResponseEnd = 0;
        resources.forEach((e) => {
            if (typeof e.responseEnd === 'number' && e.responseEnd > maxCriticalResponseEnd) {
                maxCriticalResponseEnd = e.responseEnd;
            }
        });
        const hookMs = typeof hookTimelineMs === 'number' && hookTimelineMs > 0 ? hookTimelineMs : 0;
        const extendedReadyMs = Math.max(pageLoadEndMs, maxCriticalResponseEnd, hookMs);
        return {
            status: settled ? 'settled' : 'pending',
            settledReason: reason,
            pageLoadEndMs,
            extendedReadyMs,
            resources,
            maxCriticalResponseEnd,
            watchStartedAt: typeof watchStartedAt === 'number' ? watchStartedAt : performance.now(),
            lastHookDrainMs: lastCriticalHookDrainPerformanceMs > 0 ? lastCriticalHookDrainPerformanceMs : undefined,
        };
    }

    function stopCriticalWatch() {
        criticalWatchGeneration++;
        if (criticalWatchTimer != null) {
            clearInterval(criticalWatchTimer);
            criticalWatchTimer = null;
        }
        if (resourceObserver) {
            try {
                resourceObserver.disconnect();
            } catch {
                /* ignore */
            }
            resourceObserver = null;
        }
        criticalWatchNotify = function () {};
    }

    function settleCriticalSnapshot(reason) {
        const nav = lastSnapshot && lastSnapshot.nav;
        const all = getAllResourceEntries();
        const matched = all.filter((e) => matchCriticalDefinition(e.name));
        const started =
            lastSnapshot && lastSnapshot.critical && typeof lastSnapshot.critical.watchStartedAt === 'number'
                ? lastSnapshot.critical.watchStartedAt
                : performance.now();
        const hookTimeline =
            criticalHookPendingCount > 0 ? performance.now() : Math.max(0, lastCriticalHookDrainPerformanceMs);
        const block = buildCriticalBlock(nav, matched, true, reason, started, hookTimeline);
        block.watchEndedAt = performance.now();
        block.hookPendingAtSettle = criticalHookPendingCount;
        if (lastSnapshot) {
            lastSnapshot.critical = block;
            lastSnapshot.collectedAt = performance.now();
        }
        stopCriticalWatch();
        updateBadgeText();
    }

    function beginCriticalResourceWatch() {
        stopCriticalWatch();
        lastCriticalHookDrainPerformanceMs = 0;
        const nav = lastSnapshot && lastSnapshot.nav;
        const t0 = performance.now();
        const watchGen = criticalWatchGeneration;
        criticalWatchQuietSince = t0;
        criticalWatchLastSig = '';

        if (lastSnapshot) {
            lastSnapshot.critical = buildCriticalBlock(nav, [], false, undefined, t0, 0);
        }

        const tick = () => {
            if (watchGen !== criticalWatchGeneration) return;
            const now = performance.now();
            if (now - t0 > CRITICAL_WATCH_MAX_MS) {
                settleCriticalSnapshot('таймаут CRITICAL_WATCH_MAX_MS');
                return;
            }

            if (criticalHookPendingCount > 0) {
                criticalWatchQuietSince = now;
                const all = getAllResourceEntries();
                const matched = all.filter((e) => matchCriticalDefinition(e.name));
                criticalWatchLastSig = criticalResourceSignature(all);
                if (lastSnapshot) {
                    const hookHint =
                        criticalHookPendingCount > 0 ? performance.now() : Math.max(0, lastCriticalHookDrainPerformanceMs);
                    lastSnapshot.critical = buildCriticalBlock(nav, matched, false, undefined, t0, hookHint);
                    lastSnapshot.collectedAt = now;
                }
                updateBadgeText();
                return;
            }

            const all = getAllResourceEntries();
            const matched = all.filter((e) => matchCriticalDefinition(e.name));
            const sig = criticalResourceSignature(all);

            if (matched.length > 0) {
                if (sig !== criticalWatchLastSig) {
                    criticalWatchLastSig = sig;
                    criticalWatchQuietSince = now;
                    if (lastSnapshot) {
                        lastSnapshot.critical = buildCriticalBlock(
                            nav,
                            matched,
                            false,
                            undefined,
                            t0,
                            Math.max(0, lastCriticalHookDrainPerformanceMs)
                        );
                        lastSnapshot.collectedAt = now;
                    }
                    updateBadgeText();
                } else if (now - criticalWatchQuietSince >= CRITICAL_WATCH_QUIET_MS) {
                    settleCriticalSnapshot('стабильность критичных ресурсов (quiet)');
                }
            } else {
                criticalWatchLastSig = sig;
                if (lastSnapshot) {
                    lastSnapshot.critical = buildCriticalBlock(
                        nav,
                        [],
                        false,
                        undefined,
                        t0,
                        Math.max(0, lastCriticalHookDrainPerformanceMs)
                    );
                    lastSnapshot.collectedAt = now;
                }
                updateBadgeText();
                if (now - t0 >= CRITICAL_NO_MATCH_SETTLE_MS) {
                    settleCriticalSnapshot(
                        `нет запросов под шаблоны за ${CRITICAL_NO_MATCH_SETTLE_MS} мс (см. CRITICAL_PATH_REGEXES)`
                    );
                }
            }
        };

        criticalWatchNotify = function () {
            if (watchGen === criticalWatchGeneration) tick();
        };

        try {
            resourceObserver = new PerformanceObserver(() => {
                tick();
            });
            resourceObserver.observe({ type: 'resource', buffered: true });
        } catch {
            resourceObserver = null;
        }

        criticalWatchTimer = setInterval(tick, CRITICAL_POLL_MS);
        tick();
        updateBadgeText();
    }

    function collectNavigationSnapshot() {
        const list = performance.getEntriesByType('navigation');
        const nav = list && list.length ? /** @type {PerformanceNavigationTiming} */ (list[0]) : null;
        lastSnapshot = {
            nav,
            paints: collectPaintEntries(),
            collectedAt: typeof performance.now === 'function' ? performance.now() : Date.now(),
        };
        return lastSnapshot;
    }

    function totalLoadMs(nav) {
        if (!nav) return NaN;
        if (nav.loadEventEnd > 0 && typeof nav.fetchStart === 'number') {
            return nav.loadEventEnd - nav.fetchStart;
        }
        if (typeof nav.duration === 'number' && nav.duration > 0) return nav.duration;
        return NaN;
    }

    /**
     * Время от fetchStart до момента, когда готовы документ и (если были) критичные запросы к своим доменам.
     * @param {PerformanceNavigationTiming | null} nav
     * @param {CriticalBlock | undefined} crit
     */
    function extendedReadySpanMs(nav, crit) {
        if (!nav || !crit || typeof nav.fetchStart !== 'number') return NaN;
        const end = crit.extendedReadyMs;
        if (!(end > 0)) return NaN;
        return end - nav.fetchStart;
    }

    function buildDetailLines(snapshot) {
        const nav = snapshot && snapshot.nav;
        const lines = [];
        lines.push(`URL: ${location.href}`);
        lines.push(`Время снимка: ${new Date().toISOString()}`);

        if (!nav) {
            lines.push('Navigation Timing недоступен (возможно, не полная навигация документа).');
            return lines;
        }

        lines.push('');
        lines.push('--- Сводка ---');
        lines.push(`Полная загрузка (fetchStart → loadEventEnd): ${formatMs(totalLoadMs(nav))}`);
        lines.push(`duration (API): ${formatMs(nav.duration)}`);
        lines.push(`Переход: ${nav.type} | redirectCount: ${nav.redirectCount}`);

        const crit = snapshot && snapshot.critical;
        if (crit) {
            lines.push('');
            lines.push('--- Критичные запросы (только hotellab.io / revlab.ru, см. CRITICAL_PATH_REGEXES в скрипте) ---');
            lines.push('Шаблоны путей:');
            CRITICAL_PATH_REGEXES.forEach((d) => {
                lines.push(`  · ${d.label}: ${d.re}`);
            });
            lines.push(`Статус: ${crit.status}${crit.settledReason ? ` (${crit.settledReason})` : ''}`);
            if (typeof crit.hookPendingAtSettle === 'number' && crit.hookPendingAtSettle > 0) {
                lines.push(
                    `Внимание: при завершении замера ещё числилось активных fetch/XHR по шаблонам: ${crit.hookPendingAtSettle} (таймаут?)`
                );
            }
            if (crit.status === 'pending') {
                lines.push(
                    `Активных fetch/XHR по шаблонам (перехват, сейчас): ${criticalHookPendingCount} — пока > 0, «quiet» не завершает замер`
                );
            }
            lines.push(
                `Готовность с данными (max(loadEventEnd, responseEnd критичных, момент слива очереди XHR/fetch)): ${formatMs(
                    crit.extendedReadyMs
                )} от начала навигации`
            );
            const span = extendedReadySpanMs(nav, crit);
            if (Number.isFinite(span)) {
                lines.push(`Интервал fetchStart → этот момент: ${formatMs(span)}`);
            }
            if (typeof crit.watchEndedAt === 'number' && typeof crit.watchStartedAt === 'number') {
                lines.push(`Ожидание после load (наш таймер): ${formatMs(crit.watchEndedAt - crit.watchStartedAt)}`);
            }
            if (crit.resources && crit.resources.length) {
                crit.resources.forEach((e, i) => {
                    const def = matchCriticalDefinition(e.name);
                    const label = def ? def.label : '?';
                    lines.push(
                        `  [${i + 1}] ${label}: ${e.name} | duration ${formatMs(e.duration)} | start ${formatMs(
                            e.startTime
                        )} → responseEnd ${formatMs(e.responseEnd)}`
                    );
                });
            } else {
                lines.push('  Совпадений с шаблонами путей на этом экране не зафиксировано.');
            }
        }

        lines.push('');
        lines.push('--- Фазы (все относительные, в мс) ---');
        lines.push(`DNS (domainLookup): ${formatMs(delta(nav, 'domainLookupStart', 'domainLookupEnd'))}`);
        lines.push(`TCP (connect): ${formatMs(delta(nav, 'connectStart', 'connectEnd'))}`);
        const tls = nav.secureConnectionStart > 0 ? delta(nav, 'secureConnectionStart', 'connectEnd') : NaN;
        lines.push(`TLS (если HTTPS): ${formatMs(tls)}`);
        lines.push(`Ожидание ответа (TTFB, requestStart → responseStart): ${formatMs(delta(nav, 'requestStart', 'responseStart'))}`);
        lines.push(`Загрузка HTML (responseStart → responseEnd): ${formatMs(delta(nav, 'responseStart', 'responseEnd'))}`);
        lines.push(`DOM (responseEnd → domInteractive): ${formatMs(delta(nav, 'responseEnd', 'domInteractive'))}`);
        lines.push(`domContentLoaded: ${formatMs(delta(nav, 'domContentLoadedEventStart', 'domContentLoadedEventEnd'))}`);
        lines.push(`После DCL до load (domContentLoadedEventEnd → loadEventEnd): ${formatMs(delta(nav, 'domContentLoadedEventEnd', 'loadEventEnd'))}`);
        lines.push(`load event: ${formatMs(delta(nav, 'loadEventStart', 'loadEventEnd'))}`);

        const paints = snapshot.paints || [];
        if (paints.length) {
            lines.push('');
            lines.push('--- Paint Timing ---');
            paints.forEach((e) => {
                lines.push(`${e.name}: ${formatMs(e.startTime)}`);
            });
        }

        lines.push('');
        lines.push('--- Сырые метки (PerformanceNavigationTiming, мс от начала навигации) ---');
        const keys = [
            'startTime',
            'fetchStart',
            'domainLookupStart',
            'domainLookupEnd',
            'connectStart',
            'connectEnd',
            'secureConnectionStart',
            'requestStart',
            'responseStart',
            'responseEnd',
            'domInteractive',
            'domContentLoadedEventStart',
            'domContentLoadedEventEnd',
            'domComplete',
            'loadEventStart',
            'loadEventEnd',
        ];
        keys.forEach((k) => {
            const v = nav[k];
            if (typeof v === 'number') lines.push(`${k}: ${v.toFixed(1)}`);
        });

        return lines;
    }

    function logDetailsToConsole() {
        const snap = lastSnapshot || collectNavigationSnapshot();
        const lines = buildDetailLines(snap);
        console.group(`${LOG_PREFIX} детали загрузки`);
        lines.forEach((line) => console.log(line));
        console.groupEnd();
    }

    function ensureBadge() {
        let el = document.getElementById(BADGE_ID);
        if (el) return el;
        el = document.createElement('div');
        el.id = BADGE_ID;
        el.setAttribute('title', 'Счётчик скорости загрузки (Tampermonkey → Page Speed). Клик — вывести детали в консоль.');
        document.body.appendChild(el);
        return el;
    }

    function applyCounterVisibility() {
        const el = document.getElementById(BADGE_ID);
        if (!el) return;
        el.style.display = getShowCounter() ? 'flex' : 'none';
    }

    function updateBadgeText() {
        const el = ensureBadge();
        const nav = lastSnapshot && lastSnapshot.nav;
        const crit = lastSnapshot && lastSnapshot.critical;
        const doc = totalLoadMs(nav);
        let text = '';
        if (crit && crit.status === 'pending') {
            text =
                criticalHookPendingCount > 0
                    ? `Готово … (${criticalHookPendingCount} запр.)`
                    : 'Готово …';
        } else if (crit && crit.status === 'settled') {
            const ext = extendedReadySpanMs(nav, crit);
            if (Number.isFinite(ext) && Number.isFinite(doc) && ext > doc + 50) {
                text = `Готово ${formatMs(ext)} (стр. ${formatMs(doc)})`;
            } else {
                text = Number.isFinite(doc) ? `Готово ${formatMs(doc)}` : 'Готово …';
            }
        } else {
            const main = Number.isFinite(doc) ? formatMs(doc) : '…';
            text = `Load ${main}`;
        }
        el.textContent = text;
        let title = 'Tampermonkey → Page Speed. Клик — детали в консоль.';
        if (crit && crit.status === 'settled' && crit.settledReason) {
            title += ` Замер: ${crit.settledReason}.`;
        }
        el.setAttribute('title', title);
        applyCounterVisibility();
    }

    function installStyles() {
        GM_addStyle(`
            #${BADGE_ID} {
                position: fixed !important;
                bottom: 12px !important;
                right: 12px !important;
                z-index: 2147483646 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                min-height: 32px !important;
                padding: 6px 12px !important;
                font: 12px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
                color: #e8f4ff !important;
                background: rgba(20, 40, 60, 0.92) !important;
                border: 1px solid rgba(255,255,255,0.2) !important;
                border-radius: 8px !important;
                box-shadow: 0 2px 10px rgba(0,0,0,0.25) !important;
                cursor: pointer !important;
                user-select: none !important;
                pointer-events: auto !important;
            }
            #${BADGE_ID}:hover {
                background: rgba(30, 55, 80, 0.95) !important;
            }
        `);
    }

    function onLoadComplete() {
        collectNavigationSnapshot();
        updateBadgeText();
        beginCriticalResourceWatch();
    }

    function initBadgeInteractions() {
        const el = ensureBadge();
        el.addEventListener('click', () => {
            logDetailsToConsole();
        });
    }

    function registerMenus() {
        GM_registerMenuCommand('Page Speed: переключить видимость счётчика', () => {
            setShowCounter(!getShowCounter());
            updateBadgeText();
            console.log(`${LOG_PREFIX} счётчик ${getShowCounter() ? 'показан' : 'скрыт'} (метрики по-прежнему считаются при каждой загрузке)`);
        });
        GM_registerMenuCommand('Page Speed: вывести детали загрузки в консоль', () => {
            logDetailsToConsole();
        });
    }

    function bootUi() {
        installStyles();
        registerMenus();
        initBadgeInteractions();
        ensureBadge();
        updateBadgeText();

        if (document.readyState === 'complete') {
            onLoadComplete();
        } else {
            window.addEventListener('load', onLoadComplete, { once: true });
        }

        window.addEventListener('pageshow', (ev) => {
            if (ev.persisted) {
                collectNavigationSnapshot();
                updateBadgeText();
                beginCriticalResourceWatch();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootUi, { once: true });
    } else {
        bootUi();
    }
})();
