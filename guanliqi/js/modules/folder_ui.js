// js/folder_ui.js
// UI渲染和基础交互

import { 
    folderState, 
    buildFolderTree, 
    hasChildren,
    handleFolderSelection,
    clearSelection,
    clearPluginSelection,
    addPluginSelection,
    handlePluginSelection
} from './folder_state.js';
import { addFolderStyles } from './folder_styles.js';

// 节点池相关函数和状态 - 通过全局变量注入（避免循环依赖）
let nodePoolState, getUncategorizedCount, renderNodePool, updateNodePoolHeader, escapeHtml;

// 注入节点池依赖
function injectNodePoolDeps(deps) {
    nodePoolState = deps.nodePoolState;
    getUncategorizedCount = deps.getUncategorizedCount;
    renderNodePool = deps.renderNodePool;
    updateNodePoolHeader = deps.updateNodePoolHeader;
    escapeHtml = deps.escapeHtml;
}

// 创建管理器界面
function createManagerInterface(container) {
    addFolderStyles();
    
    container.innerHTML = `
        <div class="nm-container">
            <!-- 头部 -->
            <div class="nm-header">
                <div class="nm-header-left">
                    <div class="nm-header-title">
                        🌊 小海节点管理器
                    </div>
                    <div class="nm-header-subtitle">
                        管理和组织你的节点分类
                    </div>
                </div>
                <div class="nm-header-right">
                    <!-- 按钮已移至Modal窗口 -->
                </div>
            </div>
            
            <!-- 内容区域：左右分栏 -->
            <div class="nm-content">
                <!-- 左侧：文件夹树 -->
                <div class="nm-left-panel">
                    <div class="nm-loading" style="display: none;">
                        <div class="nm-loading-spinner"></div>
                        <span>加载中...</span>
                    </div>
                    <div class="nm-folder-list" id="nm-folder-list"></div>
                </div>
                
                <!-- 右侧：节点池 -->
                <div class="nm-right-panel">
                    <div class="nm-node-pool-header">
                        <button class="nm-back-btn" id="nm-back-btn" style="display: none;" title="返回">
                                <span class="nm-btn-icon">⬅️</span>
                                <span class="nm-btn-text">返回</span>
                            </button>
                        <div class="nm-search-box" id="nm-search-box">
                            <!-- 搜索模式切换 -->
                            <div class="nm-search-mode-toggle">
                                <button class="nm-search-mode-btn active" id="nm-search-mode-all" data-mode="all" title="综合搜索（节点+文件夹）">
                                    🔄 综合
                                </button>
                                <button class="nm-search-mode-btn" id="nm-search-mode-node" data-mode="node" title="只搜索节点名称">
                                    🔍 节点
                                </button>
                                <button class="nm-search-mode-btn" id="nm-search-mode-folder" data-mode="folder" title="只搜索文件夹名称">
                                    📁 文件夹
                                </button>
                                <button class="nm-search-mode-btn" id="nm-search-mode-internet" data-mode="internet" title="搜索在线插件">
                                    🌐 互联网
                                </button>
                            </div>
                            
                            <!-- 互联网模式筛选器 -->
                            <div class="nm-internet-filter" id="nm-internet-filter" style="display: none;">
                                <button class="nm-filter-toggle-btn" id="nm-filter-toggle-btn" title="筛选条件">
                                    <span>🎚️</span>
                                    <span>筛选</span>
                                    <span class="nm-filter-indicator" id="nm-filter-indicator" style="display: none;">●</span>
                                </button>
                            </div>
                            
                            <div class="nm-search-tags-wrapper" id="nm-search-tags-wrapper">
                                <!-- 标签会动态插入这里 -->
                                <input type="text" 
                                       class="nm-search-input" 
                                       id="nm-search-input" 
                                       placeholder="🔍 搜索节点、文件夹... (多个空格分隔关键词)"
                                       autocomplete="off" />
                        </div>
                            <button class="nm-search-clear-btn" id="nm-search-clear-btn" style="display: none;" title="清空全部">
                                ✕
                            </button>
                        </div>
                            <button class="nm-restore-selected-btn" id="nm-restore-selected-btn" style="display: none;" title="还原选中的插件">
                                <span class="nm-btn-icon">🔄</span>
                                <span class="nm-btn-text">还原选中</span>
                            </button>
                    </div>
                    <!-- 前缀管理工具栏 -->
                    <div class="nm-prefix-toolbar" id="nm-prefix-toolbar" style="display: none;">
                        <div class="nm-prefix-toolbar-info">
                            <span id="nm-prefix-toolbar-text">已选中 0 个插件</span>
                        </div>
                        <div class="nm-prefix-toolbar-actions">
                            <button class="nm-prefix-btn" id="nm-add-prefix-btn" title="为选中插件的节点添加前缀">
                                <span class="nm-btn-icon">➕</span>
                                <span class="nm-btn-text">加前缀</span>
                            </button>
                            <button class="nm-prefix-btn" id="nm-remove-prefix-btn" title="移除选中插件节点的前缀">
                                <span class="nm-btn-icon">➖</span>
                                <span class="nm-btn-text">删除前缀</span>
                            </button>
                        </div>
                    </div>
                    <div class="nm-node-pool-body" id="nm-node-pool-body">
                        <div class="nm-empty-state">
                            <div class="nm-empty-state-icon">📦</div>
                            <div class="nm-empty-state-text">请选择左侧文件夹</div>
                            <div class="nm-empty-state-hint">或点击"插件来源"查看节点</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 绑定事件
function bindEvents(container) {
    // 键盘事件
    container.addEventListener('keydown', handleKeydown);
    
    // 确保容器可以获得焦点
    container.tabIndex = -1;
    container.style.outline = 'none';
    
    // 点击获得焦点（但不要抢走输入框焦点）
    container.addEventListener('click', (e) => {
        // 如果点击的是输入框或其子元素，不夺走焦点
        const isInputRelated = e.target.tagName === 'INPUT' || 
                               e.target.tagName === 'TEXTAREA' ||
                               e.target.closest('.nm-search-box') ||
                               e.target.closest('input') ||
                               e.target.closest('textarea');
        
        if (!isInputRelated) {
        container.focus();
        }
    });
    
    // 自动获得焦点（延迟确保不干扰搜索框）
    setTimeout(() => {
        // 只有当没有其他元素获得焦点时，才让容器获得焦点
        if (document.activeElement === document.body) {
        container.focus();
        }
    }, 100);
    
    // 绑定前缀管理按钮
    const addPrefixBtn = document.getElementById('nm-add-prefix-btn');
    const removePrefixBtn = document.getElementById('nm-remove-prefix-btn');
    
    if (addPrefixBtn) {
        addPrefixBtn.addEventListener('click', showAddPrefixDialog);
    }
    
    if (removePrefixBtn) {
        removePrefixBtn.addEventListener('click', removePrefix);
    }
    
    // 监听插件选择变化
    window.addEventListener('nm:pluginSelectionChanged', updatePrefixToolbar);
    
    // 监听刷新插件列表
    window.addEventListener('nm:refreshPluginsList', async () => {
        console.log('[UI] 刷新插件列表');
        await loadPluginsList();
    });
    
    // 工具栏按钮已移至Modal窗口
    
    // 绑定返回按钮（延迟绑定确保DOM已渲染）
    setTimeout(() => {
        const backBtn = document.getElementById('nm-back-btn');
        if (backBtn) {
            console.log('[UI] 返回按钮找到，绑定事件');
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[UI] 返回按钮被点击');
                // 触发返回到已隐藏列表
                window.dispatchEvent(new CustomEvent('nm:showSpecialNodes', {
                    detail: { type: 'hidden' }
                }));
            });
        } else {
            console.warn('[UI] 未找到返回按钮');
        }
    }, 100);
    
    // 绑定"还原选中"按钮
    setTimeout(() => {
        const restoreBtn = document.getElementById('nm-restore-selected-btn');
        if (restoreBtn) {
            console.log('[UI] 还原选中按钮找到，绑定事件');
            restoreBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[UI] 还原选中按钮被点击');
                // 触发批量还原
                window.dispatchEvent(new CustomEvent('nm:restoreSelectedPlugins'));
            });
        }
    }, 100);
    
    // 绑定内容区域的拖拽事件
    bindContentAreaDragEvents();
    
    // 绑定搜索框事件（延迟确保DOM已渲染）
    setTimeout(() => {
        console.log('[UI] 开始绑定搜索框事件...');
        bindSearchBoxEvents();
    }, 100);
}

// 搜索建议状态
let searchSuggestions = {
    visible: false,
    selectedIndex: -1,
    items: [],
    container: null
};

// 搜索模式状态
let searchMode = 'all';  // 'all'（综合）、'node'（节点）或 'folder'（文件夹）

// 绑定搜索框事件
function bindSearchBoxEvents() {
    const searchInput = document.getElementById('nm-search-input');
    const searchClearBtn = document.getElementById('nm-search-clear-btn');
    const tagsWrapper = document.getElementById('nm-search-tags-wrapper');
    const searchModeAllBtn = document.getElementById('nm-search-mode-all');
    const searchModeNodeBtn = document.getElementById('nm-search-mode-node');
    const searchModeFolderBtn = document.getElementById('nm-search-mode-folder');
    const searchModeInternetBtn = document.getElementById('nm-search-mode-internet');
    const internetFilter = document.getElementById('nm-internet-filter');
    const filterToggleBtn = document.getElementById('nm-filter-toggle-btn');
    
    if (!searchInput || !tagsWrapper) {
        console.error('[UI] 未找到搜索框元素');
        return;
    }
    
    let searchDebounceTimer = null;
    let suggestionDebounceTimer = null;
    
    // 标签管理状态
    let searchTags = [];
    let tagIdCounter = 0;
    
    // ==================== 搜索模式切换 ====================
    
    function switchSearchMode(mode) {
        searchMode = mode;
        const modeTexts = {
            all: '综合',
            node: '节点',
            folder: '文件夹',
            internet: '互联网'
        };
        console.log('[搜索模式] 切换为:', modeTexts[mode]);
        
        // 更新按钮状态
        if (searchModeAllBtn) searchModeAllBtn.classList.toggle('active', mode === 'all');
        if (searchModeNodeBtn) searchModeNodeBtn.classList.toggle('active', mode === 'node');
        if (searchModeFolderBtn) searchModeFolderBtn.classList.toggle('active', mode === 'folder');
        if (searchModeInternetBtn) searchModeInternetBtn.classList.toggle('active', mode === 'internet');
        
        // 显示/隐藏筛选器
        if (internetFilter) {
            internetFilter.style.display = mode === 'internet' ? 'flex' : 'none';
        }
        
        // 更新占位符
        if (searchInput) {
            const placeholders = {
                all: '🔄 综合搜索（节点+文件夹）... (多个空格分隔关键词)',
                node: '🔍 只搜索节点名称... (多个空格分隔关键词)',
                folder: '📁 只搜索文件夹名称... (多个空格分隔关键词)',
                internet: '🌐 搜索在线插件... (名称、描述、作者)'
            };
            searchInput.placeholder = placeholders[mode];
        }
        
        // 如果切换到互联网模式（或在互联网模式下再次点击）
        if (mode === 'internet') {
            // 动态导入node_pool模块并加载在线插件（每次都强制刷新，实现随机排序效果）
            import('./node_pool.js').then(module => {
                console.log('[互联网] 🎲 重新随机刷新插件列表...');
                module.loadAvailablePlugins(true);  // 明确传递true强制刷新（含随机排序）
            }).catch(error => {
                console.error('[互联网] 加载失败:', error);
            });
        } else {
            // 其他模式：如果有搜索内容，重新搜索
            if (searchTags.length > 0) {
                triggerTagsSearch();
            } else if (searchInput.value.trim()) {
                const keyword = searchInput.value.trim();
                window.dispatchEvent(new CustomEvent('nm:searchInSidebar', {
                    detail: { keyword, mode: searchMode }
                }));
            }
        }
    }
    
    // 绑定模式切换按钮
    if (searchModeAllBtn) {
        searchModeAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            switchSearchMode('all');
        });
    }
    
    if (searchModeNodeBtn) {
        searchModeNodeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            switchSearchMode('node');
        });
    }
    
    if (searchModeFolderBtn) {
        searchModeFolderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            switchSearchMode('folder');
        });
    }
    
    if (searchModeInternetBtn) {
        searchModeInternetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            switchSearchMode('internet');
        });
    }
    
    // ==================== 互联网模式筛选器 ====================
    
    let filterMenuOpen = false;
    let filterMenu = null;
    
    // 创建筛选器菜单
    function createFilterMenu() {
        if (filterMenu) return filterMenu;
        
        filterMenu = document.createElement('div');
        filterMenu.className = 'nm-filter-menu';
        filterMenu.innerHTML = `
            <div class="nm-filter-section">
                <div class="nm-filter-label">📦 安装状态</div>
                <label class="nm-filter-option">
                    <input type="radio" name="filter-status" value="all" checked>
                    <span>全部插件</span>
                </label>
                <label class="nm-filter-option">
                    <input type="radio" name="filter-status" value="uninstalled">
                    <span>未安装</span>
                </label>
                <label class="nm-filter-option">
                    <input type="radio" name="filter-status" value="installed">
                    <span>已安装</span>
                </label>
            </div>
            <div class="nm-filter-divider"></div>
            <div class="nm-filter-section">
                <div class="nm-filter-label">📊 排序方式</div>
                <label class="nm-filter-option">
                    <input type="radio" name="filter-sort" value="random" checked>
                    <span>🎲 随机排序</span>
                </label>
                <label class="nm-filter-option">
                    <input type="radio" name="filter-sort" value="name">
                    <span>名称 A-Z</span>
                </label>
                <label class="nm-filter-option">
                    <input type="radio" name="filter-sort" value="stars">
                    <span>⭐ 星标数</span>
                </label>
                <label class="nm-filter-option">
                    <input type="radio" name="filter-sort" value="updated">
                    <span>🕒 最近更新</span>
                </label>
            </div>
        `;
        
        document.body.appendChild(filterMenu);
        
        // 点击选项时实时应用筛选
        filterMenu.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                applyFilter();
            });
        });
        
        return filterMenu;
    }
    
    // 应用筛选器
    function applyFilter() {
        const menu = filterMenu || createFilterMenu();
        const statusValue = menu.querySelector('input[name="filter-status"]:checked').value;
        const sortValue = menu.querySelector('input[name="filter-sort"]:checked').value;
        
        console.log('[筛选器] 应用筛选:', { status: statusValue, sort: sortValue });
        
        // 更新筛选器指示器
        const indicator = document.getElementById('nm-filter-indicator');
        const isFiltered = statusValue !== 'all' || sortValue !== 'name';
        if (indicator) {
            indicator.style.display = isFiltered ? 'inline' : 'none';
        }
        
        // 应用到node_pool
        import('./node_pool.js').then(module => {
            module.nodePoolState.internetFilter = statusValue;
            module.nodePoolState.internetSort = sortValue;
            
            // 重新显示插件列表
            const searchInput = document.getElementById('nm-search-input');
            const keyword = searchInput ? searchInput.value.trim() : '';
            module.showOnlinePlugins(keyword);
        });
    }
    
    // 打开/关闭筛选器菜单
    function toggleFilterMenu() {
        if (filterMenuOpen) {
            closeFilterMenu();
        } else {
            openFilterMenu();
        }
    }
    
    function openFilterMenu() {
        const menu = createFilterMenu();
        const btn = filterToggleBtn;
        
        if (!btn) return;
        
        const rect = btn.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.left = `${rect.left}px`;
        menu.style.display = 'block';
        
        filterMenuOpen = true;
        btn.classList.add('active');
        
        // 点击外部关闭
        setTimeout(() => {
            document.addEventListener('mousedown', handleFilterMenuOutsideClick, true);
        }, 0);
    }
    
    function closeFilterMenu() {
        if (filterMenu) {
            filterMenu.style.display = 'none';
        }
        filterMenuOpen = false;
        if (filterToggleBtn) {
            filterToggleBtn.classList.remove('active');
        }
        document.removeEventListener('mousedown', handleFilterMenuOutsideClick, true);
    }
    
    function handleFilterMenuOutsideClick(e) {
        if (filterMenu && !filterMenu.contains(e.target) && e.target !== filterToggleBtn && !filterToggleBtn.contains(e.target)) {
            closeFilterMenu();
        }
    }
    
    // 绑定筛选器按钮
    if (filterToggleBtn) {
        filterToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFilterMenu();
        });
    }
    
    // 刷新Stars按钮已移除
    
    let draggedTag = null;
    let draggedIndex = -1;
    
    // 创建搜索建议容器
    createSearchSuggestionsContainer();
    
    // ==================== 标签管理函数 ====================
    
    // 创建标签元素
    function createTagElement(tag, index) {
        const div = document.createElement('div');
        div.className = `nm-search-tag color-${tag.colorIndex}`;  // 使用固定的颜色索引
        div.draggable = true;
        div.dataset.tagId = tag.id;
        div.dataset.tagIndex = index;
        
        div.innerHTML = `
            <span class="nm-search-tag-text">${escapeHtml(tag.text)}</span>
            <span class="nm-search-tag-remove">×</span>
        `;
        
        // 点击文字编辑
        const textSpan = div.querySelector('.nm-search-tag-text');
        textSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            startEditTag(div, tag);
        });
        
        // 点击 × 删除
        const removeBtn = div.querySelector('.nm-search-tag-remove');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeTag(tag.id);
        });
        
        // 拖拽事件
        setupTagDrag(div, tag, index);
        
        return div;
    }
    
    // 渲染所有标签
    function renderTags() {
        // 移除现有标签
        tagsWrapper.querySelectorAll('.nm-search-tag').forEach(el => el.remove());
        
        // 渲染新标签（插入到输入框前面）
        searchTags.forEach((tag, index) => {
            const tagEl = createTagElement(tag, index);
            tagsWrapper.insertBefore(tagEl, searchInput);
        });
        
        // 更新清空按钮显示
        if (searchClearBtn) {
            searchClearBtn.style.display = searchTags.length > 0 || searchInput.value ? 'flex' : 'none';
        }
        
        // 触发搜索
        triggerTagsSearch();
    }
    
    // 添加标签
    function addTag(text) {
        text = text.trim();
        if (!text) return;
        
        // 检查是否已存在
        if (searchTags.some(t => t.text === text)) {
            console.log('[标签] 标签已存在:', text);
            return;
        }
        
        const tag = {
            id: ++tagIdCounter,
            text: text,
            colorIndex: searchTags.length % 5  // 固定颜色索引，拖拽后不变
        };
        
        searchTags.push(tag);
        renderTags();
    }
    
    // 删除标签
    function removeTag(tagId) {
        searchTags = searchTags.filter(t => t.id !== tagId);
        renderTags();
    }
    
    // 编辑标签
    function startEditTag(tagElement, tag) {
        const originalText = tag.text;
        const textSpan = tagElement.querySelector('.nm-search-tag-text');
        
        // 创建编辑输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.value = tag.text;
        input.className = 'nm-search-tag-edit-input';
        
        // 替换文字为输入框
        textSpan.style.display = 'none';
        tagElement.insertBefore(input, textSpan);
        
        // 聚焦并选中
        input.focus();
        input.select();
        
        // 保存编辑
        const saveEdit = () => {
            const newText = input.value.trim();
            if (newText && newText !== originalText) {
                // 检查是否与其他标签重复
                if (!searchTags.some(t => t.id !== tag.id && t.text === newText)) {
                    tag.text = newText;
                    renderTags();
                } else {
                    showToast('⚠️ 标签已存在', 'warning');
                    input.remove();
                    textSpan.style.display = '';
                }
            } else {
                input.remove();
                textSpan.style.display = '';
            }
        };
        
        // Enter 保存，Esc 取消
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                input.remove();
                textSpan.style.display = '';
            }
        });
        
        // 失焦保存
        input.addEventListener('blur', saveEdit);
    }
    
    // 设置标签拖拽
    function setupTagDrag(tagElement, tag, index) {
        // 拖拽开始
        tagElement.addEventListener('dragstart', (e) => {
            draggedTag = tag;
            draggedIndex = index;
            tagElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        
        // 拖拽结束
        tagElement.addEventListener('dragend', (e) => {
            tagElement.classList.remove('dragging');
            // 移除所有 drag-over 类
            tagsWrapper.querySelectorAll('.nm-search-tag').forEach(el => {
                el.classList.remove('drag-over');
            });
            draggedTag = null;
            draggedIndex = -1;
        });
        
        // 拖拽经过
        tagElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (draggedTag && draggedTag.id !== tag.id) {
                tagElement.classList.add('drag-over');
            }
        });
        
        tagElement.addEventListener('dragleave', (e) => {
            tagElement.classList.remove('drag-over');
        });
        
        // 放置
        tagElement.addEventListener('drop', (e) => {
            e.preventDefault();
            tagElement.classList.remove('drag-over');
            
            if (draggedTag && draggedIndex !== index) {
                // 调整数组顺序
                const [movedTag] = searchTags.splice(draggedIndex, 1);
                searchTags.splice(index, 0, movedTag);
                
                renderTags();
            }
        });
    }
    
    // 触发多关键词搜索
    function triggerTagsSearch() {
        if (searchTags.length > 0) {
            // 传递完整的标签数组（包含颜色索引）和搜索模式
            console.log('[标签搜索] 搜索标签:', searchTags, '模式:', searchMode);
            window.dispatchEvent(new CustomEvent('nm:searchMultipleKeywords', {
                detail: { tags: searchTags, mode: searchMode }  // 传递完整的tag对象和模式
            }));
        } else if (searchInput.value.trim()) {
            // 没有标签，使用普通搜索
            window.dispatchEvent(new CustomEvent('nm:searchInSidebar', {
                detail: { keyword: searchInput.value.trim(), mode: searchMode }
            }));
        } else {
            // 清空搜索
            window.dispatchEvent(new CustomEvent('nm:clearSidebarSearch'));
        }
    }
    
    // ==================== 事件监听 ====================
    
    // 防止搜索框被自动失焦
    searchInput.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
    searchInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // 输入事件（检测多空格 + 实时搜索）
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        
        // 检测多个空格（2个或以上）
        if (/\s{2,}/.test(value)) {
            // 分割关键词
            const keywords = value
                .split(/\s{2,}/)  // 多空格分割
                .map(k => k.trim())
                .filter(k => k);
            
            console.log('[标签] 检测到多空格，创建标签:', keywords);
            
            // 创建标签
            keywords.forEach(keyword => {
                addTag(keyword);
            });
            
            // 清空输入框
            e.target.value = '';
            
            // 隐藏建议
            hideSearchSuggestions();
            
            return;
        }
        
        const keyword = value.trim();
        
        // 更新清空按钮显示
        if (searchClearBtn) {
            searchClearBtn.style.display = searchTags.length > 0 || keyword ? 'flex' : 'none';
        }
        
        // 清除之前的定时器
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }
        if (suggestionDebounceTimer) {
            clearTimeout(suggestionDebounceTimer);
        }
        
        if (keyword && searchTags.length === 0) {
            // 没有标签时，显示搜索建议
            if (searchMode !== 'internet') {
            suggestionDebounceTimer = setTimeout(() => {
                showSearchSuggestions(keyword);
            }, 100);
            }
            
            // 300ms触发实际搜索
            searchDebounceTimer = setTimeout(() => {
                if (searchMode === 'internet') {
                    // 互联网模式：搜索在线插件
                    import('./node_pool.js').then(module => {
                        module.showOnlinePlugins(keyword);
                    });
                } else {
                    // 其他模式：正常搜索
                window.dispatchEvent(new CustomEvent('nm:searchInSidebar', {
                        detail: { keyword, mode: searchMode }
                }));
                }
            }, 300);
        } else if (!keyword && searchTags.length === 0) {
            // 清空搜索
            hideSearchSuggestions();
            if (searchMode === 'internet') {
                // 互联网模式：显示所有插件
                import('./node_pool.js').then(module => {
                    module.showOnlinePlugins('');
                });
            } else {
            window.dispatchEvent(new CustomEvent('nm:clearSidebarSearch'));
            }
        }
    });
    
    // 清空按钮点击事件
    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            searchInput.value = '';
            searchTags = [];  // 清空所有标签
            renderTags();
            searchClearBtn.style.display = 'none';
            window.dispatchEvent(new CustomEvent('nm:clearSidebarSearch'));
            searchInput.focus();
        });
    }
    
    // 点击容器聚焦输入框
    tagsWrapper.addEventListener('click', (e) => {
        // 如果点击的不是标签或输入框，聚焦输入框
        if (!e.target.closest('.nm-search-tag') && e.target !== searchInput) {
            searchInput.focus();
        }
    });
    
    // 鼠标中键双击聚焦搜索框
    let middleClickCount = 0;
    let middleClickTimer = null;
    
    document.addEventListener('mousedown', (e) => {
        // button === 1 表示鼠标中键
        if (e.button === 1) {
            e.preventDefault();
            
            middleClickCount++;
            
            // 清除之前的计时器
            if (middleClickTimer) {
                clearTimeout(middleClickTimer);
            }
            
            // 检查是否双击（300ms内）
            if (middleClickCount === 2) {
                console.log('[搜索] 鼠标中键双击，聚焦搜索框');
                middleClickCount = 0;
                
                // 打开侧边栏（如果关闭）
                const sidebar = document.getElementById('nm-sidebar-container');
                if (sidebar && !sidebar.classList.contains('show')) {
                    window.dispatchEvent(new CustomEvent('nm:toggleSidebar'));
                }
                
                // 聚焦搜索框
                setTimeout(() => {
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.select();
                    }
                }, 100);
            } else {
                // 300ms后重置计数
                middleClickTimer = setTimeout(() => {
                    middleClickCount = 0;
                }, 300);
            }
        }
    });
    
    // 搜索框键盘事件
    searchInput.addEventListener('keydown', (e) => {
        // Ctrl+A 全选文本
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            // 允许默认的全选行为
            return;
        }
        
        // ESC - 优先关闭建议，其次清空搜索
        if (e.key === 'Escape') {
            if (searchSuggestions.visible) {
                e.preventDefault();
                hideSearchSuggestions();
            } else if (searchInput.value) {
                e.preventDefault();
                searchInput.value = '';
                if (searchClearBtn) {
                    searchClearBtn.style.display = 'none';
                }
                hideSearchSuggestions();
                window.dispatchEvent(new CustomEvent('nm:clearSidebarSearch'));
            }
            return;
        }
        
        // 如果建议可见，处理上下箭头和回车
        if (searchSuggestions.visible && searchSuggestions.items.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectNextSuggestion();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectPreviousSuggestion();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                confirmSuggestion();
            }
        }
    });
    
    // 失焦时隐藏建议（延迟以允许点击建议项）
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            hideSearchSuggestions();
        }, 200);
    });
    
    // 聚焦时如果有值，显示建议
    searchInput.addEventListener('focus', () => {
        const keyword = searchInput.value.trim();
        if (keyword) {
            showSearchSuggestions(keyword);
        }
    });
}

// ==================== 搜索建议功能 ====================

/**
 * 创建搜索建议容器
 */
function createSearchSuggestionsContainer() {
    const searchBox = document.getElementById('nm-search-box');
    if (!searchBox) return;
    
    // 创建建议容器
    const container = document.createElement('div');
    container.className = 'nm-search-suggestions';
    container.id = 'nm-search-suggestions';
    container.style.display = 'none';
    
    // 插入到搜索框后面
    searchBox.parentElement.insertBefore(container, searchBox.nextSibling);
    
    searchSuggestions.container = container;
}

/**
 * 显示搜索建议
 */
async function showSearchSuggestions(keyword) {
    if (!searchSuggestions.container) return;
    
    // 触发搜索建议请求
    window.dispatchEvent(new CustomEvent('nm:getSearchSuggestions', {
        detail: { keyword, callback: renderSearchSuggestions }
    }));
}

/**
 * 渲染搜索建议列表
 */
function renderSearchSuggestions(keyword, suggestions) {
    const container = searchSuggestions.container;
    if (!container || suggestions.length === 0) {
        hideSearchSuggestions();
        return;
    }
    
    // 只显示前10个
    searchSuggestions.items = suggestions.slice(0, 10);
    searchSuggestions.selectedIndex = -1;
    
    let html = '<div class="nm-search-suggestions-header">💡 搜索建议 (↑↓选择 Enter确认)</div>';
    
    searchSuggestions.items.forEach((item, index) => {
        const isSelected = index === searchSuggestions.selectedIndex;
        html += `
            <div class="nm-search-suggestion-item ${isSelected ? 'selected' : ''}" 
                 data-index="${index}">
                <div class="nm-suggestion-main">
                    ${highlightKeywordInSuggestion(item.displayName, keyword)}
                </div>
                <div class="nm-suggestion-meta">
                    ${item.id} · ${item.category || '未分类'}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    container.style.display = 'block';
    searchSuggestions.visible = true;
    
    // 绑定点击事件
    container.querySelectorAll('.nm-search-suggestion-item').forEach((item, index) => {
        item.addEventListener('click', () => {
            searchSuggestions.selectedIndex = index;
            confirmSuggestion();
        });
    });
}

