// js/modules/canvas_node_integrated.js
// 画布节点集成增强 - 在节点渲染时注入按钮，跟随节点一起绘制

import { app } from "../../../scripts/app.js";
import { showToast, folderState, buildFolderTree } from './folder_state.js';
import { addFolderStyles } from './folder_styles.js';

// 存储节点按钮状态 {nodeId: {isFavorited, hasNote, buttons}}
const nodeButtonStates = new Map();

// 按钮尺寸（调整为适合标题栏的大小）
const BUTTON_SIZE = 16; // 稍微小一点，适合标题栏
const BUTTON_MARGIN = 4; // 距离右边的距离
const BUTTON_GAP = 3; // 两个按钮之间的间距
const FAVORITE_ICON = '⭐';
const FAVORITE_ICON_EMPTY = '☆';
const NOTE_ICON = '📝';
const CLASSIFY_ICON = '📁';

// Group相关常量
const groupButtonAreas = [];
const GROUP_BUTTON_MARGIN = 6;
const GROUP_BUTTON_ICON = '📁';
const GROUP_TOOLBAR_ROOT_SELECTOR = '.pointer-events-none.fixed.left-0.top-0.z-40';
const GROUP_TOOLBAR_CONTENT_SELECTOR = '.p-panel-content.p-2.h-12.flex';
const GROUP_TOOLBAR_BTN_CLASS = 'nm-group-toolbar-btn';
const FOLDER_ID_PREFIX = 'folder_';

// Hook标记
let drawGroupsHooked = false;
let userDataReady = false;
let userDataReadyPromise = null;
let stylesReady = false;
let groupToolbarObserver = null;

function ensureDialogStyles() {
    if (stylesReady) {
        return;
    }
    try {
        addFolderStyles?.();
        stylesReady = true;
    } catch (error) {
        console.error('[节点集成] 注入对话框样式失败:', error);
    }
}

