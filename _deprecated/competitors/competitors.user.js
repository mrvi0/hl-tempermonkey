// ==UserScript==
// @name         HotelLab Admin+ Competitor Config Editor Sources Seasons
// @namespace    hotellab-admin-plus
// @version      0.10.0
// @description  Редактор конкурентов: master = выбранный Источник цен отеля, сезоны показываются по полю "Название сезона". Только текущая страница, без сетевых запросов.
// @match        https://app.revlab.ru/*/AdminOnly/mainApp/hotels/*/change/*
// @match        https://app.revlab.ru/ru/AdminOnly/mainApp/hotels/*/change/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
  
    const LOG = '[HL Competitors v10]';
    const CONFIG_RE = /parsing|categorys|concurents|standart_category/;
    const SOURCE_RE = /источник\w*\s+цен|price\s*source|pricesource/i;
    const SEASON_RE = /сезон|season/i;
  
    const state = {
      records: [],
      sourceRecords: [],
      seasonRecords: [],
      selectedSourceId: '',
      competitors: [],
      profileGroups: [],
      dirty: false,
    };
  
    boot();
  
    function boot() {
      if (document.getElementById('hlc-launcher-v10')) return;
      injectStyles();
      renderLauncher();
      console.log(LOG, 'loaded; no network requests');
    }
  
    function renderLauncher() {
      const launcher = document.createElement('div');
      launcher.id = 'hlc-launcher-v10';
      launcher.innerHTML = '<button type="button" class="hlc-launch" data-open-hlc>Конкуренты</button>';
      document.body.appendChild(launcher);
      launcher.addEventListener('click', event => {
        if (event.target.closest('[data-open-hlc]')) openEditor();
      });
    }
  
    function openEditor() {
      closeEditor();
  
      const root = document.createElement('div');
      root.id = 'hlc-root-v10';
      root.innerHTML = `
        <div class="hlc-backdrop"></div>
        <section class="hlc-shell" role="dialog" aria-modal="true">
          <header class="hlc-header">
            <div>
              <h2>Редактор конкурентов</h2>
              <p>${escapeHtml(getHotelTitle())} · текущая страница, без внешних запросов</p>
            </div>
            <div class="hlc-actions">
              <button type="button" class="hlc-btn" data-rescan>Пересканировать</button>
              <button type="button" class="hlc-btn hlc-primary" data-save-source>Сохранить источник цен</button>
              <button type="button" class="hlc-btn" data-close>Закрыть</button>
            </div>
          </header>
  
          <section class="hlc-topbar">
            <label class="hlc-select-label">
              <span>Источник цен отеля</span>
              <select class="hlc-select" data-source-select></select>
            </label>
            <div class="hlc-selected-hint" data-selected-hint></div>
          </section>
  
          <div class="hlc-status" data-status>Сканирую текущую страницу...</div>
  
          <div class="hlc-layout">
            <aside class="hlc-sidebar">
              <div class="hlc-side-title">Конкуренты выбранного источника</div>
              <div data-competitors></div>
              <button type="button" class="hlc-btn hlc-full" data-add-competitor>Добавить конкурента</button>
            </aside>
  
            <main class="hlc-main">
              <section class="hlc-card">
                <div class="hlc-card-head">
                  <div>
                    <h3>Матрица категорий конкурентов</h3>
                    <p>Только по выбранному источнику цен. Строка — профиль, колонка — конкурент, одна категория = одно поле.</p>
                  </div>
                </div>
                <div class="hlc-scroll-control">
                  <span>Влево</span>
                  <input type="range" min="0" max="1000" value="0" data-matrix-slider>
                  <span>Вправо</span>
                </div>
                <div data-matrix></div>
              </section>
  
              <section class="hlc-card">
                <div class="hlc-card-head">
                  <div>
                    <h3>Категории моего отеля</h3>
                    <p>Только по выбранному источнику цен. В <code>history</code> и <code>forecast_history</code> одна категория = одно поле.</p>
                  </div>
                </div>
                <div data-my-categories></div>
              </section>
  
              <section class="hlc-card">
                <div class="hlc-card-head">
                  <div>
                    <h3>Применить в сезоны</h3>
                    <p>В выбранные сезонные конфиги переносятся <code>parsing</code> и списки <code>history</code>/<code>forecast_history</code> из выбранного источника цен.</p>
                  </div>
                </div>
                <div data-seasons></div>
                <div class="hlc-footer-actions">
                  <button type="button" class="hlc-btn" data-select-all-seasons>Выбрать все сезоны</button>
                  <button type="button" class="hlc-btn" data-clear-seasons>Снять выбор</button>
                  <button type="button" class="hlc-btn hlc-primary" data-save-selected-seasons>Сохранить для выбранных сезонов</button>
                </div>
              </section>
            </main>
          </div>
        </section>
      `;
  
      document.body.appendChild(root);
      document.body.classList.add('hlc-open');
      bindEditor(root);
      rescanAndRender();
    }
  
    function bindEditor(root) {
      root.addEventListener('click', async event => {
        if (event.target.closest('[data-close]')) return closeEditor();
        if (event.target.closest('[data-rescan]')) return rescanAndRender();
        if (event.target.closest('[data-save-source]')) return saveSourceOnly();
  
        if (event.target.closest('[data-add-competitor]')) {
          addCompetitor();
          rebuildFromSelectedSource();
          renderEditableBlocks();
          markDirty();
          return;
        }
  
        const removeCompetitor = event.target.closest('[data-remove-competitor]');
        if (removeCompetitor) {
          removeCompetitorEverywhere(removeCompetitor.dataset.removeCompetitor);
          rebuildFromSelectedSource();
          renderEditableBlocks();
          markDirty();
          return;
        }
  
        const addCompetitorCategory = event.target.closest('[data-add-competitor-category]');
        if (addCompetitorCategory) {
          addCategoryToCompetitor(addCompetitorCategory.dataset.profileKey, addCompetitorCategory.dataset.competitorId);
          renderEditableBlocks();
          markDirty();
          return;
        }
  
        const removeCompetitorCategory = event.target.closest('[data-remove-competitor-category]');
        if (removeCompetitorCategory) {
          removeCategoryFromCompetitor(removeCompetitorCategory.dataset.profileKey, removeCompetitorCategory.dataset.competitorId, Number(removeCompetitorCategory.dataset.index));
          renderEditableBlocks();
          markDirty();
          return;
        }
  
        const addMyCategory = event.target.closest('[data-add-my-category]');
        if (addMyCategory) {
          addMyCategoryField(addMyCategory.dataset.profileKey, addMyCategory.dataset.field);
          renderEditableBlocks();
          markDirty();
          return;
        }
  
        const removeMyCategory = event.target.closest('[data-remove-my-category]');
        if (removeMyCategory) {
          removeMyCategoryField(removeMyCategory.dataset.profileKey, removeMyCategory.dataset.field, Number(removeMyCategory.dataset.index));
          renderEditableBlocks();
          markDirty();
          return;
        }
  
        if (event.target.closest('[data-select-all-seasons]')) {
          document.querySelectorAll('[data-season-checkbox]').forEach(cb => cb.checked = true);
          return;
        }
  
        if (event.target.closest('[data-clear-seasons]')) {
          document.querySelectorAll('[data-season-checkbox]').forEach(cb => cb.checked = false);
          return;
        }
  
        if (event.target.closest('[data-save-selected-seasons]')) return saveSelectedSeasons();
      });
  
      root.addEventListener('change', event => {
        const select = event.target.closest('[data-source-select]');
        if (select) {
          state.selectedSourceId = select.value;
          rebuildFromSelectedSource();
          renderEditableBlocks();
          setStatus(getSelectedSourceTitle(), 'ok');
        }
      });
  
      root.addEventListener('input', event => {
        const el = event.target;
  
        if (el.matches('[data-matrix-slider]')) {
          const wrap = document.querySelector('[data-matrix] .hlc-table-wrap');
          if (wrap) {
            const maxScroll = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
            wrap.scrollLeft = maxScroll * (Number(el.value) / 1000);
          }
          return;
        }
  
        if (el.matches('[data-competitor-field]')) {
          updateCompetitorField(el.dataset.competitorId, el.dataset.competitorField, el.value);
          markDirty(false);
          return;
        }
  
        if (el.matches('[data-competitor-category-input]')) {
          updateCompetitorCategory(el.dataset.profileKey, el.dataset.competitorId, Number(el.dataset.index), el.value);
          markDirty(false);
          return;
        }
  
        if (el.matches('[data-my-category-title]')) {
          updateMyCategoryTitle(el.dataset.profileKey, el.value);
          markDirty(false);
          return;
        }
  
        if (el.matches('[data-my-category-list-input]')) {
          updateMyCategoryListValue(el.dataset.profileKey, el.dataset.field, Number(el.dataset.index), el.value);
          markDirty(false);
        }
      });
    }
  
    function rescanAndRender() {
      state.records = scanCurrentPageConfigs();
      state.sourceRecords = state.records.filter(record => record.kind === 'source');
      state.seasonRecords = state.records.filter(record => record.kind === 'season');
  
      if (!state.sourceRecords.length && state.records.length) {
        state.sourceRecords = state.records.filter(record => record.kind !== 'season');
      }
  
      if (!state.selectedSourceId || !state.sourceRecords.some(record => record.id === state.selectedSourceId)) {
        state.selectedSourceId = state.sourceRecords[0]?.id || '';
      }
  
      rebuildFromSelectedSource();
      renderSourceSelector();
      renderEditableBlocks();
      renderSeasons();
  
      if (!state.records.length) {
        setStatus('Не нашёл JSON-поля с parsing/categorys/concurents на текущей странице. Раскрой блоки и нажми «Пересканировать».', 'error');
      } else if (!state.sourceRecords.length) {
        setStatus('Конфиги найдены, но Источник цен отеля не определился.', 'warn');
      } else {
        setStatus('Источников цен: ' + state.sourceRecords.length + ', сезонов: ' + state.seasonRecords.length + '. ' + getSelectedSourceTitle(), 'ok');
      }
    }
  
    function scanCurrentPageConfigs() {
      const fields = [...document.querySelectorAll('textarea[name], input[name]')]
        .filter(el => !el.disabled && el.name && !el.name.includes('__prefix__'))
        .filter(el => CONFIG_RE.test(el.value || ''));
  
      const records = [];
      fields.forEach(field => {
        try {
          const config = JSON.parse((field.value || '').trim());
          if (!configHasUsefulKeys(config)) return;
  
          const label = getLabel(field) || field.name;
          const blockTitle = getBlockTitle(field) || 'Конфигурация на странице';
          const contextText = getContextText(field);
          const kind = classifyRecord(label, blockTitle, field.name, contextText);
          const humanName = extractRecordHumanName(field, kind, records.length + 1);
          const displayTitle = kind === 'season' ? humanName : ('Источник цен: ' + humanName);
  
          records.push({
            id: field.name + '::' + records.length,
            field,
            form: field.closest('form') || document.querySelector('form[method="post"]') || document.querySelector('form'),
            name: field.name,
            label,
            blockTitle,
            contextText,
            humanName,
            displayTitle,
            kind,
            config,
            dirty: false,
          });
        } catch (_) {
          // Not JSON.
        }
      });
  
      console.log(LOG, 'records found', records.map(record => ({ kind: record.kind, title: record.displayTitle, name: record.name })));
      return records;
    }
  
    function classifyRecord(label, blockTitle, name, contextText) {
      const text = [label, blockTitle, name, contextText].join(' ');
      if (SEASON_RE.test(text)) return 'season';
      if (SOURCE_RE.test(text)) return 'source';
      return 'source';
    }
  
    function extractRecordHumanName(field, kind, index) {
      const exactLabelRe = kind === 'season'
        ? /название\s+сезона/i
        : /источник\s+цен/i;
  
      const byExactLabel = findValueByLabelInAncestors(field, exactLabelRe);
      if (byExactLabel) return byExactLabel;
  
      const byName = findValueByFieldNameInAncestors(
        field,
        kind === 'season'
          ? /(^|[-_])(title|name|season_name|season_title)([-_]|$)/i
          : /(^|[-_])(price_source|pricesource|source)([-_]|$)/i
      );
      if (byName) return byName;
  
      return kind === 'season' ? ('Сезон ' + index) : ('Источник цен ' + index);
    }
  
    function findValueByLabelInAncestors(field, labelRe) {
      for (const container of getUsefulAncestors(field)) {
        const labels = [...container.querySelectorAll('label')];
        for (const label of labels) {
          const labelText = normalizeHumanText(label.textContent);
          if (!labelRe.test(labelText)) continue;
          const value = getValueForLabel(label, field);
          if (value) return value;
        }
      }
      return '';
    }
  
    function findValueByFieldNameInAncestors(field, nameRe) {
      for (const container of getUsefulAncestors(field)) {
        const controls = [...container.querySelectorAll('input[name], select[name], textarea[name]')]
          .filter(control => control !== field)
          .filter(control => !control.disabled)
          .filter(control => nameRe.test(control.name || '') || nameRe.test(control.id || ''));
  
        for (const control of controls) {
          const value = getControlHumanValue(control);
          if (value) return value;
        }
      }
      return '';
    }
  
    function getUsefulAncestors(field) {
      const result = [];
      let node = field;
  
      for (let i = 0; node && i < 12; i += 1, node = node.parentElement) {
        if (!(node instanceof Element)) continue;
        const cls = node.className || '';
        const tag = node.tagName || '';
  
        if (
          /inline-related|dynamic-|form-row|fieldBox|module|fieldset|grp-row|grp-module/i.test(String(cls)) ||
          /TR|TBODY|FIELDSET|DIV/.test(tag)
        ) {
          result.push(node);
        }
      }
  
      return [...new Set(result)];
    }
  
    function getValueForLabel(label, configField) {
      let control = null;
  
      const forId = label.getAttribute('for');
      if (forId) control = document.getElementById(forId);
  
      if (!control) control = label.querySelector('input[name], select[name], textarea[name]');
  
      if (!control) {
        const row = label.closest('.form-row, .fieldBox, td, th, tr, div');
        if (row) control = row.querySelector('input[name], select[name], textarea[name]');
      }
  
      if (!control || control === configField) return '';
      return getControlHumanValue(control);
    }
  
    function getControlHumanValue(control) {
      if (!control || control.disabled) return '';
      const tag = control.tagName;
      const type = (control.getAttribute('type') || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'checkbox', 'radio', 'file'].includes(type)) return '';
  
      if (tag === 'SELECT') {
        const selectedOption = control.options && control.options[control.selectedIndex];
        return cleanHumanName(selectedOption ? selectedOption.textContent : '');
      }
  
      return cleanHumanName(control.value || control.textContent || '');
    }
  
    function normalizeHumanText(value) {
      return String(value || '')
        .replace(/:/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  
    function cleanHumanName(value) {
      const text = String(value || '')
        .replace(/Конфигурация отеля/gi, ' ')
        .replace(/Удалить/gi, ' ')
        .replace(/Добавить/gi, ' ')
        .replace(/Currently:/gi, ' ')
        .replace(/Change:/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
  
      if (!text) return '';
      if (text.length > 120) return '';
      if (/^[\[{]/.test(text)) return '';
      if (CONFIG_RE.test(text)) return '';
      return text;
    }
  
    function configHasUsefulKeys(config) {
      return getProfiles(config).some(profile => profile && (profile.parsing || profile.categorys));
    }
  
    function rebuildFromSelectedSource() {
      const record = getSelectedSourceRecord();
      state.competitors = record ? buildCompetitorList([record]) : [];
      state.profileGroups = record ? buildProfileGroups([record]) : [];
    }
  
    function buildCompetitorList(records) {
      const map = new Map();
      records.forEach(record => {
        getProfiles(record.config).forEach(profile => {
          getCompetitorEntries(profile).forEach(entry => {
            if (!map.has(entry.id)) {
              map.set(entry.id, {
                id: entry.id,
                hotelTitle: entry.data.hotel_title || entry.id,
                isSelf: profile.parsing && profile.parsing.selfID === entry.id,
              });
            } else {
              if (entry.data.hotel_title) map.get(entry.id).hotelTitle = entry.data.hotel_title;
              if (profile.parsing && profile.parsing.selfID === entry.id) map.get(entry.id).isSelf = true;
            }
          });
        });
      });
  
      return [...map.values()].sort((a, b) => {
        if (a.isSelf && !b.isSelf) return -1;
        if (!a.isSelf && b.isSelf) return 1;
        return String(a.hotelTitle).localeCompare(String(b.hotelTitle), 'ru');
      });
    }
  
    function buildProfileGroups(records) {
      const map = new Map();
      records.forEach(record => {
        getProfiles(record.config).forEach((profile, index) => {
          const key = getProfileKey(profile, index);
          if (!map.has(key)) map.set(key, { key, title: getProfileTitle(profile, index), occurrences: [] });
          map.get(key).occurrences.push({ record, profile, index });
        });
      });
      return [...map.values()].sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'));
    }
  
    function renderSourceSelector() {
      const select = document.querySelector('[data-source-select]');
      const hint = document.querySelector('[data-selected-hint]');
      if (!select) return;
  
      select.innerHTML = state.sourceRecords.map(record => `
        <option value="${escapeHtml(record.id)}" ${record.id === state.selectedSourceId ? 'selected' : ''}>${escapeHtml(record.displayTitle)}</option>
      `).join('');
  
      if (hint) hint.textContent = getSelectedSourceTitle();
    }
  
    function renderEditableBlocks() {
      renderCompetitors();
      renderMatrix();
      renderMyCategories();
      renderSourceSelector();
    }
  
    function renderCompetitors() {
      const box = document.querySelector('[data-competitors]');
      if (!box) return;
  
      if (!state.competitors.length) {
        box.innerHTML = '<div class="hlc-empty">В выбранном источнике конкуренты не найдены.</div>';
        return;
      }
  
      box.innerHTML = state.competitors.map(comp => `
        <div class="hlc-competitor ${comp.isSelf ? 'self' : ''}">
          <label><span>ID</span><input class="hlc-input" data-competitor-id="${escapeHtml(comp.id)}" data-competitor-field="id" value="${escapeHtml(comp.id)}" ${comp.isSelf ? 'readonly' : ''}></label>
          <label><span>Название</span><input class="hlc-input" data-competitor-id="${escapeHtml(comp.id)}" data-competitor-field="hotelTitle" value="${escapeHtml(comp.hotelTitle)}"></label>
          <div class="hlc-row-actions">${comp.isSelf ? '<span class="hlc-pill">мой отель</span>' : `<button type="button" class="hlc-link danger" data-remove-competitor="${escapeHtml(comp.id)}">Удалить</button>`}</div>
        </div>
      `).join('');
    }
  
    function renderMatrix() {
      const box = document.querySelector('[data-matrix]');
      if (!box) return;
  
      if (!state.profileGroups.length) {
        box.innerHTML = '<div class="hlc-empty">Нет профилей в выбранном источнике цен.</div>';
        return;
      }
  
      const header = state.competitors.map(comp => `<th>${escapeHtml(comp.hotelTitle)}<br><small>${escapeHtml(comp.id)}</small></th>`).join('');
      const rows = state.profileGroups.map(group => {
        const cells = state.competitors.map(comp => {
          const categories = getUnifiedCompetitorCategories(group, comp.id);
          return `
            <td>
              <div class="hlc-list">
                ${categories.map((category, index) => categoryInput({ value: category, profileKey: group.key, competitorId: comp.id, index, kind: 'competitor' })).join('')}
                <button type="button" class="hlc-mini-btn" data-add-competitor-category="1" data-profile-key="${escapeHtml(group.key)}" data-competitor-id="${escapeHtml(comp.id)}">+ категория</button>
              </div>
            </td>
          `;
        }).join('');
        return `<tr><th class="hlc-sticky-col"><div>${escapeHtml(group.title)}</div></th>${cells}</tr>`;
      }).join('');
  
      box.innerHTML = `
        <div class="hlc-table-wrap" data-matrix-wrap>
          <table class="hlc-table matrix">
            <thead><tr><th class="hlc-sticky-col">Профиль</th>${header}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
  
      const wrap = box.querySelector('[data-matrix-wrap]');
      const slider = document.querySelector('[data-matrix-slider]');
      if (wrap && slider) {
        slider.value = 0;
        wrap.addEventListener('scroll', () => {
          const maxScroll = Math.max(1, wrap.scrollWidth - wrap.clientWidth);
          slider.value = Math.round((wrap.scrollLeft / maxScroll) * 1000);
        });
      }
    }
  
    function categoryInput({ value, profileKey, competitorId, index, kind, field }) {
      if (kind === 'competitor') {
        return `
          <div class="hlc-list-row">
            <input class="hlc-input" data-competitor-category-input="1" data-profile-key="${escapeHtml(profileKey)}" data-competitor-id="${escapeHtml(competitorId)}" data-index="${index}" value="${escapeHtml(value)}">
            <button type="button" class="hlc-icon-btn danger" data-remove-competitor-category="1" data-profile-key="${escapeHtml(profileKey)}" data-competitor-id="${escapeHtml(competitorId)}" data-index="${index}">×</button>
          </div>
        `;
      }
      return `
        <div class="hlc-list-row">
          <input class="hlc-input" data-my-category-list-input="1" data-profile-key="${escapeHtml(profileKey)}" data-field="${escapeHtml(field)}" data-index="${index}" value="${escapeHtml(value)}">
          <button type="button" class="hlc-icon-btn danger" data-remove-my-category="1" data-profile-key="${escapeHtml(profileKey)}" data-field="${escapeHtml(field)}" data-index="${index}">×</button>
        </div>
      `;
    }
  
    function renderMyCategories() {
      const box = document.querySelector('[data-my-categories]');
      if (!box) return;
      if (!state.profileGroups.length) {
        box.innerHTML = '<div class="hlc-empty">Нет профилей в выбранном источнике цен.</div>';
        return;
      }
  
      box.innerHTML = `
        <div class="hlc-profile-cards">
          ${state.profileGroups.map(group => {
            const my = getUnifiedMyCategory(group);
            return `
              <div class="hlc-profile-card">
                <div class="hlc-profile-title">${escapeHtml(group.title)}</div>
                <label class="hlc-field"><span>title</span><input class="hlc-input" data-my-category-title="1" data-profile-key="${escapeHtml(group.key)}" value="${escapeHtml(my.title || '')}"></label>
                <div class="hlc-two-cols">
                  <div><div class="hlc-list-title">history</div><div class="hlc-list">${my.history.map((value, index) => categoryInput({ value, profileKey: group.key, index, kind: 'my', field: 'history' })).join('')}<button type="button" class="hlc-mini-btn" data-add-my-category="1" data-profile-key="${escapeHtml(group.key)}" data-field="history">+ категория</button></div></div>
                  <div><div class="hlc-list-title">forecast_history</div><div class="hlc-list">${my.forecast_history.map((value, index) => categoryInput({ value, profileKey: group.key, index, kind: 'my', field: 'forecast_history' })).join('')}<button type="button" class="hlc-mini-btn" data-add-my-category="1" data-profile-key="${escapeHtml(group.key)}" data-field="forecast_history">+ категория</button></div></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  
    function renderSeasons() {
      const box = document.querySelector('[data-seasons]');
      if (!box) return;
  
      if (!state.seasonRecords.length) {
        box.innerHTML = '<div class="hlc-empty">Сезонные конфиги не найдены на текущей странице.</div>';
        return;
      }
  
      box.innerHTML = `
        <div class="hlc-season-grid">
          ${state.seasonRecords.map(record => `
            <label class="hlc-season-item">
              <input type="checkbox" data-season-checkbox value="${escapeHtml(record.id)}">
              <span><b>${escapeHtml(record.humanName)}</b></span>
            </label>
          `).join('')}
        </div>
      `;
    }
  
    function getUnifiedCompetitorCategories(group, competitorId) {
      for (const occurrence of group.occurrences) {
        const categories = getCompetitorCategories(occurrence.profile, competitorId);
        if (categories.length) return categories.slice();
      }
      return [];
    }
  
    function getUnifiedMyCategory(group) {
      for (const occurrence of group.occurrences) {
        const standard = getStandardCategoryObject(occurrence.profile, true);
        if (standard) {
          return {
            title: standard.title || '',
            history: Array.isArray(standard.history) ? standard.history.slice() : [],
            forecast_history: Array.isArray(standard.forecast_history) ? standard.forecast_history.slice() : [],
          };
        }
      }
      return { title: '', history: [], forecast_history: [] };
    }
  
    function updateCompetitorField(oldId, field, value) {
      const comp = state.competitors.find(item => item.id === oldId);
      const source = getSelectedSourceRecord();
      if (!comp || !source) return;
  
      if (field === 'hotelTitle') {
        comp.hotelTitle = value;
        getProfiles(source.config).forEach(profile => {
          const entry = findCompetitorEntry(profile, oldId);
          if (entry) entry.data.hotel_title = value;
        });
        source.dirty = true;
        return;
      }
  
      if (field === 'id' && value && value !== oldId && !comp.isSelf) {
        if (state.competitors.some(item => item.id === value)) return;
        comp.id = value;
        getProfiles(source.config).forEach(profile => renameCompetitor(profile, oldId, value));
        source.dirty = true;
        rebuildFromSelectedSource();
        renderEditableBlocks();
      }
    }
  
    function updateCompetitorCategory(profileKey, competitorId, index, value) {
      const group = findProfileGroup(profileKey);
      if (!group) return;
      group.occurrences.forEach(({ record, profile }) => {
        const entry = ensureCompetitor(profile, competitorId);
        const list = Array.isArray(entry.data.standart_category) ? entry.data.standart_category : [];
        list[index] = value;
        entry.data.standart_category = list;
        record.dirty = true;
      });
    }
  
    function addCategoryToCompetitor(profileKey, competitorId) {
      const group = findProfileGroup(profileKey);
      if (!group) return;
      group.occurrences.forEach(({ record, profile }) => {
        const entry = ensureCompetitor(profile, competitorId);
        if (!Array.isArray(entry.data.standart_category)) entry.data.standart_category = [];
        entry.data.standart_category.push('');
        record.dirty = true;
      });
    }
  
    function removeCategoryFromCompetitor(profileKey, competitorId, index) {
      const group = findProfileGroup(profileKey);
      if (!group) return;
      group.occurrences.forEach(({ record, profile }) => {
        const entry = ensureCompetitor(profile, competitorId);
        entry.data.standart_category = (entry.data.standart_category || []).filter((_, i) => i !== index);
        record.dirty = true;
      });
    }
  
    function updateMyCategoryTitle(profileKey, value) {
      const group = findProfileGroup(profileKey);
      if (!group) return;
      group.occurrences.forEach(({ record, profile }) => {
        const standard = getStandardCategoryObject(profile, true);
        standard.title = value;
        record.dirty = true;
      });
    }
  
    function updateMyCategoryListValue(profileKey, field, index, value) {
      const group = findProfileGroup(profileKey);
      if (!group) return;
      group.occurrences.forEach(({ record, profile }) => {
        const standard = getStandardCategoryObject(profile, true);
        if (!Array.isArray(standard[field])) standard[field] = [];
        standard[field][index] = value;
        record.dirty = true;
      });
    }
  
    function addMyCategoryField(profileKey, field) {
      const group = findProfileGroup(profileKey);
      if (!group) return;
      group.occurrences.forEach(({ record, profile }) => {
        const standard = getStandardCategoryObject(profile, true);
        if (!Array.isArray(standard[field])) standard[field] = [];
        standard[field].push('');
        record.dirty = true;
      });
    }
  
    function removeMyCategoryField(profileKey, field, index) {
      const group = findProfileGroup(profileKey);
      if (!group) return;
      group.occurrences.forEach(({ record, profile }) => {
        const standard = getStandardCategoryObject(profile, true);
        standard[field] = (standard[field] || []).filter((_, i) => i !== index);
        record.dirty = true;
      });
    }
  
    function addCompetitor() {
      const source = getSelectedSourceRecord();
      if (!source) return;
      const id = window.prompt('ID конкурента, например travelline_12345');
      if (!id || state.competitors.some(item => item.id === id)) return;
      const hotelTitle = window.prompt('Название отеля конкурента') || id;
      state.competitors.push({ id, hotelTitle, isSelf: false });
      getProfiles(source.config).forEach(profile => ensureCompetitor(profile, id, hotelTitle));
      source.dirty = true;
    }
  
    function removeCompetitorEverywhere(id) {
      const source = getSelectedSourceRecord();
      if (!source) return;
      if (!window.confirm('Удалить конкурента ' + id + ' из выбранного источника цен?')) return;
      state.competitors = state.competitors.filter(item => item.id !== id);
      getProfiles(source.config).forEach(profile => removeCompetitorFromProfile(profile, id));
      source.dirty = true;
    }
  
    function saveSourceOnly() {
      const source = getSelectedSourceRecord();
      if (!source) {
        setStatus('Источник цен не выбран.', 'error');
        return;
      }
      source.dirty = true;
      return saveRecords([source], 'Источник цен сохранён');
    }
  
    function saveSelectedSeasons() {
      const source = getSelectedSourceRecord();
      if (!source) {
        setStatus('Источник цен не выбран.', 'error');
        return;
      }
  
      const selectedSeasonIds = [...document.querySelectorAll('[data-season-checkbox]:checked')].map(cb => cb.value);
      const seasons = state.seasonRecords.filter(record => selectedSeasonIds.includes(record.id));
      if (!seasons.length) {
        setStatus('Выбери хотя бы один сезон.', 'warn');
        return;
      }
  
      copySourceParsingAndHistoriesToSeasons(source, seasons);
      return saveRecords([source, ...seasons], 'Источник и выбранные сезоны сохранены');
    }
  
    function copySourceParsingAndHistoriesToSeasons(source, seasons) {
      const sourceProfiles = getProfiles(source.config);
      const sourceByKey = new Map(sourceProfiles.map((profile, index) => [getProfileKey(profile, index), profile]));
  
      seasons.forEach(season => {
        getProfiles(season.config).forEach((seasonProfile, index) => {
          const key = getProfileKey(seasonProfile, index);
          const sourceProfile = sourceByKey.get(key) || sourceProfiles[index];
          if (!sourceProfile) return;
          if (sourceProfile.parsing) seasonProfile.parsing = deepClone(sourceProfile.parsing);
          const sourceStd = getStandardCategoryObject(sourceProfile, false);
          const seasonStd = getStandardCategoryObject(seasonProfile, true);
          if (sourceStd && seasonStd) {
            if (Array.isArray(sourceStd.history)) seasonStd.history = deepClone(sourceStd.history);
            if (Array.isArray(sourceStd.forecast_history)) seasonStd.forecast_history = deepClone(sourceStd.forecast_history);
          }
        });
        season.dirty = true;
      });
      source.dirty = true;
    }
  
    async function saveRecords(records, successMessage) {
      const dirtyRecords = [...new Set(records.filter(Boolean))];
      if (!dirtyRecords.length) {
        setStatus('Нет записей для сохранения.', 'warn');
        return;
      }
  
      dirtyRecords.forEach(record => {
        cleanupEmptyValues(record.config);
        record.field.value = JSON.stringify(record.config, null, 2);
        record.field.dispatchEvent(new Event('input', { bubbles: true }));
        record.field.dispatchEvent(new Event('change', { bubbles: true }));
      });
  
      const forms = [...new Set(dirtyRecords.map(record => record.form).filter(Boolean))];
      if (!forms.length) {
        setStatus('JSON обновлён на странице, но form не найдена. Сохрани стандартной кнопкой Django Admin.', 'warn');
        return;
      }
  
      setStatus('Сохраняю текущую Django Admin form...', '');
      let saved = 0;
      const errors = [];
  
      for (const form of forms) {
        try {
          ensureSubmit(form);
          const url = new URL(form.getAttribute('action') || location.href, location.href).toString();
          const response = await fetch(url, {
            method: 'POST',
            body: new FormData(form),
            credentials: 'same-origin',
            redirect: 'follow',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
          });
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const html = await response.text();
          if (/errorlist|Please correct the error/i.test(html)) throw new Error('Django вернул ошибки валидации');
          saved += 1;
        } catch (error) {
          errors.push(error.message);
        }
      }
  
      if (errors.length) {
        setStatus('JSON обновлён на странице, но POST дал ошибку: ' + errors.join(' | ') + '. Можно попробовать стандартную кнопку сохранения.', 'error');
      } else {
        dirtyRecords.forEach(record => record.dirty = false);
        state.dirty = false;
        setStatus(successMessage + '. Форм отправлено: ' + saved, 'ok');
      }
    }
  
    function cleanupEmptyValues(config) {
      getProfiles(config).forEach(profile => {
        getCompetitorEntries(profile).forEach(entry => {
          entry.data.standart_category = (entry.data.standart_category || []).map(x => String(x).trim()).filter(Boolean);
        });
        const standard = getStandardCategoryObject(profile, false);
        if (standard) {
          if (Array.isArray(standard.history)) standard.history = standard.history.map(x => String(x).trim()).filter(Boolean);
          if (Array.isArray(standard.forecast_history)) standard.forecast_history = standard.forecast_history.map(x => String(x).trim()).filter(Boolean);
        }
      });
    }
  
    function getProfiles(config) {
      if (Array.isArray(config)) return config;
      if (config && Array.isArray(config.configs)) return config.configs;
      if (config && Array.isArray(config.profiles)) return config.profiles;
      if (config && (config.parsing || config.categorys)) return [config];
      return [];
    }
  
    function getProfileKey(profile, index) {
      return normalizeKey(profile.profile_title || profile.profile_name || getMyCategoryTitle(profile) || String(index));
    }
  
    function getProfileTitle(profile, index) {
      return profile.profile_title || profile.profile_name || getMyCategoryTitle(profile) || 'Профиль ' + (index + 1);
    }
  
    function normalizeKey(value) {
      return String(value || '').trim().toLowerCase();
    }
  
    function findProfileGroup(profileKey) {
      return state.profileGroups.find(group => group.key === profileKey);
    }
  
    function getSelectedSourceRecord() {
      return state.sourceRecords.find(record => record.id === state.selectedSourceId) || null;
    }
  
    function getSelectedSourceTitle() {
      return getSelectedSourceRecord()?.displayTitle || 'Источник цен: не выбран';
    }
  
    function getMyCategoryTitle(profile) {
      const standard = getStandardCategoryObject(profile, false);
      return standard ? (standard.title || '') : '';
    }
  
    function getStandardCategoryObject(profile, create) {
      if (!Array.isArray(profile.categorys)) {
        if (!create) return null;
        profile.categorys = [];
      }
      if (!profile.categorys[0]) {
        if (!create) return null;
        profile.categorys[0] = { standart_category: { title: '', history: [] } };
      }
      if (!profile.categorys[0].standart_category) {
        if (!create) return null;
        profile.categorys[0].standart_category = { title: '', history: [] };
      }
      return profile.categorys[0].standart_category;
    }
  
    function getCompetitorEntries(profile) {
      const list = profile && profile.parsing && Array.isArray(profile.parsing.concurents) ? profile.parsing.concurents : [];
      return list.map(item => {
        const id = Object.keys(item || {})[0];
        return id ? { id, data: item[id] || {}, item } : null;
      }).filter(Boolean);
    }
  
    function findCompetitorEntry(profile, id) {
      return getCompetitorEntries(profile).find(entry => entry.id === id) || null;
    }
  
    function ensureCompetitor(profile, id, hotelTitle) {
      if (!profile.parsing) profile.parsing = { selfID: '', concurents: [] };
      if (!Array.isArray(profile.parsing.concurents)) profile.parsing.concurents = [];
      let entry = findCompetitorEntry(profile, id);
      if (!entry) {
        const item = {};
        item[id] = { standart_category: [], hotel_title: hotelTitle || getCompetitorTitle(id) || id };
        profile.parsing.concurents.push(item);
        entry = { id, item, data: item[id] };
      }
      if (!Array.isArray(entry.data.standart_category)) entry.data.standart_category = [];
      if (!entry.data.hotel_title) entry.data.hotel_title = hotelTitle || getCompetitorTitle(id) || id;
      return entry;
    }
  
    function getCompetitorCategories(profile, id) {
      const entry = findCompetitorEntry(profile, id);
      return entry && Array.isArray(entry.data.standart_category) ? entry.data.standart_category : [];
    }
  
    function getCompetitorTitle(id) {
      return (state.competitors.find(item => item.id === id) || {}).hotelTitle;
    }
  
    function renameCompetitor(profile, oldId, newId) {
      const entry = findCompetitorEntry(profile, oldId);
      if (!entry) return;
      const data = entry.data;
      delete entry.item[oldId];
      entry.item[newId] = data;
      if (profile.parsing && profile.parsing.selfID === oldId) profile.parsing.selfID = newId;
    }
  
    function removeCompetitorFromProfile(profile, id) {
      if (!profile.parsing || !Array.isArray(profile.parsing.concurents)) return;
      profile.parsing.concurents = profile.parsing.concurents.filter(item => !Object.prototype.hasOwnProperty.call(item || {}, id));
    }
  
    function getBlockTitle(field) {
      let node = field;
      for (let i = 0; node && i < 8; i += 1, node = node.parentElement) {
        const heading = node.querySelector && node.querySelector('h2, h3, caption, .inline-heading, .module h2');
        if (heading && heading.textContent.trim()) return heading.textContent.trim();
      }
      return '';
    }
  
    function getContextText(field) {
      const row = field.closest('tr, .form-row, .dynamic-form, .inline-related, fieldset, .module');
      if (!row) return '';
      const clone = row.cloneNode(true);
      clone.querySelectorAll('textarea, input, script, style').forEach(node => node.remove());
      return (clone.textContent || '').slice(0, 2000);
    }
  
    function getLabel(field) {
      if (field.id) {
        const label = document.querySelector('label[for="' + cssEscape(field.id) + '"]');
        if (label) return label.textContent.trim().replace(/:$/, '');
      }
      const row = field.closest('.form-row, .fieldBox, td, div');
      const label = row && row.querySelector('label');
      return label ? label.textContent.trim().replace(/:$/, '') : '';
    }
  
    function ensureSubmit(form) {
      let submit = form.elements._save;
      if (!submit) {
        submit = document.createElement('input');
        submit.type = 'hidden';
        submit.name = '_save';
        form.appendChild(submit);
      }
      submit.value = 'Save';
    }
  
    function firstElement(source) {
      if (!source) return null;
      if (source instanceof Element) return source;
      return source[0] || null;
    }
  
    function getHotelTitle() {
      const form = document.querySelector('form[method="post"]');
      const titleInput = firstElement(form && form.elements && form.elements.title);
      if (titleInput && titleInput.value) return titleInput.value;
      return document.querySelector('h1')?.textContent?.replace(/^Change\s+/i, '').trim() || document.title || 'Отель';
    }
  
    function setStatus(text, kind) {
      const el = document.querySelector('[data-status]');
      if (!el) return;
      el.textContent = text;
      el.className = 'hlc-status ' + (kind || '');
    }
  
    function markDirty(showStatus = true) {
      state.dirty = true;
      if (showStatus) setStatus('Есть несохранённые изменения.', 'warn');
      else {
        const el = document.querySelector('[data-status]');
        if (el && !/Сохраняю|Сканирую/.test(el.textContent)) setStatus('Есть несохранённые изменения.', 'warn');
      }
    }
  
    function deepClone(value) {
      return JSON.parse(JSON.stringify(value));
    }
  
    function closeEditor() {
      document.getElementById('hlc-root-v10')?.remove();
      document.body.classList.remove('hlc-open');
    }
  
    function cssEscape(value) {
      if (window.CSS && CSS.escape) return CSS.escape(value);
      return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }
  
    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  
    function injectStyles() {
      const style = document.createElement('style');
      style.textContent = `
        body.hlc-open { overflow: hidden; }
        #hlc-launcher-v10 { position: fixed; right: 16px; bottom: 16px; z-index: 99990; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .hlc-launch { border: 1px solid #2563eb; background: #2563eb; color: #fff; border-radius: 999px; padding: 11px 16px; font: 800 14px/1.2 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; cursor: pointer; box-shadow: 0 14px 34px rgba(37,99,235,.28); }
        #hlc-root-v10 { position: fixed; inset: 0; z-index: 99995; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; }
        .hlc-backdrop { position: absolute; inset: 0; background: rgba(15,23,42,.45); }
        .hlc-shell { position: relative; width: min(1180px, calc(100vw - 28px)); max-height: calc(100vh - 28px); margin: 14px auto; overflow: auto; background: #f6f7fb; border: 1px solid #d8dee9; border-radius: 18px; box-shadow: 0 24px 80px rgba(15,23,42,.28); padding: 18px; }
        .hlc-header, .hlc-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
        .hlc-header h2, .hlc-card h3 { margin: 0 0 5px; font-size: 22px; line-height: 1.15; }
        .hlc-header p, .hlc-card p { margin: 0; color: #667085; font-size: 13px; }
        .hlc-actions, .hlc-row-actions, .hlc-footer-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .hlc-btn, .hlc-link, .hlc-mini-btn, .hlc-icon-btn { border: 1px solid #d8dee9; background: #fff; color: #172033 !important; border-radius: 10px; padding: 8px 11px; font: 750 13px/1.2 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; cursor: pointer; text-decoration: none !important; }
        .hlc-primary { background: #2563eb; color: #fff !important; border-color: #2563eb; }
        .hlc-full { width: 100%; justify-content: center; }
        .hlc-link { border: 0; padding: 0; background: transparent; }
        .hlc-link.danger, .hlc-icon-btn.danger { color: #dc2626 !important; }
        .hlc-mini-btn { padding: 6px 8px; font-size: 12px; justify-content: center; }
        .hlc-icon-btn { width: 32px; min-width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; }
        .hlc-status { min-height: 22px; margin: 10px 0 14px; color: #667085; font-size: 13px; }
        .hlc-status.ok { color: #15803d; } .hlc-status.warn { color: #b45309; } .hlc-status.error { color: #dc2626; }
        .hlc-topbar { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; background: #fff; border: 1px solid #d8dee9; border-radius: 14px; padding: 12px; margin: 14px 0 10px; }
        .hlc-select-label { display: grid; gap: 6px; font-size: 13px; font-weight: 850; color: #344054; }
        .hlc-select { width: 100%; border: 1px solid #d8dee9; border-radius: 10px; padding: 9px 10px; background: #fff; color: #172033; font: 14px/1.35 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .hlc-selected-hint { color: #667085; font-size: 12px; }
        .hlc-layout { display: grid; grid-template-columns: 290px minmax(0,1fr); gap: 16px; align-items: start; }
        .hlc-sidebar, .hlc-card { background: #fff; border: 1px solid #d8dee9; border-radius: 14px; box-shadow: 0 14px 35px rgba(15,23,42,.07); }
        .hlc-sidebar { position: sticky; top: 0; padding: 14px; }
        .hlc-side-title { font-weight: 850; margin-bottom: 10px; }
        .hlc-main { display: grid; gap: 16px; min-width: 0; }
        .hlc-card { padding: 16px; min-width: 0; }
        [data-competitors] { display: grid; gap: 10px; max-height: 58vh; overflow: auto; padding-right: 4px; margin-bottom: 12px; }
        .hlc-competitor { display: grid; gap: 8px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px; background: #fff; }
        .hlc-competitor.self { border-color: #93c5fd; background: #eff6ff; }
        .hlc-competitor label, .hlc-field { display: grid; gap: 5px; color: #344054; font-size: 12px; font-weight: 750; }
        .hlc-input { width: 100%; box-sizing: border-box; border: 1px solid #d8dee9; border-radius: 9px; padding: 8px 9px; background: #fff; color: #172033; font: 13px/1.35 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .hlc-pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 8px; background: #dbeafe; color: #174ea6; font-size: 12px; font-weight: 800; }
        .hlc-empty { padding: 14px; border: 1px dashed #d8dee9; border-radius: 12px; color: #667085; background: #f9fafb; }
        .hlc-scroll-control { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; margin: 12px 0; color: #667085; font-size: 12px; }
        .hlc-scroll-control input { width: 100%; }
        .hlc-table-wrap { overflow-x: auto; overflow-y: auto; border: 1px solid #d8dee9; border-radius: 12px; background: #fff; max-height: 62vh; max-width: 100%; }
        .hlc-table { width: max-content; min-width: 980px; border-collapse: collapse; }
        .hlc-table th, .hlc-table td { border-bottom: 1px solid #e5e7eb; border-right: 1px solid #eef2f7; padding: 8px; text-align: left; vertical-align: top; font-size: 13px; }
        .hlc-table th { background: #f9fafb; color: #475467; font-weight: 850; }
        .hlc-table thead th { position: sticky; top: 0; z-index: 2; }
        .hlc-sticky-col { position: sticky; left: 0; z-index: 3; background: #fff !important; min-width: 210px; max-width: 250px; }
        thead .hlc-sticky-col { background: #f9fafb !important; z-index: 4; }
        .hlc-table small { color: #667085; font-size: 11px; }
        .hlc-list { display: grid; gap: 6px; min-width: 220px; }
        .hlc-list-row { display: grid; grid-template-columns: minmax(0, 1fr) 32px; gap: 6px; align-items: center; }
        .hlc-profile-cards { display: grid; gap: 12px; }
        .hlc-profile-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: #fff; display: grid; gap: 10px; }
        .hlc-profile-title { font-weight: 850; }
        .hlc-two-cols { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
        .hlc-list-title { font-weight: 800; font-size: 13px; margin-bottom: 6px; color: #475467; }
        .hlc-season-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin-bottom: 12px; }
        .hlc-season-item { display: grid; grid-template-columns: 20px minmax(0,1fr); gap: 8px; align-items: start; border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px; background: #fff; cursor: pointer; }
        code { background: #f2f4f7; border-radius: 6px; padding: 1px 5px; }
        @media (max-width: 980px) { .hlc-layout, .hlc-two-cols, .hlc-season-grid { grid-template-columns: 1fr; } .hlc-sidebar { position: static; } .hlc-header, .hlc-card-head { flex-direction: column; } }
      `;
      document.head.appendChild(style);
    }
  })();
  