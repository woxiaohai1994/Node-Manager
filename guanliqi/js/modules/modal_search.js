// js/modules/modal_search.js
// Modal 搜索窗口

import { createManagerInterface, bindEvents, renderFolders, showGitUrlInstallDialog, showMissingNodesDialog } from './folder_ui.js';
import { getConfig, loadConfig, saveConfig } from './folder_operations.js';
import { nodePoolState, initNodePool, showFavoriteNodes, updateSpecialFoldersCount, forceCleanupPreview } from './node_pool.js';

let modalInstance = null;
let autoCloseEnabled = true; // 默认自动关闭
let editModeEnabled = false; // 编辑模式开关
let layoutMode = 'center'; // 布局模式：'center' 或 'split'
let rememberMode = false; // 记忆模式开关
let splitLayoutWidth = 66.666; // 左右布局时左侧宽度百分比

/**
 * 创建 Modal 搜索窗口
 */
function createModalSearchWindow() {
    console.log('[Modal] 创建搜索窗口...');
    
    // 如果已存在，直接返回
    if (modalInstance) {
        console.log('[Modal] 窗口已存在，复用');
        return modalInstance;
    }
    
    // 创建蒙层
    const overlay = document.createElement('div');
    overlay.className = 'nm-modal-overlay';
    
    // 创建 Modal 内容区
    const content = document.createElement('div');
    content.className = 'nm-modal-content';
    
    // 创建头部按钮容器
    const headerButtons = document.createElement('div');
    headerButtons.className = 'nm-modal-header';
    
    // 创建记忆模式按钮
    const rememberBtn = document.createElement('button');
    rememberBtn.className = 'nm-modal-remember';
    const updateRememberBtn = () => {
        if (rememberMode) {
            rememberBtn.innerHTML = '<span class="nm-btn-icon">💾</span><span class="nm-btn-text">记忆</span>';
            rememberBtn.title = '记忆模式：开启\n下次打开时恢复当前设置\n点击切换';
            rememberBtn.classList.add('active');
        } else {
            rememberBtn.innerHTML = '<span class="nm-btn-icon">📄</span><span class="nm-btn-text">记忆</span>';
            rememberBtn.title = '记忆模式：关闭\n每次打开恢复默认设置\n点击切换';
            rememberBtn.classList.remove('active');
        }
    };
    updateRememberBtn();
    
    rememberBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        rememberMode = !rememberMode;
        updateRememberBtn();
        
        // 保存或清除记忆
        if (rememberMode) {
            await saveModalSettings();
            console.log('[Modal] 记忆模式已开启，设置已保存');
        } else {
            await clearModalSettings();
            console.log('[Modal] 记忆模式已关闭');
        }
    });
    
    // 创建布局切换按钮
    const layoutBtn = document.createElement('button');
    layoutBtn.className = 'nm-modal-layout';
    const updateLayoutBtn = () => {
        if (layoutMode === 'split') {
            layoutBtn.innerHTML = '<span class="nm-btn-icon">⬌</span><span class="nm-btn-text">左右</span>';
            layoutBtn.title = '左右布局\n点击切换为居中布局';
            layoutBtn.classList.add('active');
        } else {
            layoutBtn.innerHTML = '<span class="nm-btn-icon">▣</span><span class="nm-btn-text">居中</span>';
            layoutBtn.title = '居中布局\n点击切换为左右布局';
            layoutBtn.classList.remove('active');
        }
    };
    updateLayoutBtn();
    
    layoutBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        layoutMode = layoutMode === 'center' ? 'split' : 'center';
        updateLayoutBtn();
        
        // 切换布局样式
        if (layoutMode === 'split') {
            overlay.classList.add('split-layout');
            content.classList.add('split-layout');
            // 应用保存的宽度
            content.style.width = `${splitLayoutWidth}vw`;
            // 添加拖动手柄
            addResizeHandle(content);
        } else {
            overlay.classList.remove('split-layout');
            content.classList.remove('split-layout');
            content.style.width = '';
            // 移除拖动手柄
            removeResizeHandle(content);
        }
        
        // 通知节点池布局变化
        window.dispatchEvent(new CustomEvent('nm:layoutModeChanged', {
            detail: { mode: layoutMode }
        }));
        
        console.log('[Modal] 布局模式:', layoutMode);
        
        // 如果记忆模式开启，保存设置
        if (rememberMode) {
            await saveModalSettings();
        }
    });
    
    // 创建编辑模式按钮
    const editModeBtn = document.createElement('button');
    editModeBtn.className = 'nm-modal-edit-mode';
    const updateEditModeBtn = () => {
        if (editModeEnabled) {
            editModeBtn.innerHTML = '<span class="nm-btn-icon">✏️</span><span class="nm-btn-text">编辑</span>';
            editModeBtn.title = '编辑模式：开启\n单击选择节点，双击加载到画布\n点击切换为普通模式';
            editModeBtn.classList.add('active');
        } else {
            editModeBtn.innerHTML = '<span class="nm-btn-icon">👆</span><span class="nm-btn-text">普通</span>';
            editModeBtn.title = '普通模式\n点击切换为编辑模式';
            editModeBtn.classList.remove('active');
        }
    };
    updateEditModeBtn();
    
    editModeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        editModeEnabled = !editModeEnabled;
        updateEditModeBtn();
        
        // 通知节点池模式变化
        window.dispatchEvent(new CustomEvent('nm:editModeChanged', {
            detail: { enabled: editModeEnabled }
        }));
        
        console.log('[Modal] 编辑模式:', editModeEnabled ? '开启' : '关闭');
        
        // 如果记忆模式开启，保存设置
        if (rememberMode) {
            await saveModalSettings();
        }
    });
    
    // 创建自动关闭开关按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'nm-modal-toggle';
    const updateToggleBtn = () => {
        if (autoCloseEnabled) {
            toggleBtn.innerHTML = '<span class="nm-btn-icon">📍</span><span class="nm-btn-text">自动关闭</span>';
            toggleBtn.title = '自动关闭：添加节点后关闭窗口\n点击切换为固定模式';
            toggleBtn.classList.remove('active');
        } else {
            toggleBtn.innerHTML = '<span class="nm-btn-icon">📌</span><span class="nm-btn-text">固定</span>';
            toggleBtn.title = '固定模式：窗口保持打开\n点击切换为自动关闭';
            toggleBtn.classList.add('active');
        }
    };
    updateToggleBtn();
    
    toggleBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        autoCloseEnabled = !autoCloseEnabled;
        updateToggleBtn();
        
        // 保存配置
        const config = getConfig();
        config.modal_auto_close_on_add = autoCloseEnabled;
        await saveConfig(config);
        
        console.log('[Modal] 自动关闭模式:', autoCloseEnabled ? '开启' : '关闭');
        
        // 如果记忆模式开启，保存设置
        if (rememberMode) {
            await saveModalSettings();
        }
    });
    
    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'nm-modal-close';
    closeBtn.innerHTML = '✕';
    closeBtn.title = '关闭 (ESC)';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        forceCleanupPreview(); // 立即清理预览
        closeModalSearch();
    });
    
    // 创建分隔符
    const separator = document.createElement('div');
    separator.className = 'nm-modal-separator';
    separator.textContent = '丨';
    
    // 创建检测缺失按钮
    const detectMissingBtn = document.createElement('button');
    detectMissingBtn.className = 'nm-modal-tool-btn';
    detectMissingBtn.innerHTML = '<span class="nm-btn-icon">🔍</span><span class="nm-btn-text">检测缺失</span>';
    detectMissingBtn.title = '检测缺失节点';
    detectMissingBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showMissingNodesDialog();
    });
    
    // 创建URL安装按钮
    const installFromUrlBtn = document.createElement('button');
    installFromUrlBtn.className = 'nm-modal-tool-btn';
    installFromUrlBtn.innerHTML = '<span class="nm-btn-icon">📥</span><span class="nm-btn-text">URL安装</span>';
    installFromUrlBtn.title = '从Git URL安装插件';
    installFromUrlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showGitUrlInstallDialog();
    });
    
    // 添加所有按钮（第一组 - 原有功能）
    headerButtons.appendChild(rememberBtn);
    headerButtons.appendChild(layoutBtn);
    headerButtons.appendChild(editModeBtn);
    headerButtons.appendChild(toggleBtn);
    // 添加分隔符
    headerButtons.appendChild(separator);
    // 添加第二组按钮（新功能）
    headerButtons.appendChild(detectMissingBtn);
    headerButtons.appendChild(installFromUrlBtn);
    // 最后添加关闭按钮
    headerButtons.appendChild(closeBtn);
    
    // 创建管理器容器
    const managerContainer = document.createElement('div');
    managerContainer.className = 'nm-modal-manager';
    
    // 创建管理器界面（复用侧边栏UI，会填充 managerContainer）
    createManagerInterface(managerContainer);
    
    // 组装
    content.appendChild(headerButtons);
    content.appendChild(managerContainer);
    overlay.appendChild(content);
    
    // 点击蒙层关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            forceCleanupPreview(); // 立即清理预览
            closeModalSearch();
        }
    });
    
    // 阻止 Modal 内容区的点击冒泡（防止误触关闭）
    content.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // 绑定事件（搜索、点击、拖拽等）
    bindEvents(managerContainer);
    
    // 监听拖拽事件（优化拖拽体验）
    let isDragging = false;
    
    managerContainer.addEventListener('dragstart', (e) => {
        // 检查是否是节点卡片的拖拽
        if (e.target.closest('.nm-node-card') || e.target.closest('.nm-search-node-card')) {
            console.log('[Modal] 开始拖拽节点，蒙层变半透明');
            isDragging = true;
            overlay.classList.add('dragging');
        }
    }, true); // 使用捕获阶段
    
    managerContainer.addEventListener('dragend', (e) => {
        if (isDragging) {
            console.log('[Modal] 拖拽结束，恢复蒙层');
            isDragging = false;
            overlay.classList.remove('dragging');
            
            // 注意：不在这里关闭 Modal
            // 如果拖拽成功添加了节点，会由 checkAutoCloseOnAdd() 自动关闭
            // 如果拖拽取消了（没有添加节点），则保持 Modal 打开
        }
    }, true); // 使用捕获阶段
    
    // 简单直接的初始化逻辑（异步加载数据）
    setTimeout(async () => {
        // 如果数据未加载，立即加载
        if (!nodePoolState.allNodes || nodePoolState.allNodes.length === 0) {
            console.log('[Modal] 数据未加载，开始加载...');
            await loadConfig();
            await initNodePool();
        } else {
            console.log('[Modal] 数据已存在');
        }
        
        // 渲染文件夹树（传入 Modal 的容器）
        const folderListContainer = managerContainer.querySelector('#nm-folder-list');
        if (folderListContainer) {
            renderFolders(folderListContainer);
        }
        
        // 默认显示"我的分类"（收藏节点）
        showFavoriteNodes();
        
        // 更新特殊文件夹计数
        setTimeout(() => {
            updateSpecialFoldersCount();
        }, 100);
        
        // 自动选中左侧的"收藏"文件夹
        setTimeout(() => {
            const favoritesFolder = managerContainer.querySelector('.nm-special-folder[data-special-id="favorites"]');
            if (favoritesFolder) {
                // 清除其他选中状态
                managerContainer.querySelectorAll('.nm-special-folder, .nm-plugin-item, .nm-folder-item, .nm-category-item').forEach(el => {
                    el.classList.remove('active');
                });
                // 激活收藏文件夹
                favoritesFolder.classList.add('active');
                console.log('[Modal] ✅ 已选中"收藏"文件夹');
            }
        }, 150);
    }, 50);
    
    // 保存实例
    modalInstance = {
        overlay,
        content,
        managerUI: managerContainer,
        updateRememberBtn,
        updateLayoutBtn,
        updateEditModeBtn,
        updateToggleBtn
    };
    
    console.log('[Modal] ✅ 窗口创建完成');
    return modalInstance;
}

