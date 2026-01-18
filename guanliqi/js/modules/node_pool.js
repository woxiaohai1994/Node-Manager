// js/node_pool.js
// 节点池显示和管理

import { fetchNodes } from './node_api.js';
import { folderState, showToast } from './folder_state.js';
import { app } from '../../../scripts/app.js';
import { openModalSearch, checkAutoCloseOnAdd } from './modal_search.js';

// 节点池状态
const nodePoolState = {
    allNodes: [],           // 所有节点
    plugins: [],            // 按插件分组的节点
    currentNodes: [],       // 当前显示的节点
    currentContext: null,   // 当前上下文 {type: 'folder'|'plugin', id: string}
    favorites: new Set(),   // 收藏的节点ID
    notes: {},              // 节点笔记 {nodeId: note}
    selectedHiddenPlugins: new Set(),  // 选中的隐藏插件
    lastSelectedHiddenPlugin: null,    // 最后选中的隐藏插件（用于Shift多选）
    
    // 编辑模式相关
    editMode: false,        // 是否处于编辑模式
    selectedNodes: new Set(),  // 选中的节点ID
    lastSelectedNode: null,    // 最后选中的节点（用于Shift多选）
    
    // 布局模式
    layoutMode: 'center',   // 布局模式：'center' 或 'split'
    
    // 搜索相关
    searchActive: false,    // 是否正在搜索
    
    // 互联网模式相关
    internetMode: false,        // 是否处于互联网模式
    availablePlugins: [],       // 在线可用插件列表
    internetFilter: 'all',      // 筛选：'all' | 'installed' | 'uninstalled'
    internetSort: 'random',     // 排序：'random' | 'name' | 'updated' | 'stars'（默认随机）
    
    searchKeyword: '',      // 当前搜索关键词
    searchResults: {        // 搜索结果
        nodes: [],
        folders: []
    },
    pinyinCache: {},        // 拼音数据缓存 {text: {initials, full}}
    searchHistory: [],      // 搜索历史（用于返回）
    
    // 虚拟滚动相关
    virtualScroll: {
        enabled: true,      // 是否启用虚拟滚动
        itemHeight: 120,    // 每个节点卡片的高度（px）
        visibleStart: 0,    // 可视区域起始索引
        visibleEnd: 0,      // 可视区域结束索引
        buffer: 15,         // 缓冲区（上下各渲染15行额外的项，避免快速滚动时出现空白）
        scrollTop: 0,       // 当前滚动位置
        scrollHandler: null // 滚动事件处理器
    }
};

/**
 * 初始化节点池
 */
async function initNodePool() {
    try {
        console.log('[节点池] 开始加载节点...');
        const data = await fetchNodes();
        
        nodePoolState.allNodes = data.nodes;
        nodePoolState.plugins = data.plugins;
        
        console.log(`[节点池] 加载完成，共 ${data.totalCount} 个节点`);
        console.log('[节点池] 插件分组:', nodePoolState.plugins.length, '个');
        console.log('[节点池] allNodes示例:', nodePoolState.allNodes.slice(0, 3));
        
        // 统计各插件节点数
        const sourceCount = {};
        nodePoolState.allNodes.forEach(node => {
            sourceCount[node.source] = (sourceCount[node.source] || 0) + 1;
        });
        console.log('[节点池] 各插件节点数:', sourceCount);
        
        // 加载用户数据（收藏、笔记）
        loadUserData();
        
        // 暴露 nodePoolState 到 window，供其他模块使用
        window.nodePoolState = nodePoolState;
        
        // 默认显示"我的分类"（收藏节点）
        console.log('[节点池] 默认显示"我的分类"（收藏节点）');
        showFavoriteNodes();
        
        // 自动选中左侧的"收藏"文件夹
        setTimeout(() => {
            const favoritesFolder = document.querySelector('.nm-special-folder[data-special-id="favorites"]');
            if (favoritesFolder) {
                // 清除其他选中状态
                document.querySelectorAll('.nm-special-folder, .nm-plugin-item, .nm-folder-item, .nm-category-item').forEach(el => {
                    el.classList.remove('active');
                });
                // 激活收藏文件夹
                favoritesFolder.classList.add('active');
                console.log('[节点池] ✅ 已自动选中"收藏"文件夹');
            }
        }, 100);
        
        // 更新特殊文件夹计数（未分类等）- 通过事件通知
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('nm:requestUpdateFolderCounts'));
        }, 100);
        
        // 通知插件列表重新渲染，以更新节点数量
        setTimeout(() => {
            console.log('[节点池] nodePoolState 已就绪，触发插件列表刷新');
            window.dispatchEvent(new CustomEvent('nm:nodePoolReady'));
        }, 100);
        
        // 初始化画布拖拽监听
        initCanvasDragDrop();
        
        // 初始化旧版全屏搜索功能（保留，但会被拦截）
        initSearch();
        
        // 初始化侧边栏搜索功能
        initSidebarSearch();
        
        // 拦截ComfyUI双击画布搜索，转为打开我们的侧边栏搜索
        interceptCanvasDoubleClick();
        
        // 监听编辑模式变化
        window.addEventListener('nm:editModeChanged', (e) => {
            nodePoolState.editMode = e.detail.enabled;
            console.log('[节点池] 编辑模式已', nodePoolState.editMode ? '开启' : '关闭');
            
            // 切换模式时清空选择
            clearNodeSelection();
            
            // 更新工具栏显示
            updateBulkOperationToolbar();
        });
        
        // 监听布局模式变化
        window.addEventListener('nm:layoutModeChanged', (e) => {
            nodePoolState.layoutMode = e.detail.mode;
            console.log('[节点池] 布局模式已切换为:', nodePoolState.layoutMode);
            
            // 如果有正在显示的预览，更新其定位
            if (previewOverlay && currentPreviewNodeId) {
                updatePreviewPosition();
            }
        });
        
        // 监听宽度变化（左右布局拖动调整）
        window.addEventListener('nm:splitWidthChanged', () => {
            if (nodePoolState.layoutMode === 'split' && previewOverlay && currentPreviewNodeId) {
                updatePreviewPosition();
            }
        });
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            if (nodePoolState.layoutMode === 'split' && previewOverlay && currentPreviewNodeId) {
                updatePreviewPosition();
            }
        });
        
        // 监听用户交互，在操作时暂停后台更新
        let userInteractionTimer = null;
        const pauseBackgroundUpdate = () => {
            lazyLoadState.isPaused = true;
            clearTimeout(userInteractionTimer);
            // 2秒无操作后恢复
            userInteractionTimer = setTimeout(() => {
                lazyLoadState.isPaused = false;
            }, 2000);
        };
        
        // 监听各种用户交互事件
        document.addEventListener('scroll', pauseBackgroundUpdate, { passive: true, capture: true });
        document.addEventListener('mousemove', pauseBackgroundUpdate, { passive: true });
        document.addEventListener('click', pauseBackgroundUpdate);
        document.addEventListener('keydown', pauseBackgroundUpdate);
        
        // 智能暂停机制已启用（静默）
        
    } catch (error) {
        console.error('[节点池] 加载失败:', error);
        showToast('加载节点失败', 'error');
    }
}

/**
 * 初始化画布拖拽监听
 * 自己实现drop处理器，和点击使用同一个创建方法
 */
function initCanvasDragDrop() {
    if (!app || !app.canvas || !app.canvas.canvas) {
        console.warn('[节点池] 画布尚未就绪，稍后重试');
        setTimeout(initCanvasDragDrop, 500);
        return;
    }
    
    const canvas = app.canvas.canvas;
    
    // 允许drop
    canvas.addEventListener('dragover', (e) => {
        if (window.__draggingFromNodePool) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
        }
    });
    
    // 处理drop
    canvas.addEventListener('drop', (e) => {
        if (window.__draggingFromNodePool && window.__draggingNode) {
            e.preventDefault();
            e.stopPropagation();
            
            const node = window.__draggingNode;
            console.log('[节点池] 拖拽到画布:', node.display_name);
            
            // 获取鼠标在画布上的坐标
            const canvasPos = app.canvas.convertEventToCanvasOffset(e);
            
            // 调用和点击一样的方法！只是位置不同！
            createNodeOnCanvas(node, canvasPos);
            
            // 清理
            window.__draggingNode = null;
            window.__draggingFromNodePool = false;
        }
    });
    
    console.log('[节点池] 画布拖拽监听已初始化');
}

/**
 * 加载用户数据（收藏、笔记）
 */
function loadUserData() {
    const config = folderState.config;
    if (!config) return;
    
    // 加载收藏
    if (config.favorites) {
        nodePoolState.favorites = new Set(config.favorites);
    }
    
    // 加载笔记
    if (config.notes) {
        nodePoolState.notes = config.notes;
    }
    
    // 加载完成后更新UI计数
    setTimeout(() => {
        updateSpecialFoldersCount();
    }, 100);
    
    window.dispatchEvent(new CustomEvent('nm:userDataLoaded', {
        detail: {
            favorites: Array.from(nodePoolState.favorites),
            notes: Object.keys(nodePoolState.notes || {})
        }
    }));
}

/**
 * 保存用户数据
 */
async function saveUserData(changes = { favorites: true, notes: true }) {
    if (!folderState.config) return;
    
    folderState.config.favorites = Array.from(nodePoolState.favorites);
    folderState.config.notes = nodePoolState.notes;
    
    // 触发配置保存
    window.dispatchEvent(new CustomEvent('nm:saveConfig'));
    
    window.dispatchEvent(new CustomEvent('nm:userDataUpdated', {
        detail: {
            favorites: changes?.favorites !== false,
            notes: changes?.notes !== false
        }
    }));
}

/**
 * 渲染节点池
 */
function renderNodePool(nodes) {
    // 查找所有节点池容器（侧边栏 + Modal）
    const containers = document.querySelectorAll('#nm-node-pool-body');
    if (containers.length === 0) {
        console.error('[节点池] 未找到容器元素 #nm-node-pool-body');
        return;
    }
    
    nodePoolState.currentNodes = nodes;
    
    // 为每个容器渲染节点
    containers.forEach(container => {
    if (!nodes || nodes.length === 0) {
        container.innerHTML = `
            <div class="nm-empty-state">
                <div class="nm-empty-state-icon">📦</div>
                <div class="nm-empty-state-text">暂无节点</div>
                <div class="nm-empty-state-hint">请选择左侧文件夹或插件来源</div>
            </div>
        `;
        return;
    }
    
        // 如果节点数量较少（小于 30），不使用虚拟滚动
        if (nodes.length < 30 || !nodePoolState.virtualScroll.enabled) {
            renderAllNodes(container, nodes);
        } else {
            // 使用虚拟滚动渲染大量节点
            renderVirtualScrollNodes(container, nodes);
        }
    });
}

/**
 * 渲染所有节点（无虚拟滚动）
 */
function renderAllNodes(container, nodes) {
    const grid = document.createElement('div');
    grid.className = 'nm-node-grid';
    
    nodes.forEach(node => {
        const card = createNodeCard(node);
        grid.appendChild(card);
    });
    
    container.innerHTML = '';
    container.appendChild(grid);
}

/**
 * 使用虚拟滚动渲染节点
 */
function renderVirtualScrollNodes(container, nodes) {
    console.log(`[虚拟滚动] 渲染 ${nodes.length} 个节点，使用虚拟滚动优化`);
    
    // 清除之前的滚动监听
    if (nodePoolState.virtualScroll.scrollHandler) {
        container.removeEventListener('scroll', nodePoolState.virtualScroll.scrollHandler);
    }
    
    // 创建虚拟滚动容器
    const wrapper = document.createElement('div');
    wrapper.className = 'nm-virtual-scroll-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    
    // 计算总高度
    const totalHeight = Math.ceil(nodes.length / 3) * nodePoolState.virtualScroll.itemHeight;
    wrapper.style.height = `${totalHeight}px`;
    
    // 创建内容容器
    const content = document.createElement('div');
    content.className = 'nm-node-grid nm-virtual-scroll-content';
    content.style.position = 'absolute';
    content.style.top = '0';
    content.style.left = '0';
    content.style.right = '0';
    
    wrapper.appendChild(content);
    container.innerHTML = '';
    container.appendChild(wrapper);
    
    // 渲染可见节点的函数
    const renderVisibleNodes = () => {
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        
        // 计算可见的行范围
        const startRow = Math.floor(scrollTop / nodePoolState.virtualScroll.itemHeight) - nodePoolState.virtualScroll.buffer;
        const endRow = Math.ceil((scrollTop + containerHeight) / nodePoolState.virtualScroll.itemHeight) + nodePoolState.virtualScroll.buffer;
        
        // 转换为节点索引（每行 3 个节点）
        const startIndex = Math.max(0, startRow * 3);
        const endIndex = Math.min(nodes.length, endRow * 3);
        
        // 更新状态
        nodePoolState.virtualScroll.visibleStart = startIndex;
        nodePoolState.virtualScroll.visibleEnd = endIndex;
        nodePoolState.virtualScroll.scrollTop = scrollTop;
        
        // 清空并渲染可见节点
        content.innerHTML = '';
        content.style.transform = `translateY(${Math.floor(startIndex / 3) * nodePoolState.virtualScroll.itemHeight}px)`;
        
        for (let i = startIndex; i < endIndex; i++) {
            const node = nodes[i];
            if (node) {
                const card = createNodeCard(node);
                content.appendChild(card);
            }
        }
        
        // 只在调试时输出日志（避免滚动时刷屏）
        // console.log(`[虚拟滚动] 渲染节点 ${startIndex}-${endIndex} (共 ${endIndex - startIndex} 个)`);
    };
    
    // 使用 requestAnimationFrame 优化滚动性能
    let scrollTicking = false;
    nodePoolState.virtualScroll.scrollHandler = () => {
        if (!scrollTicking) {
            requestAnimationFrame(() => {
                renderVisibleNodes();
                scrollTicking = false;
            });
            scrollTicking = true;
        }
    };
    
    // 绑定滚动事件
    container.addEventListener('scroll', nodePoolState.virtualScroll.scrollHandler);
    
    // 初始渲染
    renderVisibleNodes();
}

/**
 * 获取节点显示名称（优先使用自定义名称）
 */
function getNodeDisplayName(node) {
    // 检查是否有自定义名称
    if (folderState.config && folderState.config.nodeCustomNames && folderState.config.nodeCustomNames[node.id]) {
        return folderState.config.nodeCustomNames[node.id];
    }
    // 否则使用原始显示名称
    return node.display_name || node.id;
}

/**
 * 创建节点卡片
 */
function createNodeCard(node) {
    const card = document.createElement('div');
    card.className = 'nm-node-card';
    card.dataset.nodeId = node.id;
    card.dataset.classType = node.class_type;
    card.draggable = true;
    
    // 是否收藏
    const isFavorited = nodePoolState.favorites.has(node.id);
    if (isFavorited) {
        card.classList.add('favorited');
    }
    
    // 是否有笔记
    const hasNote = !!nodePoolState.notes[node.id];
    
    // 获取显示名称（优先使用自定义名称）
    const displayName = getNodeDisplayName(node);
    
    card.innerHTML = `
        <div class="nm-node-card-header">
            <div class="nm-node-card-icon">🔧</div>
            <div class="nm-node-card-actions">
                <button class="nm-node-card-btn favorite ${isFavorited ? 'active' : ''}" 
                        data-action="favorite" title="${isFavorited ? '取消收藏' : '收藏'}">
                    <span class="nm-btn-icon">${isFavorited ? '⭐' : '☆'}</span>
                    <span class="nm-btn-text">收藏</span>
                </button>
                <button class="nm-node-card-btn note ${hasNote ? 'has-note' : ''}" 
                        data-action="note" title="${hasNote ? '查看或编辑笔记' : '添加笔记'}">
                    <span class="nm-btn-icon">📝</span>
                    <span class="nm-btn-text">笔记</span>
                    ${hasNote ? `<div class="nm-note-preview">${escapeHtml(truncateText(nodePoolState.notes[node.id] || '', 150))}</div>` : ''}
                </button>
            </div>
        </div>
        <div class="nm-node-card-name">${escapeHtml(displayName)}</div>
        ${node.category ? `<div class="nm-node-card-category">${escapeHtml(node.category)}</div>` : ''}
        <div class="nm-node-card-source">${escapeHtml(node.source)}</div>
    `;
    
    // 绑定事件
    bindNodeCardEvents(card, node);
    
    return card;
}

/**
 * 绑定节点卡片事件
 */
function bindNodeCardEvents(card, node) {
    // 点击卡片：编辑模式下选择，普通模式下加载到画布
    card.addEventListener('click', (e) => {
        // 如果点击的是按钮，不触发卡片点击
        if (e.target.closest('[data-action]')) {
            return;
        }
        
        if (nodePoolState.editMode) {
            // 编辑模式：选择节点
            handleNodeSelection(node, card, e);
        } else {
            // 普通模式：加载到画布
            console.log('[节点池] 点击节点:', node.display_name);
            createNodeOnCanvas(node);
        }
    });
    
    // 双击卡片：编辑模式下加载到画布（遵循图钉逻辑）
    card.addEventListener('dblclick', (e) => {
        // 如果点击的是按钮，不触发
        if (e.target.closest('[data-action]')) {
            return;
        }
        
        if (nodePoolState.editMode) {
            // 编辑模式下双击：加载到画布
            console.log('[节点池] 编辑模式双击节点:', node.display_name);
            createNodeOnCanvas(node);
            // 触发自动关闭检查（遵循图钉逻辑）
            import('./modal_search.js').then(module => {
                module.checkAutoCloseOnAdd();
            });
        }
    });
    
    // 收藏按钮
    const favoriteBtn = card.querySelector('[data-action="favorite"]');
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(node.id, card);
        });
    }
    
    // 笔记按钮
    const noteBtn = card.querySelector('[data-action="note"]');
    if (noteBtn) {
        noteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showNoteDialog(node);
        });
    }
    
    // 拖拽事件 - 支持拖到画布和拖到文件夹
    card.ondragstart = (e) => {
        console.log('[节点池] 开始拖拽节点:', node.display_name, 'node.id:', node.id);
        
        // 保存节点对象到全局变量（用于拖到画布）
        window.__draggingNode = node;
        window.__draggingFromNodePool = true;
        
        // 检查是否在编辑模式且有多个选中的节点
        let draggedNodeIds = [node.id];
        let dragCount = 1;
        
        if (nodePoolState.editMode && nodePoolState.selectedNodes.size > 0) {
            // 如果当前节点在选中列表中，拖动所有选中的节点
            if (nodePoolState.selectedNodes.has(node.id)) {
                draggedNodeIds = Array.from(nodePoolState.selectedNodes);
                dragCount = draggedNodeIds.length;
                console.log(`[批量拖动] 拖动${dragCount}个选中的节点`);
            } else {
                // 如果当前节点不在选中列表，只拖动当前节点
                // 清空选中状态
                nodePoolState.selectedNodes.clear();
                nodePoolState.selectedNodes.add(node.id);
                updateSelectionUI();
            }
        }
        
        // 文件夹拖拽格式（使用nodeId或nodeIds）
        if (dragCount === 1) {
            e.dataTransfer.setData('nodeId', node.id);
        } else {
            e.dataTransfer.setData('nodeIds', JSON.stringify(draggedNodeIds));
            e.dataTransfer.setData('batchDrag', 'true');
        }
        e.dataTransfer.setData('node-type', node.id);
        e.dataTransfer.effectAllowed = 'copy';
        
        // 所有选中的卡片都降低透明度
        if (dragCount > 1) {
            draggedNodeIds.forEach(id => {
                const selectedCard = document.querySelector(`.nm-node-card[data-node-id="${id}"]`);
                if (selectedCard) {
                    selectedCard.style.opacity = '0.5';
                }
            });
            
            // 创建拖动提示
            const dragImage = document.createElement('div');
            dragImage.style.cssText = `
                position: absolute;
                top: -1000px;
                left: -1000px;
                background: var(--comfy-menu-bg, #1e1e1e);
                border: 2px solid var(--primary-color, #007bff);
                border-radius: 8px;
                padding: 10px 16px;
                font-size: 14px;
                font-weight: bold;
                color: var(--primary-color, #007bff);
                box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
                pointer-events: none;
                white-space: nowrap;
            `;
            dragImage.textContent = `📦 ${dragCount} 个节点`;
            document.body.appendChild(dragImage);
            e.dataTransfer.setDragImage(dragImage, 50, 25);
            
            // 延迟移除
            setTimeout(() => dragImage.remove(), 0);
        } else {
            card.style.opacity = '0.5';
        }
    };
    
    card.ondragend = () => {
        // 恢复所有选中的卡片透明度
        if (nodePoolState.editMode && nodePoolState.selectedNodes.size > 0) {
            nodePoolState.selectedNodes.forEach(id => {
                const selectedCard = document.querySelector(`.nm-node-card[data-node-id="${id}"]`);
                if (selectedCard) {
                    selectedCard.style.opacity = '1';
                }
            });
        } else {
            card.style.opacity = '1';
        }
        
        // 清理全局变量
        window.__draggingNode = null;
        window.__draggingFromNodePool = false;
    };
    
    // 节点预览 - 鼠标悬停
    card.addEventListener('mouseenter', (e) => {
        scheduleNodePreview(node.id, node.display_name, e);
    });
    
    card.addEventListener('mouseleave', () => {
        // 检查侧边栏是否仍然可见，如果不可见则立即清理
        const sidebarContainer = card.closest('[id*="xiaohai"], [class*="sidebar"], [class*="nm-container"]');
        if (sidebarContainer && (
            sidebarContainer.offsetParent === null || 
            window.getComputedStyle(sidebarContainer).display === 'none'
        )) {
            // 侧边栏已关闭，立即清理预览
            forceCleanupPreview();
        } else {
            // 正常延迟隐藏
            scheduleHidePreview();
        }
    });
    
    // 右键菜单
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showNodeContextMenu(e, node, card);
    });
}

