// js/folder_styles.js
// 样式定义

function addFolderStyles() {
    // 检查是否已经添加过样式
    if (document.querySelector('#nm-folder-styles')) {
        return;
    }
    
    const style = document.createElement('style');
    style.id = 'nm-folder-styles';
    style.textContent = `
        /* ========== 主容器 ========== */
        .nm-container {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            background: var(--comfy-menu-bg, #1e1e1e);
            color: var(--input-text, #ffffff);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            overflow: hidden;
        }
        
        /* ========== 头部 ========== */
        .nm-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-color, #444);
            background: var(--comfy-menu-bg, #1e1e1e);
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }
        
        .nm-header-left {
            flex: 1;
        }
        
        .nm-header-right {
            display: flex;
            gap: 8px;
        }
        
        .nm-toolbar-buttons {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        
        .nm-toolbar-btn {
            padding: 6px 12px;
            background: var(--comfy-input-bg, #2d2d2d);
            border: 1px solid var(--border-color, #555);
            border-radius: 6px;
            color: var(--input-text, #ddd);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
        }
        
        .nm-toolbar-btn:hover {
            background: var(--comfy-menu-bg, #353535);
            border-color: #007acc;
            color: #fff;
        }
        
        .nm-toolbar-btn .nm-btn-icon {
            font-size: 14px;
        }
        
        .nm-toolbar-btn .nm-btn-text {
            font-size: 13px;
        }
        
        .nm-toolbar-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .nm-header-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--input-text, #ffffff);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .nm-header-subtitle {
            font-size: 12px;
            color: var(--descrip-text, #999);
        }
        
        .nm-header-btn {
            padding: 8px 14px;
            background: var(--comfy-input-bg, #2d2d2d);
            border: 1px solid var(--border-color, #555);
            border-radius: 6px;
            color: var(--input-text, #ddd);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
        }
        
        .nm-header-btn:hover {
            background: var(--comfy-menu-bg, #353535);
            border-color: #007acc;
            color: #fff;
        }
        
        .nm-header-btn.active {
            background: #007acc;
            border-color: #007acc;
            color: #fff;
            box-shadow: 0 0 10px rgba(0, 122, 204, 0.6);
        }
        
        .nm-header-btn.active .nm-btn-icon {
            animation: pulse-icon 1.5s ease-in-out infinite;
        }
        
        @keyframes pulse-icon {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
        }
        
        .nm-btn-icon {
            font-size: 14px;
        }
        
        .nm-btn-text {
            font-size: 12px;
        }
        
        /* ========== 按钮样式（对话框使用） ========== */
        .nm-btn {
            padding: 6px 12px;
            background: var(--comfy-input-bg, #2d2d2d);
            border: 1px solid var(--border-color, #555);
            border-radius: 4px;
            color: var(--input-text, #ffffff);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .nm-btn:hover {
            background: var(--comfy-input-bg-hover, #3d3d3d);
            border-color: #007acc;
        }
        
        .nm-btn:active {
            transform: translateY(1px);
        }
        
        .nm-btn.primary {
            background: #007acc;
            border-color: #007acc;
        }
        
        .nm-btn.primary:hover {
            background: #005a9e;
        }
        
        .nm-btn.danger {
            background: #dc3545;
            border-color: #dc3545;
        }
        
        .nm-btn.danger:hover {
            background: #c82333;
        }
        
        /* ========== 内容区域（左右分栏） ========== */
        .nm-content {
            flex: 1;
            display: flex;
            gap: 0;
            overflow: hidden;
            position: relative;
        }
        
        /* 左侧：文件夹树区域 */
        .nm-left-panel {
            width: 320px;
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--border-color, #444);
            background: var(--comfy-menu-bg, #1e1e1e);
            overflow-y: auto;
            padding: 12px 20px;
            min-height: 400px;
            position: relative;
            z-index: 200;
        }
        
        /* 左侧面板滚动条 */
        .nm-left-panel::-webkit-scrollbar {
            width: 18px;
        }
        .nm-left-panel::-webkit-scrollbar-track {
            background: var(--comfy-menu-bg, #1e1e1e);
        }
        .nm-left-panel::-webkit-scrollbar-thumb {
            background: var(--border-color, #555);
            border-radius: 9px;
            border: 4px solid var(--comfy-menu-bg, #1e1e1e);
        }
        .nm-left-panel::-webkit-scrollbar-thumb:hover {
            background: #777;
            border-width: 3px;
        }
        .nm-left-panel::-webkit-scrollbar-thumb:active {
            background: #888;
            border-width: 2px;
        }
        
        /* 右侧：节点池区域 */
        .nm-right-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: var(--comfy-menu-bg, #1e1e1e);
            overflow: hidden;
        }
        
        .nm-node-pool-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-color, #444);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }
        
        .nm-node-pool-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .nm-node-pool-header-right {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .nm-back-btn {
            padding: 6px 12px;
            background: var(--comfy-input-bg, #2d2d2d);
            border: 1px solid var(--border-color, #555);
            border-radius: 6px;
            color: var(--input-text, #ddd);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
        }
        
        .nm-back-btn:hover {
            background: var(--comfy-menu-bg, #353535);
            border-color: #007acc;
            color: #fff;
        }
        
        .nm-back-btn .nm-btn-icon {
            font-size: 14px;
        }
        
        .nm-back-btn .nm-btn-text {
            font-size: 13px;
        }
        
        /* 前缀管理工具栏 */
        .nm-prefix-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 16px;
            background: rgba(0, 122, 204, 0.08);
            border-bottom: 1px solid rgba(0, 122, 204, 0.2);
            gap: 12px;
        }
        
        .nm-prefix-toolbar-info {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: var(--descrip-text, #999);
        }
        
        .nm-prefix-toolbar-actions {
            display: flex;
            gap: 8px;
        }
        
        .nm-prefix-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 12px;
            background: var(--comfy-menu-bg, #353535);
            border: 1px solid var(--border-color, #444);
            border-radius: 4px;
            color: var(--fg-color, #eee);
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .nm-prefix-btn:hover {
            background: var(--comfy-input-bg, #404040);
            border-color: #007acc;
        }
        
        .nm-prefix-btn .nm-btn-icon {
            font-size: 14px;
        }
        
        .nm-prefix-btn .nm-btn-text {
            font-size: 12px;
        }
        
        .nm-node-pool-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--input-text, #ffffff);
        }
        
        .nm-restore-selected-btn {
            padding: 6px 12px;
            background: var(--comfy-input-bg, #2d2d2d);
            border: 1px solid var(--border-color, #555);
            border-radius: 6px;
            color: var(--input-text, #ddd);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
        }
        
        .nm-restore-selected-btn:hover {
            background: var(--comfy-menu-bg, #353535);
            border-color: #007acc;
            color: #fff;
        }
        
        .nm-restore-selected-btn .nm-btn-icon {
            font-size: 14px;
        }
        
        .nm-node-pool-count {
            font-size: 13px;
            color: var(--descrip-text, #999);
        }
        
        .nm-node-pool-body {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            position: relative;
            z-index: 200;  /* 确保滚动条在resize手柄上方 */
        }
        
        /* 节点池滚动条样式 */
        .nm-node-pool-body::-webkit-scrollbar {
            width: 18px;  /* 加宽滚动条，确保覆盖resize手柄 */
        }
        
        .nm-node-pool-body::-webkit-scrollbar-track {
            background: var(--comfy-menu-bg, #1e1e1e);
        }
        
        .nm-node-pool-body::-webkit-scrollbar-thumb {
            background: var(--border-color, #555);
            border-radius: 9px;
            border: 4px solid var(--comfy-menu-bg, #1e1e1e);
        }
        
        .nm-node-pool-body::-webkit-scrollbar-thumb:hover {
            background: #777;
            border-width: 3px;
        }
        
        .nm-node-pool-body::-webkit-scrollbar-thumb:active {
            background: #888;
            border-width: 2px;
        }
        
        .nm-content::-webkit-scrollbar {
            width: 18px;  /* 加宽滚动条，确保覆盖resize手柄 */
        }
        
        .nm-content::-webkit-scrollbar-track {
            background: var(--comfy-menu-bg, #1e1e1e);
        }
        
        .nm-content::-webkit-scrollbar-thumb {
            background: var(--border-color, #555);
            border-radius: 9px;
            border: 4px solid var(--comfy-menu-bg, #1e1e1e);  /* 增加边距，让滚动条看起来更美观 */
        }
        
        .nm-content::-webkit-scrollbar-thumb:hover {
            background: #777;
            border-width: 3px;  /* hover时边距变小，滚动条变粗 */
        }
        
        .nm-content::-webkit-scrollbar-thumb:active {
            background: #888;
            border-width: 2px;  /* 拖动时更粗 */
        }
        
        /* ========== 区域布局 ========== */
        .nm-section-my-folders,
        .nm-section-plugins {
            display: flex;
            flex-direction: column;
        }
        
        /* ========== 文件夹列表 ========== */
        .nm-folder-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        /* ========== 文件夹项 ========== */
        .nm-folder-item {
            position: relative;
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background: var(--comfy-input-bg, #2d2d2d);
            border: 1px solid transparent;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s ease;
            user-select: none;
        }
        
        .nm-folder-item:hover {
            background: var(--comfy-input-bg-hover, #3d3d3d);
            border-color: var(--border-color, #555);
        }
        
        .nm-folder-item.selected {
            background: rgba(0, 122, 204, 0.2);
            border-color: #007acc;
        }
        
        .nm-folder-item.dragging {
            opacity: 0.5;
        }
        
        .nm-folder-item.drag-over-top {
            border-top: 2px solid #007acc;
        }
        
        .nm-folder-item.drag-over-bottom {
            border-bottom: 2px solid #007acc;
        }
        
        .nm-folder-item.drag-over-inside {
            background: rgba(0, 122, 204, 0.15);
            border-color: #007acc;
        }
        
        .nm-folder-item.drag-over-node {
            background: rgba(124, 252, 0, 0.15);
            border-color: #7CFC00;
            animation: pulse-node 0.8s ease-in-out infinite;
        }
        
        @keyframes pulse-node {
            0%, 100% { border-color: #7CFC00; }
            50% { border-color: #00FF00; }
        }
        
        /* 层级缩进 */
        .nm-folder-item[data-level="1"] {
            padding-left: 12px;
        }
        
        .nm-folder-item[data-level="2"] {
            padding-left: 32px;
        }
        
        .nm-folder-item[data-level="3"] {
            padding-left: 52px;
        }
        
        /* ========== 文件夹图标和展开按钮 ========== */
        .nm-folder-expand {
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 6px;
            cursor: pointer;
            transition: transform 0.2s ease;
            flex-shrink: 0;
        }
        
        .nm-folder-expand.expanded {
            transform: rotate(90deg);
        }
        
        .nm-folder-expand:hover {
            color: #007acc;
        }
        
        .nm-folder-icon {
            width: 20px;
            height: 20px;
            margin-right: 8px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        /* ========== 文件夹名称 ========== */
        .nm-folder-name {
            flex: 1;
            font-size: 14px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .nm-folder-count {
            font-size: 12px;
            color: var(--descrip-text, #999);
            margin-left: 8px;
            flex-shrink: 0;
        }
        
        /* ========== 空状态 ========== */
        .nm-empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
            color: var(--descrip-text, #999);
            text-align: center;
        }
        
        .nm-empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }
        
        .nm-empty-state-text {
            font-size: 14px;
            margin-bottom: 8px;
        }
        
        .nm-empty-state-hint {
            font-size: 12px;
            opacity: 0.7;
        }
        
        /* ========== 加载状态 ========== */
        .nm-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
            color: var(--descrip-text, #999);
        }
        
        .nm-loading-spinner {
            width: 24px;
            height: 24px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top-color: #007acc;
            border-radius: 50%;
            animation: nm-spin 0.8s linear infinite;
            margin-right: 12px;
        }
        
        @keyframes nm-spin {
            to { transform: rotate(360deg); }
        }
        
        /* ========== Toast提示 ========== */
        .nm-toast {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            padding: 12px 20px;
            background: var(--comfy-input-bg, #2d2d2d);
            border: 1px solid var(--border-color, #555);
            border-radius: 6px;
            color: var(--input-text, #ffffff);
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10002; /* 高于 Modal (10000) 和预览 (10001) */
            opacity: 0;
            transition: all 0.3s ease;
            max-width: 400px;
        }
        
        .nm-toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        
        .nm-toast.nm-toast-success {
            border-left: 4px solid #28a745;
        }
        
        .nm-toast.nm-toast-error {
            border-left: 4px solid #dc3545;
        }
        
        .nm-toast.nm-toast-warning {
            border-left: 4px solid #ffc107;
        }
        
        .nm-toast.nm-toast-info {
            border-left: 4px solid #007acc;
        }
        
        /* ========== 对话框 ========== */
        .nm-dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10002; /* 高于 Modal (10000) 和预览 (10001)，确保对话框/笔记能显示在 Modal 上方 */
            animation: nm-fadeIn 0.2s ease;
        }
        
        @keyframes nm-fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .nm-dialog {
            background: var(--comfy-menu-bg, #1e1e1e);
            border: 1px solid var(--border-color, #555);
            border-radius: 8px;
            min-width: 400px;
            max-width: 600px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            animation: nm-slideUp 0.3s ease;
        }
        
        @keyframes nm-slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .nm-dialog-header {
            padding: 20px;
            border-bottom: 1px solid var(--border-color, #444);
        }
        
        .nm-dialog-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--input-text, #ffffff);
        }
        
        .nm-dialog-body {
            padding: 20px;
        }
        
        .nm-dialog-footer {
            padding: 16px 20px;
            border-top: 1px solid var(--border-color, #444);
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        }
        
        .nm-input {
            width: 100%;
            padding: 8px 12px;
            background: var(--comfy-input-bg, #2d2d2d);
            border: 1px solid var(--border-color, #555);
            border-radius: 4px;
            color: var(--input-text, #ffffff);
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s ease;
        }
        
        .nm-input:focus {
            border-color: #007acc;
        }
        
        .nm-label {
            display: block;
            margin-bottom: 8px;
            font-size: 13px;
            color: var(--descrip-text, #999);
        }
        
        /* 表单组 */
        .nm-form-group {
            margin-bottom: 20px;
        }
        
        .nm-form-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 13px;
            font-weight: 500;
            color: var(--input-text, #ffffff);
        }
        
        /* 单选按钮组 */
        .nm-radio-group {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .nm-radio-label {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: var(--comfy-input-bg, #2d2d2d);
            border: 1px solid var(--border-color, #555);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .nm-radio-label:hover {
            border-color: #007acc;
            background: rgba(0, 122, 204, 0.1);
        }
        
        .nm-radio-label input[type="radio"] {
            margin: 0;
            cursor: pointer;
        }
        
        .nm-radio-label span {
            font-size: 13px;
            color: var(--descrip-text, #ccc);
        }
        
        /* 插件列表 */
        .nm-plugin-list {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            padding: 12px;
            background: var(--comfy-input-bg, #2d2d2d);
            border-radius: 4px;
            max-height: 120px;
            overflow-y: auto;
        }
        
        .nm-plugin-tag {
            display: inline-block;
            padding: 4px 10px;
            background: rgba(0, 122, 204, 0.2);
            border: 1px solid rgba(0, 122, 204, 0.4);
            border-radius: 4px;
            font-size: 12px;
            color: #7cc5ff;
        }
        
        .nm-hint {
            font-size: 12px;
            color: var(--descrip-text, #999);
            margin: 0 0 8px 0;
        }
        
        /* 按钮样式 */
        .nm-btn-primary {
            padding: 8px 20px;
            background: #007acc;
            border: none;
            border-radius: 4px;
            color: #ffffff;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .nm-btn-primary:hover {
            background: #005a9e;
        }
        
        .nm-btn-secondary {
            padding: 8px 20px;
            background: transparent;
            border: 1px solid var(--border-color, #555);
            border-radius: 4px;
            color: var(--input-text, #ffffff);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .nm-btn-secondary:hover {
            background: var(--comfy-input-bg, #404040);
            border-color: #777;
        }
        
        .nm-dialog-close {
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            color: var(--descrip-text, #999);
            font-size: 24px;
            line-height: 1;
            cursor: pointer;
            padding: 4px 8px;
            transition: color 0.2s;
        }
        
        .nm-dialog-close:hover {
            color: var(--input-text, #ffffff);
        }
        
        .nm-dialog-header {
            position: relative;
        }
        
        .nm-dialog-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--input-text, #ffffff);
        }
        
        /* ========== 节点卡片 ========== */
        .nm-node-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 12px;
            padding: 4px;
        }
        
        .nm-node-card {
            background: var(--comfy-input-bg, #2d2d2d);
            border: 1px solid var(--border-color, #555);
            border-radius: 8px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            gap: 8px;
            position: relative;
            user-select: none;
        }
        
        /* 编辑模式下的选中样式 */
        .nm-node-card.selected {
            background: rgba(0, 122, 204, 0.15);
            border-color: #007acc;
            box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.3);
        }
        
        .nm-node-card:hover {
            background: var(--comfy-input-bg-hover, #3d3d3d);
            border-color: #007acc;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 122, 204, 0.2);
        }
        
        .nm-node-card.favorited {
            border-color: #ffc107;
        }
        
        .nm-node-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 8px;
        }
        
        .nm-node-card-icon {
            font-size: 24px;
            flex-shrink: 0;
        }
        
        .nm-node-card-actions {
            display: flex;
            gap: 4px;
            flex-shrink: 0;
        }
        
        .nm-node-card-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.15s ease;
            padding: 4px 8px;
            font-size: 12px;
            white-space: nowrap;
        }
        
        .nm-node-card-btn .nm-btn-icon {
            font-size: 14px;
            line-height: 1;
        }
        
        .nm-node-card-btn .nm-btn-text {
            font-size: 11px;
            font-weight: 500;
        }
        
        .nm-node-card-btn:hover {
            background: var(--comfy-menu-bg, #1e1e1e);
            border-color: var(--border-color, #555);
        }
        
        .nm-node-card-btn.favorite {
            color: #999;
        }
        
        .nm-node-card-btn.favorite.active {
            color: #ffc107;
        }
        
        .nm-node-card-btn.favorite.active .nm-btn-text {
            color: #ffc107;
        }
        
        .nm-node-card-btn.note {
            color: #999;
            position: relative;
        }
        
        .nm-node-card-btn.note.has-note {
            color: #007acc;
        }
        
        .nm-node-card-btn.note.has-note .nm-btn-text {
            color: #007acc;
        }
        
        /* 笔记预览tooltip */
        .nm-note-preview {
            position: absolute;
            bottom: 100%;
            right: 0;
            margin-bottom: 8px;
            background: var(--comfy-menu-bg, #2d2d2d);
            border: 1px solid var(--border-color, #555);
            border-radius: 6px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            z-index: 1000;
            min-width: 200px;
            max-width: 300px;
            max-height: 200px;
            overflow-y: auto;
            font-size: 12px;
            line-height: 1.5;
            color: var(--input-text, #ddd);
            white-space: pre-wrap;
            word-wrap: break-word;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
        }
        
        .nm-node-card-btn.note:hover .nm-note-preview {
            opacity: 1;
        }
        
        .nm-note-preview::after {
            content: '';
            position: absolute;
            top: 100%;
            right: 12px;
            border: 6px solid transparent;
            border-top-color: var(--comfy-menu-bg, #2d2d2d);
        }
        
        .nm-node-card-name {
            font-size: 14px;
            font-weight: 500;
            color: var(--input-text, #ffffff);
            line-height: 1.4;
            word-break: break-word;
            flex: 1;
        }
        
        .nm-node-card-category {
            font-size: 11px;
            color: var(--descrip-text, #999);
            background: rgba(255, 255, 255, 0.05);
            padding: 2px 6px;
            border-radius: 3px;
            display: inline-block;
            margin-top: 4px;
        }
        
        .nm-node-card-source {
            font-size: 11px;
            color: var(--descrip-text, #777);
            margin-top: 4px;
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            padding-left: 16px;
            position: relative;
        }
        
        .nm-node-card-source::before {
            content: "📦";
            font-size: 10px;
            position: absolute;
            left: 0;
            top: 0;
        }
        
        /* 节点卡片拖拽状态 */
        .nm-node-card.dragging {
            opacity: 0.5;
        }
        
        /* ========== 特殊区域 ========== */
        .nm-section-top {
            padding-bottom: 12px;
            margin-bottom: 12px;
            border-bottom: 1px solid var(--border-color, #444);
        }
        
        .nm-special-folder {
            display: flex;
            align-items: center;
            padding: 10px 12px;
            background: var(--comfy-input-bg, #2d2d2d);
            border: 1px solid transparent;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s ease;
            user-select: none;
            margin-bottom: 6px;
        }
        
        .nm-special-folder:hover {
            background: var(--comfy-input-bg-hover, #3d3d3d);
            border-color: var(--border-color, #555);
        }
        
        .nm-special-folder.active {
            background: rgba(0, 122, 204, 0.2);
            border-color: #007acc;
        }
        
        /* ========== 区域分组 ========== */
        .nm-section-my-folders,
        .nm-section-plugins {
            margin-bottom: 16px;
        }
        
        .nm-section-header {
            display: flex;
            align-items: center;
            padding: 8px 4px;
            margin-bottom: 8px;
            cursor: pointer;
            user-select: none;
            border-radius: 4px;
            transition: background 0.15s ease;
            gap: 6px;
        }
        
        .nm-section-header:hover {
            background: rgba(255, 255, 255, 0.05);
        }
        
        .nm-section-toggle {
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            transition: transform 0.2s ease;
            flex-shrink: 0;
        }
        
        .nm-section-toggle.collapsed {
            transform: rotate(-90deg);
        }
        
        .nm-section-title {
            flex: 1;
            font-size: 13px;
            font-weight: 600;
            color: var(--descrip-text, #999);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .nm-section-add-btn {
            width: 22px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 4px;
            color: var(--descrip-text, #999);
            cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
            padding: 0;
        }
        
        .nm-section-add-btn:hover {
            background: var(--comfy-input-bg, #2d2d2d);
            border-color: var(--border-color, #555);
            color: #fff;
            transform: rotate(90deg);
        }
        
        .nm-section-add-btn:active {
            transform: rotate(90deg) scale(0.95);
        }
        
        .nm-section-add-btn svg {
            width: 14px;
            height: 14px;
        }
        
        .nm-section-content {
            padding-left: 4px;
            margin-bottom: 8px;
            overflow-y: auto;
            overflow-x: hidden;
            max-height: 60vh;
        }
        
        /* 自定义滚动条样式 */
        .nm-section-content::-webkit-scrollbar {
            width: 8px;
        }
        
        .nm-section-content::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .nm-section-content::-webkit-scrollbar-thumb {
            background: var(--border-color, #555);
            border-radius: 4px;
        }
        
        .nm-section-content::-webkit-scrollbar-thumb:hover {
            background: var(--descrip-text, #666);
        }
        
        .nm-section-content.collapsed {
            display: none;
        }
        
        .nm-section-empty {
            padding: 20px 12px;
            text-align: center;
            font-size: 13px;
            color: var(--descrip-text, #666);
        }
        
        /* ========== 插件项 ========== */
        .nm-plugin-container {
            margin-bottom: 4px;
        }
        
        .nm-plugin-item {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background: var(--comfy-input-bg, #2d2d2d);
            border: 1px solid transparent;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s ease;
            user-select: none;
        }
        
        .nm-plugin-item:hover {
            background: var(--comfy-input-bg-hover, #3d3d3d);
            border-color: var(--border-color, #555);
        }
        
        .nm-plugin-item.active {
            background: rgba(0, 122, 204, 0.2);
            border-color: #007acc;
        }
        
        .nm-plugin-item.selected {
            background: rgba(0, 122, 204, 0.15);
            border-color: #007acc;
        }
        
        .nm-plugin-item.hidden {
            opacity: 0.5;
            filter: grayscale(0.8);
            border: 1px dashed #666 !important;
            background: repeating-linear-gradient(
                45deg,
                rgba(255, 255, 255, 0.02),
                rgba(255, 255, 255, 0.02) 10px,
                rgba(0, 0, 0, 0.02) 10px,
                rgba(0, 0, 0, 0.02) 20px
            );
            position: relative;
        }
        
        .nm-plugin-item.hidden::before {
            content: '🙈 已隐藏';
            position: absolute;
            top: 4px;
            right: 4px;
            background: rgba(200, 50, 50, 0.8);
            color: #fff;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            z-index: 10;
        }
        
        .nm-plugin-item.hidden:hover::after {
            content: '此插件已隐藏，点击右键可取消隐藏';
            position: absolute;
            bottom: -30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(50, 50, 50, 0.95);
            color: #fff;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 11px;
            white-space: nowrap;
            z-index: 1000;
            pointer-events: none;
        }
        
        .nm-plugin-item.duplicate::after {
            content: '🔄';
            margin-left: 6px;
            font-size: 12px;
            opacity: 0.7;
        }
        
        .nm-plugin-item.no-nodes {
            opacity: 0.5;
        }
        
        .nm-plugin-item.no-nodes .nm-folder-count {
            color: #666;
        }
        
        .nm-plugin-item.dragging {
            opacity: 0.5;
        }
        
        .nm-plugin-item.drag-over-top {
            border-top: 2px solid #007acc;
        }
        
        .nm-plugin-item.drag-over-bottom {
            border-bottom: 2px solid #007acc;
        }
        
        /* 插件展开按钮 */
        .nm-plugin-expand {
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 6px;
            cursor: pointer;
            transition: transform 0.2s ease;
            flex-shrink: 0;
            font-size: 10px;
        }
        
        .nm-plugin-expand.expanded {
            transform: rotate(90deg);
        }
        
        .nm-plugin-expand:hover {
            color: #007acc;
        }
        
        /* ========== 分类项 ========== */
        .nm-plugin-categories {
            margin-top: 2px;
        }
        
        .nm-category-item {
            display: flex;
            align-items: center;
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid transparent;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.15s ease;
            user-select: none;
            margin-bottom: 2px;
        }
        
        .nm-category-item:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: var(--border-color, #555);
        }
        
        .nm-category-item.active {
            background: rgba(0, 122, 204, 0.15);
            border-color: #007acc;
        }
        
        .nm-category-expand {
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 6px;
            cursor: pointer;
            transition: transform 0.2s ease;
            flex-shrink: 0;
            font-size: 9px;
        }
        
        .nm-category-expand.expanded {
            transform: rotate(90deg);
        }
        
        .nm-category-expand:hover {
            color: #007acc;
        }
        
        .nm-category-icon {
            width: 16px;
            height: 16px;
            margin-right: 6px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }
        
        .nm-category-name {
            flex: 1;
            font-size: 13px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .nm-category-count {
            font-size: 11px;
            color: var(--descrip-text, #999);
            margin-left: 8px;
            flex-shrink: 0;
        }
        
        /* ========== 已隐藏插件卡片 ========== */
        .nm-hidden-plugin-card {
            background: var(--comfy-input-bg, #2a2a2a);
            border: 1px solid var(--border-color, #444);
            border-radius: 6px;
            padding: 10px 12px;
            margin-bottom: 8px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            transition: all 0.2s ease;
            cursor: pointer;
            user-select: none;
        }
        
        .nm-hidden-plugin-card:hover {
            border-color: var(--border-color-focus, #666);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        .nm-hidden-plugin-card.selected {
            background: rgba(0, 123, 255, 0.15);
            border-color: var(--primary-color, #007bff);
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.3);
        }
        
        .nm-hidden-plugin-card.selected:hover {
            background: rgba(0, 123, 255, 0.2);
            border-color: var(--primary-color, #007bff);
        }
        
        .nm-hidden-plugin-header {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .nm-hidden-plugin-icon {
            font-size: 20px;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        
        .nm-hidden-plugin-info {
            flex: 1;
            min-width: 0;
        }
        
        .nm-hidden-plugin-name {
            font-size: 13px;
            font-weight: 500;
            color: var(--input-text, #ffffff);
            margin-bottom: 2px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .nm-hidden-plugin-count {
            font-size: 11px;
            color: var(--descrip-text, #999);
        }
        
        .nm-hidden-plugin-actions {
            display: flex;
            gap: 6px;
            justify-content: flex-end;
        }
        
        .nm-hidden-plugin-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 12px;
            background: var(--comfy-input-bg, #333);
            border: 1px solid var(--border-color, #555);
            border-radius: 4px;
            color: var(--input-text, #ffffff);
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .nm-hidden-plugin-btn:hover {
            background: var(--comfy-input-bg-hover, #444);
            border-color: var(--border-color-focus, #666);
        }
        
        .nm-hidden-plugin-btn .nm-btn-icon {
            font-size: 12px;
        }
        
        /* ========== 节点预览浮层（Grid布局） ========== */
        .nm-node-preview-overlay {
            position: fixed;
            z-index: 10001; /* 高于 Modal (10000)，确保预览能显示在 Modal 上方 */
            background: var(--comfy-menu-bg, #1e1e1e);
            border: 1px solid var(--descrip-text, #999);
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
            pointer-events: none;
            opacity: 0;
            transform: translateY(8px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            display: none;
            min-width: 300px;
            max-width: 95vw; /* 最大宽度为视口的95%，给更多空间 */
            width: max-content;
            max-height: 80vh; /* 最大高度为视口的80% */
            overflow-y: auto; /* 超长内容可滚动 */
            overflow-x: hidden;
            padding-bottom: 10px;
        }
        
        /* 预览框滚动条样式 */
        .nm-node-preview-overlay::-webkit-scrollbar {
            width: 8px;
        }
        .nm-node-preview-overlay::-webkit-scrollbar-track {
            background: var(--comfy-input-bg, #2a2a2a);
            border-radius: 4px;
        }
        .nm-node-preview-overlay::-webkit-scrollbar-thumb {
            background: var(--border-color, #555);
            border-radius: 4px;
        }
        .nm-node-preview-overlay::-webkit-scrollbar-thumb:hover {
            background: var(--descrip-text, #777);
        }
        
        /* 节点预览容器 - 不加padding，让行自己控制 */
        .nm-node-preview-container {
            display: grid;
            grid-column-gap: 0;
            width: max-content;
            min-width: 300px;
            max-width: 95vw;
            font-size: 12px;
        }
        
        /* 节点头部 */
        .nm-preview-header {
            line-height: 1;
            padding: 12px 13px;
            margin-bottom: 0;
            border-bottom: 1px solid var(--border-color, #444);
            font-size: 15px;
            font-weight: 500;
            color: var(--input-text, #fff);
            text-wrap: nowrap;
            overflow: hidden;
            display: flex;
            align-items: center;
        }
        
        .nm-preview-header-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: grey;
            float: inline-start;
            margin-right: 6px;
            flex-shrink: 0;
        }
        
        /* Grid行布局 - 插槽行 */
        .nm-preview-row {
            display: grid;
            grid-template-columns: auto 5px auto 1fr auto 5px auto;
            /* [左控件] [5px] [左文字] [自动填充] [右文字] [5px] [右控件] */
            align-items: center;
            padding: 5px;
        }
        
        /* 左边文字列 - 左对齐 */
        .nm-preview-row > .nm-preview-col:nth-child(3) {
            justify-content: flex-start;
            text-align: left;
        }
        
        /* 右边文字列 - 右对齐 */
        .nm-preview-row > .nm-preview-col:nth-child(5) {
            justify-content: flex-end;
            text-align: right;
        }
        
        /* STRING类型布局（在控件框内） */
        .nm-preview-row-string {
            grid-template-columns: auto 5px auto 1fr auto 5px auto;
            /* [左箭头] [5px] [左文字] [自动填充] [右文字/值] [5px] [右箭头] */
            padding: 5px;
        }
        
        /* STRING类型 - 左边文字列左对齐 */
        .nm-preview-row-string > .nm-preview-col:nth-child(3) {
            justify-content: flex-start;
            text-align: left;
        }
        
        /* STRING类型 - 右边文字列右对齐（文本框区域） */
        .nm-preview-row-string > .nm-preview-col:nth-child(5) {
            justify-content: flex-end;
            text-align: right;
            white-space: normal !important; /* 文本框允许换行 */
        }
        
        /* 单行文本框 - 不换行，让预览框变宽 */
        .nm-preview-text-single {
            white-space: nowrap !important;     /* 不换行！优先级最高 */
            overflow: visible;       /* 可见 */
            line-height: 1.2;        /* 紧凑 */
            min-height: 1.2em;       /* 最小高度 */
            display: block;          /* 块级显示 */
        }
        
        /* 多行文本框 - 保留换行，完整显示，最小高度为单行的3倍 */
        .nm-preview-text-multi {
            white-space: pre-wrap !important;  /* 覆盖父级的nowrap！ */
            word-wrap: break-word;
            word-break: break-word;
            min-width: 0;
            max-width: 100%;
            line-height: 1.2;        /* 紧凑 */
            min-height: 3.6em;       /* 最小高度 = 1.2 * 3 */
            max-height: 200px;       /* 限制最大高度，防止过长 */
            overflow-y: auto;        /* 超长内容可滚动 */
            display: block;          /* 确保占据整行 */
            padding: 4px 0;          /* 内边距 */
        }
        
        /* 多行文本框滚动条样式 */
        .nm-preview-text-multi::-webkit-scrollbar {
            width: 6px;
        }
        .nm-preview-text-multi::-webkit-scrollbar-track {
            background: var(--comfy-input-bg, #2a2a2a);
            border-radius: 3px;
        }
        .nm-preview-text-multi::-webkit-scrollbar-thumb {
            background: var(--border-color, #555);
            border-radius: 3px;
        }
        .nm-preview-text-multi::-webkit-scrollbar-thumb:hover {
            background: var(--descrip-text, #777);
        }
        
        /* BOOLEAN类型布局（在控件框内） */
        .nm-preview-row-boolean {
            grid-template-columns: auto 5px auto 1fr auto 5px auto;
            /* [空] [5px] [左文字] [自动填充] [空] [5px] [右圆圈] */
            padding: 5px;
        }
        
        /* BOOLEAN类型 - 左边文字列左对齐 */
        .nm-preview-row-boolean > .nm-preview-col:nth-child(3) {
            justify-content: flex-start;
            text-align: left;
        }
        
        /* BOOLEAN类型 - 右边圆圈列右对齐 */
        .nm-preview-row-boolean > .nm-preview-col:nth-child(7) {
            justify-content: flex-end;
            text-align: right;
        }
        
        /* 布尔开关 - 简单灰色圆圈（模拟ComfyUI原生） */
        .nm-preview-toggle {
            display: inline-block;
            width: 1em;           /* 和文字一样高 */
            height: 1em;          /* 和文字一样高 */
            border-radius: 50%;   /* 圆形 */
            background-color: #808080; /* 灰色 */
            vertical-align: middle;
        }
        
        /* Grid列 */
        .nm-preview-col {
            display: flex;
            align-items: center;
            font-size: 13px;
            color: var(--descrip-text, #ccc);
            white-space: nowrap; /* 强制不换行 */
        }
        
        /* 第1列 - 左侧控件（圆点/箭头） */
        .nm-preview-row > .nm-preview-col:nth-child(1) {
            justify-content: flex-start;
        }
        
        /* 第2列 - 5px间距（空白） */
        .nm-preview-row > .nm-preview-col:nth-child(2) {
            /* 空白占位 */
        }
        
        /* 第3列 - 左侧文字（左对齐） */
        .nm-preview-row > .nm-preview-col:nth-child(3) {
            justify-content: flex-start;
            text-align: left;
        }
        
        /* 第4列 - 15px间距（空白） */
        .nm-preview-row > .nm-preview-col:nth-child(4) {
            /* 空白占位 */
        }
        
        /* 第5列 - 右侧文字（右对齐） */
        .nm-preview-row > .nm-preview-col:nth-child(5) {
            justify-content: flex-end;
            text-align: right;
        }
        
        /* 第6列 - 5px间距（空白） */
        .nm-preview-row > .nm-preview-col:nth-child(6) {
            /* 空白占位 */
        }
        
        /* 第7列 - 右侧控件（圆点/箭头） */
        .nm-preview-row > .nm-preview-col:nth-child(7) {
            justify-content: flex-end;
        }
        
        .nm-preview-value {
            color: var(--input-text, #ddd);
            font-weight: 400;
            line-height: 1.4;
            white-space: nowrap; /* 不换行 */
        }
        
        .nm-preview-arrow {
            color: var(--fg-color, #ccc);
            font-size: 12px;
            padding: 0 2px;
        }
        
        /* 控件行样式 */
        .nm-preview-widget {
            background: var(--bg-color, #1e1e1e);
            border: 2px solid var(--border-color, #444);
            margin: 5px 15px 0 15px;
            border-radius: 10px;
            line-height: 1.3;  /* 紧凑，只比文字高一点点 */
        }
        
        /* 圆点 */
        .nm-preview-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: grey;
            flex-shrink: 0;
        }
        
        /* 描述 */
        .nm-preview-description {
            margin: 10px;
            padding: 6px;
            background: var(--border-color, #444);
            border-radius: 5px;
            font-style: italic;
            font-weight: 500;
            font-size: 0.9rem;
            line-height: 1.4;
            color: var(--descrip-text, #aaa);
        }
        
        /* ==================== 搜索弹窗样式 ==================== */
        
        /* 蒙层 */
        .nm-search-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 100000;
            display: none;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        
        .nm-search-overlay.show {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .nm-search-overlay.visible {
            opacity: 1;
        }
        
        /* 搜索弹窗容器 */
        .nm-search-modal {
            background: var(--comfy-menu-bg, #1e1e1e);
            border-radius: 12px;
            box-shadow: 0 12px 48px rgba(0, 0, 0, 0.8);
            width: 90vw;
            max-width: 1400px;
            height: 80vh;
            max-height: 900px;
            display: flex;
            flex-direction: column;
            transform: scale(0.95) translateY(20px);
            transition: transform 0.2s ease;
            overflow: hidden;
        }
        
        .nm-search-overlay.visible .nm-search-modal {
            transform: scale(1) translateY(0);
        }
        
        /* 搜索头部 */
        .nm-search-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border-color, #444);
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        /* 搜索输入框 */
        .nm-search-input {
            flex: 1;
            background: var(--comfy-input-bg, #2a2a2a);
            border: 2px solid var(--border-color, #555);
            color: var(--input-text, #fff);
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 16px;
            outline: none;
            transition: border-color 0.2s;
        }
        
        .nm-search-input:focus {
            border-color: var(--primary-color, #4a9eff);
        }
        
        .nm-search-input::placeholder {
            color: var(--descrip-text, #999);
        }
        
        /* 清空按钮 */
        .nm-search-clear-btn {
            background: var(--comfy-input-bg, #2a2a2a);
            border: 2px solid var(--border-color, #555);
            color: var(--input-text, #fff);
            padding: 10px 18px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
            white-space: nowrap;
        }
        
        .nm-search-clear-btn:hover {
            background: var(--border-color, #444);
            border-color: var(--descrip-text, #777);
        }
        
        /* 搜索结果区域 */
        .nm-search-content {
            flex: 1;
            display: flex;
            overflow: hidden;
        }
        
        /* 搜索结果节点池 */
        .nm-search-results {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
        }
        
        /* 搜索结果网格（3列） */
        .nm-search-results-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
        }
        
        /* 搜索结果提示 */
        .nm-search-info {
            padding: 20px;
            text-align: center;
            color: var(--descrip-text, #999);
            font-size: 14px;
        }
        
        /* 搜索结果计数 */
        .nm-search-count {
            padding: 12px 20px;
            color: var(--descrip-text, #999);
            font-size: 13px;
            border-bottom: 1px solid var(--border-color, #444);
        }
        
        /* 搜索结果滚动条 */
        .nm-search-results::-webkit-scrollbar {
            width: 18px;  /* 加宽滚动条 */
        }
        .nm-search-results::-webkit-scrollbar-track {
            background: var(--comfy-input-bg, #2a2a2a);
        }
        .nm-search-results::-webkit-scrollbar-thumb {
            background: var(--border-color, #555);
            border-radius: 9px;
            border: 4px solid var(--comfy-input-bg, #2a2a2a);
        }
        .nm-search-results::-webkit-scrollbar-thumb:hover {
            background: #777;
            border-width: 3px;
        }
        .nm-search-results::-webkit-scrollbar-thumb:active {
            background: #888;
            border-width: 2px;
        }
        
        /* ========== 侧边栏搜索框样式 ========== */
        
        /* 节点池header布局调整 - 简化版（只有搜索框） */
        .nm-node-pool-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color, #444);
            background: var(--comfy-menu-bg, #1e1e1e);
        }
        
        /* 返回按钮 */
        .nm-back-btn {
            flex-shrink: 0;
        }
        
        /* 搜索框容器 */
        .nm-search-box {
            position: relative;
            width: 100%;
            display: flex;
            align-items: center;
            flex: 1;
            gap: 8px;
        }
        
        /* 搜索模式切换按钮组 */
        .nm-search-mode-toggle {
            display: flex;
            gap: 4px;
            flex-shrink: 0;
            background: var(--comfy-input-bg, #2a2a2a);
            border-radius: 4px;
            padding: 2px;
        }
        
        .nm-search-mode-btn {
            padding: 4px 10px;
            font-size: 12px;
            border: none;
            border-radius: 3px;
            background: transparent;
            color: var(--descrip-text, #999);
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
        }
        
        .nm-search-mode-btn:hover {
            background: var(--comfy-menu-bg, #1e1e1e);
            color: var(--primary-text, #e0e0e0);
        }
        
        .nm-search-mode-btn.active {
            background: var(--primary-color, #4a9eff);
            color: white;
        }
        
        .nm-search-mode-btn.active:hover {
            background: var(--primary-color-hover, #6ab0ff);
        }
        
        /* 标签容器 - 类似输入框的外观 */
        .nm-search-tags-wrapper {
            flex: 1;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 4px;
            padding: 4px 36px 4px 8px;
            background: var(--comfy-input-bg, #2a2a2a);
            border: 2px solid var(--border-color, #555);
            border-radius: 8px;
            min-height: 36px;
            transition: all 0.2s;
            cursor: text;
        }
        
        .nm-search-tags-wrapper:focus-within {
            border-color: var(--primary-color, #4a9eff);
            background: var(--comfy-menu-bg, #2d2d2d);
        }
        
        /* 标签样式 - 淡色背景 + 白色描边 */
        .nm-search-tag {
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            background: rgba(102, 126, 234, 0.15);
            border: 1.5px solid rgba(255, 255, 255, 0.6);
            border-radius: 12px;
            color: var(--input-text, #fff);
            font-size: 12px;
            cursor: move;
            user-select: none;
            transition: all 0.2s;
            white-space: nowrap;
        }
        
        .nm-search-tag:hover {
            background: rgba(102, 126, 234, 0.25);
            border-color: rgba(255, 255, 255, 0.8);
            transform: translateY(-1px);
        }
        
        .nm-search-tag.dragging {
            opacity: 0.5;
            cursor: grabbing;
        }
        
        .nm-search-tag.drag-over {
            transform: translateX(4px);
            background: rgba(102, 126, 234, 0.3);
        }
        
        /* 标签颜色变体 - 淡色系 */
        .nm-search-tag.color-0 { 
            background: rgba(102, 126, 234, 0.15); 
            border-color: rgba(102, 126, 234, 0.6);
        }
        .nm-search-tag.color-1 { 
            background: rgba(240, 147, 251, 0.15); 
            border-color: rgba(240, 147, 251, 0.6);
        }
        .nm-search-tag.color-2 { 
            background: rgba(79, 172, 254, 0.15); 
            border-color: rgba(79, 172, 254, 0.6);
        }
        .nm-search-tag.color-3 { 
            background: rgba(67, 233, 123, 0.15); 
            border-color: rgba(67, 233, 123, 0.6);
        }
        .nm-search-tag.color-4 { 
            background: rgba(250, 112, 154, 0.15); 
            border-color: rgba(250, 112, 154, 0.6);
        }
        
        /* 标签悬停时增强边框 */
        .nm-search-tag.color-0:hover { border-color: rgba(102, 126, 234, 0.9); }
        .nm-search-tag.color-1:hover { border-color: rgba(240, 147, 251, 0.9); }
        .nm-search-tag.color-2:hover { border-color: rgba(79, 172, 254, 0.9); }
        .nm-search-tag.color-3:hover { border-color: rgba(67, 233, 123, 0.9); }
        .nm-search-tag.color-4:hover { border-color: rgba(250, 112, 154, 0.9); }
        
        /* 标签文字 - 可点击编辑 */
        .nm-search-tag-text {
            cursor: text;
            padding: 0 4px;
        }
        
        .nm-search-tag-text:hover {
            opacity: 0.9;
        }
        
        /* 标签删除按钮 */
        .nm-search-tag-remove {
            margin-left: 4px;
            cursor: pointer;
            opacity: 0.7;
            font-size: 14px;
            padding: 0 2px;
            font-weight: bold;
            transition: opacity 0.2s;
        }
        
        .nm-search-tag-remove:hover {
            opacity: 1;
        }
        
        /* 标签编辑输入框 */
        .nm-search-tag-edit-input {
            border: none;
            outline: none;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            font-size: 12px;
            padding: 2px 4px;
            border-radius: 4px;
            min-width: 60px;
        }
        
        /* 侧边栏搜索输入框 */
        #nm-search-input {
            flex: 1;
            min-width: 120px;
            padding: 4px;
            background: transparent;
            border: none;
            color: var(--input-text, #fff);
            font-size: 13px;
            outline: none;
        }
        
        #nm-search-input::placeholder {
            color: var(--descrip-text, #999);
        }
        
        /* 清空按钮 */
        #nm-search-clear-btn {
            position: absolute;
            right: 6px;
            top: 50%;
            transform: translateY(-50%);
            background: var(--border-color, #555);
            border: none;
            color: var(--input-text, #fff);
            width: 24px;
            height: 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        
        #nm-search-clear-btn:hover {
            background: var(--descrip-text, #777);
            transform: translateY(-50%) scale(1.1);
        }
        
        /* ==================== 搜索建议样式 ==================== */
        
        /* 搜索建议容器 */
        .nm-search-suggestions {
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            right: 0;
            background: var(--comfy-input-bg, #2a2a2a);
            border: 2px solid var(--border-color, #555);
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            z-index: 9999;
            max-height: 400px;
            overflow-y: auto;
            animation: nm-suggestions-fadein 0.2s ease-out;
        }
        
        @keyframes nm-suggestions-fadein {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        /* 搜索建议头部 */
        .nm-search-suggestions-header {
            padding: 10px 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 12px;
            font-weight: 600;
            border-bottom: 2px solid var(--border-color, #444);
            position: sticky;
            top: 0;
            z-index: 1;
        }
        
        /* 搜索建议项 */
        .nm-search-suggestion-item {
            padding: 12px;
            cursor: pointer;
            transition: all 0.2s;
            border-bottom: 1px solid var(--border-color, #444);
        }
        
        .nm-search-suggestion-item:last-child {
            border-bottom: none;
        }
        
        .nm-search-suggestion-item:hover,
        .nm-search-suggestion-item.selected {
            background: var(--comfy-menu-bg, #333);
            border-left: 4px solid #667eea;
            padding-left: 8px;
        }
        
        /* 建议项主文本 */
        .nm-suggestion-main {
            font-size: 14px;
            font-weight: 500;
            color: var(--input-text, #fff);
            margin-bottom: 4px;
        }
        
        .nm-suggestion-main mark {
            background: #ffd700;
            color: #000;
            padding: 2px 4px;
            border-radius: 3px;
            font-weight: 600;
        }
        
        /* 建议项元信息 */
        .nm-suggestion-meta {
            font-size: 11px;
            color: var(--descrip-text, #888);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* 搜索建议滚动条 */
        .nm-search-suggestions::-webkit-scrollbar {
            width: 8px;
        }
        
        .nm-search-suggestions::-webkit-scrollbar-track {
            background: var(--comfy-menu-bg, #1a1a1a);
            border-radius: 4px;
        }
        
        .nm-search-suggestions::-webkit-scrollbar-thumb {
            background: var(--descrip-text, #666);
            border-radius: 4px;
        }
        
        .nm-search-suggestions::-webkit-scrollbar-thumb:hover {
            background: var(--input-text, #888);
        }
        
        /* ==================== 搜索结果容器 ==================== */
        
        /* 搜索结果容器 */
        .nm-search-results-container {
            padding: 16px;
            overflow-y: auto;
            position: relative;
            z-index: 200;
        }
        
        /* 搜索结果容器滚动条 */
        .nm-search-results-container::-webkit-scrollbar {
            width: 18px;
        }
        .nm-search-results-container::-webkit-scrollbar-track {
            background: var(--comfy-menu-bg, #1e1e1e);
        }
        .nm-search-results-container::-webkit-scrollbar-thumb {
            background: var(--border-color, #555);
            border-radius: 9px;
            border: 4px solid var(--comfy-menu-bg, #1e1e1e);
        }
        .nm-search-results-container::-webkit-scrollbar-thumb:hover {
            background: #777;
            border-width: 3px;
        }
        .nm-search-results-container::-webkit-scrollbar-thumb:active {
            background: #888;
            border-width: 2px;
        }
        
        /* 搜索结果section */
        .nm-search-section {
            margin-bottom: 24px;
        }
        
        .nm-search-section:last-child {
            margin-bottom: 0;
        }
        
        /* 搜索结果section标题 */
        .nm-search-section-header {
            font-size: 14px;
            font-weight: 600;
            color: var(--input-text, #fff);
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid var(--border-color, #444);
        }
        
        /* 搜索文件夹网格 */
        .nm-search-folder-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 12px;
        }
        
        /* 搜索文件夹卡片 */
        .nm-search-folder-card {
            background: var(--comfy-input-bg, #2a2a2a);
            border: 2px solid var(--border-color, #555);
            border-radius: 8px;
            padding: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: all 0.2s;
        }
        
        .nm-search-folder-card:hover {
            background: var(--comfy-menu-bg, #333);
            border-color: var(--primary-color, #4a9eff);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 122, 204, 0.2);
        }
        
        .nm-search-folder-icon {
            font-size: 24px;
            flex-shrink: 0;
        }
        
        .nm-search-folder-info {
            flex: 1;
            min-width: 0;
        }
        
        .nm-search-folder-name {
            font-size: 14px;
            font-weight: 500;
            color: var(--input-text, #fff);
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .nm-search-folder-count {
            font-size: 12px;
            color: var(--descrip-text, #999);
        }
        
        .nm-search-folder-arrow {
            font-size: 18px;
            color: var(--descrip-text, #777);
            flex-shrink: 0;
            transition: all 0.2s;
        }
        
        .nm-search-folder-card:hover .nm-search-folder-arrow {
            color: var(--primary-color, #4a9eff);
            transform: translateX(4px);
        }
        
        /* ==================== Modal 搜索窗口 ==================== */
        .nm-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            opacity: 0;
            transition: opacity 200ms ease, background 200ms ease;
        }
        
        .nm-modal-overlay.dragging {
            background: rgba(0, 0, 0, 0.15);
            pointer-events: none;
        }
        
        .nm-modal-overlay.dragging .nm-modal-content {
            pointer-events: auto;
        }
        
        .nm-modal-overlay.show {
            opacity: 1;
        }
        
        .nm-modal-content {
            background: var(--bg-color);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            width: min(85vw, 1400px);
            height: min(85vh, 900px);
            max-width: 90vw;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            position: relative;
            transform: scale(0.9);
            opacity: 0;
            transition: transform 200ms ease, opacity 200ms ease, width 300ms ease, height 300ms ease;
        }
        
        .nm-modal-overlay.show .nm-modal-content {
            transform: scale(1);
            opacity: 1;
        }
        
        /* 左右布局样式 */
        .nm-modal-overlay.split-layout {
            justify-content: flex-start;
            background: rgba(0, 0, 0, 0.75);
        }
        
        .nm-modal-content.split-layout {
            width: 66.666vw;
            max-width: none;
            height: 100vh;
            max-height: 100vh;
            border-radius: 0;
            position: relative;
        }
        
        /* 拖动手柄 */
        .nm-resize-handle {
            position: absolute;
            right: 18px;  /* 紧贴滚动条左侧 */
            top: 0;
            bottom: 0;
            width: 10px;  /* 稍微加宽，更容易触发 */
            cursor: ew-resize;
            background: transparent;
            z-index: 250;  /* 提高z-index，确保可以点击 */
            transition: background 0.2s;
            pointer-events: auto;  /* 确保可以接收鼠标事件 */
        }
        
        .nm-resize-handle::before {
            content: '';
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 2px;
            height: 40px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 1px;
            transition: all 0.2s;
        }
        
        .nm-resize-handle:hover {
            background: rgba(0, 122, 204, 0.15);
        }
        
        .nm-resize-handle:hover::before {
            background: rgba(0, 122, 204, 0.5);
            height: 60px;
            width: 3px;
        }
        
        .nm-resize-handle:active {
            background: rgba(0, 122, 204, 0.25);
        }
        
        .nm-resize-handle:active::before {
            background: rgba(0, 122, 204, 0.7);
        }
        
        .nm-modal-header {
            position: absolute;
            top: 12px;
            right: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            z-index: 10;
        }
        
        /* 分隔符 */
        .nm-modal-separator {
            color: rgba(255, 255, 255, 0.2);
            font-size: 16px;
            margin: 0 12px;
            user-select: none;
        }
        
        /* 工具按钮（检测缺失、URL安装） */
        .nm-modal-tool-btn {
            padding: 6px 12px;
            border-radius: 6px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: var(--descrip-text, #aaa);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            transition: all 0.2s ease;
            opacity: 0.7;
            white-space: nowrap;
        }
        
        .nm-modal-tool-btn .nm-btn-icon {
            font-size: 14px;
        }
        
        .nm-modal-tool-btn .nm-btn-text {
            font-size: 13px;
        }
        
        .nm-modal-tool-btn:hover {
            background: var(--comfy-input-bg);
            border-color: var(--border-color);
            opacity: 1;
            transform: scale(1.05);
        }
        
        .nm-modal-toggle {
            padding: 6px 12px;
            border-radius: 6px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: var(--descrip-text, #aaa);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            transition: all 0.2s ease;
            opacity: 0.7;
            white-space: nowrap;
        }
        
        .nm-modal-toggle .nm-btn-icon {
            font-size: 14px;
        }
        
        .nm-modal-toggle .nm-btn-text {
            font-size: 13px;
        }
        
        .nm-modal-toggle:hover {
            background: var(--comfy-input-bg);
            border-color: var(--border-color);
            opacity: 1;
            transform: scale(1.05);
        }
        
        .nm-modal-toggle.active {
            background: rgba(74, 158, 255, 0.15);
            border-color: rgba(74, 158, 255, 0.4);
            color: var(--primary-color, #4a9eff);
            opacity: 1;
        }
        
        .nm-modal-close {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: var(--descrip-text, #aaa);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            transition: all 0.2s ease;
            opacity: 0.7;
        }
        
        .nm-modal-close:hover {
            background: rgba(255, 68, 68, 0.15);
            border-color: rgba(255, 68, 68, 0.4);
            color: #ff4444;
            opacity: 1;
            transform: scale(1.05);
        }
        
        .nm-modal-manager {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        /* 响应式调整 */
        @media (max-width: 1200px) {
            .nm-node-pool-header {
                grid-template-columns: 1fr;
                gap: 8px;
            }
            
            .nm-node-pool-header-left,
            .nm-node-pool-header-center,
            .nm-node-pool-header-right {
                width: 100%;
            }
            
            .nm-node-pool-header-center {
                max-width: 100%;
            }
            
            .nm-search-folder-grid {
                grid-template-columns: 1fr;
            }
        }
        
        /* ========== 编辑模式相关 ========== */
        
        /* 布局切换按钮 */
        .nm-modal-layout {
            padding: 6px 12px;
            border-radius: 6px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: var(--descrip-text, #aaa);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            transition: all 0.2s ease;
            opacity: 0.7;
            white-space: nowrap;
        }
        
        .nm-modal-layout .nm-btn-icon {
            font-size: 14px;
        }
        
        .nm-modal-layout .nm-btn-text {
            font-size: 13px;
        }
        
        .nm-modal-layout:hover {
            background: var(--comfy-input-bg);
            border-color: var(--border-color);
            opacity: 1;
            transform: scale(1.05);
        }
        
        .nm-modal-layout.active {
            background: rgba(0, 200, 100, 0.15);
            border-color: rgba(0, 200, 100, 0.4);
            color: #00c864;
            opacity: 1;
        }
        
        /* 记忆模式按钮 */
        .nm-modal-remember {
            padding: 6px 12px;
            border-radius: 6px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: var(--descrip-text, #aaa);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            transition: all 0.2s ease;
            opacity: 0.7;
            white-space: nowrap;
        }
        
        .nm-modal-remember .nm-btn-icon {
            font-size: 14px;
        }
        
        .nm-modal-remember .nm-btn-text {
            font-size: 13px;
        }
        
        .nm-modal-remember:hover {
            background: var(--comfy-input-bg);
            border-color: var(--border-color);
            opacity: 1;
            transform: scale(1.05);
        }
        
        .nm-modal-remember.active {
            background: rgba(138, 43, 226, 0.15);
            border-color: rgba(138, 43, 226, 0.4);
            color: #9370db;
            opacity: 1;
        }
        
        /* 编辑模式按钮 */
        .nm-modal-edit-mode {
            padding: 6px 12px;
            border-radius: 6px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: var(--descrip-text, #aaa);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            transition: all 0.2s ease;
            opacity: 0.7;
            white-space: nowrap;
        }
        
        .nm-modal-edit-mode .nm-btn-icon {
            font-size: 14px;
        }
        
        .nm-modal-edit-mode .nm-btn-text {
            font-size: 13px;
        }
        
        .nm-modal-edit-mode:hover {
            background: var(--comfy-input-bg);
            border-color: var(--border-color);
            opacity: 1;
            transform: scale(1.05);
        }
        
        .nm-modal-edit-mode.active {
            background: rgba(255, 165, 0, 0.15);
            border-color: rgba(255, 165, 0, 0.4);
            color: #ffa500;
            opacity: 1;
        }
        
        /* 批量操作按钮 */
        .nm-bulk-btn {
            padding: 6px 12px;
            background: var(--comfy-input-bg, #3d3d3d);
            border: 1px solid var(--border-color, #555);
            border-radius: 4px;
            color: var(--input-text, #ddd);
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        }
        
        .nm-bulk-btn:hover {
            background: #007acc;
            border-color: #007acc;
            color: white;
        }
        
        .nm-bulk-btn-danger {
            border-color: rgba(220, 53, 69, 0.5);
        }
        
        .nm-bulk-btn-danger:hover {
            background: #dc3545;
            border-color: #dc3545;
            color: white;
        }
        
        /* ========== 互联网模式：筛选器 ========== */
        .nm-internet-filter {
            display: none;
            align-items: center;
            gap: 8px;
            margin-right: 8px;
        }
        
        .nm-filter-toggle-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border: 1px solid var(--border-color, #444);
            border-radius: 6px;
            background: var(--comfy-input-bg, #2a2a2a);
            color: var(--input-text, #ffffff);
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
            position: relative;
        }
        
        .nm-filter-toggle-btn:hover {
            background: var(--comfy-menu-bg, #3a3a3a);
            border-color: #007acc;
        }
        
        .nm-filter-toggle-btn.active {
            background: #007acc;
            border-color: #007acc;
            color: white;
        }
        
        .nm-filter-indicator {
            color: #ff6b6b;
            font-size: 8px;
            line-height: 1;
            margin-left: -2px;
        }
        
        .nm-refresh-stars-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border: 1px solid var(--border-color, #444);
            border-radius: 6px;
            background: var(--comfy-input-bg, #2a2a2a);
            color: var(--input-text, #ffffff);
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
            margin-left: 8px;
        }
        
        .nm-refresh-stars-btn:hover {
            background: var(--comfy-menu-bg, #3a3a3a);
            border-color: #ffd700;
        }
        
        .nm-refresh-stars-btn:active {
            transform: scale(0.95);
        }
        
        .nm-filter-menu {
            position: fixed;
            z-index: 10002;
            background: var(--comfy-menu-bg, #2a2a2a);
            border: 1px solid var(--border-color, #444);
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            padding: 12px;
            min-width: 200px;
            display: none;
        }
        
        .nm-filter-section {
            margin-bottom: 8px;
        }
        
        .nm-filter-label {
            font-size: 13px;
            font-weight: 600;
            color: var(--input-text, #ffffff);
            margin-bottom: 8px;
        }
        
        .nm-filter-option {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 8px;
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.2s;
        }
        
        .nm-filter-option:hover {
            background: var(--comfy-input-bg, #3a3a3a);
        }
        
        .nm-filter-option input[type="radio"] {
            cursor: pointer;
        }
        
        .nm-filter-option span {
            font-size: 13px;
            color: var(--input-text, #cccccc);
        }
        
        .nm-filter-divider {
            height: 1px;
            background: var(--border-color, #444);
            margin: 8px 0;
        }
        
        /* ========== 互联网模式：在线插件卡片 ========== */
        .nm-online-plugin-card {
            background: var(--comfy-input-bg, #2a2a2a);
            border: 1px solid var(--border-color, #444);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            transition: all 0.2s;
        }
        
        .nm-online-plugin-card:hover {
            border-color: #007acc;
            box-shadow: 0 2px 8px rgba(0, 122, 204, 0.2);
        }
        
        .nm-plugin-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
        }
        
        .nm-plugin-card-title {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
        }
        
        .nm-plugin-icon {
            font-size: 20px;
            line-height: 1;
        }
        
        .nm-plugin-name {
            font-size: 15px;
            font-weight: 600;
            color: var(--input-text, #ffffff);
            word-break: break-word;
        }
        
        .nm-plugin-installed-badge {
            display: inline-flex;
            align-items: center;
            padding: 2px 8px;
            background: #28a745;
            color: white;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
            white-space: nowrap;
        }
        
        .nm-plugin-card-actions {
            flex-shrink: 0;
        }
        
        .nm-plugin-btn {
            padding: 6px 14px;
            border: 1px solid var(--border-color, #444);
            border-radius: 6px;
            background: var(--comfy-input-bg, #2a2a2a);
            color: var(--input-text, #ffffff);
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
            white-space: nowrap;
        }
        
        .nm-plugin-btn-install {
            background: #007acc;
            border-color: #007acc;
            color: white;
        }
        
        .nm-plugin-btn-install:hover {
            background: #005a9e;
            border-color: #005a9e;
        }
        
        .nm-plugin-btn-installed {
            background: #28a745;
            border-color: #28a745;
            color: white;
            opacity: 0.7;
            cursor: not-allowed;
        }
        
        .nm-plugin-card-description {
            font-size: 13px;
            color: var(--input-text, #cccccc);
            line-height: 1.5;
            margin-bottom: 12px;
            word-break: break-word;
        }
        
        .nm-plugin-card-footer {
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
        }
        
        .nm-plugin-meta {
            display: inline-flex;
            align-items: center;
            font-size: 12px;
            color: var(--input-text, #999999);
            gap: 4px;
        }
        
        .nm-plugin-stars {
            color: #ffa500 !important;
            font-weight: 600;
        }
        
        .nm-plugin-link {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #007acc;
            text-decoration: none;
            transition: color 0.2s;
        }
        
        .nm-plugin-link:hover {
            color: #005a9e;
            text-decoration: underline;
        }
    `;
    
    document.head.appendChild(style);
}

export { addFolderStyles };