/**
 * 添加拖动手柄
 */
function addResizeHandle(content) {
    // 检查是否已存在
    if (content.querySelector('.nm-resize-handle')) {
        return;
    }
    
    const handle = document.createElement('div');
    handle.className = 'nm-resize-handle';
    content.appendChild(handle);
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    const handleMouseDown = (e) => {
        // 只响应鼠标左键
        if (e.button !== 0) return;
        
        // 智能检测：防止在滚动条区域触发resize
        const rect = content.getBoundingClientRect();
        const clickX = e.clientX;
        const distanceFromRight = rect.right - clickX;
        
        // 如果点击位置距离右边缘小于18px，可能是在滚动条上，不响应
        if (distanceFromRight < 18) {
            return;
        }
        
        // 如果距离右边缘大于30px，也不响应（太远了）
        if (distanceFromRight > 30) {
            return;
        }
        
        isResizing = true;
        startX = e.clientX;
        startWidth = content.offsetWidth;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
        e.stopPropagation();
    };
    
    // 添加鼠标移动监听，动态显示resize光标
    const handleMouseMoveOnHandle = (e) => {
        if (isResizing) return; // 正在resize时不处理
        
        const rect = content.getBoundingClientRect();
        const mouseX = e.clientX;
        const distanceFromRight = rect.right - mouseX;
        
        // 在resize区域（18-30px）显示resize光标
        if (distanceFromRight >= 18 && distanceFromRight <= 30) {
            handle.style.cursor = 'ew-resize';
        } else {
            handle.style.cursor = 'default';
        }
    };
    
    handle.addEventListener('mousemove', handleMouseMoveOnHandle);
    
    const handleMouseMove = (e) => {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const newWidth = startWidth + deltaX;
        const vw = window.innerWidth;
        const widthPercent = (newWidth / vw) * 100;
        
        // 限制宽度在 30% 到 90% 之间
        if (widthPercent >= 30 && widthPercent <= 90) {
            content.style.width = `${widthPercent}vw`;
            splitLayoutWidth = widthPercent;
            
            // 通知预览面板更新位置
            window.dispatchEvent(new CustomEvent('nm:splitWidthChanged', {
                detail: { width: widthPercent }
            }));
        }
        
        e.preventDefault();
        e.stopPropagation();
    };
    
    const handleMouseUp = async (e) => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // 如果记忆模式开启，保存宽度
            if (rememberMode) {
                await saveModalSettings();
            }
            
            e.preventDefault();
            e.stopPropagation();
        }
    };
    
    // 只在手柄上监听mousedown和mousemove
    handle.addEventListener('mousedown', handleMouseDown);
    handle.addEventListener('mousemove', handleMouseMoveOnHandle);
    
    // 在document上监听mousemove和mouseup（拖动时需要）
    // 但只有在isResizing=true时才处理
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // 存储事件监听器引用，以便后续清理
    handle._resizeListeners = {
        mousedown: handleMouseDown,
        mousemoveOnHandle: handleMouseMoveOnHandle,
        mousemove: handleMouseMove,
        mouseup: handleMouseUp
    };
}

