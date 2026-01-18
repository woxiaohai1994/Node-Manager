// js/folder_manager.js
// 主入口文件 - 插件注册和初始化

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { PLUGIN_NAME, folderState } from './modules/folder_state.js';
import { createManagerInterface, bindEvents, injectNodePoolDeps, renderFolders } from './modules/folder_ui.js';
import { loadConfig, initializeEventListeners, saveConfig } from './modules/folder_operations.js';
import { initNodePool, nodePoolState, getUncategorizedCount, renderNodePool, updateNodePoolHeader, showNodesByPlugin, showNodesByFolder, showFavoriteNodes, showNodesByCategory, showUncategorizedNodes, showHiddenPlugins, restoreSelectedPlugins, updateSpecialFoldersCount, escapeHtml, forceCleanupPreview } from './modules/node_pool.js';
import { initNodeEvents } from './modules/node_events.js';
import { openModalSearch } from './modules/modal_search.js';
// import { initCanvasNodeEnhancement } from './modules/canvas_node_enhancement.js';
// import { initCanvasNodeOverlay } from './modules/canvas_node_overlay.js'; // 画布节点覆盖层增强（旧方案）
import { initCanvasNodeIntegrated } from './modules/canvas_node_integrated.js'; // 画布节点集成增强（新方案）
import './modules/comfyui_node_render_research.js'; // 加载研究工具
import './modules/node_title_research.js'; // 加载标题渲染研究工具
import './modules/node_top_area_research.js'; // 加载顶部区域研究工具
import './modules/group_research.js'; // 加载Group研究工具

// 挂载到全局对象，供搜索功能使用
window.folderState = folderState;

// 等待ComfyUI API就绪
function waitForComfyAPI() {
    return new Promise((resolve) => {
        const checkAPI = () => {
            if (app.extensionManager && api && app.graph) {
                resolve();
            } else {
                setTimeout(checkAPI, 100);
            }
        };
        checkAPI();
    });
}

/**
 * 设置侧边栏关闭监听，清理预览
 */
function setupSidebarCloseListener(container) {
    // 方法1: 使用 MutationObserver 监听侧边栏容器的显示/隐藏
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            // 检查属性变化（class、style等）
            if (mutation.type === 'attributes') {
                const target = mutation.target;
                // 检查是否被隐藏
                const isHidden = target.offsetParent === null || 
                                target.style.display === 'none' || 
                                target.style.visibility === 'hidden' ||
                                target.classList.contains('hidden') ||
                                window.getComputedStyle(target).display === 'none';
                
                if (isHidden) {
                    // 侧边栏被隐藏，清理预览
                    forceCleanupPreview();
                }
            }
        }
    });
    
    // 查找侧边栏的根容器（向上查找，找到实际的侧边栏容器）
    let sidebarRoot = container;
    while (sidebarRoot && sidebarRoot.parentElement) {
        // 检查是否是侧边栏容器（通常有特定的class或id）
        const parent = sidebarRoot.parentElement;
        if (parent.classList && (
            parent.classList.contains('sidebar') || 
            parent.classList.contains('comfy-sidebar') ||
            parent.id && parent.id.includes('sidebar')
        )) {
            sidebarRoot = parent;
            break;
        }
        sidebarRoot = parent;
    }
    
    // 观察侧边栏容器的属性变化
    if (sidebarRoot) {
        observer.observe(sidebarRoot, {
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden'],
            subtree: false
        });
        
        // 也观察当前容器
        observer.observe(container, {
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden'],
            subtree: false
        });
    }
    
    // 方法2: 监听页面可见性变化（当用户切换标签页或最小化窗口时）
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // 页面隐藏时清理预览
            forceCleanupPreview();
        }
    });
    
    // 方法3: 监听窗口失焦（当用户点击其他地方时）
    window.addEventListener('blur', () => {
        // 延迟清理，给用户时间切换回来
        setTimeout(() => {
            if (document.hidden) {
                forceCleanupPreview();
            }
        }, 100);
    });
    
    // 方法4: 定期检查侧边栏是否可见（作为兜底方案）
    let lastCheck = Date.now();
    const checkInterval = setInterval(() => {
        const now = Date.now();
        // 每500ms检查一次
        if (now - lastCheck >= 500) {
            lastCheck = now;
            
            // 检查容器是否可见
            if (container && (
                container.offsetParent === null || 
                window.getComputedStyle(container).display === 'none'
            )) {
                // 侧边栏不可见，清理预览
                forceCleanupPreview();
            }
        }
    }, 500);
    
    // 清理函数（当容器被移除时）
    const cleanupObserver = new MutationObserver(() => {
        if (!container.parentElement) {
            // 容器被移除，清理所有监听器
            observer.disconnect();
            cleanupObserver.disconnect();
            clearInterval(checkInterval);
            // 清理预览
            forceCleanupPreview();
        }
    });
    
    if (container.parentElement) {
        cleanupObserver.observe(container.parentElement, {
            childList: true,
            subtree: true
        });
    }
}