/**
 * 隐藏搜索建议
 */
function hideSearchSuggestions() {
    if (searchSuggestions.container) {
        searchSuggestions.container.style.display = 'none';
        searchSuggestions.visible = false;
        searchSuggestions.selectedIndex = -1;
        searchSuggestions.items = [];
    }
}

/**
 * 选择下一个建议
 */
function selectNextSuggestion() {
    if (!searchSuggestions.visible || searchSuggestions.items.length === 0) return;
    
    searchSuggestions.selectedIndex = 
        (searchSuggestions.selectedIndex + 1) % searchSuggestions.items.length;
    
    updateSuggestionSelection();
}

/**
 * 选择上一个建议
 */
function selectPreviousSuggestion() {
    if (!searchSuggestions.visible || searchSuggestions.items.length === 0) return;
    
    searchSuggestions.selectedIndex = 
        searchSuggestions.selectedIndex <= 0 
            ? searchSuggestions.items.length - 1 
            : searchSuggestions.selectedIndex - 1;
    
    updateSuggestionSelection();
}

/**
 * 更新建议选中状态
 */
function updateSuggestionSelection() {
    const container = searchSuggestions.container;
    if (!container) return;
    
    // 移除所有选中状态
    container.querySelectorAll('.nm-search-suggestion-item').forEach((item, index) => {
        if (index === searchSuggestions.selectedIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('selected');
        }
    });
}

