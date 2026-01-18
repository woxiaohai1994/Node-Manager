// 画布节点增强功能 - 探索脚本
// 用于在浏览器控制台测试和探索节点DOM结构

import { app } from "../../../scripts/app.js";

/**
 * 探索画布节点的DOM结构
 * 在浏览器控制台运行此函数来查看节点DOM
 */
export function exploreCanvasNodeDOM() {
    if (!app || !app.graph) {
        console.warn('ComfyUI 未就绪');
        return;
    }
    
    const nodes = app.graph._nodes || [];
    console.log(`找到 ${nodes.length} 个画布节点`);
    
    if (nodes.length === 0) {
        console.log('画布上没有节点，请先添加一个节点');
        return;
    }
    
    // 检查第一个节点
    const firstNode = nodes[0];
    console.log('第一个节点信息:', {
        id: firstNode.id,
        type: firstNode.type,
        title: firstNode.title,
        class_type: firstNode.class_type,
        pos: firstNode.pos,
        size: firstNode.size,
        // DOM相关属性
        domElement: firstNode.domElement,
        canvas: firstNode.canvas,
        graph: firstNode.graph
    });
    
    // 尝试查找节点的DOM元素
    const canvas = app.canvas?.canvas;
    if (canvas) {
        // 方法1: 通过节点ID查找
        const nodeById = document.querySelector(`[data-node-id="${firstNode.id}"]`);
        console.log('通过data-node-id查找:', nodeById);
        
        // 方法2: 通过节点类型查找
        const nodeByType = document.querySelector(`[data-node-type="${firstNode.type}"]`);
        console.log('通过data-node-type查找:', nodeByType);
        
        // 方法3: 查找所有节点DOM
        const allNodeElements = canvas.querySelectorAll('.node, [class*="node"]');
        console.log('所有可能的节点DOM:', allNodeElements);
        
        // 方法4: 检查LiteGraph的DOM结构
        if (firstNode.domElement) {
            console.log('节点的domElement:', firstNode.domElement);
            console.log('domElement的父元素:', firstNode.domElement.parentElement);
            console.log('domElement的类名:', firstNode.domElement.className);
            console.log('domElement的HTML:', firstNode.domElement.outerHTML.substring(0, 500));
        }
    }
    
    // 检查LiteGraph的节点渲染方法
    if (firstNode.onDraw) {
        console.log('节点有onDraw方法');
    }
    if (firstNode.onResize) {
        console.log('节点有onResize方法');
    }
    if (firstNode.onAdded) {
        console.log('节点有onAdded方法');
    }
}

/**
 * 监听节点添加事件
 */
export function watchNodeAdd() {
    if (!app || !app.graph) {
        console.warn('ComfyUI 未就绪');
        return;
    }
    
    // 方法1: Hook graph.add
    const originalAdd = app.graph.add;
    app.graph.add = function(node) {
        console.log('[节点添加] 节点被添加到画布:', {
            id: node.id,
            type: node.type,
            title: node.title,
            class_type: node.class_type
        });
        
        // 调用原始方法
        const result = originalAdd.call(this, node);
        
        // 延迟执行，等待DOM渲染
        setTimeout(() => {
            console.log('[节点添加] 延迟检查DOM...');
            exploreNodeDOM(node);
        }, 100);
        
        return result;
    };
    
    console.log('✅ 已Hook graph.add 方法');
}

/**
 * 探索特定节点的DOM
 */
function exploreNodeDOM(node) {
    // 方法1: 通过节点ID
    const byId = document.querySelector(`[data-node-id="${node.id}"]`);
    if (byId) {
        console.log('✅ 找到节点DOM (通过ID):', byId);
        console.log('DOM结构:', byId.outerHTML.substring(0, 1000));
        return byId;
    }
    
    // 方法2: 通过节点类型
    const byType = document.querySelector(`[data-node-type="${node.type}"]`);
    if (byType) {
        console.log('✅ 找到节点DOM (通过类型):', byType);
        return byType;
    }
    
    // 方法3: 通过LiteGraph的DOM属性
    if (node.domElement) {
        console.log('✅ 找到节点DOM (通过domElement):', node.domElement);
        return node.domElement;
    }
    
    // 方法4: 在画布上查找所有节点，匹配位置
    const canvas = app.canvas?.canvas;
    if (canvas) {
        const allNodes = canvas.querySelectorAll('.lgraph_node, .node');
        console.log(`找到 ${allNodes.length} 个可能的节点DOM`);
        
        // 尝试通过位置匹配
        allNodes.forEach((domNode, index) => {
            const rect = domNode.getBoundingClientRect();
            console.log(`节点 ${index}:`, {
                element: domNode,
                position: { x: rect.left, y: rect.top },
                classes: domNode.className,
                id: domNode.id,
                dataset: domNode.dataset
            });
        });
    }
    
    console.warn('❌ 未找到节点DOM');
    return null;
}

/**
 * 测试在节点上添加按钮
 */
export function testAddButtonsToNode(nodeId) {
    if (!app || !app.graph) {
        console.warn('ComfyUI 未就绪');
        return;
    }
    
    const node = app.graph._nodes.find(n => n.id === nodeId || n.type === nodeId);
    if (!node) {
        console.warn('未找到节点:', nodeId);
        return;
    }
    
    const nodeDOM = exploreNodeDOM(node);
    if (!nodeDOM) {
        console.error('无法找到节点DOM');
        return;
    }
    
    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'nm-canvas-node-buttons';
    buttonContainer.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        display: flex;
        gap: 5px;
        z-index: 1000;
    `;
    
    // 收藏按钮
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'nm-canvas-btn nm-canvas-btn-favorite';
    favoriteBtn.innerHTML = '⭐';
    favoriteBtn.title = '收藏';
    favoriteBtn.style.cssText = `
        width: 24px;
        height: 24px;
        border: none;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;
    
    // 笔记按钮
    const noteBtn = document.createElement('button');
    noteBtn.className = 'nm-canvas-btn nm-canvas-btn-note';
    noteBtn.innerHTML = '📝';
    noteBtn.title = '笔记';
    noteBtn.style.cssText = `
        width: 24px;
        height: 24px;
        border: none;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;
    
    buttonContainer.appendChild(favoriteBtn);
    buttonContainer.appendChild(noteBtn);
    
    // 确保节点DOM有position: relative
    const nodeStyle = window.getComputedStyle(nodeDOM);
    if (nodeStyle.position === 'static') {
        nodeDOM.style.position = 'relative';
    }
    
    // 添加按钮容器
    nodeDOM.appendChild(buttonContainer);
    
    console.log('✅ 按钮已添加到节点:', nodeDOM);
    
    // 绑定事件
    favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('收藏按钮被点击，节点ID:', node.id);
        // TODO: 调用 toggleFavorite
    });
    
    noteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('笔记按钮被点击，节点ID:', node.id);
        // TODO: 调用 showNoteDialog
    });
    
    return buttonContainer;
}

// 导出所有函数供控制台使用
if (typeof window !== 'undefined') {
    window.exploreCanvasNodeDOM = exploreCanvasNodeDOM;
    window.watchNodeAdd = watchNodeAdd;
    window.testAddButtonsToNode = testAddButtonsToNode;
    console.log('✅ 探索函数已加载，可在控制台使用:');
    console.log('  - exploreCanvasNodeDOM() - 探索节点DOM结构');
    console.log('  - watchNodeAdd() - 监听节点添加事件');
    console.log('  - testAddButtonsToNode(nodeId) - 测试添加按钮');
}