// 创建节点管理器侧边栏标签
function createNodeManagerTab() {
    try {
        if (!app.extensionManager || !app.extensionManager.registerSidebarTab) {
            console.error(`${PLUGIN_NAME}: extensionManager不可用`);
            return false;
        }
        
        app.extensionManager.registerSidebarTab({
            id: "xiaohai-node-manager",
            icon: "pi pi-folder",
            title: "小海节点管理器",
            tooltip: "🌊 管理和组织节点分类",
            type: "custom",
            render: (el) => {
                // 设置侧边栏标签页容器样式
                if (el.parentElement) {
                    el.parentElement.style.height = '100%';
                    el.parentElement.style.display = 'flex';
                    el.parentElement.style.flexDirection = 'column';
                }
                
                // 设置当前容器样式
                el.style.height = '100%';
                el.style.minHeight = '100vh';
                el.style.display = 'flex';
                el.style.flexDirection = 'column';
                
                // 创建界面
                createManagerInterface(el);
                
                // 绑定事件
                bindEvents(el);
                
                // 监听侧边栏关闭/隐藏，清理预览
                setupSidebarCloseListener(el);
                
                // 立即加载数据（无延迟，秒开）
                (async () => {
                    await loadConfig();
                    await initNodePool();
                    
                    // 如果当前在互联网模式，刷新插件列表
                    const { nodePoolState, loadAvailablePlugins } = await import('./modules/node_pool.js');
                    if (nodePoolState.internetMode) {
                        console.log('[窗口打开] 检测到互联网模式，自动刷新插件列表');
                        loadAvailablePlugins(true);  // 强制刷新
                    }
                })();
            }
        });
        
        console.log(`${PLUGIN_NAME}: 侧边栏标签注册成功！`);
        return true;
        
    } catch (error) {
        console.error(`${PLUGIN_NAME}: 注册失败:`, error);
        return false;
    }
}

// 拦截官方搜索框（在 ComfyUI 完全就绪后执行）
async function setupSearchIntercept() {
    console.log('[画布拦截] 等待 ComfyUI 完全就绪...');
    await waitForComfyAPI();
    
    // 额外延迟，确保 emitEvent 已创建
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('[画布拦截] 开始设置官方搜索拦截...');
    
    if (!app || !app.canvas) {
        console.error('[画布拦截] ❌ app.canvas 不存在');
        return;
    }
    
    // 禁用 allow_searchbox
    app.canvas.allow_searchbox = false;
    console.log('[画布拦截] ✅ 已禁用 allow_searchbox');
    
    // Hook emitEvent
    if (app.canvas.emitEvent && typeof app.canvas.emitEvent === 'function') {
        const originalEmit = app.canvas.emitEvent;
        
        app.canvas.emitEvent = function(event) {
            // 拦截 empty-double-click 事件
            if (event && (event.type === 'empty-double-click' || event.subType === 'empty-double-click')) {
                console.log('[画布拦截] 🚫 拦截 empty-double-click 事件，阻止官方搜索');
                console.log('[画布拦截] ✅ 打开 Modal 搜索窗口');
                // 调用我们的 Modal 搜索
                try {
                    openModalSearch();
                } catch (error) {
                    console.error('[画布拦截] 打开 Modal 失败:', error);
                }
                return; // 不调用原始函数
            }
            // 其他事件正常传递
            return originalEmit.call(this, event);
        };
        
        console.log('[画布拦截] ✅ 已Hook emitEvent，拦截官方搜索触发');
        console.log('[画布拦截] ✅ 拦截设置完成！现在双击画布将触发我们的搜索');
    } else {
        console.error('[画布拦截] ❌ emitEvent 不存在');
    }
}