/**
 * 确认选择的建议
 */
function confirmSuggestion() {
    if (searchSuggestions.selectedIndex < 0 || searchSuggestions.selectedIndex >= searchSuggestions.items.length) {
        return;
    }
    
    const selected = searchSuggestions.items[searchSuggestions.selectedIndex];
    const searchInput = document.getElementById('nm-search-input');
    
    if (searchInput && selected) {
        // 填充搜索框
        searchInput.value = selected.displayName;
        
        // 隐藏建议
        hideSearchSuggestions();
        
        // 触发搜索
        window.dispatchEvent(new CustomEvent('nm:searchInSidebar', {
            detail: { keyword: selected.displayName }
        }));
    }
}

/**
 * 在建议中高亮关键词
 */
function highlightKeywordInSuggestion(text, keyword) {
    if (!keyword) return escapeHtml(text);
    
    const escapedText = escapeHtml(text);
    const escapedKeyword = escapeHtml(keyword);
    const regex = new RegExp(`(${escapedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    return escapedText.replace(regex, '<mark>$1</mark>');
}

// ==================== 键盘事件处理 ====================

// 键盘事件处理
function handleKeydown(e) {
    // 如果焦点在输入框中，不处理快捷键（让输入框自己处理）
    const isInputFocused = e.target.tagName === 'INPUT' || 
                          e.target.tagName === 'TEXTAREA' || 
                          e.target.isContentEditable;
    
    // F2 重命名
    if (e.key === 'F2' && folderState.selectedFolders.size === 1 && !isInputFocused) {
        e.preventDefault();
        const folderId = Array.from(folderState.selectedFolders)[0];
        window.dispatchEvent(new CustomEvent('nm:renameFolder', {
            detail: { folderId }
        }));
    }
    
    // Delete 删除
    if (e.key === 'Delete' && folderState.selectedFolders.size > 0 && !isInputFocused) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('nm:deleteFolders', {
            detail: { folderIds: Array.from(folderState.selectedFolders) }
        }));
    }
    
    // Ctrl+A 全选（只在非输入框时生效）
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isInputFocused) {
        e.preventDefault();
        const allItems = document.querySelectorAll('[data-folder-id]');
        clearSelection();
        allItems.forEach(item => {
            const folderId = item.dataset.folderId;
            if (folderId) {
                folderState.selectedFolders.add(folderId);
                item.classList.add('selected');
            }
        });
        window.dispatchEvent(new Event('nm:selectionChanged'));
        showToast(`已选择 ${allItems.length} 个文件夹`);
    }
}

// 渲染文件夹列表
function renderFolders(targetContainer) {
    // 如果没有指定容器，则查找所有 nm-folder-list 容器并全部渲染
    const containers = targetContainer ? [targetContainer] : document.querySelectorAll('#nm-folder-list');
    
    containers.forEach(container => {
        if (!container) return;
        renderFoldersToContainer(container);
    });
}

function renderFoldersToContainer(container) {
    if (!container) return;
    
    container.innerHTML = '';
    
    // ========== 1. 顶部固定区域 ==========
    const topSection = document.createElement('div');
    topSection.className = 'nm-section-top';
    topSection.innerHTML = `
        <div class="nm-special-folder" data-special-id="favorites">
            <div class="nm-folder-icon">⭐</div>
            <div class="nm-folder-name">收藏</div>
            <div class="nm-folder-count">0</div>
        </div>
        <div class="nm-special-folder" data-special-id="uncategorized">
            <div class="nm-folder-icon">📂</div>
            <div class="nm-folder-name">未分类</div>
            <div class="nm-folder-count" id="nm-uncategorized-count">0</div>
        </div>
        <div class="nm-special-folder" data-special-id="hidden">
            <div class="nm-folder-icon">🙈</div>
            <div class="nm-folder-name">已隐藏</div>
            <div class="nm-folder-count" id="nm-hidden-count">0</div>
        </div>
    `;
    container.appendChild(topSection);
    
    // ========== 2. 我的分类区域 ==========
    const myFoldersSection = document.createElement('div');
    myFoldersSection.className = 'nm-section-my-folders';
    
    const myFoldersHeader = document.createElement('div');
    myFoldersHeader.className = 'nm-section-header';
    myFoldersHeader.innerHTML = `
        <div class="nm-section-toggle" data-section="my-folders">▼</div>
        <div class="nm-section-title">📁 我的分类</div>
        <button class="nm-section-add-btn" data-action="add-folder" title="新建文件夹">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </button>
    `;
    myFoldersSection.appendChild(myFoldersHeader);
    
    // 绑定加号按钮事件
    const addBtn = myFoldersHeader.querySelector('[data-action="add-folder"]');
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止触发区域折叠
            window.dispatchEvent(new CustomEvent('nm:createFolder', {
                detail: { parent: null }
            }));
        });
    }
    
    const myFoldersContent = document.createElement('div');
    myFoldersContent.className = 'nm-section-content';
    myFoldersContent.dataset.section = 'my-folders';
    
    if (!folderState.config || !folderState.config.folders || Object.keys(folderState.config.folders).length === 0) {
        myFoldersContent.innerHTML = `
            <div class="nm-section-empty">暂无自定义分类</div>
        `;
    } else {
        const tree = buildFolderTree(folderState.config.folders);
        
        // 递归渲染文件夹树
        const renderFolder = (folder, level = 1) => {
            const item = createFolderItem(folder, level);
            myFoldersContent.appendChild(item);
            
            // 如果文件夹展开且有子文件夹，渲染子文件夹
            if (folder.expanded && folder.children && folder.children.length > 0) {
                folder.children.forEach(child => {
                    renderFolder(child, level + 1);
                });
            }
        };
        
        tree.forEach(folder => renderFolder(folder));
    }
    
    myFoldersSection.appendChild(myFoldersContent);
    
    // 阻止我的分类区域的滚动事件冒泡
    myFoldersContent.addEventListener('wheel', (e) => {
        const isScrollable = myFoldersContent.scrollHeight > myFoldersContent.clientHeight;
        if (!isScrollable) return;
        
        const isAtTop = myFoldersContent.scrollTop === 0;
        const isAtBottom = myFoldersContent.scrollTop + myFoldersContent.clientHeight >= myFoldersContent.scrollHeight;
        
        // 如果向上滚动且已到顶部，或向下滚动且已到底部，允许事件冒泡
        if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
            return;
        }
        
        // 否则阻止冒泡，只在内部滚动
        e.stopPropagation();
    });
    
    container.appendChild(myFoldersSection);
    
    // ========== 3. 插件来源区域 ==========
    const pluginsSection = document.createElement('div');
    pluginsSection.className = 'nm-section-plugins';
    
    const pluginsHeader = document.createElement('div');
    pluginsHeader.className = 'nm-section-header';
    pluginsHeader.innerHTML = `
        <div class="nm-section-toggle" data-section="plugins">▼</div>
        <div class="nm-section-title">📦 插件来源</div>
    `;
    pluginsSection.appendChild(pluginsHeader);
    
    const pluginsContent = document.createElement('div');
    pluginsContent.className = 'nm-section-content';
    pluginsContent.dataset.section = 'plugins';
    pluginsContent.innerHTML = `
        <div class="nm-section-empty">加载中...</div>
    `;
    
    pluginsSection.appendChild(pluginsContent);
    
    // 阻止插件来源区域的滚动事件冒泡
    pluginsContent.addEventListener('wheel', (e) => {
        const isScrollable = pluginsContent.scrollHeight > pluginsContent.clientHeight;
        if (!isScrollable) return;
        
        const isAtTop = pluginsContent.scrollTop === 0;
        const isAtBottom = pluginsContent.scrollTop + pluginsContent.clientHeight >= pluginsContent.scrollHeight;
        
        // 如果向上滚动且已到顶部，或向下滚动且已到底部，允许事件冒泡
        if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
            return;
        }
        
        // 否则阻止冒泡，只在内部滚动
        e.stopPropagation();
    });
    
    container.appendChild(pluginsSection);
    
    // 绑定特殊文件夹点击事件
    bindSpecialFoldersEvents(container);
    
    // 绑定区域折叠事件
    bindSectionToggleEvents(container);
    
    // 在容器上也绑定dragOver和drop事件，支持拖到空白处
    bindContainerDragEvents(myFoldersContent);
    
    // 加载插件列表
    loadPluginsList();
}

// 绑定容器级别的拖拽事件
function bindContainerDragEvents(container) {
    // 移除旧的监听器（如果有）
    const oldHandler = container._dragOverHandler;
    if (oldHandler) {
        container.removeEventListener('dragover', oldHandler);
        container.removeEventListener('drop', container._dropHandler);
    }
    
    // 创建新的处理器
    const dragOverHandler = (e) => {
        // 只处理文件夹拖拽
        if (e.dataTransfer.types.includes('text/plain')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[容器dragover] mouseY:', e.clientY);
            window.dispatchEvent(new CustomEvent('nm:dragOver', {
                detail: { folderId: null, event: e }
            }));
        }
    };
    
    const dropHandler = (e) => {
        if (e.dataTransfer.types.includes('text/plain')) {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('nm:drop', {
                detail: { folderId: null, event: e }
            }));
        }
    };
    
    // 保存引用以便后续移除
    container._dragOverHandler = dragOverHandler;
    container._dropHandler = dropHandler;
    
    // 绑定事件
    container.addEventListener('dragover', dragOverHandler);
    container.addEventListener('drop', dropHandler);
    
    console.log('[容器绑定] 已绑定dragover和drop事件');
}

// 在左侧面板绑定拖拽事件
function bindContentAreaDragEvents() {
    const leftPanel = document.querySelector('.nm-left-panel');
    if (!leftPanel) {
        console.log('[左侧面板] 未找到.nm-left-panel');
        return;
    }
    
    console.log('[左侧面板] 找到元素，开始绑定');
    
    // 使用原生事件，不通过自定义事件转发
    leftPanel.addEventListener('dragover', (e) => {
        // 检查是否是文件夹拖拽
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId && !e.dataTransfer.types.includes('text/plain')) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // 直接调用dragOver处理
        window.dispatchEvent(new CustomEvent('nm:dragOver', {
            detail: { folderId: null, event: e }
        }));
    });
    
    leftPanel.addEventListener('drop', (e) => {
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId && !e.dataTransfer.types.includes('text/plain')) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        window.dispatchEvent(new CustomEvent('nm:drop', {
            detail: { folderId: null, event: e }
        }));
    });
    
    console.log('[左侧面板绑定] ✓ 已绑定dragover和drop事件');
}

// 创建文件夹项元素
function createFolderItem(folder, level) {
    const item = document.createElement('div');
    item.className = 'nm-folder-item';
    item.dataset.folderId = folder.id;
    item.dataset.level = level;
    item.draggable = true;
    
    // 选中状态
    if (folderState.selectedFolders.has(folder.id)) {
        item.classList.add('selected');
    }
    
    const hasSubfolders = folder.children && folder.children.length > 0;
    
    // 计算此文件夹中的节点数量
    let nodeCount = 0;
    if (folderState.config && folderState.config.folderNodes && folderState.config.folderNodes[folder.id]) {
        nodeCount = folderState.config.folderNodes[folder.id].length;
    }
    
    item.innerHTML = `
        ${hasSubfolders ? `
            <div class="nm-folder-expand ${folder.expanded ? 'expanded' : ''}" data-action="toggle">
                ▶
            </div>
        ` : '<div style="width: 16px; margin-right: 6px;"></div>'}
        <div class="nm-folder-icon">📁</div>
        <div class="nm-folder-name">${escapeHtml(folder.name)}</div>
        <div class="nm-folder-count">${nodeCount}</div>
    `;
    
    // 绑定事件
    bindFolderItemEvents(item, folder);
    
    return item;
}

// 绑定文件夹项事件
function bindFolderItemEvents(item, folder) {
    // 点击事件
    item.addEventListener('click', (e) => {
        // 如果点击的是展开按钮
        if (e.target.closest('[data-action="toggle"]')) {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('nm:toggleFolder', {
                detail: { folderId: folder.id }
            }));
            return;
        }
        
        // 点击文件夹时，清除插件的选择状态（互斥）
        if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
            clearPluginSelection();  // 清除插件选择
        }
        
        // 移除其他激活状态
        document.querySelectorAll('.nm-special-folder, .nm-plugin-item, .nm-folder-item, .nm-category-item').forEach(el => {
            el.classList.remove('active');
        });
        
        // 激活当前文件夹
        item.classList.add('active');
        
        // 处理选择
        handleFolderSelection(folder.id, e);
        window.dispatchEvent(new Event('nm:selectionChanged'));
        
        // 触发显示文件夹节点
        window.dispatchEvent(new CustomEvent('nm:showFolderNodes', {
            detail: { folderId: folder.id }
        }));
    });
    
    // 双击重命名
    item.addEventListener('dblclick', (e) => {
        if (!e.target.closest('[data-action="toggle"]')) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('nm:renameFolder', {
                detail: { folderId: folder.id }
            }));
        }
    });
    
    // 拖拽事件
    item.addEventListener('dragstart', (e) => {
        window.dispatchEvent(new CustomEvent('nm:dragStart', {
            detail: { folderId: folder.id, event: e }
        }));
    });
    
    item.addEventListener('dragover', (e) => {
        // 检查是否是节点拖拽
        if (e.dataTransfer.types.includes('node-type')) {
            e.preventDefault();
            e.stopPropagation();
            item.classList.add('drag-over-node');
            return;
        }
        
        // 否则是文件夹拖拽
        window.dispatchEvent(new CustomEvent('nm:dragOver', {
            detail: { folderId: folder.id, event: e }
        }));
    });
    
    item.addEventListener('drop', (e) => {
        // 移除高亮
        item.classList.remove('drag-over-node');
        
        // 检查是否是节点拖拽
        if (e.dataTransfer.types.includes('node-type')) {
            e.preventDefault();
            e.stopPropagation();
            
            // 检查是否是批量拖动
            const isBatchDrag = e.dataTransfer.getData('batchDrag') === 'true';
            
            if (isBatchDrag) {
                // 批量拖动
                const nodeIdsJson = e.dataTransfer.getData('nodeIds');
                const nodeIds = JSON.parse(nodeIdsJson);
                
                console.log(`[文件夹] 接收批量节点拖拽: ${nodeIds.length}个节点到文件夹:`, folder.id);
                
                // 触发批量添加到文件夹事件
                window.dispatchEvent(new CustomEvent('nm:addNodesToFolder', {
                    detail: { nodeIds, folderId: folder.id }
                }));
            } else {
                // 单个节点拖动
                const nodeId = e.dataTransfer.getData('nodeId') || e.dataTransfer.getData('text/plain');
                const nodeType = e.dataTransfer.getData('node-type');
                
                console.log('[文件夹] 接收节点拖拽:', nodeId, '到文件夹:', folder.id);
                
                // 触发节点添加到文件夹事件
                window.dispatchEvent(new CustomEvent('nm:addNodeToFolder', {
                    detail: { nodeId, nodeType, folderId: folder.id }
                }));
            }
            return;
        }
        
        // 否则是文件夹拖拽
        window.dispatchEvent(new CustomEvent('nm:drop', {
            detail: { folderId: folder.id, event: e }
        }));
    });
    
    item.addEventListener('dragend', (e) => {
        window.dispatchEvent(new CustomEvent('nm:dragEnd', {
            detail: { event: e }
        }));
    });
    
    item.addEventListener('dragleave', (e) => {
        // 移除节点拖拽高亮
        item.classList.remove('drag-over-node');
        
        window.dispatchEvent(new CustomEvent('nm:dragLeave', {
            detail: { folderId: folder.id, event: e }
        }));
    });
    
    // 右键菜单
    item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        // 如果右键的不是已选中项，则选中它
        if (!folderState.selectedFolders.has(folder.id)) {
            clearSelection();
            folderState.selectedFolders.add(folder.id);
            folderState.lastSelectedFolder = folder.id;
            item.classList.add('selected');
            window.dispatchEvent(new Event('nm:selectionChanged'));
        }
        
        showContextMenu(e, folder.id);
    });
}

// 显示右键菜单
function showContextMenu(e, folderId) {
    // 移除所有已存在的右键菜单
    document.querySelectorAll('.nm-context-menu, .context-menu').forEach(menu => menu.remove());
    
    // 创建右键菜单
    const menu = document.createElement('div');
    menu.className = 'nm-context-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${e.pageX}px;
        top: ${e.pageY}px;
        background: var(--comfy-menu-bg, #1e1e1e);
        border: 1px solid var(--border-color, #555);
        border-radius: 6px;
        padding: 4px 0;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        min-width: 160px;
    `;
    
    const selectedCount = folderState.selectedFolders.size;
    
    menu.innerHTML = `
        <div class="nm-menu-item" data-action="new-subfolder">
            ➕ 新建子文件夹
        </div>
        <div class="nm-menu-separator"></div>
        ${selectedCount === 1 ? `
            <div class="nm-menu-item" data-action="rename">
                ✏️ 重命名
            </div>
        ` : ''}
        <div class="nm-menu-item" data-action="delete" style="color: #dc3545;">
            🗑️ 删除 ${selectedCount > 1 ? `(${selectedCount})` : ''}
        </div>
    `;
    
    // 添加菜单项样式
    const style = `
        .nm-menu-item {
            padding: 8px 16px;
            cursor: pointer;
            font-size: 13px;
            color: var(--input-text, #ffffff);
        }
        .nm-menu-item:hover {
            background: var(--comfy-input-bg-hover, #3d3d3d);
        }
        .nm-menu-separator {
            height: 1px;
            background: var(--border-color, #444);
            margin: 4px 0;
        }
    `;
    
    if (!document.querySelector('#nm-context-menu-style')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'nm-context-menu-style';
        styleEl.textContent = style;
        document.head.appendChild(styleEl);
    }
    
    // 绑定菜单项事件
    menu.querySelectorAll('.nm-menu-item').forEach(item => {
        item.onclick = () => {
            const action = item.dataset.action;
            
            switch (action) {
                case 'new-subfolder':
                    window.dispatchEvent(new CustomEvent('nm:createFolder', {
                        detail: { parent: folderId }
                    }));
                    break;
                case 'rename':
                    window.dispatchEvent(new CustomEvent('nm:renameFolder', {
                        detail: { folderId }
                    }));
                    break;
                case 'delete':
                    window.dispatchEvent(new CustomEvent('nm:deleteFolders', {
                        detail: { folderIds: Array.from(folderState.selectedFolders) }
                    }));
                    break;
            }
            
            document.body.removeChild(menu);
        };
    });
    
    document.body.appendChild(menu);
    
    // 点击外部关闭菜单（包括Modal窗口内）
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

// 绑定特殊文件夹点击事件
function bindSpecialFoldersEvents(container) {
    const specialFolders = container.querySelectorAll('.nm-special-folder');
    
    specialFolders.forEach(item => {
        const specialId = item.dataset.specialId;
        
        // 点击事件
        item.addEventListener('click', () => {
            // 点击特殊文件夹时，清除所有选择状态（互斥）
            clearSelection();  // 清除文件夹选择
            clearPluginSelection();  // 清除插件选择
            
            // 移除其他激活状态
            document.querySelectorAll('.nm-special-folder, .nm-plugin-item, .nm-folder-item, .nm-category-item').forEach(el => {
                el.classList.remove('active');
            });
            
            // 激活当前项
            item.classList.add('active');
            
            // 触发显示对应节点
            window.dispatchEvent(new CustomEvent('nm:showSpecialNodes', {
                detail: { type: specialId }
            }));
        });
        
        // 只为收藏夹添加拖放支持
        if (specialId === 'favorites') {
            // 拖拽经过
            item.addEventListener('dragover', (e) => {
                if (e.dataTransfer.types.includes('node-type')) {
                    e.preventDefault();
                    e.stopPropagation();
                    item.classList.add('drag-over-node');
                }
            });
            
            // 拖拽离开
            item.addEventListener('dragleave', (e) => {
                item.classList.remove('drag-over-node');
            });
            
            // 放置
            item.addEventListener('drop', (e) => {
                item.classList.remove('drag-over-node');
                
                if (e.dataTransfer.types.includes('node-type')) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 检查是否是批量拖动
                    const isBatchDrag = e.dataTransfer.getData('batchDrag') === 'true';
                    
                    if (isBatchDrag) {
                        // 批量添加到收藏
                        const nodeIdsJson = e.dataTransfer.getData('nodeIds');
                        const nodeIds = JSON.parse(nodeIdsJson);
                        
                        console.log(`[收藏夹] 批量添加${nodeIds.length}个节点到收藏`);
                        
                        // 触发批量收藏事件
                        window.dispatchEvent(new CustomEvent('nm:batchFavorite', {
                            detail: { nodeIds }
                        }));
                    } else {
                        // 单个添加到收藏
                        const nodeId = e.dataTransfer.getData('nodeId');
                        
                        console.log('[收藏夹] 添加节点到收藏:', nodeId);
                        
                        // 触发收藏事件
                        window.dispatchEvent(new CustomEvent('nm:favoriteNode', {
                            detail: { nodeId }
                        }));
                    }
                }
            });
        }
    });
}

// 绑定区域折叠事件
function bindSectionToggleEvents(container) {
    const headers = container.querySelectorAll('.nm-section-header');
    
    headers.forEach(header => {
        const toggle = header.querySelector('.nm-section-toggle');
        const title = header.querySelector('.nm-section-title');
        const addBtn = header.querySelector('[data-action="add-folder"]');
        
        if (!toggle) return;
        
        const sectionName = toggle.dataset.section;
        const content = container.querySelector(`.nm-section-content[data-section="${sectionName}"]`);
        
        // 1. 箭头：展开/收起
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (content) {
                const isCollapsed = content.classList.toggle('collapsed');
                toggle.classList.toggle('collapsed', isCollapsed);
            }
        });
        
        // 2. 标题文字：根据不同区域执行不同操作
        if (title) {
            title.addEventListener('click', (e) => {
                e.stopPropagation();
                
                if (sectionName === 'my-folders') {
                    // 点击"我的分类"：显示所有已分类的节点
                    showAllCategorizedNodes();
                } else if (sectionName === 'plugins') {
                    // 点击"插件来源"：显示所有节点
                    showAllNodes();
                }
            });
            
            // 添加鼠标样式提示可点击
            title.style.cursor = 'pointer';
        }
        
        // 3. + 按钮：已在 renderFolders 中绑定
    });
}