function generateFolderId() {
    return `${FOLDER_ID_PREFIX}${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function formatGroupNameForDisplay(name, limit = 12) {
    const text = (name || 'Group').trim();
    if (text.length <= limit) {
        return text;
    }
    return `${text.slice(0, limit)}…`;
}

function getUniqueFolderName(baseName = 'Group') {
    const folders = folderState.config?.folders || {};
    const names = new Set(Object.values(folders).map(folder => folder.name));
    if (!names.has(baseName)) {
        return baseName;
    }
    let index = 2;
    let candidate = `${baseName} (${index})`;
    while (names.has(candidate)) {
        index += 1;
        candidate = `${baseName} (${index})`;
    }
    return candidate;
}

function getNextFolderOrder() {
    const folders = folderState.config?.folders || {};
    const orders = Object.values(folders).map(folder => typeof folder.order === 'number' ? folder.order : 0);
    if (!orders.length) {
        return 0;
    }
    return Math.max(...orders) + 1;
}

async function createFolderForGroup(groupName) {
    if (!(await requireUserDataReady())) {
        throw new Error('节点管理器尚未就绪');
    }
    if (!folderState.config) {
        throw new Error('配置尚未加载');
    }
    
    const folders = folderState.config.folders || (folderState.config.folders = {});
    const folderNodes = folderState.config.folderNodes || (folderState.config.folderNodes = {});
    
    const sanitizedName = (groupName || '').trim() || '新建分组';
    const uniqueName = getUniqueFolderName(sanitizedName);
    const folderId = generateFolderId();
    
    folders[folderId] = {
        name: uniqueName,
        parent: null,
        level: 1,
        order: getNextFolderOrder(),
        expanded: true
    };
    folderNodes[folderId] = [];
    
    const ops = await import('./folder_operations.js');
    const saved = await ops.saveConfig();
    if (!saved) {
        delete folders[folderId];
        delete folderNodes[folderId];
        throw new Error('保存分类配置失败');
    }
    
    try {
        const folderUI = await import('./folder_ui.js');
        folderUI.renderFolders?.();
    } catch (error) {
        console.warn('[节点集成] 刷新分类列表失败:', error);
    }
    
    return {
        folderId,
        folderName: uniqueName
    };
}

function refreshCanvasButtons(reason = 'external-update') {
    nodeButtonStates.clear();
    groupButtonAreas.length = 0;
    if (app && app.canvas) {
        app.canvas.setDirty?.(true);
        app.canvas.draw?.();
    }
    if (reason) {
        console.debug(`[节点集成] 触发画布按钮刷新: ${reason}`);
    }
}

async function ensureUserDataReady() {
    if (userDataReady && folderState.config && window.nodePoolState) {
        return;
    }
    
    if (userDataReadyPromise) {
        return userDataReadyPromise;
    }
    
    userDataReadyPromise = (async () => {
        try {
            if (!folderState.config) {
                const ops = await import('./folder_operations.js');
                if (ops?.loadConfig) {
                    await ops.loadConfig();
                }
            }
            
            const nodePool = await import('./node_pool.js');
            if (typeof nodePool.loadUserData === 'function') {
                nodePool.loadUserData();
            }
            
            if (!window.nodePoolState && nodePool?.nodePoolState) {
                window.nodePoolState = nodePool.nodePoolState;
            }
            
            userDataReady = !!(folderState.config && window.nodePoolState);
        } catch (error) {
            console.error('[节点集成] 初始化用户数据失败:', error);
            throw error;
        } finally {
            userDataReadyPromise = null;
        }
    })();
    
    return userDataReadyPromise;
}

async function requireUserDataReady() {
    try {
        await ensureUserDataReady();
        return true;
    } catch (error) {
        showToast('节点管理器尚未就绪，请稍后再试', 'error');
        return false;
    }
}

if (typeof window !== 'undefined') {
    const refreshHandler = () => refreshCanvasButtons('user-data-event');
    window.addEventListener('nm:userDataLoaded', refreshHandler);
    window.addEventListener('nm:userDataUpdated', refreshHandler);
    window.addEventListener('nm:nodePoolReady', () => refreshCanvasButtons('node-pool-ready'));
    window.addEventListener('nm:configLoaded', () => {
        userDataReady = !!folderState.config;
    });
}

/**
 * 根据画布节点，获取在节点池中的唯一ID
 * 侧边栏的 node.id 通常等于 Comfy 节点的 comfyClass / class_type
 */
function getNodeConfigIdFromCanvasNode(node) {
    if (!node) return null;
    
    // 优先使用 comfyClass（ComfyUI 为每个节点挂载的类名）
    if (node.comfyClass) return node.comfyClass;
    
    // 兼容其他可能的字段
    if (node.class_type) return node.class_type;
    if (node.comfyClassType) return node.comfyClassType;
    if (node.type) return node.type;
    
    // 兜底：使用构造函数上的静态字段或字符串化的 type
    if (node.constructor && node.constructor.comfyClass) {
        return node.constructor.comfyClass;
    }
    
    return String(node.type || node.id);
}

/**
 * （可选）预初始化某个节点的按钮状态
 * 实际绘制时仍会基于 nodePoolState 实时读取
 */
async function getNodeButtonState(graphNodeId) {
    const node = app.graph?.getNodeById?.(graphNodeId);
    const configId = getNodeConfigIdFromCanvasNode(node);
    
    const nodePool = await import('./node_pool.js');
    const { nodePoolState } = nodePool;
    
    const state = {
        configId,
        isFavorited: configId ? nodePoolState.favorites.has(configId) : false,
        hasNote: configId ? !!nodePoolState.notes[configId] : false,
        buttons: []
    };
    
    nodeButtonStates.set(graphNodeId, state);
    return state;
}

// 旧的 updateNodeButtonState 不再在其他地方调用，保留一个安全实现（按需使用）
async function updateNodeButtonState(graphNodeId) {
    await getNodeButtonState(graphNodeId);
}

/**
 * 在节点上绘制按钮（Canvas 2D API）
 * 这个方法保留作为备用，但优先使用drawButtonsAfterTitle
 */
function drawButtonsOnNode(ctx, node) {
    // 这个方法现在主要用于调试
    // 实际绘制在drawButtonsAfterTitle中完成
    if (!node || !node.id) return;
    
    const state = nodeButtonStates.get(node.id);
    if (!state) return;
    
    // 如果已经有按钮区域（通过drawTitleText绘制），就不重复绘制
    if (state.buttons && state.buttons.length > 0) {
        return;
    }
    
    // 备用绘制逻辑（如果drawTitleText没有被调用）
    drawButtons(ctx, node, state);
}

/**
 * 绘制单个按钮（无背景，只绘制图标）
 */
function drawButton(ctx, x, y, icon, isActive = false) {
    // 如果有笔记，添加一个小的黄色圆点提示（不遮挡图标）
    if (isActive && icon === NOTE_ICON) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 235, 59, 0.8)';
        ctx.beginPath();
        ctx.arc(x + BUTTON_SIZE - 4, y + 4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    // 绘制图标（emoji）- 直接绘制，无背景
    ctx.save();
    ctx.font = `${BUTTON_SIZE - 2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 使用半透明，让图标更柔和
    ctx.globalAlpha = 0.9;
    ctx.fillText(icon, x + BUTTON_SIZE / 2, y + BUTTON_SIZE / 2);
    ctx.restore();
}

/**
 * 检测点击是否在按钮区域
 */
function isClickOnButton(node, clickX, clickY) {
    const state = nodeButtonStates.get(node.id);
    if (!state || !state.buttons) return null;
    
    // 将Canvas坐标转换为节点本地坐标
    const nodePos = node.pos;
    const localX = clickX - nodePos[0];
    const localY = clickY - nodePos[1];
    
    // 检查每个按钮
    for (const button of state.buttons) {
        if (localX >= button.x && 
            localX <= button.x + button.width &&
            localY >= button.y && 
            localY <= button.y + button.height) {
            return button.type;
        }
    }
    
    return null;
}

/**
 * 处理按钮点击
 */
async function handleButtonClick(node, buttonType) {
    if (buttonType === 'favorite') {
        await toggleFavorite(node);
    } else if (buttonType === 'note') {
        await showNoteWindow(node);
    } else if (buttonType === 'classify') {
        await showClassificationMenu(node);
    }
}

/**
 * 切换收藏状态
 */
async function toggleFavorite(node) {
    if (!(await requireUserDataReady())) {
        return;
    }
    const configId = getNodeConfigIdFromCanvasNode(node);
    if (!configId) return;
    
    const nodePool = await import('./node_pool.js');
    const { nodePoolState, updateSpecialFoldersCount, saveUserData } = nodePool;
    
    const isFavorited = nodePoolState.favorites.has(configId);
    
    if (isFavorited) {
        nodePoolState.favorites.delete(configId);
        showToast('已取消收藏', 'info');
    } else {
        nodePoolState.favorites.add(configId);
        showToast('已添加到收藏', 'success');
    }
    
    // 清除缓存，强制下次绘制时重新读取状态
    nodeButtonStates.delete(node.id);
    
    // 保存数据（与侧边栏一致）
    await saveUserData();
    
    // 更新计数
    if (updateSpecialFoldersCount) {
        updateSpecialFoldersCount();
    }
    
    // 触发重绘（立即重绘，更新按钮状态）
    if (app && app.canvas) {
        app.canvas.setDirty?.(true);
        // 强制立即重绘
        if (app.canvas.draw) {
            app.canvas.draw();
        }
    }
}

/**
 * 显示笔记对话框（弹窗形式）
 */
async function showNoteWindow(node) {
    if (!(await requireUserDataReady())) {
        return;
    }
    ensureDialogStyles();
    const configId = getNodeConfigIdFromCanvasNode(node);
    if (!configId) return;
    
    // 如果已经有打开的笔记窗口，先关闭它
    const existingOverlay = document.querySelector('.nm-dialog-overlay[data-note-dialog]');
    if (existingOverlay) {
        document.body.removeChild(existingOverlay);
    }
    
    const nodePool = await import('./node_pool.js');
    const { nodePoolState, escapeHtml, saveUserData } = nodePool;
    
    const nodeTitle = node?.title || node?.type || configId;
    const existingNote = nodePoolState.notes[configId] || '';
    
    // 创建对话框遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'nm-dialog-overlay';
    overlay.setAttribute('data-note-dialog', 'true');
    overlay.style.zIndex = '10001'; // 确保在最上层
    
    overlay.innerHTML = `
        <div class="nm-dialog" style="min-width: 500px; max-width: 800px;">
            <div class="nm-dialog-header">
                <div class="nm-dialog-title">📝 ${escapeHtml(nodeTitle)} - 笔记</div>
            </div>
            <div class="nm-dialog-body">
                <textarea class="nm-input" id="nm-note-input" 
                          style="min-height: 200px; max-height: 400px; resize: vertical; font-family: inherit; width: 100%; box-sizing: border-box;"
                          placeholder="在这里记录使用心得...">${escapeHtml(existingNote)}</textarea>
            </div>
            <div class="nm-dialog-footer">
                <button class="nm-btn" data-action="cancel">取消</button>
                <button class="nm-btn" data-action="delete" ${existingNote ? '' : 'style="display:none; background: rgba(244, 67, 54, 0.8);"'} data-delete-btn>删除笔记</button>
                <button class="nm-btn primary" data-action="save">保存</button>
            </div>
        </div>
    `;
    
    // 立即添加到DOM并显示
    document.body.appendChild(overlay);
    
    // 使用 requestAnimationFrame 确保DOM已渲染
    requestAnimationFrame(() => {
        const input = overlay.querySelector('#nm-note-input');
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    });
    
    // 绑定按钮事件
    const cancelBtn = overlay.querySelector('[data-action="cancel"]');
    const saveBtn = overlay.querySelector('[data-action="save"]');
    const deleteBtn = overlay.querySelector('[data-action="delete"]');
    
    const closeDialog = () => {
        if (overlay.parentElement) {
            document.body.removeChild(overlay);
        }
    };
    
    if (cancelBtn) {
        cancelBtn.onclick = (e) => {
            e.stopPropagation();
            closeDialog();
        };
    }
    
    if (saveBtn) {
        saveBtn.onclick = async (e) => {
            e.stopPropagation();
            const input = overlay.querySelector('#nm-note-input');
            const note = input ? input.value.trim() : '';
            
            if (note) {
                nodePoolState.notes[configId] = note;
                showToast('笔记已保存', 'success');
            } else {
                delete nodePoolState.notes[configId];
            }
            
            // 清除缓存，强制下次绘制时重新读取状态
            nodeButtonStates.delete(node.id);
            
            // 保存数据（与侧边栏一致）
            await saveUserData();
            
            // 触发重绘（立即重绘，更新按钮状态）
            if (app && app.canvas) {
                app.canvas.setDirty?.(true);
                if (app.canvas.draw) {
                    app.canvas.draw();
                }
            }
            
            closeDialog();
        };
    }
    
    if (deleteBtn) {
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            delete nodePoolState.notes[configId];
            showToast('笔记已删除', 'info');
            
            // 清除缓存，强制下次绘制时重新读取状态
            nodeButtonStates.delete(node.id);
            
            // 保存数据（与侧边栏一致）
            await saveUserData();
            
            // 触发重绘（立即重绘，更新按钮状态）
            if (app && app.canvas) {
                app.canvas.setDirty?.(true);
                if (app.canvas.draw) {
                    app.canvas.draw();
                }
            }
            
            closeDialog();
        };
    }
    
    // 点击遮罩关闭，忽略打开弹窗后的首个点击
    let overlayClickGuard = true;
    overlay.addEventListener('click', (e) => {
        if (e.target !== overlay) {
            return;
        }
        if (overlayClickGuard) {
            overlayClickGuard = false;
            return;
        }
        closeDialog();
    });
    
    // ESC键关闭
    const escHandler = (e) => {
        if (e.key === 'Escape' && overlay.parentElement) {
            closeDialog();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

/**
 * 显示分类选择窗口（支持单节点或Group批量）
 */
async function showClassificationMenu(node, options = {}) {
    if (!(await requireUserDataReady())) {
        return;
    }
    ensureDialogStyles();
    const isGroupMode = options.mode === 'group' || !!options.group;
    const groupRef = options.group;
    const predefinedTargets = Array.isArray(options.targets) ? options.targets : null;
    
    if (!folderState.config || !folderState.config.folders || Object.keys(folderState.config.folders).length === 0) {
        showToast('请先在节点管理器中创建“我的分类”文件夹', 'info');
        return;
    }
    
    const { escapeHtml } = await import('./node_pool.js');
    
    let targets = [];
    let dialogTitle = '📁 选择分类';
    let summaryContext = null;
    
    if (isGroupMode) {
        const groupTitle = groupRef?.title || groupRef?.name || 'Group';
        const preparedTargets = predefinedTargets && predefinedTargets.length > 0
            ? predefinedTargets
            : (groupRef ? getNodesInsideGroup(groupRef).map(groupNode => ({
                node: groupNode,
                configId: getNodeConfigIdFromCanvasNode(groupNode),
                title: groupNode.title || groupNode.type || groupNode.comfyClass
            })) : []);
        
        targets = preparedTargets.filter(item => !!item.configId);
        
        if (!groupRef) {
            showToast('无法识别该分组', 'error');
            return;
        }
        
        if (targets.length === 0) {
            showToast('分组内没有可分类的节点', 'info');
            return;
        }
        
        dialogTitle = `📁 ${escapeHtml(groupTitle)} - 批量分类`;
        summaryContext = {
            type: 'group',
            groupTitle,
            previewTargets: targets
        };
    } else {
        const configId = getNodeConfigIdFromCanvasNode(node);
        if (!configId) {
            showToast('无法识别节点类型', 'error');
            return;
        }
        const nodeTitle = node?.title || node?.type || configId;
        targets = [{ configId, title: nodeTitle }];
        summaryContext = {
            type: 'node',
            nodeTitle
        };
    }
    
    const uniqueIds = Array.from(new Set(targets.map(item => item.configId))).filter(Boolean);
    if (uniqueIds.length === 0) {
        showToast('没有可分类的节点', 'info');
        return;
    }
    
    let summaryHtml = '';
    if (summaryContext?.type === 'group') {
        const previewList = [];
        const previewSeen = new Set();
        for (const item of summaryContext.previewTargets) {
            if (!item.configId || previewSeen.has(item.configId)) continue;
            previewSeen.add(item.configId);
            previewList.push(item);
        }
        const previewNames = previewList.slice(0, 3).map(item => escapeHtml(item.title || item.configId));
        const previewText = previewNames.join('、') + (previewList.length > 3 ? ' 等' : '');
        summaryHtml = `
            <div class="nm-classify-summary" style="font-size: 12px; opacity: 0.85; margin-bottom: 6px;">
                分组「${escapeHtml(summaryContext.groupTitle || 'Group')}」内共有 ${uniqueIds.length} 个节点：${previewText}
            </div>
        `;
    } else if (summaryContext?.type === 'node') {
        summaryHtml = `
            <div class="nm-classify-summary" style="font-size: 12px; opacity: 0.85; margin-bottom: 6px;">
                当前节点：${escapeHtml(summaryContext.nodeTitle || '')}
            </div>
        `;
    }
    
    // 如果已有分类窗口，先关闭
    document.querySelectorAll('.nm-dialog-overlay[data-classify-dialog]').forEach(el => el.remove());
    
    const overlay = document.createElement('div');
    overlay.className = 'nm-dialog-overlay';
    overlay.setAttribute('data-classify-dialog', 'true');
    overlay.style.zIndex = '10001';
    
    overlay.innerHTML = `
        <div class="nm-dialog" style="min-width: 420px; max-width: 540px;">
            <div class="nm-dialog-header">
                <div class="nm-dialog-title">${dialogTitle}</div>
            </div>
            <div class="nm-dialog-body nm-classify-body" style="max-height: 360px; overflow-y: auto;">
                <div class="nm-classify-tip" style="font-size: 12px; opacity: 0.8; margin-bottom: 8px;">
                    只显示“我的分类”文件夹，点击即可添加
                </div>
                ${summaryHtml}
                <div class="nm-classify-list" style="display: flex; flex-direction: column; gap: 4px;"></div>
            </div>
            <div class="nm-dialog-footer">
                <button class="nm-btn" data-action="cancel">关闭</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const footerEl = overlay.querySelector('.nm-dialog-footer');
    let quickCreateBtn = null;
    
    if (isGroupMode && footerEl) {
        footerEl.style.justifyContent = 'space-between';
        footerEl.style.flexWrap = 'wrap';
        footerEl.style.gap = '8px';
        quickCreateBtn = document.createElement('button');
        quickCreateBtn.className = 'nm-btn';
        quickCreateBtn.dataset.action = 'quick-create-folder';
        quickCreateBtn.textContent = `按「${formatGroupNameForDisplay(summaryContext?.groupTitle)}」新建分类并添加`;
        quickCreateBtn.style.background = 'transparent';
        quickCreateBtn.style.border = '1px solid rgba(255, 255, 255, 0.35)';
        quickCreateBtn.style.color = '#fff';
        quickCreateBtn.style.fontWeight = '500';
        quickCreateBtn.style.textShadow = '0 0 6px rgba(0,0,0,0.4)';
        quickCreateBtn.style.transition = 'border-color 0.2s ease, color 0.2s ease';
        quickCreateBtn.addEventListener('mouseenter', () => {
            quickCreateBtn.style.borderColor = '#fff';
        });
        quickCreateBtn.addEventListener('mouseleave', () => {
            quickCreateBtn.style.borderColor = 'rgba(255, 255, 255, 0.35)';
        });
        footerEl.insertBefore(quickCreateBtn, footerEl.firstChild);
    }
    
    const listEl = overlay.querySelector('.nm-classify-list');
    const folders = folderState.config?.folders || {};
    const tree = buildFolderTree(folders);
    
    const dispatchClassification = (folderId) => {
        if (!folderId) return;
        
        if (isGroupMode || uniqueIds.length > 1) {
            window.dispatchEvent(new CustomEvent('nm:addNodesToFolder', {
                detail: {
                    nodeIds: uniqueIds,
                    folderId
                }
            }));
        } else {
            const nodeId = uniqueIds[0];
            window.dispatchEvent(new CustomEvent('nm:addNodeToFolder', {
                detail: {
                    nodeId,
                    nodeType: nodeId,
                    folderId
                }
            }));
        }
        
        closeDialog();
    };
    
    if (!tree.length) {
        listEl.innerHTML = `
            <div style="padding: 12px; border-radius: 6px; background: rgba(255,255,255,0.05); font-size: 13px; color: #bbb;">
                暂无自定义分类。请先在侧边栏 “我的分类” 中创建。
            </div>
        `;
    } else {
        const renderFolderRow = (folder, level = 0) => {
            const button = document.createElement('button');
            button.className = 'nm-classify-item';
            button.style.cssText = `
                width: 100%;
                text-align: left;
                padding: 6px 10px 6px ${12 + level * 16}px;
                background: rgba(255,255,255,0.04);
                color: #fff;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 13px;
                gap: 6px;
            `;
            button.innerHTML = `
                <span style="display: flex; align-items: center; gap: 6px;">
                    <span>📁</span>
                    <span>${escapeHtml(folder.name || folder.title || folder.id)}</span>
                </span>
                <span style="font-size: 11px; opacity: 0.7;">
                    ${(folderState.config.folderNodes?.[folder.id]?.length || 0)}
                </span>
            `;
            
            button.addEventListener('mouseenter', () => {
                button.style.background = 'rgba(255,255,255,0.1)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.background = 'rgba(255,255,255,0.04)';
            });
            
            button.addEventListener('click', () => {
                dispatchClassification(folder.id);
            });
            
            listEl.appendChild(button);
            
            if (folder.children && folder.children.length > 0) {
                folder.children.forEach(child => renderFolderRow(child, level + 1));
            }
        };
        
        tree.forEach(folder => renderFolderRow(folder, 0));
    }
    
    const closeDialog = () => {
        if (overlay.parentElement) {
            document.body.removeChild(overlay);
        }
        document.removeEventListener('keydown', escHandler);
    };
    
    const cancelBtn = overlay.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
        cancelBtn.onclick = (e) => {
            e.stopPropagation();
            closeDialog();
        };
    }
    
    if (quickCreateBtn) {
        quickCreateBtn.onclick = async (e) => {
            e.stopPropagation();
            if (quickCreateBtn.disabled) return;
            quickCreateBtn.disabled = true;
            const originalText = quickCreateBtn.textContent;
            quickCreateBtn.textContent = '创建中...';
            try {
                const { folderId, folderName } = await createFolderForGroup(summaryContext?.groupTitle);
                showToast(`已创建分类「${folderName}」，正在添加节点...`, 'success');
                dispatchClassification(folderId);
            } catch (error) {
                console.error('[节点集成] 快速新建分类失败:', error);
                showToast(error?.message || '创建分类失败，请稍后重试', 'error');
            } finally {
                if (quickCreateBtn.isConnected) {
                    quickCreateBtn.disabled = false;
                    quickCreateBtn.textContent = originalText;
                }
            }
        };
    }
    
    let overlayClickGuard = true;
    overlay.addEventListener('click', (e) => {
        if (e.target !== overlay) {
            return;
        }
        if (overlayClickGuard) {
            overlayClickGuard = false;
            return;
        }
        closeDialog();
    });
    
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
        }
    };
    document.addEventListener('keydown', escHandler);
}


// 全局标记，确保只Hook一次
let drawTitleTextHooked = false;

/**
 * Hook节点的drawTitleText方法
 * 在标题文本绘制后，在标题右侧绘制按钮
 */
function hookNodeDrawTitleText() {
    // 检查是否已经Hook过
    if (drawTitleTextHooked) {
        return;
    }
    
    // 获取LiteGraph的原型方法
    if (typeof LiteGraph === 'undefined' || !LiteGraph.LGraphNode) {
        console.warn('[节点集成] LiteGraph不可用');
        return;
    }
    
    const LGraphNodeProto = LiteGraph.LGraphNode.prototype;
    if (!LGraphNodeProto.drawTitleText) {
        console.warn('[节点集成] drawTitleText方法不存在');
        return;
    }
    
    const originalDrawTitleText = LGraphNodeProto.drawTitleText;
    
    // Hook原型方法（影响所有节点）
    LGraphNodeProto.drawTitleText = function(ctx, title, pos, size) {
        // 调用原始方法绘制标题文本
        if (originalDrawTitleText) {
            originalDrawTitleText.call(this, ctx, title, pos, size);
        }
        
        // 在标题文本绘制后，在标题右侧绘制按钮
        // pos是标题文本的位置 [x, y]，size是标题文本的大小 [width, height]
        // 注意：这些坐标是相对于节点的本地坐标，原点在节点左上角
        drawButtonsAfterTitle(ctx, this, pos, size);
    };
    
    drawTitleTextHooked = true;
    console.log('[节点集成] ✅ 已Hook drawTitleText方法（全局）');
}

/**
 * 检查节点是否收起
 */
function isNodeCollapsed(node) {
    if (!node) return false;
    
    // 方法1: 检查 _collapsed_width 属性
    // 如果节点有 _collapsed_width 且当前宽度等于它，说明节点已收起
    if (node._collapsed_width !== undefined && node.size && node.size[0]) {
        const currentWidth = node.size[0];
        const collapsedWidth = node._collapsed_width;
        // 如果当前宽度接近或等于收起宽度（允许1px误差），认为已收起
        if (Math.abs(currentWidth - collapsedWidth) < 2) {
            return true;
        }
    }
    
    // 方法2: 检查是否有 collapsed 属性
    if (node.collapsed === true) {
        return true;
    }
    
    // 方法3: 检查节点高度（收起时高度通常很小，只有标题栏）
    if (node.size && node.size[1]) {
        const nodeHeight = node.size[1];
        const titleBarHeight = 24; // 标题栏高度
        // 如果节点高度接近标题栏高度（允许2px误差），认为已收起
        if (nodeHeight <= titleBarHeight + 2) {
            return true;
        }
    }
    
    return false;
}

/**
 * 在标题文本后绘制按钮
 * 固定在节点顶部中间位置，跟随节点移动和缩放
 */
function drawButtonsAfterTitle(ctx, node, titlePos, titleSize) {
    if (!node || !node.id) return;
    
    // 检查节点是否收起，如果收起则不绘制按钮
    if (isNodeCollapsed(node)) {
        return;
    }
    
    const graphNodeId = node.id;
    const configId = getNodeConfigIdFromCanvasNode(node);
    
    // nodePoolState 已挂载到 window 上（由 node_pool.js 设置）
    const nodePool = typeof window !== 'undefined' && window.nodePoolState ? window.nodePoolState : null;
    
    let state;
    if (nodePool && configId) {
        // 实时读取最新状态（每次绘制都重新读取，确保同步）
        state = {
            configId,
            isFavorited: nodePool.favorites.has(configId),
            hasNote: !!nodePool.notes[configId],
            buttons: []
        };
    } else {
        // 如果 nodePoolState 不可用，回退到缓存
        state = nodeButtonStates.get(graphNodeId);
        if (!state) return;
    }
    
    // 更新缓存（用于点击检测）
    nodeButtonStates.set(graphNodeId, state);
    
    // 绘制按钮
    drawButtons(ctx, node, state);
}

/**
 * 绘制按钮（内部函数）
 */
function drawButtons(ctx, node, state) {
    if (!node || !state) return;
    
    const nodeWidth = node.size?.[0] || 200;
    const titleBarHeight = 24;
    
    // 按钮位置：节点顶部中间位置
    const totalButtonsWidth = BUTTON_SIZE * 3 + BUTTON_GAP * 2;
    const buttonX = (nodeWidth - totalButtonsWidth) / 2;
    const buttonY = (titleBarHeight - BUTTON_SIZE) / 2;
    
    // 确保按钮在节点范围内
    if (buttonX < 0 || buttonY < 0 || buttonX + totalButtonsWidth > nodeWidth || buttonY + BUTTON_SIZE > titleBarHeight) {
        return;
    }
    
    // 保存上下文
    ctx.save();
    
    // 绘制分类按钮（最左侧）
    const classifyX = buttonX;
    const classifyY = buttonY;
    drawButton(ctx, classifyX, classifyY, CLASSIFY_ICON, false);
    
    // 绘制笔记按钮（中间）
    const noteX = classifyX + BUTTON_SIZE + BUTTON_GAP;
    const noteY = buttonY;
    drawButton(ctx, noteX, noteY, NOTE_ICON, state.hasNote);
    
    // 绘制收藏按钮（右侧）
    const favoriteX = noteX + BUTTON_SIZE + BUTTON_GAP;
    const favoriteY = buttonY;
    drawButton(ctx, favoriteX, favoriteY, state.isFavorited ? FAVORITE_ICON : FAVORITE_ICON_EMPTY, false);
    
    // 存储按钮区域（用于点击检测）
    state.buttons = [
        {
            type: 'classify',
            x: classifyX,
            y: classifyY,
            width: BUTTON_SIZE,
            height: BUTTON_SIZE
        },
        {
            type: 'note',
            x: noteX,
            y: noteY,
            width: BUTTON_SIZE,
            height: BUTTON_SIZE
        },
        {
            type: 'favorite',
            x: favoriteX,
            y: favoriteY,
            width: BUTTON_SIZE,
            height: BUTTON_SIZE
        }
    ];
    
    ctx.restore();
}

/**
 * 获取Group标题栏高度
 */
function getGroupTitleHeight() {
    if (typeof LiteGraph !== 'undefined') {
        if (LiteGraph.GROUP_TITLE_HEIGHT) return LiteGraph.GROUP_TITLE_HEIGHT;
        if (LiteGraph.NODE_TITLE_HEIGHT) return LiteGraph.NODE_TITLE_HEIGHT;
    }
    return 24;
}

/**
 * 获取Group的矩形区域 [x, y, width, height]
 */
function getGroupRect(group) {
    if (!group) return null;
    
    if (Array.isArray(group.rect) && group.rect.length >= 4) {
        return group.rect;
    }
    if (Array.isArray(group.bounding) && group.bounding.length >= 4) {
        return group.bounding;
    }
    
    const pos = group.pos || group.position;
    const size = group.size || group.dimensions;
    
    if (!pos || !size) {
        return null;
    }
    
    return [pos[0], pos[1], size[0], size[1]];
}

/**
 * 获取组内包含的节点
 */
function getNodesInsideGroup(group) {
    if (!group || !app?.graph) return [];
    
    const rect = getGroupRect(group);
    if (!rect) return [];
    
    const [gx, gy, gw, gh] = rect;
    const nodes = app.graph._nodes || [];
    
    return nodes.filter(node => {
        if (!node || !node.pos) return false;
        const [nx, ny] = node.pos;
        const nw = node.size?.[0] ?? 0;
        const nh = node.size?.[1] ?? 0;
        
        if (isNaN(nx) || isNaN(ny)) {
            return false;
        }
        
        const withinX = nx >= gx && (nx + nw) <= (gx + gw);
        const withinY = ny >= gy && (ny + nh) <= (gy + gh);
        return withinX && withinY;
    });
}

function getSelectedGroup() {
    const canvasInstance = app?.canvas;
    if (!canvasInstance) return null;
    return canvasInstance.selected_group || canvasInstance.current_group || canvasInstance._selected_group || null;
}

/**
 * 绘制Group按钮
 */
function drawGroupButtonsOnCanvas(canvasInstance, ctx) {
    if (!canvasInstance?.graph || !ctx) {
        groupButtonAreas.length = 0;
        return;
    }
    
    const groups = canvasInstance.graph._groups || canvasInstance.graph.groups || [];
    groupButtonAreas.length = 0;
    
    if (!groups || groups.length === 0) {
        return;
    }
    
    const titleHeight = getGroupTitleHeight();
    const ds = canvasInstance.ds || canvasInstance.viewport;
    const scale = ds?.scale ?? canvasInstance.scale ?? 1;
    const offset = ds?.offset ?? canvasInstance.offset ?? [0, 0];
    
    ctx.save();
    ctx.translate(offset[0], offset[1]);
    ctx.scale(scale, scale);
    
    groups.forEach(group => {
        if (!group) return;
        if (group.visible === false) return;
        
        const rect = getGroupRect(group);
        if (!rect) return;
        
        const [gx, gy, gw] = rect;
        if ([gx, gy, gw].some(v => typeof v !== 'number')) {
            return;
        }
        
        const headerHeight = group.title_height || titleHeight;
        const buttonX = gx + Math.max(gw - BUTTON_SIZE - GROUP_BUTTON_MARGIN, 4);
        const buttonY = gy - headerHeight + (headerHeight - BUTTON_SIZE) / 2;
        
        drawButton(ctx, buttonX, buttonY, GROUP_BUTTON_ICON);
        
        groupButtonAreas.push({
            group,
            x: buttonX,
            y: buttonY,
            width: BUTTON_SIZE,
            height: BUTTON_SIZE
        });
    });
    
    ctx.restore();
}

/**
 * 根据点击坐标获取对应的Group按钮
 */
function findGroupButtonAt(clickX, clickY) {
    for (const area of groupButtonAreas) {
        if (clickX >= area.x &&
            clickX <= area.x + area.width &&
            clickY >= area.y &&
            clickY <= area.y + area.height) {
            return area.group;
        }
    }
    return null;
}

/**
 * 处理Group分类按钮点击
 */
async function handleGroupClassifyClick(group) {
    if (!(await requireUserDataReady())) {
        return;
    }
    if (!group) return;
    
    const nodes = getNodesInsideGroup(group);
    if (!nodes || nodes.length === 0) {
        showToast('该分组内没有节点可分类', 'info');
        return;
    }
    
    const targets = nodes.map(node => ({
        node,
        configId: getNodeConfigIdFromCanvasNode(node),
        title: node.title || node.type || node.comfyClass
    })).filter(target => !!target.configId);
    
    if (targets.length === 0) {
        showToast('分组内节点无法识别类型，无法分类', 'error');
        return;
    }
    
    await showClassificationMenu(null, {
        mode: 'group',
        group,
        targets
    });
}

async function handleGroupFavoriteToggle(group) {
    if (!(await requireUserDataReady())) {
        return;
    }
    if (!group) {
        showToast('请先选中一个分组', 'warning');
        return;
    }
    
    const nodes = getNodesInsideGroup(group);
    if (!nodes || nodes.length === 0) {
        showToast('该分组内没有节点可处理', 'info');
        return;
    }
    
    const nodePool = await import('./node_pool.js');
    const { nodePoolState, saveUserData } = nodePool;
    
    const targets = nodes
        .map(node => getNodeConfigIdFromCanvasNode(node))
        .filter(Boolean);
    
    if (targets.length === 0) {
        showToast('分组内节点无法识别类型，无法操作', 'error');
        return;
    }
    
    let shouldFavorite = false;
    for (const id of targets) {
        if (!nodePoolState.favorites.has(id)) {
            shouldFavorite = true;
            break;
        }
    }
    
    targets.forEach(id => {
        if (shouldFavorite) {
            nodePoolState.favorites.add(id);
        } else {
            nodePoolState.favorites.delete(id);
        }
    });
    
    await saveUserData();
    refreshCanvasButtons('group-favorite-toggle');
    
    const actionText = shouldFavorite ? '收藏' : '取消收藏';
    showToast(`已批量${actionText} ${targets.length} 个节点`, 'success');
}

/**
 * Hook Group 的绘制
 */
function hookGroupDraw() {
    if (drawGroupsHooked) {
        return;
    }
    
    if (typeof LiteGraph === 'undefined' || !LiteGraph.LGraphCanvas) {
        console.warn('[节点集成] LiteGraphCanvas 不可用，无法Hook分组绘制');
        return;
    }
    
    const canvasProto = LiteGraph.LGraphCanvas.prototype;
    if (!canvasProto.drawGroups) {
        console.warn('[节点集成] drawGroups 方法不存在，无法绘制Group按钮');
        return;
    }
    
    const originalDrawGroups = canvasProto.drawGroups;
    canvasProto.drawGroups = function() {
        if (originalDrawGroups) {
            originalDrawGroups.apply(this, arguments);
        }
        
        try {
            const ctx = this.ctx || (arguments && arguments[0]);
            drawGroupButtonsOnCanvas(this, ctx);
        } catch (err) {
            console.error('[节点集成] 绘制Group按钮失败:', err);
        }
    };
    
    drawGroupsHooked = true;
    console.log('[节点集成] ✅ 已Hook drawGroups 方法，支持Group分类按钮');
}

function setupGroupToolbarIntegration() {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
        return;
    }
    if (groupToolbarObserver) {
        return;
    }
    
    const ensureToolbar = (root) => {
        const container = findGroupToolbarContent(root || document);
        if (container) {
            injectGroupToolbarButtons(container);
        }
    };
    
    groupToolbarObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                const container = findGroupToolbarContent(node);
                if (container) {
                    injectGroupToolbarButtons(container);
                }
            });
            
            if (mutation.target && mutation.target.nodeType === 1) {
                const direct = findGroupToolbarContent(mutation.target);
                if (direct) {
                    injectGroupToolbarButtons(direct);
                }
            }
        }
    });
    
    groupToolbarObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // 初始检测
    requestAnimationFrame(() => ensureToolbar(document));
}

function findGroupToolbarContent(root) {
    if (!root || typeof root.querySelector !== 'function') {
        return null;
    }
    
    const possibleRoots = [];
    if (root.matches && root.matches(GROUP_TOOLBAR_ROOT_SELECTOR)) {
        possibleRoots.push(root);
    }
    const nestedRoot = root.querySelector(GROUP_TOOLBAR_ROOT_SELECTOR);
    if (nestedRoot) {
        possibleRoots.push(nestedRoot);
    }
    
    for (const r of possibleRoots) {
        const content = r.querySelector(GROUP_TOOLBAR_CONTENT_SELECTOR);
        if (isGroupToolbarContent(content)) {
            return content;
        }
    }
    
    if (root.matches && root.matches(GROUP_TOOLBAR_CONTENT_SELECTOR) && isGroupToolbarContent(root)) {
        return root;
    }
    
    const fallback = root.querySelector(GROUP_TOOLBAR_CONTENT_SELECTOR);
    if (isGroupToolbarContent(fallback)) {
        return fallback;
    }
    
    return null;
}

function isGroupToolbarContent(element) {
    if (!element) return false;
    if (!element.classList?.contains('p-panel-content')) return false;
    const hasDelete = element.querySelector('button[data-testid="delete-button"]');
    const hasMore = element.querySelector('button[data-testid="more-options-button"]');
    return !!(hasDelete && hasMore);
}

function injectGroupToolbarButtons(container) {
    if (!container || container.querySelector(`.${GROUP_TOOLBAR_BTN_CLASS}`)) {
        return;
    }
    
    const classifyBtn = createGroupToolbarButton({
        title: '分组分类',
        action: 'group-classify',
        iconClass: 'icon-[lucide--folder-plus]',
        onClick: () => {
            const group = getSelectedGroup();
            handleGroupClassifyClick(group).catch(err => {
                console.error('[节点集成] 分组分类失败:', err);
            });
        }
    });
    
    const favoriteBtn = createGroupToolbarButton({
        title: '分组收藏/取消',
        action: 'group-favorite',
        iconClass: 'icon-[lucide--star]',
        onClick: () => {
            const group = getSelectedGroup();
            handleGroupFavoriteToggle(group).catch(err => {
                console.error('[节点集成] 分组收藏失败:', err);
            });
        }
    });
    
    container.appendChild(classifyBtn);
    container.appendChild(favoriteBtn);
}

function createGroupToolbarButton({ title, action, iconClass, onClick }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `p-button p-component p-button-icon-only p-button-secondary p-button-text ${GROUP_TOOLBAR_BTN_CLASS}`;
    button.dataset.pcName = 'button';
    button.dataset.pdTooltip = 'true';
    button.dataset.nmAction = action;
    button.title = title;
    
    const icon = document.createElement('span');
    icon.className = `${iconClass || ''} size-4`;
    button.appendChild(icon);
    
    const label = document.createElement('span');
    label.className = 'p-button-label';
    label.textContent = '\u00A0';
    button.appendChild(label);
    
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
    });
    
    return button;
}

/**
 * Hook节点的onDrawForeground方法（备用）
 */
function hookNodeDrawForeground(node) {
    // 检查是否已经Hook过
    if (node._nmDrawForegroundHooked) {
        return;
    }
    
    const originalOnDrawForeground = node.onDrawForeground;
    
    node.onDrawForeground = function(ctx, canvas) {
        // 先调用原始方法
        if (originalOnDrawForeground) {
            originalOnDrawForeground.call(this, ctx, canvas);
        }
        
        // 如果onDrawBackground没有绘制按钮，在这里绘制
        // 但通常应该在onDrawBackground中绘制
    };
    
    node._nmDrawForegroundHooked = true;
}

/**
 * 监听Canvas点击事件
 */
function setupCanvasClickHandler() {
    if (!app || !app.canvas) return;
    
    const canvas = app.canvas.canvas;
    if (!canvas) return;
    
    // 使用 mousedown 事件，在捕获阶段处理，确保优先于其他事件
    canvas.addEventListener('mousedown', (e) => {
        if (!app.graph) return;
        
        // 只处理左键点击
        if (e.button !== 0) return;
        
        // 获取点击位置（Canvas坐标）
        const canvasPos = app.canvas.convertEventToCanvasOffset(e);
        const clickX = canvasPos[0];
        const clickY = canvasPos[1];
        
        const targetGroup = findGroupButtonAt(clickX, clickY);
        if (targetGroup) {
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();
            handleGroupClassifyClick(targetGroup).catch(error => {
                console.error('[节点集成] Group按钮点击处理失败:', error);
            });
            return false;
        }
        
        // 查找点击的节点
        const clickedNode = app.graph.getNodeOnPos(clickX, clickY, app.canvas.visible_nodes);
        if (!clickedNode) return;
        
        // 检查是否点击了按钮
        const buttonType = isClickOnButton(clickedNode, clickX, clickY);
        if (buttonType) {
            // 立即阻止事件传播和默认行为
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();
            
            // 立即处理点击（不等待）
            handleButtonClick(clickedNode, buttonType).catch(error => {
                console.error('[节点集成] 按钮点击处理失败:', error);
            });
            
            return false;
        }
    }, true); // 使用捕获阶段，确保优先处理
    
    // 也监听 click 事件作为备用（但优先级较低）
    canvas.addEventListener('click', (e) => {
        if (!app.graph) return;
        
        // 获取点击位置（Canvas坐标）
        const canvasPos = app.canvas.convertEventToCanvasOffset(e);
        const clickX = canvasPos[0];
        const clickY = canvasPos[1];
        
        const targetGroup = findGroupButtonAt(clickX, clickY);
        if (targetGroup) {
            e.stopPropagation();
            e.preventDefault();
            handleGroupClassifyClick(targetGroup).catch(error => {
                console.error('[节点集成] Group按钮点击处理失败:', error);
            });
            return;
        }
        
        // 查找点击的节点
        const clickedNode = app.graph.getNodeOnPos(clickX, clickY, app.canvas.visible_nodes);
        if (!clickedNode) return;
        
        // 检查是否点击了按钮
        const buttonType = isClickOnButton(clickedNode, clickX, clickY);
        if (buttonType) {
            // 如果 mousedown 没有处理，这里处理
            e.stopPropagation();
            e.preventDefault();
            handleButtonClick(clickedNode, buttonType).catch(error => {
                console.error('[节点集成] 按钮点击处理失败:', error);
            });
        }
    }, false);
    
    console.log('[节点集成] ✅ 已设置Canvas点击处理器（mousedown + click）');
}

/**
 * 为现有节点添加按钮
 */
async function enhanceExistingNodes() {
    if (!app || !app.graph) return;
    
    const nodes = app.graph._nodes || [];
    console.log(`[节点集成] 发现 ${nodes.length} 个现有节点`);
    
    // Hook drawTitleText（只需要Hook一次，影响所有节点）
    if (nodes.length > 0 && nodes[0]) {
        hookNodeDrawTitleText(nodes[0]);
    }
    
    for (const node of nodes) {
        if (node && node.id !== undefined) {
            // 获取按钮状态
            await getNodeButtonState(node.id);
        }
    }
    
    // 触发重绘
    if (app.canvas) {
        app.canvas.setDirty?.(true);
    }
}

/**
 * 初始化画布节点集成增强
 */
export async function initCanvasNodeIntegrated() {
    console.log('[节点集成] 开始初始化...');
    
    // 等待ComfyUI就绪
    if (!app || !app.canvas) {
        console.warn('[节点集成] ComfyUI未就绪，延迟初始化...');
        setTimeout(initCanvasNodeIntegrated, 500);
        return;
    }
    
    if (!(await requireUserDataReady())) {
        console.warn('[节点集成] 用户数据未就绪，暂不初始化画布增强');
        return;
    }
    
    // 设置Canvas点击处理器
    setupCanvasClickHandler();
    
    // 为现有节点添加按钮
    await enhanceExistingNodes();
    
    // Hook drawTitleText（全局Hook，影响所有节点）
    hookNodeDrawTitleText();
    hookGroupDraw();
    setupGroupToolbarIntegration();
    
    // Hook graph.add，监听新节点
    const originalAdd = app.graph.add;
    app.graph.add = function(node) {
        const result = originalAdd.call(this, node);
        
        // 延迟处理新节点
        setTimeout(async () => {
            if (node && node.id !== undefined) {
                await getNodeButtonState(node.id);
                
                // 触发重绘（drawTitleText已经被Hook，会自动绘制按钮）
                if (app.canvas) {
                    app.canvas.setDirty?.(true);
                }
            }
        }, 50);
        
        return result;
    };
    
    // Hook graph.remove，清理状态
    const originalRemove = app.graph.remove;
    app.graph.remove = function(node) {
        const result = originalRemove.call(this, node);
        
        if (node && node.id !== undefined) {
            nodeButtonStates.delete(node.id);
        }
        
        return result;
    };
    
    console.log('[节点集成] ✅ 初始化完成');
    console.log('[节点集成] 💡 按钮已集成到节点渲染中，会跟随节点一起绘制');
    console.log('[节点集成] 💡 点击笔记按钮会在节点旁边显示笔记窗口');
}

