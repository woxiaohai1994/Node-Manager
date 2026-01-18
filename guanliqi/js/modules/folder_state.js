// js/folder_state.js
// 状态管理和工具函数

const PLUGIN_NAME = "XiaoHaiNodeManager";

// 文件夹管理状态
const folderState = {
    config: null,
    selectedFolders: new Set(),
    lastSelectedFolder: null,
    draggedFolder: null,
    expandedFolders: new Set(),
    isLoading: false,
    // 插件相关状态
    selectedPlugins: new Set(),  // 选中的插件名称
    lastSelectedPlugin: null,    // 最后选中的插件（用于 Shift 范围选择）
    showHiddenPlugins: false     // 是否显示隐藏的插件
};

// 显示提示消息
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `nm-toast nm-toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 触发动画
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 3秒后移除
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// 清除选择
function clearSelection() {
    folderState.selectedFolders.clear();
    folderState.lastSelectedFolder = null;
    document.querySelectorAll('.nm-folder-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
}

// 添加选择
function addSelection(folderId) {
    folderState.selectedFolders.add(folderId);
    folderState.lastSelectedFolder = folderId;
    const item = document.querySelector(`[data-folder-id="${folderId}"]`);
    if (item) item.classList.add('selected');
}

// 切换选择
function toggleSelection(folderId) {
    if (folderState.selectedFolders.has(folderId)) {
        folderState.selectedFolders.delete(folderId);
        const item = document.querySelector(`[data-folder-id="${folderId}"]`);
        if (item) item.classList.remove('selected');
        
        if (folderState.lastSelectedFolder === folderId) {
            folderState.lastSelectedFolder = folderState.selectedFolders.size > 0 ? 
                Array.from(folderState.selectedFolders).pop() : null;
        }
    } else {
        addSelection(folderId);
    }
}

// Shift多选（选择范围）
function selectRange(fromId, toId) {
    const allItems = Array.from(document.querySelectorAll('[data-folder-id]'));
    const fromIndex = allItems.findIndex(item => item.dataset.folderId === fromId);
    const toIndex = allItems.findIndex(item => item.dataset.folderId === toId);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);
    
    clearSelection();
    
    for (let i = startIndex; i <= endIndex; i++) {
        const folderId = allItems[i].dataset.folderId;
        if (folderId) {
            folderState.selectedFolders.add(folderId);
            allItems[i].classList.add('selected');
        }
    }
    
    folderState.lastSelectedFolder = toId;
}

// ========== 插件选择相关函数 ==========

// 清除插件选择
function clearPluginSelection() {
    folderState.selectedPlugins.clear();
    folderState.lastSelectedPlugin = null;
    document.querySelectorAll('.nm-plugin-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
}

// 添加插件选择
function addPluginSelection(pluginName) {
    folderState.selectedPlugins.add(pluginName);
    folderState.lastSelectedPlugin = pluginName;
    
    console.log('[插件选择] 添加选择:', pluginName);
    const item = document.querySelector(`.nm-plugin-item[data-plugin-name="${pluginName}"]`);
    console.log('[插件选择] 找到元素:', item);
    
    if (item) {
        item.classList.add('selected');
        console.log('[插件选择] 已添加selected类，当前类名:', item.className);
    } else {
        console.warn('[插件选择] 未找到元素，插件名:', pluginName);
        // 尝试查找所有插件项
        const allItems = document.querySelectorAll('.nm-plugin-item');
        console.log('[插件选择] 所有插件项:', Array.from(allItems).map(i => i.dataset.pluginName));
    }
}

// 切换插件选择
function togglePluginSelection(pluginName) {
    if (folderState.selectedPlugins.has(pluginName)) {
        folderState.selectedPlugins.delete(pluginName);
        const item = document.querySelector(`.nm-plugin-item[data-plugin-name="${pluginName}"]`);
        if (item) item.classList.remove('selected');
        
        if (folderState.lastSelectedPlugin === pluginName) {
            folderState.lastSelectedPlugin = folderState.selectedPlugins.size > 0 ? 
                Array.from(folderState.selectedPlugins).pop() : null;
        }
    } else {
        addPluginSelection(pluginName);
    }
}

// Shift多选插件（选择范围）
function selectPluginRange(fromName, toName) {
    const allItems = Array.from(document.querySelectorAll('.nm-plugin-item[data-plugin-name]'));
    const fromIndex = allItems.findIndex(item => item.dataset.pluginName === fromName);
    const toIndex = allItems.findIndex(item => item.dataset.pluginName === toName);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);
    
    clearPluginSelection();
    
    for (let i = startIndex; i <= endIndex; i++) {
        const pluginName = allItems[i].dataset.pluginName;
        if (pluginName) {
            folderState.selectedPlugins.add(pluginName);
            allItems[i].classList.add('selected');
        }
    }
    
    folderState.lastSelectedPlugin = toName;
}

// 处理插件选择逻辑（支持Ctrl、Shift多选）
function handlePluginSelection(pluginName, event) {
    console.log('[插件选择] handlePluginSelection 被调用:', {
        pluginName,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey
    });
    
    if (event.shiftKey && folderState.lastSelectedPlugin) {
        // Shift多选：选择范围
        console.log('[插件选择] Shift多选模式');
        selectPluginRange(folderState.lastSelectedPlugin, pluginName);
    } else if (event.ctrlKey || event.metaKey) {
        // Ctrl多选：切换选择
        console.log('[插件选择] Ctrl多选模式');
        togglePluginSelection(pluginName);
    } else {
        // 普通单选：清除其他选择
        console.log('[插件选择] 单选模式');
        clearPluginSelection();
        addPluginSelection(pluginName);
    }
    
    // 触发选择变化事件
    window.dispatchEvent(new CustomEvent('nm:pluginSelectionChanged', {
        detail: { selectedCount: folderState.selectedPlugins.size }
    }));
}

// ========== 文件夹选择相关函数 ==========

// 处理选择逻辑（支持Ctrl、Shift多选）
function handleFolderSelection(folderId, event) {
    if (event.shiftKey && folderState.lastSelectedFolder) {
        // Shift多选：选择范围
        selectRange(folderState.lastSelectedFolder, folderId);
    } else if (event.ctrlKey || event.metaKey) {
        // Ctrl多选：切换选择
        toggleSelection(folderId);
    } else {
        // 单选：清除其他选择，选择当前项
        clearSelection();
        addSelection(folderId);
    }
}

// 全选
function selectAll() {
    const allItems = document.querySelectorAll('[data-folder-id]');
    clearSelection();
    
    allItems.forEach(item => {
        const folderId = item.dataset.folderId;
        if (folderId) {
            folderState.selectedFolders.add(folderId);
            item.classList.add('selected');
        }
    });
    
    showToast(`已选择 ${allItems.length} 个文件夹`);
}

// 获取文件夹层级树结构
function buildFolderTree(folders) {
    const tree = [];
    const folderMap = {};
    
    // 创建文件夹映射
    Object.entries(folders).forEach(([id, folder]) => {
        folderMap[id] = {
            id,
            ...folder,
            children: []
        };
    });
    
    // 构建树结构
    Object.values(folderMap).forEach(folder => {
        if (folder.parent) {
            const parent = folderMap[folder.parent];
            if (parent) {
                parent.children.push(folder);
            }
        } else {
            tree.push(folder);
        }
    });
    
    // 排序
    const sortFolders = (folders) => {
        folders.sort((a, b) => (a.order || 0) - (b.order || 0));
        folders.forEach(folder => {
            if (folder.children.length > 0) {
                sortFolders(folder.children);
            }
        });
    };
    
    sortFolders(tree);
    
    return tree;
}

// 检查文件夹是否有子文件夹
function hasChildren(folderId, folders) {
    return Object.values(folders).some(f => f.parent === folderId);
}

// 获取所有子文件夹ID（递归）
function getAllChildrenIds(folderId, folders) {
    const children = [folderId];
    Object.entries(folders).forEach(([id, folder]) => {
        if (folder.parent === folderId) {
            children.push(...getAllChildrenIds(id, folders));
        }
    });
    return children;
}

// 计算拖拽目标位置
function calculateDropTarget(dragY, targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const middle = rect.top + rect.height / 2;
    
    // 判断是插入到目标上方、下方还是成为子文件夹
    if (dragY < rect.top + rect.height * 0.25) {
        return { type: 'before', element: targetElement };
    } else if (dragY > rect.top + rect.height * 0.75) {
        return { type: 'after', element: targetElement };
    } else {
        return { type: 'inside', element: targetElement };
    }
}

// 显示加载状态
function showLoading(show = true) {
    folderState.isLoading = show;
    const loadingEl = document.querySelector('.nm-loading');
    if (loadingEl) {
        loadingEl.style.display = show ? 'flex' : 'none';
    }
}

// 导出
export {
    PLUGIN_NAME,
    folderState,
    showToast,
    clearSelection,
    addSelection,
    toggleSelection,
    selectRange,
    handleFolderSelection,
    selectAll,
    buildFolderTree,
    hasChildren,
    getAllChildrenIds,
    calculateDropTarget,
    showLoading,
    // 插件选择相关
    clearPluginSelection,
    addPluginSelection,
    togglePluginSelection,
    selectPluginRange,
    handlePluginSelection
};