/**
 * 移除拖动手柄
 */
function removeResizeHandle(content) {
    const handle = content.querySelector('.nm-resize-handle');
    if (handle) {
        // 清理事件监听器
        if (handle._resizeListeners) {
            handle.removeEventListener('mousedown', handle._resizeListeners.mousedown);
            handle.removeEventListener('mousemove', handle._resizeListeners.mousemoveOnHandle);
            document.removeEventListener('mousemove', handle._resizeListeners.mousemove);
            document.removeEventListener('mouseup', handle._resizeListeners.mouseup);
        }
        
        // 移除DOM元素
        if (handle.parentElement) {
            handle.parentElement.removeChild(handle);
        }
    }
}

/**
 * 保存Modal设置到localStorage
 */
async function saveModalSettings() {
    try {
        const settings = {
            layoutMode,
            editModeEnabled,
            autoCloseEnabled,
            splitLayoutWidth,
            rememberMode: true
        };
        localStorage.setItem('nm_modal_settings', JSON.stringify(settings));
        console.log('[Modal] 设置已保存:', settings);
    } catch (error) {
        console.error('[Modal] 保存设置失败:', error);
    }
}

/**
 * 清除Modal设置
 */
async function clearModalSettings() {
    try {
        localStorage.removeItem('nm_modal_settings');
        console.log('[Modal] 设置已清除');
    } catch (error) {
        console.error('[Modal] 清除设置失败:', error);
    }
}

