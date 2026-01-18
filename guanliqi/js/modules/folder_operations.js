// js/folder_operations.js
// 文件夹操作：CRUD、拖拽等

import { api } from "../../../scripts/api.js";
import { 
    folderState, 
    showToast, 
    showLoading,
    calculateDropTarget
} from './folder_state.js';
import { renderFolders } from './folder_ui.js';

// API调用封装
const FolderAPI = {
    async getConfig() {
        const response = await api.fetchApi('/node-manager/config');
        return await response.json();
    },
    
    async saveConfig(config) {
        const response = await api.fetchApi('/node-manager/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config })
        });
        return await response.json();
    },
    
    async createFolder(name, parent = null) {
        const response = await api.fetchApi('/node-manager/folder/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, parent })
        });
        return await response.json();
    },
    
    async renameFolder(id, name) {
        const response = await api.fetchApi('/node-manager/folder/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name })
        });
        return await response.json();
    },
    
    async deleteFolders(ids) {
        const response = await api.fetchApi('/node-manager/folder/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        return await response.json();
    },
    
    async moveFolder(id, target_parent, target_order) {
        const response = await api.fetchApi('/node-manager/folder/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, target_parent, target_order })
        });
        return await response.json();
    },
    
    async toggleFolder(id) {
        const response = await api.fetchApi('/node-manager/folder/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        return await response.json();
    }
};