// 监听 nodePoolState 就绪事件
window.addEventListener('nm:nodePoolReady', () => {
    console.log('[插件列表] 收到 nodePoolState 就绪通知，重新渲染');
    loadPluginsList();
});

// 加载插件列表
async function loadPluginsList() {
    try {
        // 查找所有插件内容容器（侧边栏 + Modal）
        const pluginsContents = document.querySelectorAll('.nm-section-content[data-section="plugins"]');
        if (pluginsContents.length === 0) {
            console.error('[插件列表] 未找到插件内容容器');
            return;
        }
        
        console.log('[插件列表] 找到', pluginsContents.length, '个插件容器');
        console.log('[插件列表] 开始请求 /node-manager/plugins');
        
        // 从后端获取插件列表（扫描 custom_nodes 目录）
        const response = await fetch('/node-manager/plugins');
        
        console.log('[插件列表] 响应状态:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log('[插件列表] 接收数据:', data);
        
        if (!data.success) {
            throw new Error(data.error || '未知错误');
        }
        
        if (!data.plugins || data.plugins.length === 0) {
            // 更新所有容器
            pluginsContents.forEach(container => {
                container.innerHTML = `
                <div class="nm-section-empty">暂无插件</div>
            `;
            });
            return;
        }
        
        // 清空所有容器
        pluginsContents.forEach(container => {
            container.innerHTML = '';
        });
        
        console.log('[插件列表] showHiddenPlugins状态:', folderState.showHiddenPlugins);
        console.log('[插件列表] hiddenPlugins列表:', folderState.config?.hiddenPlugins);
        
        // 使用前端已汉化的 category 重建分类树
        if (typeof LiteGraph !== 'undefined' && LiteGraph.registered_node_types && window.nodePoolState?.allNodes) {
            console.log('[插件列表] 使用 LiteGraph 重建汉化分类树...');
            data.plugins.forEach(plugin => {
                // 获取该插件的所有节点
                const pluginNodes = window.nodePoolState.allNodes.filter(node => 
                    node.source === plugin.python_name || node.source === plugin.name
                );
                
                if (pluginNodes.length > 0) {
                    // 使用汉化后的 category 重建分类树
                    const newCategoryTree = {};
                    
                    pluginNodes.forEach(node => {
                        // 从 LiteGraph 获取汉化后的 category
                        const nodeType = LiteGraph.registered_node_types[node.id];
                        const translatedCategory = nodeType?.category || node.category;
                        
                        if (!translatedCategory) {
                            // 没有分类的节点，放到根目录
                            if (!newCategoryTree._root_nodes) {
                                newCategoryTree._root_nodes = [];
                            }
                            newCategoryTree._root_nodes.push(node);
                            return;
                        }
                        
                        // 分割分类路径（使用汉化后的）
                        const parts = translatedCategory.split('/').map(p => p.trim()).filter(p => p);
                        
                        if (parts.length === 0) {
                            if (!newCategoryTree._root_nodes) {
                                newCategoryTree._root_nodes = [];
                            }
                            newCategoryTree._root_nodes.push(node);
                            return;
                        }
                        
                        // 构建树结构
                        let current = newCategoryTree;
                        for (const part of parts) {
                            if (!current[part]) {
                                current[part] = { _nodes: [], _children: {} };
                            }
                            current = current[part]._children;
                        }
                        
                        // 添加节点到叶子分类
                        let parent = newCategoryTree;
                        for (let i = 0; i < parts.length - 1; i++) {
                            parent = parent[parts[i]]._children;
                        }
                        if (parts.length > 0) {
                            parent[parts[parts.length - 1]]._nodes.push(node);
                        }
                    });
                    
                    // 替换后端的分类树
                    plugin.categories = newCategoryTree;
                    console.log('[插件列表] ✅ 重建分类树:', plugin.name, Object.keys(newCategoryTree));
                }
            });
        }
        
        // 为每个容器渲染插件列表
        pluginsContents.forEach(pluginsContent => {
        data.plugins.forEach(plugin => {
            // 创建插件容器
            const pluginContainer = document.createElement('div');
            pluginContainer.className = 'nm-plugin-container';
            pluginContainer.dataset.pluginName = plugin.name;
            pluginContainer.dataset.pythonName = plugin.python_name || plugin.name;
            
            // 检查是否应该隐藏
            const isHidden = folderState.config?.hiddenPlugins?.includes(plugin.name);
            if (isHidden && !folderState.showHiddenPlugins) {
                return; // 跳过隐藏的插件
            }
            
            // 创建插件项
            const item = document.createElement('div');
            item.className = 'nm-plugin-item';
            item.dataset.pluginName = plugin.name;
            item.dataset.pythonName = plugin.python_name || plugin.name;
            item.draggable = true;
            
            // 如果没有节点，添加特殊样式
            if (plugin.node_count === 0) {
                item.classList.add('no-nodes');
            }
            
            // 如果是隐藏的插件（但正在显示），添加隐藏样式
            if (isHidden) {
                item.classList.add('hidden');
            }
            
            // 如果是重复插件，添加重复标记
            if (plugin.is_duplicate) {
                item.classList.add('duplicate');
                item.title += `\n⚠️ 在 managed_plugins 目录中也存在`;
            }
            
            // 检查是否有分类
            const hasCategories = plugin.categories && Object.keys(plugin.categories).length > 0;
            
            item.innerHTML = `
                ${hasCategories ? `<div class="nm-plugin-expand">▶</div>` : '<div style="width: 16px;"></div>'}
                <div class="nm-folder-icon">📦</div>
                <div class="nm-folder-name">${escapeHtml(plugin.name)}</div>
                <div class="nm-folder-count">${plugin.node_count}</div>
            `;
            
            // 添加提示
            if (plugin.node_count === 0) {
                item.title = '此插件暂无已注册节点';
            } else {
                item.title = `${plugin.node_count} 个节点\nPython模块名: ${plugin.python_name}`;
            }
            
            // 绑定点击事件
            item.addEventListener('click', (e) => {
                // 如果点击的是展开按钮
                if (e.target.classList.contains('nm-plugin-expand')) {
                    e.stopPropagation();
                    togglePluginCategories(pluginContainer, plugin);
                    return;
                }
                
                // 如果是隐藏的插件，显示提示
                if (isHidden) {
                    showToast('⚠️ 此插件已隐藏，右键可取消隐藏', 'warning');
                }
                
                // 点击插件时，清除文件夹的选择状态（互斥）
                if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
                    clearSelection();  // 清除文件夹选择
                    
                    // 非多选模式：移除其他激活状态
                    document.querySelectorAll('.nm-special-folder, .nm-plugin-item.active, .nm-folder-item, .nm-category-item').forEach(el => {
                        el.classList.remove('active');
                    });
                    
                    // 激活当前项
                    item.classList.add('active');
                }
                
                // 处理多选（Ctrl/Shift）
                handlePluginSelection(plugin.name, e);
                
                // 如果不是多选模式，显示插件节点
                if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
                    // 触发显示插件所有节点
                    window.dispatchEvent(new CustomEvent('nm:showPluginNodes', {
                        detail: { 
                            pluginName: plugin.python_name || plugin.name,
                            displayName: plugin.name
                        }
                    }));
                }
            });
            
            // 绑定右键菜单
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // 如果右键的不是已选中的项，先选中它
                if (!folderState.selectedPlugins.has(plugin.name)) {
                    clearPluginSelection();
                    addPluginSelection(plugin.name);
                }
                
                showPluginContextMenu(e, plugin);
            });
            
            // 绑定拖拽事件
            bindPluginDragEvents(item, plugin);
            
            pluginContainer.appendChild(item);
            pluginsContent.appendChild(pluginContainer);
            });
        });
        
        console.log(`[插件列表] 加载完成，共 ${data.plugins.length} 个插件`);
        
    } catch (error) {
        console.error('[插件列表] 加载失败:', error);
        // 更新所有容器显示错误信息
        const pluginsContents = document.querySelectorAll('.nm-section-content[data-section="plugins"]');
        pluginsContents.forEach(container => {
            container.innerHTML = `
                <div class="nm-section-empty" style="color: #dc3545;">
                    ❌ 加载失败<br>
                    <span style="font-size: 11px; opacity: 0.7;">${error.message}</span>
                </div>
            `;
        });
        showToast(`插件列表加载失败: ${error.message}`, 'error');
    }
}