/**
 * 加载Modal设置
 */
function loadModalSettings() {
    try {
        const settingsStr = localStorage.getItem('nm_modal_settings');
        if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            if (settings.rememberMode) {
                layoutMode = settings.layoutMode || 'center';
                editModeEnabled = settings.editModeEnabled || false;
                autoCloseEnabled = settings.autoCloseEnabled !== undefined ? settings.autoCloseEnabled : true;
                splitLayoutWidth = settings.splitLayoutWidth || 66.666;
                rememberMode = true;
                console.log('[Modal] 设置已加载:', settings);
                return true;
            }
        }
    } catch (error) {
        console.error('[Modal] 加载设置失败:', error);
    }
    return false;
}

/**
 * 打开 Modal 搜索窗口
 */
function openModalSearch() {
    console.log('[Modal] 打开搜索窗口...');
    
    // 读取配置，更新自动关闭状态
    const config = getConfig();
    autoCloseEnabled = config.modal_auto_close_on_add !== false; // 默认为 true
    
    // 尝试加载记忆设置
    const hasLoadedSettings = loadModalSettings();
    if (!hasLoadedSettings) {
        // 如果没有记忆设置，恢复默认值
        layoutMode = 'center';
        editModeEnabled = false;
        splitLayoutWidth = 66.666;
        rememberMode = false;
    }
    
    console.log('[Modal] 自动关闭模式:', autoCloseEnabled);
    console.log('[Modal] 记忆模式:', rememberMode);
    
    // 创建或获取 Modal
    const modal = createModalSearchWindow();
    
    // 应用记忆的状态（更新按钮UI）
    if (hasLoadedSettings && modal.updateRememberBtn && modal.updateLayoutBtn && 
        modal.updateEditModeBtn && modal.updateToggleBtn) {
        modal.updateRememberBtn();
        modal.updateLayoutBtn();
        modal.updateEditModeBtn();
        modal.updateToggleBtn();
        
        // 如果是左右布局，立即应用
        if (layoutMode === 'split') {
            modal.overlay.classList.add('split-layout');
            modal.content.classList.add('split-layout');
            modal.content.style.width = `${splitLayoutWidth}vw`;
            addResizeHandle(modal.content);
            
            // 通知节点池
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('nm:layoutModeChanged', {
                    detail: { mode: layoutMode }
                }));
            }, 100);
        }
        
        // 如果编辑模式开启，通知节点池
        if (editModeEnabled) {
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('nm:editModeChanged', {
                    detail: { enabled: editModeEnabled }
                }));
            }, 100);
        }
    }
    
    // 添加到 DOM
    if (!modal.overlay.parentElement) {
        document.body.appendChild(modal.overlay);
        console.log('[Modal] 添加到 DOM');
    }
    
    // 延迟显示动画（确保 DOM 渲染完成）
    requestAnimationFrame(() => {
        modal.overlay.classList.add('show');
        console.log('[Modal] ✅ 显示动画开始');
        
        // 聚焦搜索框
        setTimeout(() => {
            const searchInput = modal.managerUI.querySelector('.nm-search-input');
            if (searchInput) {
                searchInput.focus();
                console.log('[Modal] ✅ 搜索框已聚焦');
            }
        }, 250); // 等待动画完成
    });
    
    // 绑定 ESC 键关闭
    if (!modal.escHandler) {
        modal.escHandler = (e) => {
            if (e.key === 'Escape') {
                forceCleanupPreview(); // 立即清理预览
                closeModalSearch();
            }
        };
        document.addEventListener('keydown', modal.escHandler);
        console.log('[Modal] ✅ ESC 键监听已绑定');
    }
}