/**
 * 处理节点选择（编辑模式）
 */
function handleNodeSelection(node, card, event) {
    const nodeId = node.id;
    
    if (event.ctrlKey || event.metaKey) {
        // Ctrl: 切换选中状态
        if (nodePoolState.selectedNodes.has(nodeId)) {
            nodePoolState.selectedNodes.delete(nodeId);
            card.classList.remove('selected');
        } else {
            nodePoolState.selectedNodes.add(nodeId);
            card.classList.add('selected');
        }
        nodePoolState.lastSelectedNode = nodeId;
    } else if (event.shiftKey && nodePoolState.lastSelectedNode) {
        // Shift: 范围选择
        selectNodeRange(nodePoolState.lastSelectedNode, nodeId);
    } else {
        // 普通点击: 单选
        clearNodeSelection();
        nodePoolState.selectedNodes.add(nodeId);
        card.classList.add('selected');
        nodePoolState.lastSelectedNode = nodeId;
    }
    
    console.log('[编辑模式] 已选中节点:', Array.from(nodePoolState.selectedNodes));
    
    // 更新工具栏
    updateBulkOperationToolbar();
}

/**
 * 范围选择节点
 */
function selectNodeRange(fromNodeId, toNodeId) {
    const currentNodesIds = nodePoolState.currentNodes.map(n => n.id);
    const fromIndex = currentNodesIds.indexOf(fromNodeId);
    const toIndex = currentNodesIds.indexOf(toNodeId);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    
    // 选中范围内的所有节点
    for (let i = start; i <= end; i++) {
        const nodeId = currentNodesIds[i];
        nodePoolState.selectedNodes.add(nodeId);
        
        // 更新UI
        const card = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (card) {
            card.classList.add('selected');
        }
    }
}

/**
 * 清空节点选择
 */
function clearNodeSelection() {
    nodePoolState.selectedNodes.clear();
    nodePoolState.lastSelectedNode = null;
    
    // 移除所有选中样式
    document.querySelectorAll('.nm-node-card.selected').forEach(card => {
        card.classList.remove('selected');
    });
    
    // 更新工具栏
    updateBulkOperationToolbar();
}

/**
 * 更新批量操作工具栏
 */