// 展开/折叠插件分类
function togglePluginCategories(container, plugin) {
    const expand = container.querySelector('.nm-plugin-expand');
    if (!expand) return;
    
    const isExpanded = expand.classList.contains('expanded');
    
    if (isExpanded) {
        // 折叠
        expand.classList.remove('expanded');
        const categoriesEl = container.querySelector('.nm-plugin-categories');
        if (categoriesEl) {
            categoriesEl.remove();
        }
    } else {
        // 展开
        expand.classList.add('expanded');
        renderPluginCategories(container, plugin);
    }
}

// 获取汉化后的分类名称（全局函数，供多处使用）
// 注意：现在分类树已经使用汉化后的 category 重建，所以这个函数主要用于兼容性
function translateCategoryName(categoryName) {
    // 分类树已经是汉化后的，直接返回
    return categoryName;
}

// 翻译分类路径（多层）
function translateCategoryPath(path) {
    if (!path) return '';
    // 分类路径已经是汉化后的，直接返回
    return path;
}

// 渲染插件分类
function renderPluginCategories(container, plugin) {
    if (!plugin.categories || Object.keys(plugin.categories).length === 0) {
        return;
    }
    
    const categoriesContainer = document.createElement('div');
    categoriesContainer.className = 'nm-plugin-categories';
    
    // 从分类数据中递归收集所有节点ID（包括子分类）
    function collectAllNodeIds(categoryData) {
        const nodeIds = new Set();
        
        // 添加当前分类的节点ID
        if (categoryData._nodes && Array.isArray(categoryData._nodes)) {
            categoryData._nodes.forEach(node => {
                if (node.id) {
                    nodeIds.add(node.id);
                }
            });
        }
        
        // 递归添加子分类的节点ID
        if (categoryData._children) {
            for (const childData of Object.values(categoryData._children)) {
                const childNodeIds = collectAllNodeIds(childData);
                childNodeIds.forEach(id => nodeIds.add(id));
            }
        }
        
        return nodeIds;
    }
    
    // 统计实际存在的节点数量（从 nodePoolState 验证）
    function countActualNodes(nodeIds) {
        const { nodePoolState } = window;
        if (!nodePoolState || !nodePoolState.allNodes || nodePoolState.allNodes.length === 0) {
            // 如果前端数据还没加载，返回后端提供的节点数量（nodeIds的数量）
            return nodeIds.size;
        }
        
        // 统计这些ID中有多少在 nodePoolState.allNodes 中实际存在
        let count = 0;
        const allNodeIds = new Set(nodePoolState.allNodes.map(n => n.id));
        nodeIds.forEach(id => {
            if (allNodeIds.has(id)) {
                count++;
            }
        });
        
        return count;
    }
    
    // 递归渲染分类树
    function renderCategoryTree(categoryObj, path = '', level = 1) {
        for (const [categoryName, categoryData] of Object.entries(categoryObj)) {
            // 跳过特殊的 _root_nodes 键（根目录节点）
            if (categoryName === '_root_nodes') {
                continue;
            }
            
            const fullPath = path ? `${path}/${categoryName}` : categoryName;
            
            // 获取汉化后的分类名称
            const translatedName = translateCategoryName(categoryName);
            const translatedFullPath = translateCategoryPath(fullPath);
            
            // 收集该分类及所有子分类的节点ID
            const nodeIds = collectAllNodeIds(categoryData);
            // 验证这些ID在前端实际存在的数量
            const nodeCount = countActualNodes(nodeIds);
            
            const hasChildren = categoryData._children && Object.keys(categoryData._children).length > 0;
            
            const categoryItem = document.createElement('div');
            categoryItem.className = 'nm-category-item';
            categoryItem.dataset.level = level;
            categoryItem.dataset.path = fullPath;
            categoryItem.style.paddingLeft = `${12 + level * 16}px`;
            
            // 使用汉化后的名称显示
            categoryItem.innerHTML = `
                ${hasChildren ? '<div class="nm-category-expand">▶</div>' : '<div style="width: 16px;"></div>'}
                <div class="nm-category-icon">📁</div>
                <div class="nm-category-name">${escapeHtml(translatedName)}</div>
                <div class="nm-category-count">${nodeCount}</div>
            `;
            
            // 点击分类显示该分类节点
            categoryItem.addEventListener('click', (e) => {
                if (e.target.classList.contains('nm-category-expand')) {
                    e.stopPropagation();
                    toggleCategory(categoryItem, categoryData);
                    return;
                }
                
                // 点击分类时，清除所有选择状态（互斥）
                clearSelection();  // 清除文件夹选择
                clearPluginSelection();  // 清除插件选择
                
                // 移除其他激活状态
                document.querySelectorAll('.nm-special-folder, .nm-plugin-item, .nm-folder-item, .nm-category-item').forEach(el => {
                    el.classList.remove('active');
                });
                
                categoryItem.classList.add('active');
                
                // 收集该分类的所有节点ID
                const categoryNodeIds = collectAllNodeIds(categoryData);
                
                // 显示该分类的节点（传递节点ID列表），使用汉化后的显示名
                window.dispatchEvent(new CustomEvent('nm:showCategoryNodes', {
                    detail: {
                        pluginName: plugin.python_name || plugin.name,
                        category: fullPath,
                        displayName: `${plugin.name} / ${translatedName}`,
                        nodeIds: Array.from(categoryNodeIds)  // 传递节点ID列表
                    }
                }));
            });
            
            categoriesContainer.appendChild(categoryItem);
            
            // 如果有子分类，默认不展开（需要点击展开按钮）
        }
    }
    
    // 先渲染分类树
    renderCategoryTree(plugin.categories);
    
    // 然后渲染根目录节点（如果有）
    if (plugin.categories._root_nodes && Array.isArray(plugin.categories._root_nodes) && plugin.categories._root_nodes.length > 0) {
        const rootNodeIds = plugin.categories._root_nodes.map(node => node.id);
        const rootCount = countActualNodes(new Set(rootNodeIds));
        
        if (rootCount > 0) {
            const rootItem = document.createElement('div');
            rootItem.className = 'nm-category-item nm-root-category';
            rootItem.dataset.level = '1';
            rootItem.style.paddingLeft = '28px';
            
            rootItem.innerHTML = `
                <div style="width: 16px;"></div>
                <div class="nm-category-icon">📄</div>
                <div class="nm-category-name">其他节点</div>
                <div class="nm-category-count">${rootCount}</div>
            `;
            
            rootItem.addEventListener('click', (e) => {
                // 清除所有选择状态
                clearSelection();
                clearPluginSelection();
                
                // 移除其他激活状态
                document.querySelectorAll('.nm-special-folder, .nm-plugin-item, .nm-folder-item, .nm-category-item').forEach(el => {
                    el.classList.remove('active');
                });
                
                rootItem.classList.add('active');
                
                // 显示根目录节点
                window.dispatchEvent(new CustomEvent('nm:showCategoryNodes', {
                    detail: {
                        pluginName: plugin.python_name || plugin.name,
                        category: '',
                        displayName: `${plugin.name} / 其他节点`,
                        nodeIds: rootNodeIds
                    }
                }));
            });
            
            categoriesContainer.appendChild(rootItem);
        }
    }
    
    container.appendChild(categoriesContainer);
}

