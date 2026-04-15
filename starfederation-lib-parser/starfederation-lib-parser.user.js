// ==UserScript==
// @name         Star Federation — универсальный парсер справочника
// @namespace    tempermoneky.starfederation.lib
// @version      1.2.0
// @description  Эвристический сбор title/контента/категорий/ссылок, лог JSON из fetch/XHR, опциональный обход 5–10 страниц. Только starfederation.ru
// @author       Mr Vi
// @match        https://starfederation.ru/*
// @match        https://www.starfederation.ru/*
// @grant        GM_download
// @grant        GM_addStyle
// @grant        unsafeWindow
// @connect      starfederation.ru
// @connect      www.starfederation.ru
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /**
   * =========================
   * Config (безопасные значения по умолчанию)
   * =========================
   */
  /** Окно страницы (для перехвата реальных fetch/XHR, не изолированного sandbox) */
  const PAGE = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  const CFG = {
    maxAutoPages: 8, // 5–10 рекомендуется
    // 0 или отрицательное = без лимита (каждая найденная статья)
    maxWndHelpPages: 0,
    crawlDelayMs: 1400,
    linkLimitPerPage: 60,
    maxRawHtmlChars: 400000,
    maxContentChars: 250000,
    jsonPreviewChars: 1200,
    uiZIndex: 2147483647,
    sameOriginOnly: true,
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function nowIsoSafe() {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  function clampText(s, max) {
    if (!s) return '';
    if (s.length <= max) return s;
    return s.slice(0, max) + '\n\n[TRUNCATED]';
  }

  function normalizeWhitespace(s) {
    return (s || '')
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function safeText(el) {
    if (!el) return '';
    return normalizeWhitespace(el.textContent || '');
  }

  function safeInnerHtml(el) {
    if (!el) return '';
    const html = el.innerHTML || '';
    return clampText(html, CFG.maxRawHtmlChars);
  }

  function safeOuterHtml(el) {
    if (!el) return '';
    const html = el.outerHTML || '';
    return clampText(html, CFG.maxRawHtmlChars);
  }

  function toAbsUrl(url, base) {
    try {
      return new URL(url, base).toString();
    } catch {
      return null;
    }
  }

  function sameOrigin(urlA, urlB) {
    try {
      return new URL(urlA).origin === new URL(urlB).origin;
    } catch {
      return false;
    }
  }

  function isProbablyApi(url, contentType) {
    const u = (url || '').toLowerCase();
    const ct = (contentType || '').toLowerCase();
    if (ct.includes('application/json')) return true;
    if (u.includes('/api/') || u.includes('graphql') || u.includes('/rest') || u.match(/\/v\d+\//)) return true;
    if (u.includes('ajax') || u.includes('json')) return true;
    // StarFederation справочник часто приходит как HTML-окно с маркером JSONDATA
    // Пример: https://starfederation.ru/?m=windows&w=WndHelp&a=lc&id=Sciences-204&level=0&_mt=...
    try {
      const uu = new URL(url, PAGE.location.href);
      const m = (uu.searchParams.get('m') || '').toLowerCase();
      const w = (uu.searchParams.get('w') || '').toLowerCase();
      const id = uu.searchParams.get('id');
      if (m === 'windows' && w === 'wndhelp' && id) return true;
    } catch {
      // ignore
    }
    return false;
  }

  function isWndHelpArticleUrl(url, baseUrl) {
    try {
      const u = new URL(url, baseUrl || PAGE.location.href);
      const m = (u.searchParams.get('m') || '').toLowerCase();
      const w = (u.searchParams.get('w') || '').toLowerCase();
      const id = u.searchParams.get('id');
      return m === 'windows' && w === 'wndhelp' && !!id;
    } catch {
      return false;
    }
  }

  function extractJsonDataFromHtml(htmlText) {
    if (typeof htmlText !== 'string' || !htmlText) return null;
    // <!-- JSONDATA {"RESULT":"OK",...}-->
    const m = htmlText.match(/<!--\s*JSONDATA\s*({[\s\S]*?})\s*-->/i);
    if (!m || !m[1]) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }

  function looksLikeJunkContainer(el) {
    if (!el || el.nodeType !== 1) return true;
    const tag = el.tagName.toLowerCase();
    if (['nav', 'footer', 'header', 'aside', 'form', 'button'].includes(tag)) return true;

    const role = (el.getAttribute('role') || '').toLowerCase();
    if (['navigation', 'banner', 'contentinfo', 'complementary', 'search'].includes(role)) return true;

    const clsId = ((el.className || '') + ' ' + (el.id || '')).toLowerCase();
    const junkHints = [
      'nav', 'navbar', 'menu', 'footer', 'header', 'cookie', 'consent',
      'advert', 'ads', 'ad-', 'banner', 'promo', 'social', 'share',
      'sidebar', 'aside', 'breadcrumb', 'breadcrumbs',
      'pagination', 'pager', 'toolbar', 'filters', 'search',
      'modal', 'popup', 'overlay', 'dialog',
      'comment', 'comments', 'reply',
      'subscribe', 'newsletter',
    ];
    if (junkHints.some((h) => clsId.includes(h))) return true;

    const style = window.getComputedStyle(el);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return true;

    return false;
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    const style = window.getComputedStyle(el);
    if (!style) return true;
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    return true;
  }

  function scoreContentCandidate(el) {
    if (!el || el.nodeType !== 1) return -Infinity;
    if (!isVisible(el)) return -Infinity;

    const tag = el.tagName.toLowerCase();

    let score = 0;
    if (tag === 'article') score += 120;
    if (tag === 'main') score += 90;
    if (tag === 'section') score += 30;
    if (tag === 'div') score += 10;

    const text = safeText(el);
    const len = text.length;
    if (len < 200) return -Infinity;

    score += Math.min(500, Math.log10(len + 1) * 160);

    const links = el.querySelectorAll('a');
    const linkTextLen = Array.from(links).reduce((sum, a) => sum + safeText(a).length, 0);
    const linkDensity = linkTextLen / Math.max(1, len);
    score -= Math.min(250, linkDensity * 600);

    const controls = el.querySelectorAll('button,input,select,textarea');
    score -= Math.min(200, controls.length * 8);

    const clsId = ((el.className || '') + ' ' + (el.id || '')).toLowerCase();
    const penalties = [
      ['nav', 120], ['menu', 100], ['footer', 140], ['header', 80],
      ['sidebar', 90], ['breadcrumb', 60], ['comment', 80],
      ['share', 60], ['social', 60], ['ad', 160], ['promo', 120],
      ['cookie', 120], ['consent', 120], ['search', 60], ['filter', 60],
    ];
    for (const [k, p] of penalties) {
      if (clsId.includes(k)) score -= p;
    }

    const pCount = el.querySelectorAll('p').length;
    score += Math.min(120, pCount * 6);

    const hCount = el.querySelectorAll('h1,h2,h3').length;
    score += Math.min(90, hCount * 10);

    let parent = el.parentElement;
    let depth = 0;
    while (parent && depth < 4) {
      if (looksLikeJunkContainer(parent)) {
        score -= 120;
        break;
      }
      parent = parent.parentElement;
      depth++;
    }

    return score;
  }

  function findBestContentRoot(doc) {
    const candidates = [];

    const semantic = doc.querySelectorAll('article, main, section');
    semantic.forEach((el) => {
      if (!looksLikeJunkContainer(el)) candidates.push(el);
    });

    const divs = doc.querySelectorAll('div');
    divs.forEach((el) => {
      if (candidates.length > 1200) return;
      if (looksLikeJunkContainer(el)) return;
      candidates.push(el);
    });

    let best = null;
    let bestScore = -Infinity;
    for (const el of candidates) {
      const s = scoreContentCandidate(el);
      if (s > bestScore) {
        bestScore = s;
        best = el;
      }
    }

    if (!best) best = doc.body || doc.documentElement;
    return best;
  }

  function extractTitle(doc) {
    const h1 = doc.querySelector('h1');
    const h1Text = safeText(h1);
    if (h1Text && h1Text.length >= 2) return h1Text;

    const t = normalizeWhitespace(doc.title || '');
    return t || '';
  }

  function extractHeadings(doc, rootEl) {
    const scope = rootEl || doc;
    const hs = scope.querySelectorAll('h1,h2,h3');
    const out = [];
    hs.forEach((h) => {
      if (!isVisible(h)) return;
      const text = safeText(h);
      if (!text) return;
      out.push({
        level: h.tagName.toLowerCase(),
        text,
      });
    });
    const seen = new Set();
    return out.filter((x) => {
      const k = x.level + '|' + x.text;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function extractBreadcrumbCategory(doc) {
    const breadcrumbSelectors = [
      'nav[aria-label*="breadcrumb" i]',
      'nav.breadcrumb, nav.breadcrumbs',
      '.breadcrumb, .breadcrumbs',
      '[class*="breadcrumb" i]',
      '[aria-label*="breadcrumb" i]',
    ];

    for (const sel of breadcrumbSelectors) {
      const el = doc.querySelector(sel);
      if (!el) continue;
      const links = el.querySelectorAll('a');
      const parts = Array.from(links).map((a) => safeText(a)).filter(Boolean);
      if (parts.length >= 2) return parts.join(' > ');
      const txt = safeText(el);
      if (txt && txt.length > 10) return clampText(txt, 200);
    }

    const sidebarSelectors = [
      'aside',
      '[role="complementary"]',
      '[class*="sidebar" i]',
      '[id*="sidebar" i]',
      '[class*="toc" i]',
      '[id*="toc" i]',
    ];

    let best = '';
    for (const sel of sidebarSelectors) {
      const el = doc.querySelector(sel);
      if (!el) continue;
      const items = el.querySelectorAll('a, li');
      const texts = Array.from(items)
        .map((n) => safeText(n))
        .filter((t) => t && t.length >= 2 && t.length <= 60);

      const uniq = [];
      const s = new Set();
      for (const t of texts) {
        if (s.has(t)) continue;
        s.add(t);
        uniq.push(t);
        if (uniq.length >= 8) break;
      }
      const candidate = uniq.join(' > ');
      if (candidate.length > best.length) best = candidate;
    }

    return clampText(best, 300);
  }

  function isNavigationLink(a) {
    if (!a || a.nodeType !== 1) return true;
    const href = a.getAttribute('href') || '';
    if (!href) return true;

    if (/^(mailto:|tel:|javascript:)/i.test(href)) return true;

    const txt = safeText(a);
    const clsId = ((a.className || '') + ' ' + (a.id || '')).toLowerCase();
    const rel = (a.getAttribute('rel') || '').toLowerCase();

    if (rel.includes('nofollow') && txt.length < 30) return true;

    const navWords = ['login', 'sign', 'register', 'home', 'privacy', 'terms', 'cookie', 'contact', 'support'];
    const t = (txt || '').toLowerCase();
    if (navWords.some((w) => t === w || t.includes(w))) {
      if (txt.length <= 20) return true;
    }

    const junkHints = ['nav', 'menu', 'footer', 'header', 'breadcrumb', 'share', 'social', 'btn', 'button'];
    if (junkHints.some((h) => clsId.includes(h))) return true;

    return false;
  }

  function extractSimilarLinks(doc, rootEl, baseUrl) {
    const scope = rootEl || doc;
    const anchors = Array.from(scope.querySelectorAll('a')).slice(0, 5000);

    const base = baseUrl || (doc.location ? doc.location.href : '');
    const baseU = (() => {
      try { return new URL(base); } catch { return null; }
    })();

    const out = [];
    const seen = new Set();

    for (const a of anchors) {
      if (!isVisible(a)) continue;
      if (isNavigationLink(a)) continue;

      const href = a.getAttribute('href');
      const abs = toAbsUrl(href, base);
      if (!abs) continue;

      try {
        const u = new URL(abs);
        u.hash = '';
        const cleaned = u.toString();
        if (!cleaned) continue;

        if (CFG.sameOriginOnly && baseU && u.origin !== baseU.origin) continue;

        if (baseU) {
          const u2 = new URL(baseU.toString());
          u2.hash = '';
          if (u2.toString() === cleaned) continue;
        }

        if (baseU) {
          const pA = (u.pathname || '').split('/').filter(Boolean);
          const pB = (baseU.pathname || '').split('/').filter(Boolean);
          const shared =
            (pA[0] && pB[0] && pA[0] === pB[0]) ||
            (u.pathname && baseU.pathname && (u.pathname.startsWith(baseU.pathname.slice(0, 10)) || baseU.pathname.startsWith(u.pathname.slice(0, 10))));
          const articleish = /\/(wiki|guide|docs|article|post|knowledge|encyclo|help)\b/i.test(u.pathname);
          const wndHelpish = isWndHelpArticleUrl(cleaned, baseU.toString());
          if (!shared && !articleish && !wndHelpish) continue;
        }

        const text = safeText(a);
        const key = cleaned;
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({ url: cleaned, text: clampText(text, 140) });
        if (out.length >= CFG.linkLimitPerPage) break;
      } catch {
        continue;
      }
    }

    return out;
  }

  function extractContentText(rootEl) {
    const clone = rootEl.cloneNode(true);

    clone.querySelectorAll('script,style,noscript,svg,canvas,iframe').forEach((n) => n.remove());

    const junkSel = [
      'nav', 'footer', 'header', 'aside',
      '[role="navigation"]', '[role="contentinfo"]', '[role="banner"]', '[role="search"]',
      'form', 'button',
      '[class*="cookie" i]', '[class*="consent" i]',
      '[class*="advert" i]', '[class*="ads" i]', '[id*="ads" i]',
      '[class*="promo" i]',
      '[class*="share" i]', '[class*="social" i]',
      '[class*="comment" i]',
      '[class*="breadcrumb" i]',
      '[class*="sidebar" i]',
      '[aria-label*="breadcrumb" i]',
    ];
    clone.querySelectorAll(junkSel.join(',')).forEach((n) => n.remove());

    const text = normalizeWhitespace(clone.textContent || '');
    return clampText(text, CFG.maxContentChars);
  }

  function collectPageData(doc, urlHint) {
    const url = urlHint || (doc.location ? doc.location.href : '');
    const contentRoot = findBestContentRoot(doc);

    const title = extractTitle(doc);
    const headings = extractHeadings(doc, contentRoot);
    const content = extractContentText(contentRoot);
    const category = extractBreadcrumbCategory(doc);
    const links = extractSimilarLinks(doc, contentRoot, url);
    const raw_html = safeInnerHtml(contentRoot) || safeOuterHtml(doc.documentElement);

    return {
      url,
      title,
      content,
      headings,
      links,
      category,
      raw_html,
    };
  }

  const netLog = {
    entries: [],
    add(entry) {
      this.entries.push(entry);
      if (this.entries.length > 300) this.entries.shift();
    },
  };

  function tryParseJson(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  function setupFetchPatch() {
    if (PAGE.__tm_sf_fetch_patched__) return;
    PAGE.__tm_sf_fetch_patched__ = true;

    const origFetch = PAGE.fetch;
    if (typeof origFetch !== 'function') return;

    PAGE.fetch = async function (...args) {
      const start = Date.now();
      let url = '';
      let method = 'GET';
      try {
        const input = args[0];
        const init = args[1] || {};
        method = (init.method || (input && input.method) || 'GET').toUpperCase();

        if (typeof input === 'string') url = input;
        else if (input && typeof input.url === 'string') url = input.url;
      } catch {
        // ignore
      }

      const res = await origFetch.apply(this, args);

      try {
        const ct = res.headers.get('content-type') || '';
        const clone = res.clone();

        const isJson = ct.toLowerCase().includes('application/json') || ct.toLowerCase().includes('+json');
        const absUrl = toAbsUrl(url, PAGE.location.href) || url;
        if (isJson) {
          const text = await clone.text();
          const parsed = tryParseJson(text);

          const entry = {
            kind: 'fetch',
            url: absUrl,
            method,
            status: res.status,
            contentType: ct,
            ms: Date.now() - start,
            isApiLike: isProbablyApi(absUrl, ct),
            jsonPreview: clampText(text, CFG.jsonPreviewChars),
            json: parsed,
          };

          console.log('[SF][JSON][fetch]', entry.url, entry);
          netLog.add(entry);
        } else {
          // Если справочник пришёл HTML, но внутри есть <!-- JSONDATA {...} --> — тоже логируем как JSON-событие
          const isHtml = ct.toLowerCase().includes('text/html') || ct.toLowerCase().includes('application/xhtml');
          if (isHtml && isWndHelpArticleUrl(absUrl, PAGE.location.href)) {
            const text = await clone.text();
            const jsonData = extractJsonDataFromHtml(text);
            if (jsonData) {
              const entry = {
                kind: 'fetch:jsondata',
                url: absUrl,
                method,
                status: res.status,
                contentType: ct,
                ms: Date.now() - start,
                isApiLike: true,
                jsonPreview: clampText(JSON.stringify(jsonData), CFG.jsonPreviewChars),
                json: jsonData,
              };
              console.log('[SF][JSONDATA][fetch]', entry.url, entry);
              netLog.add(entry);
            }
          }
        }
      } catch (e) {
        console.warn('[SF][fetch patch] JSON read failed', e);
      }

      return res;
    };
  }

  function setupXhrPatch() {
    if (PAGE.__tm_sf_xhr_patched__) return;
    PAGE.__tm_sf_xhr_patched__ = true;

    const XHR = PAGE.XMLHttpRequest;
    if (!XHR) return;

    const origOpen = XHR.prototype.open;
    const origSend = XHR.prototype.send;

    XHR.prototype.open = function (method, url, ...rest) {
      this.__tm_sf = this.__tm_sf || {};
      this.__tm_sf.method = (method || 'GET').toUpperCase();
      this.__tm_sf.url = url;
      this.__tm_sf.start = Date.now();
      return origOpen.call(this, method, url, ...rest);
    };

    XHR.prototype.send = function (...args) {
      this.addEventListener('loadend', () => {
        try {
          const ct = (this.getResponseHeader('content-type') || '').toLowerCase();
          const isJson = ct.includes('application/json') || ct.includes('+json');
          const url = this.__tm_sf && this.__tm_sf.url ? this.__tm_sf.url : '';
          const abs = toAbsUrl(url, PAGE.location.href) || url;

          let text = '';
          if (typeof this.responseText === 'string') text = this.responseText;
          else if (typeof this.response === 'string') text = this.response;
          else text = JSON.stringify(this.response);

          if (isJson) {
            const parsed = tryParseJson(text);

            const entry = {
              kind: 'xhr',
              url: abs,
              method: (this.__tm_sf && this.__tm_sf.method) || 'GET',
              status: this.status,
              contentType: ct,
              ms: Date.now() - ((this.__tm_sf && this.__tm_sf.start) || Date.now()),
              isApiLike: isProbablyApi(abs, ct),
              jsonPreview: clampText(text, CFG.jsonPreviewChars),
              json: parsed,
            };

            console.log('[SF][JSON][xhr]', entry.url, entry);
            netLog.add(entry);
          } else {
            // XHR может вернуть HTML с JSONDATA-комментарием
            const isHtml = ct.includes('text/html') || ct.includes('application/xhtml');
            if (isHtml && isWndHelpArticleUrl(abs, PAGE.location.href)) {
              const jsonData = extractJsonDataFromHtml(text);
              if (jsonData) {
                const entry = {
                  kind: 'xhr:jsondata',
                  url: abs,
                  method: (this.__tm_sf && this.__tm_sf.method) || 'GET',
                  status: this.status,
                  contentType: ct,
                  ms: Date.now() - ((this.__tm_sf && this.__tm_sf.start) || Date.now()),
                  isApiLike: true,
                  jsonPreview: clampText(JSON.stringify(jsonData), CFG.jsonPreviewChars),
                  json: jsonData,
                };
                console.log('[SF][JSONDATA][xhr]', entry.url, entry);
                netLog.add(entry);
              }
            }
          }
        } catch (e) {
          console.warn('[SF][xhr patch] JSON read failed', e);
        }
      });

      return origSend.apply(this, args);
    };
  }

  function downloadJson(filename, obj) {
    const data = JSON.stringify(obj, null, 2);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    if (typeof GM_download === 'function') {
      try {
        GM_download({ url, name: filename, saveAs: true });
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        return;
      } catch {
        // fallback
      }
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function waitForElement(selector, timeoutMs = 15000) {
    return new Promise((resolve) => {
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);

      let done = false;
      const t = setTimeout(() => {
        done = true;
        observer.disconnect();
        resolve(null);
      }, timeoutMs);

      const observer = new MutationObserver(() => {
        if (done) return;
        const el = document.querySelector(selector);
        if (el) {
          done = true;
          clearTimeout(t);
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  function openWndHelp() {
    try {
      if (typeof PAGE.getWindow === 'function') {
        const wnd = PAGE.getWindow('WndHelp');
        if (wnd && typeof wnd.show === 'function') {
          // Пустой show обычно поднимает окно/последнее состояние
          wnd.show('');
          return true;
        }
      }
    } catch {
      // ignore
    }

    // Fallback: ищем кликабельный элемент, который открывает WndHelp
    const candidates = Array.from(document.querySelectorAll('[onclick]')).slice(0, 3000);
    for (const el of candidates) {
      const code = (el.getAttribute('onclick') || '').toLowerCase();
      if (code.includes('getwindow') && code.includes('wndhelp')) {
        try {
          el.click();
          return true;
        } catch {
          // ignore
        }
      }
    }
    return false;
  }

  function parseIdFromOnclick(onclick) {
    if (!onclick) return null;
    // "...show(\"id=Sciences-204&level=0\");" / "...show('id=Buildings-92&level=0');"
    const m = String(onclick).match(/id=([A-Za-z]+-\d+(?::\d+)?)\b/);
    return m && m[1] ? m[1] : null;
  }

  function getHelpIdsFromTree(treeEl) {
    if (!treeEl) return [];

    const ids = [];
    const seen = new Set();

    // 0) Лучший путь: dhtmlXTree-объект (DOM может не содержать id=... вообще)
    try {
      if (typeof PAGE.getWindow === 'function') {
        const wnd = PAGE.getWindow('WndHelp');
        const tree = wnd && wnd.tree ? wnd.tree : null;
        if (tree) {
          // 0.1) Публичные методы
          const tryMethods = [
            () => (typeof tree.getAllSubItems === 'function' ? tree.getAllSubItems(0) : ''),
            () => (typeof tree.getAllSubItems === 'function' ? tree.getAllSubItems('0') : ''),
            () => (typeof tree.getAllSubItems === 'function' && typeof tree.getRootId === 'function' ? tree.getAllSubItems(tree.getRootId()) : ''),
            () => (typeof tree.getAllSubItems === 'function' && tree.rootId != null ? tree.getAllSubItems(tree.rootId) : ''),
          ];
          for (const fn of tryMethods) {
            let raw = '';
            try { raw = fn() || ''; } catch { raw = ''; }
            const parts = String(raw)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            for (const id of parts) {
              if (seen.has(id)) continue;
              // типичные help id: Sciences-204, Buildings-92, ...
              if (!/^[A-Za-z]+-\d+/.test(id)) continue;
              seen.add(id);
              ids.push(id);
            }
            if (ids.length) break;
          }

          // 0.2) Внутреннее хранилище (fallback)
          if (!ids.length && tree._idpull && typeof tree._idpull === 'object') {
            for (const k of Object.keys(tree._idpull)) {
              if (!/^[A-Za-z]+-\d+/.test(k)) continue;
              if (seen.has(k)) continue;
              seen.add(k);
              ids.push(k);
            }
          }
        }
      }
    } catch {
      // ignore
    }

    if (ids.length) return ids;

    // 1) onclick handlers with id=...
    const clickables = treeEl.querySelectorAll('[onclick]');
    clickables.forEach((el) => {
      const id = parseIdFromOnclick(el.getAttribute('onclick'));
      if (!id) return;
      if (seen.has(id)) return;
      seen.add(id);
      ids.push(id);
    });

    // 2) href that looks like wndhelp
    const links = treeEl.querySelectorAll('a[href]');
    links.forEach((a) => {
      const href = a.getAttribute('href');
      const abs = toAbsUrl(href, PAGE.location.href);
      if (!abs) return;
      try {
        const u = new URL(abs);
        const id = u.searchParams.get('id');
        if (!id) return;
        if (!isWndHelpArticleUrl(abs, PAGE.location.href)) return;
        if (seen.has(id)) return;
        seen.add(id);
        ids.push(id);
      } catch {
        // ignore
      }
    });

    return ids;
  }

  async function expandWndHelpTreeAndCollectIds(treeEl) {
    // Цель: пройти по каждой родительской категории и раскрывать её, пока не доберёмся до листьев.
    // На практике dhtmlXTree часто подгружает детей лениво ТОЛЬКО после selectItem/openItem.
    let tree = null;
    try {
      if (typeof PAGE.getWindow === 'function') {
        const wnd = PAGE.getWindow('WndHelp');
        tree = wnd && wnd.tree ? wnd.tree : null;
      }
    } catch {
      tree = null;
    }

    if (!tree) return getHelpIdsFromTree(treeEl);

    const visited = new Set();
    const articles = new Set();

    const maxNodes = 120000; // hard safety cap
    const maxSteps = 250000; // hard safety cap

    const rootsToTry = [];
    if (typeof tree.getRootId === 'function') {
      try { rootsToTry.push(tree.getRootId()); } catch { /* ignore */ }
    }
    rootsToTry.push(0, '0', tree.rootId);
    const root = rootsToTry.find((x) => x != null) ?? 0;

    const parseCsv = (raw) =>
      String(raw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const getChildrenOnce = (nodeId) => {
      // DHTMLX: getSubItems(id) => "child1,child2" (может требовать предварительного открытия/выбора)
      const out = [];
      try {
        if (typeof tree.getSubItems === 'function') {
          parseCsv(tree.getSubItems(nodeId)).forEach((x) => out.push(x));
        }
      } catch {
        // ignore
      }
      // Fallback: если доступно getAllSubItems, берём все потомки и отсекаем до разумного
      if (!out.length) {
        try {
          if (typeof tree.getAllSubItems === 'function') {
            parseCsv(tree.getAllSubItems(nodeId)).slice(0, 5000).forEach((x) => out.push(x));
          }
        } catch {
          // ignore
        }
      }
      return out;
    };

    const touchNode = async (nodeId) => {
      // Важно: именно selectItem часто триггерит подгрузку ветки/детей
      try { if (typeof tree.openItem === 'function') tree.openItem(nodeId); } catch { /* ignore */ }
      try { if (typeof tree.selectItem === 'function') tree.selectItem(nodeId, false, false); } catch { /* ignore */ }
      await sleep(260);
      // иногда нужно повторить open после select
      try { if (typeof tree.openItem === 'function') tree.openItem(nodeId); } catch { /* ignore */ }
      await sleep(260);
    };

    const getChildrenWithRetries = async (nodeId) => {
      // Некоторые ветки появляются только после пары open/select циклов
      let best = [];
      for (let i = 0; i < 4; i++) {
        const kids = getChildrenOnce(nodeId);
        if (kids.length > best.length) best = kids;
        if (best.length) break;
        await touchNode(nodeId);
      }
      return best;
    };

    const enqueueMany = (arr, queue) => {
      for (const x of arr) {
        const s = String(x);
        if (!s) continue;
        if (visited.has(s)) continue;
        visited.add(s);
        queue.push(s);
        if (/^[A-Za-z]+-\d+/.test(s)) articles.add(s);
      }
    };

    const queue = [root];
    visited.add(String(root));
    let steps = 0;

    while (queue.length) {
      const nodeId = queue.shift();
      if (nodeId == null) continue;
      steps++;
      if (steps > maxSteps) break;
      if (visited.size > maxNodes) break;

      const idStr = String(nodeId);
      if (/^[A-Za-z]+-\d+/.test(idStr)) articles.add(idStr);

      await touchNode(nodeId);
      const children = await getChildrenWithRetries(nodeId);

      // Дополнительный источник: если дерево хранит пул узлов, подхватываем новые
      if (tree._idpull && typeof tree._idpull === 'object') {
        enqueueMany(Object.keys(tree._idpull), queue);
      }

      enqueueMany(children, queue);

      // Периодически пересканируем всё дерево от root — некоторые ветки появляются только глобально
      if (steps % 35 === 0) {
        try {
          if (typeof tree.getAllSubItems === 'function') {
            enqueueMany(parseCsv(tree.getAllSubItems(root)), queue);
          }
        } catch {
          // ignore
        }
      }
    }

    return Array.from(articles);
  }

  async function traverseWndHelpTreeAndCollectPages(opts) {
    const treeEl = opts && opts.treeEl ? opts.treeEl : null;
    const setStatus = opts && typeof opts.setStatus === 'function' ? opts.setStatus : () => {};

    let tree = null;
    try {
      if (typeof PAGE.getWindow === 'function') {
        const wnd = PAGE.getWindow('WndHelp');
        tree = wnd && wnd.tree ? wnd.tree : null;
      }
    } catch {
      tree = null;
    }
    if (!tree) {
      setStatus('справочник: нет доступа к wnd.tree');
      return { pages: [], total_ids: 0 };
    }

    const parseCsv = (raw) =>
      String(raw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const visitedNodes = new Set();
    const discoveredArticles = new Set();
    const collectedArticles = new Set();
    const pages = [];

    const limit = CFG.maxWndHelpPages;
    const unlimited = limit == null || limit === 0 || limit < 0;

    const maxNodes = 120000; // safety cap
    const maxSteps = 250000; // safety cap

    const rootsToTry = [];
    if (typeof tree.getRootId === 'function') {
      try { rootsToTry.push(tree.getRootId()); } catch { /* ignore */ }
    }
    rootsToTry.push(0, '0', tree.rootId);
    const root = rootsToTry.find((x) => x != null) ?? 0;

    const touchNode = async (nodeId) => {
      try { if (typeof tree.openItem === 'function') tree.openItem(nodeId); } catch { /* ignore */ }
      try { if (typeof tree.selectItem === 'function') tree.selectItem(nodeId, false, false); } catch { /* ignore */ }
      await sleep(260);
      try { if (typeof tree.openItem === 'function') tree.openItem(nodeId); } catch { /* ignore */ }
      await sleep(260);
    };

    const getChildrenOnce = (nodeId) => {
      const out = [];
      try {
        if (typeof tree.getSubItems === 'function') {
          parseCsv(tree.getSubItems(nodeId)).forEach((x) => out.push(x));
        }
      } catch {
        // ignore
      }
      if (!out.length) {
        try {
          if (typeof tree.getAllSubItems === 'function') {
            parseCsv(tree.getAllSubItems(nodeId)).slice(0, 5000).forEach((x) => out.push(x));
          }
        } catch {
          // ignore
        }
      }
      return out;
    };

    const getChildrenWithRetries = async (nodeId) => {
      let best = [];
      for (let i = 0; i < 4; i++) {
        const kids = getChildrenOnce(nodeId);
        if (kids.length > best.length) best = kids;
        if (best.length) break;
        await touchNode(nodeId);
      }
      return best;
    };

    const enqueue = (id, q) => {
      const s = String(id);
      if (!s) return;
      if (visitedNodes.has(s)) return;
      visitedNodes.add(s);
      q.push(s);
    };

    const noteArticle = (id) => {
      const s = String(id);
      if (!/^[A-Za-z]+-\d+/.test(s)) return;
      discoveredArticles.add(s);
    };

    const openAndCollectArticle = async (articleId, prevFp) => {
      setStatus(`справочник: сбор (${pages.length + 1}) ${articleId}`);

      try {
        showWndHelpId(articleId, 0);
      } catch {
        // ignore
      }
      try {
        if (typeof tree.selectItem === 'function') tree.selectItem(articleId, false, false);
      } catch {
        // ignore
      }

      await waitForWndHelpContentReady({
        prevFingerprint: prevFp,
        minLen: 30,
        timeoutMs: 20000,
      });
      await sleep(Math.max(350, CFG.crawlDelayMs));

      let data = null;
      try {
        data = collectWndHelpCurrentContent(articleId);
      } catch (err) {
        console.warn('[SF] collect page failed', articleId, err);
      }

      if (data && (data.content || '').trim().length > 0) {
        pages.push(data);
        return (data.content || '').slice(0, 200);
      }

      if (data) {
        pages.push({ ...data, error: 'empty_content' });
        return (data.content || '').slice(0, 200);
      }

      pages.push({
        id: articleId,
        url: buildWndHelpUrlForId(articleId, 0),
        title: '',
        content: '',
        headings: [],
        links: [],
        category: '',
        raw_html: '',
        error: 'no_WndHelp_content',
      });
      return prevFp;
    };

    const queue = [];
    enqueue(root, queue);

    let steps = 0;
    let prevContentFp = null;

    while (queue.length) {
      const nodeId = queue.shift();
      if (nodeId == null) continue;
      steps++;
      if (steps > maxSteps) break;
      if (visitedNodes.size > maxNodes) break;

      // На некоторых реализациях категория/лист может быть articleId
      noteArticle(nodeId);

      await touchNode(nodeId);

      // подхватить новые узлы из пула
      if (tree._idpull && typeof tree._idpull === 'object') {
        for (const k of Object.keys(tree._idpull)) {
          enqueue(k, queue);
          noteArticle(k);
        }
      }

      const children = await getChildrenWithRetries(nodeId);
      for (const ch of children) {
        enqueue(ch, queue);
        noteArticle(ch);
      }

      // периодический глобальный перескан
      if (steps % 35 === 0) {
        try {
          if (typeof tree.getAllSubItems === 'function') {
            for (const k of parseCsv(tree.getAllSubItems(root))) {
              enqueue(k, queue);
              noteArticle(k);
            }
          }
        } catch {
          // ignore
        }
      }

      // Инкрементально собираем всё, что уже нашли
      if (discoveredArticles.size) {
        for (const id of Array.from(discoveredArticles)) {
          if (collectedArticles.has(id)) continue;
          if (!unlimited && pages.length >= Math.max(1, limit)) break;
          collectedArticles.add(id);
          prevContentFp = await openAndCollectArticle(id, prevContentFp);
        }
      }

      if (!unlimited && pages.length >= Math.max(1, limit)) break;
    }

    return {
      pages,
      total_ids: discoveredArticles.size,
      collected_pages: pages.length,
    };
  }

  function showWndHelpId(id, level = 0) {
    if (!id) return false;
    try {
      if (typeof PAGE.getWindow === 'function') {
        const wnd = PAGE.getWindow('WndHelp');
        if (wnd && typeof wnd.show === 'function') {
          wnd.show(`id=${encodeURIComponent(id)}&level=${encodeURIComponent(String(level))}`);
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  function waitForJsonDataForId(id, timeoutMs = 12000) {
    const start = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        // Ищем свежую запись JSONDATA, где в url есть id=...
        for (let i = netLog.entries.length - 1; i >= 0; i--) {
          const e = netLog.entries[i];
          if (!e || !e.url) continue;
          if (!String(e.kind || '').includes('jsondata')) continue;
          if (String(e.url).includes(`id=${id}`) || String(e.url).includes(`id=${encodeURIComponent(id)}`)) {
            return resolve(e);
          }
        }
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(tick, 250);
      };
      tick();
    });
  }

  function extractWndHelpTitle() {
    // В DHTMLX окне обычно есть заголовок ячейки (cells('b').setText('...'))
    const wndRoot =
      document.getElementById('WndHelp_container') ||
      document.getElementById('WndHelp_helplayout') ||
      document.getElementById('WndHelp');
    if (!wndRoot) return '';

    // Популярные варианты заголовка (в зависимости от версии DHTMLX)
    const hdrCandidates = wndRoot.querySelectorAll(
      '.dhx_cell_hdr, .dhx_cell_hdr_text, .dhxlayout_cell_header, .dhx_cell_hdr .dhx_cell_hdr_text'
    );
    let best = '';
    hdrCandidates.forEach((n) => {
      const t = safeText(n);
      if (t && t.length > best.length && t.length <= 140) best = t;
    });
    return best;
  }

  function buildWndHelpUrlForId(id, level = 0) {
    return `https://starfederation.ru/?m=windows&w=WndHelp&a=lc&id=${encodeURIComponent(id)}&level=${encodeURIComponent(String(level))}`;
  }

  function extractWndHelpLinksFromOnclick(container) {
    if (!container) return [];
    const out = [];
    const seen = new Set();

    const nodes = container.querySelectorAll('[onclick]');
    nodes.forEach((el) => {
      const code = el.getAttribute('onclick') || '';
      if (!code.toLowerCase().includes('wndhelp')) return;
      const id = parseIdFromOnclick(code);
      if (!id) return;

      const url = buildWndHelpUrlForId(id, 0);
      if (seen.has(url)) return;
      seen.add(url);

      // У img/span часто нет хорошего текста — берём ближайший понятный текст вокруг
      const text =
        safeText(el) ||
        safeText(el.closest('td') || el.closest('tr') || el.parentElement) ||
        id;

      out.push({ url, text: clampText(text, 140) });
    });

    return out;
  }

  /**
   * Основной текст справочника — всегда из #WndHelp_content (class helpcontent и т.д.).
   * Fallback — только если блока нет (старый/обрезанный DOM).
   */
  function findWndHelpContentRoot() {
    const explicit = document.getElementById('WndHelp_content');
    if (explicit) return explicit;

    const wndRoot =
      document.getElementById('WndHelp_container') ||
      document.getElementById('WndHelp_helplayout') ||
      document.getElementById('WndHelp');
    if (!wndRoot) return null;

    const strong = wndRoot.querySelector('.textcontainer, .textbox, .textbox-w');
    if (strong && safeText(strong).length > 120) return strong;

    const candidates = Array.from(wndRoot.querySelectorAll('div,section,article,main')).filter((el) => {
      if (!el) return false;
      if (el.id === 'WndHelp_treecontent') return false;
      if (el.closest('#WndHelp_treecontent')) return false;
      return true;
    });

    let best = null;
    let bestScore = -Infinity;
    for (const el of candidates) {
      const s = scoreContentCandidate(el);
      if (s > bestScore) {
        bestScore = s;
        best = el;
      }
    }

    return best || wndRoot;
  }

  /** Заголовки внутри справочника: h1–h3 и span.title (как в разметке WndHelp). */
  function extractWndHelpHeadings(container) {
    if (!container) return [];
    const out = [];
    const seen = new Set();

    container.querySelectorAll('h1,h2,h3').forEach((h) => {
      if (!isVisible(h)) return;
      const text = safeText(h);
      if (!text) return;
      const key = `${h.tagName}|${text}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ level: h.tagName.toLowerCase(), text });
    });

    container.querySelectorAll('span.title').forEach((el) => {
      const text = safeText(el);
      if (!text) return;
      const key = `span.title|${text}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ level: 'span.title', text });
    });

    return out;
  }

  /** Заголовок статьи: первый span.title в #WndHelp_content, иначе шапка окна / document.title */
  function extractWndHelpArticleTitle(container) {
    const box = document.getElementById('WndHelp_content') || container;
    if (box) {
      const first = box.querySelector('span.title');
      const t = safeText(first);
      if (t) return t;
    }
    return extractWndHelpTitle() || extractTitle(document);
  }

  /**
   * Ждём появления текста в #WndHelp_content после смены статьи (не опираемся на сетевой JSONDATA).
   */
  function waitForWndHelpContentReady(opts) {
    const minLen = (opts && opts.minLen) || 30;
    const timeoutMs = (opts && opts.timeoutMs) || 15000;
    const prevFingerprint = opts && opts.prevFingerprint != null ? String(opts.prevFingerprint) : null;

    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const el = document.getElementById('WndHelp_content');
        const text = el ? safeText(el) : '';
        const fp = text.slice(0, 200);
        const longEnough = text.length >= minLen;
        const changed = prevFingerprint == null || fp !== prevFingerprint;

        if (el && longEnough && changed) {
          return resolve({ el, text, fingerprint: fp });
        }
        if (Date.now() - start >= timeoutMs) {
          return resolve({ el: el || null, text, fingerprint: fp });
        }
        setTimeout(tick, 180);
      };
      tick();
    });
  }

  function collectWndHelpCurrentContent(id) {
    const contentRoot = findWndHelpContentRoot();
    if (!contentRoot) return null;

    const title = extractWndHelpArticleTitle(contentRoot);
    const headings = extractWndHelpHeadings(contentRoot);
    const content = extractContentText(contentRoot);
    const category = extractBreadcrumbCategory(document);
    const links = [
      ...extractSimilarLinks(document, contentRoot, PAGE.location.href),
      ...extractWndHelpLinksFromOnclick(contentRoot),
    ];
    const raw_html = safeInnerHtml(contentRoot);

    return {
      id,
      url: buildWndHelpUrlForId(id, 0),
      title,
      content,
      headings,
      links,
      category,
      raw_html,
    };
  }

  function setupUi() {
    if (document.getElementById('__sf_scrape_btn__')) return;

    if (typeof GM_addStyle === 'function') {
      GM_addStyle(`
#__sf_scrape_btn__{
  position:fixed; top:12px; right:12px; z-index:${CFG.uiZIndex};
  background:#111827; color:#fff; border:1px solid rgba(255,255,255,.15);
  padding:10px 12px; border-radius:10px; font: 13px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  cursor:pointer; box-shadow:0 10px 25px rgba(0,0,0,.25);
}
#__sf_scrape_btn__:hover{ background:#0b1220; }
#__sf_scrape_panel__{
  position:fixed; top:56px; right:12px; z-index:${CFG.uiZIndex};
  width:320px; max-height:55vh; overflow:auto;
  background:rgba(17,24,39,.96); color:#e5e7eb; border:1px solid rgba(255,255,255,.12);
  padding:10px 12px; border-radius:12px;
  font: 12px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  display:none;
}
#__sf_scrape_panel__ .row{ margin:6px 0; }
#__sf_scrape_panel__ code{ color:#93c5fd; }
#__sf_scrape_panel__ button{
  background:#1f2937; color:#fff; border:1px solid rgba(255,255,255,.12);
  padding:6px 8px; border-radius:9px; cursor:pointer; margin-right:8px; margin-top:6px;
}
#__sf_scrape_panel__ button:hover{ background:#111827; }
      `);
    }

    const btn = document.createElement('button');
    btn.id = '__sf_scrape_btn__';
    btn.type = 'button';
    btn.textContent = 'Собрать данные';

    const panel = document.createElement('div');
    panel.id = '__sf_scrape_panel__';
    panel.innerHTML = `
      <div class="row"><b>Star Federation — парсер</b></div>
      <div class="row">URL: <code id="__sf_u__"></code></div>
      <div class="row">Статус: <code id="__sf_s__">—</code></div>
      <div class="row">JSON в логе: <code id="__sf_n__">0</code></div>
      <div class="row">
        <button type="button" id="__sf_toggle__">Панель</button>
        <button type="button" id="__sf_crawl__">Авто 5–10</button>
        <button type="button" id="__sf_openhelp__">Открыть справочник</button>
        <button type="button" id="__sf_helpcollect__">Собрать справочник</button>
      </div>
      <div class="row"><small>Логи JSON: <code>[SF][JSON]</code> / <code>[SF][JSONDATA]</code></small></div>
    `;

    document.documentElement.appendChild(btn);
    document.documentElement.appendChild(panel);

    const uEl = panel.querySelector('#__sf_u__');
    const sEl = panel.querySelector('#__sf_s__');
    const nEl = panel.querySelector('#__sf_n__');

    function setStatus(msg) {
      if (sEl) sEl.textContent = msg;
      if (uEl) uEl.textContent = (location.href || '').slice(0, 120);
      if (nEl) nEl.textContent = String(netLog.entries.length);
    }

    setInterval(() => setStatus(sEl ? sEl.textContent : '—'), 1500);

    panel.querySelector('#__sf_toggle__')?.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      setStatus('панель');
    });

    btn.addEventListener('click', async () => {
      try {
        setStatus('сбор…');
        const data = collectPageData(document, location.href);

        const apiEndpoints = netLog.entries
          .filter((e) => e && e.isApiLike)
          .map((e) => e.url)
          .filter(Boolean);
        const uniqApi = Array.from(new Set(apiEndpoints)).slice(0, 50);

        console.log('[SF][PAGE_DATA]', data);
        console.log('[SF][API_ENDPOINTS?]', uniqApi);

        const filename = `starfederation-page-${nowIsoSafe()}.json`;
        downloadJson(filename, data);

        setStatus('готово (файл скачан)');
      } catch (e) {
        console.error('[SF] collect failed', e);
        setStatus('ошибка (см. console)');
      }
    });

    panel.querySelector('#__sf_crawl__')?.addEventListener('click', async () => {
      await autoCrawl();
    });

    panel.querySelector('#__sf_openhelp__')?.addEventListener('click', async () => {
      try {
        setStatus('открываю WndHelp…');
        const ok = openWndHelp();
        const tree = await waitForElement('#WndHelp_treecontent', 15000);
        if (!ok && !tree) {
          setStatus('WndHelp не найден (нужен клик в UI)');
          return;
        }
        setStatus(tree ? 'WndHelp готов (дерево найдено)' : 'WndHelp открыт');
      } catch (e) {
        console.error('[SF] open help failed', e);
        setStatus('ошибка открытия справочника');
      }
    });

    panel.querySelector('#__sf_helpcollect__')?.addEventListener('click', async () => {
      try {
        setStatus('справочник: ожидание дерева…');
        openWndHelp();
        const tree = await waitForElement('#WndHelp_treecontent', 20000);
        if (!tree) {
          setStatus('дерево не найдено (#WndHelp_treecontent)');
          return;
        }

        setStatus('справочник: раскрываю дерево и собираю…');
        const res = await traverseWndHelpTreeAndCollectPages({
          treeEl: tree,
          setStatus,
        });

        const bundle = {
          collected_at: new Date().toISOString(),
          source: 'WndHelp_treecontent',
          total_ids: res.total_ids,
          collected_pages: res.collected_pages,
          pages: res.pages,
        };

        console.log('[SF][WNDHELP_RESULT]', bundle);
        downloadJson(`starfederation-wndhelp-${nowIsoSafe()}.json`, bundle);
        setStatus(`справочник: готово (${res.collected_pages} стр.)`);
      } catch (e) {
        console.error('[SF] help collect failed', e);
        setStatus('ошибка сбора справочника');
      }
    });

    panel.style.display = 'block';
  }

  async function fetchHtml(url) {
    const res = await fetch(url, { credentials: 'include' });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    if (!ct.includes('text/html') && !ct.includes('application/xhtml') && !ct.includes('xml')) {
      // допускаем text/plain
    }
    return await res.text();
  }

  function parseHtmlToDoc(html, url) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.__tm_baseUrl = url;
    return doc;
  }

  async function autoCrawl() {
    const panel = document.getElementById('__sf_scrape_panel__');
    const sEl = panel ? panel.querySelector('#__sf_s__') : null;

    const set = (msg) => { if (sEl) sEl.textContent = msg; };

    try {
      set('обход: старт…');

      const seed = location.href;
      const seedData = collectPageData(document, seed);

      const queue = [];
      const visited = new Set();
      visited.add(seed);

      for (const l of (seedData.links || [])) {
        if (!l || !l.url) continue;
        queue.push(l.url);
      }

      const results = [];
      results.push(seedData);

      const maxPages = Math.max(5, Math.min(10, CFG.maxAutoPages));

      while (queue.length && results.length < maxPages) {
        const next = queue.shift();
        if (!next) continue;
        if (visited.has(next)) continue;

        if (CFG.sameOriginOnly && !sameOrigin(seed, next)) continue;

        visited.add(next);
        set(`обход: ${results.length + 1}/${maxPages}`);

        try {
          await sleep(CFG.crawlDelayMs);

          const html = await fetchHtml(next);
          const doc = parseHtmlToDoc(html, next);

          const data = collectPageData(doc, next);
          results.push(data);

          for (const l of (data.links || [])) {
            if (!l || !l.url) continue;
            if (visited.has(l.url)) continue;
            queue.push(l.url);
            if (queue.length > 200) break;
          }
        } catch (e) {
          console.warn('[SF][crawl] failed', next, e);
        }
      }

      const bundle = {
        crawled_at: new Date().toISOString(),
        seed,
        pages: results,
      };

      console.log('[SF][CRAWL_RESULT]', bundle);
      downloadJson(`starfederation-crawl-${nowIsoSafe()}.json`, bundle);

      set(`обход: готово (${results.length} стр.)`);
    } catch (e) {
      console.error('[SF][crawl] fatal', e);
      set('обход: ошибка (см. console)');
    }
  }

  function boot() {
    try {
      setupFetchPatch();
      setupXhrPatch();
      setupUi();
      console.log('[SF] Star Federation Lib Parser загружен');
    } catch (e) {
      console.error('[SF] boot failed', e);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
  else window.addEventListener('DOMContentLoaded', boot, { once: true });
})();
