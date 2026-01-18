// js/modules/canvas_node_enhancement.js
// 画布节点增强功能 - 在画布节点上添加笔记和收藏按钮

import { app } from "../../../scripts/app.js";
import { showToast } from './folder_state.js';

// 存储已增强的节点（避免重复处理）
const enhancedNodes = new WeakMap();

// 节点按钮容器样式
const BUTTON_CONTAINER_STYLE = `
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    gap: 4px;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
`;

const BUTTON_STYLE = `
    width: 22px;
    height: 22px;
    border: none;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: all 0.2s;
    pointer-events: auto;
`;

const BUTTON_HOVER_STYLE = `
    background: rgba(255, 255, 255, 1);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
    transform: scale(1.1);
`;

/**
 * 获取节点池状态和功能函数
 */
async function getNodePoolFunctions() {
    try {
        const nodePoolModule = await import('./node_pool.js');
        return {
            nodePoolState: nodePoolModule.nodePoolState,
            // 由于 toggleFavorite 和 showNoteDialog 没有导出，我们需要自己实现
            // 或者通过动态访问
        };
    } catch (error) {
        console.error('[画布增强] 无法加载节点池模块:', error);
        return null;
    }
}

/**
 * 获取节点信息（从LiteGraph节点对象）
 */
function getNodeInfo(liteGraphNode) {
    if (!liteGraphNode) return null;
    
    // 尝试多种方式获取节点ID
    const nodeId = liteGraphNode.type || 
                   liteGraphNode.class_type || 
                   liteGraphNode.comfyClassType ||
                   liteGraphNode.id;
    
    // 获取节点显示名称
    const displayName = liteGraphNode.title || 
                       liteGraphNode.getTitle?.() || 
                       nodeId;
    
    return {
        id: nodeId,
        displayName: displayName,
        node: liteGraphNode
    };
}

/**
 * 查找节点的DOM元素
 */
function findNodeDOM(liteGraphNode) {
    if (!liteGraphNode) return null;
    
    const nodeInfo = getNodeInfo(liteGraphNode);
    if (!nodeInfo) return null;
    
    // 方法1: 通过LiteGraph的DOM属性（最直接）
    if (liteGraphNode.domElement) {
        return liteGraphNode.domElement;
    }
    
    // 方法2: 通过LiteGraph的canvas属性查找
    // LiteGraph节点通常有canvas属性，指向画布元素
    if (liteGraphNode.canvas) {
        // 在canvas上查找节点DOM
        // LiteGraph节点DOM通常有特定的类名或属性
        const nodeElements = liteGraphNode.canvas.querySelectorAll('.lgraph_node');
        for (const elem of nodeElements) {
            // 检查是否是当前节点（通过节点ID或类型）
            if (elem.node === liteGraphNode || 
                elem.getAttribute('data-node-id') === String(liteGraphNode.id) ||
                elem.getAttribute('data-node-type') === nodeInfo.id) {
                return elem;
            }
        }
    }
    
    // 方法3: 通过ComfyUI的canvas查找
    const canvas = app?.canvas;
    if (canvas && canvas.canvas) {
        const canvasElement = canvas.canvas;
        
        // 查找所有节点DOM
        const allNodeElements = canvasElement.querySelectorAll('.lgraph_node, .node, [class*="node"]');
        
        // 通过节点ID匹配
        for (const domNode of allNodeElements) {
            // 检查节点的各种属性
            const nodeId = domNode.getAttribute('data-node-id') || 
                          domNode.getAttribute('data-node-type') ||
                          domNode.id ||
                          domNode.getAttribute('data-id');
            
            // 检查是否是当前节点
            if (domNode.node === liteGraphNode) {
                return domNode;
            }
            
            // 通过ID匹配
            if (nodeId === nodeInfo.id || 
                nodeId === String(liteGraphNode.id) ||
                nodeId === liteGraphNode.type) {
                return domNode;
            }
        }
        
        // 方法4: 通过节点位置匹配（最后手段）
        if (liteGraphNode.pos) {
            const nodePos = liteGraphNode.pos;
            
            for (const domNode of allNodeElements) {
                // 检查DOM节点的位置
                const rect = domNode.getBoundingClientRect();
                const canvasRect = canvasElement.getBoundingClientRect();
                
                // 转换为画布坐标
                const scale = canvas.ds?.scale || 1;
                const offset = canvas.ds?.offset || [0, 0];
                const domX = (rect.left - canvasRect.left) / scale - offset[0];
                const domY = (rect.top - canvasRect.top) / scale - offset[1];
                
                // 如果位置接近（误差在100像素内）
                const distance = Math.sqrt(
                    Math.pow(domX - nodePos[0], 2) + 
                    Math.pow(domY - nodePos[1], 2)
                );
                
                if (distance < 100) {
                    // 进一步检查节点类型
                    const nodeType = domNode.getAttribute('data-node-type') || 
                                   domNode.className ||
                                   '';
                    if (nodeType.includes(nodeInfo.id) || 
                        nodeType.includes(liteGraphNode.type) ||
                        domNode.node === liteGraphNode) {
                        return domNode;
                    }
                }
            }
        }
    }
    
    return null;
}

