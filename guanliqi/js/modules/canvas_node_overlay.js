// js/modules/canvas_node_overlay.js
// 画布节点覆盖层增强 - 在Canvas上方显示笔记和收藏按钮

import { app } from "../../../scripts/app.js";
import { showToast } from './folder_state.js';

// 覆盖层容器
let overlayContainer = null;

// 存储节点按钮映射 {nodeId: buttonElement}
const nodeButtons = new Map();

// 存储节点信息映射 {nodeId: {node, screenPos, size}}
const nodeInfoMap = new Map();

/**
 * 初始化覆盖层
 */
function initOverlay() {
    if (overlayContainer) {
        return; // 已经初始化
    }
    
    const canvas = app?.canvas?.canvas;
    if (!canvas) {
        console.warn('[覆盖层] Canvas未就绪');
        return;
    }
    
    // 创建覆盖层容器
    overlayContainer = document.createElement('div');
    overlayContainer.className = 'nm-canvas-overlay';
    overlayContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1000;
        overflow: visible;
    `;
    
    // 将覆盖层插入到Canvas的父容器中
    const canvasParent = canvas.parentElement;
    if (canvasParent) {
        // 确保父容器是相对定位
        const parentStyle = window.getComputedStyle(canvasParent);
        if (parentStyle.position === 'static') {
            canvasParent.style.position = 'relative';
        }
        
        canvasParent.appendChild(overlayContainer);
        console.log('[覆盖层] ✅ 覆盖层已创建，父容器:', canvasParent.className);
    } else {
        console.error('[覆盖层] ❌ 无法找到Canvas父容器');
    }
}

/**
 * Canvas坐标转换为屏幕坐标
 */
function canvasToScreen(canvasPos, canvas) {
    if (!canvas || !canvas.ds) {
        return [0, 0];
    }
    
    const scale = canvas.ds.scale || 1;
    const offset = canvas.ds.offset || [0, 0];
    const canvasRect = canvas.canvas.getBoundingClientRect();
    
    return [
        canvasPos[0] * scale + offset[0] + canvasRect.left,
        canvasPos[1] * scale + offset[1] + canvasRect.top
    ];
}

/**
 * 创建节点按钮容器
 */
function createNodeButtonContainer(nodeId, nodeInfo) {
    const container = document.createElement('div');
    container.className = 'nm-node-button-container';
    container.dataset.nodeId = nodeId;
    container.style.cssText = `
        position: absolute;
        display: flex;
        gap: 4px;
        opacity: 1;
        pointer-events: auto;
        z-index: 1001;
    `;
    
    return container;
}

/**
 * 创建收藏按钮
 */
function createFavoriteButton(nodeId, isFavorited) {
    const btn = document.createElement('button');
    btn.className = 'nm-overlay-btn nm-overlay-btn-favorite';
    btn.innerHTML = isFavorited ? '⭐' : '☆';
    btn.title = isFavorited ? '取消收藏' : '收藏';
    btn.style.cssText = `
        width: 24px;
        height: 24px;
        border: none;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
        pointer-events: auto;
    `;
    
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        await toggleFavoriteOnCanvas(nodeId, btn);
    });
    
    return btn;
}

/**
 * 创建笔记按钮
 */
function createNoteButton(nodeId, hasNote) {
    const btn = document.createElement('button');
    btn.className = 'nm-overlay-btn nm-overlay-btn-note';
    if (hasNote) {
        btn.classList.add('has-note');
    }
    btn.innerHTML = '📝';
    btn.title = hasNote ? '查看或编辑笔记' : '添加笔记';
    btn.style.cssText = `
        width: 24px;
        height: 24px;
        border: none;
        background: ${hasNote ? 'rgba(255, 235, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
        pointer-events: auto;
    `;
    
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        await showNoteDialogOnCanvas(nodeId);
    });
    
    return btn;
}

/**
 * 更新节点按钮位置
 */
function updateNodeButtonPosition(nodeId, node) {
    if (!overlayContainer || !node || !app.canvas) {
        return;
    }
    
    const canvas = app.canvas;
    const nodePos = node.pos;
    const nodeSize = node.size || [200, 100];
    
    // 转换为屏幕坐标
    const screenPos = canvasToScreen(nodePos, canvas);
    const scale = canvas.ds?.scale || 1;
    
    // 按钮容器
    const container = nodeButtons.get(nodeId);
    if (!container) {
        return;
    }
    
    // 计算按钮位置（节点右上角）
    // 按钮容器宽度约60px（两个按钮+间距）
    const buttonWidth = 60;
    const buttonX = screenPos[0] + nodeSize[0] * scale - buttonWidth - 4; // 距离右边4px
    const buttonY = screenPos[1] + 4; // 距离顶部4px
    
    // 确保按钮在覆盖层内
    const overlayRect = overlayContainer.getBoundingClientRect();
    const canvasRect = canvas.canvas.getBoundingClientRect();
    
    // 计算相对于覆盖层的坐标
    const relativeX = buttonX - canvasRect.left;
    const relativeY = buttonY - canvasRect.top;
    
    container.style.left = `${relativeX}px`;
    container.style.top = `${relativeY}px`;
    
    // 更新节点信息
    nodeInfoMap.set(nodeId, {
        node,
        screenPos,
        size: [nodeSize[0] * scale, nodeSize[1] * scale]
    });
    
    // 调试日志（仅第一次）
    if (!container._positionLogged) {
        console.log(`[覆盖层] 节点 ${nodeId} 按钮位置:`, {
            nodePos: [nodePos[0], nodePos[1]],
            nodeSize: [nodeSize[0], nodeSize[1]],
            screenPos: [screenPos[0], screenPos[1]],
            relativePos: [relativeX, relativeY],
            scale: scale
        });
        container._positionLogged = true;
    }
}

/**
 * 为节点添加按钮
 */
async function addButtonsToNode(node) {
    if (!node || node.id === undefined) {
        console.warn('[覆盖层] 无效的节点对象');
        return;
    }
    
    if (!overlayContainer) {
        initOverlay();
    }
    
    if (!overlayContainer) {
        console.warn('[覆盖层] 无法创建覆盖层');
        return;
    }
    
    const nodeId = node.id;
    
    // 检查是否已经添加
    if (nodeButtons.has(nodeId)) {
        // 更新位置
        updateNodeButtonPosition(nodeId, node);
        return;
    }
    
    // 获取节点池状态
    const nodePool = await import('./node_pool.js');
    const { nodePoolState } = nodePool;
    
    const isFavorited = nodePoolState.favorites.has(nodeId);
    const hasNote = !!nodePoolState.notes[nodeId];
    
    // 创建按钮容器
    const container = createNodeButtonContainer(nodeId, { node });
    
    // 创建按钮
    const favoriteBtn = createFavoriteButton(nodeId, isFavorited);
    const noteBtn = createNoteButton(nodeId, hasNote);
    
    container.appendChild(favoriteBtn);
    container.appendChild(noteBtn);
    
    // 添加到覆盖层
    overlayContainer.appendChild(container);
    nodeButtons.set(nodeId, container);
    
    // 更新位置（延迟一下确保节点位置已设置）
    setTimeout(() => {
        updateNodeButtonPosition(nodeId, node);
    }, 50);
    
    console.log('[覆盖层] ✅ 已为节点添加按钮:', nodeId, node.type || node.title);
}

/**
 * 移除节点按钮
 */
function removeNodeButtons(nodeId) {
    const container = nodeButtons.get(nodeId);
    if (container && overlayContainer) {
        overlayContainer.removeChild(container);
        nodeButtons.delete(nodeId);
        nodeInfoMap.delete(nodeId);
        console.log('[覆盖层] ✅ 已移除节点按钮:', nodeId);
    }
}

/**
 * 切换收藏状态
 */
async function toggleFavoriteOnCanvas(nodeId, buttonElement) {
    const nodePool = await import('./node_pool.js');
    const { nodePoolState, updateSpecialFoldersCount } = nodePool;
    
    const isFavorited = nodePoolState.favorites.has(nodeId);
    
    if (isFavorited) {
        nodePoolState.favorites.delete(nodeId);
        buttonElement.innerHTML = '☆';
        buttonElement.title = '收藏';
        showToast('已取消收藏', 'info');
    } else {
        nodePoolState.favorites.add(nodeId);
        buttonElement.innerHTML = '⭐';
        buttonElement.title = '取消收藏';
        showToast('已添加到收藏', 'success');
    }
    
    // 保存数据
    const { folderState } = await import('./folder_state.js');
    const { saveConfig } = await import('./folder_operations.js');
    
    // 更新配置
    if (!folderState.config) {
        folderState.config = {};
    }
    folderState.config.favorites = Array.from(nodePoolState.favorites);
    folderState.config.notes = nodePoolState.notes;
    
    if (saveConfig) {
        await saveConfig();
    }
    
    // 更新计数
    if (updateSpecialFoldersCount) {
        updateSpecialFoldersCount();
    }
}

/**
 * 显示笔记对话框
 */
async function showNoteDialogOnCanvas(nodeId) {
    const nodePool = await import('./node_pool.js');
    const { nodePoolState, escapeHtml } = nodePool;
    
    const node = nodeInfoMap.get(nodeId)?.node;
    const nodeTitle = node?.title || node?.type || nodeId;
    const existingNote = nodePoolState.notes[nodeId] || '';
    
    const overlay = document.createElement('div');
    overlay.className = 'nm-dialog-overlay';
    
    overlay.innerHTML = `
        <div class="nm-dialog" style="min-width: 500px;">
            <div class="nm-dialog-header">
                <div class="nm-dialog-title">📝 ${escapeHtml(nodeTitle)} - 笔记</div>
            </div>
            <div class="nm-dialog-body">
                <textarea class="nm-input" id="nm-note-input" 
                          style="min-height: 200px; resize: vertical; font-family: inherit;"
                          placeholder="在这里记录使用心得...">${escapeHtml(existingNote)}</textarea>
            </div>
            <div class="nm-dialog-footer">
                <button class="nm-btn" data-action="cancel">取消</button>
                <button class="nm-btn danger" data-action="delete" ${existingNote ? '' : 'style="display:none;"'}>删除笔记</button>
                <button class="nm-btn primary" data-action="save">保存</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const input = overlay.querySelector('#nm-note-input');
    if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
    
    overlay.querySelector('[data-action="cancel"]').onclick = () => {
        document.body.removeChild(overlay);
    };
    
    overlay.querySelector('[data-action="save"]').onclick = async () => {
        const note = input.value.trim();
        if (note) {
            nodePoolState.notes[nodeId] = note;
            showToast('笔记已保存', 'success');
        } else {
            delete nodePoolState.notes[nodeId];
        }
        
        // 保存数据（通过事件）
        window.dispatchEvent(new CustomEvent('nm:saveConfig'));
        
        // 更新按钮状态
        updateNodeButtonState(nodeId);
        
        document.body.removeChild(overlay);
    };
    
    overlay.querySelector('[data-action="delete"]').onclick = async () => {
        delete nodePoolState.notes[nodeId];
        showToast('笔记已删除', 'info');
        
        // 保存数据（通过事件）
        window.dispatchEvent(new CustomEvent('nm:saveConfig'));
        
        updateNodeButtonState(nodeId);
        document.body.removeChild(overlay);
    };
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}

/**
 * 更新节点按钮状态
 */
async function updateNodeButtonState(nodeId) {
    const container = nodeButtons.get(nodeId);
    if (!container) return;
    
    const nodePool = await import('./node_pool.js');
    const { nodePoolState } = nodePool;
    
    const isFavorited = nodePoolState.favorites.has(nodeId);
    const hasNote = !!nodePoolState.notes[nodeId];
    
    const favoriteBtn = container.querySelector('.nm-overlay-btn-favorite');
    if (favoriteBtn) {
        favoriteBtn.innerHTML = isFavorited ? '⭐' : '☆';
        favoriteBtn.title = isFavorited ? '取消收藏' : '收藏';
    }
    
    const noteBtn = container.querySelector('.nm-overlay-btn-note');
    if (noteBtn) {
        if (hasNote) {
            noteBtn.classList.add('has-note');
            noteBtn.style.background = 'rgba(255, 235, 59, 0.9)';
            noteBtn.title = '查看或编辑笔记';
        } else {
            noteBtn.classList.remove('has-note');
            noteBtn.style.background = 'rgba(255, 255, 255, 0.9)';
            noteBtn.title = '添加笔记';
        }
    }
}

/**
 * 更新所有按钮位置
 */
function updateAllButtonPositions() {
    if (!app || !app.graph) return;
    
    const nodes = app.graph._nodes || [];
    nodes.forEach(node => {
        if (nodeButtons.has(node.id)) {
            updateNodeButtonPosition(node.id, node);
        }
    });
}

/**
 * 监听Canvas绘制，更新按钮位置
 */
function watchCanvasDraw() {
    if (!app || !app.canvas) return;
    
    const canvas = app.canvas;
    
    // Hook Canvas的draw方法
    if (canvas.draw && typeof canvas.draw === 'function') {
        const originalDraw = canvas.draw;
        canvas.draw = function(...args) {
            const result = originalDraw.apply(this, args);
            
            // 延迟更新按钮位置（避免频繁更新）
            if (!this._buttonUpdateScheduled) {
                this._buttonUpdateScheduled = true;
                requestAnimationFrame(() => {
                    updateAllButtonPositions();
                    this._buttonUpdateScheduled = false;
                });
            }
            
            return result;
        };
        
        console.log('[覆盖层] ✅ 已Hook Canvas.draw方法');
    }
}

/**
 * 初始化画布节点覆盖层增强
 */
export async function initCanvasNodeOverlay() {
    console.log('[覆盖层] 开始初始化...');
    
    // 等待ComfyUI就绪
    if (!app || !app.canvas) {
        console.warn('[覆盖层] ComfyUI未就绪，延迟初始化...');
        setTimeout(initCanvasNodeOverlay, 500);
        return;
    }
    
    // 初始化覆盖层
    initOverlay();
    
    if (!overlayContainer) {
        console.error('[覆盖层] ❌ 覆盖层初始化失败');
        return;
    }
    
    // 监听Canvas绘制
    watchCanvasDraw();
    
    // 为现有节点添加按钮
    if (app.graph && app.graph._nodes) {
        const nodes = app.graph._nodes;
        console.log(`[覆盖层] 发现 ${nodes.length} 个现有节点，开始添加按钮...`);
        nodes.forEach(node => {
            if (node && node.id !== undefined) {
                addButtonsToNode(node);
            }
        });
    }
    
    // Hook graph.add，监听新节点
    const originalAdd = app.graph.add;
    app.graph.add = function(node) {
        const result = originalAdd.call(this, node);
        
        // 延迟添加按钮（等待节点完全初始化）
        setTimeout(() => {
            if (node && node.id !== undefined) {
                addButtonsToNode(node);
            }
        }, 100);
        
        return result;
    };
    
    // Hook graph.remove，清理按钮
    const originalRemove = app.graph.remove;
    app.graph.remove = function(node) {
        const result = originalRemove.call(this, node);
        
        if (node && node.id !== undefined) {
            removeNodeButtons(node.id);
        }
        
        return result;
    };
    
    // 监听Canvas缩放和滚动
    const canvas = app.canvas.canvas;
    if (canvas) {
        canvas.addEventListener('wheel', () => {
            updateAllButtonPositions();
        });
        
        // 监听鼠标移动，更新按钮位置（处理拖拽等情况）
        canvas.addEventListener('mousemove', () => {
            updateAllButtonPositions();
        });
    }
    
    // 定期更新按钮位置（确保位置同步）
    setInterval(() => {
        updateAllButtonPositions();
    }, 500);
    
    console.log('[覆盖层] ✅ 初始化完成');
    console.log('[覆盖层] 💡 所有节点的按钮将直接显示在节点右上角');
}

