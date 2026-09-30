// ==UserScript==
// @name         Hide Elements
// @namespace    hotellab-hide-elements
// @version      2.0.0
// @description  Скрытие блоков Django Admin (архив, категории, пользователи) через меню Tampermonkey; сворачивание JSON на странице
// @author       Mr Vi
// @match        https://app.hotellab.io/*/AdminOnly/mainApp/hotels/*
// @match        https://app.revlab.ru/*/AdminOnly/mainApp/hotels/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Storage keys kept from UI Admin Helper for continuity
  const STORAGE = {
    archived: 'ui_admin_show_archived',
    rooms: 'ui_admin_show_room_categories',
    users: 'ui_admin_show_users',
  };
  const DEFAULTS = {
    archived: false,
    rooms: true,
    users: true,
  };

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
    { id: 'id_statistics_config', storageKey: 'ui_admin_statistics_config_collapsed' },
  ];

  const CHEVRON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>';

  const menuIds = [];

  GM_addStyle(`
    .hlt-hide-archived-hidden { display: none !important; }
    .hlt-hide-hidden { display: none !important; }
    .hlt-hide-collapse-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 2px 4px;
      margin-left: 8px;
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
      color: #417690;
      transition: color 0.15s ease;
    }
    .hlt-hide-collapse-btn:hover { color: #205067; }
    .hlt-hide-collapse-btn svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
      transition: transform 0.2s;
    }
    .hlt-hide-collapse-btn.collapsed svg { transform: rotate(-90deg); }
  `);

  function getShow(key) {
    return GM_getValue(STORAGE[key], DEFAULTS[key]);
  }

  function setShow(key, value) {
    GM_setValue(STORAGE[key], value);
  }

  function visibilityLabel(show) {
    return show ? 'показаны' : 'скрыты';
  }

  function clearMenu() {
    while (menuIds.length) {
      const id = menuIds.pop();
      try {
        if (typeof GM_unregisterMenuCommand === 'function') {
          GM_unregisterMenuCommand(id);
        }
      } catch (_) { /* ignore */ }
    }
  }

  function registerMenus() {
    clearMenu();

    const items = [
      {
        label: '👁 Архивные сезоны: ' + visibilityLabel(getShow('archived')),
        onClick: function () {
          const next = !getShow('archived');
          setShow('archived', next);
          toggleArchivedBlocks(next);
          registerMenus();
        },
      },
      {
        label: '👁 Категории номеров: ' + visibilityLabel(getShow('rooms')),
        onClick: function () {
          const next = !getShow('rooms');
          setShow('rooms', next);
          toggleRoomCategories(next);
          registerMenus();
        },
      },
      {
        label: '👁 Пользователи: ' + visibilityLabel(getShow('users')),
        onClick: function () {
          const next = !getShow('users');
          setShow('users', next);
          toggleUsers(next);
          registerMenus();
        },
      },
      {
        label: '↺ Сбросить все настройки',
        onClick: resetAllSettings,
      },
    ];

    items.forEach(function (item) {
      const id = GM_registerMenuCommand(item.label, item.onClick);
      if (id != null) menuIds.push(id);
    });
  }

  function resetAllSettings() {
    setShow('archived', DEFAULTS.archived);
    setShow('rooms', DEFAULTS.rooms);
    setShow('users', DEFAULTS.users);
    COLLAPSIBLE_BLOCKS.forEach(function (cfg) {
      try {
        GM_deleteValue(cfg.storageKey);
      } catch (_) {
        GM_setValue(cfg.storageKey, false);
      }
    });
    applyVisibility();
    initCollapsibleBlocks(true);
    registerMenus();
  }

  function toggleArchivedBlocks(showArchived) {
    const blocks = document.querySelectorAll(
      '.inline-related.dynamic-hotelSeasonsConfigs, #hotelSeasonsConfigs-group .inline-related'
    );
    blocks.forEach(function (block) {
      const archivedCheckbox = block.querySelector(
        'input[type="checkbox"][id*="-is_archived"], input[type="checkbox"][name*="is_archived"]'
      );
      if (!archivedCheckbox || !archivedCheckbox.checked) {
        block.classList.remove('hlt-hide-archived-hidden');
        return;
      }
      if (showArchived) {
        block.classList.remove('hlt-hide-archived-hidden');
      } else {
        block.classList.add('hlt-hide-archived-hidden');
      }
    });
  }

  function toggleRoomCategories(show) {
    const el = document.getElementById('hotelRoomsTypesTrnsit-group');
    if (!el) return;
    if (show) {
      el.classList.remove('hlt-hide-hidden');
      el.style.display = '';
    } else {
      el.classList.add('hlt-hide-hidden');
      el.style.display = 'none';
    }
  }

  function toggleUsers(show) {
    const el = document.getElementById('Hotels_owner-group');
    if (!el) return;
    if (show) {
      el.classList.remove('hlt-hide-hidden');
      el.style.display = '';
    } else {
      el.classList.add('hlt-hide-hidden');
      el.style.display = 'none';
    }
  }

  function applyVisibility() {
    toggleArchivedBlocks(getShow('archived'));
    toggleRoomCategories(getShow('rooms'));
    toggleUsers(getShow('users'));
  }

  function findFormRow(blockId) {
    const fieldName = blockId.replace(/^id_/, '');
    let block = document.querySelector('.form-row.field-' + fieldName);
    if (block) return block;
    const textarea = document.querySelector('textarea#' + blockId + ', textarea[id="' + blockId + '"]');
    if (!textarea) return null;
    return textarea.closest('.form-row');
  }

  function getElementsToHide(blockElement, elementId, label) {
    const elements = [];
    const textarea = blockElement.querySelector('textarea[id="' + elementId + '"]');
    if (textarea) elements.push(textarea);

    const editor1 = blockElement.querySelector('#' + elementId + '_jsoneditor');
    const editor2 = blockElement.querySelector('[id*="' + elementId + '"][id*="jsoneditor"]');
    const editor3 = blockElement.querySelector('.outer_jsoneditor');
    const editor4 = blockElement.querySelector('[id*="jsoneditor"]');
    [editor1, editor2, editor3, editor4].forEach(function (el) {
      if (el && elements.indexOf(el) === -1) elements.push(el);
    });

    if (elements.length === 0 && label) {
      let current = label.nextSibling;
      while (current) {
        if (current.nodeType === 1 && !current.classList.contains('hlt-hide-collapse-btn')) {
          elements.push(current);
        }
        current = current.nextSibling;
      }
    }
    return elements;
  }

  function initCollapsibleBlocks(forceResetDisplay) {
    COLLAPSIBLE_BLOCKS.forEach(function (blockConfig) {
      const blockId = blockConfig.id;
      const block = findFormRow(blockId);
      if (!block) return;

      const existing = block.querySelector('.hlt-hide-collapse-btn[data-block-id="' + blockId + '"]');
      const label = block.querySelector('label[for="' + blockId + '"]');
      if (!label) return;

      const elementsToHide = getElementsToHide(block, blockId, label);
      const isCollapsed = forceResetDisplay ? false : GM_getValue(blockConfig.storageKey, false);

      if (existing) {
        elementsToHide.forEach(function (el) {
          if (el) el.style.display = isCollapsed ? 'none' : '';
        });
        existing.classList.toggle('collapsed', isCollapsed);
        return;
      }

      const collapseBtn = document.createElement('button');
      collapseBtn.type = 'button';
      collapseBtn.className = 'hlt-hide-collapse-btn';
      collapseBtn.setAttribute('data-block-id', blockId);
      collapseBtn.innerHTML = CHEVRON_SVG;
      collapseBtn.title = 'Свернуть/Развернуть';
      label.insertAdjacentElement('afterend', collapseBtn);

      if (isCollapsed && elementsToHide.length) {
        collapseBtn.classList.add('collapsed');
        elementsToHide.forEach(function (el) {
          if (el) el.style.display = 'none';
        });
      }

      collapseBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const current = getElementsToHide(block, blockId, label);
        if (!current.length) return;
        const collapsed = current[0].style.display === 'none';
        current.forEach(function (el) {
          if (el) el.style.display = collapsed ? '' : 'none';
        });
        collapseBtn.classList.toggle('collapsed', !collapsed);
        GM_setValue(blockConfig.storageKey, !collapsed);
      });
    });
  }

  function observePageChanges() {
    let scheduled = false;
    function scheduleRefresh() {
      if (scheduled) return;
      scheduled = true;
      setTimeout(function () {
        scheduled = false;
        applyVisibility();
        initCollapsibleBlocks(false);
      }, 100);
    }

    const observer = new MutationObserver(function (mutations) {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.addedNodes && m.addedNodes.length) {
          scheduleRefresh();
          return;
        }
        if (m.type === 'attributes' && m.attributeName === 'checked') {
          scheduleRefresh();
          return;
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['checked'],
    });

    document.addEventListener('change', function (e) {
      const t = e.target;
      if (t && t.type === 'checkbox' && t.id && t.id.indexOf('-is_archived') !== -1) {
        toggleArchivedBlocks(getShow('archived'));
      }
    });

    let checkCount = 0;
    const maxChecks = 20;
    const checkInterval = setInterval(function () {
      checkCount += 1;
      initCollapsibleBlocks(false);
      const emailBlock = document.querySelector('.form-row.field-emailmessage');
      const hasButton = emailBlock && emailBlock.querySelector('.hlt-hide-collapse-btn');
      if (checkCount >= maxChecks || hasButton) clearInterval(checkInterval);
    }, 1000);
  }

  function boot() {
    registerMenus();
    applyVisibility();
    initCollapsibleBlocks(false);
    observePageChanges();
    setTimeout(function () {
      initCollapsibleBlocks(false);
    }, 500);
    setTimeout(function () {
      initCollapsibleBlocks(false);
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
