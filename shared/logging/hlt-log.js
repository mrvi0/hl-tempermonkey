/**
 * HLT Console Logger — canon for HotelLab userscripts
 *
 * Usage:
 *   const log = HLTLog.create({ ns: 'Toolkit/JSR' });
 *   log.ok('Сохранено', { forms: 1 });
 *   log.fail('JSR_INVALID_JSON', { id: '…', cause: err });
 *   // → ERROR Невалидный JSON в редакторе  [JSR_INVALID_JSON]
 */
(function (root) {
  'use strict';

  const LEVELS = { debug: 10, info: 20, ok: 30, warn: 40, error: 50, silent: 100 };

  const STYLES = {
    badge:
      'font-family:ui-monospace,JetBrains Mono,monospace;font-weight:700;font-size:11px;padding:2px 6px;border-radius:4px;margin-right:4px;',
    ns: 'background:#666547;color:#ffe28a;',
    debug: 'background:#2d3a46;color:#9aa8b5;',
    info: 'background:#1a222b;color:#e8eef3;border:1px solid #2d3a46;',
    ok: 'background:#1e3a30;color:#6fcb9f;',
    warn: 'background:#3d3210;color:#ffe28a;',
    error: 'background:#4a1208;color:#ff8a6e;',
    code: 'font-family:ui-monospace,JetBrains Mono,monospace;font-size:10px;color:#9aa8b5;margin-left:6px;',
    msg: 'font-family:Source Sans 3,system-ui,sans-serif;color:inherit;',
    meta: 'font-family:ui-monospace,JetBrains Mono,monospace;font-size:11px;color:#9aa8b5;',
  };

  /**
   * Каталог кодов: стабильный CODE + русский title/hint.
   * Английский текст браузерных Error оставляем в payload.cause.
   */
  const ERRORS = {
    // Toolkit shell
    TOOLKIT_BOOT_FAIL: {
      title: 'Не удалось запустить модуль Toolkit',
      hint: 'Смотри cause — часто null DOM при раннем boot',
      level: 'error',
    },
    TOOLKIT_ALREADY_OPEN: {
      title: 'Окно Toolkit уже открыто',
      hint: 'Повторный клик по launcher проигнорирован',
      level: 'warn',
    },

    // JSR
    JSR_NO_EDITORS: {
      title: 'JSON-редакторы на странице не найдены',
      hint: 'Ожидался textarea.for_jsoneditor — страница ещё грузится или это не Admin change',
      level: 'error',
    },
    JSR_INVALID_JSON: {
      title: 'Невалидный JSON в редакторе',
      hint: 'Исправь синтаксис в textarea / JSONEditor и повтори',
      level: 'error',
    },
    JSR_BAD_REGEX: {
      title: 'Ошибка в регулярном выражении поиска',
      hint: 'Проверь синтаксис regex или выключи режим Regex',
      level: 'error',
    },
    JSR_NO_JSONEDITOR_UI: {
      title: 'Экземпляр JSONEditor не найден',
      hint: 'Textarea обновлена, визуальный редактор мог не синхронизироваться',
      level: 'warn',
    },
    JSR_SYNC_ABORT: {
      title: 'Синхронизация прервана',
      hint: 'Часть сезонов могла обновиться — проверь completed/total',
      level: 'error',
    },
    JSR_EMPTY_TERM: {
      title: 'Пустой поисковый запрос',
      hint: 'Укажи строку поиска',
      level: 'warn',
    },

    // Competitors
    COMP_NO_FIELDS: {
      title: 'Не найдены JSON-поля с parsing / concurents',
      hint: 'Раскрой блоки Django Admin и нажми «Пересканировать»',
      level: 'error',
    },
    COMP_NO_FORM: {
      title: 'Форма Django Admin не найдена',
      hint: 'JSON уже в полях — сохрани стандартной кнопкой Save',
      level: 'warn',
    },
    COMP_POST_HTTP: {
      title: 'Ошибка HTTP при сохранении формы',
      hint: 'Проверь status и URL в payload',
      level: 'error',
    },
    COMP_DJANGO_VALIDATION: {
      title: 'Django вернул ошибки валидации',
      hint: 'Открой ответ сервера / errorlist на странице',
      level: 'error',
    },
    COMP_NO_SOURCE: {
      title: 'Источник цен не выбран',
      hint: 'Выбери источник в селекте перед сохранением',
      level: 'warn',
    },
    COMP_NO_SEASONS: {
      title: 'Сезоны не выбраны',
      hint: 'Отметь сезоны или сохрани только источник',
      level: 'warn',
    },

    // Base Price
    BP_INVALID_NUMBER: {
      title: 'Некорректное числовое значение',
      hint: 'В поле value нужно число (процент или абсолют)',
      level: 'error',
    },
    BP_NO_SOURCE_KEY: {
      title: 'В профиле нет ключа-источника цены',
      hint: 'Нет min_price / max_price — профиль пропущен',
      level: 'warn',
    },
    BP_EDITOR_FAIL: {
      title: 'Ошибка обработки JSON-редактора (Base Price)',
      hint: 'Смотри editorName и cause',
      level: 'error',
    },

    // Hide Elements (legacy name in comments)
    UI_BLOCK_NOT_FOUND: {
      title: 'Блок Hide Elements не найден в DOM',
      hint: 'Проверь id блока / разметку Admin',
      level: 'warn',
    },
    UI_GM_UNAVAILABLE: {
      title: 'GM_* API недоступен',
      hint: 'Добавь @grant GM_setValue / GM_getValue в userscript',
      level: 'error',
    },

    // Generic
    UNHANDLED: {
      title: 'Необработанное исключение',
      hint: 'Смотри cause.stack',
      level: 'error',
    },
    ABORTED: {
      title: 'Операция отменена',
      hint: 'Пользователь закрыл окно или AbortController',
      level: 'warn',
    },
    UNKNOWN: {
      title: 'Неизвестная ошибка',
      hint: 'Код отсутствует в каталоге HLTLog.ERRORS — добавь его',
      level: 'error',
    },
  };

  function ts() {
    const d = new Date();
    return d.toISOString().slice(11, 23);
  }

  function normalizeCause(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const out = Object.assign({}, payload);
    if (out.cause instanceof Error) {
      out.cause = {
        name: out.cause.name,
        message: out.cause.message,
        stack: out.cause.stack,
      };
    } else if (payload instanceof Error) {
      return {
        name: payload.name,
        message: payload.message,
        stack: payload.stack,
      };
    }
    return out;
  }

  function resolveCode(code) {
    const entry = ERRORS[code];
    if (entry) return Object.assign({ code: code }, entry);
    return Object.assign({ code: code }, ERRORS.UNKNOWN, {
      title: ERRORS.UNKNOWN.title + ': ' + code,
    });
  }

  function create(options) {
    const opts = Object.assign(
      {
        ns: 'HLT',
        level: 'debug',
        enabled: true,
        mirror: null,
      },
      options || {}
    );

    function currentMin() {
      return LEVELS[opts.level] != null ? LEVELS[opts.level] : LEVELS.debug;
    }

    function emit(level, message, payload, extra) {
      if (!opts.enabled) return;
      if ((LEVELS[level] || 0) < currentMin()) return;

      const nsLabel = '[HLT:' + opts.ns + ']';
      const lvlLabel = level.toUpperCase();
      const time = ts();
      const code = extra && extra.code;
      const hint = extra && extra.hint;

      let fmt = '%c' + nsLabel + '%c' + lvlLabel + '%c ' + message;
      const args = [
        null,
        STYLES.badge + STYLES.ns,
        STYLES.badge + STYLES[level],
        STYLES.msg,
      ];

      if (code) {
        fmt += '%c [' + code + ']';
        args.push(STYLES.code);
      }

      const meta = normalizeCause(payload);
      if (meta !== undefined) {
        fmt += '%c';
        args.push(STYLES.meta);
        args.push(meta);
      }

      args[0] = fmt;

      const method =
        level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      // eslint-disable-next-line no-console
      console[method].apply(console, args);

      if (hint) {
        // eslint-disable-next-line no-console
        console.log(
          '%c' + nsLabel + '%chint%c ' + hint,
          STYLES.badge + STYLES.ns,
          STYLES.badge + STYLES.debug,
          STYLES.meta
        );
      }

      if (typeof opts.mirror === 'function') {
        opts.mirror({
          time: time,
          ns: opts.ns,
          level: level,
          message: String(message),
          code: code || null,
          hint: hint || null,
          payload: meta,
        });
      }
    }

    const api = {
      ns: opts.ns,
      setLevel: function (level) {
        opts.level = level;
      },
      setEnabled: function (on) {
        opts.enabled = !!on;
      },
      child: function (ns) {
        return create(Object.assign({}, opts, { ns: opts.ns + '/' + ns }));
      },

      debug: function (message, payload) {
        emit('debug', message, payload);
      },
      info: function (message, payload) {
        emit('info', message, payload);
      },
      ok: function (message, payload) {
        emit('ok', message, payload);
      },
      warn: function (message, payload) {
        emit('warn', message, payload);
      },
      error: function (message, payload) {
        emit('error', message, payload);
      },

      /**
       * Ошибка/варн по коду из каталога (русский title + hint + CODE).
       * log.fail('JSR_INVALID_JSON', { id, cause: err })
       */
      fail: function (code, payload) {
        const entry = resolveCode(code);
        const level = entry.level === 'warn' ? 'warn' : 'error';
        const body = Object.assign({ code: entry.code, hint: entry.hint }, normalizeCause(payload) || {});
        emit(level, entry.title, body, { code: entry.code, hint: entry.hint });
      },

      /** То же, что fail, но принудительно warn */
      failWarn: function (code, payload) {
        const entry = resolveCode(code);
        const body = Object.assign({ code: entry.code, hint: entry.hint }, normalizeCause(payload) || {});
        emit('warn', entry.title, body, { code: entry.code, hint: entry.hint });
      },

      event: function (name, payload) {
        emit('info', '▸ ' + name, payload);
      },

      group: function (label, fn) {
        if (!opts.enabled || currentMin() > LEVELS.debug) {
          if (typeof fn === 'function') return fn();
          return;
        }
        // eslint-disable-next-line no-console
        console.groupCollapsed(
          '%c[HLT:' + opts.ns + ']%cGROUP%c ' + label,
          STYLES.badge + STYLES.ns,
          STYLES.badge + STYLES.debug,
          STYLES.msg
        );
        try {
          return typeof fn === 'function' ? fn() : undefined;
        } finally {
          // eslint-disable-next-line no-console
          console.groupEnd();
        }
      },

      table: function (rows, label) {
        if (!opts.enabled) return;
        if (label) emit('debug', label);
        // eslint-disable-next-line no-console
        console.table(rows);
        if (typeof opts.mirror === 'function') {
          opts.mirror({
            time: ts(),
            ns: opts.ns,
            level: 'debug',
            message: 'table' + (label ? ': ' + label : ''),
            code: null,
            hint: null,
            payload: rows,
          });
        }
      },

      time: function (label) {
        if (!opts.enabled) return;
        // eslint-disable-next-line no-console
        console.time('[HLT:' + opts.ns + '] ' + label);
      },
      timeEnd: function (label) {
        if (!opts.enabled) return;
        // eslint-disable-next-line no-console
        console.timeEnd('[HLT:' + opts.ns + '] ' + label);
      },
    };

    return api;
  }

  root.HLTLog = {
    create: create,
    LEVELS: LEVELS,
    STYLES: STYLES,
    ERRORS: ERRORS,
    codes: function () {
      return Object.keys(ERRORS);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