// 加载配置
async function loadConfig() {
    try {
        showLoading(true);
        const result = await FolderAPI.getConfig();
        
        if (result.success) {
            folderState.config = result.config;
            
            console.log('[配置] 加载的配置:', result.config);
            console.log('[配置] showHiddenPlugins原始值:', result.config.showHiddenPlugins);
            console.log('[配置] hiddenPlugins列表:', result.config.hiddenPlugins);
            
            // 从配置中恢复 showHiddenPlugins 状态（确保有默认值）
            folderState.showHiddenPlugins = result.config.showHiddenPlugins === true;
            
            console.log('[配置] 设置后的showHiddenPlugins:', folderState.showHiddenPlugins);
            console.log('[配置] hiddenPlugins数量:', result.config.hiddenPlugins?.length || 0);
            
            // 更新"显示隐藏"按钮状态
            const toggleHiddenBtn = document.getElementById('nm-toggle-hidden-btn');
            if (toggleHiddenBtn) {
                if (folderState.showHiddenPlugins) {
                    toggleHiddenBtn.classList.add('active');
                    toggleHiddenBtn.title = '隐藏已隐藏的插件';
                    console.log('[配置] 按钮设置为active状态');
                } else {
                    toggleHiddenBtn.classList.remove('active');
                    toggleHiddenBtn.title = '显示已隐藏的插件';
                    console.log('[配置] 按钮设置为非active状态');
                }
            } else {
                console.warn('[配置] 未找到显示隐藏按钮');
            }
            
            renderFolders();
            
            window.dispatchEvent(new CustomEvent('nm:configLoaded', {
                detail: {
                    config: folderState.config
                }
            }));
        } else {
            showToast('加载配置失败: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('加载配置失败:', error);
        showToast('加载配置失败', 'error');
    } finally {
        showLoading(false);
    }
}

// 保存配置
async function saveConfig() {
    try {
        if (!folderState.config) {
            console.error('没有配置数据');
            return false;
        }
        
        const result = await FolderAPI.saveConfig(folderState.config);
        
        if (result.success) {
            return true;
        } else {
            showToast('保存配置失败: ' + result.error, 'error');
            return false;
        }
    } catch (error) {
        console.error('保存配置失败:', error);
        showToast('保存配置失败', 'error');
        return false;
    }
}

// 创建文件夹对话框
function showCreateFolderDialog(parentId = null) {
    const dialog = document.createElement('div');
    dialog.className = 'nm-dialog-overlay';
    
    const parentName = parentId && folderState.config?.folders[parentId] 
        ? folderState.config.folders[parentId].name 
        : '根目录';
    
    dialog.innerHTML = `
        <div class="nm-dialog">
            <div class="nm-dialog-header">
                <div class="nm-dialog-title">新建文件夹</div>
            </div>
            <div class="nm-dialog-body">
                <label class="nm-label">文件夹名称</label>
                <input type="text" class="nm-input" id="nm-folder-name-input" placeholder="输入文件夹名称" />
                <div style="margin-top: 12px; font-size: 12px; color: var(--descrip-text, #999);">
                    父文件夹: ${parentName}
                </div>
            </div>
            <div class="nm-dialog-footer">
                <button class="nm-btn" id="nm-dialog-cancel">取消</button>
                <button class="nm-btn primary" id="nm-dialog-confirm">创建</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    const input = dialog.querySelector('#nm-folder-name-input');
    const cancelBtn = dialog.querySelector('#nm-dialog-cancel');
    const confirmBtn = dialog.querySelector('#nm-dialog-confirm');
    
    // 聚焦输入框
    setTimeout(() => input.focus(), 100);
    
    // 取消
    const close = () => {
        document.body.removeChild(dialog);
    };
    
    cancelBtn.onclick = close;
    
    // 点击遮罩关闭
    dialog.onclick = (e) => {
        if (e.target === dialog) close();
    };
    
    // 确认创建
    const create = async () => {
        const name = input.value.trim();
        
        if (!name) {
            showToast('请输入文件夹名称', 'warning');
            input.focus();
            return;
        }
        
        try {
            const result = await FolderAPI.createFolder(name, parentId);
            
            if (result.success) {
                showToast('文件夹创建成功', 'success');
                await loadConfig();
                close();
            } else {
                showToast('创建失败: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('创建文件夹失败:', error);
            showToast('创建失败', 'error');
        }
    };
    
    confirmBtn.onclick = create;
    
    // 回车创建
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            create();
        } else if (e.key === 'Escape') {
            close();
        }
    };
}

// 重命名文件夹对话框
function showRenameFolderDialog(folderId) {
    if (!folderState.config || !folderState.config.folders[folderId]) {
        showToast('文件夹不存在', 'error');
        return;
    }
    
    const folder = folderState.config.folders[folderId];
    
    const dialog = document.createElement('div');
    dialog.className = 'nm-dialog-overlay';
    
    dialog.innerHTML = `
        <div class="nm-dialog">
            <div class="nm-dialog-header">
                <div class="nm-dialog-title">重命名文件夹</div>
            </div>
            <div class="nm-dialog-body">
                <label class="nm-label">文件夹名称</label>
                <input type="text" class="nm-input" id="nm-folder-name-input" value="${folder.name}" />
            </div>
            <div class="nm-dialog-footer">
                <button class="nm-btn" id="nm-dialog-cancel">取消</button>
                <button class="nm-btn primary" id="nm-dialog-confirm">确定</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    const input = dialog.querySelector('#nm-folder-name-input');
    const cancelBtn = dialog.querySelector('#nm-dialog-cancel');
    const confirmBtn = dialog.querySelector('#nm-dialog-confirm');
    
    // 聚焦输入框并选中文本
    setTimeout(() => {
        input.focus();
        input.select();
    }, 100);
    
    // 取消
    const close = () => {
        document.body.removeChild(dialog);
    };
    
    cancelBtn.onclick = close;
    
    // 点击遮罩关闭
    dialog.onclick = (e) => {
        if (e.target === dialog) close();
    };
    
    // 确认重命名
    const rename = async () => {
        const name = input.value.trim();
        
        if (!name) {
            showToast('请输入文件夹名称', 'warning');
            input.focus();
            return;
        }
        
        if (name === folder.name) {
            close();
            return;
        }
        
        try {
            const result = await FolderAPI.renameFolder(folderId, name);
            
            if (result.success) {
                showToast('重命名成功', 'success');
                await loadConfig();
                close();
            } else {
                showToast('重命名失败: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('重命名失败:', error);
            showToast('重命名失败', 'error');
        }
    };
    
    confirmBtn.onclick = rename;
    
    // 回车重命名
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            rename();
        } else if (e.key === 'Escape') {
            close();
        }
    };
}

// 删除文件夹
async function deleteFolders(folderIds) {
    if (!folderIds || folderIds.length === 0) return;
    
    const confirmMsg = folderIds.length === 1
        ? `确定要删除文件夹"${folderState.config.folders[folderIds[0]]?.name}"吗？\n\n此操作将同时删除所有子文件夹。`
        : `确定要删除选中的 ${folderIds.length} 个文件夹吗？\n\n此操作将同时删除所有子文件夹。`;
    
    if (!confirm(confirmMsg)) return;
    
    try {
        const result = await FolderAPI.deleteFolders(folderIds);
        
        if (result.success) {
            showToast(result.message || '删除成功', 'success');
            folderState.selectedFolders.clear();
            window.dispatchEvent(new Event('nm:selectionChanged'));
            await loadConfig();
        } else {
            showToast('删除失败: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('删除失败:', error);
        showToast('删除失败', 'error');
    }
}

// 切换文件夹展开/折叠
async function toggleFolder(folderId) {
    try {
        const result = await FolderAPI.toggleFolder(folderId);
        
        if (result.success) {
            // 更新本地状态
            if (folderState.config?.folders[folderId]) {
                folderState.config.folders[folderId].expanded = result.expanded;
            }
            renderFolders();
        }
    } catch (error) {
        console.error('切换文件夹状态失败:', error);
    }
}

// ========== 拖拽相关 ==========

let dragState = {
    draggedId: null,
    targetId: null,
    dropPosition: null,  // 'before', 'after', 'inside'
    lastMouseY: 0
};

function handleDragStart(folderId, event) {
    dragState.draggedId = folderId;
    
    const item = document.querySelector(`[data-folder-id="${folderId}"]`);
    if (item) {
        item.classList.add('dragging');
    }
    
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', folderId);
}

// 根据Y轴坐标找到最近的文件夹和插入位置
function findDropTarget(mouseY) {
    const allItems = Array.from(document.querySelectorAll('.nm-folder-item:not(.dragging)'));
    
    if (allItems.length === 0) return null;
    
    // 计算每个文件夹的位置信息和三个触发区域
    const itemsInfo = allItems.map(item => {
        const rect = item.getBoundingClientRect();
        const height = rect.height;
        const threshold = height * 0.3; // 30%的区域
        
        return {
            id: item.dataset.folderId,
            element: item,
            top: rect.top,
            bottom: rect.bottom,
            height: height,
            // 三个触发区域
            topZone: { start: rect.top, end: rect.top + threshold },
            middleZone: { start: rect.top + threshold, end: rect.bottom - threshold },
            bottomZone: { start: rect.bottom - threshold, end: rect.bottom }
        };
    });
    
    // 第一步：检查鼠标是否重叠任何文件夹的区域
    for (const info of itemsInfo) {
        // 检查是否在上部区域（插入到前面）
        if (mouseY >= info.topZone.start && mouseY <= info.topZone.end) {
            return {
                id: info.id,
                element: info.element,
                position: 'before'
            };
        }
        
        // 检查是否在中间区域（成为子文件夹）
        if (mouseY >= info.middleZone.start && mouseY <= info.middleZone.end) {
            return {
                id: info.id,
                element: info.element,
                position: 'inside'
            };
        }
        
        // 检查是否在底部区域（插入到后面）
        if (mouseY >= info.bottomZone.start && mouseY <= info.bottomZone.end) {
            return {
                id: info.id,
                element: info.element,
                position: 'after'
            };
        }
    }
    
    // 第二步：没有重叠，根据距离和位置关系判断
    itemsInfo.sort((a, b) => a.top - b.top);
    
    const firstItem = itemsInfo[0];
    const lastItem = itemsInfo[itemsInfo.length - 1];
    
    // 在第一个文件夹上方
    if (mouseY < firstItem.top) {
        return {
            id: firstItem.id,
            element: firstItem.element,
            position: 'before'
        };
    }
    
    // 在最后一个文件夹下方
    if (mouseY > lastItem.bottom) {
        return {
            id: lastItem.id,
            element: lastItem.element,
            position: 'after'
        };
    }
    
    // 在两个文件夹之间，找距离最近的边缘
    let closestItem = null;
    let closestPosition = null;
    let minDistance = Infinity;
    
    for (const info of itemsInfo) {
        // 计算到顶部和底部的距离
        const distToTop = Math.abs(info.top - mouseY);
        const distToBottom = Math.abs(info.bottom - mouseY);
        
        // 选择更近的边缘
        if (distToTop < minDistance) {
            minDistance = distToTop;
            closestItem = info;
            closestPosition = 'before';
        }
        
        if (distToBottom < minDistance) {
            minDistance = distToBottom;
            closestItem = info;
            closestPosition = 'after';
        }
    }
    
    if (closestItem) {
        return {
            id: closestItem.id,
            element: closestItem.element,
            position: closestPosition
        };
    }
    
    return null;
}

function handleDragOver(folderId, event) {
    event.preventDefault();
    event.stopPropagation();
    
    const draggedId = dragState.draggedId;
    if (!draggedId) {
        event.dataTransfer.dropEffect = 'none';
        return;
    }
    
    const mouseY = event.clientY;
    dragState.lastMouseY = mouseY;
    
    // 检查是否拖到自己的子文件夹
    const folders = folderState.config?.folders;
    if (!folders) return;
    
    const isDescendant = (parentId, childId) => {
        if (parentId === childId) return true;
        for (const [id, folder] of Object.entries(folders)) {
            if (folder.parent === parentId && isDescendant(id, childId)) {
                return true;
            }
        }
        return false;
    };
    
    // 清除之前的高亮
    document.querySelectorAll('.nm-folder-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-inside');
    });
    
    // 根据Y轴坐标找到目标位置
    const dropTarget = findDropTarget(mouseY);
    
    if (!dropTarget) {
        console.log('[拖拽被拒绝] 原因: 没有找到目标');
        event.dataTransfer.dropEffect = 'none';
        return;
    }
    
    console.log('[拖拽检查] 拖动:', draggedId, '→ 目标:', dropTarget.id, 'position:', dropTarget.position);
    
    // 检查是否拖到自己的子孙文件夹
    if (isDescendant(draggedId, dropTarget.id)) {
        console.log('[拖拽被拒绝] 原因: 不能拖到自己的子文件夹');
        event.dataTransfer.dropEffect = 'none';
        return;
    }
    
    // 检查层级限制（如果是inside操作）
    if (dropTarget.position === 'inside') {
        const targetFolder = folders[dropTarget.id];
        const targetLevel = targetFolder?.level || 1;
        if (targetLevel >= 3) {
            console.log('[拖拽被拒绝] 原因: 目标文件夹已是3级，不能再添加子文件夹');
            event.dataTransfer.dropEffect = 'none';
            return;
        }
    }
    
    console.log('[拖拽允许] ✓');
    event.dataTransfer.dropEffect = 'move';
    
    // 保存目标信息
    dragState.targetId = dropTarget.id;
    dragState.dropPosition = dropTarget.position;
    
    // 显示视觉反馈
    if (dropTarget.position === 'before') {
        dropTarget.element.classList.add('drag-over-top');
    } else if (dropTarget.position === 'after') {
        dropTarget.element.classList.add('drag-over-bottom');
    } else {
        dropTarget.element.classList.add('drag-over-inside');
    }
}

function handleDragLeave(folderId, event) {
    const item = document.querySelector(`[data-folder-id="${folderId}"]`);
    if (item && !item.contains(event.relatedTarget)) {
        item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-inside');
    }
}

async function handleDrop(folderId, event) {
    event.preventDefault();
    event.stopPropagation();
    
    const draggedId = dragState.draggedId;
    const targetId = dragState.targetId;
    const position = dragState.dropPosition;
    
    if (!draggedId || !targetId || !position) return;
    
    try {
        const folders = folderState.config?.folders;
        if (!folders) return;
        
        const draggedFolder = folders[draggedId];
        const targetFolder = folders[targetId];
        
        if (!draggedFolder || !targetFolder) return;
        
        let target_parent = null;
        let target_order = 0;
        
        if (position === 'inside') {
            // 放入目标文件夹
            target_parent = targetId;
            
            // 检查层级限制
            const targetLevel = targetFolder.level || 1;
            if (targetLevel >= 3) {
                showToast('最多支持3级文件夹', 'warning');
                return;
            }
            
            // 计算order（放到最后）
            const siblings = Object.values(folders).filter(f => f.parent === targetId);
            target_order = siblings.length;
        } else {
            // 插入到目标前后
            target_parent = targetFolder.parent;
            
            // 获取同级文件夹
            const siblings = Object.entries(folders)
                .filter(([id, f]) => f.parent === target_parent && id !== draggedId)
                .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
            
            // 计算目标位置
            const targetIndex = siblings.findIndex(([id]) => id === targetId);
            target_order = position === 'before' ? targetIndex : targetIndex + 1;
        }
        
        const result = await FolderAPI.moveFolder(draggedId, target_parent, target_order);
        
        if (result.success) {
            showToast('移动成功', 'success');
            await loadConfig();
        } else {
            showToast('移动失败: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('移动失败:', error);
        showToast('移动失败', 'error');
    }
}

function handleDragEnd(event) {
    // 清理拖拽状态
    if (dragState.draggedId) {
        const item = document.querySelector(`[data-folder-id="${dragState.draggedId}"]`);
        if (item) {
            item.classList.remove('dragging');
        }
    }
    
    // 清除所有拖拽高亮样式
    document.querySelectorAll('.nm-folder-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-inside');
    });
    
    dragState = {
        draggedId: null,
        targetId: null,
        dropPosition: null,
        lastMouseY: 0
    };
}

// 初始化事件监听
function initializeEventListeners() {
    // 创建文件夹
    window.addEventListener('nm:createFolder', (e) => {
        showCreateFolderDialog(e.detail.parent);
    });
    
    // 重命名文件夹
    window.addEventListener('nm:renameFolder', (e) => {
        showRenameFolderDialog(e.detail.folderId);
    });
    
    // 删除文件夹
    window.addEventListener('nm:deleteFolders', (e) => {
        deleteFolders(e.detail.folderIds);
    });
    
    // 切换展开/折叠
    window.addEventListener('nm:toggleFolder', (e) => {
        toggleFolder(e.detail.folderId);
    });
    
    // 拖拽事件
    window.addEventListener('nm:dragStart', (e) => {
        handleDragStart(e.detail.folderId, e.detail.event);
    });
    
    window.addEventListener('nm:dragOver', (e) => {
        handleDragOver(e.detail.folderId, e.detail.event);
    });
    
    window.addEventListener('nm:dragLeave', (e) => {
        handleDragLeave(e.detail.folderId, e.detail.event);
    });
    
    window.addEventListener('nm:drop', (e) => {
        handleDrop(e.detail.folderId, e.detail.event);
    });
    
    window.addEventListener('nm:dragEnd', (e) => {
        handleDragEnd(e.detail.event);
    });
}

/**
 * 获取配置（用于其他模块）
 */
function getConfig() {
    return folderState.config || {};
}

// 导出
export {
    loadConfig,
    saveConfig,
    getConfig,
    initializeEventListeners,
    showCreateFolderDialog,
    showRenameFolderDialog,
    deleteFolders,
    toggleFolder
};