/**
 * 关闭 Modal 搜索窗口
 */
function closeModalSearch() {
    console.log('[Modal] 关闭搜索窗口...');
    
    if (!modalInstance) {
        console.log('[Modal] 窗口不存在，无需关闭');
        return;
    }
    
    // 强制清理节点预览浮层（防止预览浮层残留）
    forceCleanupPreview();
    
    // 移除显示类（触发淡出动画）
    modalInstance.overlay.classList.remove('show');
    
    // 等待动画完成后移除 DOM
    setTimeout(() => {
        if (modalInstance.overlay.parentElement) {
            modalInstance.overlay.parentElement.removeChild(modalInstance.overlay);
            console.log('[Modal] ✅ 已从 DOM 移除');
        }
        
        // 移除 ESC 键监听
        if (modalInstance.escHandler) {
            document.removeEventListener('keydown', modalInstance.escHandler);
            modalInstance.escHandler = null;
            console.log('[Modal] ✅ ESC 键监听已移除');
        }
        
        // 清理实例（下次重新创建，确保数据最新）
        modalInstance = null;
        console.log('[Modal] ✅ 实例已清理');
    }, 200); // 等待淡出动画完成
}

/**
 * 在添加节点后检查是否需要关闭 Modal
 */
function checkAutoCloseOnAdd() {
    if (autoCloseEnabled && modalInstance) {
        console.log('[Modal] 自动关闭（点击添加节点后）');
        forceCleanupPreview(); // 立即清理预览
        closeModalSearch();
    } else if (!autoCloseEnabled) {
        console.log('[Modal] 固定模式，保持窗口打开');
    }
}

/**
 * 获取 Modal 是否打开
 */
function isModalOpen() {
    return modalInstance && modalInstance.overlay.parentElement;
}

export {
    createModalSearchWindow,
    openModalSearch,
    closeModalSearch,
    checkAutoCloseOnAdd,
    isModalOpen
};