// 展开/折叠分类
function toggleCategory(categoryItem, categoryData) {
    const expand = categoryItem.querySelector('.nm-category-expand');
    if (!expand) return;
    
    const isExpanded = expand.classList.contains('expanded');
    const path = categoryItem.dataset.path;
    const level = parseInt(categoryItem.dataset.level);
    
    if (isExpanded) {
        // 折叠：移除子分类
        expand.classList.remove('expanded');
        let next = categoryItem.nextElementSibling;
        while (next && next.classList.contains('nm-category-item')) {
            const nextLevel = parseInt(next.dataset.level);
            if (nextLevel <= level) break;
            const toRemove = next;
            next = next.nextElementSibling;
            toRemove.remove();
        }
    } else {
        // 展开：渲染子分类
        expand.classList.add('expanded');
        const children = categoryData._children || {};
        const fragment = document.createDocumentFragment();
        
        // 递归收集节点ID（与外部函数相同的逻辑）
        function collectNodeIds(data) {
            const ids = new Set();
            if (data._nodes && Array.isArray(data._nodes)) {
                data._nodes.forEach(node => {
                    if (node.id) {
                        ids.add(node.id);
                    }
                });
            }
            if (data._children) {
                for (const child of Object.values(data._children)) {
                    const childIds = collectNodeIds(child);
                    childIds.forEach(id => ids.add(id));
                }
            }
            return ids;
        }
        
        // 统计实际存在的节点
        function countNodes(nodeIds) {
            const { nodePoolState } = window;
            if (!nodePoolState || !nodePoolState.allNodes || nodePoolState.allNodes.length === 0) {
                // 如果前端数据还没加载，返回后端提供的节点数量
                return nodeIds.size;
            }
            let count = 0;
            const allNodeIds = new Set(nodePoolState.allNodes.map(n => n.id));
            nodeIds.forEach(id => {
                if (allNodeIds.has(id)) {
                    count++;
                }
            });
            return count;
        }
        
        for (const [childName, childData] of Object.entries(children)) {
            const fullPath = `${path}/${childName}`;
            
            // 获取汉化后的子分类名称
            const translatedChildName = translateCategoryName(childName);
            
            // 收集节点ID并统计实际存在的数量
            const nodeIds = collectNodeIds(childData);
            const nodeCount = countNodes(nodeIds);
            
            const hasChildren = childData._children && Object.keys(childData._children).length > 0;
            
            const childItem = document.createElement('div');
            childItem.className = 'nm-category-item';
            childItem.dataset.level = level + 1;
            childItem.dataset.path = fullPath;
            childItem.style.paddingLeft = `${12 + (level + 1) * 16}px`;
            
            // 使用汉化后的名称显示
            childItem.innerHTML = `
                ${hasChildren ? '<div class="nm-category-expand">▶</div>' : '<div style="width: 16px;"></div>'}
                <div class="nm-category-icon">📁</div>
                <div class="nm-category-name">${escapeHtml(translatedChildName)}</div>
                <div class="nm-category-count">${nodeCount}</div>
            `;
            
            // 绑定点击事件（类似上面）
            childItem.addEventListener('click', (e) => {
                if (e.target.classList.contains('nm-category-expand')) {
                    e.stopPropagation();
                    toggleCategory(childItem, childData);
                    return;
                }
                
                document.querySelectorAll('.nm-special-folder, .nm-plugin-item, .nm-folder-item, .nm-category-item').forEach(el => {
                    el.classList.remove('active');
                });
                
                childItem.classList.add('active');
                
                // 获取插件容器的 python_name（用于匹配节点）
                const container = categoryItem.closest('.nm-plugin-container');
                const pythonName = container ? container.dataset.pythonName : '';
                const displayName = container ? container.dataset.pluginName : '';
                
                // 收集该分类的所有节点ID
                const childNodeIds = collectNodeIds(childData);
                
                // 使用汉化后的分类路径显示
                const translatedPath = translateCategoryPath(fullPath);
                
                window.dispatchEvent(new CustomEvent('nm:showCategoryNodes', {
                    detail: {
                        pluginName: pythonName,
                        category: fullPath,
                        displayName: `${displayName} / ${translatedPath}`,
                        nodeIds: Array.from(childNodeIds)  // 传递节点ID列表
                    }
                }));
            });
            
            fragment.appendChild(childItem);
        }
        
        categoryItem.parentElement.insertBefore(fragment, categoryItem.nextElementSibling);
    }
}

// 绑定插件拖拽事件
function bindPluginDragEvents(item, plugin) {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', 'plugin:' + plugin.name);
        item.classList.add('dragging');
    });
    
    item.addEventListener('dragend', (e) => {
        item.classList.remove('dragging');
        // 清除所有拖拽高亮
        document.querySelectorAll('.nm-plugin-item').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
    });
    
    item.addEventListener('dragover', (e) => {
        const draggingItem = document.querySelector('.nm-plugin-item.dragging');
        if (!draggingItem) return;
        
        e.preventDefault();
        e.stopPropagation();  // 阻止事件冒泡
        
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        
        // 移除所有高亮
        document.querySelectorAll('.nm-plugin-item').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        
        // 添加高亮
        if (e.clientY < midY) {
            item.classList.add('drag-over-top');
        } else {
            item.classList.add('drag-over-bottom');
        }
    });
    
    item.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();  // 阻止事件冒泡到文件夹拖拽处理器
        item.classList.remove('drag-over-top', 'drag-over-bottom');
        // TODO: 实现拖拽排序逻辑
        console.log('[插件拖拽] 拖拽到:', plugin.name);
    });
}

