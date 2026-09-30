// ==UserScript==
// @name         JSON Editor Global Search
// @namespace    http://tampermonkey.net/
// @version      2.7.0
// @description  Глобальный поиск и замена по всем JSON редакторам HotelLab с diff preview, debug режимом и синхронизацией parsing
// @author       Mr Vi
// @match        https://app.hotellab.io/ru/AdminOnly/mainApp/hotels/*
// @match        https://app.revlab.ru/ru/AdminOnly/mainApp/hotels/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Добавляем кастомные стили
    const customStyles = `
        .hl-json-search-btn {
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            z-index: 10000 !important;
            background: #007cba !important;
            color: white !important;
            border: none !important;
            padding: 10px 15px !important;
            border-radius: 5px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
            font-family: Arial, sans-serif !important;
        }

        .hl-json-modal {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0,0,0,0.7) !important;
            z-index: 10001 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }

        .hl-json-modal-content {
            background: white !important;
            padding: 20px 40px !important;
            margin: 0 30px !important;
            border-radius: 10px !important;
            width: calc(100vw - 80px) !important;
            max-height: calc(100vh - 80px) !important;
            overflow: hidden !important;
            font-family: Arial, sans-serif !important;
            display: flex !important;
            flex-direction: column !important;
        }

        .hl-json-modal-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 20px !important;
            border-bottom: 2px solid #eee !important;
            padding-bottom: 10px !important;
        }

        .hl-json-modal-title {
            margin: 0 !important;
            color: #333 !important;
            font-size: 20px !important;
        }

        .hl-json-close-btn {
            background: #dc3545 !important;
            color: white !important;
            border: none !important;
            padding: 8px 12px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 14px !important;
        }

        .hl-json-search-controls {
            margin-bottom: 20px !important;
            display: flex !important;
            gap: 10px !important;
            align-items: flex-start !important;
            flex-wrap: wrap !important;
        }

        .hl-json-search-input {
            flex: 1 !important;
            min-width: 200px !important;
            padding: 8px !important;
            border: 1px solid #ddd !important;
            border-radius: 3px !important;
            font-size: 14px !important;
            font-family: 'Courier New', monospace !important;
            resize: vertical !important;
            min-height: 38px !important;
            max-height: 300px !important;
            overflow-y: auto !important;
            line-height: 1.4 !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
        }

        .hl-json-replace-input {
            flex: 1 !important;
            min-width: 200px !important;
            padding: 8px !important;
            border: 1px solid #ddd !important;
            border-radius: 3px !important;
            font-size: 14px !important;
            font-family: 'Courier New', monospace !important;
            resize: vertical !important;
            min-height: 38px !important;
            max-height: 300px !important;
            overflow-y: auto !important;
            line-height: 1.4 !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
        }

        .hl-json-search-btn {
            background: #28a745 !important;
            color: white !important;
            border: none !important;
            padding: 8px 15px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            height: fit-content !important;
            align-self: flex-start !important;
        }

        .hl-json-replace-btn {
            background: #ffc107 !important;
            color: #333 !important;
            border: none !important;
            padding: 8px 15px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            height: fit-content !important;
            align-self: flex-start !important;
        }

        .hl-json-clear-btn {
            background: #6c757d !important;
            color: white !important;
            border: none !important;
            padding: 8px 15px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            height: fit-content !important;
            align-self: flex-start !important;
        }
        
        .hl-json-sync-intercept-btn {
            background: #17a2b8 !important;
            color: white !important;
            border: none !important;
            padding: 8px 15px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            height: fit-content !important;
            align-self: flex-start !important;
        }
        
        .hl-json-sync-intercept-btn:hover {
            background: #138496 !important;
        }

        .hl-json-sync-price-edges-btn {
            background: #fd7e14 !important;
            color: white !important;
            border: none !important;
            padding: 8px 15px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            height: fit-content !important;
            align-self: flex-start !important;
        }

        .hl-json-sync-price-edges-btn:hover {
            background: #e8590c !important;
        }
        
        .hl-json-sync-intercept-btn {
            position: relative !important;
        }
        
        .hl-json-sync-tooltip {
            position: absolute !important;
            bottom: -10px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            background: white !important;
            border: 2px solid #17a2b8 !important;
            border-radius: 8px !important;
            padding: 10px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
            z-index: 10030 !important;
            opacity: 0 !important;
            visibility: hidden !important;
            transition: all 0.3s ease !important;
            pointer-events: none !important;
            max-width: 400px !important;
        }
        
        .hl-json-sync-tooltip img {
            max-width: 100% !important;
            height: auto !important;
            border-radius: 4px !important;
            display: block !important;
        }
        
        .hl-json-sync-heart {
            font-size: 24px !important;
            text-align: center !important;
            margin-bottom: 8px !important;
            animation: heartbeat 1.5s ease-in-out infinite !important;
        }
        
        @keyframes heartbeat {
            0% { transform: scale(1); }
            25% { transform: scale(1.1); }
            50% { transform: scale(1); }
            75% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .hl-json-sync-intercept-btn:hover .hl-json-sync-tooltip {
            opacity: 1 !important;
            visibility: visible !important;
            bottom: -15px !important;
        }
        
        .hl-json-sync-parsing-btn {
            background: #6f42c1 !important;
            color: white !important;
            border: none !important;
            padding: 8px 15px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            height: fit-content !important;
            align-self: flex-start !important;
        }
        
        .hl-json-sync-parsing-btn:hover {
            background: #5a32a3 !important;
        }
        
        .hl-json-parsing-modal {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0,0,0,0.7) !important;
            z-index: 10015 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        
        .hl-json-parsing-modal-content {
            background: white !important;
            border-radius: 10px !important;
            padding: 30px !important;
            box-shadow: 0 4px 24px rgba(0,0,0,0.3) !important;
            min-width: 500px !important;
            max-width: 80vw !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
            border: 2px solid #6f42c1 !important;
        }
        
        .hl-json-parsing-modal-title {
            font-size: 24px !important;
            font-weight: bold !important;
            margin-bottom: 20px !important;
            color: #6f42c1 !important;
            text-align: center !important;
        }
        
        .hl-json-parsing-fields {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
            margin: 20px 0 !important;
            padding: 15px !important;
            background: #f8f9fa !important;
            border-radius: 5px !important;
        }
        
        .hl-json-parsing-field-label {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            font-size: 14px !important;
            color: #333 !important;
            cursor: pointer !important;
            padding: 5px !important;
        }
        
        .hl-json-parsing-field-label:hover {
            background: #e9ecef !important;
            border-radius: 3px !important;
        }
        
        .hl-json-parsing-field-checkbox {
            margin: 0 !important;
            transform: scale(1.2) !important;
            cursor: pointer !important;
        }
        
        .hl-json-parsing-default-fields {
            background: #e3f2fd !important;
            padding: 15px !important;
            border-radius: 5px !important;
            margin-bottom: 15px !important;
            border-left: 4px solid #2196f3 !important;
        }
        
        .hl-json-parsing-buttons {
            display: flex !important;
            gap: 15px !important;
            justify-content: center !important;
            margin-top: 25px !important;
        }
        
        .hl-json-parsing-btn-action {
            padding: 12px 25px !important;
            border: none !important;
            border-radius: 5px !important;
            font-size: 16px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            transition: all 0.2s !important;
        }
        
        .hl-json-parsing-btn-sync {
            background: #6f42c1 !important;
            color: white !important;
        }
        
        .hl-json-parsing-btn-sync:hover {
            background: #5a32a3 !important;
            transform: translateY(-1px) !important;
        }
        
        .hl-json-parsing-btn-cancel {
            background: #6c757d !important;
            color: white !important;
        }
        
        .hl-json-parsing-btn-cancel:hover {
            background: #5a6268 !important;
            transform: translateY(-1px) !important;
        }

        .hl-json-options {
            margin-bottom: 15px !important;
            display: flex !important;
            gap: 15px !important;
            flex-wrap: wrap !important;
        }

        .hl-json-checkbox-label {
            display: flex !important;
            align-items: center !important;
            gap: 5px !important;
            font-size: 14px !important;
            color: #333 !important;
        }

        .hl-json-checkbox {
            margin: 0 !important;
        }

        .hl-json-results {
            border: 1px solid #ddd !important;
            padding: 15px !important;
            min-height: 200px !important;
            max-height: 300px !important;
            background: #f8f9fa !important;
            border-radius: 5px !important;
            overflow-y: auto !important;
            flex: 1 !important;
        }

        .hl-json-result-item {
            border: 1px solid #ddd !important;
            margin: 10px 0 !important;
            padding: 15px !important;
            border-radius: 5px !important;
            background: white !important;
        }

        .hl-json-result-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 10px !important;
        }

        .hl-json-result-title {
            margin: 0 !important;
            color: #007cba !important;
            font-size: 16px !important;
            font-weight: bold !important;
        }

        .hl-json-result-count {
            background: #28a745 !important;
            color: white !important;
            padding: 2px 8px !important;
            border-radius: 10px !important;
            font-size: 12px !important;
        }

        .hl-json-result-actions {
            display: flex !important;
            gap: 10px !important;
            margin-top: 10px !important;
        }

        .hl-json-goto-btn {
            background: #007cba !important;
            color: white !important;
            border: none !important;
            padding: 5px 10px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 12px !important;
        }

        .hl-json-replace-all-btn {
            background: #dc3545 !important;
            color: white !important;
            border: none !important;
            padding: 5px 10px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 12px !important;
        }

        .hl-json-preview {
            margin-top: 10px !important;
            max-height: 300px !important;
            overflow-y: auto !important;
            background: #fff !important;
            padding: 12px !important;
            border-radius: 5px !important;
            font-family: 'Courier New', monospace !important;
            font-size: 15px !important;
            border: 2px solid #007cba !important;
            color: #222 !important;
            line-height: 1.5 !important;
        }

        .hl-json-highlight {
            background: #ffe600 !important;
            color: #000 !important;
            font-weight: bold !important;
            padding: 2px 4px !important;
            border-radius: 2px !important;
        }

        .hl-json-replace-highlight {
            background: #ffeb3b !important;
            color: #000 !important;
            font-weight: bold !important;
            padding: 2px 4px !important;
            border-radius: 2px !important;
            text-decoration: underline !important;
        }

        .hl-json-open-btn {
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            z-index: 10000 !important;
            background: #007cba !important;
            color: white !important;
            border: none !important;
            padding: 10px 15px !important;
            border-radius: 5px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
            font-family: Arial, sans-serif !important;
        }
        .hl-json-modal-search-btn {
            background: #28a745 !important;
            color: white !important;
            border: none !important;
            padding: 8px 15px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            height: fit-content !important;
            align-self: flex-start !important;
        }
        .hl-json-replace-summary {
            background: #ffe600 !important;
            color: #222 !important;
            font-weight: bold !important;
            border: 2px solid #007cba !important;
            border-radius: 5px !important;
            padding: 12px 16px !important;
            margin-bottom: 15px !important;
            text-align: center !important;
            font-size: 16px !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important;
        }
        .hl-json-confirm-modal {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0,0,0,0.5) !important;
            z-index: 10010 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        .hl-json-confirm-content {
            background: #fff !important;
            border-radius: 10px !important;
            padding: 32px 32px 24px 32px !important;
            box-shadow: 0 4px 24px rgba(0,0,0,0.18) !important;
            min-width: 320px !important;
            max-width: 90vw !important;
            text-align: center !important;
            border: 2px solid #007cba !important;
        }
        .hl-json-confirm-title {
            font-size: 20px !important;
            font-weight: bold !important;
            margin-bottom: 18px !important;
            color: #222 !important;
        }
        .hl-json-confirm-btn {
            background: #007cba !important;
            color: #fff !important;
            border: none !important;
            border-radius: 4px !important;
            padding: 10px 24px !important;
            font-size: 16px !important;
            margin: 0 10px !important;
            cursor: pointer !important;
            font-weight: bold !important;
            transition: background 0.2s;
        }
        .hl-json-confirm-btn:hover {
            background: #005b8a !important;
        }
        .hl-json-toast {
            position: fixed !important;
            top: 32px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            background: #28a745 !important;
            color: #fff !important;
            font-weight: bold !important;
            font-size: 17px !important;
            padding: 16px 32px !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 24px rgba(0,0,0,0.18) !important;
            z-index: 10020 !important;
            opacity: 0;
            transition: opacity 0.3s;
            cursor: pointer;
            text-align: center !important;
        }
        .hl-json-toast-show {
            opacity: 1 !important;
        }
        
        .hl-json-toast-error {
            background: #dc3545 !important;
        }
        
        /* Debug чекбокс */
        .hl-json-debug-toggle {
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            z-index: 10002 !important;
            background: rgba(0, 0, 0, 0.8) !important;
            color: white !important;
            padding: 10px 15px !important;
            border-radius: 5px !important;
            font-size: 12px !important;
            display: none !important;
            align-items: center !important;
            gap: 8px !important;
            cursor: pointer !important;
            transition: all 0.3s !important;
        }
        
        .hl-json-debug-toggle.show {
            display: flex !important;
        }
        
        .hl-json-debug-toggle:hover {
            background: rgba(0, 0, 0, 0.9) !important;
        }
        
        .hl-json-debug-checkbox {
            margin: 0 !important;
            transform: scale(1.2) !important;
        }
        
        /* Diff стили */
        .hl-json-diff-container {
            border: 1px solid #ddd !important;
            border-radius: 5px !important;
            overflow: hidden !important;
            margin: 10px 0 !important;
            max-height: 400px !important;
            display: flex !important;
            flex-direction: column !important;
        }
        
        .hl-json-diff-config-name {
            background: #007cba !important;
            color: white !important;
            padding: 12px 20px !important;
            font-size: 16px !important;
            font-weight: bold !important;
            text-align: center !important;
        }
        
        .hl-json-diff-sides {
            display: flex !important;
            flex: 1 !important;
            overflow: hidden !important;
        }
        
        .hl-json-diff-actions {
            background: #f8f9fa !important;
            padding: 15px !important;
            text-align: center !important;
            border-top: 1px solid #ddd !important;
        }
        
        .hl-json-replace-current-btn {
            background: #ffc107 !important;
            color: #333 !important;
            border: none !important;
            padding: 8px 15px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            margin-right: 10px !important;
        }
        
        .hl-json-diff-side {
            flex: 1 !important;
            padding: 15px !important;
        }
        
        .hl-json-diff-left {
            background: #ffe6e6 !important;
            border-right: 1px solid #ddd !important;
        }
        
        .hl-json-diff-right {
            background: #e6ffe6 !important;
        }
        
        .hl-json-diff-change {
            background: #ffcccb !important;
            color: #8b0000 !important;
            font-weight: bold !important;
            padding: 2px 4px !important;
            border-radius: 2px !important;
        }
        
        .hl-json-diff-change-new {
            background: #90ee90 !important;
            color: #006400 !important;
            font-weight: bold !important;
            padding: 2px 4px !important;
            border-radius: 2px !important;
        }
        
        .hl-json-diff-header {
            font-weight: bold !important;
            margin-bottom: 10px !important;
            color: #333 !important;
            font-size: 14px !important;
        }
        
        .hl-json-diff-content {
            font-family: 'Courier New', monospace !important;
            font-size: 13px !important;
            line-height: 1.4 !important;
            white-space: pre-wrap !important;
            height: 100% !important;
            overflow-y: auto !important;
            color: #514f4f !important;
        }
        
        .hl-json-search-context {
            color: #514f4f !important;
            font-family: 'Courier New', monospace !important;
            font-size: 13px !important;
            line-height: 1.4 !important;
            white-space: pre-wrap !important;
        }
        
        /* Пагинация */
        .hl-json-pagination {
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            margin: 20px 0 0 0 !important;
            gap: 10px !important;
            flex-shrink: 0 !important;
        }
        
        .hl-json-pagination-btn {
            background: #007cba !important;
            color: white !important;
            border: none !important;
            padding: 8px 12px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            min-width: 40px !important;
        }
        
        .hl-json-pagination-btn:disabled {
            background: #ccc !important;
            cursor: not-allowed !important;
        }
        
        .hl-json-pagination-info {
            background: #f8f9fa !important;
            padding: 8px 15px !important;
            border-radius: 3px !important;
            font-size: 14px !important;
            color: #333 !important;
            border: 1px solid #ddd !important;
        }
        
        .hl-json-current-config {
            background: #e3f2fd !important;
            border: 2px solid #2196f3 !important;
            border-radius: 5px !important;
            padding: 15px !important;
            margin: 10px 0 !important;
        }
        
        .hl-json-config-title {
            font-weight: bold !important;
            color: #1976d2 !important;
            margin-bottom: 10px !important;
            font-size: 16px !important;
        }
        
        .hl-json-replace-current-btn {
            background: #ff9800 !important;
            color: white !important;
            border: none !important;
            padding: 8px 15px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            margin-left: 10px !important;
        }
        
        .hl-json-confirm-replace-btn {
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            background: #dc3545 !important;
            color: white !important;
            border: none !important;
            padding: 15px 30px !important;
            border-radius: 8px !important;
            cursor: pointer !important;
            font-size: 18px !important;
            font-weight: bold !important;
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4) !important;
            z-index: 10002 !important;
            transition: all 0.3s !important;
        }
        
        .hl-json-confirm-replace-btn:hover {
            background: #c82333 !important;
            transform: scale(1.05) !important;
            box-shadow: 0 6px 16px rgba(220, 53, 69, 0.6) !important;
        }
        
        /* Модальное окно подтверждения замены */
        .hl-json-replace-confirm-modal {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0,0,0,0.6) !important;
            z-index: 10020 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        
        .hl-json-replace-confirm-content {
            background: white !important;
            border-radius: 10px !important;
            padding: 30px !important;
            box-shadow: 0 4px 24px rgba(0,0,0,0.3) !important;
            min-width: 500px !important;
            max-width: 80vw !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
            border: 2px solid #dc3545 !important;
        }
        
        .hl-json-replace-confirm-title {
            font-size: 24px !important;
            font-weight: bold !important;
            margin-bottom: 20px !important;
            color: #dc3545 !important;
            text-align: center !important;
        }
        
        .hl-json-replace-confirm-text {
            font-size: 16px !important;
            margin-bottom: 20px !important;
            color: #333 !important;
            line-height: 1.5 !important;
        }
        
        .hl-json-replace-confirm-details {
            background: #f8f9fa !important;
            padding: 15px !important;
            border-radius: 5px !important;
            margin: 15px 0 !important;
            border-left: 4px solid #007cba !important;
            color: #514f4f !important;
        }
        
        .hl-json-replace-confirm-buttons {
            display: flex !important;
            gap: 15px !important;
            justify-content: center !important;
            margin-top: 25px !important;
        }
        
        .hl-json-replace-confirm-btn {
            padding: 12px 25px !important;
            border: none !important;
            border-radius: 5px !important;
            font-size: 16px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            transition: all 0.2s !important;
        }
        
        .hl-json-replace-confirm-yes {
            background: #dc3545 !important;
            color: white !important;
        }
        
        .hl-json-replace-confirm-yes:hover {
            background: #c82333 !important;
            transform: translateY(-1px) !important;
        }
        
        .hl-json-replace-confirm-no {
            background: #6c757d !important;
            color: white !important;
        }
        
        .hl-json-replace-confirm-no:hover {
            background: #5a6268 !important;
            transform: translateY(-1px) !important;
        }
        
        /* Base Price Maker стили - отдельная кнопка и popup */
        #hl-base-price-maker-btn {
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

        #hl-base-price-maker-btn:hover {
            background: #205067 !important;
        }

        /* Popup UI */
        #hl-base-price-maker-popup {
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

        #hl-base-price-maker-popup.visible {
            display: block !important;
        }

        #hl-base-price-maker-popup h3 {
            margin: 0 0 15px 0 !important;
            padding: 0 0 10px 0 !important;
            border-bottom: 1px solid #eee !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            color: #333 !important;
        }
        
        .hl-base-price-section {
            margin-bottom: 20px !important;
        }

        .hl-base-price-section:last-child {
            margin-bottom: 0 !important;
        }

        .hl-base-price-label {
            display: block !important;
            font-size: 13px !important;
            color: #666 !important;
            margin-bottom: 8px !important;
            font-weight: 500 !important;
        }

        .hl-base-price-select,
        .hl-base-price-input {
            width: 100% !important;
            padding: 8px 12px !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            box-sizing: border-box !important;
        }

        .hl-base-price-select:focus,
        .hl-base-price-input:focus {
            outline: none !important;
            border-color: #417690 !important;
        }

        .hl-base-price-toggle-group {
            display: flex !important;
            gap: 10px !important;
            margin-bottom: 10px !important;
        }

        .hl-base-price-toggle-btn {
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

        .hl-base-price-toggle-btn.active {
            background: #417690 !important;
            color: #fff !important;
            border-color: #417690 !important;
        }

        .hl-base-price-toggle-btn:hover {
            border-color: #417690 !important;
        }

        .hl-base-price-input-group {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }

        .hl-base-price-input-group .hl-base-price-input {
            flex: 1 !important;
        }

        .hl-base-price-suffix {
            font-size: 13px !important;
            color: #666 !important;
            min-width: 30px !important;
        }

        .hl-base-price-actions {
            display: flex !important;
            gap: 10px !important;
            margin-top: 20px !important;
        }

        .hl-base-price-btn {
            flex: 1 !important;
            padding: 10px 16px !important;
            border: none !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: background 0.2s !important;
        }

        .hl-base-price-btn-primary {
            background: #417690 !important;
            color: #fff !important;
        }

        .hl-base-price-btn-primary:hover {
            background: #205067 !important;
        }

        .hl-base-price-btn:disabled {
            background: #ccc !important;
            cursor: not-allowed !important;
        }

        .hl-base-price-editors-list {
            max-height: 200px !important;
            overflow-y: auto !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
            padding: 10px !important;
            background: #f9f9f9 !important;
            margin-top: 10px !important;
        }

        .hl-base-price-editor-item {
            padding: 8px !important;
            margin-bottom: 5px !important;
            background: #fff !important;
            border-radius: 3px !important;
            font-size: 12px !important;
            border-left: 3px solid #417690 !important;
        }

        .hl-base-price-editor-item:last-child {
            margin-bottom: 0 !important;
        }

        .hl-base-price-result {
            margin-top: 15px !important;
            padding: 10px !important;
            background: #f0f8ff !important;
            border: 1px solid #b0d4f1 !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            color: #333 !important;
        }

        .hl-base-price-error {
            margin-top: 15px !important;
            padding: 10px !important;
            background: #ffe6e6 !important;
            border: 1px solid #ff9999 !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            color: #cc0000 !important;
        }

        .hl-base-price-success {
            margin-top: 15px !important;
            padding: 10px !important;
            background: #d4edda !important;
            border: 1px solid #c3e6cb !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            color: #155724 !important;
        }

        /* Overlay для закрытия popup */
        #hl-base-price-maker-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 10000 !important;
            display: none !important;
        }

        #hl-base-price-maker-overlay.visible {
            display: block !important;
        }
        
        .hl-base-price-controls {
            display: flex !important;
            flex-direction: column !important;
            gap: 15px !important;
        }
        
        .hl-base-price-row {
            display: flex !important;
            gap: 10px !important;
            align-items: center !important;
            flex-wrap: wrap !important;
        }
        
        .hl-base-price-label {
            font-size: 13px !important;
            color: #666 !important;
            font-weight: 500 !important;
            min-width: 120px !important;
        }
        
        .hl-base-price-select {
            padding: 8px 12px !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            min-width: 150px !important;
        }
        
        .hl-base-price-toggle-group {
            display: flex !important;
            gap: 10px !important;
        }
        
        .hl-base-price-toggle-btn {
            padding: 8px 16px !important;
            border: 1px solid #ddd !important;
            background: #fff !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 13px !important;
            transition: all 0.2s !important;
        }
        
        .hl-base-price-toggle-btn.active {
            background: #417690 !important;
            color: #fff !important;
            border-color: #417690 !important;
        }
        
        .hl-base-price-toggle-btn:hover {
            border-color: #417690 !important;
        }
        
        .hl-base-price-input-group {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }
        
        .hl-base-price-input {
            padding: 8px 12px !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            width: 120px !important;
        }
        
        .hl-base-price-suffix {
            font-size: 13px !important;
            color: #666 !important;
            min-width: 20px !important;
        }
        
        .hl-base-price-actions {
            display: flex !important;
            gap: 10px !important;
            margin-top: 10px !important;
        }
        
        .hl-base-price-btn {
            padding: 10px 16px !important;
            border: none !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: background 0.2s !important;
        }
        
        .hl-base-price-btn-primary {
            background: #417690 !important;
            color: #fff !important;
        }
        
        .hl-base-price-btn-primary:hover {
            background: #205067 !important;
        }
        
        .hl-base-price-btn:disabled {
            background: #ccc !important;
            cursor: not-allowed !important;
        }
        
        .hl-base-price-editors-list {
            max-height: 150px !important;
            overflow-y: auto !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
            padding: 10px !important;
            background: #fff !important;
            margin-top: 10px !important;
        }
        
        .hl-base-price-editor-item {
            padding: 8px !important;
            margin-bottom: 5px !important;
            background: #f9f9f9 !important;
            border-radius: 3px !important;
            font-size: 12px !important;
            border-left: 3px solid #417690 !important;
        }
        
        .hl-base-price-result {
            margin-top: 15px !important;
            padding: 10px !important;
            background: #f0f8ff !important;
            border: 1px solid #b0d4f1 !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            color: #333 !important;
        }
        
        .hl-base-price-error {
            margin-top: 15px !important;
            padding: 10px !important;
            background: #ffe6e6 !important;
            border: 1px solid #ff9999 !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            color: #cc0000 !important;
        }
        
        .hl-base-price-success {
            margin-top: 15px !important;
            padding: 10px !important;
            background: #d4edda !important;
            border: 1px solid #c3e6cb !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            color: #155724 !important;
        }
    `;

    // Добавляем стили в head
    const styleSheet = document.createElement('style');
    styleSheet.textContent = customStyles;
    document.head.appendChild(styleSheet);

    // Глобальные переменные для пагинации
    let currentResults = [];
    let currentPage = 0;
    let searchTerm = '';
    let replaceTerm = '';
    let isDiffMode = false;
    let diffResults = [];
    let diffPage = 0;
    let debugMode = false;

    // Функция для цветного логирования
    function log(level, message, ...args) {
        // Если debug режим выключен, показываем только ERROR и SUCCESS
        if (!debugMode && (level === 'DEBUG' || level === 'INFO')) {
            return;
        }
        
        const scriptName = 'JSR';
        const timestamp = new Date().toLocaleTimeString();
        
        let prefix = '';
        let color = '#000';
        
        switch(level) {
            case 'INFO':
                prefix = `%c[${scriptName}] %c[INFO] %c[${timestamp}]`;
                color = '#007cba';
                break;
            case 'DEBUG':
                prefix = `%c[${scriptName}] %c[DEBUG] %c[${timestamp}]`;
                color = '#007cba';
                break;
            case 'ERROR':
                prefix = `%c[${scriptName}] %c[ERROR] %c[${timestamp}]`;
                color = '#dc3545';
                break;
            case 'SUCCESS':
                prefix = `%c[${scriptName}] %c[SUCCESS] %c[${timestamp}]`;
                color = '#28a745';
                break;
            default:
                prefix = `%c[${scriptName}] %c[${level}] %c[${timestamp}]`;
        }
        
        console.log(
            prefix + ' %c' + message,
            'color: #28a745; font-weight: bold;', // Script name - green
            `color: ${color}; font-weight: bold;`, // Level - colored
            'color: #6c757d; font-size: 0.9em;', // Timestamp - gray
            'color: inherit;', // Message - default (inherit from console)
            ...args
        );
    }

    // Ждем загрузки страницы
    function waitForElements() {
        const jsonEditors = document.querySelectorAll('.for_jsoneditor');
        if (jsonEditors.length > 0) {
            initGlobalSearch();
        } else {
            setTimeout(waitForElements, 500);
        }
    }

    function initGlobalSearch() {
        log('SUCCESS', 'JSR скрипт инициализирован');
        
        // Создаем кнопку поиска (открытия модального окна)
        const searchButton = document.createElement('button');
        searchButton.innerHTML = '🔍 JSON Search & Replace';
        searchButton.className = 'hl-json-open-btn';
        searchButton.addEventListener('click', showSearchModal);
        document.body.appendChild(searchButton);
        
        // Создаем debug чекбокс
        createDebugToggle();
        
        // Создаем Base Price Maker кнопку и popup
        initBasePriceMakerUI();
        
        log('DEBUG', 'Кнопка поиска добавлена на страницу');
    }

    function createDebugToggle() {
        // Удаляем существующий toggle если есть
        const existingToggle = document.getElementById('hl-debug-toggle');
        if (existingToggle) {
            existingToggle.remove();
        }

        const debugToggle = document.createElement('div');
        debugToggle.id = 'hl-debug-toggle';
        debugToggle.className = 'hl-json-debug-toggle';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'hl-debug-checkbox';
        checkbox.className = 'hl-json-debug-checkbox';
        checkbox.checked = debugMode;
        
        const label = document.createElement('label');
        label.htmlFor = 'hl-debug-checkbox';
        label.textContent = 'Debug';
        label.style.cursor = 'pointer';
        label.style.margin = '0';
        
        debugToggle.appendChild(checkbox);
        debugToggle.appendChild(label);
        
        checkbox.addEventListener('change', (e) => {
            debugMode = e.target.checked;
            log('INFO', `Debug режим ${debugMode ? 'включен' : 'выключен'}`);
        });
        
        document.body.appendChild(debugToggle);
    }

    // Функция автоматического изменения высоты textarea
    function autoResizeTextarea(textarea) {
        // Сбрасываем высоту для корректного расчета
        textarea.style.height = 'auto';
        // Устанавливаем высоту равную scrollHeight, но не меньше минимальной и не больше максимальной
        const minHeight = 38; // min-height из CSS
        const maxHeight = 300; // max-height из CSS
        const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
        textarea.style.height = newHeight + 'px';
        
        // Если высота достигла максимума, показываем скроллбар
        if (textarea.scrollHeight > maxHeight) {
            textarea.style.overflowY = 'auto';
        } else {
            textarea.style.overflowY = 'hidden';
        }
    }

    function showSearchModal() {
        // Удаляем существующее модальное окно если есть
        const existingModal = document.getElementById('hl-json-search-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Показываем debug чекбокс
        const debugToggle = document.getElementById('hl-debug-toggle');
        if (debugToggle) {
            debugToggle.classList.add('show');
        }

        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.id = 'hl-json-search-modal';
        modal.className = 'hl-json-modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'hl-json-modal-content';

        modalContent.innerHTML = `
            <div class="hl-json-modal-header">
                <h2 class="hl-json-modal-title">Поиск и замена по JSON редакторам</h2>
                <button id="hl-close-modal" class="hl-json-close-btn">✕</button>
            </div>

            <div class="hl-json-search-controls">
                <textarea id="hl-search-input" class="hl-json-search-input" placeholder="Введите текст для поиска... (Enter - поиск, Shift+Enter - новая строка)" rows="1"></textarea>
                <textarea id="hl-replace-input" class="hl-json-replace-input" placeholder="Текст для замены (Shift+Enter - новая строка)" rows="1"></textarea>
                <button id="hl-search-btn" class="hl-json-modal-search-btn">Поиск</button>
                <button id="hl-replace-btn" class="hl-json-replace-btn">Применить</button>
                <button id="hl-clear-search" class="hl-json-clear-btn">Очистить</button>
                <button id="hl-sync-intercept-btn" class="hl-json-sync-intercept-btn">
                    💖 Перезаписать intercept
                    <div class="hl-json-sync-tooltip">
                        <div class="hl-json-sync-heart">💖</div>
                        <img src="https://ca.slack-edge.com/TQ428DN6R-U02C35UVATB-412d8b8dc3bd-512" alt="Intercept синхронизация" />
                    </div>
                </button>
                <button id="hl-sync-price-edges-btn" class="hl-json-sync-price-edges-btn">
                    🟧 Перезаписать price_edges
                </button>
                <button id="hl-sync-parsing-btn" class="hl-json-sync-parsing-btn">
                    🔧 Перезаписать Parsing
                </button>
            </div>

            <div class="hl-json-options">
                <label class="hl-json-checkbox-label">
                    <input type="checkbox" id="hl-case-sensitive" class="hl-json-checkbox"> Учитывать регистр
                </label>
                <label class="hl-json-checkbox-label">
                    <input type="checkbox" id="hl-use-regex" class="hl-json-checkbox"> Регулярные выражения
                </label>
                <label class="hl-json-checkbox-label">
                    <input type="checkbox" id="hl-block-search" class="hl-json-checkbox"> Поиск блоков (многострочный)
                </label>
                <label class="hl-json-checkbox-label">
                    <input type="checkbox" id="hl-preview-mode" class="hl-json-checkbox" checked> Предварительный просмотр
                </label>
            </div>

            <div id="hl-diff-preview" class="hl-json-diff-container" style="display: none;">
                <div id="hl-diff-config-name" class="hl-json-diff-config-name"></div>
                <div class="hl-json-diff-sides">
                    <div class="hl-json-diff-side hl-json-diff-left">
                        <div class="hl-json-diff-header">Было:</div>
                        <div id="hl-diff-before" class="hl-json-diff-content"></div>
                    </div>
                    <div class="hl-json-diff-side hl-json-diff-right">
                        <div class="hl-json-diff-header">Будет:</div>
                        <div id="hl-diff-after" class="hl-json-diff-content"></div>
                    </div>
                </div>
                <div id="hl-diff-actions" class="hl-json-diff-actions">
                    <button id="hl-replace-diff-btn" class="hl-json-replace-current-btn">Заменить в этом конфиге</button>
                </div>
            </div>

            <div id="hl-current-config" class="hl-json-current-config" style="display: none;">
                <div class="hl-json-config-title">
                    Текущий конфиг: <span id="hl-current-config-name"></span>
                    <button id="hl-replace-current-btn" class="hl-json-replace-current-btn">Заменить в этом конфиге</button>
                </div>
            </div>

            <div id="hl-search-results" class="hl-json-results">
                <p style="color: #6c757d; text-align: center; margin: 20px 0;">Введите текст для поиска по всем JSON редакторам</p>
            </div>

            <div id="hl-pagination" class="hl-json-pagination" style="display: none;">
                <button id="hl-prev-btn" class="hl-json-pagination-btn">‹</button>
                <div id="hl-pagination-info" class="hl-json-pagination-info">1 из 1</div>
                <button id="hl-next-btn" class="hl-json-pagination-btn">›</button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Обработчики событий
        document.getElementById('hl-close-modal').addEventListener('click', () => {
            // Удаляем кнопку подтверждения при закрытии модального окна
            const confirmBtn = document.getElementById('hl-confirm-replace-btn');
            if (confirmBtn) {
                confirmBtn.remove();
            }
            // Скрываем debug чекбокс
            const debugToggle = document.getElementById('hl-debug-toggle');
            if (debugToggle) {
                debugToggle.classList.remove('show');
            }
            modal.remove();
        });
        document.getElementById('hl-search-btn').addEventListener('click', performSearch);
        document.getElementById('hl-replace-btn').addEventListener('click', performReplace);
        document.getElementById('hl-clear-search').addEventListener('click', clearSearch);
        document.getElementById('hl-sync-intercept-btn').addEventListener('click', syncInterceptData);
        document.getElementById('hl-sync-price-edges-btn').addEventListener('click', syncPriceEdgesData);
        document.getElementById('hl-sync-parsing-btn').addEventListener('click', showParsingOptionsModal);
        
        // Обработчики для textarea с автоизменением высоты
        const searchInput = document.getElementById('hl-search-input');
        const replaceInput = document.getElementById('hl-replace-input');
        
        searchInput.addEventListener('input', function() {
            autoResizeTextarea(this);
        });
        
        replaceInput.addEventListener('input', function() {
            autoResizeTextarea(this);
        });
        
        // Enter для поиска (Ctrl+Enter для многострочного ввода)
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
                e.preventDefault();
                performSearch();
            }
        });
        
        // Инициализируем высоту при открытии
        autoResizeTextarea(searchInput);
        autoResizeTextarea(replaceInput);
        
        // Убираем автоматическое обновление diff при изменении поля замены
        
        // Обработчики пагинации
        document.getElementById('hl-prev-btn').addEventListener('click', () => {
            if (isDiffMode) {
                if (diffPage > 0) {
                    diffPage--;
                    updateDiffPagination();
                    showDiffCurrentConfig();
                    updateSearchResultsForDiff();
                }
            } else {
                if (currentPage > 0) {
                    currentPage--;
                    updatePagination();
                    showCurrentConfig();
                }
            }
        });
        
        document.getElementById('hl-next-btn').addEventListener('click', () => {
            if (isDiffMode) {
                if (diffPage < diffResults.length - 1) {
                    diffPage++;
                    updateDiffPagination();
                    showDiffCurrentConfig();
                    updateSearchResultsForDiff();
                }
            } else {
                if (currentPage < currentResults.length - 1) {
                    currentPage++;
                    updatePagination();
                    showCurrentConfig();
                }
            }
        });
        
        // Обработчик замены в текущем конфиге
        document.getElementById('hl-replace-current-btn').addEventListener('click', () => {
            if (currentResults.length > 0 && currentPage < currentResults.length) {
                const currentResult = currentResults[currentPage];
                hlExecuteSingleReplace(currentResult.textarea.id, searchTerm, replaceTerm, 
                    document.getElementById('hl-case-sensitive').checked, 
                    document.getElementById('hl-use-regex').checked);
            }
        });

        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                // Удаляем кнопку подтверждения при закрытии модального окна
                const confirmBtn = document.getElementById('hl-confirm-replace-btn');
                if (confirmBtn) {
                    confirmBtn.remove();
                }
                // Скрываем debug чекбокс
                const debugToggle = document.getElementById('hl-debug-toggle');
                if (debugToggle) {
                    debugToggle.classList.remove('show');
                }
                modal.remove();
            }
        });
    }

    function performSearch() {
        searchTerm = document.getElementById('hl-search-input').value.trim();
        const caseSensitive = document.getElementById('hl-case-sensitive').checked;
        const useRegex = document.getElementById('hl-use-regex').checked;
        const blockSearch = document.getElementById('hl-block-search').checked;
        const resultsContainer = document.getElementById('hl-search-results');

        if (!searchTerm) {
            resultsContainer.innerHTML = '<p style="color: #6c757d; text-align: center;">Введите текст для поиска</p>';
            hidePagination();
            hideDiffPreview();
            hideCurrentConfig();
            return;
        }

        currentResults = [];
        const jsonEditors = document.querySelectorAll('.for_jsoneditor');

        jsonEditors.forEach((textarea, index) => {
            try {
                const jsonText = textarea.value;
                if (!jsonText) return;

                const jsonData = JSON.parse(jsonText);
                const jsonString = JSON.stringify(jsonData, null, 2);

                let matches = [];

                if (blockSearch) {
                    // Поиск блоков - нормализуем пробелы и ищем
                    if (findBlockInText(jsonString, searchTerm, caseSensitive)) {
                        // Для блочного поиска считаем количество вхождений по нормализованному тексту
                        const normalizedText = normalizeTextForBlockSearch(jsonString);
                        const normalizedSearch = normalizeTextForBlockSearch(searchTerm);
                        const searchText = caseSensitive ? normalizedSearch : normalizedSearch.toLowerCase();
                        const textToSearch = caseSensitive ? normalizedText : normalizedText.toLowerCase();
                        
                        // Подсчитываем количество вхождений
                        let count = 0;
                        let index = textToSearch.indexOf(searchText);
                        while (index !== -1) {
                            count++;
                            index = textToSearch.indexOf(searchText, index + 1);
                        }
                        matches = new Array(count).fill(searchTerm);
                    }
                } else if (useRegex) {
                    try {
                        const flags = caseSensitive ? 'g' : 'gi';
                        const regex = new RegExp(searchTerm, flags);
                        const regexMatches = jsonString.match(regex);
                        if (regexMatches) {
                            matches = regexMatches;
                        }
                    } catch (e) {
                        // Неверное регулярное выражение
                        return;
                    }
                } else {
                    const searchText = caseSensitive ? searchTerm : searchTerm.toLowerCase();
                    const jsonTextLower = caseSensitive ? jsonString : jsonString.toLowerCase();

                    if (jsonTextLower.includes(searchText)) {
                        // Находим все вхождения
                        const regex = new RegExp(escapeRegExp(searchText), caseSensitive ? 'g' : 'gi');
                        matches = jsonString.match(regex) || [];
                    }
                }

                if (matches.length > 0) {
                    const editorName = getEditorName(textarea);
                    currentResults.push({
                        editorName,
                        textarea,
                        matches: matches.length,
                        jsonData,
                        jsonString,
                        originalJsonString: jsonString,
                        isBlockSearch: blockSearch
                    });
                }
            } catch (e) {
                // Пропускаем невалидный JSON
            }
        });

        if (currentResults.length === 0) {
            resultsContainer.innerHTML = '<p style="color: #dc3545; text-align: center;">Ничего не найдено</p>';
            hidePagination();
            hideDiffPreview();
            hideCurrentConfig();
        } else {
            currentPage = 0;
            updatePagination();
            showCurrentConfig();
        }
    }

    function performReplace() {
        const currentSearchTerm = document.getElementById('hl-search-input').value.trim();
        const currentReplaceTerm = document.getElementById('hl-replace-input').value;
        const caseSensitive = document.getElementById('hl-case-sensitive').checked;
        const useRegex = document.getElementById('hl-use-regex').checked;
        const blockSearch = document.getElementById('hl-block-search').checked;

        if (!currentSearchTerm) {
            alert('Введите текст для поиска');
            return;
        }

        if (!currentReplaceTerm) {
            alert('Введите текст для замены');
            return;
        }

        // Обновляем глобальные переменные
        searchTerm = currentSearchTerm;
        replaceTerm = currentReplaceTerm;

        // Переключаемся в режим diff
        enterDiffMode(caseSensitive, useRegex, blockSearch);
    }

    function updatePagination() {
        const pagination = document.getElementById('hl-pagination');
        const prevBtn = document.getElementById('hl-prev-btn');
        const nextBtn = document.getElementById('hl-next-btn');
        const paginationInfo = document.getElementById('hl-pagination-info');

        if (currentResults.length <= 1) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = 'flex';
        prevBtn.disabled = currentPage === 0;
        nextBtn.disabled = currentPage === currentResults.length - 1;
        paginationInfo.textContent = `${currentPage + 1} из ${currentResults.length}`;
    }

    function showCurrentConfig() {
        const currentConfigDiv = document.getElementById('hl-current-config');
        const configNameSpan = document.getElementById('hl-current-config-name');
        
        if (currentResults.length === 0) {
            currentConfigDiv.style.display = 'none';
            return;
        }

        const currentResult = currentResults[currentPage];
        configNameSpan.textContent = currentResult.editorName;
        currentConfigDiv.style.display = 'block';

        // Показываем контекст поиска вместо diff
        showSearchContext(currentResult);
    }

    function showDiffPreview(result) {
        const diffContainer = document.getElementById('hl-diff-preview');
        const diffBefore = document.getElementById('hl-diff-before');
        const diffAfter = document.getElementById('hl-diff-after');

        if (!replaceTerm) {
            hideDiffPreview();
            return;
        }

        const caseSensitive = document.getElementById('hl-case-sensitive').checked;
        const useRegex = document.getElementById('hl-use-regex').checked;
        const blockSearch = document.getElementById('hl-block-search').checked;

        let newJsonString = result.jsonString;

        if (blockSearch) {
            if (findBlockInText(result.jsonString, searchTerm, caseSensitive)) {
                const normalizedText = normalizeTextForBlockSearch(result.jsonString);
                const normalizedSearch = normalizeTextForBlockSearch(searchTerm);
                const normalizedReplace = normalizeTextForBlockSearch(replaceTerm);
                
                const searchText = caseSensitive ? normalizedSearch : normalizedSearch.toLowerCase();
                
                const regex = new RegExp(escapeRegExp(searchText), caseSensitive ? 'g' : 'gi');
                const newNormalizedText = normalizedText.replace(regex, normalizedReplace);
                newJsonString = restoreFormatting(result.jsonString, newNormalizedText);
            }
        } else if (useRegex) {
            try {
                const flags = caseSensitive ? 'g' : 'gi';
                const regex = new RegExp(searchTerm, flags);
                newJsonString = result.jsonString.replace(regex, replaceTerm);
            } catch (e) {
                newJsonString = result.jsonString;
            }
        } else {
            const regex = new RegExp(escapeRegExp(searchTerm), caseSensitive ? 'g' : 'gi');
            newJsonString = result.jsonString.replace(regex, replaceTerm);
        }

        // Показываем контекст с ±4 строками для каждого совпадения
        const beforeContext = getDiffContext(result.jsonString, searchTerm, caseSensitive, useRegex, blockSearch);
        const afterContext = getDiffContextWithReplace(newJsonString, searchTerm, replaceTerm, caseSensitive, useRegex, blockSearch);

        diffBefore.innerHTML = beforeContext;
        diffAfter.innerHTML = afterContext;
        diffContainer.style.display = 'flex';
    }

    function getDiffContext(text, searchTerm, caseSensitive, useRegex, blockSearch) {
        if (blockSearch) {
            // Для блочного поиска показываем нормализованный текст
            const normalizedText = normalizeTextForBlockSearch(text);
            const normalizedSearch = normalizeTextForBlockSearch(searchTerm);
            const searchText = caseSensitive ? normalizedSearch : normalizedSearch.toLowerCase();
            const textToSearch = caseSensitive ? normalizedText : normalizedText.toLowerCase();
            
            if (textToSearch.includes(searchText)) {
                const index = textToSearch.indexOf(searchText);
                const contextStart = Math.max(0, index - 200);
                const contextEnd = Math.min(normalizedText.length, index + searchText.length + 200);
                return normalizedText.substring(contextStart, contextEnd);
            }
            return normalizedText;
        } else {
            // Для обычного поиска показываем контекст с ±4 строками
            const lines = text.split('\n');
            const searchText = caseSensitive ? searchTerm : searchTerm.toLowerCase();
            let foundLines = [];
            
            lines.forEach((line, lineIndex) => {
                const lineLower = caseSensitive ? line : line.toLowerCase();
                if (lineLower.includes(searchText)) {
                    // Добавляем ±4 строки контекста
                    const startLine = Math.max(0, lineIndex - 4);
                    const endLine = Math.min(lines.length - 1, lineIndex + 4);
                    
                    for (let i = startLine; i <= endLine; i++) {
                        if (!foundLines.includes(i)) {
                            foundLines.push(i);
                        }
                    }
                }
            });
            
            foundLines.sort((a, b) => a - b);
            
            // Группируем найденные строки по блокам и добавляем разделители
            let groupedLines = [];
            let currentGroup = [];
            let lastLineIndex = -1;
            
            foundLines.forEach(lineIndex => {
                if (lastLineIndex === -1 || lineIndex - lastLineIndex <= 8) {
                    currentGroup.push(lineIndex);
                } else {
                    if (currentGroup.length > 0) {
                        groupedLines.push(currentGroup);
                    }
                    currentGroup = [lineIndex];
                }
                lastLineIndex = lineIndex;
            });
            
            if (currentGroup.length > 0) {
                groupedLines.push(currentGroup);
            }
            
            // Формируем текст с разделителями и выделением изменений
            return groupedLines.map((group, groupIndex) => {
                const groupText = group.map(lineIndex => {
                    const line = lines[lineIndex];
                    const isMatch = (caseSensitive ? line : line.toLowerCase()).includes(searchText);
                    const prefix = isMatch ? '→ ' : '  ';
                    
                    if (isMatch) {
                        // Выделяем найденный текст
                        const regex = useRegex ? 
                            new RegExp(searchTerm, caseSensitive ? 'g' : 'gi') :
                            new RegExp(escapeRegExp(searchText), caseSensitive ? 'g' : 'gi');
                        const highlightedLine = line.replace(regex, '<span class="hl-json-diff-change">$&</span>');
                        return prefix + highlightedLine;
                    }
                    return prefix + line;
                }).join('\n');
                
                return groupIndex > 0 ? '\n<hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;">\n' + groupText : groupText;
            }).join('');
        }
    }

    function getDiffContextWithReplace(text, searchTerm, replaceTerm, caseSensitive, useRegex, blockSearch) {
        log('DEBUG', 'getDiffContextWithReplace called with:', {
            textLength: text.length,
            searchTerm,
            replaceTerm,
            caseSensitive,
            useRegex,
            blockSearch
        });
        
        if (blockSearch) {
            // Для блочного поиска показываем нормализованный текст
            const normalizedText = normalizeTextForBlockSearch(text);
            const normalizedReplace = normalizeTextForBlockSearch(replaceTerm);
            const searchText = caseSensitive ? normalizedReplace : normalizedReplace.toLowerCase();
            const textToSearch = caseSensitive ? normalizedText : normalizedText.toLowerCase();
            
            log('DEBUG', 'Block search - normalizedReplace:', normalizedReplace);
            log('DEBUG', 'Block search - searchText:', searchText);
            log('DEBUG', 'Block search - textToSearch includes searchText:', textToSearch.includes(searchText));
            
            if (textToSearch.includes(searchText)) {
                const index = textToSearch.indexOf(searchText);
                const contextStart = Math.max(0, index - 200);
                const contextEnd = Math.min(normalizedText.length, index + searchText.length + 200);
                const context = normalizedText.substring(contextStart, contextEnd);
                
                // Выделяем замененный текст
                const regex = new RegExp(escapeRegExp(normalizedReplace), 'g');
                const result = context.replace(regex, '<span class="hl-json-diff-change-new">$&</span>');
                log('DEBUG', 'Block search - result length:', result.length);
                return result;
            }
            log('DEBUG', 'Block search - no match found, returning normalizedText');
            return normalizedText;
        } else {
            // Для обычного поиска показываем контекст с ±4 строками
            const lines = text.split('\n');
            const searchText = caseSensitive ? replaceTerm : replaceTerm.toLowerCase();
            let foundLines = [];
            
            log('DEBUG', 'Regular search - replaceTerm:', replaceTerm);
            log('DEBUG', 'Regular search - searchText:', searchText);
            log('DEBUG', 'Regular search - lines count:', lines.length);
            
            lines.forEach((line, lineIndex) => {
                const lineLower = caseSensitive ? line : line.toLowerCase();
                if (lineLower.includes(searchText)) {
                    log('DEBUG', 'Found match in line', lineIndex, ':', line);
                    // Добавляем ±4 строки контекста
                    const startLine = Math.max(0, lineIndex - 4);
                    const endLine = Math.min(lines.length - 1, lineIndex + 4);
                    
                    for (let i = startLine; i <= endLine; i++) {
                        if (!foundLines.includes(i)) {
                            foundLines.push(i);
                        }
                    }
                }
            });
            
            log('DEBUG', 'Regular search - foundLines:', foundLines);
            
            foundLines.sort((a, b) => a - b);
            
            // Группируем найденные строки по блокам и добавляем разделители
            let groupedLines = [];
            let currentGroup = [];
            let lastLineIndex = -1;
            
            foundLines.forEach(lineIndex => {
                if (lastLineIndex === -1 || lineIndex - lastLineIndex <= 8) {
                    currentGroup.push(lineIndex);
                } else {
                    if (currentGroup.length > 0) {
                        groupedLines.push(currentGroup);
                    }
                    currentGroup = [lineIndex];
                }
                lastLineIndex = lineIndex;
            });
            
            if (currentGroup.length > 0) {
                groupedLines.push(currentGroup);
            }
            
            log('DEBUG', 'Regular search - groupedLines:', groupedLines);
            
            // Формируем текст с разделителями и выделением замен
            const result = groupedLines.map((group, groupIndex) => {
                const groupText = group.map(lineIndex => {
                    const line = lines[lineIndex];
                    const isMatch = (caseSensitive ? line : line.toLowerCase()).includes(searchText);
                    const prefix = isMatch ? '→ ' : '  ';
                    
                    if (isMatch) {
                        // Выделяем замененный текст
                        const regex = useRegex ? 
                            new RegExp(replaceTerm, caseSensitive ? 'g' : 'gi') :
                            new RegExp(escapeRegExp(replaceTerm), caseSensitive ? 'g' : 'gi');
                        const highlightedLine = line.replace(regex, '<span class="hl-json-diff-change-new">$&</span>');
                        return prefix + highlightedLine;
                    }
                    return prefix + line;
                }).join('\n');
                
                return groupIndex > 0 ? '\n<hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;">\n' + groupText : groupText;
            }).join('');
            
            log('DEBUG', 'Regular search - result length:', result.length);
            return result;
        }
    }

    function hideDiffPreview() {
        document.getElementById('hl-diff-preview').style.display = 'none';
    }

    function hidePagination() {
        document.getElementById('hl-pagination').style.display = 'none';
    }

    function hideCurrentConfig() {
        document.getElementById('hl-current-config').style.display = 'none';
    }

    function enterDiffMode(caseSensitive, useRegex, blockSearch) {
        log('DEBUG', 'Входим в режим diff');
        log('DEBUG', 'Параметры:', { searchTerm, replaceTerm, caseSensitive, useRegex, blockSearch });
        
        isDiffMode = true;
        diffResults = [];
        diffPage = 0;
        
        // Собираем все конфиги с совпадениями для diff
        const jsonEditors = document.querySelectorAll('.for_jsoneditor');
        log('DEBUG', 'Найдено JSON редакторов:', jsonEditors.length);
        
        jsonEditors.forEach((textarea, index) => {
            try {
                const jsonText = textarea.value;
                if (!jsonText) {
                    log('DEBUG', `Пропускаем пустой редактор ${index + 1}`);
                    return;
                }

                const jsonData = JSON.parse(jsonText);
                const jsonString = JSON.stringify(jsonData, null, 2);

                let hasMatches = false;

                if (blockSearch) {
                    hasMatches = findBlockInText(jsonString, searchTerm, caseSensitive);
                } else if (useRegex) {
                    try {
                        const flags = caseSensitive ? 'g' : 'gi';
                        const regex = new RegExp(searchTerm, flags);
                        hasMatches = jsonString.match(regex) !== null;
                    } catch (e) {
                        hasMatches = false;
                    }
                } else {
                    const searchText = caseSensitive ? searchTerm : searchTerm.toLowerCase();
                    const jsonTextLower = caseSensitive ? jsonString : jsonString.toLowerCase();
                    hasMatches = jsonTextLower.includes(searchText);
                }

                if (hasMatches) {
                    const editorName = getEditorName(textarea);
                    log('DEBUG', `Найдены совпадения в редакторе: ${editorName}`);
                    diffResults.push({
                        editorName,
                        textarea,
                        jsonString,
                        caseSensitive,
                        useRegex,
                        blockSearch
                    });
                } else {
                    log('DEBUG', `Нет совпадений в редакторе ${index + 1}`);
                }
            } catch (e) {
                log('ERROR', `Ошибка парсинга JSON в редакторе ${index + 1}:`, e);
            }
        });

        log('DEBUG', `Итого найдено конфигов с совпадениями: ${diffResults.length}`);

        if (diffResults.length === 0) {
            alert('Ничего не найдено для замены');
            isDiffMode = false;
            return;
        }

        // Скрываем обычные элементы и показываем diff
        hidePagination();
        hideCurrentConfig();
        hideDiffPreview();
        
        // Показываем diff для первого конфига
        showDiffCurrentConfig();
        updateDiffPagination();
    }

    function updateDiffPagination() {
        const pagination = document.getElementById('hl-pagination');
        const prevBtn = document.getElementById('hl-prev-btn');
        const nextBtn = document.getElementById('hl-next-btn');
        const paginationInfo = document.getElementById('hl-pagination-info');

        if (diffResults.length <= 1) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = 'flex';
        prevBtn.disabled = diffPage === 0;
        nextBtn.disabled = diffPage === diffResults.length - 1;
        paginationInfo.textContent = `${diffPage + 1} из ${diffResults.length}`;
    }

    function showDiffCurrentConfig() {
        log('DEBUG', 'Начинаем показ diff');
        log('DEBUG', 'diffResults.length:', diffResults.length);
        log('DEBUG', 'diffPage:', diffPage);
        
        if (diffResults.length === 0) {
            log('DEBUG', 'Нет результатов для показа');
            return;
        }

        const currentResult = diffResults[diffPage];
        log('DEBUG', 'Текущий результат:', currentResult.editorName);
        
        const diffContainer = document.getElementById('hl-diff-preview');
        const diffConfigName = document.getElementById('hl-diff-config-name');
        const diffBefore = document.getElementById('hl-diff-before');
        const diffAfter = document.getElementById('hl-diff-after');
        
        log('DEBUG', 'Элементы найдены:', {
            diffContainer: !!diffContainer,
            diffBefore: !!diffBefore,
            diffAfter: !!diffAfter
        });

        // Получаем актуальные значения из полей ввода
        const currentSearchTerm = document.getElementById('hl-search-input').value.trim();
        const currentReplaceTerm = document.getElementById('hl-replace-input').value;
        const caseSensitive = document.getElementById('hl-case-sensitive').checked;
        const useRegex = document.getElementById('hl-use-regex').checked;
        const blockSearch = document.getElementById('hl-block-search').checked;

        // Показываем diff
        const beforeContext = getDiffContext(currentResult.jsonString, currentSearchTerm, caseSensitive, useRegex, blockSearch);
        
        // Создаем замененную версию
        let newJsonString = currentResult.jsonString;
        if (blockSearch) {
            if (findBlockInText(currentResult.jsonString, currentSearchTerm, caseSensitive)) {
                const normalizedText = normalizeTextForBlockSearch(currentResult.jsonString);
                const normalizedSearch = normalizeTextForBlockSearch(currentSearchTerm);
                const normalizedReplace = normalizeTextForBlockSearch(currentReplaceTerm);
                
                const searchText = caseSensitive ? normalizedSearch : normalizedSearch.toLowerCase();
                
                const regex = new RegExp(escapeRegExp(searchText), caseSensitive ? 'g' : 'gi');
                const newNormalizedText = normalizedText.replace(regex, normalizedReplace);
                newJsonString = restoreFormatting(currentResult.jsonString, newNormalizedText);
            }
        } else if (useRegex) {
            try {
                const flags = caseSensitive ? 'g' : 'gi';
                const regex = new RegExp(currentSearchTerm, flags);
                newJsonString = currentResult.jsonString.replace(regex, currentReplaceTerm);
            } catch (e) {
                newJsonString = currentResult.jsonString;
            }
        } else {
            const regex = new RegExp(escapeRegExp(currentSearchTerm), caseSensitive ? 'g' : 'gi');
            newJsonString = currentResult.jsonString.replace(regex, currentReplaceTerm);
        }

        const afterContext = getDiffContextWithReplace(newJsonString, currentSearchTerm, currentReplaceTerm, caseSensitive, useRegex, blockSearch);

        log('DEBUG', 'beforeContext length:', beforeContext.length);
        log('DEBUG', 'afterContext length:', afterContext.length);
        log('DEBUG', 'newJsonString length:', newJsonString.length);
        log('DEBUG', 'currentSearchTerm:', currentSearchTerm);
        log('DEBUG', 'currentReplaceTerm:', currentReplaceTerm);

        // Показываем название конфига
        diffConfigName.textContent = currentResult.editorName;
        
        diffBefore.innerHTML = beforeContext;
        diffAfter.innerHTML = afterContext;
        diffContainer.style.display = 'block';
        
        log('DEBUG', 'Diff контейнер показан');

        // Показываем кнопку подтверждения замены
        log('DEBUG', 'Вызываем showConfirmReplaceButton');
        showConfirmReplaceButton();
        
        // Обновляем search results для текущего конфига
        updateSearchResultsForDiff();
        
        // Добавляем обработчик для кнопки замены в текущем конфиге
        const replaceDiffBtn = document.getElementById('hl-replace-diff-btn');
        if (replaceDiffBtn) {
            replaceDiffBtn.onclick = () => {
                replaceInCurrentConfig();
            };
        }
    }

    function updateSearchResultsForDiff() {
        if (!isDiffMode || diffResults.length === 0) return;
        
        const currentResult = diffResults[diffPage];
        const resultsContainer = document.getElementById('hl-search-results');
        
        // Получаем актуальные значения из полей ввода
        const currentSearchTerm = document.getElementById('hl-search-input').value.trim();
        const caseSensitive = document.getElementById('hl-case-sensitive').checked;
        const useRegex = document.getElementById('hl-use-regex').checked;
        const blockSearch = document.getElementById('hl-block-search').checked;
        
        if (!currentSearchTerm) {
            resultsContainer.innerHTML = '<p style="color: #6c757d; text-align: center; margin: 20px 0;">Введите текст для поиска по всем JSON редакторам</p>';
            return;
        }
        
        // Показываем контекст для текущего конфига
        const context = getDiffContext(currentResult.jsonString, currentSearchTerm, caseSensitive, useRegex, blockSearch);
        
        resultsContainer.innerHTML = `
            <h3 style="color:#222">Контекст поиска в "${currentResult.editorName}":</h3>
            <div class="hl-json-search-context">${context}</div>
        `;
    }

    function replaceInCurrentConfig() {
        if (diffResults.length === 0) return;
        
        const currentResult = diffResults[diffPage];
        const currentSearchTerm = document.getElementById('hl-search-input').value.trim();
        const currentReplaceTerm = document.getElementById('hl-replace-input').value;
        const caseSensitive = document.getElementById('hl-case-sensitive').checked;
        const useRegex = document.getElementById('hl-use-regex').checked;
        const blockSearch = document.getElementById('hl-block-search').checked;
        
        log('DEBUG', `Замена в конкретном конфиге: ${currentResult.editorName} (diffPage: ${diffPage})`);
        log('DEBUG', `Всего конфигов в diffResults: ${diffResults.length}`);
        
        if (!currentSearchTerm || !currentReplaceTerm) {
            alert('Введите текст для поиска и замены');
            return;
        }
        
        try {
            // Получаем актуальное содержимое textarea
            const currentText = currentResult.textarea.value;
            if (!currentText) {
                alert('Конфиг пуст');
                return;
            }

            log('DEBUG', `Актуальный текст из textarea (${currentResult.textarea.id}): ${currentText.substring(0, 100)}...`);

            // Парсим JSON для работы с ним
            const jsonData = JSON.parse(currentText);
            const jsonString = JSON.stringify(jsonData, null, 2);

            let newJsonString = jsonString;
            let replacementsInThisConfig = 0;

            if (blockSearch) {
                if (findBlockInText(jsonString, currentSearchTerm, caseSensitive)) {
                    const normalizedText = normalizeTextForBlockSearch(jsonString);
                    const normalizedSearch = normalizeTextForBlockSearch(currentSearchTerm);
                    const normalizedReplace = normalizeTextForBlockSearch(currentReplaceTerm);
                    
                    const searchText = caseSensitive ? normalizedSearch : normalizedSearch.toLowerCase();
                    
                    const regex = new RegExp(escapeRegExp(searchText), caseSensitive ? 'g' : 'gi');
                    const newNormalizedText = normalizedText.replace(regex, normalizedReplace);
                    newJsonString = restoreFormatting(jsonString, newNormalizedText);
                    
                    // Подсчитываем замены для блочного поиска
                    const matches = normalizedText.match(regex);
                    if (matches) {
                        replacementsInThisConfig = matches.length;
                    }
                }
            } else if (useRegex) {
                try {
                    const flags = caseSensitive ? 'g' : 'gi';
                    const regex = new RegExp(currentSearchTerm, flags);
                    const matches = jsonString.match(regex);
                    if (matches) {
                        replacementsInThisConfig = matches.length;
                    }
                    newJsonString = jsonString.replace(regex, currentReplaceTerm);
                } catch (e) {
                    log('ERROR', 'Ошибка в регулярном выражении:', e);
                    alert('Ошибка в регулярном выражении');
                    return;
                }
            } else {
                const regex = new RegExp(escapeRegExp(currentSearchTerm), caseSensitive ? 'g' : 'gi');
                const matches = jsonString.match(regex);
                if (matches) {
                    replacementsInThisConfig = matches.length;
                }
                newJsonString = jsonString.replace(regex, currentReplaceTerm);
            }

            // Проверяем валидность JSON после замены
            try {
                JSON.parse(newJsonString);
                log('DEBUG', 'JSON валиден после замены');
                
                // Обновляем textarea только если JSON валиден
                currentResult.textarea.value = newJsonString;

                // Обновляем JSONEditor через window.jsonEditors
                const editorDivId = currentResult.textarea.id + '_jsoneditor';
                if (window.jsonEditors && window.jsonEditors[editorDivId]) {
                    try {
                        const newJsonData = JSON.parse(newJsonString);
                        window.jsonEditors[editorDivId].set(newJsonData);
                        log('DEBUG', 'JSON редактор успешно обновлен');
                        } catch (e) {
                            log('ERROR', 'Ошибка обновления JSON редактора:', e);
                        }
                }

                // Также попробуем обновить через события
                currentResult.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                currentResult.textarea.dispatchEvent(new Event('change', { bubbles: true }));

                log('SUCCESS', `Заменено ${replacementsInThisConfig} вхождений в конфиге "${currentResult.editorName}"`);
                showSuccessToast(`Заменено ${replacementsInThisConfig} вхождений в конфиге "${currentResult.editorName}"`);
                
            } catch (e) {
                log('ERROR', `JSON стал невалидным после замены в конфиге "${currentResult.editorName}":`, e);
                showErrorToast(`Ошибка: замена нарушила синтаксис JSON в конфиге "${currentResult.editorName}". Проверьте правильность замены.`);
                return;
            }
            
            // Обновляем jsonString в diffResults для корректного отображения diff
            currentResult.jsonString = newJsonString;
            
            // Обновляем search results
            updateSearchResultsForDiff();
            
        } catch (e) {
            log('ERROR', 'Error processing JSON:', e);
            alert('Ошибка при замене: ' + e.message);
        }
    }

    function showConfirmReplaceButton() {
        log('DEBUG', 'Начинаем создание кнопки подтверждения');
        
        // Удаляем существующую кнопку если есть
        const existingBtn = document.getElementById('hl-confirm-replace-btn');
        if (existingBtn) {
            log('DEBUG', 'Удаляем существующую кнопку');
            existingBtn.remove();
        }

        // Создаем кнопку подтверждения
        const confirmBtn = document.createElement('button');
        confirmBtn.id = 'hl-confirm-replace-btn';
        confirmBtn.className = 'hl-json-confirm-replace-btn';
        confirmBtn.textContent = 'Заменить все';
        confirmBtn.addEventListener('click', () => {
            log('DEBUG', 'Кнопка нажата, вызываем showReplaceConfirmModal');
            showReplaceConfirmModal();
        });

        document.body.appendChild(confirmBtn);
        log('DEBUG', 'Кнопка добавлена в DOM');
    }

    function showReplaceConfirmModal() {
        // Удаляем существующее модальное окно если есть
        const existingModal = document.getElementById('hl-replace-confirm-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Получаем актуальные значения из полей ввода
        const currentSearchTerm = document.getElementById('hl-search-input').value.trim();
        const currentReplaceTerm = document.getElementById('hl-replace-input').value;
        const caseSensitive = document.getElementById('hl-case-sensitive').checked;
        const useRegex = document.getElementById('hl-use-regex').checked;
        const blockSearch = document.getElementById('hl-block-search').checked;

        // Подсчитываем общее количество замен
        let totalReplacements = 0;
        diffResults.forEach(result => {
            try {
                if (blockSearch) {
                    if (findBlockInText(result.jsonString, currentSearchTerm, caseSensitive)) {
                        const normalizedText = normalizeTextForBlockSearch(result.jsonString);
                        const normalizedSearch = normalizeTextForBlockSearch(currentSearchTerm);
                        const searchText = caseSensitive ? normalizedSearch : normalizedSearch.toLowerCase();
                        const textToSearch = caseSensitive ? normalizedText : normalizedText.toLowerCase();
                        
                        let count = 0;
                        let index = textToSearch.indexOf(searchText);
                        while (index !== -1) {
                            count++;
                            index = textToSearch.indexOf(searchText, index + 1);
                        }
                        totalReplacements += count;
                    }
                } else if (useRegex) {
                    try {
                        const flags = caseSensitive ? 'g' : 'gi';
                        const regex = new RegExp(currentSearchTerm, flags);
                        const matches = result.jsonString.match(regex);
                        if (matches) {
                            totalReplacements += matches.length;
                        }
                    } catch (e) {
                        // Игнорируем ошибки regex
                    }
                } else {
                    const searchText = caseSensitive ? currentSearchTerm : currentSearchTerm.toLowerCase();
                    const jsonTextLower = caseSensitive ? result.jsonString : result.jsonString.toLowerCase();

                    if (jsonTextLower.includes(searchText)) {
                        const regex = new RegExp(escapeRegExp(searchText), caseSensitive ? 'g' : 'gi');
                        const matches = result.jsonString.match(regex);
                        if (matches) {
                            totalReplacements += matches.length;
                        }
                    }
                }
            } catch (e) {
                // Игнорируем ошибки парсинга JSON
            }
        });

        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.id = 'hl-replace-confirm-modal';
        modal.className = 'hl-json-replace-confirm-modal';

        modal.innerHTML = `
            <div class="hl-json-replace-confirm-content">
                <div class="hl-json-replace-confirm-title">⚠️ Подтверждение замены</div>
                <div class="hl-json-replace-confirm-text">
                    Вы собираетесь заменить <strong>"${currentSearchTerm}"</strong> на <strong>"${currentReplaceTerm}"</strong> во всех JSON редакторах.
                </div>
                <div class="hl-json-replace-confirm-details">
                    <strong>Будет заменено:</strong> ${totalReplacements} вхождений в ${diffResults.length} редакторах<br>
                    <strong>Режим поиска:</strong> ${caseSensitive ? 'С учетом регистра' : 'Без учета регистра'} | 
                    ${useRegex ? 'Регулярные выражения' : 'Обычный поиск'} | 
                    ${blockSearch ? 'Блочный поиск' : 'Построчный поиск'}
                </div>
                <div class="hl-json-replace-confirm-buttons">
                    <button class="hl-json-replace-confirm-btn hl-json-replace-confirm-yes">Да, заменить все</button>
                    <button class="hl-json-replace-confirm-btn hl-json-replace-confirm-no">Отмена</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики событий
        modal.querySelector('.hl-json-replace-confirm-yes').addEventListener('click', () => {
            modal.remove();
            executeReplaceFromDiff();
        });

        modal.querySelector('.hl-json-replace-confirm-no').addEventListener('click', () => {
            modal.remove();
        });

        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    function showSearchContext(result) {
        const resultsContainer = document.getElementById('hl-search-results');
        
        if (!searchTerm) {
            resultsContainer.innerHTML = '<p style="color: #6c757d; text-align: center; margin: 20px 0;">Введите текст для поиска</p>';
            return;
        }

        const caseSensitive = document.getElementById('hl-case-sensitive').checked;
        const useRegex = document.getElementById('hl-use-regex').checked;
        const blockSearch = document.getElementById('hl-block-search').checked;

        let contextText = '';
        let matches = 0;

        if (blockSearch) {
            // Для блочного поиска показываем нормализованный текст
            const normalizedText = normalizeTextForBlockSearch(result.jsonString);
            const normalizedSearch = normalizeTextForBlockSearch(searchTerm);
            const searchText = caseSensitive ? normalizedSearch : normalizedSearch.toLowerCase();
            const textToSearch = caseSensitive ? normalizedText : normalizedText.toLowerCase();
            
            if (textToSearch.includes(searchText)) {
                const index = textToSearch.indexOf(searchText);
                const contextStart = Math.max(0, index - 200);
                const contextEnd = Math.min(normalizedText.length, index + searchText.length + 200);
                contextText = normalizedText.substring(contextStart, contextEnd);
                
                // Подсчитываем количество вхождений
                let count = 0;
                let searchIndex = textToSearch.indexOf(searchText);
                while (searchIndex !== -1) {
                    count++;
                    searchIndex = textToSearch.indexOf(searchText, searchIndex + 1);
                }
                matches = count;
            }
        } else {
            // Для обычного поиска показываем контекст с подсветкой
            const lines = result.jsonString.split('\n');
            const searchText = caseSensitive ? searchTerm : searchTerm.toLowerCase();
            let foundLines = [];
            
            lines.forEach((line, lineIndex) => {
                const lineLower = caseSensitive ? line : line.toLowerCase();
                if (lineLower.includes(searchText)) {
                    // Добавляем ±4 строки контекста
                    const startLine = Math.max(0, lineIndex - 4);
                    const endLine = Math.min(lines.length - 1, lineIndex + 4);
                    
                    for (let i = startLine; i <= endLine; i++) {
                        if (!foundLines.includes(i)) {
                            foundLines.push(i);
                        }
                    }
                }
            });
            
            foundLines.sort((a, b) => a - b);
            
            // Группируем найденные строки по блокам и добавляем разделители
            let groupedLines = [];
            let currentGroup = [];
            let lastLineIndex = -1;
            
            foundLines.forEach(lineIndex => {
                if (lastLineIndex === -1 || lineIndex - lastLineIndex <= 8) { // Если строки близко друг к другу
                    currentGroup.push(lineIndex);
                } else {
                    // Добавляем текущую группу и начинаем новую
                    if (currentGroup.length > 0) {
                        groupedLines.push(currentGroup);
                    }
                    currentGroup = [lineIndex];
                }
                lastLineIndex = lineIndex;
            });
            
            if (currentGroup.length > 0) {
                groupedLines.push(currentGroup);
            }
            
            // Формируем текст с разделителями
            contextText = groupedLines.map((group, groupIndex) => {
                const groupText = group.map(lineIndex => {
                    const line = lines[lineIndex];
                    const isMatch = (caseSensitive ? line : line.toLowerCase()).includes(searchText);
                    const prefix = isMatch ? '→ ' : '  ';
                    return prefix + line;
                }).join('\n');
                
                return groupIndex > 0 ? '\n<hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;">\n' + groupText : groupText;
            }).join('');
            
            // Подсчитываем количество вхождений
            if (useRegex) {
                try {
                    const flags = caseSensitive ? 'g' : 'gi';
                    const regex = new RegExp(searchTerm, flags);
                    const regexMatches = result.jsonString.match(regex);
                    matches = regexMatches ? regexMatches.length : 0;
                } catch (e) {
                    matches = 0;
                }
            } else {
                const regex = new RegExp(escapeRegExp(searchText), caseSensitive ? 'g' : 'gi');
                const allMatches = result.jsonString.match(regex);
                matches = allMatches ? allMatches.length : 0;
            }
        }

        if (contextText) {
            const highlightedText = highlightSearchTerm(contextText, searchTerm);
            resultsContainer.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #333; margin: 0 0 10px 0;">Контекст поиска (${matches} совпадений):</h4>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #ddd; max-height: 400px; overflow-y: auto;">
                        <div class="hl-json-search-context">${highlightedText}</div>
                    </div>
                </div>
            `;
        } else {
            resultsContainer.innerHTML = '<p style="color: #dc3545; text-align: center;">Контекст не найден</p>';
        }
    }

    function showReplacePreview(searchTerm, replaceTerm, caseSensitive, useRegex, blockSearch) {
        // Эта функция больше не используется
        // Предварительный просмотр теперь показывается через showDiffPreview
    }

    function displayReplacePreview(results, searchTerm, replaceTerm) {
        const resultsContainer = document.getElementById('hl-search-results');

        if (results.length === 0) {
            resultsContainer.innerHTML = '<p style="color: #dc3545; text-align: center;">Ничего не найдено для замены</p>';
            return;
        }

        let html = `
            <h3 style="color:#222">Предварительный просмотр замены (${results.length} редакторов):</h3>
            <div class="hl-json-replace-summary">
                <strong>Будет заменено:</strong> "${searchTerm}" → "${replaceTerm}"
            </div>
        `;

        results.forEach((result, index) => {
            html += `
                <div class="hl-json-result-item">
                    <div class="hl-json-result-header">
                        <h4 class="hl-json-result-title">${result.editorName}</h4>
                        <span class="hl-json-result-count">${result.matches} замен</span>
                    </div>
                    <div class="hl-json-result-actions">
                        <button onclick="hlScrollToEditor('${result.textarea.id}')" class="hl-json-goto-btn">
                            Перейти к редактору
                        </button>
                        <button onclick="hlExecuteSingleReplace('${result.textarea.id}', '${searchTerm}', '${replaceTerm}', ${document.getElementById('hl-case-sensitive').checked}, ${document.getElementById('hl-use-regex').checked})" class="hl-json-replace-all-btn">
                            Заменить в этом редакторе
                        </button>
                    </div>
                    <div style="margin-top: 10px;">
                        <h5>Изменения:</h5>
                        <div class="hl-json-preview">
                            ${highlightReplacePreview(result.originalJsonString, result.newJsonString, searchTerm, replaceTerm)}
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
            <div style="text-align: center; margin-top: 20px;">
                <button id="hl-replace-all-btn" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px;">
                    Заменить во всех редакторах
                </button>
            </div>
        `;
        resultsContainer.innerHTML = html;
        // Назначаем обработчик после вставки
        const btn = document.getElementById('hl-replace-all-btn');
        if (btn) {
            btn.onclick = function() {
                hlShowConfirmReplace(searchTerm, replaceTerm, document.getElementById('hl-case-sensitive').checked, document.getElementById('hl-use-regex').checked);
            };
        }
    }

    function executeReplace(searchTerm, replaceTerm, caseSensitive, useRegex, blockSearch) {
        const jsonEditors = document.querySelectorAll('.for_jsoneditor');
        let totalReplacements = 0;

        jsonEditors.forEach((textarea) => {
            try {
                const jsonText = textarea.value;
                if (!jsonText) return;

                const jsonData = JSON.parse(jsonText);
                const jsonString = JSON.stringify(jsonData, null, 2);

                let newJsonString = jsonString;
                let matches = [];

                if (blockSearch) {
                    // Замена блоков
                    if (findBlockInText(jsonString, searchTerm, caseSensitive)) {
                        const normalizedText = normalizeTextForBlockSearch(jsonString);
                        const normalizedSearch = normalizeTextForBlockSearch(searchTerm);
                        const normalizedReplace = normalizeTextForBlockSearch(replaceTerm);
                        
                        const searchText = caseSensitive ? normalizedSearch : normalizedSearch.toLowerCase();
                        const textToSearch = caseSensitive ? normalizedText : normalizedText.toLowerCase();
                        
                        // Подсчитываем количество вхождений
                        let count = 0;
                        let index = textToSearch.indexOf(searchText);
                        while (index !== -1) {
                            count++;
                            index = textToSearch.indexOf(searchText, index + 1);
                        }
                        matches = new Array(count).fill(searchTerm);
                        
                        // Выполняем замену в нормализованном тексте
                        const regex = new RegExp(escapeRegExp(searchText), caseSensitive ? 'g' : 'gi');
                        const newNormalizedText = normalizedText.replace(regex, normalizedReplace);
                        
                        // Восстанавливаем форматирование
                        newJsonString = restoreFormatting(jsonString, newNormalizedText);
                    }
                } else if (useRegex) {
                    try {
                        const flags = caseSensitive ? 'g' : 'gi';
                        const regex = new RegExp(searchTerm, flags);
                        matches = jsonString.match(regex) || [];
                        newJsonString = jsonString.replace(regex, replaceTerm);
                    } catch (e) {
                        return;
                    }
                } else {
                    const searchText = caseSensitive ? searchTerm : searchTerm.toLowerCase();
                    const jsonTextLower = caseSensitive ? jsonString : jsonString.toLowerCase();

                    if (jsonTextLower.includes(searchText)) {
                        const regex = new RegExp(escapeRegExp(searchText), caseSensitive ? 'g' : 'gi');
                        matches = jsonString.match(regex) || [];
                        newJsonString = jsonString.replace(regex, replaceTerm);
                    }
                }

                if (matches.length > 0) {
                    // Обновляем textarea
                    textarea.value = newJsonString;

                    // Новый способ: обновляем JSONEditor через window.jsonEditors
                    const editorDivId = textarea.id + '_jsoneditor';
                    if (window.jsonEditors && window.jsonEditors[editorDivId]) {
                        try {
                            const newJsonData = JSON.parse(newJsonString);
                            window.jsonEditors[editorDivId].set(newJsonData);
                    } catch (e) {
                        log('ERROR', 'Ошибка обновления JSON редактора:', e);
                    }
                    }

                    totalReplacements += matches.length;
                }
            } catch (e) {
                console.error('Error processing JSON:', e);
            }
        });

        showSuccessToast(`Заменено ${totalReplacements} вхождений в ${jsonEditors.length} редакторах`);

        // Обновляем результаты поиска
        performSearch();
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

    function displayResults(results, searchTerm) {
        // Эта функция больше не используется в новой системе пагинации
        // Оставляем для совместимости
        const resultsContainer = document.getElementById('hl-search-results');
        resultsContainer.innerHTML = '<p style="color: #6c757d; text-align: center; margin: 20px 0;">Используйте пагинацию для просмотра результатов</p>';
    }

    function highlightSearchTerm(text, searchTerm) {
        if (!searchTerm) return text;

        const caseSensitive = document.getElementById('hl-case-sensitive').checked;
        const useRegex = document.getElementById('hl-use-regex').checked;

        let regex;
        if (useRegex) {
            try {
                const flags = caseSensitive ? 'g' : 'gi';
                regex = new RegExp(searchTerm, flags);
            } catch (e) {
                return text;
            }
        } else {
            regex = new RegExp(escapeRegExp(searchTerm), caseSensitive ? 'g' : 'gi');
        }

        return text.replace(regex, '<span class="hl-json-highlight">$&</span>');
    }

    function highlightBlockSearchTerm(text, searchTerm) {
        if (!searchTerm) return text;

        const caseSensitive = document.getElementById('hl-case-sensitive').checked;
        const normalizedText = normalizeTextForBlockSearch(text);
        const normalizedSearch = normalizeTextForBlockSearch(searchTerm);
        
        const searchText = caseSensitive ? normalizedSearch : normalizedSearch.toLowerCase();
        const textToSearch = caseSensitive ? normalizedText : normalizedText.toLowerCase();
        
        if (!textToSearch.includes(searchText)) return text;
        
        // Для блочного поиска показываем контекст вокруг найденного блока
        const index = textToSearch.indexOf(searchText);
        const contextStart = Math.max(0, index - 100);
        const contextEnd = Math.min(normalizedText.length, index + searchText.length + 100);
        
        const context = normalizedText.substring(contextStart, contextEnd);
        const highlightedContext = context.replace(
            new RegExp(escapeRegExp(searchText), caseSensitive ? 'g' : 'gi'),
            '<span class="hl-json-highlight">$&</span>'
        );
        
        return `<div style="color: #666; font-size: 12px; margin-bottom: 5px;">Контекст блока:</div>${highlightedContext}`;
    }

    function highlightReplacePreview(originalText, newText, searchTerm, replaceTerm) {
        const caseSensitive = document.getElementById('hl-case-sensitive').checked;
        const useRegex = document.getElementById('hl-use-regex').checked;

        let regex;
        if (useRegex) {
            try {
                const flags = caseSensitive ? 'g' : 'gi';
                regex = new RegExp(searchTerm, flags);
            } catch (e) {
                return `<div style="color: red;">Ошибка в регулярном выражении</div>`;
            }
        } else {
            regex = new RegExp(escapeRegExp(searchTerm), caseSensitive ? 'g' : 'gi');
        }

        const highlightedOriginal = originalText.replace(regex, '<span class="hl-json-highlight">$&</span>');
        const highlightedNew = newText.replace(regex, '<span class="hl-json-replace-highlight">$&</span>');

        return `
            <div style="margin-bottom: 10px;">
                <strong>Было:</strong>
                <div style="background: #ffe6e6; padding: 5px; border-radius: 3px; margin-top: 5px;">
                    ${highlightedOriginal}
                </div>
            </div>
            <div>
                <strong>Будет:</strong>
                <div style="background: #e6ffe6; padding: 5px; border-radius: 3px; margin-top: 5px;">
                    ${highlightedNew}
                </div>
            </div>
        `;
    }

    function executeReplaceFromDiff() {
        log('DEBUG', 'Начинаем замену из diff режима');
        
        // Получаем актуальные значения из полей ввода
        const currentSearchTerm = document.getElementById('hl-search-input').value.trim();
        const currentReplaceTerm = document.getElementById('hl-replace-input').value;
        const caseSensitive = document.getElementById('hl-case-sensitive').checked;
        const useRegex = document.getElementById('hl-use-regex').checked;
        const blockSearch = document.getElementById('hl-block-search').checked;
        
        log('DEBUG', 'Параметры замены:', { 
            currentSearchTerm, 
            currentReplaceTerm, 
            caseSensitive, 
            useRegex, 
            blockSearch 
        });
        
        if (!currentSearchTerm) {
            alert('Введите текст для поиска');
            return;
        }
        
        if (!currentReplaceTerm) {
            alert('Введите текст для замены');
            return;
        }
        
        let totalReplacements = 0;
        let invalidConfigs = [];

        diffResults.forEach((result, index) => {
            try {
                log('DEBUG', `Обрабатываем конфиг ${index + 1}: ${result.editorName} (textarea.id: ${result.textarea.id})`);
                
                // Получаем актуальное содержимое textarea
                const currentText = result.textarea.value;
                if (!currentText) {
                    log('DEBUG', `Пропускаем пустой конфиг: ${result.editorName}`);
                    return;
                }

                // Парсим JSON для работы с ним
                const jsonData = JSON.parse(currentText);
                const jsonString = JSON.stringify(jsonData, null, 2);

                let newJsonString = jsonString;
                let replacementsInThisConfig = 0;

                if (blockSearch) {
                    if (findBlockInText(jsonString, currentSearchTerm, caseSensitive)) {
                        const normalizedText = normalizeTextForBlockSearch(jsonString);
                        const normalizedSearch = normalizeTextForBlockSearch(currentSearchTerm);
                        const normalizedReplace = normalizeTextForBlockSearch(currentReplaceTerm);
                        
                        const searchText = caseSensitive ? normalizedSearch : normalizedSearch.toLowerCase();
                        
                        const regex = new RegExp(escapeRegExp(searchText), caseSensitive ? 'g' : 'gi');
                        const newNormalizedText = normalizedText.replace(regex, normalizedReplace);
                        newJsonString = restoreFormatting(jsonString, newNormalizedText);
                        
                        // Подсчитываем замены для блочного поиска
                        const matches = normalizedText.match(regex);
                        if (matches) {
                            replacementsInThisConfig = matches.length;
                        }
                    }
                } else if (useRegex) {
                    try {
                        const flags = caseSensitive ? 'g' : 'gi';
                        const regex = new RegExp(currentSearchTerm, flags);
                        const matches = jsonString.match(regex);
                        if (matches) {
                            replacementsInThisConfig = matches.length;
                        }
                        newJsonString = jsonString.replace(regex, currentReplaceTerm);
                    } catch (e) {
                        console.error('Ошибка в регулярном выражении:', e);
                        newJsonString = jsonString;
                    }
                } else {
                    const regex = new RegExp(escapeRegExp(currentSearchTerm), caseSensitive ? 'g' : 'gi');
                    const matches = jsonString.match(regex);
                    if (matches) {
                        replacementsInThisConfig = matches.length;
                    }
                    newJsonString = jsonString.replace(regex, currentReplaceTerm);
                }

                log('DEBUG', `Найдено замен в конфиге ${result.editorName}: ${replacementsInThisConfig}`);
                
                // Проверяем валидность JSON после замены
                try {
                    JSON.parse(newJsonString);
                    log('DEBUG', `JSON валиден после замены в конфиге ${result.editorName}`);
                    
                    totalReplacements += replacementsInThisConfig;
                    
                    // Обновляем textarea только если JSON валиден
                    result.textarea.value = newJsonString;
                    log('DEBUG', `Обновлен textarea для ${result.editorName}`);

                    // Обновляем JSONEditor через window.jsonEditors
                    const editorDivId = result.textarea.id + '_jsoneditor';
                    if (window.jsonEditors && window.jsonEditors[editorDivId]) {
                        try {
                            const newJsonData = JSON.parse(newJsonString);
                            window.jsonEditors[editorDivId].set(newJsonData);
                            log('DEBUG', `Обновлен JSONEditor для ${result.editorName}`);
                        } catch (e) {
                            log('ERROR', 'Ошибка обновления JSON редактора:', e);
                        }
                    } else {
                        log('DEBUG', `JSONEditor не найден для ${result.editorName}, ID: ${editorDivId}`);
                    }
                    
                    // Также попробуем обновить через события
                    result.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    result.textarea.dispatchEvent(new Event('change', { bubbles: true }));
                    
                } catch (e) {
                    log('ERROR', `JSON стал невалидным после замены в конфиге "${result.editorName}":`, e);
                    invalidConfigs.push(result.editorName);
                }

            } catch (e) {
                log('ERROR', `Error processing JSON for ${result.editorName}:`, e);
            }
        });

        // Показываем результаты с учетом ошибок валидации
        if (invalidConfigs.length > 0) {
            const errorMessage = `Ошибка: замена нарушила синтаксис JSON в ${invalidConfigs.length} конфигах: ${invalidConfigs.join(', ')}. Проверьте правильность замены.`;
            log('ERROR', errorMessage);
            showErrorToast(errorMessage);
        }
        
        if (totalReplacements > 0) {
            const successMessage = `Успешно заменено ${totalReplacements} вхождений в ${diffResults.length - invalidConfigs.length} конфигах`;
            log('SUCCESS', successMessage);
            showSuccessToast(successMessage);
        } else if (invalidConfigs.length === 0) {
            log('INFO', 'Замены не найдены');
            showSuccessToast('Замены не найдены');
        }

        // Выходим из режима diff
        exitDiffMode();
    }

    function exitDiffMode() {
        isDiffMode = false;
        diffResults = [];
        diffPage = 0;
        
        // Удаляем кнопку подтверждения
        const confirmBtn = document.getElementById('hl-confirm-replace-btn');
        if (confirmBtn) {
            confirmBtn.remove();
        }
        
        // Скрываем diff
        hideDiffPreview();
        
        // Возвращаемся к обычному режиму поиска
        performSearch();
    }

    function clearSearch() {
        const searchInput = document.getElementById('hl-search-input');
        const replaceInput = document.getElementById('hl-replace-input');
        
        searchInput.value = '';
        replaceInput.value = '';
        
        // Сбрасываем высоту textarea
        autoResizeTextarea(searchInput);
        autoResizeTextarea(replaceInput);
        
        document.getElementById('hl-search-results').innerHTML = '<p style="color: #6c757d; text-align: center; margin: 20px 0;">Введите текст для поиска по всем JSON редакторам</p>';
        
        // Сбрасываем глобальные переменные
        currentResults = [];
        currentPage = 0;
        searchTerm = '';
        replaceTerm = '';
        isDiffMode = false;
        diffResults = [];
        diffPage = 0;
        
        // Удаляем кнопку подтверждения
        const confirmBtn = document.getElementById('hl-confirm-replace-btn');
        if (confirmBtn) {
            confirmBtn.remove();
        }
        
        // Скрываем debug чекбокс
        const debugToggle = document.getElementById('hl-debug-toggle');
        if (debugToggle) {
            debugToggle.classList.remove('show');
        }
        
        // Скрываем дополнительные элементы
        hidePagination();
        hideDiffPreview();
        hideCurrentConfig();
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Нормализация текста для поиска блоков
    function normalizeTextForBlockSearch(text) {
        return text
            .replace(/\s+/g, ' ')  // заменяем все пробелы, табы, переносы на один пробел
            .trim();               // убираем пробелы в начале и конце
    }

    // Поиск блока в тексте
    function findBlockInText(text, searchBlock, caseSensitive = false) {
        const normalizedText = normalizeTextForBlockSearch(text);
        const normalizedSearch = normalizeTextForBlockSearch(searchBlock);
        
        const searchText = caseSensitive ? normalizedSearch : normalizedSearch.toLowerCase();
        const textToSearch = caseSensitive ? normalizedText : normalizedText.toLowerCase();
        
        return textToSearch.includes(searchText);
    }

    // Восстановление форматирования после замены блоков
    function restoreFormatting(originalText, newNormalizedText) {
        // Упрощенная версия - просто возвращаем новый текст с базовым форматированием
        try {
            const parsed = JSON.parse(newNormalizedText);
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            // Если не удается распарсить, возвращаем как есть
            return newNormalizedText;
        }
    }

    // Добавляем функции в глобальную область
    window.hlScrollToEditor = function(textareaId) {
        const textarea = document.getElementById(textareaId);
        if (textarea) {
            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            textarea.style.border = '2px solid #007cba';
            setTimeout(() => {
                textarea.style.border = '';
            }, 3000);
        }
    };

    window.hlExecuteSingleReplace = function(textareaId, searchTerm, replaceTerm, caseSensitive, useRegex) {
        const textarea = document.getElementById(textareaId);
        if (!textarea) return;

        try {
            const jsonText = textarea.value;
            if (!jsonText) return;

            const jsonData = JSON.parse(jsonText);
            const jsonString = JSON.stringify(jsonData, null, 2);
            const blockSearch = document.getElementById('hl-block-search').checked;

            let newJsonString = jsonString;

            if (blockSearch) {
                // Замена блоков
                if (findBlockInText(jsonString, searchTerm, caseSensitive)) {
                    const normalizedText = normalizeTextForBlockSearch(jsonString);
                    const normalizedSearch = normalizeTextForBlockSearch(searchTerm);
                    const normalizedReplace = normalizeTextForBlockSearch(replaceTerm);
                    
                    const searchText = caseSensitive ? normalizedSearch : normalizedSearch.toLowerCase();
                    
                    // Выполняем замену в нормализованном тексте
                    const regex = new RegExp(escapeRegExp(searchText), caseSensitive ? 'g' : 'gi');
                    const newNormalizedText = normalizedText.replace(regex, normalizedReplace);
                    
                    // Восстанавливаем форматирование
                    newJsonString = restoreFormatting(jsonString, newNormalizedText);
                }
            } else if (useRegex) {
                try {
                    const flags = caseSensitive ? 'g' : 'gi';
                    const regex = new RegExp(searchTerm, flags);
                    newJsonString = jsonString.replace(regex, replaceTerm);
                } catch (e) {
                    alert('Ошибка в регулярном выражении');
                    return;
                }
            } else {
                const regex = new RegExp(escapeRegExp(searchTerm), caseSensitive ? 'g' : 'gi');
                newJsonString = jsonString.replace(regex, replaceTerm);
            }

            // Обновляем textarea
            textarea.value = newJsonString;

            // Новый способ: обновляем JSONEditor через window.jsonEditors
            const editorDivId = textarea.id + '_jsoneditor';
            if (window.jsonEditors && window.jsonEditors[editorDivId]) {
                try {
                    const newJsonData = JSON.parse(newJsonString);
                    window.jsonEditors[editorDivId].set(newJsonData);
                    } catch (e) {
                        log('ERROR', 'Ошибка обновления JSON редактора:', e);
                    }
            }

            showSuccessToast('Замена выполнена в этом редакторе');

        } catch (e) {
            alert('Ошибка при замене: ' + e.message);
        }
    };

    window.hlShowConfirmReplace = function(searchTerm, replaceTerm, caseSensitive, useRegex) {
        // Удаляем старое окно, если есть
        const oldModal = document.getElementById('hl-json-confirm-modal');
        if (oldModal) oldModal.remove();
        // Создаём модальное окно
        const modal = document.createElement('div');
        modal.id = 'hl-json-confirm-modal';
        modal.className = 'hl-json-confirm-modal';
        modal.innerHTML = `
            <div class="hl-json-confirm-content">
                <div class="hl-json-confirm-title">Подтвердите замену</div>
                <div style="margin-bottom: 18px; font-size: 16px; color: #333;">Заменить все вхождения <b>"${searchTerm}"</b> на <b>"${replaceTerm}"</b> во всех редакторах?</div>
                <button class="hl-json-confirm-btn" id="hl-json-confirm-yes">Да</button>
                <button class="hl-json-confirm-btn" id="hl-json-confirm-no">Нет</button>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('hl-json-confirm-yes').onclick = function() {
            modal.remove();
            const blockSearch = document.getElementById('hl-block-search').checked;
            executeReplace(searchTerm, replaceTerm, caseSensitive, useRegex, blockSearch);
        };
        document.getElementById('hl-json-confirm-no').onclick = function() {
            modal.remove();
        };
    };

    window.hlExecuteAllReplace = function(searchTerm, replaceTerm, caseSensitive, useRegex) {
        hlShowConfirmReplace(searchTerm, replaceTerm, caseSensitive, useRegex);
    };

    function showSuccessToast(message) {
        // Удалить старый тост если есть
        const oldToast = document.getElementById('hl-json-toast');
        if (oldToast) oldToast.remove();
        // Создать новый
        const toast = document.createElement('div');
        toast.id = 'hl-json-toast';
        toast.className = 'hl-json-toast';
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('hl-json-toast-show'), 10);
        // Автоматическое скрытие
        const hide = () => {
            toast.classList.remove('hl-json-toast-show');
            setTimeout(() => toast.remove(), 300);
        };
        toast.onclick = hide;
        setTimeout(hide, 2500);
    }

    function showErrorToast(message) {
        // Удалить старый тост если есть
        const oldToast = document.getElementById('hl-json-toast');
        if (oldToast) oldToast.remove();
        // Создать новый
        const toast = document.createElement('div');
        toast.id = 'hl-json-toast';
        toast.className = 'hl-json-toast hl-json-toast-error';
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('hl-json-toast-show'), 10);
        // Автоматическое скрытие
        const hide = () => {
            toast.classList.remove('hl-json-toast-show');
            setTimeout(() => toast.remove(), 300);
        };
        toast.onclick = hide;
        setTimeout(hide, 5000); // Показываем ошибки дольше
    }

    // Функция показа модального окна с опциями для синхронизации parsing
    function showParsingOptionsModal() {
        // Удаляем существующее модальное окно если есть
        const existingModal = document.getElementById('hl-parsing-options-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Автоматически включаем debug режим для удобства диагностики
        if (!debugMode) {
            debugMode = true;
            const debugCheckbox = document.getElementById('hl-debug-checkbox');
            if (debugCheckbox) {
                debugCheckbox.checked = true;
            }
            log('INFO', 'Debug режим автоматически включен для синхронизации parsing');
        }

        // Показываем debug чекбокс
        const debugToggle = document.getElementById('hl-debug-toggle');
        if (debugToggle) {
            debugToggle.classList.add('show');
        }

        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.id = 'hl-parsing-options-modal';
        modal.className = 'hl-json-parsing-modal';

        // Список дополнительных полей для синхронизации
        const additionalFields = [
            'concurents_influence',
            'take_max_price',
            'force_rate',
            'force_key',
            'new_id',
            'genius',
            'tax',
            'tax_per_person',
            'stay_length',
            'price_source',
            'clip'
        ];

        const fieldsHtml = additionalFields.map(field => `
            <label class="hl-json-parsing-field-label">
                <input type="checkbox" class="hl-json-parsing-field-checkbox" data-field="${field}">
                <span>${field}</span>
            </label>
        `).join('');

        modal.innerHTML = `
            <div class="hl-json-parsing-modal-content">
                <div class="hl-json-parsing-modal-title">🔧 Настройки синхронизации Parsing</div>
                
                <div class="hl-json-parsing-default-fields">
                    <strong style="color: #222;">Поля синхронизируются всегда:</strong>
                    <div style="margin-top: 8px; color: #666;">
                        • standart_category<br>
                        • hotel_title
                    </div>
                    <div style="margin-top: 10px; font-size: 12px; color: #666;">
                        <em>* selfID каждого конфига сохраняется без изменений</em>
                    </div>
                </div>
                
                <div style="margin-bottom: 10px;">
                    <strong style="color: #222;">Дополнительные поля для синхронизации:</strong>
                </div>
                
                <div class="hl-json-parsing-fields">
                    ${fieldsHtml}
                </div>
                
                <div style="margin-top: 15px; padding: 12px; background: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107; color: #856404; font-size: 13px;">
                    <strong>⚠️ Важно:</strong>
                    <ul style="margin: 8px 0 0 20px; padding: 0;">
                        <li>Синхронизируется массив <code style="background: #ffe082; padding: 2px 4px; border-radius: 3px; font-family: monospace;color: #856404;">concurents</code> внутри каждого элемента parsing</li>
                        <li>Concurents из основного конфига будут добавлены в сезонные, если их там нет</li>
                        <li>Concurents из сезонных конфигов будут удалены, если их нет в основном</li>
                        <li>Поле <code style="background: #ffe082; padding: 2px 4px; border-radius: 3px; font-family: monospace;color: #856404;">selfID</code> каждого конфига остается без изменений</li>
                        <li>Синхронизация затронет все сезонные конфиги</li>
                    </ul>
                </div>
                
                <div class="hl-json-parsing-buttons">
                    <button class="hl-json-parsing-btn-action hl-json-parsing-btn-sync" id="hl-parsing-sync-btn">
                        Синхронизировать
                    </button>
                    <button class="hl-json-parsing-btn-action hl-json-parsing-btn-cancel" id="hl-parsing-cancel-btn">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики событий
        document.getElementById('hl-parsing-sync-btn').addEventListener('click', () => {
            // Собираем выбранные дополнительные поля
            const selectedFields = [];
            modal.querySelectorAll('.hl-json-parsing-field-checkbox:checked').forEach(checkbox => {
                selectedFields.push(checkbox.getAttribute('data-field'));
            });
            
            modal.remove();
            syncParsingData(selectedFields);
        });

        document.getElementById('hl-parsing-cancel-btn').addEventListener('click', () => {
            modal.remove();
            // Скрываем debug чекбокс если не открыто главное окно поиска
            const mainModal = document.getElementById('hl-json-search-modal');
            if (!mainModal) {
                const debugToggle = document.getElementById('hl-debug-toggle');
                if (debugToggle) {
                    debugToggle.classList.remove('show');
                }
            }
        });

        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                // Скрываем debug чекбокс если не открыто главное окно поиска
                const mainModal = document.getElementById('hl-json-search-modal');
                if (!mainModal) {
                    const debugToggle = document.getElementById('hl-debug-toggle');
                    if (debugToggle) {
                        debugToggle.classList.remove('show');
                    }
                }
            }
        });
    }

    // Функция синхронизации parsing данных
    function syncParsingData(additionalFields = []) {
        log('INFO', '🔧 Начинаем синхронизацию parsing данных...');
        log('DEBUG', 'Дополнительные поля для синхронизации:', additionalFields);
        
        try {
            // Находим все JSON редакторы
            const textareas = document.querySelectorAll('.for_jsoneditor');
            log('DEBUG', `Найдено textarea элементов: ${textareas.length}`);
            
            if (textareas.length === 0) {
                showErrorToast('JSON редакторы не найдены');
                return;
            }
            
            // Ищем основной конфиг и сезонные конфиги
            let mainConfig = null;
            let seasonalConfigs = [];
            
            for (let textarea of textareas) {
                try {
                    log('DEBUG', `Обрабатываем textarea: ID=${textarea.id}, value length=${textarea.value.length}`);
                    
                    if (!textarea.value || textarea.value.trim() === '') {
                        log('DEBUG', `Textarea ${textarea.id} пустой, пропускаем`);
                        continue;
                    }
                    
                    const jsonData = JSON.parse(textarea.value);
                    const editorName = textarea.id.replace('_json', '');
                    
                    log('DEBUG', `Parsed JSON для ${textarea.id}: isArray=${Array.isArray(jsonData)}, length=${jsonData?.length}`);
                    
                    if (!jsonData || typeof jsonData !== 'object') {
                        log('DEBUG', `Textarea ${textarea.id} содержит невалидный JSON, пропускаем`);
                        continue;
                    }
                    
                    // Проверяем, является ли это основным конфигом
                    if (editorName.includes('price_sources_hotels-0-config')) {
                        if (Array.isArray(jsonData) && jsonData.length > 0) {
                            mainConfig = { textarea, jsonData, editorName };
                            log('INFO', `✅ Найден основной конфиг: ${editorName}, элементов: ${jsonData.length}`);
                            // Логируем первый элемент для проверки структуры
                            if (jsonData[0] && jsonData[0].parsing) {
                                log('DEBUG', 'Структура parsing в основном конфиге:', JSON.stringify(jsonData[0].parsing, null, 2).substring(0, 1000));
                            }
                            // Проверяем наличие parsing
                            const parsingCount = jsonData.filter(item => item && item.parsing).length;
                            log('INFO', `Элементов с parsing в основном конфиге: ${parsingCount}`);
                        } else {
                            log('DEBUG', `Основной конфиг ${editorName} не является массивом или пустой`);
                        }
                    }
                    // Проверяем, является ли это сезонным конфигом
                    else if (editorName.includes('hotelSeasonsConfigs')) {
                        if (Array.isArray(jsonData) && jsonData.length > 0) {
                            seasonalConfigs.push({ textarea, jsonData, editorName });
                            log('INFO', `✅ Найден сезонный конфиг: ${editorName}, элементов: ${jsonData.length}`);
                            // Проверяем наличие parsing
                            const parsingCount = jsonData.filter(item => item && item.parsing).length;
                            log('DEBUG', `Элементов с parsing в сезонном конфиге ${editorName}: ${parsingCount}`);
                        } else {
                            log('DEBUG', `Сезонный конфиг ${editorName} не является массивом или пустой`);
                        }
                    } else {
                        log('DEBUG', `Конфиг ${editorName} не подходит под критерии (не основной и не сезонный)`);
                    }
                } catch (e) {
                    const value = textarea.value.trim();
                    if (value.startsWith('{') || value.startsWith('[')) {
                        log('ERROR', `Ошибка парсинга JSON в ${textarea.id}:`, e.message);
                    } else {
                        log('DEBUG', `Textarea ${textarea.id} не содержит JSON (первые 50 символов): "${value.substring(0, 50)}..."`);
                    }
                }
            }
            
            if (!mainConfig) {
                log('ERROR', '❌ Основной конфиг (price sources hotels-0-config) не найден');
                showErrorToast('Основной конфиг (price sources hotels-0-config) не найден');
                return;
            }
            
            if (seasonalConfigs.length === 0) {
                log('ERROR', '❌ Сезонные конфиги не найдены');
                showErrorToast('Сезонные конфиги не найдены');
                return;
            }
            
            log('INFO', `✅ Найдено: 1 основной конфиг, ${seasonalConfigs.length} сезонных конфигов`);
            
            // Обязательные поля для синхронизации (внутри каждого элемента concurents)
            const requiredFields = ['standart_category', 'hotel_title'];
            const fieldsToSync = [...requiredFields, ...additionalFields];
            
            log('DEBUG', 'Поля для синхронизации:', fieldsToSync);
            
            // Синхронизируем каждый сезонный конфиг
            let successCount = 0;
            let errorCount = 0;
            let totalSynced = 0;
            
            for (let config of seasonalConfigs) {
                try {
                    log('INFO', `\n========== Обработка ${config.editorName} ==========`);
                    const updatedJsonData = JSON.parse(JSON.stringify(config.jsonData));
                    let configSyncCount = 0;
                    
                    log('DEBUG', `Основной конфиг имеет ${mainConfig.jsonData.length} элементов`);
                    log('DEBUG', `Сезонный конфиг имеет ${updatedJsonData.length} элементов`);
                    
                    // Удаляем элементы из сезонного конфига, которых нет в основном (по индексу)
                    const indicesToRemove = [];
                    for (let i = updatedJsonData.length - 1; i >= mainConfig.jsonData.length; i--) {
                        if (updatedJsonData[i] && updatedJsonData[i].parsing) {
                            log('DEBUG', `❌ Удаляем элемент [${i}] из ${config.editorName}, т.к. его нет в основном конфиге`);
                            indicesToRemove.push(i);
                            updatedJsonData.splice(i, 1);
                            configSyncCount++;
                        }
                    }
                    
                    log('DEBUG', `Удалено элементов: ${indicesToRemove.length}`);
                    
                    // Синхронизируем существующие элементы и добавляем новые
                    let updatedItems = 0;
                    let addedItems = 0;
                    let updatedConcurents = 0;
                    
                    for (let i = 0; i < mainConfig.jsonData.length; i++) {
                        const mainItem = mainConfig.jsonData[i];
                        
                        if (!mainItem || !mainItem.parsing) {
                            log('DEBUG', `Элемент [${i}] основного конфига не имеет parsing, пропускаем`);
                            continue;
                        }
                        
                        log('DEBUG', `\nОбрабатываем элемент [${i}] основного конфига`);
                        
                        // Проверяем, есть ли соответствующий элемент в сезонном конфиге
                        if (i < updatedJsonData.length && updatedJsonData[i] && updatedJsonData[i].parsing) {
                            // Элемент существует - синхронизируем parsing
                            const seasonalItem = updatedJsonData[i];
                            const mainParsing = mainItem.parsing;
                            const seasonalParsing = seasonalItem.parsing;
                            
                            log('DEBUG', `  → Элемент [${i}] существует в сезонном конфиге`);
                            log('DEBUG', `  → Main selfID: ${mainParsing.selfID}`);
                            log('DEBUG', `  → Seasonal selfID: ${seasonalParsing.selfID} (не меняем)`);
                            
                            // Синхронизируем массив concurents
                            if (mainParsing.concurents && Array.isArray(mainParsing.concurents)) {
                                const mainConcurents = mainParsing.concurents;
                                log('DEBUG', `  → Основной конфиг имеет ${mainConcurents.length} concurents`);
                                
                                if (!seasonalParsing.concurents) {
                                    seasonalParsing.concurents = [];
                                }
                                
                                const oldSeasonalConcurents = seasonalParsing.concurents;
                                log('DEBUG', `  → Сезонный конфиг имел ${oldSeasonalConcurents.length} concurents`);
                                
                                // Создаем Map из сезонных concurents для быстрого поиска
                                const seasonalMap = new Map();
                                oldSeasonalConcurents.forEach(sc => {
                                    const hotelId = Object.keys(sc)[0];
                                    seasonalMap.set(hotelId, sc[hotelId]);
                                });
                                
                                // Создаем новый массив concurents с правильным порядком
                                const newSeasonalConcurents = [];
                                
                                // Синхронизируем каждый элемент concurents в порядке основного конфига
                                for (let j = 0; j < mainConcurents.length; j++) {
                                    const mainConcurent = mainConcurents[j];
                                    const hotelId = Object.keys(mainConcurent)[0]; // Получаем ID отеля (ключ объекта)
                                    const mainHotelData = mainConcurent[hotelId];
                                    
                                    log('DEBUG', `    → Обрабатываем concurent [${j}] с ID: ${hotelId}`);
                                    
                                    if (seasonalMap.has(hotelId)) {
                                        // Concurent существует - обновляем выбранные поля
                                        const seasonalHotelData = seasonalMap.get(hotelId);
                                        let fieldChanges = 0;
                                        
                                        for (let field of fieldsToSync) {
                                            if (mainHotelData.hasOwnProperty(field)) {
                                                const mainValue = JSON.stringify(mainHotelData[field]);
                                                const seasonalValue = JSON.stringify(seasonalHotelData[field]);
                                                
                                                if (seasonalValue !== mainValue) {
                                                    log('INFO', `      🔄 Поле "${field}": ${seasonalValue} → ${mainValue}`);
                                                    seasonalHotelData[field] = JSON.parse(mainValue);
                                                    configSyncCount++;
                                                    fieldChanges++;
                                                } else {
                                                    log('DEBUG', `      ✓ Поле "${field}" совпадает`);
                                                }
                                            }
                                        }
                                        
                                        // Добавляем обновленный concurent на позицию j
                                        newSeasonalConcurents.push({ [hotelId]: seasonalHotelData });
                                        
                                        if (fieldChanges > 0) {
                                            updatedConcurents++;
                                            log('DEBUG', `      ✅ Обновлено полей: ${fieldChanges}`);
                                        } else {
                                            log('DEBUG', `      ℹ Concurent не требует обновления`);
                                        }
                                    } else {
                                        // Concurent не найден - добавляем на позицию j (копируем из основного)
                                        newSeasonalConcurents.push(JSON.parse(JSON.stringify(mainConcurent)));
                                        configSyncCount++;
                                        updatedConcurents++;
                                        log('INFO', `      ➕ Добавлен новый concurent на позицию [${j}]: ${hotelId}`);
                                    }
                                }
                                
                                // Проверяем, были ли удалены элементы
                                const removedCount = oldSeasonalConcurents.length - newSeasonalConcurents.length;
                                if (removedCount > 0) {
                                    // Находим какие именно были удалены
                                    const mainHotelIds = new Set(mainConcurents.map(mc => Object.keys(mc)[0]));
                                    oldSeasonalConcurents.forEach(sc => {
                                        const hotelId = Object.keys(sc)[0];
                                        if (!mainHotelIds.has(hotelId)) {
                                            log('INFO', `      ❌ Удален concurent: ${hotelId} (нет в основном)`);
                                            updatedConcurents++;
                                        }
                                    });
                                    configSyncCount += removedCount;
                                }
                                
                                // Заменяем старый массив на новый
                                seasonalParsing.concurents = newSeasonalConcurents;
                                
                                updatedItems++;
                            } else {
                                log('DEBUG', `  ⚠ Элемент [${i}] основного конфига не имеет массива concurents`);
                            }
                        } else {
                            // Элемента нет - добавляем полностью
                            updatedJsonData.push(JSON.parse(JSON.stringify(mainItem)));
                            configSyncCount++;
                            addedItems++;
                            log('INFO', `  ➕ Добавлен новый элемент [${i}]`);
                        }
                    }
                    
                    log('INFO', `Итого для ${config.editorName}:`);
                    log('INFO', `  - Обновлено элементов: ${updatedItems}`);
                    log('INFO', `  - Изменено concurents: ${updatedConcurents}`);
                    log('INFO', `  - Добавлено элементов: ${addedItems}`);
                    log('INFO', `  - Удалено элементов: ${indicesToRemove.length}`);
                    log('INFO', `  - Всего изменений: ${configSyncCount}`);
                    
                    if (configSyncCount === 0) {
                        log('INFO', `⚠ Нет изменений в ${config.editorName}`);
                        continue;
                    }
                    
                    // Проверяем валидность JSON
                    const newJsonString = JSON.stringify(updatedJsonData, null, 2);
                    JSON.parse(newJsonString);
                    
                    // Обновляем textarea
                    config.textarea.value = newJsonString;
                    
                    // Обновляем JSONEditor
                    const editorDivId = config.textarea.id + '_jsoneditor';
                    if (window.jsonEditors && window.jsonEditors[editorDivId]) {
                        window.jsonEditors[editorDivId].set(updatedJsonData);
                    }
                    
                    // Обновляем через события
                    config.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    config.textarea.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    successCount++;
                    totalSynced += configSyncCount;
                    log('SUCCESS', `✅ Синхронизирован конфиг: ${config.editorName} (${configSyncCount} изменений)`);
                    
                } catch (e) {
                    errorCount++;
                    log('ERROR', `❌ Ошибка синхронизации конфига ${config.editorName}:`, e);
                    console.error('Полная ошибка:', e);
                }
            }
            
            // Показываем результат
            log('INFO', `\n========== ИТОГОВЫЙ РЕЗУЛЬТАТ ==========`);
            log('INFO', `Успешно обработано конфигов: ${successCount}`);
            log('INFO', `Конфигов с ошибками: ${errorCount}`);
            log('INFO', `Всего изменений: ${totalSynced}`);
            log('INFO', `========================================\n`);
            
            if (errorCount === 0) {
                const message = `✅ Синхронизация parsing завершена! Обновлено ${successCount} конфигов (${totalSynced} изменений)`;
                log('SUCCESS', message);
                showSuccessToast(message);
            } else {
                const message = `⚠️ Синхронизация завершена с ошибками. Успешно: ${successCount}, Ошибок: ${errorCount}`;
                log('ERROR', message);
                showErrorToast(message);
            }
            
        } catch (e) {
            log('ERROR', '❌ Критическая ошибка синхронизации parsing:', e);
            console.error('Полная ошибка:', e);
            showErrorToast('Ошибка синхронизации parsing: ' + e.message);
        }
    }

    // Функция синхронизации intercept данных
    function syncInterceptData() {
        log('INFO', '🔄 Начинаем синхронизацию intercept данных...');
        
        try {
            // Находим все JSON редакторы
            const textareas = document.querySelectorAll('.for_jsoneditor');
            log('DEBUG', `Найдено textarea элементов: ${textareas.length}`);
            
            if (textareas.length === 0) {
                showErrorToast('JSON редакторы не найдены');
                return;
            }
            
            // Ищем основной конфиг (price sources hotels-0-config) и сезонные конфиги (с season в ID)
            let mainConfig = null;
            let seasonalConfigs = [];
            
            for (let textarea of textareas) {
                try {
                    log('DEBUG', `Обрабатываем textarea: ID=${textarea.id}, value length=${textarea.value.length}`);
                    
                    // Проверяем, что textarea не пустой
                    if (!textarea.value || textarea.value.trim() === '') {
                        log('DEBUG', `Textarea ${textarea.id} пустой, пропускаем`);
                        continue;
                    }
                    
                    const jsonData = JSON.parse(textarea.value);
                    const editorName = textarea.id.replace('_json', '');
                    
                    // Проверяем, что JSON.parse вернул объект, а не null
                    if (!jsonData || typeof jsonData !== 'object') {
                        log('DEBUG', `Textarea ${textarea.id} содержит невалидный JSON (null или не объект), пропускаем`);
                        continue;
                    }
                    
                    // Проверяем, является ли это основным конфигом
                    if (editorName.includes('price_sources_hotels-0-config')) {
                        if (Array.isArray(jsonData) && jsonData.length > 0) {
                            mainConfig = { textarea, jsonData, editorName };
                            log('DEBUG', `Найден основной конфиг: ${editorName}`);
                        } else {
                            log('DEBUG', `Основной конфиг ${editorName} не содержит массив данных`);
                        }
                    }
                    // Проверяем, является ли это сезонным конфигом
                    else if (editorName.includes('hotelSeasonsConfigs')) {
                        if (Array.isArray(jsonData) && jsonData.length > 0) {
                            seasonalConfigs.push({ textarea, jsonData, editorName });
                            log('DEBUG', `Найден сезонный конфиг: ${editorName}`);
                        } else {
                            log('DEBUG', `Сезонный конфиг ${editorName} не содержит массив данных`);
                        }
                    } else {
                        log('DEBUG', `Конфиг ${editorName} не является основным или сезонным, пропускаем`);
                    }
                } catch (e) {
                    // Проверяем, является ли содержимое JSON-подобным
                    const value = textarea.value.trim();
                    if (value.startsWith('{') || value.startsWith('[')) {
                        log('ERROR', `Ошибка парсинга JSON в ${textarea.id}:`, e.message);
                    } else {
                        log('DEBUG', `Textarea ${textarea.id} содержит не-JSON данные ("${value.substring(0, 50)}..."), пропускаем`);
                    }
                }
            }
            
            if (!mainConfig) {
                showErrorToast('Основной конфиг (price sources hotels-0-config) не найден');
                return;
            }
            
            if (seasonalConfigs.length === 0) {
                showErrorToast('Сезонные конфиги (с season в ID) не найдены');
                return;
            }
            
            log('INFO', `Найдено: 1 основной конфиг, ${seasonalConfigs.length} сезонных конфигов`);
            
            // Извлекаем ВСЕ intercept из основного конфига
            const mainIntercepts = [];
            for (let i = 0; i < mainConfig.jsonData.length; i++) {
                if (mainConfig.jsonData[i] && mainConfig.jsonData[i].intercept) {
                    mainIntercepts.push({
                        index: i,
                        intercept: mainConfig.jsonData[i].intercept,
                        keys: Object.keys(mainConfig.jsonData[i].intercept)
                    });
                    log('DEBUG', `Найден intercept[${i}] в основном конфиге:`, Object.keys(mainConfig.jsonData[i].intercept));
                }
            }
            
            if (mainIntercepts.length === 0) {
                showErrorToast('В основном конфиге не найдено intercept данных');
                return;
            }
            
            log('INFO', `Найдено ${mainIntercepts.length} intercept в основном конфиге`);
            
            // Синхронизируем каждый сезонный конфиг
            let successCount = 0;
            let errorCount = 0;
            
            for (let config of seasonalConfigs) {
                try {
                    const updatedJsonData = JSON.parse(JSON.stringify(config.jsonData)); // Глубокое копирование
                    
                    // Синхронизируем каждый intercept по индексу
                    for (let mainIntercept of mainIntercepts) {
                        const seasonalIndex = mainIntercept.index;
                        
                        // Проверяем, есть ли intercept в сезонном конфиге по этому индексу
                        if (updatedJsonData[seasonalIndex] && updatedJsonData[seasonalIndex].intercept) {
                            const seasonalIntercept = updatedJsonData[seasonalIndex].intercept;
                            const seasonalKeys = Object.keys(seasonalIntercept);
                            
                            // Исключаем первый ключ (месячные данные) из основного конфига
                            const dataKeys = mainIntercept.keys.slice(1);
                            
                            if (dataKeys.length > 0) {
                                // Сохраняем первый ключ сезонного конфига
                                const firstKey = seasonalKeys[0];
                                const firstValue = seasonalIntercept[firstKey];
                                
                                // Создаем новый intercept объект
                                const newIntercept = { [firstKey]: firstValue };
                                
                                // Добавляем данные из основного конфига
                                for (let key of dataKeys) {
                                    if (mainIntercept.intercept[key] !== undefined) {
                                        newIntercept[key] = mainIntercept.intercept[key];
                                    }
                                }
                                
                                updatedJsonData[seasonalIndex].intercept = newIntercept;
                                log('DEBUG', `Синхронизирован intercept[${seasonalIndex}] в ${config.editorName}`);
                            }
                        }
                    }
                    
                    // Проверяем валидность JSON
                    const newJsonString = JSON.stringify(updatedJsonData, null, 2);
                    JSON.parse(newJsonString); // Проверка валидности
                    
                    // Обновляем textarea
                    config.textarea.value = newJsonString;
                    
                    // Обновляем JSONEditor
                    const editorDivId = config.textarea.id + '_jsoneditor';
                    if (window.jsonEditors && window.jsonEditors[editorDivId]) {
                        window.jsonEditors[editorDivId].set(updatedJsonData);
                    }
                    
                    // Обновляем через события
                    config.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    config.textarea.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    successCount++;
                    log('SUCCESS', `Синхронизирован конфиг: ${config.editorName}`);
                    
                } catch (e) {
                    errorCount++;
                    log('ERROR', `Ошибка синхронизации конфига ${config.editorName}:`, e);
                }
            }
            
            // Показываем результат
            if (errorCount === 0) {
                showSuccessToast(`✅ Синхронизация завершена! Обновлено ${successCount} конфигов`);
            } else {
                showErrorToast(`⚠️ Синхронизация завершена с ошибками. Успешно: ${successCount}, Ошибок: ${errorCount}`);
            }
            
        } catch (e) {
            log('ERROR', 'Ошибка синхронизации intercept:', e);
            showErrorToast('Ошибка синхронизации intercept: ' + e.message);
        }
    }

    // Функция синхронизации price_edges данных (полная перезапись блока)
    function syncPriceEdgesData() {
        log('INFO', '🟧 Начинаем синхронизацию price_edges данных...');
        
        try {
            const textareas = document.querySelectorAll('.for_jsoneditor');
            log('DEBUG', `Найдено textarea элементов: ${textareas.length}`);
            
            if (textareas.length === 0) {
                showErrorToast('JSON редакторы не найдены');
                return;
            }
            
            let mainConfig = null;
            let seasonalConfigs = [];
            
            for (let textarea of textareas) {
                try {
                    if (!textarea.value || textarea.value.trim() === '') {
                        continue;
                    }
                    
                    const jsonData = JSON.parse(textarea.value);
                    const editorName = textarea.id.replace('_json', '');
                    
                    if (!jsonData || typeof jsonData !== 'object') {
                        continue;
                    }
                    
                    if (editorName.includes('price_sources_hotels-0-config')) {
                        if (Array.isArray(jsonData) && jsonData.length > 0) {
                            mainConfig = { textarea, jsonData, editorName };
                            log('DEBUG', `Найден основной конфиг: ${editorName}`);
                        }
                    } else if (editorName.includes('hotelSeasonsConfigs')) {
                        if (Array.isArray(jsonData) && jsonData.length > 0) {
                            seasonalConfigs.push({ textarea, jsonData, editorName });
                        }
                    }
                } catch (e) {
                    const value = textarea.value?.trim?.() ?? '';
                    if (value.startsWith('{') || value.startsWith('[')) {
                        log('ERROR', `Ошибка парсинга JSON в ${textarea.id}:`, e.message);
                    }
                }
            }
            
            if (!mainConfig) {
                showErrorToast('Основной конфиг (price sources hotels-0-config) не найден');
                return;
            }
            
            if (seasonalConfigs.length === 0) {
                showErrorToast('Сезонные конфиги не найдены');
                return;
            }
            
            // Извлекаем ВСЕ price_edges из основного конфига (по индексам массива)
            const mainPriceEdges = [];
            for (let i = 0; i < mainConfig.jsonData.length; i++) {
                const item = mainConfig.jsonData[i];
                if (item && Object.prototype.hasOwnProperty.call(item, 'price_edges')) {
                    mainPriceEdges.push({
                        index: i,
                        price_edges: item.price_edges
                    });
                }
            }
            
            if (mainPriceEdges.length === 0) {
                showErrorToast('В основном конфиге не найдено price_edges данных');
                return;
            }
            
            log('INFO', `Найдено ${mainPriceEdges.length} price_edges блоков в основном конфиге`);
            
            let successCount = 0;
            let errorCount = 0;
            
            for (let config of seasonalConfigs) {
                try {
                    const updatedJsonData = JSON.parse(JSON.stringify(config.jsonData));
                    
                    for (let pe of mainPriceEdges) {
                        const seasonalIndex = pe.index;
                        if (!updatedJsonData[seasonalIndex] || typeof updatedJsonData[seasonalIndex] !== 'object') {
                            continue;
                        }
                        
                        // Полная перезапись блока price_edges из основного конфига
                        updatedJsonData[seasonalIndex].price_edges = JSON.parse(JSON.stringify(pe.price_edges));
                    }
                    
                    const newJsonString = JSON.stringify(updatedJsonData, null, 2);
                    JSON.parse(newJsonString); // валидация
                    
                    config.textarea.value = newJsonString;
                    
                    const editorDivId = config.textarea.id + '_jsoneditor';
                    if (window.jsonEditors && window.jsonEditors[editorDivId]) {
                        try {
                            window.jsonEditors[editorDivId].set(updatedJsonData);
                        } catch (e) {
                            log('ERROR', 'Ошибка обновления JSON редактора:', e);
                        }
                    }
                    
                    config.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    config.textarea.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    successCount++;
                    log('SUCCESS', `🟧 Синхронизирован price_edges: ${config.editorName}`);
                } catch (e) {
                    errorCount++;
                    log('ERROR', `Ошибка синхронизации price_edges для ${config.editorName}:`, e);
                }
            }
            
            if (errorCount === 0) {
                showSuccessToast(`✅ price_edges синхронизированы! Обновлено ${successCount} конфигов`);
            } else {
                showErrorToast(`⚠️ price_edges: успешно ${successCount}, ошибок ${errorCount}`);
            }
            
        } catch (e) {
            log('ERROR', 'Ошибка синхронизации price_edges:', e);
            showErrorToast('Ошибка синхронизации price_edges: ' + e.message);
        }
    }

    // ===== BASE PRICE MAKER =====
    const STORAGE_KEY_SOURCE = 'base_price_maker_source';
    const STORAGE_KEY_MODE = 'base_price_maker_mode';
    const STORAGE_KEY_VALUE = 'base_price_maker_value';
    const DEFAULT_SOURCE = 'min_price';
    const DEFAULT_MODE = 'percent';
    const DEFAULT_VALUE = '100';
    
    let foundBasePriceEditors = [];
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function initBasePriceMakerUI() {
        // Создаем кнопку
        createBasePriceButton();
        // Создаем popup
        createBasePricePopup();
    }
    
    function createBasePriceButton() {
        // Проверяем, не создана ли уже кнопка
        if (document.getElementById('hl-base-price-maker-btn')) {
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'hl-base-price-maker-btn';
        btn.innerHTML = 'BP';
        btn.title = 'Base Price Maker';
        btn.addEventListener('click', toggleBasePricePopup);
        document.body.appendChild(btn);
    }

    function createBasePricePopup() {
        // Проверяем, не создан ли уже popup
        if (document.getElementById('hl-base-price-maker-popup')) {
            return;
        }

        // Overlay для закрытия по клику вне popup
        const overlay = document.createElement('div');
        overlay.id = 'hl-base-price-maker-overlay';
        overlay.addEventListener('click', closeBasePricePopup);
        document.body.appendChild(overlay);

        // Popup
        const popup = document.createElement('div');
        popup.id = 'hl-base-price-maker-popup';
        
        const source = localStorage.getItem(STORAGE_KEY_SOURCE) || DEFAULT_SOURCE;
        const mode = localStorage.getItem(STORAGE_KEY_MODE) || DEFAULT_MODE;
        const value = localStorage.getItem(STORAGE_KEY_VALUE) || DEFAULT_VALUE;
        
        popup.innerHTML = `
            <h3>Base Price Maker</h3>
            
            <div class="hl-base-price-section">
                <label class="hl-base-price-label">Источник данных:</label>
                <select id="hl-base-price-source" class="hl-base-price-select">
                    <option value="min_price" ${source === 'min_price' ? 'selected' : ''}>min_price</option>
                    <option value="max_price" ${source === 'max_price' ? 'selected' : ''}>max_price</option>
                </select>
            </div>

            <div class="hl-base-price-section">
                <label class="hl-base-price-label">Режим расчета:</label>
                <div class="hl-base-price-toggle-group">
                    <button class="hl-base-price-toggle-btn ${mode === 'percent' ? 'active' : ''}" data-mode="percent">
                        Процент (%)
                    </button>
                    <button class="hl-base-price-toggle-btn ${mode === 'value' ? 'active' : ''}" data-mode="value">
                        Значение
                    </button>
                </div>
                <div class="hl-base-price-input-group">
                    <input type="text" id="hl-base-price-value" class="hl-base-price-input" value="${value}" placeholder="100 или +10 или -10">
                    <span class="hl-base-price-suffix" id="hl-base-price-suffix">${mode === 'percent' ? '%' : ''}</span>
                </div>
            </div>

            <div class="hl-base-price-section">
                <label class="hl-base-price-label">Найденные JSON редакторы:</label>
                <div id="hl-base-price-editors-list" class="hl-base-price-editors-list">
                    <div style="text-align: center; color: #999; padding: 20px;">Нажмите "Найти редакторы" для поиска</div>
                </div>
            </div>

            <div class="hl-base-price-actions">
                <button class="hl-base-price-btn hl-base-price-btn-primary" id="hl-base-price-find-btn">
                    Найти редакторы
                </button>
                <button class="hl-base-price-btn hl-base-price-btn-primary" id="hl-base-price-process-btn" disabled>
                    Обработать
                </button>
            </div>

            <div id="hl-base-price-result"></div>
        `;

        // Обработчики
        const sourceSelect = popup.querySelector('#hl-base-price-source');
        const modeBtns = popup.querySelectorAll('.hl-base-price-toggle-btn');
        const valueInput = popup.querySelector('#hl-base-price-value');
        const suffixSpan = popup.querySelector('#hl-base-price-suffix');
        const findBtn = popup.querySelector('#hl-base-price-find-btn');
        const processBtn = popup.querySelector('#hl-base-price-process-btn');
        const resultDiv = popup.querySelector('#hl-base-price-result');
        const editorsListDiv = popup.querySelector('#hl-base-price-editors-list');

        // Переключение режима
        modeBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                modeBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                const newMode = this.getAttribute('data-mode');
                localStorage.setItem(STORAGE_KEY_MODE, newMode);
                suffixSpan.textContent = newMode === 'percent' ? '%' : '';
            });
        });

        // Сохранение значения
        valueInput.addEventListener('input', function() {
            localStorage.setItem(STORAGE_KEY_VALUE, this.value);
        });

        // Сохранение источника
        sourceSelect.addEventListener('change', function() {
            localStorage.setItem(STORAGE_KEY_SOURCE, this.value);
        });

        // Поиск редакторов
        findBtn.addEventListener('click', findBasePriceEditors);

        // Обработка JSON редакторов
        processBtn.addEventListener('click', processBasePriceEditors);

        document.body.appendChild(popup);
    }
    
    function toggleBasePricePopup(e) {
        e.stopPropagation();
        const popup = document.getElementById('hl-base-price-maker-popup');
        const overlay = document.getElementById('hl-base-price-maker-overlay');
        
        if (popup.classList.contains('visible')) {
            closeBasePricePopup();
        } else {
            popup.classList.add('visible');
            overlay.classList.add('visible');
        }
    }

    function closeBasePricePopup() {
        const popup = document.getElementById('hl-base-price-maker-popup');
        const overlay = document.getElementById('hl-base-price-maker-overlay');
        if (popup) popup.classList.remove('visible');
        if (overlay) overlay.classList.remove('visible');
    }
    
    function getBasePriceEditorName(textarea) {
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
    
    function findBasePriceEditors() {
        const editorsListDiv = document.getElementById('hl-base-price-editors-list');
        const processBtn = document.getElementById('hl-base-price-process-btn');
        const resultDiv = document.getElementById('hl-base-price-result');
        
        // Находим все JSON редакторы
        const jsonEditors = document.querySelectorAll('.for_jsoneditor');
        
        foundBasePriceEditors = [];
        
        jsonEditors.forEach((textarea) => {
            try {
                const jsonText = textarea.value;
                if (!jsonText || !jsonText.trim()) {
                    return;
                }
                
                const jsonData = JSON.parse(jsonText);
                const editorName = getBasePriceEditorName(textarea);
                
                foundBasePriceEditors.push({
                    textarea: textarea,
                    editorName: editorName,
                    data: jsonData
                });
            } catch (e) {
                // Игнорируем невалидные JSON
                log('DEBUG', 'Невалидный JSON в редакторе:', textarea.id, e);
            }
        });
        
        // Обновляем список
        if (foundBasePriceEditors.length === 0) {
            if (editorsListDiv) {
                editorsListDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">JSON редакторы не найдены</div>';
            }
            if (processBtn) processBtn.disabled = true;
            showBasePriceError(resultDiv, 'JSON редакторы не найдены на странице');
        } else {
            if (editorsListDiv) {
                editorsListDiv.innerHTML = foundBasePriceEditors.map((editor, index) => {
                    return `<div class="hl-base-price-editor-item">${index + 1}. ${escapeHtml(editor.editorName)}</div>`;
                }).join('');
            }
            if (processBtn) processBtn.disabled = false;
            showBasePriceSuccess(resultDiv, `Найдено JSON редакторов: ${foundBasePriceEditors.length}`);
        }
    }
    
    function processBasePriceEditors() {
        const resultDiv = document.getElementById('hl-base-price-result');
        const sourceSelect = document.getElementById('hl-base-price-source');
        const modeBtns = document.querySelectorAll('.hl-base-price-toggle-btn');
        const valueInput = document.getElementById('hl-base-price-value');
        const processBtn = document.getElementById('hl-base-price-process-btn');
        
        if (foundBasePriceEditors.length === 0) {
            showBasePriceError(resultDiv, 'Сначала найдите JSON редакторы');
            return;
        }
        
        // Определяем источник и режим
        const source = sourceSelect ? sourceSelect.value : DEFAULT_SOURCE;
        const activeModeBtn = Array.from(modeBtns).find(btn => btn.classList.contains('active'));
        const mode = activeModeBtn ? activeModeBtn.getAttribute('data-mode') : DEFAULT_MODE;
        const valueStr = valueInput ? valueInput.value.trim() : DEFAULT_VALUE;
        
        // Парсим значение с учетом знаков + и -
        let value = 0;
        let isAddition = true;
        let hasSign = false;
        
        if (valueStr.startsWith('+')) {
            value = parseFloat(valueStr.substring(1));
            isAddition = true;
            hasSign = true;
        } else if (valueStr.startsWith('-')) {
            value = parseFloat(valueStr.substring(1));
            isAddition = false;
            hasSign = true;
        } else {
            value = parseFloat(valueStr);
            isAddition = true;
            hasSign = false;
        }
        
        if (isNaN(value)) {
            showBasePriceError(resultDiv, 'Введите корректное значение');
            return;
        }
        
        // Передаем информацию о наличии знака в функцию расчета
        const hasSignValue = hasSign;
        
        // Обрабатываем каждый редактор
        let processedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        
        if (processBtn) {
            processBtn.disabled = true;
            processBtn.textContent = 'Обработка...';
        }
        
        foundBasePriceEditors.forEach((editor) => {
            try {
                // Получаем актуальные данные из textarea
                const currentText = editor.textarea.value;
                if (!currentText || !currentText.trim()) {
                    skippedCount++;
                    return;
                }
                
                let config = JSON.parse(currentText);
                let hasChanges = false;
                let profilesProcessed = 0;
                let profilesSkipped = 0;
                
                // Обрабатываем конфиг
                if (Array.isArray(config)) {
                    // Массив профилей
                    config.forEach((profile, index) => {
                        const result = processBasePriceProfile(profile, source, mode, value, isAddition, hasSignValue);
                        if (result.processed) {
                            hasChanges = true;
                            profilesProcessed++;
                        } else {
                            profilesSkipped++;
                            if (result.reason) {
                                log('DEBUG', `Профиль [${index}] пропущен: ${result.reason}`);
                            }
                        }
                    });
                } else if (typeof config === 'object' && config !== null) {
                    // Один профиль
                    const result = processBasePriceProfile(config, source, mode, value, isAddition, hasSignValue);
                    if (result.processed) {
                        hasChanges = true;
                        profilesProcessed++;
                    } else {
                        profilesSkipped++;
                        if (result.reason) {
                            log('DEBUG', `Профиль пропущен: ${result.reason}`);
                        }
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
                            log('ERROR', 'Ошибка обновления JSON редактора:', e);
                        }
                    }
                    
                    // Вызываем события для синхронизации
                    editor.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    editor.textarea.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    processedCount++;
                    log('INFO', `Редактор "${editor.editorName}": обработано профилей ${profilesProcessed}, пропущено ${profilesSkipped}`);
                } else {
                    skippedCount++;
                    log('DEBUG', `Редактор "${editor.editorName}": нет изменений (обработано ${profilesProcessed}, пропущено ${profilesSkipped})`);
                }
            } catch (e) {
                log('ERROR', `Ошибка обработки редактора ${editor.editorName}:`, e);
                errorCount++;
            }
        });
        
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.textContent = 'Обработать';
        }
        
        // Показываем результат
        const message = `Обработано: ${processedCount}, Пропущено: ${skippedCount}${errorCount > 0 ? ', Ошибок: ' + errorCount : ''}`;
        if (errorCount > 0) {
            showBasePriceError(resultDiv, message);
        } else if (processedCount > 0) {
            showBasePriceSuccessMessage(resultDiv, message);
        } else {
            showBasePriceSuccess(resultDiv, 'Изменений не требуется');
        }
    }
    
    function processBasePriceProfile(profile, source, mode, value, isAddition, hasSign = false) {
        if (!profile || typeof profile !== 'object') {
            return { processed: false, reason: 'Профиль не является объектом' };
        }
        
        const basePrice = {};
        let hasData = false;
        
        // Проверяем наличие источника и обрабатываем данные
        if (profile[source] !== undefined && profile[source] !== null) {
            const sourceValue = profile[source];
            
            // Случай 1: source - это просто число (например, "min_price": 304)
            if (typeof sourceValue === 'number' && !isNaN(sourceValue) && isFinite(sourceValue)) {
                const processedValue = calculateBasePrice(sourceValue, mode, value, isAddition, hasSign);
                if (typeof processedValue === 'number' && !isNaN(processedValue) && isFinite(processedValue)) {
                    profile.base_price = processedValue;
                    hasData = true;
                    // Переупорядочиваем ключи, чтобы base_price был сразу после source
                    reorderObjectKeys(profile, source);
                    log('DEBUG', `Обработано простое число ${source}: ${sourceValue} -> ${processedValue}`);
                    return { processed: true };
                }
            }
            // Случай 2: source - это объект с ключами (например, "min_price": {"1": [304]})
            else if (typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
                const sourceData = sourceValue;
                
                // Обрабатываем каждую пару ключ-значение в source
                for (const key in sourceData) {
                    if (sourceData.hasOwnProperty(key)) {
                        const sourceValues = sourceData[key];
                        
                        // Проверяем тип значения
                        if (Array.isArray(sourceValues)) {
                            // Обрабатываем массив значений
                            if (sourceValues.length > 0) {
                                const processedValues = sourceValues.map(sv => {
                                    return calculateBasePrice(sv, mode, value, isAddition, hasSign);
                                });
                                // Проверяем, что есть хотя бы одно валидное число
                                if (processedValues.some(v => typeof v === 'number' && !isNaN(v))) {
                                    basePrice[key] = processedValues;
                                    hasData = true;
                                }
                            } else {
                                // Пустой массив - сохраняем как пустой массив
                                basePrice[key] = [];
                                hasData = true;
                            }
                        } else if (typeof sourceValues === 'number') {
                            // Одно числовое значение - сохраняем как число (не массив)
                            if (!isNaN(sourceValues) && isFinite(sourceValues)) {
                                const processedValue = calculateBasePrice(sourceValues, mode, value, isAddition, hasSign);
                                if (typeof processedValue === 'number' && !isNaN(processedValue) && isFinite(processedValue)) {
                                    basePrice[key] = processedValue;
                                    hasData = true;
                                    log('DEBUG', `Обработано не-массивное значение для ключа ${key}: ${sourceValues} -> ${processedValue}`);
                                }
                            }
                        } else if (sourceValues !== null && sourceValues !== undefined) {
                            // Сохраняем как есть, если не число и не массив (но не null/undefined)
                            basePrice[key] = sourceValues;
                            hasData = true;
                        }
                    }
                }
            }
            // Случай 3: source - это массив (редкий случай, но обрабатываем)
            else if (Array.isArray(sourceValue)) {
                if (sourceValue.length > 0) {
                    const processedValues = sourceValue.map(sv => {
                        return calculateBasePrice(sv, mode, value, isAddition, hasSign);
                    });
                    if (processedValues.some(v => typeof v === 'number' && !isNaN(v))) {
                        profile.base_price = processedValues;
                        hasData = true;
                        // Переупорядочиваем ключи, чтобы base_price был сразу после source
                        reorderObjectKeys(profile, source);
                        return { processed: true };
                    }
                } else {
                    profile.base_price = [];
                    hasData = true;
                    // Переупорядочиваем ключи, чтобы base_price был сразу после source
                    reorderObjectKeys(profile, source);
                    return { processed: true };
                }
            }
        }
        
        // Всегда создаем или перезаписываем base_price
        // Если есть данные - используем их, если нет - создаем пустой объект или копируем структуру из source
        if (hasData) {
            profile.base_price = basePrice;
            // Переупорядочиваем ключи, чтобы base_price был сразу после source
            reorderObjectKeys(profile, source);
            return { processed: true };
        } else {
            // Если source существует, но пустой, создаем пустой base_price
            // Если source не существует, тоже создаем пустой base_price для единообразия
            profile.base_price = {};
            // Переупорядочиваем ключи, чтобы base_price был сразу после source
            reorderObjectKeys(profile, source);
            return { processed: true, reason: `${source} отсутствует или пустой, создан пустой base_price` };
        }
    }
    
    function reorderObjectKeys(obj, sourceKey) {
        // Получаем все ключи объекта
        const keys = Object.keys(obj);
        
        // Находим позицию source (min_price или max_price)
        const sourceIndex = keys.indexOf(sourceKey);
        
        // Если source не найден, ничего не делаем
        if (sourceIndex === -1) {
            return;
        }
        
        // Если base_price уже на правильной позиции (сразу после source), ничего не делаем
        if (keys[sourceIndex + 1] === 'base_price') {
            return;
        }
        
        // Сохраняем значение base_price
        const basePriceValue = obj.base_price;
        
        // Удаляем base_price из объекта
        delete obj.base_price;
        
        // Создаем новый объект с правильным порядком ключей
        const newObj = {};
        
        // Копируем все ключи до source включительно
        for (let i = 0; i <= sourceIndex; i++) {
            newObj[keys[i]] = obj[keys[i]];
        }
        
        // Вставляем base_price сразу после source
        newObj.base_price = basePriceValue;
        
        // Копируем остальные ключи (кроме base_price, который уже добавлен)
        for (let i = sourceIndex + 1; i < keys.length; i++) {
            if (keys[i] !== 'base_price') {
                newObj[keys[i]] = obj[keys[i]];
            }
        }
        
        // Копируем все свойства из нового объекта обратно в исходный
        Object.keys(obj).forEach(key => {
            delete obj[key];
        });
        Object.assign(obj, newObj);
    }
    
    function calculateBasePrice(sourceValue, mode, value, isAddition, hasSign = false) {
        if (typeof sourceValue !== 'number' || isNaN(sourceValue)) {
            return sourceValue;
        }
        
        if (mode === 'percent') {
            // Обработка процентов с учетом знаков + и -
            if (hasSign) {
                // Если есть знак + или -, это означает "добавить/вычесть X%"
                if (isAddition) {
                    // +20% означает умножить на 1.20 (добавить 20%)
                    return Math.round(sourceValue * (1 + value / 100));
                } else {
                    // -20% означает умножить на 0.80 (вычесть 20%)
                    return Math.round(sourceValue * (1 - value / 100));
                }
            } else {
                // Без знака - просто процент от значения (20% = 0.20)
                return Math.round(sourceValue * (value / 100));
            }
        } else {
            // Абсолютное значение (сложение или вычитание)
            const finalValue = isAddition ? value : -value;
            return Math.round(sourceValue + finalValue);
        }
    }
    
    function showBasePriceError(resultDiv, message) {
        if (resultDiv) {
            resultDiv.innerHTML = `<div class="hl-base-price-error">${escapeHtml(message)}</div>`;
        }
    }
    
    function showBasePriceSuccess(resultDiv, message) {
        if (resultDiv) {
            resultDiv.innerHTML = `<div class="hl-base-price-result">${escapeHtml(message)}</div>`;
        }
    }
    
    function showBasePriceSuccessMessage(resultDiv, message) {
        if (resultDiv) {
            resultDiv.innerHTML = `<div class="hl-base-price-success">${escapeHtml(message)}</div>`;
        }
    }

    // Запускаем скрипт
    log('SUCCESS', '🚀 JSR скрипт загружен и готов к работе!');
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForElements);
    } else {
        waitForElements();
    }
})();