function updateBulkOperationToolbar() {
    // 查找或创建工具栏
    let toolbar = document.getElementById('nm-bulk-operation-toolbar');
    
    if (!toolbar && nodePoolState.editMode && nodePoolState.selectedNodes.size > 0) {
        // 创建工具栏
        toolbar = document.createElement('div');
        toolbar.id = 'nm-bulk-operation-toolbar';
        toolbar.className = 'nm-bulk-operation-toolbar';
        toolbar.style.cssText = `
            position: sticky;
            top: 0;
            z-index: 100;
            background: var(--comfy-menu-bg, #2d2d2d);
            border-bottom: 1px solid var(--border-color, #555);
            padding: 12px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        
        // 检查当前是否在文件夹或收藏中（可以删除）
        const canRemove = nodePoolState.currentContext && 
                         (nodePoolState.currentContext.type === 'favorites' || 
                          nodePoolState.currentContext.type === 'folder');
        
        toolbar.innerHTML = `
            <div style="flex: 1; color: var(--input-text, #ddd); font-size: 14px;">
                已选中 <strong>${nodePoolState.selectedNodes.size}</strong> 个节点
            </div>
            <button class="nm-bulk-btn" data-action="favorite-selected">
                ⭐ 批量收藏
            </button>
            ${canRemove ? `
                <button class="nm-bulk-btn nm-bulk-btn-danger" data-action="remove-selected" title="从当前位置移除选中的节点">
                    🗑️ 批量移除
                </button>
            ` : ''}
            <button class="nm-bulk-btn" data-action="clear-selection">
                ✕ 清空选择
            </button>
        `;
        
        // 插入到节点池顶部
        const poolBody = document.getElementById('nm-node-pool-body');
        if (poolBody && poolBody.firstChild) {
            poolBody.insertBefore(toolbar, poolBody.firstChild);
        }
        
        // 绑定事件
        toolbar.querySelector('[data-action="favorite-selected"]').addEventListener('click', batchFavoriteNodes);
        toolbar.querySelector('[data-action="clear-selection"]').addEventListener('click', clearNodeSelection);
        
        // 绑定删除按钮（如果存在）
        const removeBtn = toolbar.querySelector('[data-action="remove-selected"]');
        if (removeBtn) {
            removeBtn.addEventListener('click', batchRemoveNodes);
        }
    } else if (toolbar) {
        // 更新或移除工具栏
        if (!nodePoolState.editMode || nodePoolState.selectedNodes.size === 0) {
            toolbar.remove();
        } else {
            // 更新计数
            toolbar.querySelector('strong').textContent = nodePoolState.selectedNodes.size;
        }
    }
}

/**
 * 批量收藏节点
 */
function batchFavoriteNodes() {
    let addedCount = 0;
    
    nodePoolState.selectedNodes.forEach(nodeId => {
        if (!nodePoolState.favorites.has(nodeId)) {
            nodePoolState.favorites.add(nodeId);
            addedCount++;
            
            // 更新卡片UI
            const card = document.querySelector(`[data-node-id="${nodeId}"]`);
            if (card) {
                card.classList.add('favorited');
                const favoriteBtn = card.querySelector('[data-action="favorite"]');
                if (favoriteBtn) {
                    favoriteBtn.classList.add('active');
                    const icon = favoriteBtn.querySelector('.nm-btn-icon');
                    if (icon) icon.textContent = '⭐';
                }
            }
        }
    });
    
    if (addedCount > 0) {
        saveUserData();
        updateSpecialFoldersCount();
        showToast(`✅ 已批量收藏 ${addedCount} 个节点`, 'success');
    } else {
        showToast('所选节点均已收藏', 'info');
    }
    
    // 清空选择
    clearNodeSelection();
}

/**
 * 从当前位置移除单个节点（右键菜单）
 */
async function removeNodeFromCurrent(nodeId) {
    if (!nodePoolState.currentContext) {
        return;
    }
    
    const context = nodePoolState.currentContext;
    
    if (context.type === 'favorites') {
        // 从收藏中移除
        if (nodePoolState.favorites.has(nodeId)) {
            nodePoolState.favorites.delete(nodeId);
            
            await saveUserData();
            updateSpecialFoldersCount();
            showToast('✅ 已从收藏中移除', 'success');
            
            // 刷新收藏视图
            showFavoriteNodes();
        }
    } else if (context.type === 'folder') {
        // 从文件夹中移除
        const folderId = context.id;
        
        // 触发移除事件
        window.dispatchEvent(new CustomEvent('nm:removeNodesFromFolder', {
            detail: { nodeIds: [nodeId], folderId }
        }));
    }
}

/**
 * 批量移除节点（从当前文件夹或收藏中）
 */
async function batchRemoveNodes() {
    if (!nodePoolState.currentContext || nodePoolState.selectedNodes.size === 0) {
        return;
    }
    
    const context = nodePoolState.currentContext;
    const selectedIds = Array.from(nodePoolState.selectedNodes);
    
    // 确认操作
    let confirmMessage = '';
    if (context.type === 'favorites') {
        confirmMessage = `确定要从收藏中移除 ${selectedIds.length} 个节点吗？\n（节点不会被删除，只是取消收藏）`;
    } else if (context.type === 'folder') {
        confirmMessage = `确定要从当前文件夹中移除 ${selectedIds.length} 个节点吗？\n（节点不会被删除，只是从此文件夹移除）`;
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    let removedCount = 0;
    
    if (context.type === 'favorites') {
        // 从收藏中移除
        selectedIds.forEach(nodeId => {
            if (nodePoolState.favorites.has(nodeId)) {
                nodePoolState.favorites.delete(nodeId);
                removedCount++;
                
                // 更新卡片UI
                const card = document.querySelector(`[data-node-id="${nodeId}"]`);
                if (card) {
                    card.classList.remove('favorited');
                    card.remove(); // 从收藏视图中移除
                    
                    const favoriteBtn = card.querySelector('[data-action="favorite"]');
                    if (favoriteBtn) {
                        favoriteBtn.classList.remove('active');
                        const icon = favoriteBtn.querySelector('.nm-btn-icon');
                        if (icon) icon.textContent = '☆';
                    }
                }
            }
        });
        
        if (removedCount > 0) {
            await saveUserData();
            updateSpecialFoldersCount();
            showToast(`✅ 已从收藏中移除 ${removedCount} 个节点`, 'success');
            
            // 刷新收藏视图
            showFavoriteNodes();
        }
    } else if (context.type === 'folder') {
        // 从文件夹中移除
        const folderId = context.id;
        
        // 触发批量移除事件
        window.dispatchEvent(new CustomEvent('nm:removeNodesFromFolder', {
            detail: { nodeIds: selectedIds, folderId }
        }));
    }
    
    // 清空选择
    clearNodeSelection();
}

/**
 * 切换收藏状态
 */
function toggleFavorite(nodeId, card) {
    const isFavorited = nodePoolState.favorites.has(nodeId);
    
    if (isFavorited) {
        nodePoolState.favorites.delete(nodeId);
        card.classList.remove('favorited');
        const btn = card.querySelector('[data-action="favorite"]');
        if (btn) {
            btn.classList.remove('active');
            btn.title = '收藏';
            // 只更新图标，保留文字
            const icon = btn.querySelector('.nm-btn-icon');
            if (icon) {
                icon.textContent = '☆';
            }
        }
        showToast('已取消收藏', 'info');
    } else {
        nodePoolState.favorites.add(nodeId);
        card.classList.add('favorited');
        const btn = card.querySelector('[data-action="favorite"]');
        if (btn) {
            btn.classList.add('active');
            btn.title = '取消收藏';
            // 只更新图标，保留文字
            const icon = btn.querySelector('.nm-btn-icon');
            if (icon) {
                icon.textContent = '⭐';
            }
        }
        showToast('已添加到收藏', 'success');
    }
    
    // 保存
    saveUserData();
    
    // 更新特殊文件夹计数
    updateSpecialFoldersCount();
}

/**
 * 显示节点右键菜单
 */
function showNodeContextMenu(event, node, card) {
    // 移除所有已存在的右键菜单
    document.querySelectorAll('.nm-context-menu, .context-menu, .nm-node-context-menu').forEach(menu => menu.remove());
    
    const isFavorited = nodePoolState.favorites.has(node.id);
    const hasNote = !!nodePoolState.notes[node.id];
    const hasCustomName = !!(folderState.config?.nodeCustomNames?.[node.id]);
    
    // 创建菜单
    const menu = document.createElement('div');
    menu.className = 'nm-node-context-menu nm-context-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${event.clientX}px;
        top: ${event.clientY}px;
        background: var(--comfy-menu-bg, #2d2d2d);
        border: 1px solid var(--border-color, #555);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        padding: 4px;
        z-index: 10000;
        min-width: 160px;
    `;
    
    // 检查是否可以删除（在文件夹或收藏中）
    const canRemove = nodePoolState.currentContext && 
                     (nodePoolState.currentContext.type === 'favorites' || 
                      nodePoolState.currentContext.type === 'folder');
    
    const menuItems = [
        {
            label: '重命名',
            icon: '✏️',
            action: () => showNodeRenameDialog(node, card)
        },
        {
            label: hasCustomName ? '恢复原名' : null,
            icon: '↩️',
            action: () => restoreNodeName(node, card),
            show: hasCustomName
        },
        { separator: true },
        {
            label: isFavorited ? '取消收藏' : '收藏',
            icon: isFavorited ? '⭐' : '☆',
            action: () => toggleFavorite(node.id, card)
        },
        {
            label: hasNote ? '编辑笔记' : '添加笔记',
            icon: '📝',
            action: () => showNoteDialog(node)
        },
        {
            label: canRemove ? '从此处移除' : null,
            icon: '🗑️',
            action: () => removeNodeFromCurrent(node.id),
            show: canRemove,
            separator: canRemove
        }
    ];
    
    menuItems.forEach(item => {
        if (item.separator && item.show !== false) {
            const separator = document.createElement('div');
            separator.style.cssText = `
                height: 1px;
                background: var(--border-color, #444);
                margin: 4px 0;
            `;
            menu.appendChild(separator);
        }
        
        if (item.separator) {
            return;
        }
        
        if (item.show === false) return;
        
        const menuItem = document.createElement('div');
        menuItem.className = 'nm-context-menu-item';
        menuItem.innerHTML = `<span>${item.icon}</span> ${item.label}`;
        menuItem.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--input-text, #ddd);
            border-radius: 4px;
            transition: all 0.15s;
        `;
        
        menuItem.addEventListener('mouseenter', () => {
            menuItem.style.background = 'rgba(0, 122, 204, 0.2)';
        });
        menuItem.addEventListener('mouseleave', () => {
            menuItem.style.background = 'transparent';
        });
        
        menuItem.addEventListener('click', () => {
            item.action();
            menu.remove();
        });
        
        menu.appendChild(menuItem);
    });
    
    document.body.appendChild(menu);
    
    // 点击其他地方关闭菜单（包括Modal窗口内）
    const closeMenu = (e) => {
        // 如果点击的不是菜单本身，就关闭
        if (!menu.contains(e.target)) {
            if (menu.parentElement) {
                menu.parentElement.removeChild(menu);
            }
            document.removeEventListener('mousedown', closeMenu, true);
            document.removeEventListener('contextmenu', closeMenu, true);
        }
    };
    
    // 使用捕获阶段和 mousedown 事件以确保能捕获到所有点击
    setTimeout(() => {
        document.addEventListener('mousedown', closeMenu, true);
        document.addEventListener('contextmenu', closeMenu, true);
    }, 10);
}

/**
 * 显示节点重命名对话框
 */
function showNodeRenameDialog(node, card) {
    const currentName = getNodeDisplayName(node);
    const originalName = node.display_name;
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'nm-dialog-overlay';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;
    
    const dialogContent = document.createElement('div');
    dialogContent.style.cssText = `
        background: var(--comfy-menu-bg, #2d2d2d);
        border: 1px solid var(--border-color, #555);
        border-radius: 8px;
        padding: 20px;
        min-width: 400px;
        max-width: 600px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    `;
    
    dialogContent.innerHTML = `
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: var(--input-text, #ddd);">
            重命名节点
        </div>
        <div style="margin-bottom: 12px;">
            <div style="font-size: 12px; color: var(--input-text, #999); margin-bottom: 4px;">
                原始名称: ${escapeHtml(originalName)}
            </div>
            <div style="font-size: 12px; color: var(--input-text, #999); margin-bottom: 8px;">
                节点ID: ${escapeHtml(node.id)}
            </div>
            <input type="text" 
                   class="nm-rename-input" 
                   value="${escapeHtml(currentName)}" 
                   placeholder="输入新名称"
                   style="
                       width: 100%;
                       padding: 8px 12px;
                       background: var(--comfy-input-bg, #1e1e1e);
                       border: 1px solid var(--border-color, #555);
                       border-radius: 4px;
                       color: var(--input-text, #fff);
                       font-size: 14px;
                       box-sizing: border-box;
                   " />
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button class="nm-dialog-btn nm-dialog-btn-cancel" 
                    style="
                        padding: 8px 16px;
                        background: var(--comfy-input-bg, #3d3d3d);
                        border: 1px solid var(--border-color, #555);
                        border-radius: 4px;
                        color: var(--input-text, #ddd);
                        cursor: pointer;
                        font-size: 14px;
                    ">
                取消
            </button>
            <button class="nm-dialog-btn nm-dialog-btn-confirm" 
                    style="
                        padding: 8px 16px;
                        background: #007acc;
                        border: 1px solid #005a9e;
                        border-radius: 4px;
                        color: white;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                    ">
                确认
            </button>
        </div>
    `;
    
    dialog.appendChild(dialogContent);
    document.body.appendChild(dialog);
    
    const input = dialogContent.querySelector('.nm-rename-input');
    const cancelBtn = dialogContent.querySelector('.nm-dialog-btn-cancel');
    const confirmBtn = dialogContent.querySelector('.nm-dialog-btn-confirm');
    
    // 聚焦并选中输入框
    setTimeout(() => {
        input.focus();
        input.select();
    }, 100);
    
    // 取消
    const closeDialog = () => {
        if (dialog.parentElement) {
            dialog.parentElement.removeChild(dialog);
        }
    };
    
    cancelBtn.addEventListener('click', closeDialog);
    
    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            closeDialog();
        }
    });
    
    // 确认重命名
    const confirmRename = async () => {
        const newName = input.value.trim();
        
        if (!newName) {
            showToast('名称不能为空', 'error');
            return;
        }
        
        // 保存到配置
        if (!folderState.config.nodeCustomNames) {
            folderState.config.nodeCustomNames = {};
        }
        
        folderState.config.nodeCustomNames[node.id] = newName;
        
        // 保存配置
        await saveUserData();
        
        // 更新卡片显示
        const nameEl = card.querySelector('.nm-node-card-name');
        if (nameEl) {
            nameEl.textContent = newName;
        }
        
        showToast(`✅ 节点已重命名: ${newName}`, 'success');
        closeDialog();
        
        // 刷新节点池显示
        renderNodePool();
    };
    
    confirmBtn.addEventListener('click', confirmRename);
    
    // 回车确认
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            confirmRename();
        } else if (e.key === 'Escape') {
            closeDialog();
        }
    });
}

/**
 * 恢复节点原名
 */
async function restoreNodeName(node, card) {
    if (!folderState.config?.nodeCustomNames?.[node.id]) {
        return;
    }
    
    delete folderState.config.nodeCustomNames[node.id];
    await saveUserData();
    
    // 更新卡片显示
    const nameEl = card.querySelector('.nm-node-card-name');
    if (nameEl) {
        nameEl.textContent = node.display_name;
    }
    
    showToast(`✅ 已恢复原名: ${node.display_name}`, 'success');
    
    // 刷新节点池显示
    renderNodePool();
}

/**
 * 显示笔记对话框
 */
function showNoteDialog(node) {
    const existingNote = nodePoolState.notes[node.id] || '';
    
    const overlay = document.createElement('div');
    overlay.className = 'nm-dialog-overlay';
    
    overlay.innerHTML = `
        <div class="nm-dialog" style="min-width: 500px;">
            <div class="nm-dialog-header">
                <div class="nm-dialog-title">📝 ${escapeHtml(node.display_name)} - 笔记</div>
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
    
    overlay.querySelector('[data-action="save"]').onclick = () => {
        const note = input.value.trim();
        if (note) {
            nodePoolState.notes[node.id] = note;
            showToast('笔记已保存', 'success');
            
            // 更新卡片样式
            const card = document.querySelector(`[data-node-id="${node.id}"]`);
            if (card) {
                const noteBtn = card.querySelector('[data-action="note"]');
                if (noteBtn) {
                    noteBtn.classList.add('has-note');
                }
            }
        } else {
            delete nodePoolState.notes[node.id];
            
            // 更新卡片样式
            const card = document.querySelector(`[data-node-id="${node.id}"]`);
            if (card) {
                const noteBtn = card.querySelector('[data-action="note"]');
                if (noteBtn) {
                    noteBtn.classList.remove('has-note');
                }
            }
        }
        saveUserData();
        document.body.removeChild(overlay);
    };
    
    overlay.querySelector('[data-action="delete"]').onclick = () => {
        delete nodePoolState.notes[node.id];
        showToast('笔记已删除', 'info');
        
        // 更新卡片样式
        const card = document.querySelector(`[data-node-id="${node.id}"]`);
        if (card) {
            const noteBtn = card.querySelector('[data-action="note"]');
            if (noteBtn) {
                noteBtn.classList.remove('has-note');
            }
        }
        
        saveUserData();
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
 * 创建节点到画布
 */
/**
 * 在画布上创建节点
 * @param {Object} node - 节点信息
 * @param {Array} position - 可选的位置 [x, y] 画布坐标
 */
function createNodeOnCanvas(node, position = null) {
    try {
        console.log('[节点池] 创建节点到画布:', node.display_name, 'node.id:', node.id);
        
        if (!app || !app.canvas || !app.graph) {
            showToast('ComfyUI 未就绪', 'error');
            return null;
        }
        
        // 使用 node.id 而不是 class_type
        const nodeId = node.id;
        
        // 创建节点（先创建再添加）
        const newNode = LiteGraph.createNode(nodeId);
        
        if (!newNode) {
            console.error('[节点池] 无法创建节点，nodeId:', nodeId);
            showToast(`无法创建节点: ${getNodeDisplayName(node)}`, 'error');
            return null;
        }
        
        console.log('[节点池] 节点创建成功:', newNode);
        
        // 计算节点大小
        try {
            if (newNode.computeSize) {
                newNode.computeSize();
            }
        } catch (e) {
            console.warn('[节点池] computeSize失败:', e);
        }
        
        // 计算节点位置
        let nodePos;
        let isDragging = false;  // 是否是拖拽创建
        
        if (position && Array.isArray(position)) {
            // 使用指定位置（拖拽时，已经是画布坐标）
            nodePos = position;
            isDragging = true;
        } else {
            // 计算画布中心位置（点击时）
            const canvas = app.canvas;
            const canvasRect = canvas.canvas.getBoundingClientRect();
            
            // 计算画布中心在屏幕坐标
            const centerX = canvasRect.left + canvasRect.width / 2;
            const centerY = canvasRect.top + canvasRect.height / 2;
            
            // 转换为画布坐标
            const canvasPos = canvas.convertEventToCanvasOffset({
                clientX: centerX,
                clientY: centerY
            });
            
            // convertEventToCanvasOffset 返回数组 [x, y]
            nodePos = canvasPos;
        }
        
        console.log('[节点池] 计算的节点位置:', nodePos, isDragging ? '(拖拽)' : '(点击)');
        
        // 添加到画布
        app.graph.add(newNode);
        
        // 设置节点位置（必须在添加后设置）
        newNode.pos = [nodePos[0], nodePos[1]];
        
        // 选中节点
        if (app.canvas.selectNode) {
            app.canvas.selectNode(newNode);
        }
        
        // 移动视图到节点位置（仅点击时，拖拽时不移动）
        if (!isDragging && app.canvas.centerOnNode) {
            app.canvas.centerOnNode(newNode);
        }
        
        showToast(`✅ 已添加: ${getNodeDisplayName(node)}`, 'success');
        
        // 检查是否需要自动关闭 Modal
        checkAutoCloseOnAdd();
        
        return newNode;
        
    } catch (error) {
        console.error('[节点池] 创建节点失败:', error);
        showToast(`创建失败: ${error.message}`, 'error');
        return null;
    }
}

/**
 * 更新节点池标题（简化版 - 现在只用于内部日志）
 */
function updateNodePoolHeader(title, count) {
    // header已简化，不再显示标题和计数
    // 保留此函数是为了不破坏现有调用
    console.log(`[节点池] ${title}: ${count} 个节点`);
}

/**
 * 根据插件显示节点
 */
function showNodesByPlugin(pluginName, displayName, from = null) {
    console.log('[节点池] 显示插件节点 (Python模块名):', pluginName);
    console.log('[节点池] 显示名称:', displayName || pluginName);
    console.log('[节点池] 来源:', from);
    console.log('[节点池] allNodes总数:', nodePoolState.allNodes.length);
    console.log('[节点池] plugins数组:', nodePoolState.plugins.length, '个');
    
    // 先从 plugins 数组查找（这里的name是Python模块名）
    let plugin = nodePoolState.plugins.find(p => p.name === pluginName);
    
    console.log('[节点池] 查找plugins数组 name===', pluginName, '结果:', plugin ? 'found' : 'not found');
    
    if (plugin && plugin.nodes && plugin.nodes.length > 0) {
        console.log('[节点池] ✅ 从plugins数组找到:', plugin.nodes.length, '个节点');
        renderNodePool(plugin.nodes);
        updateNodePoolHeader(`📦 ${displayName || pluginName}`, plugin.nodes.length);
        nodePoolState.currentContext = { type: 'plugin', id: pluginName, from: from };
        updateBackButton(from);
        return;
    }
    
    // 否则从 allNodes 中动态过滤
    console.log('[节点池] 从allNodes过滤，查找 source ===', pluginName);
    
    // 打印前5个节点的source看看格式
    if (nodePoolState.allNodes.length > 0) {
        console.log('[节点池] allNodes前5个的source:', 
            nodePoolState.allNodes.slice(0, 5).map(n => n.source));
    }
    
    const pluginNodes = nodePoolState.allNodes.filter(node => {
        return node.source === pluginName;
    });
    
    console.log('[节点池] 过滤结果:', pluginNodes.length, '个节点');
    
    if (pluginNodes.length > 0) {
        renderNodePool(pluginNodes);
        updateNodePoolHeader(`📦 ${displayName || pluginName}`, pluginNodes.length);
        nodePoolState.currentContext = { type: 'plugin', id: pluginName, from: from };
        updateBackButton(from);
        console.log('[节点池] ✅ 成功显示节点');
    } else {
        // 没有节点 - 打印所有唯一的source值帮助调试
        const allSources = [...new Set(nodePoolState.allNodes.map(n => n.source))];
        console.warn('[节点池] ⚠️ 插件无节点');
        console.warn('[节点池] 所有可用的source值（前20个）:', allSources.slice(0, 20));
        console.warn('[节点池] 查找的pluginName:', pluginName);
        
        // 尝试模糊匹配
        const fuzzyMatch = allSources.find(s => 
            s.toLowerCase().includes(pluginName.toLowerCase()) ||
            pluginName.toLowerCase().includes(s.toLowerCase())
        );
        if (fuzzyMatch) {
            console.warn('[节点池] 💡 可能的匹配:', fuzzyMatch);
        }
        
        renderNodePool([]);
        updateNodePoolHeader(`📦 ${displayName || pluginName}`, 0);
        nodePoolState.currentContext = { type: 'plugin', id: pluginName };
    }
}

/**
 * 递归获取文件夹及其所有子文件夹的节点ID
 */
function getAllFolderNodeIds(folderId, config) {
    const allNodeIds = new Set();
    
    // 添加当前文件夹的节点
    const folderNodes = config?.folderNodes?.[folderId] || [];
    folderNodes.forEach(nodeId => allNodeIds.add(nodeId));
    
    // 递归添加子文件夹的节点
    const folder = config?.folders?.[folderId];
    if (folder && folder.children && Array.isArray(folder.children)) {
        folder.children.forEach(childId => {
            const childNodeIds = getAllFolderNodeIds(childId, config);
            childNodeIds.forEach(nodeId => allNodeIds.add(nodeId));
        });
    }
    
    return allNodeIds;
}

/**
 * 根据文件夹显示节点（包括所有子文件夹的节点）
 */
function showNodesByFolder(folderId) {
    console.log('[节点池] 显示文件夹节点（含子文件夹）:', folderId);
    
    updateBackButton(null);  // 隐藏返回按钮
    
    // 获取文件夹及其所有子文件夹的节点ID列表
    const config = folderState.config;
    const allNodeIds = getAllFolderNodeIds(folderId, config);
    
    // 根据节点ID获取节点对象
    const nodes = nodePoolState.allNodes.filter(node => 
        allNodeIds.has(node.id)
    );
    
    // 获取文件夹名称
    const folderName = config?.folders?.[folderId]?.name || '未知文件夹';
    
    console.log(`[节点池] 文件夹"${folderName}"及其子文件夹共有 ${nodes.length} 个节点`);
    
    renderNodePool(nodes);
    updateNodePoolHeader(`📁 ${folderName}`, nodes.length);
    nodePoolState.currentContext = { type: 'folder', id: folderId };
}

/**
 * 显示收藏的节点
 */
function showFavoriteNodes() {
    updateBackButton(null);  // 隐藏返回按钮
    
    const favoriteNodes = nodePoolState.allNodes.filter(node => 
        nodePoolState.favorites.has(node.id)
    );
    
    renderNodePool(favoriteNodes);
    updateNodePoolHeader('⭐ 收藏', favoriteNodes.length);
    nodePoolState.currentContext = { type: 'favorites', id: 'favorites' };
}

/**
 * 显示未分类的节点（不在任何文件夹中的节点）
 */
function showUncategorizedNodes() {
    console.log('[节点池] 显示未分类节点');
    
    updateBackButton(null);  // 隐藏返回按钮
    
    // 获取所有在文件夹中的节点ID
    const { folderState } = window;
    const nodesInFolders = new Set();
    
    if (folderState && folderState.config && folderState.config.folderNodes) {
        Object.values(folderState.config.folderNodes).forEach(nodeIds => {
            if (Array.isArray(nodeIds)) {
                nodeIds.forEach(nodeId => nodesInFolders.add(nodeId));
            }
        });
    }
    
    // 过滤出未分类的节点
    const uncategorizedNodes = nodePoolState.allNodes.filter(node => 
        !nodesInFolders.has(node.id)
    );
    
    renderNodePool(uncategorizedNodes);
    updateNodePoolHeader('📂 未分类', uncategorizedNodes.length);
    nodePoolState.currentContext = { type: 'uncategorized', id: 'uncategorized' };
    
    return uncategorizedNodes.length;
}

/**
 * 获取未分类节点数量（不渲染，仅用于计数）
 */
function getUncategorizedCount() {
    const { folderState } = window;
    const nodesInFolders = new Set();
    
    if (folderState && folderState.config && folderState.config.folderNodes) {
        Object.values(folderState.config.folderNodes).forEach(nodeIds => {
            if (Array.isArray(nodeIds)) {
                nodeIds.forEach(nodeId => nodesInFolders.add(nodeId));
            }
        });
    }
    
    const uncategorizedCount = nodePoolState.allNodes.filter(node => 
        !nodesInFolders.has(node.id)
    ).length;
    
    return uncategorizedCount;
}

/**
 * 更新特殊文件夹计数（收藏、未分类、已隐藏）
 */
function updateSpecialFoldersCount() {
    // 更新收藏数量（使用 querySelectorAll 更新所有实例，包括侧边栏和 Modal）
    const favoritesCountEls = document.querySelectorAll('[data-special-id="favorites"] .nm-folder-count');
    favoritesCountEls.forEach(el => {
        el.textContent = nodePoolState.favorites.size;
    });
    
    // 更新未分类数量
    const uncategorizedCountEls = document.querySelectorAll('[data-special-id="uncategorized"] .nm-folder-count');
    const uncategorizedCount = getUncategorizedCount();
    uncategorizedCountEls.forEach(el => {
        el.textContent = uncategorizedCount;
    });
    
    // 更新已隐藏数量
    const hiddenCountEls = document.querySelectorAll('[data-special-id="hidden"] .nm-folder-count');
    if (folderState.config) {
        const hiddenCount = folderState.config.hiddenPlugins?.length || 0;
        hiddenCountEls.forEach(el => {
            el.textContent = hiddenCount;
        });
    }
    
    console.log(`[节点池] 更新特殊文件夹计数 - 收藏: ${nodePoolState.favorites.size}, 未分类: ${uncategorizedCount}, 已隐藏: ${folderState.config?.hiddenPlugins?.length || 0}`);
}

/**
 * 显示已隐藏的插件列表
 */
function showHiddenPlugins() {
    console.log('[节点池] 显示已隐藏的插件');
    
    updateBackButton(null);  // 隐藏返回按钮
    
    // 清除选中状态
    nodePoolState.selectedHiddenPlugins.clear();
    nodePoolState.lastSelectedHiddenPlugin = null;
    
    const hiddenPlugins = folderState.config?.hiddenPlugins || [];
    
    if (hiddenPlugins.length === 0) {
        renderNodePool([]);
        updateNodePoolHeader('🙈 已隐藏', 0);
        return;
    }
    
    // 获取插件信息
    const pluginCards = hiddenPlugins.map(pluginName => {
        const plugin = nodePoolState.plugins.find(p => p.name === pluginName || p.python_name === pluginName);
        if (!plugin) {
            return {
                name: pluginName,
                displayName: pluginName,
                nodeCount: 0,
                pythonName: pluginName
            };
        }
        return {
            name: plugin.name,
            displayName: plugin.display_name || plugin.name,
            nodeCount: plugin.node_count || 0,
            pythonName: plugin.python_name || plugin.name
        };
    });
    
    // 渲染插件卡片
    renderHiddenPluginCards(pluginCards);
    updateNodePoolHeader('🙈 已隐藏的插件', pluginCards.length);
    nodePoolState.currentContext = { type: 'hidden' };
}

/**
 * 渲染已隐藏的插件卡片
 */
function renderHiddenPluginCards(plugins) {
    const container = document.getElementById('nm-node-pool-body');
    if (!container) return;
    
    container.innerHTML = '';
    
    plugins.forEach((plugin, index) => {
        const card = document.createElement('div');
        card.className = 'nm-hidden-plugin-card';
        card.dataset.pluginName = plugin.pythonName;
        card.dataset.pluginIndex = index;
        
        // 检查是否选中
        if (nodePoolState.selectedHiddenPlugins.has(plugin.pythonName)) {
            card.classList.add('selected');
        }
        
        card.innerHTML = `
            <div class="nm-hidden-plugin-header">
                <div class="nm-hidden-plugin-icon">📦</div>
                <div class="nm-hidden-plugin-info">
                    <div class="nm-hidden-plugin-name">${escapeHtml(plugin.displayName)}</div>
                    <div class="nm-hidden-plugin-count">节点数: ${plugin.nodeCount}</div>
                </div>
            </div>
            <div class="nm-hidden-plugin-actions">
                <button class="nm-hidden-plugin-btn nm-view-nodes-btn" title="查看节点">
                    <span class="nm-btn-icon">👁️</span>
                    <span class="nm-btn-text">查看节点</span>
                </button>
            </div>
        `;
        
        // 绑定卡片点击选择事件
        card.addEventListener('click', (e) => {
            // 如果点击的是查看节点按钮，不触发选择
            if (e.target.closest('.nm-view-nodes-btn')) {
                return;
            }
            
            handleHiddenPluginSelection(plugin.pythonName, e.ctrlKey || e.metaKey, e.shiftKey, plugins);
        });
        
        // 绑定查看节点按钮
        const viewBtn = card.querySelector('.nm-view-nodes-btn');
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('nm:showPluginNodes', {
                detail: {
                    pluginName: plugin.pythonName,
                    displayName: plugin.displayName,
                    from: 'hidden'  // 标记来源
                }
            }));
        });
        
        container.appendChild(card);
    });
    
    // 更新"还原选中"按钮状态
    updateRestoreButton();
}

/**
 * 处理隐藏插件的选择
 */
function handleHiddenPluginSelection(pluginName, isCtrl, isShift, allPlugins) {
    if (isCtrl) {
        // Ctrl: 切换选中状态
        if (nodePoolState.selectedHiddenPlugins.has(pluginName)) {
            nodePoolState.selectedHiddenPlugins.delete(pluginName);
        } else {
            nodePoolState.selectedHiddenPlugins.add(pluginName);
        }
        nodePoolState.lastSelectedHiddenPlugin = pluginName;
    } else if (isShift && nodePoolState.lastSelectedHiddenPlugin) {
        // Shift: 范围选择
        const lastIndex = allPlugins.findIndex(p => p.pythonName === nodePoolState.lastSelectedHiddenPlugin);
        const currentIndex = allPlugins.findIndex(p => p.pythonName === pluginName);
        
        if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);
            
            for (let i = start; i <= end; i++) {
                nodePoolState.selectedHiddenPlugins.add(allPlugins[i].pythonName);
            }
        }
    } else {
        // 单击: 清除其他选择，只选中当前项
        nodePoolState.selectedHiddenPlugins.clear();
        nodePoolState.selectedHiddenPlugins.add(pluginName);
        nodePoolState.lastSelectedHiddenPlugin = pluginName;
    }
    
    // 更新UI
    renderHiddenPluginCards(allPlugins);
}

/**
 * 更新"还原选中"按钮状态
 */
function updateRestoreButton() {
    const restoreBtn = document.getElementById('nm-restore-selected-btn');
    if (!restoreBtn) return;
    
    const selectedCount = nodePoolState.selectedHiddenPlugins.size;
    
    if (selectedCount > 0) {
        restoreBtn.style.display = 'flex';
        const textSpan = restoreBtn.querySelector('.nm-btn-text');
        if (textSpan) {
            textSpan.textContent = `还原选中 (${selectedCount})`;
        }
    } else {
        restoreBtn.style.display = 'none';
    }
}

/**
 * 还原插件（取消隐藏）
 */
async function restorePlugin(pluginName) {
    try {
        showToast('正在还原插件...', 'info');
        
        const response = await fetch('/node-manager/plugin/toggle-hidden', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                pluginNames: [pluginName],
                action: 'show'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 更新本地配置
            if (folderState.config.hiddenPlugins) {
                const index = folderState.config.hiddenPlugins.indexOf(pluginName);
                if (index > -1) {
                    folderState.config.hiddenPlugins.splice(index, 1);
                }
            }
            
            showToast('✅ 插件已还原', 'success');
            
            // 刷新已隐藏列表
            showHiddenPlugins();
            
            // 更新计数
            updateSpecialFoldersCount();
            
            // 重新加载插件列表
            window.dispatchEvent(new CustomEvent('nm:refreshPluginsList'));
        } else {
            throw new Error(data.error || '还原失败');
        }
    } catch (error) {
        console.error('[节点池] 还原插件失败:', error);
        showToast(`还原失败: ${error.message}`, 'error');
    }
}

/**
 * 批量还原选中的插件
 */
async function restoreSelectedPlugins() {
    const selectedPlugins = Array.from(nodePoolState.selectedHiddenPlugins);
    
    if (selectedPlugins.length === 0) {
        showToast('请先选择要还原的插件', 'warning');
        return;
    }
    
    try {
        showToast(`正在还原 ${selectedPlugins.length} 个插件...`, 'info');
        
        const response = await fetch('/node-manager/plugin/toggle-hidden', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                pluginNames: selectedPlugins,
                action: 'show'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 更新本地配置
            if (folderState.config.hiddenPlugins) {
                selectedPlugins.forEach(pluginName => {
                    const index = folderState.config.hiddenPlugins.indexOf(pluginName);
                    if (index > -1) {
                        folderState.config.hiddenPlugins.splice(index, 1);
                    }
                });
            }
            
            // 清除选中状态
            nodePoolState.selectedHiddenPlugins.clear();
            nodePoolState.lastSelectedHiddenPlugin = null;
            
            showToast(`✅ 已还原 ${selectedPlugins.length} 个插件`, 'success');
            
            // 刷新已隐藏列表
            showHiddenPlugins();
            
            // 更新计数
            updateSpecialFoldersCount();
            
            // 重新加载插件列表
            window.dispatchEvent(new CustomEvent('nm:refreshPluginsList'));
        } else {
            throw new Error(data.error || '还原失败');
        }
    } catch (error) {
        console.error('[节点池] 批量还原插件失败:', error);
        showToast(`还原失败: ${error.message}`, 'error');
    }
}

/**
 * 更新返回按钮显示状态
 */
function updateBackButton(from) {
    const backBtn = document.getElementById('nm-back-btn');
    if (!backBtn) return;
    
    if (from === 'hidden') {
        // 从已隐藏列表查看节点，显示返回按钮
        backBtn.style.display = 'flex';
    } else {
        // 其他情况，隐藏返回按钮
        backBtn.style.display = 'none';
    }
}

/**
 * HTML转义
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * 截断文本到指定长度
 */
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * 根据分类显示节点
 */
function showNodesByCategory(pluginName, category, displayName, nodeIds = null) {
    console.log('[节点池] 显示分类节点:', pluginName, category);
    console.log('[节点池] displayName:', displayName);
    console.log('[节点池] 提供的节点ID数量:', nodeIds ? nodeIds.length : 0);
    
    updateBackButton(null);  // 隐藏返回按钮
    
    let categoryNodes;
    
    // 优先使用节点ID列表（如果提供）
    if (nodeIds && Array.isArray(nodeIds) && nodeIds.length > 0) {
        // 基于节点ID查找（以实际节点为准）
        const nodeIdSet = new Set(nodeIds);
        categoryNodes = nodePoolState.allNodes.filter(node => nodeIdSet.has(node.id));
        console.log('[节点池] 使用节点ID列表匹配，找到', categoryNodes.length, '个节点');
    } else {
        // 后备方案：使用 category 路径匹配（可能因汉化导致不准确）
        categoryNodes = nodePoolState.allNodes.filter(node => {
            const sourceMatches = node.source === pluginName;
            const categoryMatches = node.category === category || node.category.startsWith(category + '/');
            return sourceMatches && categoryMatches;
        });
        console.log('[节点池] 使用category路径匹配，找到', categoryNodes.length, '个节点');
    }
    
    if (categoryNodes.length > 0) {
        renderNodePool(categoryNodes);
        updateNodePoolHeader(`📁 ${displayName || category}`, categoryNodes.length);
        nodePoolState.currentContext = { type: 'category', pluginName, category };
    } else {
        renderNodePool([]);
        updateNodePoolHeader(`📁 ${displayName || category}`, 0);
        nodePoolState.currentContext = { type: 'category', pluginName, category };
    }
}

// ========== 节点预览功能 ==========

// 预览缓存
const nodePreviewCache = new Map();
const MAX_CACHE_SIZE = 50;

// 预览状态
let previewDelayTimer = null;
let previewHideTimer = null;
let previewOverlay = null;
let currentPreviewNodeId = null;

/**
 * 计划显示节点预览（延迟触发）
 */
function scheduleNodePreview(nodeId, displayName, event) {
    // 如果已经在显示这个节点，不需要重新创建
    if (currentPreviewNodeId === nodeId && previewOverlay) {
        // 取消隐藏定时器（鼠标又回来了）
        cancelHidePreview();
        return;
    }
    
    // 取消之前的定时器
    cancelNodePreview();
    cancelHidePreview();
    
    // 延迟100ms后显示预览（所有情况都延迟，保证渐显效果）
    previewDelayTimer = setTimeout(() => {
        showNodePreview(nodeId, displayName, event);
    }, 100);
}

/**
 * 计划隐藏节点预览（延迟触发）
 */
function scheduleHidePreview() {
    // 取消显示定时器（如果还没显示就移开了）
    cancelNodePreview();
    
    // 延迟100ms后隐藏（给鼠标移回来的时间）
    previewHideTimer = setTimeout(() => {
        hideNodePreview();
    }, 100);
}

/**
 * 取消显示定时器
 */
function cancelNodePreview() {
    if (previewDelayTimer) {
        clearTimeout(previewDelayTimer);
        previewDelayTimer = null;
    }
}

/**
 * 取消隐藏定时器
 */
function cancelHidePreview() {
    if (previewHideTimer) {
        clearTimeout(previewHideTimer);
        previewHideTimer = null;
    }
}

/**
 * 显示节点预览
 */
function showNodePreview(nodeId, displayName, event) {
    try {
        console.log('[节点预览] 尝试显示预览:', nodeId);
        
        // 检查 LiteGraph 是否可用
        if (typeof LiteGraph === 'undefined' || !LiteGraph.createNode) {
            console.warn('[节点预览] ❌ LiteGraph 不可用');
            return;
        }
        
        // 检查节点是否已注册
        if (!LiteGraph.registered_node_types || !LiteGraph.registered_node_types[nodeId]) {
            console.warn('[节点预览] ❌ 节点未注册:', nodeId);
            console.warn('[节点预览] registered_node_types 中的前10个节点:', 
                Object.keys(LiteGraph.registered_node_types || {}).slice(0, 10));
            return;
        }
        
        console.log('[节点预览] ✅ 节点已注册，开始渲染');
        currentPreviewNodeId = nodeId;
        
        // 创建或复用预览浮层（统一的容器）
        if (!previewOverlay) {
            previewOverlay = createPreviewOverlay();
        }
        
        // 清空并准备渲染
        previewOverlay.innerHTML = '';
        previewOverlay.style.opacity = '0';
        
        // 渲染节点（包含标题）
        const renderedDiv = renderNodePreview(nodeId);
        if (renderedDiv) {
            previewOverlay.appendChild(renderedDiv);
            console.log('[节点预览] ✅ 预览渲染成功');
        } else {
            // 渲染失败，显示提示
            console.warn('[节点预览] ❌ renderNodePreview 返回 null，无法预览');
            previewOverlay.innerHTML = `
                <div style="padding: 20px; color: #888; text-align: center; background: var(--comfy-menu-bg, #1e1e1e); border: 1px solid var(--border-color, #555); border-radius: 8px;">
                    <div style="font-size: 16px; margin-bottom: 10px;">⚠️</div>
                    <div>无法预览此节点</div>
                    <div style="font-size: 11px; margin-top: 5px; opacity: 0.6;">${nodeId}</div>
                </div>
            `;
        }
        
        // 先设置为可见但透明，让浏览器计算尺寸
        previewOverlay.style.display = 'block';
        previewOverlay.style.visibility = 'hidden';
        previewOverlay.style.opacity = '0';
        
        // 等待渲染完成，获取实际尺寸后再定位
        requestAnimationFrame(() => {
            // 根据布局模式定位预览
            updatePreviewPosition(event);
            
            // 显示预览（淡入动画）
            previewOverlay.style.visibility = 'visible';
            requestAnimationFrame(() => {
                previewOverlay.style.opacity = '1';
                if (nodePoolState.layoutMode !== 'split') {
                    previewOverlay.style.transform = 'translateY(0)';
                }
            });
        });
        
    } catch (error) {
        console.error('[节点预览] 显示失败:', error);
    }
}

/**
 * 隐藏节点预览
 */
function hideNodePreview() {
    if (!previewOverlay) return;
    
    // 淡出动画
    previewOverlay.style.opacity = '0';
    if (nodePoolState.layoutMode !== 'split') {
        previewOverlay.style.transform = 'translateY(8px)';
    }
    
    setTimeout(() => {
        if (previewOverlay) {
            previewOverlay.style.display = 'none';
        }
        currentPreviewNodeId = null;
    }, 200);
}

/**
 * 强制清理预览浮层（用于 Modal/侧边栏关闭时）
 */
function forceCleanupPreview() {
    // 取消所有定时器
    cancelNodePreview();
    cancelHidePreview();
    
    // 立即移除预览浮层
    if (previewOverlay) {
        if (previewOverlay.parentElement) {
            previewOverlay.parentElement.removeChild(previewOverlay);
        }
        previewOverlay = null;
    }
    
    // 清空当前预览节点ID
    currentPreviewNodeId = null;
}

/**
 * 创建预览浮层（统一的预览容器，通过CSS控制不同布局的定位）
 */
function createPreviewOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'nm-node-preview-overlay';
    document.body.appendChild(overlay);
    return overlay;
}

/**
 * 更新预览位置（根据当前布局模式）
 */
function updatePreviewPosition(event) {
    if (!previewOverlay) return;
    
    if (nodePoolState.layoutMode === 'split') {
        // 左右布局：固定在右侧，放大50%，垂直居中
        const modalContent = document.querySelector('.nm-modal-content.split-layout');
        if (modalContent) {
            const modalWidth = modalContent.offsetWidth;
            
            // 先应用缩放
            previewOverlay.style.transform = 'scale(1.5)';
            previewOverlay.style.transformOrigin = 'left top';
            
            // 获取预览内容的实际尺寸（缩放后）
            const rect = previewOverlay.getBoundingClientRect();
            
            // 水平位置：距离模态框右边缘60px
            const leftX = modalWidth + 60;
            
            // 垂直位置：居中
            const centerY = (window.innerHeight - rect.height) / 2;
            
            // 使用 block 显示（和居中布局一样的渲染方式）
            previewOverlay.style.position = 'fixed';
            previewOverlay.style.left = `${leftX}px`;
            previewOverlay.style.top = `${centerY}px`;
            previewOverlay.style.width = 'auto';
            previewOverlay.style.height = 'auto';
            previewOverlay.style.right = 'auto';
            previewOverlay.style.bottom = 'auto';
            previewOverlay.style.display = 'block';
            
            // 确保不超出右侧边界（考虑缩放后的宽度）
            if (leftX + rect.width > window.innerWidth - 16) {
                previewOverlay.style.left = `${window.innerWidth - rect.width - 16}px`;
            }
            // 确保不超出上下边界
            if (centerY < 16) {
                previewOverlay.style.top = '16px';
            } else if (centerY + rect.height > window.innerHeight - 16) {
                previewOverlay.style.top = `${window.innerHeight - rect.height - 16}px`;
            }
        }
    } else {
        // 居中布局：跟随鼠标定位
        if (event) {
            positionPreviewNearMouse(event);
        }
    }
}

/**
 * 定位预览浮层（居中布局模式，跟随鼠标）
 */
function positionPreviewNearMouse(event) {
    if (!previewOverlay) return;
    
    // 重置为默认样式（居中布局模式）- 清除所有左右布局的样式
    previewOverlay.style.position = 'fixed';
    previewOverlay.style.width = 'auto';
    previewOverlay.style.height = 'auto';
    previewOverlay.style.right = 'auto';
    previewOverlay.style.bottom = 'auto';
    previewOverlay.style.display = 'block';
    previewOverlay.style.transformOrigin = 'center center';
    
    // 先重置缩放，让浏览器重新计算实际尺寸
    previewOverlay.style.transform = 'scale(1) translateY(-8px)';  // 明确设置scale(1)清除之前的缩放
    
    const padding = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    // 获取浮层尺寸（现在是未缩放的真实尺寸）
    const rect = previewOverlay.getBoundingClientRect();
    
    // 计算位置（优先显示在鼠标右侧）
    let x = event.clientX + padding;
    let y = event.clientY - rect.height / 2;
    
    // 边界检查 - 右侧
    if (x + rect.width > vw) {
        x = event.clientX - rect.width - padding; // 显示在左侧
    }
    
    // 边界检查 - 垂直
    if (y < padding) {
        y = padding;
    } else if (y + rect.height > vh - padding) {
        y = vh - rect.height - padding;
    }
    
    previewOverlay.style.left = x + 'px';
    previewOverlay.style.top = y + 'px';
}

/**
 * 渲染widget（支持汉化）
 * Grid: auto(左控件) | 5px | auto(名称) | 15px | auto(值) | 5px | auto(右控件)
 * 有控件时：边框-5px-控件-5px-文字；无控件时：边框-5px-文字
 */
function renderWidget(widget) {
    const { name, displayName, widgetType, value, config } = widget;
    let displayValue = String(value || '');
    const widgetLabel = displayName || name;  // 优先使用汉化名称
    
    switch (widgetType) {
        case 'text':
            // 单行文本框
            return `
                <div class="nm-preview-row nm-preview-row-string nm-preview-widget">
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col">${escapeHtml(widgetLabel)}</div>
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col nm-preview-text-single">${escapeHtml(displayValue)}</div>
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col"></div>
                </div>`;
                
        case 'customtext':
            // 多行文本框
            return `
                <div class="nm-preview-row nm-preview-row-string nm-preview-widget">
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col">${escapeHtml(widgetLabel)}</div>
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col nm-preview-text-multi">${escapeHtml(displayValue)}</div>
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col"></div>
                </div>`;
                
        case 'toggle':
            // 布尔开关 - 简单灰色圆圈
            return `
                <div class="nm-preview-row nm-preview-row-boolean nm-preview-widget">
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col">${escapeHtml(widgetLabel)}</div>
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col">
                        <div class="nm-preview-toggle"></div>
                    </div>
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col"></div>
                </div>`;
                
        case 'number':
        case 'combo':
            // 数字/下拉框 - 左边箭头，右边箭头
            return `
                <div class="nm-preview-row nm-preview-widget">
                    <div class="nm-preview-col nm-preview-arrow">◀</div>
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col">${escapeHtml(widgetLabel)}</div>
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col nm-preview-value">${escapeHtml(displayValue)}</div>
                    <div class="nm-preview-col"></div>
                    <div class="nm-preview-col nm-preview-arrow">▶</div>
                </div>`;
                
        default:
            return '';
    }
}

/**
 * 获取widget类型和配置
 */
function getWidgetInfo(inputData) {
    const type = inputData[0];
    const config = inputData[1] || {};
    
    // 数组 = COMBO下拉框
    if (Array.isArray(type)) {
        return {
            widgetType: 'combo',
            dataType: 'COMBO',
            value: type[0],
            options: type,
            config: config
        };
    }
    
    // STRING类型
    if (type === 'STRING') {
        return {
            widgetType: config.multiline ? 'customtext' : 'text',
            dataType: 'STRING',
            value: config.default || '',
            config: config
        };
    }
    
    // BOOLEAN类型
    if (type === 'BOOLEAN') {
        return {
            widgetType: 'toggle',
            dataType: 'BOOLEAN',
            value: config.default || false,
            config: config
        };
    }
    
    // INT类型
    if (type === 'INT') {
        return {
            widgetType: 'number',
            dataType: 'INT',
            value: config.default || 0,
            config: config
        };
    }
    
    // FLOAT类型
    if (type === 'FLOAT') {
        return {
            widgetType: 'number',
            dataType: 'FLOAT',
            value: config.default || 0,
            config: config
        };
    }
    
    // 其他类型作为插槽
    return {
        widgetType: null,
        dataType: type,
        value: null,
        config: config
    };
}

/**
 * 从节点实例获取汉化数据（使用缓存避免重复创建节点）
 */
const nodeInstanceCache = new Map();

function getNodeInstanceData(nodeId) {
    // 检查缓存
    if (nodeInstanceCache.has(nodeId)) {
        return nodeInstanceCache.get(nodeId);
    }
    
    try {
        // 创建临时节点实例（汉化插件会在创建时应用翻译）
        const tempNode = LiteGraph.createNode(nodeId);
        if (!tempNode) {
            return null;
        }
        
        // 提取汉化数据
        const data = {
            inputs: {},
            outputs: {},
            widgets: {}
        };
        
        // 输入插槽的汉化名称
        if (tempNode.inputs) {
            tempNode.inputs.forEach(input => {
                data.inputs[input.name] = input.label || input.localized_name || input.name;
            });
        }
        
        // 输出插槽的汉化名称
        if (tempNode.outputs) {
            tempNode.outputs.forEach(output => {
                data.outputs[output.name] = output.label || output.localized_name || output.name;
            });
        }
        
        // 控件的汉化名称
        if (tempNode.widgets) {
            tempNode.widgets.forEach(widget => {
                data.widgets[widget.name] = widget.label || widget.name;
            });
        }
        
        // 移除临时节点（清理）
        if (tempNode.graph) {
            tempNode.graph.remove(tempNode);
        }
        
        // 缓存结果
        nodeInstanceCache.set(nodeId, data);
        
        return data;
        
    } catch (error) {
        console.error('[预览] 获取节点实例数据失败:', nodeId, error);
        return null;
    }
}

/**
 * 获取汉化文本（从节点实例的 label 属性获取）
 */
function getTranslatedText(nodeId, category, name) {
    const instanceData = getNodeInstanceData(nodeId);
    if (instanceData && instanceData[category] && instanceData[category][name]) {
        return instanceData[category][name];
    }
    return name;
}

/**
 * 渲染节点预览（1:1还原ComfyUI节点外观，支持汉化）
 */
function renderNodePreview(nodeId) {
    // 检查缓存（只有在汉化插件已加载时才使用缓存）
    const hasTranslation = typeof window.TUtils !== 'undefined' && window.TUtils?.T?.Nodes;
    const cacheKey = hasTranslation ? `${nodeId}_translated` : `${nodeId}_original`;
    
    if (nodePreviewCache.has(cacheKey)) {
        const cached = nodePreviewCache.get(cacheKey);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = cached;
        return wrapper.firstChild;
    }
    
    try {
        const nodeType = LiteGraph.registered_node_types[nodeId];
        if (!nodeType) {
            console.warn('[节点预览] ❌ nodeType 不存在:', nodeId);
            return null;
        }
        if (!nodeType.nodeData) {
            console.warn('[节点预览] ❌ nodeData 不存在:', nodeId, '节点类型:', nodeType);
            return null;
        }
        
        const data = nodeType.nodeData;
        const inputs = data.input || {};
        const outputs = data.output || [];
        const outputNames = data.output_name || [];
        
        // 获取节点标题（优先使用汉化后的标题）
        const nodeTitle = nodeType.title || nodeId;
        
        // 分析输入：区分插槽和控件
        const slots = [];      // 输入插槽
        const widgets = [];    // 控件
        const requiredInputs = inputs.required || {};
        const optionalInputs = inputs.optional || {};
        
        // 处理必需输入
        Object.keys(requiredInputs).forEach(key => {
            const widgetInfo = getWidgetInfo(requiredInputs[key]);
            if (widgetInfo.widgetType) {
                // 有widgetType = 控件
                widgets.push({ 
                    name: key, 
                    displayName: getTranslatedText(nodeId, 'widgets', key),
                    ...widgetInfo 
                });
            } else {
                // 无widgetType = 插槽
                slots.push({ 
                    name: key, 
                    displayName: getTranslatedText(nodeId, 'inputs', key),
                    type: widgetInfo.dataType 
                });
            }
        });
        
        // 处理可选输入
        Object.keys(optionalInputs).forEach(key => {
            const widgetInfo = getWidgetInfo(optionalInputs[key]);
            if (widgetInfo.widgetType) {
                widgets.push({ 
                    name: key, 
                    displayName: getTranslatedText(nodeId, 'widgets', key),
                    ...widgetInfo 
                });
            } else {
                slots.push({ 
                    name: key, 
                    displayName: getTranslatedText(nodeId, 'inputs', key),
                    type: widgetInfo.dataType 
                });
            }
        });
        
        // 处理输出插槽
        const outputSlots = [];
        for (let i = 0; i < outputs.length; i++) {
            const originalName = outputNames[i] || outputs[i];
            outputSlots.push({
                type: outputs[i],
                name: originalName,
                displayName: getTranslatedText(nodeId, 'outputs', originalName)
            });
        }
        
        // 渲染HTML
        let html = `<div class="nm-node-preview-container">`;
        
        // 1. 头部（使用汉化后的标题）
        html += `
            <div class="nm-preview-header">
                <div class="nm-preview-header-dot"></div>
                ${escapeHtml(nodeTitle)}
            </div>`;
        
        // 2. 插槽行（输入插槽 + 输出插槽）
        // Grid: auto(左圆点) | 5px | auto(左文字) | 15px | auto(右文字) | 5px | auto(右圆点)
        // 有控件时：边框-5px-控件-5px-文字；无控件时：边框-5px-文字
        const maxSlots = Math.max(slots.length, outputSlots.length);
        for (let i = 0; i < maxSlots; i++) {
            const inputSlot = slots[i];
            const outputSlot = outputSlots[i];
            
            html += `<div class="nm-preview-row">`;
            
            // 第1列：左侧圆点
            if (inputSlot) {
                const color = getSlotColor(inputSlot.type);
                html += `<div class="nm-preview-col"><div class="nm-preview-dot" style="background-color: ${color}"></div></div>`;
            } else {
                html += `<div class="nm-preview-col"></div>`;
            }
            
            // 第2列：5px间距
            html += `<div class="nm-preview-col"></div>`;
            
            // 第3列：左侧文字（输入名 - 使用汉化后的名称）
            html += `<div class="nm-preview-col">${inputSlot ? escapeHtml(inputSlot.displayName) : ''}</div>`;
            
            // 第4列：15px间距
            html += `<div class="nm-preview-col"></div>`;
            
            // 第5列：右侧文字（输出名 - 使用汉化后的名称）
            html += `<div class="nm-preview-col">${outputSlot ? escapeHtml(outputSlot.displayName) : ''}</div>`;
            
            // 第6列：5px间距
            html += `<div class="nm-preview-col"></div>`;
            
            // 第7列：右侧圆点
            if (outputSlot) {
                const color = getSlotColor(outputSlot.type);
                html += `<div class="nm-preview-col"><div class="nm-preview-dot" style="background-color: ${color}"></div></div>`;
            } else {
                html += `<div class="nm-preview-col"></div>`;
            }
            
            html += `</div>`;
        }
        
        // 3. 控件行
        widgets.forEach(widget => {
            html += renderWidget(widget);
        });
        
        html += `</div>`; // 关闭容器
        
        // 缓存（使用与查询相同的key）
        cleanPreviewCache();
        nodePreviewCache.set(cacheKey, html);
        
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        return wrapper.firstChild;
        
    } catch (error) {
        console.error('[节点预览] 渲染失败:', nodeId, error);
        return null;
    }
}

/**
 * 获取插槽颜色
 */
function getSlotColor(type) {
    const colorMap = {
        'CLIP': '#FFD500',
        'CLIP_VISION': '#A8DADC',
        'CLIP_VISION_OUTPUT': '#ad7452',
        'CONDITIONING': '#FFA931',
        'CONTROL_NET': '#6EE7B7',
        'IMAGE': '#64B5F6',
        'LATENT': '#FF9CF9',
        'MASK': '#81C784',
        'MODEL': '#B39DDB',
        'STYLE_MODEL': '#C2FFAE',
        'VAE': '#FF6E6E',
        'NOISE': '#B0B0B0',
        'GUIDER': '#66FFFF',
        'SAMPLER': '#ECB4B4',
        'SIGMAS': '#CDFFCD',
        'TAESD': '#DCC274',
        'INT': '#29699C',
        'FLOAT': '#39C2C9',
        'STRING': '#C2FFAE',
        'BOOLEAN': '#DCA336'
    };
    
    return colorMap[type] || '#999';
}

/**
 * 清理预览缓存
 */
function cleanPreviewCache() {
    if (nodePreviewCache.size >= MAX_CACHE_SIZE) {
        // 删除最早的缓存项
        const firstKey = nodePreviewCache.keys().next().value;
        nodePreviewCache.delete(firstKey);
        console.log('[节点预览] 清理缓存:', firstKey);
    }
}

// ==================== 搜索功能 ====================

// 搜索状态
let searchOverlay = null;
let searchInput = null;
let searchResults = null;
let searchDebounceTimer = null;

/**
 * 初始化搜索功能
 */
function initSearch() {
    console.log('[搜索] 开始初始化搜索功能...');
    try {
        createSearchModal();
        console.log('[搜索] 搜索弹窗创建成功');
        registerSearchShortcut();
        console.log('[搜索] 快捷键注册成功');
        registerSearchContextMenu();
        console.log('[搜索] 右键菜单注册成功');
    } catch (error) {
        console.error('[搜索] 初始化失败:', error);
    }
}

/**
 * 创建搜索弹窗
 */
function createSearchModal() {
    // 创建蒙层
    searchOverlay = document.createElement('div');
    searchOverlay.className = 'nm-search-overlay';
    
    // 创建弹窗容器
    const modal = document.createElement('div');
    modal.className = 'nm-search-modal';
    
    // 创建头部
    const header = document.createElement('div');
    header.className = 'nm-search-header';
    
    // 搜索输入框
    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'nm-search-input';
    searchInput.placeholder = '搜索节点名称、插件、笔记... (Ctrl+K)';
    searchInput.addEventListener('input', handleSearchInput);
    
    // 清空按钮
    const clearBtn = document.createElement('button');
    clearBtn.className = 'nm-search-clear-btn';
    clearBtn.textContent = '✕ 清空';
    clearBtn.addEventListener('click', clearSearch);
    
    header.appendChild(searchInput);
    header.appendChild(clearBtn);
    
    // 创建内容区
    const content = document.createElement('div');
    content.className = 'nm-search-content';
    
    // 搜索结果区域
    searchResults = document.createElement('div');
    searchResults.className = 'nm-search-results';
    searchResults.innerHTML = '<div class="nm-search-info">按 Ctrl+K 开始搜索</div>';
    
    content.appendChild(searchResults);
    
    // 组装弹窗
    modal.appendChild(header);
    modal.appendChild(content);
    searchOverlay.appendChild(modal);
    document.body.appendChild(searchOverlay);
    
    // 点击蒙层关闭
    searchOverlay.addEventListener('click', (e) => {
        if (e.target === searchOverlay) {
            closeSearch();
        }
    });
    
    // 阻止弹窗内点击冒泡
    modal.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

/**
 * 注册搜索快捷键
 */
function registerSearchShortcut() {
    console.log('[搜索] 注册快捷键监听器...');
    document.addEventListener('keydown', (e) => {
        // Ctrl+K 已由侧边栏搜索框处理，不再用于全屏搜索
        // 保留 Ctrl+Shift+F 作为全屏搜索的快捷键
        if (e.ctrlKey && e.shiftKey && e.key === 'F') {
            console.log('[搜索] Ctrl+Shift+F 被触发！');
            e.preventDefault();
            e.stopPropagation();
            openSearch();
            return;
        }
        
        // ESC 关闭搜索
        if (e.key === 'Escape' && searchOverlay && searchOverlay.classList.contains('show')) {
            console.log('[搜索] ESC 被触发！');
            e.preventDefault();
            closeSearch();
        }
    });
}

/**
 * 注册搜索右键菜单
 */
function registerSearchContextMenu() {
    console.log('[搜索] 注册右键菜单监听器...');
    
    // 监听全局右键菜单
    document.addEventListener('contextmenu', (e) => {
        // 如果是在canvas上右键，不处理（让ComfyUI原生菜单显示）
        const canvas = document.querySelector('canvas.graph-canvas');
        if (canvas && canvas.contains(e.target)) {
            return;
        }
        
        // 如果是在我们的侧边栏上右键，显示搜索选项
        const sidebar = document.querySelector('.nm-sidebar-content');
        if (sidebar && sidebar.contains(e.target)) {
            e.preventDefault();
            console.log('[搜索] 右键菜单被触发！');
            showSearchContextMenu(e);
        }
    });
}

/**
 * 显示搜索右键菜单
 */
function showSearchContextMenu(event) {
    // 移除旧的菜单
    const oldMenu = document.querySelector('.nm-search-context-menu');
    if (oldMenu) {
        oldMenu.remove();
    }
    
    // 创建菜单
    const menu = document.createElement('div');
    menu.className = 'nm-search-context-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${event.clientX}px;
        top: ${event.clientY}px;
        background: var(--comfy-menu-bg, #1e1e1e);
        border: 1px solid var(--border-color, #555);
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
        z-index: 100001;
        min-width: 180px;
        padding: 4px 0;
    `;
    
    // 搜索选项
    const searchItem = document.createElement('div');
    searchItem.className = 'nm-context-menu-item';
    searchItem.innerHTML = '🔍 搜索节点 <span style="color: #999; font-size: 11px; margin-left: 8px;">Ctrl+K</span>';
    searchItem.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        color: var(--input-text, #fff);
        font-size: 13px;
        transition: background 0.15s;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;
    
    searchItem.addEventListener('mouseenter', () => {
        searchItem.style.background = 'var(--comfy-input-bg, #2a2a2a)';
    });
    
    searchItem.addEventListener('mouseleave', () => {
        searchItem.style.background = 'transparent';
    });
    
    searchItem.addEventListener('click', () => {
        menu.remove();
        openSearch();
    });
    
    menu.appendChild(searchItem);
    document.body.appendChild(menu);
    
    // 点击其他地方关闭菜单
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
            document.removeEventListener('contextmenu', closeMenu);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
        document.addEventListener('contextmenu', closeMenu);
    }, 0);
}

/**
 * 打开搜索弹窗
 */
function openSearch() {
    if (!searchOverlay) return;
    
    console.log('[搜索] 打开搜索弹窗');
    searchOverlay.classList.add('show');
    
    // 触发渐显动画
    requestAnimationFrame(() => {
        searchOverlay.classList.add('visible');
    });
    
    // 聚焦输入框
    setTimeout(() => {
        searchInput.focus();
    }, 100);
}

/**
 * 关闭搜索弹窗
 */
function closeSearch() {
    if (!searchOverlay) return;
    
    console.log('[搜索] 关闭搜索弹窗');
    searchOverlay.classList.remove('visible');
    
    setTimeout(() => {
        searchOverlay.classList.remove('show');
    }, 200);
}

/**
 * 处理搜索输入（带防抖）
 */
function handleSearchInput(e) {
    const keyword = e.target.value.trim();
    
    // 清除之前的定时器
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }
    
    // 200ms防抖
    searchDebounceTimer = setTimeout(() => {
        performSearch(keyword);
    }, 200);
}

/**
 * 执行搜索
 */
async function performSearch(keyword, inSidebar = false, mode = 'all') {
    console.log('[搜索] 执行搜索:', keyword, '在', inSidebar ? '侧边栏' : '全屏', '模式:', mode);
    
    if (!keyword) {
        if (inSidebar) {
            // 侧边栏：恢复默认视图
            showAllNodes();
        } else {
            // 全屏：显示提示
        searchResults.innerHTML = '<div class="nm-search-info">请输入关键词开始搜索</div>';
        }
        return;
    }
    
    // 预加载拼音数据（如果包含中文关键词或第一次搜索）
    if (Object.keys(nodePoolState.pinyinCache).length === 0 || /[\u4e00-\u9fa5]/.test(keyword)) {
        await preloadPinyinData();
    }
    
    // 搜索所有节点（传递搜索模式）
    const results = await searchNodes(keyword, mode);
    console.log('[搜索] 找到', results.length, '个匹配节点');
    
    // 根据显示位置渲染结果
    if (inSidebar) {
        renderSidebarSearchResults(results, keyword, mode);
    } else {
        renderFullScreenSearchResults(results, keyword, mode);
    }
}

/**
 * 搜索节点、文件夹和插件（支持拼音）
 * @param {string} keyword - 搜索关键词
 * @param {string} mode - 搜索模式：'all'（综合）、'node'（节点）或 'folder'（文件夹）
 */
async function searchNodes(keyword, mode = 'all') {
    const results = [];
    
    // 节点模式：只搜索节点名称
    if (mode === 'node') {
        nodePoolState.allNodes.forEach(node => {
            const displayName = getNodeDisplayName(node);
            const match = matchText(displayName, keyword);
            
            if (match.matched) {
                results.push({
                    type: 'node',
                    node,
                    score: match.score,
                    matchedFields: ['name'],
                    matchType: match.type
                });
            }
        });
        
        // 排序并返回
        return results.sort((a, b) => b.score - a.score);
    }
    
    // 综合模式或文件夹模式：搜索节点名称（仅综合模式）、文件夹、插件
    // 1. 搜索节点名称（仅综合模式）
    if (mode === 'all') {
        nodePoolState.allNodes.forEach(node => {
            const displayName = getNodeDisplayName(node);
            const match = matchText(displayName, keyword);
            
            if (match.matched) {
                results.push({
                    type: 'node',
                    node,
                    score: match.score,
                    matchedFields: ['name'],
                    matchType: match.type
                });
            }
        });
    }
    
    // 2. 搜索自定义文件夹名称（综合模式和文件夹模式）
    if (window.folderState && window.folderState.config && window.folderState.config.folders) {
        const folders = window.folderState.config.folders;
        
        Object.entries(folders).forEach(([folderId, folder]) => {
            const match = matchText(folder.name, keyword);
            
            if (match.matched) {
                // 获取该文件夹的节点
                const folderNodeIds = window.folderState.config.folderNodes?.[folderId] || [];
                const folderNodes = nodePoolState.allNodes.filter(node => 
                    folderNodeIds.includes(node.id)
                );
                
                console.log(`[搜索] ✅ 匹配到文件夹 "${folder.name}"，包含 ${folderNodes.length} 个节点`);
                
                // 将文件夹中的节点添加到结果（标记为来自文件夹）
                folderNodes.forEach(node => {
                    results.push({
                        type: 'folder',
                        node,
                        folderName: `📁 ${folder.name}`,
                        score: match.score + 10, // 文件夹匹配优先级更高
                        matchedFields: ['folder'],
                        matchType: match.type
                    });
                });
            }
        });
    }
    
    // 3. 搜索特殊文件夹（收藏、未分类、已隐藏）
    const specialFolders = [
        { 
            id: 'favorites', 
            name: '收藏', 
            icon: '⭐', 
            color: '#f59e0b', // 金色/琥珀色
            getNodes: () => nodePoolState.allNodes.filter(n => nodePoolState.favorites.has(n.id)) 
        },
        { 
            id: 'uncategorized', 
            name: '未分类', 
            icon: '📦', 
            color: '#8b5cf6', // 紫色
            getNodes: () => {
                const nodesInFolders = new Set();
                if (window.folderState && window.folderState.config && window.folderState.config.folderNodes) {
                    Object.values(window.folderState.config.folderNodes).forEach(nodeIds => {
                        if (Array.isArray(nodeIds)) {
                            nodeIds.forEach(id => nodesInFolders.add(id));
                        }
                    });
                }
                return nodePoolState.allNodes.filter(node => !nodesInFolders.has(node.id));
            }
        },
        { 
            id: 'hidden', 
            name: '已隐藏', 
            icon: '🙈', 
            color: '#6b7280', // 灰色
            getNodes: () => {
                const hiddenPlugins = window.folderState?.config?.hiddenPlugins || [];
                return nodePoolState.allNodes.filter(node => 
                    hiddenPlugins.includes(node.source)
                );
            }
        }
    ];
    
    specialFolders.forEach(specialFolder => {
        const match = matchText(specialFolder.name, keyword);
        if (match.matched) {
            const folderNodes = specialFolder.getNodes();
            console.log(`[搜索] 匹配到特殊文件夹 "${specialFolder.name}"，包含 ${folderNodes.length} 个节点`);
            
            folderNodes.forEach(node => {
            results.push({
                    type: 'special_folder',
                node,
                    folderName: `${specialFolder.icon} ${specialFolder.name}`,
                    specialFolderColor: specialFolder.color,
                    score: match.score + 12, // 特殊文件夹优先级最高
                    matchedFields: ['special_folder'],
                    matchType: match.type
                });
            });
        }
    });
    
    // 4. 搜索插件名称（插件来源也是文件夹）
    // 节点模式和文件夹模式都搜索插件
    if (nodePoolState.plugins) {
        nodePoolState.plugins.forEach(plugin => {
            const pluginName = plugin.display_name || plugin.name;
            const match = matchText(pluginName, keyword);
            
            if (match.matched) {
                // 获取该插件的所有节点
                const pluginNodes = nodePoolState.allNodes.filter(node => 
                    node.source === plugin.python_name || node.source === plugin.name
                );
                
                // 将插件的节点添加到结果（标记为来自插件）
                pluginNodes.forEach(node => {
                    results.push({
                        type: 'plugin',
                        node,
                        pluginName: `🔌 ${pluginName}`,  // 添加插件图标
                        score: match.score + 5, // 插件匹配优先级较高
                        matchedFields: ['plugin'],
                        matchType: match.type
                    });
                });
            }
        });
    }
    
    // 去重（同一节点可能在多个匹配中出现）
    const uniqueResults = [];
    const seenNodeIds = new Set();
    
    results.forEach(result => {
        if (!seenNodeIds.has(result.node.id)) {
            seenNodeIds.add(result.node.id);
            uniqueResults.push(result);
        }
    });
    
    // 按分数排序（相关性高的在前）
    uniqueResults.sort((a, b) => b.score - a.score);
    
    console.log('[搜索] 找到', uniqueResults.length, '个唯一节点');
    
    return uniqueResults;
}

/**
 * 多关键词搜索（每个标签独立搜索，完全复用单关键词搜索逻辑）
 * @param {Array} tags - 标签数组
 * @param {string} mode - 搜索模式：'all'（综合）、'node'（节点）或 'folder'（文件夹）
 */
async function searchMultipleKeywords(tags, mode = 'all') {
    const resultsByTag = [];
    
    // 为每个标签独立搜索（调用完整的 searchNodes 逻辑，传递模式）
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const keyword = tag.text;
        console.log(`[多关键词搜索] 搜索第${i+1}个标签: "${keyword}" (颜色索引: ${tag.colorIndex}) 模式: ${mode}`);
        
        // 调用现有的完整搜索逻辑（包括节点、文件夹、收藏、插件等），传递搜索模式
        const keywordResults = await searchNodes(keyword, mode);
        
        console.log(`[多关键词搜索] "${keyword}" 找到 ${keywordResults.length} 个结果`);
        
        // 存储该标签的搜索结果（包含颜色索引）
        resultsByTag.push({
            keyword,
            results: keywordResults,
            colorIndex: tag.colorIndex,  // 保持标签的固定颜色
            index: i
        });
    }
    
    return resultsByTag;
}

/**
 * 渲染多关键词搜索结果（每个关键词独立显示，复用单关键词渲染逻辑）
 * @param {Array} resultsByTag - 按标签分组的搜索结果
 * @param {string} mode - 搜索模式：'all'（综合）、'node'（节点）或 'folder'（文件夹）
 */
function renderMultiKeywordSearchResults(resultsByTag, mode = 'all') {
    // 查找所有节点池容器（侧边栏 + Modal）
    const containers = document.querySelectorAll('#nm-node-pool-body');
    
    if (containers.length === 0) {
        console.error('[多关键词搜索] 未找到容器元素');
        return;
    }
    
    console.log('[多关键词搜索] 更新', containers.length, '个容器，模式:', mode);
    
    // 为每个容器渲染搜索结果
    containers.forEach(container => {
        // 清空容器
        container.innerHTML = '';
        
        // 如果没有任何结果
        if (resultsByTag.length === 0 || resultsByTag.every(r => r.results.length === 0)) {
            container.innerHTML = `
                <div class="nm-empty-state">
                    <div class="nm-empty-state-icon">😢</div>
                    <div class="nm-empty-state-text">未找到匹配结果</div>
                    <div class="nm-empty-state-hint">试试其他关键词</div>
                </div>
            `;
            return;
        }
        
        // 为每个标签创建独立的结果区域
        resultsByTag.forEach((tagData) => {
            const { keyword, results, colorIndex } = tagData;
            
            // 跳过没有结果的关键词
            if (results.length === 0) {
                // 显示空结果提示
                const emptySection = document.createElement('div');
                emptySection.style.cssText = `
                    padding: 16px;
                    background: rgba(255, 100, 100, 0.05);
                    border: 1px solid rgba(255, 100, 100, 0.2);
                    border-radius: 8px;
                    margin-bottom: 16px;
                    text-align: center;
                    color: var(--descrip-text, #999);
                `;
                emptySection.innerHTML = `
                    <div style="font-size: 13px;">
                        <span style="opacity: 0.7;">关键词</span> 
                        <span style="padding: 2px 8px; background: rgba(240, 147, 251, 0.15); border: 1px solid rgba(240, 147, 251, 0.5); border-radius: 8px; margin: 0 4px;">${escapeHtml(keyword)}</span>
                        <span style="opacity: 0.7;">未找到匹配结果</span>
                    </div>
                `;
                container.appendChild(emptySection);
                return;
            }
            
            // 创建该关键词的结果区域
            const section = document.createElement('div');
            section.className = 'nm-keyword-section';
            section.style.cssText = `
                margin-bottom: 24px;
                padding: 16px;
                background: rgba(102, 126, 234, 0.05);
                border: 1px solid rgba(102, 126, 234, 0.2);
                border-radius: 12px;
            `;
            
            // 标题 - 显示关键词和结果数量（使用固定颜色索引）
            const colors = [
                { bg: 'rgba(102, 126, 234, 0.15)', border: 'rgba(102, 126, 234, 0.6)' },
                { bg: 'rgba(240, 147, 251, 0.15)', border: 'rgba(240, 147, 251, 0.6)' },
                { bg: 'rgba(79, 172, 254, 0.15)', border: 'rgba(79, 172, 254, 0.6)' },
                { bg: 'rgba(67, 233, 123, 0.15)', border: 'rgba(67, 233, 123, 0.6)' },
                { bg: 'rgba(250, 112, 154, 0.15)', border: 'rgba(250, 112, 154, 0.6)' }
            ];
            const color = colors[colorIndex % colors.length];  // 使用标签的固定颜色索引
            
            const header = document.createElement('div');
            header.style.cssText = `
                padding: 10px 14px;
                background: ${color.bg};
                border: 1.5px solid ${color.border};
                border-radius: 10px;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                font-weight: 500;
                color: var(--input-text, #fff);
            `;
            
            header.innerHTML = `
                <span style="font-size: 16px;">🔍</span>
                <span style="padding: 3px 10px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; font-weight: 600;">${escapeHtml(keyword)}</span>
                <span style="opacity: 0.8;">找到 <strong>${results.length}</strong> 个结果</span>
            `;
            
            section.appendChild(header);
            
            // 文件夹模式：按文件夹分组显示
            if (mode === 'folder') {
                // 按文件夹分组
                const groupedByFolder = {};
                results.forEach(result => {
                    const folderKey = result.folderName || result.pluginName || '其他';
                    if (!groupedByFolder[folderKey]) {
                        groupedByFolder[folderKey] = {
                            nodes: [],
                            color: result.specialFolderColor || null,
                            type: result.type
                        };
                    }
                    groupedByFolder[folderKey].nodes.push(result);
                });
                
                // 为每个文件夹创建分组
                Object.entries(groupedByFolder).forEach(([folderName, group]) => {
                    // 文件夹标题
                    const folderHeader = document.createElement('div');
                    folderHeader.className = 'nm-folder-group-header';
                    folderHeader.innerHTML = `
                        <span class="nm-folder-group-icon">${folderName}</span>
                        <span class="nm-folder-group-count">${group.nodes.length} 个节点</span>
                    `;
                    folderHeader.style.cssText = `
                        padding: 8px 12px;
                        background: ${group.color ? group.color + '15' : 'var(--comfy-input-bg, #2a2a2a)'};
                        border-left: 3px solid ${group.color || 'var(--primary-color, #4a9eff)'};
                        color: var(--primary-text, #e0e0e0);
                        font-size: 12px;
                        font-weight: 600;
                        border-radius: 4px;
                        margin: 8px 0 6px 0;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    `;
                    section.appendChild(folderHeader);
                    
                    // 节点网格
                    const grid = document.createElement('div');
                    grid.className = 'nm-node-grid';
                    group.nodes.forEach(result => {
                        const card = createSearchNodeCardWithHighlight(result.node, keyword, result);
                        grid.appendChild(card);
                    });
                    section.appendChild(grid);
                });
            } else {
                // 节点模式：平铺显示
                const grid = document.createElement('div');
                grid.className = 'nm-node-grid';
                
                results.forEach((result) => {
                    // 直接复用单关键词的卡片创建函数
                    const card = createSearchNodeCardWithHighlight(result.node, keyword, result);
                    grid.appendChild(card);
                });
                
                section.appendChild(grid);
            }
            
            container.appendChild(section);
        });
    });
}

/**
 * 多关键词高亮（不同颜色）- 暂未使用，保留供将来扩展
 */
function highlightMultipleKeywords(text, keywords) {
    if (!keywords || keywords.length === 0 || !text) return escapeHtml(text);
    
    const escapedText = escapeHtml(text);
    
    // 定义多种高亮颜色
    const colors = [
        '#ffd700',  // 金色
        '#ff6b6b',  // 红色
        '#4ecdc4',  // 青色
        '#95e1d3',  // 薄荷绿
        '#f38181'   // 粉红色
    ];
    
    let result = escapedText;
    
    // 按顺序高亮每个关键词（用不同颜色）
    keywords.forEach((keyword, index) => {
        const color = colors[index % colors.length];
        const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi');
        result = result.replace(regex, `<mark style="background: ${color}; color: #000; padding: 2px 4px; border-radius: 3px; font-weight: 600;">$1</mark>`);
    });
    
    return result;
}

/**
 * 渲染侧边栏搜索结果（在节点池中显示，支持多容器）
 * @param {Array} results - 搜索结果
 * @param {string} keyword - 搜索关键词
 * @param {string} mode - 搜索模式：'all'（综合）、'node'（节点）或 'folder'（文件夹）
 */
function renderSidebarSearchResults(results, keyword, mode = 'all') {
    // 查找所有节点池容器（侧边栏 + Modal）
    const containers = document.querySelectorAll('#nm-node-pool-body');
    
    if (containers.length === 0) {
        console.error('[侧边栏搜索] 未找到容器元素');
        return;
    }
    
    console.log('[侧边栏搜索] 更新', containers.length, '个容器，模式:', mode);
    
    // 为每个容器渲染搜索结果
    containers.forEach(container => {
        if (results.length === 0) {
            // 无结果
            container.innerHTML = `
                <div class="nm-empty-state">
                    <div class="nm-empty-state-icon">😢</div>
                    <div class="nm-empty-state-text">未找到匹配结果</div>
                    <div class="nm-empty-state-hint">试试其他关键词</div>
                </div>
            `;
            return;
        }
        
        // 创建搜索结果容器
        container.innerHTML = '';
        
        // 文件夹模式：按文件夹分组显示
        if (mode === 'folder') {
            renderFolderGroupedResults(container, results, keyword);
        } else {
            // 节点模式和综合模式：平铺显示所有节点
            renderFlatNodeResults(container, results, keyword);
        }
    });
}

/**
 * 平铺显示节点结果（节点模式）
 */
function renderFlatNodeResults(container, results, keyword) {
    // 添加搜索结果计数
    const countDiv = document.createElement('div');
    countDiv.className = 'nm-search-result-count';
    
    countDiv.innerHTML = `
        <span class="nm-search-result-icon">🔍</span> 
        找到 <strong>${results.length}</strong> 个匹配节点
    `;
    countDiv.style.cssText = `
        padding: 12px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-size: 14px;
        font-weight: 500;
        border-radius: 8px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    `;
    container.appendChild(countDiv);
    
    // 创建节点网格
    const grid = document.createElement('div');
    grid.className = 'nm-node-grid';
    
    results.forEach((result) => {
        const card = createSearchNodeCardWithHighlight(result.node, keyword, result);
        grid.appendChild(card);
    });
    
    container.appendChild(grid);
}

/**
 * 按文件夹分组显示结果（文件夹模式）
 */
function renderFolderGroupedResults(container, results, keyword) {
    // 按文件夹分组
    const groupedByFolder = {};
    results.forEach(result => {
        const folderKey = result.folderName || result.pluginName || '其他';
        if (!groupedByFolder[folderKey]) {
            groupedByFolder[folderKey] = {
                nodes: [],
                color: result.specialFolderColor || null,
                type: result.type
            };
        }
        groupedByFolder[folderKey].nodes.push(result);
    });
    
    const folderCount = Object.keys(groupedByFolder).length;
    const totalNodes = results.length;
    
    // 添加统计信息
    const countDiv = document.createElement('div');
    countDiv.className = 'nm-search-result-count';
    countDiv.innerHTML = `
        <span class="nm-search-result-icon">📁</span> 
        找到 <strong>${folderCount}</strong> 个文件夹，共 <strong>${totalNodes}</strong> 个节点
    `;
    countDiv.style.cssText = `
        padding: 12px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-size: 14px;
        font-weight: 500;
        border-radius: 8px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    `;
    container.appendChild(countDiv);
    
    // 为每个文件夹创建分组
    Object.entries(groupedByFolder).forEach(([folderName, group]) => {
        // 文件夹标题
        const folderHeader = document.createElement('div');
        folderHeader.className = 'nm-folder-group-header';
        folderHeader.innerHTML = `
            <span class="nm-folder-group-icon">${folderName}</span>
            <span class="nm-folder-group-count">${group.nodes.length} 个节点</span>
        `;
        folderHeader.style.cssText = `
            padding: 10px 16px;
            background: ${group.color ? group.color + '20' : 'var(--comfy-input-bg, #2a2a2a)'};
            border-left: 4px solid ${group.color || 'var(--primary-color, #4a9eff)'};
            color: var(--primary-text, #e0e0e0);
            font-size: 13px;
            font-weight: 600;
            border-radius: 6px;
            margin: 12px 0 8px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        container.appendChild(folderHeader);
        
        // 节点网格
        const grid = document.createElement('div');
        grid.className = 'nm-node-grid';
        group.nodes.forEach(result => {
            const card = createSearchNodeCardWithHighlight(result.node, keyword, result);
            grid.appendChild(card);
        });
        container.appendChild(grid);
    });
}

/**
 * 创建带高亮的搜索节点卡片
 */
function createSearchNodeCardWithHighlight(node, keyword, searchResult = null) {
    const card = document.createElement('div');
    card.className = 'nm-node-card';
    card.dataset.nodeId = node.id;
    card.dataset.classType = node.class_type;
    card.draggable = true;
    
    // 是否收藏
    const isFavorited = nodePoolState.favorites.has(node.id);
    if (isFavorited) {
        card.classList.add('favorited');
    }
    
    // 是否有笔记
    const hasNote = !!nodePoolState.notes[node.id];
    
    // 获取显示名称（优先使用自定义名称）
    const displayName = getNodeDisplayName(node);
    
    // 高亮节点名称
    const highlightedName = highlightKeyword(displayName, keyword);
    
    // 构建匹配来源标签
    let matchSourceBadge = '';
    if (searchResult) {
        if (searchResult.type === 'folder' && searchResult.folderName) {
            // 自定义文件夹 - 绿色标签
            matchSourceBadge = `<div class="nm-search-match-badge" style="background: #10b981; color: white; padding: 3px 10px; border-radius: 14px; font-size: 11px; display: inline-block; margin-top: 6px; font-weight: 500; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">${escapeHtml(searchResult.folderName)}</div>`;
        } else if (searchResult.type === 'special_folder' && searchResult.folderName) {
            // 特殊文件夹 - 使用动态颜色（金色/紫色/灰色）
            const color = searchResult.specialFolderColor || '#8b5cf6';
            matchSourceBadge = `<div class="nm-search-match-badge" style="background: ${color}; color: white; padding: 3px 10px; border-radius: 14px; font-size: 11px; display: inline-block; margin-top: 6px; font-weight: 500; box-shadow: 0 2px 4px rgba(139, 92, 246, 0.3);">${escapeHtml(searchResult.folderName)}</div>`;
        } else if (searchResult.type === 'plugin' && searchResult.pluginName) {
            // 插件 - 蓝色标签
            matchSourceBadge = `<div class="nm-search-match-badge" style="background: #3b82f6; color: white; padding: 3px 10px; border-radius: 14px; font-size: 11px; display: inline-block; margin-top: 6px; font-weight: 500; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);">📦 ${escapeHtml(searchResult.pluginName)}</div>`;
        }
    }
    
    card.innerHTML = `
        <div class="nm-node-card-header">
            <div class="nm-node-card-icon">🔧</div>
            <div class="nm-node-card-actions">
                <button class="nm-node-card-btn favorite ${isFavorited ? 'active' : ''}" 
                        data-action="favorite" title="${isFavorited ? '取消收藏' : '收藏'}">
                    <span class="nm-btn-icon">${isFavorited ? '⭐' : '☆'}</span>
                    <span class="nm-btn-text">收藏</span>
                </button>
                <button class="nm-node-card-btn note ${hasNote ? 'has-note' : ''}" 
                        data-action="note" title="${hasNote ? '查看或编辑笔记' : '添加笔记'}">
                    <span class="nm-btn-icon">📝</span>
                    <span class="nm-btn-text">笔记</span>
                    ${hasNote ? `<div class="nm-note-preview">${escapeHtml(truncateText(nodePoolState.notes[node.id] || '', 150))}</div>` : ''}
                </button>
            </div>
        </div>
        <div class="nm-node-card-name">${highlightedName}</div>
        ${matchSourceBadge}
        ${node.category ? `<div class="nm-node-card-category">${escapeHtml(node.category)}</div>` : ''}
        <div class="nm-node-card-source">${escapeHtml(node.source)}</div>
    `;
    
    // 绑定事件
    bindNodeCardEvents(card, node);
    
    return card;
}

/**
 * 高亮关键词
 */
function highlightKeyword(text, keyword) {
    if (!keyword || !text) return escapeHtml(text);
    
    const escapedText = escapeHtml(text);
    const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi');
    
    return escapedText.replace(regex, '<mark style="background: #ffd700; color: #000; padding: 2px 4px; border-radius: 3px; font-weight: 600;">$1</mark>');
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 渲染全屏搜索结果
 * @param {Array} results - 搜索结果
 * @param {string} keyword - 搜索关键词
 * @param {string} mode - 搜索模式：'all'（综合）、'node'（节点）或 'folder'（文件夹）（暂不支持，为将来扩展）
 */
function renderFullScreenSearchResults(results, keyword, mode = 'all') {
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="nm-search-info">未找到匹配节点，试试其他关键词</div>';
        return;
    }
    
    // 结果计数
    let html = `<div class="nm-search-count">共找到 ${results.length} 个节点</div>`;
    
    // 网格容器
    html += '<div class="nm-search-results-grid">';
    
    results.forEach(({ node }) => {
        html += createSearchNodeCard(node, keyword);
    });
    
    html += '</div>';
    
    searchResults.innerHTML = html;
    
    // 绑定事件
    bindSearchNodeEvents();
}

/**
 * 创建搜索结果节点卡片（复用节点池卡片）
 */
function createSearchNodeCard(node, keyword) {
    const isFavorited = nodePoolState.favorites.has(node.id);
    const hasNote = nodePoolState.notes[node.id];
    
    return `
        <div class="nm-node-card" data-node-id="${node.id}">
            <div class="nm-node-header">
                <div class="nm-node-name" title="${node.display_name}">${highlightKeyword(node.display_name, keyword)}</div>
                <div class="nm-node-source" title="${node.source}">${node.source}</div>
            </div>
            <div class="nm-node-actions">
                <button class="nm-node-btn ${isFavorited ? 'active' : ''}" 
                        data-action="favorite" 
                        title="${isFavorited ? '取消收藏' : '收藏'}">
                    <span class="nm-btn-icon">${isFavorited ? '★' : '☆'}</span>
                    <span class="nm-btn-text">${isFavorited ? '已收藏' : '收藏'}</span>
                </button>
                <button class="nm-node-btn ${hasNote ? 'active' : ''}" 
                        data-action="note" 
                        title="笔记">
                    <span class="nm-btn-icon">📝</span>
                    <span class="nm-btn-text">笔记</span>
                </button>
            </div>
        </div>
    `;
}

/**
 * 绑定搜索结果节点事件
 */
function bindSearchNodeEvents() {
    const cards = searchResults.querySelectorAll('.nm-node-card');
    
    cards.forEach(card => {
        const nodeId = card.dataset.nodeId;
        const node = nodePoolState.allNodes.find(n => n.id === nodeId);
        if (!node) return;
        
        // 点击卡片添加节点（复用现有逻辑）
        card.addEventListener('click', (e) => {
            // 如果点击的是按钮，不处理
            if (e.target.closest('.nm-node-btn')) return;
            
            // 添加节点到画布
            createNodeOnCanvas(node);
            
            // 关闭搜索弹窗
            closeSearch();
        });
        
        // 拖拽节点（复用现有逻辑）
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
            window.__draggingFromNodePool = true;
            window.__draggingNode = node;
            e.dataTransfer.effectAllowed = 'copy';
        });
        
        card.addEventListener('dragend', () => {
            window.__draggingFromNodePool = false;
            window.__draggingNode = null;
            
            // 如果拖到画布外，关闭搜索
            setTimeout(() => {
                if (!window.__draggingFromNodePool) {
                    closeSearch();
                }
            }, 100);
        });
        
        // 收藏按钮
        const favoriteBtn = card.querySelector('[data-action="favorite"]');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(nodeId, card);
            });
        }
        
        // 笔记按钮
        const noteBtn = card.querySelector('[data-action="note"]');
        if (noteBtn) {
            noteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showNoteEditor(nodeId, node.display_name);
            });
        }
    });
}

/**
 * 清空搜索
 */
function clearSearch() {
    searchInput.value = '';
    searchResults.innerHTML = '<div class="nm-search-info">请输入关键词开始搜索</div>';
    searchInput.focus();
}

// ==================== 侧边栏搜索功能 ====================

/**
 * 显示所有节点（恢复默认空状态）
 */
function showAllNodes() {
    const container = document.getElementById('nm-node-pool-body');
    if (container) {
        container.innerHTML = `
            <div class="nm-empty-state">
                <div class="nm-empty-state-icon">📦</div>
                <div class="nm-empty-state-text">暂无节点</div>
                <div class="nm-empty-state-hint">请选择左侧文件夹或插件来源</div>
            </div>
        `;
    }
}

/**
 * 初始化侧边栏搜索
 */
function initSidebarSearch() {
    console.log('[侧边栏搜索] 初始化...');
    
    // 监听侧边栏搜索事件 - 使用全屏搜索的逻辑，但在节点池显示
    window.addEventListener('nm:searchInSidebar', async (e) => {
        const keyword = e.detail.keyword;
        const mode = e.detail.mode || 'all';  // 默认综合模式
        console.log('[侧边栏搜索] 执行搜索:', keyword, '模式:', mode);
        
        // 调用全屏搜索的逻辑（支持拼音），传递模式
        await performSearch(keyword, true, mode); // 第三个参数是搜索模式
    });
    
    // 监听清空侧边栏搜索事件
    window.addEventListener('nm:clearSidebarSearch', () => {
        console.log('[侧边栏搜索] 清空搜索');
        // 恢复默认视图
        showAllNodes();
    });
    
    // 监听多关键词搜索事件
    window.addEventListener('nm:searchMultipleKeywords', async (e) => {
        const tags = e.detail.tags;  // 接收完整的tag对象数组
        const mode = e.detail.mode || 'all';  // 搜索模式，默认综合
        console.log('[多关键词搜索] 搜索标签:', tags, '模式:', mode);
        
        if (!tags || tags.length === 0) {
            showAllNodes();
            return;
        }
        
        // 预加载拼音数据（如果需要）
        if (Object.keys(nodePoolState.pinyinCache).length === 0) {
            await preloadPinyinData();
        }
        
        // 执行多关键词搜索（传递模式）
        const results = await searchMultipleKeywords(tags, mode);
        console.log('[多关键词搜索] 总共找到', results.length, '组结果');
        
        // 渲染搜索结果（携带颜色信息和模式）
        renderMultiKeywordSearchResults(results, mode);
    });
    
    // 监听获取搜索建议事件
    window.addEventListener('nm:getSearchSuggestions', async (e) => {
        const { keyword, callback } = e.detail;
        if (!keyword || !callback) return;
        
        // 预加载拼音数据（如果需要）
        if (Object.keys(nodePoolState.pinyinCache).length === 0) {
            await preloadPinyinData();
        }
        
        // 搜索节点
        const results = await searchNodes(keyword);
        
        // 转换为建议格式
        const suggestions = results.map(({ node }) => ({
            id: node.id,
            displayName: getNodeDisplayName(node),
            category: node.category || '未分类',
            source: node.source
        }));
        
        // 回调返回建议
        callback(keyword, suggestions);
    });
}

/**
 * 获取拼音数据（批量，带缓存）
 */
async function fetchPinyinData(texts) {
    // 过滤出未缓存的文本
    const uncachedTexts = texts.filter(text => !nodePoolState.pinyinCache[text]);
    
    if (uncachedTexts.length === 0) {
        // 全部已缓存
        return;
    }
    
    try {
        const response = await fetch('/node-manager/search/pinyin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: uncachedTexts })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 合并到缓存
            Object.assign(nodePoolState.pinyinCache, result.data);
            console.log('[拼音缓存] 新增', result.count, '条拼音数据');
        } else {
            console.warn('[拼音缓存] 获取失败:', result.error);
        }
    } catch (error) {
        console.error('[拼音缓存] 请求失败:', error);
    }
}

/**
 * 预加载拼音数据（节点和文件夹名称）
 */
async function preloadPinyinData() {
    const texts = [];
    
    // 收集所有需要拼音的文本
    // 1. 节点显示名称
    nodePoolState.allNodes.forEach(node => {
        const displayName = getNodeDisplayName(node);
        if (displayName && /[\u4e00-\u9fa5]/.test(displayName)) {
            // 包含中文才需要拼音
            texts.push(displayName);
        }
    });
    
    // 2. 自定义文件夹名称
    if (folderState.config && folderState.config.folders) {
        Object.values(folderState.config.folders).forEach(folder => {
            if (folder.name && /[\u4e00-\u9fa5]/.test(folder.name)) {
                texts.push(folder.name);
            }
        });
    }
    
    // 去重
    const uniqueTexts = [...new Set(texts)];
    
    if (uniqueTexts.length > 0) {
        console.log('[拼音预加载] 开始加载', uniqueTexts.length, '条数据...');
        await fetchPinyinData(uniqueTexts);
        console.log('[拼音预加载] 完成');
    }
}

/**
 * 检查文本是否匹配关键词（支持拼音）
 */
function matchText(text, keyword) {
    if (!text || !keyword) return { matched: false, score: 0 };
    
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    let score = 0;
    let matchType = null;
    
    // 1. 完全匹配（最高分）
    if (lowerText === lowerKeyword) {
        return { matched: true, score: 100, type: 'exact' };
    }
    
    // 2. 开头匹配
    if (lowerText.startsWith(lowerKeyword)) {
        return { matched: true, score: 80, type: 'start' };
    }
    
    // 3. 包含匹配
    if (lowerText.includes(lowerKeyword)) {
        return { matched: true, score: 50, type: 'contain' };
    }
    
    // 4. 拼音匹配（如果有缓存）
    const pinyinData = nodePoolState.pinyinCache[text];
    if (pinyinData) {
        // 拼音首字母匹配
        if (pinyinData.initials && pinyinData.initials.includes(lowerKeyword)) {
            return { matched: true, score: 40, type: 'pinyin_initials' };
        }
        
        // 全拼匹配
        if (pinyinData.full && pinyinData.full.includes(lowerKeyword)) {
            return { matched: true, score: 35, type: 'pinyin_full' };
        }
    }
    
    return { matched: false, score: 0 };
}

/**
 * 执行侧边栏搜索
 */
async function performSidebarSearch(keyword) {
    if (!keyword) {
        clearSidebarSearch();
        return;
    }
    
    nodePoolState.searchActive = true;
    nodePoolState.searchKeyword = keyword;
    
    // 显示加载状态
    updateNodePoolHeader('🔍 搜索中...', 0);
    renderNodePool([]);
    
    // 预加载拼音数据（如果还没加载）
    if (Object.keys(nodePoolState.pinyinCache).length === 0) {
        await preloadPinyinData();
    }
    
    const lowerKeyword = keyword.toLowerCase();
    const results = {
        nodes: [],
        folders: []
    };
    
    // 1. 搜索节点
    nodePoolState.allNodes.forEach(node => {
        const displayName = getNodeDisplayName(node);
        const source = node.source || '';
        const category = node.category || '';
        const note = nodePoolState.notes[node.id] || '';
        
        let totalScore = 0;
        const matchedFields = [];
        
        // 匹配显示名称
        const nameMatch = matchText(displayName, keyword);
        if (nameMatch.matched) {
            totalScore += nameMatch.score;
            matchedFields.push('name');
        }
        
        // 匹配插件来源
        const sourceMatch = matchText(source, keyword);
        if (sourceMatch.matched) {
            totalScore += sourceMatch.score * 0.3;
            matchedFields.push('source');
        }
        
        // 匹配分类
        const categoryMatch = matchText(category, keyword);
        if (categoryMatch.matched) {
            totalScore += categoryMatch.score * 0.2;
            matchedFields.push('category');
        }
        
        // 匹配笔记
        const noteMatch = matchText(note, keyword);
        if (noteMatch.matched) {
            totalScore += noteMatch.score * 0.5;
            matchedFields.push('note');
        }
        
        if (totalScore > 0) {
            results.nodes.push({
                node,
                score: totalScore,
                matchedFields
            });
        }
    });
    
    // 2. 搜索文件夹（我的分类）
    if (folderState.config && folderState.config.folders) {
        Object.entries(folderState.config.folders).forEach(([folderId, folder]) => {
            const folderName = folder.name || '';
            
            const nameMatch = matchText(folderName, keyword);
            if (nameMatch.matched) {
                // 计算文件夹中的节点数量（包括子文件夹）
                const nodeCount = getAllFolderNodeIds(folderId, folderState.config).size;
                
                results.folders.push({
                    id: folderId,
                    name: folderName,
                    nodeCount,
                    score: nameMatch.score,
                    type: 'custom'
                });
            }
        });
    }
    
    // 3. 搜索插件（插件来源）
    nodePoolState.plugins.forEach(plugin => {
        const pluginName = plugin.name || '';
        
        const nameMatch = matchText(pluginName, keyword);
        if (nameMatch.matched) {
            results.folders.push({
                id: plugin.name,
                name: pluginName,
                nodeCount: plugin.node_count || 0,
                score: nameMatch.score,
                type: 'plugin'
            });
        }
    });
    
    // 排序
    results.nodes.sort((a, b) => b.score - a.score);
    results.folders.sort((a, b) => b.score - a.score);
    
    // 保存结果
    nodePoolState.searchResults = results;
    
    // 渲染结果
    renderSearchResults(results, keyword);
}

/**
 * 渲染搜索结果（节点在上，文件夹在下）
 */
function renderSearchResults(results, keyword) {
    const totalCount = results.nodes.length + results.folders.length;
    
    updateNodePoolHeader(`🔍 搜索: ${keyword}`, totalCount);
    
    if (totalCount === 0) {
        renderNodePool([]);
        const container = document.getElementById('nm-node-pool-body');
        if (container) {
            container.innerHTML = `
                <div class="nm-empty-state">
                    <div class="nm-empty-state-icon">😢</div>
                    <div class="nm-empty-state-text">未找到匹配结果</div>
                    <div class="nm-empty-state-hint">试试其他关键词</div>
                </div>
            `;
        }
        return;
    }
    
    const container = document.getElementById('nm-node-pool-body');
    if (!container) return;
    
    container.innerHTML = '';
    
    // 创建结果容器
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'nm-search-results-container';
    
    // 1. 显示节点结果
    if (results.nodes.length > 0) {
        const nodesSection = document.createElement('div');
        nodesSection.className = 'nm-search-section';
        
        const nodesHeader = document.createElement('div');
        nodesHeader.className = 'nm-search-section-header';
        nodesHeader.textContent = `📦 节点 (${results.nodes.length})`;
        nodesSection.appendChild(nodesHeader);
        
        const nodesGrid = document.createElement('div');
        nodesGrid.className = 'nm-node-grid';
        
        results.nodes.forEach(({ node }) => {
            const card = createNodeCard(node);
            nodesGrid.appendChild(card);
        });
        
        nodesSection.appendChild(nodesGrid);
        resultsContainer.appendChild(nodesSection);
    }
    
    // 2. 显示文件夹结果
    if (results.folders.length > 0) {
        const foldersSection = document.createElement('div');
        foldersSection.className = 'nm-search-section';
        
        const foldersHeader = document.createElement('div');
        foldersHeader.className = 'nm-search-section-header';
        foldersHeader.textContent = `📁 文件夹 (${results.folders.length})`;
        foldersSection.appendChild(foldersHeader);
        
        const foldersGrid = document.createElement('div');
        foldersGrid.className = 'nm-search-folder-grid';
        
        results.folders.forEach(folder => {
            const folderCard = createSearchFolderCard(folder);
            foldersGrid.appendChild(folderCard);
        });
        
        foldersSection.appendChild(foldersGrid);
        resultsContainer.appendChild(foldersSection);
    }
    
    container.appendChild(resultsContainer);
}

/**
 * 创建搜索结果中的文件夹卡片
 */
function createSearchFolderCard(folder) {
    const card = document.createElement('div');
    card.className = 'nm-search-folder-card';
    card.dataset.folderId = folder.id;
    card.dataset.folderType = folder.type;
    
    card.innerHTML = `
        <div class="nm-search-folder-icon">${folder.type === 'custom' ? '📁' : '📦'}</div>
        <div class="nm-search-folder-info">
            <div class="nm-search-folder-name">${escapeHtml(folder.name)}</div>
            <div class="nm-search-folder-count">${folder.nodeCount} 个节点</div>
        </div>
        <div class="nm-search-folder-arrow">→</div>
    `;
    
    // 点击事件
    card.addEventListener('click', () => {
        handleSearchFolderClick(folder);
    });
    
    return card;
}

/**
 * 处理搜索结果中文件夹的点击
 */
function handleSearchFolderClick(folder) {
    console.log('[搜索文件夹] 点击:', folder);
    
    // 保存当前搜索状态到历史
    nodePoolState.searchHistory.push({
        keyword: nodePoolState.searchKeyword,
        results: nodePoolState.searchResults
    });
    
    // 显示文件夹内的节点
    if (folder.type === 'custom') {
        // 自定义文件夹
        showNodesByFolder(folder.id);
    } else if (folder.type === 'plugin') {
        // 插件文件夹
        showNodesByPlugin(folder.id, folder.name, 'search');
    }
    
    // 显示返回按钮
    const backBtn = document.getElementById('nm-back-btn');
    if (backBtn) {
        backBtn.style.display = 'flex';
        backBtn.title = '返回搜索结果';
        
        // 更新返回按钮的事件（覆盖之前的）
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        
        newBackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('nm:searchBackToResults'));
        });
    }
}

/**
 * 返回搜索结果
 */
function backToSearchResults() {
    if (nodePoolState.searchHistory.length === 0) {
        // 没有历史，清空搜索
        clearSidebarSearch();
        return;
    }
    
    // 恢复上一次的搜索结果
    const lastSearch = nodePoolState.searchHistory.pop();
    nodePoolState.searchKeyword = lastSearch.keyword;
    nodePoolState.searchResults = lastSearch.results;
    
    // 重新渲染搜索结果
    renderSearchResults(lastSearch.results, lastSearch.keyword);
    
    // 恢复搜索框的值
    const searchInput = document.getElementById('nm-search-input');
    if (searchInput) {
        searchInput.value = lastSearch.keyword;
    }
    
    // 隐藏返回按钮（如果没有更多历史）
    if (nodePoolState.searchHistory.length === 0) {
        const backBtn = document.getElementById('nm-back-btn');
        if (backBtn) {
            backBtn.style.display = 'none';
        }
    }
}

/**
 * 清空侧边栏搜索
 */
function clearSidebarSearch() {
    nodePoolState.searchActive = false;
    nodePoolState.searchKeyword = '';
    nodePoolState.searchResults = { nodes: [], folders: [] };
    nodePoolState.searchHistory = [];
    
    // 恢复默认视图
    renderNodePool([]);
    updateNodePoolHeader('📦 节点池', 0);
    
    // 隐藏返回按钮
    const backBtn = document.getElementById('nm-back-btn');
    if (backBtn) {
        backBtn.style.display = 'none';
    }
}

/**
 * 拦截ComfyUI双击画布搜索（使用捕获阶段+私有通道）
 */
function interceptCanvasDoubleClick(retryCount = 0) {
    console.log('[画布拦截] 开始拦截双击事件... (尝试', retryCount + 1, '次)');
    
    // 等待画布就绪
    if (!app || !app.canvas || !app.canvas.canvas) {
        if (retryCount < 20) { // 最多重试20次（10秒）
            console.warn('[画布拦截] 画布未就绪，500ms后重试');
            setTimeout(() => interceptCanvasDoubleClick(retryCount + 1), 500);
        } else {
            console.error('[画布拦截] ❌ 画布始终未就绪，放弃拦截');
        }
        return;
    }
    
    const canvas = app.canvas.canvas;
    
    // 检查是否已经添加过监听器（避免重复）
    if (canvas.__nodeManagerInterceptInstalled) {
        console.log('[画布拦截] 监听器已存在，跳过');
        return;
    }
    
    // 标记插件已就绪
    window.__nodeManagerReady = true;
    
    // 注意：官方搜索拦截已移到 folder_manager.js 的 setup() 中
    // 在 ComfyUI 完全就绪后执行，确保 emitEvent 已创建
    
    // 在捕获阶段监听双击（比官方更早拿到事件）
    canvas.addEventListener('dblclick', (e) => {
        console.log('[画布拦截] 捕获阶段检测到双击');
        
        // 1. 检查插件是否就绪
        if (!window.__nodeManagerReady) {
            console.log('[画布拦截] 插件未就绪，放行给官方');
            return; // 放行，让官方处理
        }
        
        // 2. 检查是否在输入状态（不拦截）
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        )) {
            console.log('[画布拦截] 正在输入，不拦截');
            return;
        }
        
        // 3. 检查是否点击在节点上（不拦截）
        try {
            // 计算画布坐标（如果 e.canvasX 不存在）
            let canvasX = e.canvasX;
            let canvasY = e.canvasY;
            
            if (canvasX === undefined || canvasY === undefined) {
                // 从客户端坐标转换为画布坐标
                const rect = canvas.getBoundingClientRect();
                const clientX = e.clientX - rect.left;
                const clientY = e.clientY - rect.top;
                
                // 转换为画布坐标（考虑缩放和偏移）
                canvasX = (clientX / app.canvas.ds.scale) - app.canvas.ds.offset[0];
                canvasY = (clientY / app.canvas.ds.scale) - app.canvas.ds.offset[1];
                
                console.log('[画布拦截] 计算画布坐标:', { canvasX, canvasY });
            }
            
            const node = app.graph.getNodeOnPos(canvasX, canvasY, app.canvas.visible_nodes);
            if (node) {
                console.log('[画布拦截] 点击在节点上，不拦截');
                return;
            }
        } catch (err) {
            console.warn('[画布拦截] 检查节点位置失败，放行', err);
            return;
        }
        
        // 4. 检查是否在拖拽中（不拦截）
        if (app.canvas.dragging_canvas || app.canvas.node_dragged) {
            console.log('[画布拦截] 正在拖拽，不拦截');
            return;
        }
        
        // 5. 空白画布双击 - 拦截！
        console.log('[画布拦截] ✅ 空白区域双击，拦截并触发我们的搜索');
        
        // 立即阻止事件传播（确保官方收不到）
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // 使用私有通道触发我们的搜索（不依赖DOM的dblclick）
        setTimeout(() => {
            openSidebarSearch();
        }, 0);
        
        return false;
        
    }, true); // ⚠️ 使用捕获阶段！优先级最高
    
    // 标记监听器已安装
    canvas.__nodeManagerInterceptInstalled = true;
    
    console.log('[画布拦截] ✅ 双击事件拦截已成功设置（捕获阶段）');
    console.log('[画布拦截] 画布对象:', canvas);
    console.log('[画布拦截] 现在双击画布空白处将触发侧边栏搜索');
}

/**
 * 打开搜索（通过双击画布触发）
 * 现在改为打开 Modal 窗口
 */
function openSidebarSearch() {
    console.log('[搜索] 通过双击画布打开 Modal 搜索窗口');
    
    try {
        // 调用 Modal 搜索窗口
        openModalSearch();
    } catch (error) {
        console.error('[搜索] 打开 Modal 失败:', error);
    }
}

// ========== 互联网模式相关函数 ==========

/**
 * 加载在线可用插件列表（后端有缓存，直接请求即可）
 */
async function loadAvailablePlugins(forceRefresh = true) {
    try {
        // 显示加载状态
        const poolBody = document.getElementById('nm-node-pool-body');
        if (poolBody) {
            poolBody.innerHTML = `
                <div class="nm-empty-state">
                    <div class="nm-empty-state-icon">⏳</div>
                    <div class="nm-empty-state-text">🔄 刷新中...</div>
                </div>
            `;
        }
        
        // 每次都强制刷新（添加时间戳绕过缓存）
        const timestamp = forceRefresh ? `?t=${Date.now()}` : '';
        const response = await fetch(`/node-manager/store/available-plugins${timestamp}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '获取插件列表失败');
        }
        
        nodePoolState.availablePlugins = data.plugins || [];
        nodePoolState.internetMode = true;
        
        // 🎲 随机打乱插件顺序：让每次打开都不同，所有插件都有机会被优先刷新
        shuffleArray(nodePoolState.availablePlugins);
        
        // 日志：让用户知道确实在随机刷新
        console.log('[互联网] 插件列表加载完成，总数:', nodePoolState.availablePlugins.length);
        console.log('[互联网] 🎲 已随机打乱顺序，每次点击都会看到不同的排序结果');
        if (data.stars_stats) {
            const { local, manager, none } = data.stars_stats;
            // Stars数据来源统计（静默）
        }
        
        // 直接显示在线插件（已包含合并后的stars数据：本地 > Manager > 0）
        showOnlinePlugins();
        
        // 启动懒加载：优先更新可见插件，后台更新其他插件
        setTimeout(() => {
            startLazyLoading();
        }, 500);  // 延迟500ms启动，确保DOM已渲染
        
    } catch (error) {
        const poolBody = document.getElementById('nm-node-pool-body');
        if (poolBody) {
            poolBody.innerHTML = `
                <div class="nm-empty-state">
                    <div class="nm-empty-state-icon" style="font-size: 48px;">❌</div>
                    <div class="nm-empty-state-text" style="color: #ff6b6b;">加载失败</div>
                    <div class="nm-empty-state-hint">${error.message}</div>
                    <button onclick="window.nodePoolState.reloadOnlinePlugins()" style="
                        margin-top: 16px;
                        padding: 8px 16px;
                        border: 1px solid var(--border-color);
                        border-radius: 6px;
                        background: var(--comfy-input-bg);
                        color: var(--input-text);
                        cursor: pointer;
                    ">重试</button>
                </div>
            `;
        }
    }
}

/**
 * 显示在线插件列表
 */
function showOnlinePlugins(searchQuery = '') {
    console.log('[互联网] 显示在线插件, 搜索:', searchQuery);
    
    let plugins = [...nodePoolState.availablePlugins];
    
    // 应用搜索过滤
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        plugins = plugins.filter(plugin => {
            const title = (plugin.title || '').toLowerCase();
            const description = (plugin.description || '').toLowerCase();
            const author = (plugin.author || '').toLowerCase();
            return title.includes(query) || description.includes(query) || author.includes(query);
        });
    }
    
    // 应用安装状态过滤
    if (nodePoolState.internetFilter === 'installed') {
        plugins = plugins.filter(p => p.is_installed);
    } else if (nodePoolState.internetFilter === 'uninstalled') {
        plugins = plugins.filter(p => !p.is_installed);
    }
    
    // 应用排序（random = 保持随机打乱的顺序，不排序）
    if (nodePoolState.internetSort !== 'random') {
        plugins.sort((a, b) => {
            switch (nodePoolState.internetSort) {
                case 'name':
                    return (a.title || '').localeCompare(b.title || '');
                case 'updated':
                    return (b.updated_at || 0) - (a.updated_at || 0);
                case 'stars':
                    return (b.stars || 0) - (a.stars || 0);
                default:
                    return 0;
            }
        });
    } else {
        console.log('[互联网] 🎲 使用随机排序，保持打乱后的顺序');
    }
    
    // 更新header
    updateNodePoolHeader(`🌐 互联网插件`, plugins.length);
    
    // 渲染插件列表
    renderOnlinePlugins(plugins);
    
    // 触发懒加载：更新当前显示的插件
    setTimeout(() => {
        onPluginListChanged(plugins);
    }, 100);
}

/**
 * 渲染在线插件卡片
 */
function renderOnlinePlugins(plugins) {
    const poolBody = document.getElementById('nm-node-pool-body');
    if (!poolBody) return;
    
    if (plugins.length === 0) {
        poolBody.innerHTML = `
            <div class="nm-empty-state">
                <div class="nm-empty-state-icon">🔍</div>
                <div class="nm-empty-state-text">没有找到匹配的插件</div>
            </div>
        `;
        return;
    }
    
    poolBody.innerHTML = '';
    
    plugins.forEach(plugin => {
        const card = createOnlinePluginCard(plugin);
        poolBody.appendChild(card);
    });
    
    // Stars数据由后端管理，无需前端处理
}


/**
 * 创建在线插件卡片
 */
function createOnlinePluginCard(plugin) {
    const card = document.createElement('div');
    card.className = 'nm-online-plugin-card';
    
    const isInstalled = plugin.is_installed;
    const githubUrl = plugin.reference || '';
    const title = plugin.title || '未知插件';
    const description = plugin.description || '暂无描述';
    const author = plugin.author || '未知作者';
    
    // 直接使用后端返回的stars数据
    const stars = plugin.stars || 0;
    
    card.innerHTML = `
        <div class="nm-plugin-card-header">
            <div class="nm-plugin-card-title">
                <span class="nm-plugin-icon">📦</span>
                <span class="nm-plugin-name">${escapeHtml(title)}</span>
                ${isInstalled ? '<span class="nm-plugin-installed-badge">✓ 已安装</span>' : ''}
            </div>
            <div class="nm-plugin-card-actions">
                ${isInstalled ? 
                    `<button class="nm-plugin-btn nm-plugin-btn-installed" disabled>已安装</button>` :
                    `<button class="nm-plugin-btn nm-plugin-btn-install" data-url="${escapeHtml(githubUrl)}" data-name="${escapeHtml(plugin.plugin_name || title)}">📥 安装</button>`
                }
            </div>
        </div>
        <div class="nm-plugin-card-description">${escapeHtml(description)}</div>
        <div class="nm-plugin-card-footer">
            <span class="nm-plugin-meta">👤 ${escapeHtml(author)}</span>
            <span class="nm-plugin-meta nm-plugin-stars">⭐ ${stars}</span>
            ${githubUrl ? `<a href="${escapeHtml(githubUrl)}" target="_blank" class="nm-plugin-link">🔗 GitHub</a>` : ''}
        </div>
    `;
    
    // 绑定安装按钮事件
    if (!isInstalled) {
        const installBtn = card.querySelector('.nm-plugin-btn-install');
        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                await installOnlinePlugin(installBtn, plugin);
            });
        }
    }
    
    return card;
}

/**
 * 安装在线插件
 */
async function installOnlinePlugin(button, plugin) {
    const url = plugin.reference;
    const name = plugin.plugin_name || plugin.title;
    
    if (!url) {
        showToast('❌ 插件URL无效', 'error');
        return;
    }
    
    const confirmed = confirm(`确定要安装插件 "${name}" 吗？\n\n安装完成后需要重启ComfyUI。`);
    if (!confirmed) return;
    
    const originalText = button.textContent;
    button.textContent = '⏳ 安装中...';
    button.disabled = true;
    
    try {
        const response = await fetch('/node-manager/store/install-plugin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, name })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || '安装失败');
        }
        
        button.textContent = '✓ 已安装';
        button.classList.remove('nm-plugin-btn-install');
        button.classList.add('nm-plugin-btn-installed');
        
        showToast(`✅ ${name} 安装成功！\n请重启ComfyUI以加载插件。`, 'success', 5000);
        
        plugin.is_installed = true;
        
    } catch (error) {
        console.error('[互联网] 安装失败:', error);
        button.textContent = originalText;
        button.disabled = false;
        showToast(`❌ 安装失败：${error.message}`, 'error', 5000);
    }
}

// 导出给全局使用
window.nodePoolState = nodePoolState;
window.nodePoolState.reloadOnlinePlugins = loadAvailablePlugins;

/**
 * 随机打乱数组（Fisher-Yates 洗牌算法）
 * 让每次打开插件商店都有不同的顺序，所有插件都有机会被优先刷新
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * ===============================
 * 懒加载Stars刷新系统
 * ===============================
 * 策略：
 * 1. 首屏优先：立即刷新当前可见的插件
 * 2. 后台排队：静默刷新其他插件（按顺序）
 * 3. 搜索触发：搜索/筛选时立即刷新新显示的插件
 * 4. 滚动加载：滚动时刷新进入视口的插件
 * 5. 全程静默：无提示、无等待
 * 6. 随机显示：每次打开顺序不同，让所有插件都有机会被优先刷新
 */

// 懒加载状态
const lazyLoadState = {
    isUpdating: false,          // 是否正在更新
    updateQueue: [],            // 待更新的插件队列
    updatedRepos: new Set(),    // 已更新的repo
    currentBatchSize: 30,       // 每批更新数量
    isBackgroundRunning: false, // 后台更新是否运行中
    isPaused: false,            // 是否暂停（用户操作时暂停）
    debounceTimer: null,        // 防抖计时器
    lastUpdateTime: 0           // 上次更新时间
};

/**
 * 提取插件的repo_key
 */
function extractRepoKey(plugin) {
    const githubUrl = plugin.reference || '';
    if (!githubUrl.startsWith('https://github.com/')) {
        return null;
    }
    const repoPath = githubUrl.replace('https://github.com/', '').replace('.git', '').replace(/\/$/, '');
    const parts = repoPath.split('/');
    if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
    }
    return null;
}

/**
 * 获取当前可见的插件
 */
function getVisiblePlugins() {
    const poolBody = document.getElementById('nm-node-pool-body');
    if (!poolBody) return [];
    
    const cards = poolBody.querySelectorAll('.nm-online-plugin-card');
    const visiblePlugins = [];
    
    cards.forEach((card, index) => {
        // 简单判断：取前30个作为"可见"
        if (index < 30) {
            visiblePlugins.push(index);
        }
    });
    
    return visiblePlugins;
}

/**
 * 批量更新指定插件的stars
 */
async function updateStarsBatch(plugins) {
    if (!plugins || plugins.length === 0) {
        return;
    }
    
    // 提取需要更新的repo_keys（排除已更新的）
    const repoKeys = [];
    const pluginMap = new Map();
    
    for (const plugin of plugins) {
        const repoKey = extractRepoKey(plugin);
        if (repoKey && !lazyLoadState.updatedRepos.has(repoKey)) {
            // 只更新stars为0或来自Manager的插件
            if (!plugin.stars || plugin.stars === 0 || plugin.stars_source === 'manager' || plugin.stars_source === 'none') {
                repoKeys.push(repoKey);
                pluginMap.set(repoKey, plugin);
            }
        }
    }
    
    if (repoKeys.length === 0) {
        return;
    }
    
    // 批量更新stars（静默）
    
    try {
        const response = await fetch('/node-manager/store/update-stars-batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                repo_keys: repoKeys
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.results) {
            // 更新DOM
            for (const [repoKey, stars] of Object.entries(data.results)) {
                const plugin = pluginMap.get(repoKey);
                if (plugin) {
                    plugin.stars = stars;
                    plugin.stars_source = 'local';  // 标记为本地更新
                    lazyLoadState.updatedRepos.add(repoKey);
                    
                    // 更新DOM中的显示
                    updatePluginStarsInDOM(plugin, stars);
                }
            }
            
            // 更新完成（静默）
        }
    } catch (error) {
        console.error('[懒加载] 批量更新失败:', error);
    }
}

/**
 * 更新DOM中插件的stars显示
 */
function updatePluginStarsInDOM(plugin, stars) {
    const poolBody = document.getElementById('nm-node-pool-body');
    if (!poolBody) return;
    
    const cards = poolBody.querySelectorAll('.nm-online-plugin-card');
    cards.forEach(card => {
        const titleElement = card.querySelector('.nm-plugin-name');
        if (titleElement && titleElement.textContent.trim() === plugin.title) {
            const starsElement = card.querySelector('.nm-plugin-stars');
            if (starsElement) {
                starsElement.textContent = `⭐ ${stars}`;
            }
        }
    });
}

/**
 * 启动懒加载：优先更新可见插件
 */
async function startLazyLoading() {
    if (!nodePoolState.internetMode || nodePoolState.availablePlugins.length === 0) {
        return;
    }
    
    // 开始智能加载stars（静默）
    
    // 1. 立即更新首屏可见的插件（前30个）
    const visiblePlugins = nodePoolState.availablePlugins.slice(0, 30);
    await updateStarsBatch(visiblePlugins);
    
    // 2. 后台静默更新其他插件
    startBackgroundUpdate();
}

/**
 * 后台静默更新其他插件（优化版：使用requestIdleCallback）
 */
async function startBackgroundUpdate() {
    if (lazyLoadState.isBackgroundRunning) {
        return;
    }
    
    lazyLoadState.isBackgroundRunning = true;
    // 后台更新已启动（静默）
    
    // 获取所有未更新的插件
    const remainingPlugins = nodePoolState.availablePlugins.filter(plugin => {
        const repoKey = extractRepoKey(plugin);
        return repoKey && !lazyLoadState.updatedRepos.has(repoKey);
    });
    
    // 分批处理（每批20个，间隔5秒，使用requestIdleCallback）
    const batchSize = 20;
    for (let i = 0; i < remainingPlugins.length; i += batchSize) {
        // 如果用户正在操作，暂停更新
        if (lazyLoadState.isPaused) {
            // 用户操作中，暂停后台更新（静默）
            await new Promise(resolve => {
                const checkPause = setInterval(() => {
                    if (!lazyLoadState.isPaused) {
                        clearInterval(checkPause);
                        resolve();
                    }
                }, 1000);
            });
        }
        
        const batch = remainingPlugins.slice(i, i + batchSize);
        
        // 使用requestIdleCallback在浏览器空闲时执行
        await new Promise(resolve => {
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(async () => {
                    await updateStarsBatch(batch);
                    resolve();
                }, { timeout: 10000 });
            } else {
                // 降级方案：使用setTimeout
                setTimeout(async () => {
                    await updateStarsBatch(batch);
                    resolve();
                }, 0);
            }
        });
        
        // 延迟5秒，避免API限流和性能影响
        if (i + batchSize < remainingPlugins.length) {
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    lazyLoadState.isBackgroundRunning = false;
    // 后台更新完成（静默）
}

/**
 * 搜索/筛选时触发：立即更新新显示的插件（带防抖）
 */
async function onPluginListChanged(displayedPlugins) {
    if (!nodePoolState.internetMode) {
        return;
    }
    
    // 防抖：清除之前的计时器
    if (lazyLoadState.debounceTimer) {
        clearTimeout(lazyLoadState.debounceTimer);
    }
    
    // 节流：如果距离上次更新不到3秒，延迟执行
    const now = Date.now();
    const timeSinceLastUpdate = now - lazyLoadState.lastUpdateTime;
    const minInterval = 3000; // 最小间隔3秒
    
    lazyLoadState.debounceTimer = setTimeout(async () => {
        if (timeSinceLastUpdate < minInterval) {
            // 节流中，跳过更新（静默）
            return;
        }
        
        // 取前30个可见插件
        const visiblePlugins = displayedPlugins.slice(0, 30);
        
        // 找出还没更新的插件
        const needUpdate = visiblePlugins.filter(plugin => {
            const repoKey = extractRepoKey(plugin);
            return repoKey && !lazyLoadState.updatedRepos.has(repoKey);
        });
        
        if (needUpdate.length > 0) {
            // 检测到新显示的插件，延迟更新（静默）
            lazyLoadState.lastUpdateTime = Date.now();
            await updateStarsBatch(needUpdate);
        }
    }, 1000); // 防抖延迟1秒
}

export {
    nodePoolState,
    initNodePool,
    loadUserData,
    saveUserData,
    renderNodePool,
    updateNodePoolHeader,
    showNodesByPlugin,
    showNodesByFolder,
    showFavoriteNodes,
    showNodesByCategory,
    showUncategorizedNodes,
    showHiddenPlugins,
    restoreSelectedPlugins,
    getUncategorizedCount,
    updateSpecialFoldersCount,
    forceCleanupPreview,
    loadAvailablePlugins,
    showOnlinePlugins,
    escapeHtml
};