/**
 * 创建按钮容器
 */
function createButtonContainer(nodeInfo) {
    const container = document.createElement('div');
    container.className = 'nm-canvas-node-buttons';
    container.style.cssText = BUTTON_CONTAINER_STYLE;
    container.setAttribute('data-node-id', nodeInfo.id);
    
    // 鼠标悬停时显示按钮
    let hoverTimeout;
    const showButtons = () => {
        clearTimeout(hoverTimeout);
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
    };
    
    const hideButtons = () => {
        hoverTimeout = setTimeout(() => {
            container.style.opacity = '0';
            container.style.pointerEvents = 'none';
        }, 200);
    };
    
    // 监听父节点（节点DOM）的鼠标事件
    const parentNode = container.parentElement;
    if (parentNode) {
        parentNode.addEventListener('mouseenter', showButtons);
        parentNode.addEventListener('mouseleave', hideButtons);
    }
    
    return container;
}

/**
 * 创建收藏按钮
 */
function createFavoriteButton(nodeInfo, isFavorited) {
    const btn = document.createElement('button');
    btn.className = 'nm-canvas-btn nm-canvas-btn-favorite';
    btn.innerHTML = isFavorited ? '⭐' : '☆';
    btn.title = isFavorited ? '取消收藏' : '收藏';
    btn.style.cssText = BUTTON_STYLE;
    
    // 悬停效果
    btn.addEventListener('mouseenter', () => {
        btn.style.cssText = BUTTON_STYLE + BUTTON_HOVER_STYLE;
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.cssText = BUTTON_STYLE;
    });
    
    // 点击事件
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        await toggleFavoriteOnCanvas(nodeInfo.id, btn);
    });
    
    return btn;
}

/**
 * 创建笔记按钮
 */
function createNoteButton(nodeInfo, hasNote) {
    const btn = document.createElement('button');
    btn.className = 'nm-canvas-btn nm-canvas-btn-note';
    if (hasNote) {
        btn.classList.add('has-note');
    }
    btn.innerHTML = '📝';
    btn.title = hasNote ? '查看或编辑笔记' : '添加笔记';
    btn.style.cssText = BUTTON_STYLE;
    
    // 如果有笔记，添加提示样式
    if (hasNote) {
        btn.style.background = 'rgba(255, 235, 59, 0.9)';
    }
    
    // 悬停效果
    btn.addEventListener('mouseenter', () => {
        btn.style.cssText = BUTTON_STYLE + BUTTON_HOVER_STYLE;
        if (hasNote) {
            btn.style.background = 'rgba(255, 235, 59, 1)';
        }
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.cssText = BUTTON_STYLE;
        if (hasNote) {
            btn.style.background = 'rgba(255, 235, 59, 0.9)';
        }
    });
    
    // 点击事件
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        await showNoteDialogOnCanvas(nodeInfo);
    });
    
    return btn;
}

/**
 * 在画布上切换收藏状态
 */
async function toggleFavoriteOnCanvas(nodeId, buttonElement) {
    const nodePool = await getNodePoolFunctions();
    if (!nodePool) {
        showToast('无法访问节点池功能', 'error');
        return;
    }
    
    const { nodePoolState } = nodePool;
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
    await saveUserData();
    
    // 更新特殊文件夹计数
    const { updateSpecialFoldersCount } = await import('./node_pool.js');
    if (updateSpecialFoldersCount) {
        updateSpecialFoldersCount();
    }
}