// 显示插件右键菜单
function showPluginContextMenu(event, plugin) {
    // 移除所有已存在的右键菜单（包括文件夹的）
    document.querySelectorAll('.nm-context-menu, .context-menu').forEach(menu => menu.remove());
    
    const selectedCount = folderState.selectedPlugins.size;
    const isHidden = folderState.config?.hiddenPlugins?.includes(plugin.name);
    
    // 创建菜单
    const menu = document.createElement('div');
    menu.className = 'nm-context-menu';
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
    
    const menuItems = [
        {
            label: isHidden ? '显示插件' : '隐藏插件',
            icon: isHidden ? '👁️' : '🙈',
            action: () => togglePluginsHidden()
        },
        {
            label: '删除插件...',
            icon: '🗑️',
            danger: true,  // 标记为危险操作
            action: () => deletePlugins()
        }
    ];
    
    if (selectedCount > 1) {
        menuItems[0].label = isHidden ? `显示${selectedCount}个插件` : `隐藏${selectedCount}个插件`;
        menuItems[1].label = `删除${selectedCount}个插件...`;
    }
    
    menuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'nm-context-menu-item';
        menuItem.innerHTML = `<span>${item.icon}</span> ${item.label}`;
        
        // 危险操作使用红色样式
        const baseColor = item.danger ? 'var(--error-text, #ff6b6b)' : 'var(--input-text, #ddd)';
        const hoverColor = item.danger ? 'rgba(255, 107, 107, 0.2)' : 'rgba(0, 122, 204, 0.2)';
        
        menuItem.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            color: ${baseColor};
            border-radius: 4px;
            transition: all 0.15s;
        `;
        
        menuItem.addEventListener('mouseenter', () => {
            menuItem.style.background = hoverColor;
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

// 删除插件（真删除文件）
async function deletePlugins() {
    try {
        const pluginNames = Array.from(folderState.selectedPlugins);
        if (pluginNames.length === 0) return;
        
        const count = pluginNames.length;
        const pluginText = count === 1 ? `插件 "${pluginNames[0]}"` : `${count} 个插件`;
        
        // 创建确认对话框
        const confirmed = confirm(
            `⚠️ 确定要删除${pluginText}吗？\n\n` +
            `此操作将：\n` +
            `• 永久删除插件文件夹\n` +
            `• 删除所有相关节点\n` +
            `• 可能导致现有工作流报错\n` +
            `• 无法撤销！\n\n` +
            `${count > 1 ? '插件列表：\n' + pluginNames.map((n, i) => `${i + 1}. ${n}`).join('\n') : ''}`
        );
        
        if (!confirmed) return;
        
        // 二次确认（危险操作）
        const finalConfirm = confirm(
            `⚠️⚠️⚠️ 最后确认 ⚠️⚠️⚠️\n\n` +
            `你真的要删除${pluginText}吗？\n` +
            `删除后需要重启ComfyUI才能完全卸载。`
        );
        
        if (!finalConfirm) return;
        
        // 显示加载状态
        const loadingToast = showToast('正在删除插件...', 'info', 0);
        
        // 调用后端API
        const response = await fetch('/node-manager/plugin/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pluginNames })
        });
        
        loadingToast.remove();
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '删除失败');
        }
        
        const result = await response.json();
        
        // 显示成功消息
        showToast(
            `✅ 成功删除${pluginText}！\n\n` +
            `⚠️ 请重启ComfyUI以完全卸载。`,
            'success',
            5000
        );
        
        // 清空选择
        clearPluginSelection();
        
        // 刷新插件列表
        window.dispatchEvent(new CustomEvent('nm:refreshPluginsList'));
        
    } catch (error) {
        console.error('[删除插件] 失败:', error);
        showToast(`❌ 删除插件失败：${error.message}`, 'error', 5000);
    }
}

// 显示Toast提示（临时实现）
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 20px;
        background: ${type === 'error' ? '#ff6b6b' : type === 'success' ? '#51cf66' : '#4a9eff'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10001;
        max-width: 400px;
        white-space: pre-line;
        font-size: 14px;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    if (duration > 0) {
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    return toast;
}

// 显示Git URL安装对话框
function showGitUrlInstallDialog() {
    // 移除已存在的对话框
    const existingDialog = document.querySelector('.nm-git-url-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    // 创建遮罩
    const overlay = document.createElement('div');
    overlay.className = 'nm-git-url-dialog';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    `;
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: var(--comfy-menu-bg, #2d2d2d);
        border-radius: 12px;
        padding: 24px;
        width: 90%;
        max-width: 500px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;
    
    dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: var(--input-text, #ddd); font-size: 18px; display: flex; align-items: center; gap: 8px;">
            <span>📥</span>
            <span>从 Git URL 安装插件</span>
        </h3>
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; color: var(--descrip-text, #999); font-size: 13px;">
                GitHub 仓库地址
            </label>
            <input 
                type="text" 
                id="nm-git-url-input"
                placeholder="例如: https://github.com/ltdrdata/ComfyUI-Manager"
                style="
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid var(--border-color, #555);
                    border-radius: 6px;
                    background: var(--comfy-input-bg, #222);
                    color: var(--input-text, #ddd);
                    font-size: 14px;
                    font-family: monospace;
                "
            >
        </div>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: var(--descrip-text, #999); font-size: 13px;">
                插件名称（可选，自动从URL提取）
            </label>
            <input 
                type="text" 
                id="nm-plugin-name-input"
                placeholder="自动检测"
                style="
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid var(--border-color, #555);
                    border-radius: 6px;
                    background: var(--comfy-input-bg, #222);
                    color: var(--input-text, #ddd);
                    font-size: 14px;
                "
            >
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="nm-git-cancel-btn" style="
                padding: 10px 20px;
                border: 1px solid var(--border-color, #555);
                border-radius: 6px;
                background: var(--comfy-input-bg, #222);
                color: var(--input-text, #ddd);
                font-size: 14px;
                cursor: pointer;
            ">取消</button>
            <button id="nm-git-install-btn" style="
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                background: #4a9eff;
                color: white;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
            ">安装</button>
        </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // 绑定事件
    const urlInput = dialog.querySelector('#nm-git-url-input');
    const nameInput = dialog.querySelector('#nm-plugin-name-input');
    const cancelBtn = dialog.querySelector('#nm-git-cancel-btn');
    const installBtn = dialog.querySelector('#nm-git-install-btn');
    
    // 取消按钮
    cancelBtn.addEventListener('click', () => {
        overlay.remove();
    });
    
    // 点击overlay关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
    
    // ESC键关闭
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // 安装按钮
    installBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        const name = nameInput.value.trim();
        
        if (!url) {
            showToast('❌ 请输入Git URL', 'error');
            return;
        }
        
        if (!url.startsWith('http')) {
            showToast('❌ URL格式不正确', 'error');
            return;
        }
        
        // 显示加载状态
        installBtn.disabled = true;
        installBtn.textContent = '⏳ 安装中...';
        
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
            
            showToast(`✅ ${result.plugin_name} 安装成功！\n请重启ComfyUI以加载插件。`, 'success', 5000);
            overlay.remove();
            
            // 刷新插件列表
            window.dispatchEvent(new CustomEvent('nm:refreshPluginsList'));
            
        } catch (error) {
            console.error('[Git URL安装] 失败:', error);
            showToast(`❌ 安装失败：${error.message}`, 'error', 5000);
            installBtn.disabled = false;
            installBtn.textContent = '安装';
        }
    });
    
    // 自动聚焦到输入框
    setTimeout(() => urlInput.focus(), 100);
}

// 切换插件隐藏状态
async function togglePluginsHidden() {
    try {
        const pluginNames = Array.from(folderState.selectedPlugins);
        if (pluginNames.length === 0) return;
        
        const isHidden = folderState.config?.hiddenPlugins?.includes(pluginNames[0]);
        const action = isHidden ? 'show' : 'hide';
        
        const response = await fetch('/node-manager/plugin/toggle-hidden', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pluginNames, action })
        });
        
        const data = await response.json();
        if (data.success) {
            // 更新本地配置
            if (!folderState.config) folderState.config = {};
            folderState.config.hiddenPlugins = data.hiddenPlugins;
            
            // 重新加载插件列表
            await loadPluginsList();
            
            showToast(`已${isHidden ? '显示' : '隐藏'}${pluginNames.length}个插件`, 'success');
            clearPluginSelection();
        } else {
            throw new Error(data.error || '操作失败');
        }
    } catch (error) {
        console.error('切换插件隐藏状态失败:', error);
        showToast(`操作失败: ${error.message}`, 'error');
    }
}

// 切换显示隐藏的插件
async function toggleShowHidden() {
    try {
        const wasShowing = folderState.showHiddenPlugins;
        folderState.showHiddenPlugins = !folderState.showHiddenPlugins;
        
        console.log('[显示隐藏] 切换状态:', wasShowing, '->', folderState.showHiddenPlugins);
        
        const response = await fetch('/node-manager/plugin/toggle-show-hidden', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ showHidden: folderState.showHiddenPlugins })
        });
        
        const data = await response.json();
        console.log('[显示隐藏] 服务器响应:', data);
        
        if (data.success) {
            // 获取隐藏插件数量
            const hiddenCount = folderState.config?.hiddenPlugins?.length || 0;
            
            // 更新按钮状态
            const btn = document.getElementById('nm-toggle-hidden-btn');
            if (btn) {
                if (folderState.showHiddenPlugins) {
                    btn.classList.add('active');
                    btn.title = '隐藏已隐藏的插件';
                } else {
                    btn.classList.remove('active');
                    btn.title = '显示已隐藏的插件';
                }
            }
            
            // 重新加载插件列表
            await loadPluginsList();
            
            // 显示提示
            if (folderState.showHiddenPlugins) {
                if (hiddenCount > 0) {
                    showToast(`👁️ 显示 ${hiddenCount} 个已隐藏插件（灰色斜纹背景）`, 'info');
                } else {
                    showToast('当前没有隐藏的插件', 'info');
                }
            } else {
                showToast(`🙈 已隐藏 ${hiddenCount} 个插件`, 'info');
            }
        } else {
            throw new Error(data.error || '操作失败');
        }
    } catch (error) {
        console.error('切换显示隐藏插件失败:', error);
        showToast(`操作失败: ${error.message}`, 'error');
        // 回滚状态
        folderState.showHiddenPlugins = !folderState.showHiddenPlugins;
    }
}

// 更新特殊文件夹计数
function updateSpecialFolderCounts() {
    try {
        // 更新未分类计数
        const uncategorizedCountEl = document.getElementById('nm-uncategorized-count');
        if (uncategorizedCountEl && nodePoolState.allNodes.length > 0) {
            const count = getUncategorizedCount();
            uncategorizedCountEl.textContent = count;
        }
    } catch (err) {
        console.error('[文件夹UI] 更新特殊文件夹计数失败:', err);
    }
}

// 显示所有已分类的节点
function showAllCategorizedNodes() {
    console.log('[文件夹UI] 点击"我的分类"：显示所有已分类节点');
    
    // 清除所有选择状态
    clearSelection();
    clearPluginSelection();
    
    // 移除所有激活状态
    document.querySelectorAll('.nm-special-folder, .nm-plugin-item, .nm-folder-item, .nm-category-item').forEach(el => {
        el.classList.remove('active');
    });
    
    // 显示已分类节点
    try {
        // 获取所有在文件夹中的节点
        const nodesInFolders = new Set();
        if (folderState.config && folderState.config.folderNodes) {
            Object.values(folderState.config.folderNodes).forEach(nodeIds => {
                if (Array.isArray(nodeIds)) {
                    nodeIds.forEach(nodeId => nodesInFolders.add(nodeId));
                }
            });
        }
        
        // 过滤出已分类的节点
        const categorizedNodes = nodePoolState.allNodes.filter(node => 
            nodesInFolders.has(node.id)
        );
        
        renderNodePool(categorizedNodes);
        updateNodePoolHeader('📁 我的分类', categorizedNodes.length);
        
        showToast(`显示 ${categorizedNodes.length} 个已分类节点`, 'info');
    } catch (err) {
        console.error('[文件夹UI] 显示已分类节点失败:', err);
        showToast('显示失败', 'error');
    }
}

// 显示所有节点
function showAllNodes() {
    console.log('[文件夹UI] 点击"插件来源"：显示所有节点');
    
    // 清除所有选择状态
    clearSelection();
    clearPluginSelection();
    
    // 移除所有激活状态
    document.querySelectorAll('.nm-special-folder, .nm-plugin-item, .nm-folder-item, .nm-category-item').forEach(el => {
        el.classList.remove('active');
    });
    
    // 显示所有节点
    try {
        renderNodePool(nodePoolState.allNodes);
        updateNodePoolHeader('📦 所有节点', nodePoolState.allNodes.length);
        
        showToast(`显示全部 ${nodePoolState.allNodes.length} 个节点`, 'info');
    } catch (err) {
        console.error('[文件夹UI] 显示所有节点失败:', err);
        showToast('显示失败', 'error');
    }
}

// ========== 前缀管理功能 ==========

// 更新前缀工具栏
function updatePrefixToolbar() {
    const toolbar = document.getElementById('nm-prefix-toolbar');
    const toolbarText = document.getElementById('nm-prefix-toolbar-text');
    
    if (!toolbar || !toolbarText) return;
    
    const selectedCount = folderState.selectedPlugins.size;
    
    if (selectedCount > 1) {
        // 多选时显示工具栏
        toolbar.style.display = 'flex';
        toolbarText.textContent = `已选中 ${selectedCount} 个插件`;
    } else {
        // 单选或无选择时隐藏工具栏
        toolbar.style.display = 'none';
    }
}

// 显示加前缀对话框
async function showAddPrefixDialog() {
    const selectedPlugins = Array.from(folderState.selectedPlugins);
    
    if (selectedPlugins.length === 0) {
        showToast('请先选择插件', 'warning');
        return;
    }
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'nm-dialog-overlay';
    dialog.innerHTML = `
        <div class="nm-dialog">
            <div class="nm-dialog-header">
                <h3>添加前缀</h3>
                <button class="nm-dialog-close">&times;</button>
            </div>
            <div class="nm-dialog-body">
                <div class="nm-form-group">
                    <label>前缀内容：</label>
                    <input type="text" id="nm-prefix-input" class="nm-input" placeholder="例如: [MyPlugin] " />
                </div>
                <div class="nm-form-group">
                    <label>添加模式：</label>
                    <div class="nm-radio-group">
                        <label class="nm-radio-label">
                            <input type="radio" name="prefix-mode" value="replace" checked />
                            <span>替换原前缀（如果节点已有前缀，将其替换）</span>
                        </label>
                        <label class="nm-radio-label">
                            <input type="radio" name="prefix-mode" value="append" />
                            <span>叠加前缀（在已有前缀基础上追加）</span>
                        </label>
                    </div>
                </div>
                <div class="nm-form-group">
                    <p class="nm-hint">将为以下 ${selectedPlugins.length} 个插件的所有节点添加前缀：</p>
                    <div class="nm-plugin-list">${selectedPlugins.map(p => `<span class="nm-plugin-tag">${escapeHtml(p)}</span>`).join('')}</div>
                </div>
            </div>
            <div class="nm-dialog-footer">
                <button class="nm-btn-secondary" id="nm-prefix-cancel">取消</button>
                <button class="nm-btn-primary" id="nm-prefix-confirm">确定</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // 自动聚焦输入框
    const input = dialog.querySelector('#nm-prefix-input');
    input.focus();
    
    // 绑定事件
    const closeBtn = dialog.querySelector('.nm-dialog-close');
    const cancelBtn = dialog.querySelector('#nm-prefix-cancel');
    const confirmBtn = dialog.querySelector('#nm-prefix-confirm');
    
    const closeDialog = () => {
        dialog.remove();
    };
    
    closeBtn.addEventListener('click', closeDialog);
    cancelBtn.addEventListener('click', closeDialog);
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) closeDialog();
    });
    
    confirmBtn.addEventListener('click', async () => {
        const prefix = input.value.trim();
        
        if (!prefix) {
            showToast('请输入前缀内容', 'warning');
            return;
        }
        
        const mode = dialog.querySelector('input[name="prefix-mode"]:checked').value;
        
        await applyPrefix(selectedPlugins, prefix, mode);
        closeDialog();
    });
}

// 应用前缀
async function applyPrefix(pluginNames, prefix, mode) {
    try {
        showToast('正在应用前缀...', 'info');
        
        // 获取所有节点
        const response = await fetch('/node-manager/nodes');
        const data = await response.json();
        
        if (!data.success) {
            throw new Error('获取节点列表失败');
        }
        
        // 筛选出选中插件的节点
        const affectedNodes = data.nodes.filter(node => 
            pluginNames.some(pluginName => {
                // 尝试匹配插件名（包括 python_name）
                return node.source === pluginName || 
                       node.source.toLowerCase() === pluginName.toLowerCase() ||
                       node.source.replace(/-/g, '_') === pluginName.replace(/-/g, '_');
            })
        );
        
        // 构建自定义名称映射
        const customNames = {};
        
        affectedNodes.forEach(node => {
            const originalName = node.display_name || node.id;
            let newName;
            
            if (mode === 'replace') {
                // 替换模式：移除原有前缀（如果有）
                // 简单策略：如果名称中有方括号，移除第一个方括号及其内容
                const withoutOldPrefix = originalName.replace(/^\[.*?\]\s*/, '');
                newName = prefix + withoutOldPrefix;
            } else {
                // 叠加模式：直接在前面追加
                newName = prefix + originalName;
            }
            
            customNames[node.id] = newName;
        });
        
        // 保存到配置
        const saveResponse = await fetch('/node-manager/config/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nodeCustomNames: {
                    ...folderState.config.nodeCustomNames,
                    ...customNames
                }
            })
        });
        
        const saveResult = await saveResponse.json();
        
        if (!saveResult.success) {
            throw new Error('保存配置失败');
        }
        
        // 更新本地状态
        folderState.config.nodeCustomNames = {
            ...folderState.config.nodeCustomNames,
            ...customNames
        };
        
        showToast(`已为 ${affectedNodes.length} 个节点添加前缀`, 'success');
        
        // 刷新节点池显示
        window.dispatchEvent(new Event('nm:refreshNodePool'));
        
    } catch (error) {
        console.error('应用前缀失败:', error);
        showToast(`应用失败: ${error.message}`, 'error');
    }
}

// 移除前缀
async function removePrefix() {
    const selectedPlugins = Array.from(folderState.selectedPlugins);
    
    if (selectedPlugins.length === 0) {
        showToast('请先选择插件', 'warning');
        return;
    }
    
    // 确认对话框
    const confirmed = confirm(`确定要移除以下 ${selectedPlugins.length} 个插件的节点前缀吗？\n\n${selectedPlugins.join('\n')}`);
    
    if (!confirmed) return;
    
    try {
        showToast('正在移除前缀...', 'info');
        
        // 获取所有节点
        const response = await fetch('/node-manager/nodes');
        const data = await response.json();
        
        if (!data.success) {
            throw new Error('获取节点列表失败');
        }
        
        // 筛选出选中插件的节点
        const affectedNodeIds = data.nodes
            .filter(node => 
                selectedPlugins.some(pluginName => {
                    return node.source === pluginName || 
                           node.source.toLowerCase() === pluginName.toLowerCase() ||
                           node.source.replace(/-/g, '_') === pluginName.replace(/-/g, '_');
                })
            )
            .map(node => node.id);
        
        // 从配置中移除这些节点的自定义名称
        const newCustomNames = { ...folderState.config.nodeCustomNames };
        let removedCount = 0;
        
        affectedNodeIds.forEach(nodeId => {
            if (newCustomNames[nodeId]) {
                delete newCustomNames[nodeId];
                removedCount++;
            }
        });
        
        // 保存到配置
        const saveResponse = await fetch('/node-manager/config/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nodeCustomNames: newCustomNames
            })
        });
        
        const saveResult = await saveResponse.json();
        
        if (!saveResult.success) {
            throw new Error('保存配置失败');
        }
        
        // 更新本地状态
        folderState.config.nodeCustomNames = newCustomNames;
        
        showToast(`已移除 ${removedCount} 个节点的前缀`, 'success');
        
        // 刷新节点池显示
        window.dispatchEvent(new Event('nm:refreshNodePool'));
        
    } catch (error) {
        console.error('移除前缀失败:', error);
        showToast(`移除失败: ${error.message}`, 'error');
    }
}

// 显示检测缺失节点对话框
async function showMissingNodesDialog() {
    try {
        // 获取当前工作流
        const workflow = await getCurrentWorkflow();
        
        if (!workflow) {
            showToast('❌ 无法获取当前工作流', 'error', 3000);
            return;
        }
        
        // 显示加载提示
        showToast('🔍 正在检测缺失节点...', 'info', 2000);
        
        // 调用后端API检测缺失节点
        const response = await fetch('/node-manager/detect-missing-nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workflow })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            showToast(`❌ 检测失败：${result.error}`, 'error', 5000);
            return;
        }
        
        const missingNodes = result.missing_nodes || [];
        
        if (missingNodes.length === 0) {
            showToast('✅ 没有检测到缺失的节点！', 'success', 3000);
            return;
        }
        
        // 显示缺失节点对话框
        showMissingNodesDialogUI(missingNodes);
        
    } catch (error) {
        console.error('[检测缺失] 失败:', error);
        showToast(`❌ 检测失败：${error.message}`, 'error', 5000);
    }
}

// 获取当前工作流
async function getCurrentWorkflow() {
    try {
        // 尝试从app.graph获取工作流
        if (window.app && window.app.graph) {
            const workflow = window.app.graph.serialize();
            return workflow;
        }
        
        // 备选方案：从localStorage获取
        const savedWorkflow = localStorage.getItem('workflow');
        if (savedWorkflow) {
            return JSON.parse(savedWorkflow);
        }
        
        return null;
    } catch (error) {
        console.error('[获取工作流] 失败:', error);
        return null;
    }
}

// 显示缺失节点对话框UI
function showMissingNodesDialogUI(missingNodes) {
    // 移除已存在的对话框
    const existingDialog = document.querySelector('.nm-missing-nodes-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    // 创建遮罩
    const overlay = document.createElement('div');
    overlay.className = 'nm-missing-nodes-dialog';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    `;
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: var(--comfy-menu-bg, #2d2d2d);
        border-radius: 12px;
        padding: 24px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
    `;
    
    // 创建节点列表HTML
    const nodeListHTML = missingNodes.map((node, index) => {
        const pluginName = node.plugin_name || '未知插件';
        const nodeType = node.node_type || '未知节点';
        const githubUrl = node.github_url || '';
        const isInstallable = !!githubUrl;
        
        return `
            <div class="nm-missing-node-item" data-index="${index}" style="
                padding: 12px;
                border: 1px solid var(--border-color, #555);
                border-radius: 8px;
                margin-bottom: 8px;
                background: var(--comfy-input-bg, #222);
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
            ">
                <div style="flex: 1; min-width: 0;">
                    <div style="color: var(--input-text, #ddd); font-size: 14px; font-weight: 500; margin-bottom: 4px;">
                        ⚠️ ${escapeHtml(nodeType)}
                    </div>
                    <div style="color: var(--descrip-text, #999); font-size: 12px;">
                        来自插件: ${escapeHtml(pluginName)}
                    </div>
                    ${githubUrl ? `
                        <div style="color: var(--descrip-text, #999); font-size: 11px; margin-top: 2px; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${escapeHtml(githubUrl)}
                        </div>
                    ` : ''}
                </div>
                ${isInstallable ? `
                    <button class="nm-install-single-btn" data-index="${index}" style="
                        padding: 6px 12px;
                        border: none;
                        border-radius: 6px;
                        background: #4a9eff;
                        color: white;
                        font-size: 12px;
                        cursor: pointer;
                        white-space: nowrap;
                    ">📥 安装</button>
                ` : `
                    <span style="color: var(--error, #f88); font-size: 12px; white-space: nowrap;">
                        未知来源
                    </span>
                `}
            </div>
        `;
    }).join('');
    
    // 统计可安装的节点数量
    const installableCount = missingNodes.filter(n => n.github_url).length;
    
    dialog.innerHTML = `
        <div style="margin-bottom: 16px;">
            <h3 style="margin: 0 0 8px 0; color: var(--input-text, #ddd); font-size: 18px; display: flex; align-items: center; gap: 8px;">
                <span>🔍</span>
                <span>检测到 ${missingNodes.length} 个缺失节点</span>
            </h3>
            <div style="color: var(--descrip-text, #999); font-size: 13px;">
                ${installableCount > 0 ? `其中 ${installableCount} 个可以自动安装` : '无法自动安装这些节点'}
            </div>
        </div>
        
        <div style="
            flex: 1;
            overflow-y: auto;
            margin-bottom: 16px;
            padding-right: 8px;
        ">
            ${nodeListHTML}
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="nm-missing-cancel-btn" style="
                padding: 10px 20px;
                border: 1px solid var(--border-color, #555);
                border-radius: 6px;
                background: var(--comfy-input-bg, #222);
                color: var(--input-text, #ddd);
                font-size: 14px;
                cursor: pointer;
            ">关闭</button>
            ${installableCount > 0 ? `
                <button id="nm-install-all-btn" style="
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    background: #4a9eff;
                    color: white;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                ">📥 一键安装全部 (${installableCount})</button>
            ` : ''}
        </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // 绑定事件
    const cancelBtn = dialog.querySelector('#nm-missing-cancel-btn');
    const installAllBtn = dialog.querySelector('#nm-install-all-btn');
    const installSingleBtns = dialog.querySelectorAll('.nm-install-single-btn');
    
    // 关闭按钮
    cancelBtn.addEventListener('click', () => {
        overlay.remove();
    });
    
    // 点击overlay关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
    
    // ESC键关闭
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // 一键安装全部
    if (installAllBtn) {
        installAllBtn.addEventListener('click', async () => {
            const installableNodes = missingNodes.filter(n => n.github_url);
            await installMultiplePlugins(installAllBtn, installableNodes, overlay);
        });
    }
    
    // 分别安装
    installSingleBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            const node = missingNodes[index];
            await installSingleMissingPlugin(btn, node);
        });
    });
}

// 安装单个缺失的插件
async function installSingleMissingPlugin(button, node) {
    const url = node.github_url;
    const name = node.plugin_name;
    
    if (!url) {
        showToast('❌ 无效的插件URL', 'error');
        return;
    }
    
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ 安装中...';
    
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
        button.style.background = '#4caf50';
        showToast(`✅ ${name} 安装成功！`, 'success', 3000);
        
    } catch (error) {
        console.error('[安装插件] 失败:', error);
        showToast(`❌ ${name} 安装失败：${error.message}`, 'error', 5000);
        button.textContent = originalText;
        button.disabled = false;
    }
}

// 安装多个缺失的插件
async function installMultiplePlugins(button, nodes, overlay) {
    const originalText = button.textContent;
    button.disabled = true;
    
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        button.textContent = `⏳ 安装中... (${i + 1}/${nodes.length})`;
        
        try {
            const response = await fetch('/node-manager/store/install-plugin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: node.github_url,
                    name: node.plugin_name
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                successCount++;
                // 查找对应节点在原始数组中的索引
                const originalIndex = overlay.querySelectorAll('.nm-missing-node-item')[i];
                if (originalIndex) {
                    const singleBtn = originalIndex.querySelector('.nm-install-single-btn');
                    if (singleBtn) {
                        singleBtn.textContent = '✓ 已安装';
                        singleBtn.style.background = '#4caf50';
                        singleBtn.disabled = true;
                    }
                }
            } else {
                failedCount++;
            }
        } catch (error) {
            console.error(`[安装插件] ${node.plugin_name} 失败:`, error);
            failedCount++;
        }
        
        // 延迟一下，避免请求过快
        if (i < nodes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    button.textContent = `✓ 完成 (${successCount}/${nodes.length})`;
    
    if (successCount > 0) {
        showToast(`✅ 成功安装 ${successCount} 个插件${failedCount > 0 ? `，${failedCount} 个失败` : ''}\n\n请重启ComfyUI以加载插件。`, 'success', 8000);
    } else {
        showToast(`❌ 安装失败，请检查网络连接`, 'error', 5000);
    }
    
    // 3秒后自动关闭对话框
    setTimeout(() => {
        overlay.remove();
    }, 3000);
}

// 导出
export {
    createManagerInterface,
    bindEvents,
    renderFolders,
    createFolderItem,
    bindContentAreaDragEvents,
    updateSpecialFolderCounts,
    injectNodePoolDeps,
    showGitUrlInstallDialog,
    showMissingNodesDialog
};