// 标记是否已全局初始化
let globalInitialized = false;

// 注册ComfyUI扩展
app.registerExtension({
    name: `Comfy.${PLUGIN_NAME}`,
    
    async setup() {
        console.log(`${PLUGIN_NAME}: 开始初始化...`);
        
        // 全局初始化（只执行一次）
        if (!globalInitialized) {
            console.log(`${PLUGIN_NAME}: 执行全局初始化...`);
            
            // 注入节点池依赖
            injectNodePoolDeps({
                nodePoolState,
                getUncategorizedCount,
                renderNodePool,
                updateNodePoolHeader,
                escapeHtml
            });
            
            // 初始化事件监听器
            initializeEventListeners();
            initNodeEvents({
                showNodesByPlugin,
                showNodesByFolder,
                showFavoriteNodes,
                showNodesByCategory,
                showUncategorizedNodes,
                showHiddenPlugins,
                restoreSelectedPlugins,
                updateSpecialFoldersCount,
                nodePoolState,
                renderNodePool,
                saveConfig,
                renderFolders
            });
            
            // 初始化画布节点集成增强（在节点渲染时注入按钮）
            initCanvasNodeIntegrated().catch(error => {
                console.error(`${PLUGIN_NAME}: 画布节点集成增强初始化失败:`, error);
            });
            
            // 加载研究工具
            console.log(`${PLUGIN_NAME}: 📚 节点渲染研究工具已加载`);
            console.log(`${PLUGIN_NAME}: 💡 在控制台运行 fullResearch() 开始研究`);
            
            globalInitialized = true;
            console.log(`${PLUGIN_NAME}: ✅ 全局初始化完成`);
            
            // 延迟10秒后启动后台更新Stars（调用后端API，静默）
            setTimeout(async () => {
                try {
                    // 检查是否需要更新（每天一次）
                    const lastUpdate = localStorage.getItem('stars_backend_last_update');
                    const starsCount = localStorage.getItem('stars_db_count') || '0';
                    const shouldForceUpdate = parseInt(starsCount) < 100;  // 如果stars_db少于100条，强制全量更新
                    
                    if (lastUpdate && !shouldForceUpdate) {
                        const lastDate = new Date(lastUpdate);
                        const today = new Date();
                        if (lastDate.toDateString() === today.toDateString()) {
                            // 静默跳过，不输出日志
                            return; // 今天已更新过
                        }
                    }
                    
                    // 静默更新，不输出日志
                    
                    // 调用后端API更新stars
                    const response = await fetch('/node-manager/store/update-stars', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            force_full: shouldForceUpdate  // 如果stars太少，强制全量更新
                        })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                            // 记录更新时间和stars数量（静默）
                            localStorage.setItem('stars_backend_last_update', new Date().toISOString());
                            localStorage.setItem('stars_db_count', data.updated.toString());
                            // 不输出日志
                        }
                    }
                } catch (error) {
                    // 静默失败，不输出日志
                }
            }, 10000);
        }
        
        // 尝试立即创建，如果失败则稍后重试
        if (!createNodeManagerTab()) {
            await waitForComfyAPI();
            
            // 重试创建侧边栏标签
            setTimeout(() => {
                createNodeManagerTab();
            }, 200);
        }
        
        // 设置官方搜索拦截（在正确的时机）
        setupSearchIntercept();
    }
});

console.log(`${PLUGIN_NAME}: 插件加载完成`);