/**
 * 在画布上显示笔记对话框
 */
async function showNoteDialogOnCanvas(nodeInfo) {
    const nodePool = await getNodePoolFunctions();
    if (!nodePool) {
        showToast('无法访问节点池功能', 'error');
        return;
    }
    
    const { nodePoolState } = nodePool;
    const existingNote = nodePoolState.notes[nodeInfo.id] || '';
    
    // 导入 escapeHtml
    const { escapeHtml } = await import('./node_pool.js');
    
    const overlay = document.createElement('div');
    overlay.className = 'nm-dialog-overlay';
    
    overlay.innerHTML = `
        <div class="nm-dialog" style="min-width: 500px;">
            <div class="nm-dialog-header">
                <div class="nm-dialog-title">📝 ${escapeHtml(nodeInfo.displayName)} - 笔记</div>
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
    
    // 聚焦到输入框
    const input = overlay.querySelector('#nm-note-input');
    if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
    
    // 绑定按钮事件
    overlay.querySelector('[data-action="cancel"]').onclick = () => {
        document.body.removeChild(overlay);
    };
    
    overlay.querySelector('[data-action="save"]').onclick = async () => {
        const note = input.value.trim();
        if (note) {
            nodePoolState.notes[nodeInfo.id] = note;
            showToast('笔记已保存', 'success');
        } else {
            delete nodePoolState.notes[nodeInfo.id];
        }
        
        await saveUserData();
        
        // 更新画布节点按钮状态
        updateCanvasNodeButtons(nodeInfo.id);
        
        document.body.removeChild(overlay);
    };
    
    overlay.querySelector('[data-action="delete"]').onclick = async () => {
        delete nodePoolState.notes[nodeInfo.id];
        showToast('笔记已删除', 'info');
        
        await saveUserData();
        
        // 更新画布节点按钮状态
        updateCanvasNodeButtons(nodeInfo.id);
        
        document.body.removeChild(overlay);
    };
    
    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}

/**
 * 保存用户数据
 */
async function saveUserData() {
    try {
        const nodePool = await getNodePoolFunctions();
        if (!nodePool) return;
        
        const { nodePoolState } = nodePool;
        const { folderState } = await import('./folder_state.js');
        
        // 更新配置
        if (!folderState.config) {
            folderState.config = {};
        }
        folderState.config.favorites = Array.from(nodePoolState.favorites);
        folderState.config.notes = nodePoolState.notes;
        
        // 保存配置
        const { saveConfig } = await import('./folder_operations.js');
        if (saveConfig) {
            await saveConfig();
        }
    } catch (error) {
        console.error('[画布增强] 保存用户数据失败:', error);
    }
}

/**
 * 更新画布节点按钮状态
 */
async function updateCanvasNodeButtons(nodeId) {
    const nodePool = await getNodePoolFunctions();
    if (!nodePool) return;
    
    const { nodePoolState } = nodePool;
    const isFavorited = nodePoolState.favorites.has(nodeId);
    const hasNote = !!nodePoolState.notes[nodeId];
    
    // 查找按钮容器
    const buttonContainer = document.querySelector(`.nm-canvas-node-buttons[data-node-id="${nodeId}"]`);
    if (!buttonContainer) return;
    
    // 更新收藏按钮
    const favoriteBtn = buttonContainer.querySelector('.nm-canvas-btn-favorite');
    if (favoriteBtn) {
        favoriteBtn.innerHTML = isFavorited ? '⭐' : '☆';
        favoriteBtn.title = isFavorited ? '取消收藏' : '收藏';
    }
    
    // 更新笔记按钮
    const noteBtn = buttonContainer.querySelector('.nm-canvas-btn-note');
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
 * 增强单个节点（添加按钮）
 */
async function enhanceNode(liteGraphNode) {
    // 检查是否已经增强过
    if (enhancedNodes.has(liteGraphNode)) {
        return;
    }
    
    const nodeInfo = getNodeInfo(liteGraphNode);
    if (!nodeInfo) {
        console.warn('[画布增强] 无法获取节点信息');
        return;
    }
    
    // 查找节点DOM（带重试机制）
    let nodeDOM = findNodeDOM(liteGraphNode);
    
    // 如果立即找不到，延迟重试（等待DOM渲染）
    if (!nodeDOM) {
        // 多次重试，因为DOM渲染可能需要时间
        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = 100;
        
        const retryFindDOM = () => {
            retryCount++;
            nodeDOM = findNodeDOM(liteGraphNode);
            
            if (nodeDOM) {
                doEnhanceNode(nodeDOM, nodeInfo, liteGraphNode);
            } else if (retryCount < maxRetries) {
                setTimeout(retryFindDOM, retryInterval);
            } else {
                console.warn('[画布增强] 无法找到节点DOM（已重试10次）:', nodeInfo.id, '节点类型:', liteGraphNode.type);
            }
        };
        
        setTimeout(retryFindDOM, retryInterval);
        return;
    }
    
    doEnhanceNode(nodeDOM, nodeInfo, liteGraphNode);
}

/**
 * 执行节点增强
 */
async function doEnhanceNode(nodeDOM, nodeInfo, liteGraphNode) {
    // 检查是否已经增强过
    const existingContainer = nodeDOM.querySelector('.nm-canvas-node-buttons');
    if (existingContainer) {
        return; // 已经增强过
    }
    
    // 获取节点池状态
    const nodePool = await getNodePoolFunctions();
    if (!nodePool) {
        console.warn('[画布增强] 无法加载节点池模块');
        return;
    }
    
    const { nodePoolState } = nodePool;
    const isFavorited = nodePoolState.favorites.has(nodeInfo.id);
    const hasNote = !!nodePoolState.notes[nodeInfo.id];
    
    // 确保节点DOM有相对定位
    const nodeStyle = window.getComputedStyle(nodeDOM);
    if (nodeStyle.position === 'static') {
        nodeDOM.style.position = 'relative';
    }
    
    // 创建按钮容器
    const buttonContainer = createButtonContainer(nodeInfo);
    
    // 创建按钮
    const favoriteBtn = createFavoriteButton(nodeInfo, isFavorited);
    const noteBtn = createNoteButton(nodeInfo, hasNote);
    
    buttonContainer.appendChild(favoriteBtn);
    buttonContainer.appendChild(noteBtn);
    
    // 添加到节点DOM
    nodeDOM.appendChild(buttonContainer);
    
    // 标记为已增强
    enhancedNodes.set(liteGraphNode, buttonContainer);
    
    console.log('[画布增强] ✅ 节点已增强:', nodeInfo.id);
}

/**
 * 增强画布上的所有现有节点
 */
async function enhanceAllExistingNodes() {
    if (!app || !app.graph) {
        console.warn('[画布增强] ComfyUI 未就绪');
        return;
    }
    
    const nodes = app.graph._nodes || [];
    console.log(`[画布增强] 发现 ${nodes.length} 个现有节点，开始增强...`);
    
    for (const node of nodes) {
        await enhanceNode(node);
    }
    
    console.log('[画布增强] ✅ 所有现有节点增强完成');
}

/**
 * 初始化画布节点增强功能
 */
export async function initCanvasNodeEnhancement() {
    console.log('[画布增强] 开始初始化...');
    
    // 等待ComfyUI就绪
    if (!app || !app.graph) {
        console.warn('[画布增强] ComfyUI 未就绪，延迟初始化...');
        setTimeout(initCanvasNodeEnhancement, 500);
        return;
    }
    
    // 增强现有节点
    await enhanceAllExistingNodes();
    
    // Hook graph.add 方法，监听新节点添加
    const originalAdd = app.graph.add;
    app.graph.add = function(node) {
        // 调用原始方法
        const result = originalAdd.call(this, node);
        
        // 延迟增强新节点（等待DOM渲染）
        setTimeout(() => {
            enhanceNode(node);
        }, 50);
        
        return result;
    };
    
    console.log('[画布增强] ✅ 已Hook graph.add 方法');
    
    // 监听工作流加载（从文件加载时）
    if (app.graph && app.graph.onNodeAdded) {
        const originalOnNodeAdded = app.graph.onNodeAdded;
        app.graph.onNodeAdded = function(node) {
            if (originalOnNodeAdded) {
                originalOnNodeAdded.call(this, node);
            }
            
            setTimeout(() => {
                enhanceNode(node);
            }, 50);
        };
    }
    
    console.log('[画布增强] ✅ 初始化完成');
}

