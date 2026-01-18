// js/node_events.js
// 节点和文件夹之间的事件连接

import { showToast, folderState } from './folder_state.js';

// 节点池和UI函数 - 通过参数注入避免循环依赖
let showNodesByPlugin, showNodesByFolder, showFavoriteNodes, showNodesByCategory, showUncategorizedNodes, showHiddenPlugins, restoreSelectedPlugins, updateSpecialFoldersCount, nodePoolState, renderNodePool;
let saveConfig, renderFolders;

/**
 * 初始化节点相关事件监听
 */
function initNodeEvents(deps) {
    // 注入依赖
    if (deps) {
        showNodesByPlugin = deps.showNodesByPlugin;
        showNodesByFolder = deps.showNodesByFolder;
        showFavoriteNodes = deps.showFavoriteNodes;
        showNodesByCategory = deps.showNodesByCategory;
        showUncategorizedNodes = deps.showUncategorizedNodes;
        showHiddenPlugins = deps.showHiddenPlugins;
        restoreSelectedPlugins = deps.restoreSelectedPlugins;
        updateSpecialFoldersCount = deps.updateSpecialFoldersCount;
        nodePoolState = deps.nodePoolState;
        renderNodePool = deps.renderNodePool;
        saveConfig = deps.saveConfig;
        renderFolders = deps.renderFolders;
    }
    
    // 监听显示插件节点
    window.addEventListener('nm:showPluginNodes', (e) => {
        const { pluginName, displayName, from } = e.detail;
        console.log('[节点事件] 显示插件节点:', pluginName, '显示名:', displayName, '来源:', from);
        showNodesByPlugin(pluginName, displayName, from);
    });
    
    // 监听显示分类节点
    window.addEventListener('nm:showCategoryNodes', (e) => {
        const { pluginName, category, displayName, nodeIds } = e.detail;
        console.log('[节点事件] 显示分类节点:', pluginName, category);
        showNodesByCategory(pluginName, category, displayName, nodeIds);
    });
    
    // 监听显示文件夹节点
    window.addEventListener('nm:showFolderNodes', (e) => {
        const { folderId } = e.detail;
        console.log('[节点事件] 显示文件夹节点:', folderId);
        showNodesByFolder(folderId);
    });
    
    // 监听显示特殊节点（收藏、未分类、已隐藏）
    window.addEventListener('nm:showSpecialNodes', (e) => {
        const { type } = e.detail;
        console.log('[节点事件] 显示特殊节点:', type);
        
        if (type === 'favorites') {
            showFavoriteNodes();
        } else if (type === 'uncategorized') {
            showUncategorizedNodes();
        } else if (type === 'hidden') {
            showHiddenPlugins();
        }
    });
    
    // 监听保存配置请求
    window.addEventListener('nm:saveConfig', async () => {
        console.log('[节点事件] 保存配置请求');
        // 触发配置保存
        await saveConfig();
    });
    
    // 监听节点添加到文件夹（单个）
    window.addEventListener('nm:addNodeToFolder', async (e) => {
        const { nodeId, nodeType, folderId } = e.detail;
        console.log('[节点事件] 添加节点到文件夹:', { nodeId, nodeType, folderId });
        
        // 确保配置中有 folderNodes 对象
        if (!folderState.config.folderNodes) {
            folderState.config.folderNodes = {};
        }
        
        // 确保该文件夹有节点数组
        if (!folderState.config.folderNodes[folderId]) {
            folderState.config.folderNodes[folderId] = [];
        }
        
        // 检查节点是否已经在文件夹中
        if (!folderState.config.folderNodes[folderId].includes(nodeId)) {
            folderState.config.folderNodes[folderId].push(nodeId);
            
            // 保存配置
            const success = await saveConfig();
            
            if (success) {
                showToast(`节点已添加到文件夹`, 'success');
                
                // 更新UI计数
                updateSpecialFoldersCount();
                
                // 重新渲染文件夹列表以更新数字
                renderFolders();
            } else {
                // 回滚
                const index = folderState.config.folderNodes[folderId].indexOf(nodeId);
                if (index > -1) {
                    folderState.config.folderNodes[folderId].splice(index, 1);
                }
                showToast('添加失败', 'error');
            }
        } else {
            showToast('节点已在该文件夹中', 'info');
        }
    });
    
    // 监听批量添加节点到文件夹
    window.addEventListener('nm:addNodesToFolder', async (e) => {
        const { nodeIds, folderId } = e.detail;
        console.log(`[节点事件] 批量添加${nodeIds.length}个节点到文件夹:`, folderId);
        
        // 确保配置中有 folderNodes 对象
        if (!folderState.config.folderNodes) {
            folderState.config.folderNodes = {};
        }
        
        // 确保该文件夹有节点数组
        if (!folderState.config.folderNodes[folderId]) {
            folderState.config.folderNodes[folderId] = [];
        }
        
        // 批量添加节点
        let addedCount = 0;
        let skippedCount = 0;
        
        nodeIds.forEach(nodeId => {
            if (!folderState.config.folderNodes[folderId].includes(nodeId)) {
                folderState.config.folderNodes[folderId].push(nodeId);
                addedCount++;
            } else {
                skippedCount++;
            }
        });
        
        // 保存配置
        if (addedCount > 0) {
            const success = await saveConfig();
            
            if (success) {
                let message = `✅ 已添加${addedCount}个节点到文件夹`;
                if (skippedCount > 0) {
                    message += `（${skippedCount}个已存在）`;
                }
                showToast(message, 'success');
                
                // 更新UI计数
                updateSpecialFoldersCount();
                
                // 重新渲染文件夹列表以更新数字
                renderFolders();
            } else {
                showToast('批量添加失败', 'error');
            }
        } else {
            showToast(`所有节点已在该文件夹中`, 'info');
        }
    });
    
    // 监听单个节点收藏（拖放到收藏夹）
    window.addEventListener('nm:favoriteNode', async (e) => {
        const { nodeId } = e.detail;
        console.log('[节点事件] 添加节点到收藏:', nodeId);
        
        const { nodePoolState, saveUserData, updateSpecialFoldersCount, showToast } = await import('./node_pool.js');
        
        if (!nodePoolState.favorites.has(nodeId)) {
            nodePoolState.favorites.add(nodeId);
            
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
            
            await saveUserData();
            updateSpecialFoldersCount();
            showToast('✅ 已添加到收藏', 'success');
        } else {
            showToast('节点已在收藏中', 'info');
        }
    });
    
    // 监听批量收藏（拖放到收藏夹）
    window.addEventListener('nm:batchFavorite', async (e) => {
        const { nodeIds } = e.detail;
        console.log(`[节点事件] 批量添加${nodeIds.length}个节点到收藏`);
        
        const { nodePoolState, saveUserData, updateSpecialFoldersCount, showToast } = await import('./node_pool.js');
        
        let addedCount = 0;
        let skippedCount = 0;
        
        nodeIds.forEach(nodeId => {
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
            } else {
                skippedCount++;
            }
        });
        
        if (addedCount > 0) {
            await saveUserData();
            updateSpecialFoldersCount();
            
            let message = `✅ 已批量收藏${addedCount}个节点`;
            if (skippedCount > 0) {
                message += `（${skippedCount}个已存在）`;
            }
            showToast(message, 'success');
        } else {
            showToast('所有节点均已收藏', 'info');
        }
    });
    
    // 监听批量从文件夹移除节点
    window.addEventListener('nm:removeNodesFromFolder', async (e) => {
        const { nodeIds, folderId } = e.detail;
        console.log(`[节点事件] 批量从文件夹移除${nodeIds.length}个节点:`, folderId);
        
        // 确保配置中有 folderNodes 对象
        if (!folderState.config.folderNodes || !folderState.config.folderNodes[folderId]) {
            showToast('文件夹不存在', 'error');
            return;
        }
        
        let removedCount = 0;
        
        // 从文件夹中移除节点
        nodeIds.forEach(nodeId => {
            const index = folderState.config.folderNodes[folderId].indexOf(nodeId);
            if (index > -1) {
                folderState.config.folderNodes[folderId].splice(index, 1);
                removedCount++;
            }
        });
        
        // 保存配置
        if (removedCount > 0) {
            const success = await saveConfig();
            
            if (success) {
                showToast(`✅ 已从文件夹移除${removedCount}个节点`, 'success');
                
                // 更新UI计数
                updateSpecialFoldersCount();
                
                // 重新渲染文件夹列表以更新数字
                renderFolders();
                
                // 刷新当前文件夹视图
                const { showNodesByFolder } = await import('./node_pool.js');
                showNodesByFolder(folderId);
            } else {
                showToast('移除失败', 'error');
            }
        } else {
            showToast('节点不在该文件夹中', 'info');
        }
    });
    
    // 监听刷新节点池（前缀管理后）
    window.addEventListener('nm:refreshNodePool', async () => {
        console.log('[节点事件] 刷新节点池');
        
        // 重新渲染当前显示的节点
        if (nodePoolState.currentNodes && nodePoolState.currentNodes.length > 0) {
            renderNodePool(nodePoolState.currentNodes);
        }
    });
    
    // 监听更新文件夹计数请求
    window.addEventListener('nm:requestUpdateFolderCounts', () => {
        console.log('[节点事件] 更新文件夹计数请求');
        updateSpecialFoldersCount();
    });
    
    // 监听批量还原选中的插件
    window.addEventListener('nm:restoreSelectedPlugins', async () => {
        console.log('[节点事件] 批量还原选中的插件');
        await restoreSelectedPlugins();
    });
    
    console.log('[节点事件] 事件监听器初始化完成');
}

export { initNodeEvents };

