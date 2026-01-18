// ComfyUI 节点渲染机制研究工具
// 用于深入理解ComfyUI如何渲染节点，以便正确实现画布节点增强功能

import { app } from "../../../scripts/app.js";

/**
 * 研究LiteGraph节点的完整结构
 */
export function researchLiteGraphNodeStructure() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔬 开始研究 LiteGraph 节点结构');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!app || !app.graph) {
        console.error('❌ ComfyUI 未就绪');
        return;
    }
    
    const nodes = app.graph._nodes || [];
    if (nodes.length === 0) {
        console.warn('⚠️ 画布上没有节点，请先添加一个节点');
        return;
    }
    
    const firstNode = nodes[0];
    console.log('\n📦 节点对象结构:');
    console.log('节点对象:', firstNode);
    console.log('节点类型:', typeof firstNode);
    console.log('节点构造函数:', firstNode.constructor?.name);
    console.log('节点原型链:', Object.getPrototypeOf(firstNode));
    
    // 检查节点的所有属性
    console.log('\n📋 节点属性列表:');
    const nodeProps = Object.keys(firstNode);
    console.log('直接属性:', nodeProps);
    
    // 检查重要属性
    console.log('\n🔍 重要属性检查:');
    const importantProps = [
        'id', 'type', 'title', 'pos', 'size', 'graph', 'canvas',
        'domElement', 'widgets', 'inputs', 'outputs',
        'onDraw', 'onResize', 'onAdded', 'onRemoved',
        'comfyClassType', 'class_type'
    ];
    
    importantProps.forEach(prop => {
        const value = firstNode[prop];
        if (value !== undefined) {
            console.log(`  ${prop}:`, value, typeof value);
        }
    });
    
    // 检查方法
    console.log('\n⚙️ 节点方法:');
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(firstNode));
    console.log('原型方法:', methods);
    
    // 检查是否有DOM相关属性
    console.log('\n🌐 DOM相关属性:');
    if (firstNode.domElement) {
        console.log('  domElement:', firstNode.domElement);
        console.log('  domElement类型:', firstNode.domElement.constructor.name);
        console.log('  domElement类名:', firstNode.domElement.className);
        console.log('  domElement标签:', firstNode.domElement.tagName);
    } else {
        console.log('  ❌ 没有 domElement 属性');
    }
    
    if (firstNode.canvas) {
        console.log('  canvas:', firstNode.canvas);
        console.log('  canvas类型:', typeof firstNode.canvas);
    }
    
    if (firstNode.graph) {
        console.log('  graph:', firstNode.graph);
        console.log('  graph类型:', typeof firstNode.graph);
    }
    
    return firstNode;
}

/**
 * 研究节点如何渲染到DOM
 */
export function researchNodeDOMRendering() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎨 研究节点DOM渲染');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!app || !app.canvas) {
        console.error('❌ ComfyUI Canvas 未就绪');
        return;
    }
    
    const canvas = app.canvas;
    console.log('\n📐 Canvas对象:');
    console.log('canvas:', canvas);
    console.log('canvas.canvas (DOM元素):', canvas.canvas);
    console.log('canvas.graph:', canvas.graph);
    
    // 检查canvas的DOM结构
    if (canvas.canvas) {
        console.log('\n🏗️ Canvas DOM结构:');
        console.log('canvas标签:', canvas.canvas.tagName);
        console.log('canvas类名:', canvas.canvas.className);
        console.log('canvas ID:', canvas.canvas.id);
        console.log('canvas子元素数量:', canvas.canvas.children.length);
        
        // 查找所有节点DOM
        const allNodeElements = canvas.canvas.querySelectorAll('*');
        console.log('\n🔍 Canvas内所有元素:', allNodeElements.length);
        
        // 查找可能的节点元素
        const possibleNodeSelectors = [
            '.lgraph_node',
            '.node',
            '[class*="node"]',
            '[class*="Node"]',
            '[data-node-id]',
            '[data-node-type]'
        ];
        
        possibleNodeSelectors.forEach(selector => {
            const elements = canvas.canvas.querySelectorAll(selector);
            if (elements.length > 0) {
                console.log(`\n✅ 找到 ${elements.length} 个元素 (${selector}):`);
                elements.forEach((el, idx) => {
                    if (idx < 3) { // 只显示前3个
                        console.log(`  [${idx}]`, {
                            tag: el.tagName,
                            class: el.className,
                            id: el.id,
                            dataset: el.dataset,
                            node: el.node
                        });
                    }
                });
            }
        });
    }
    
    // 检查graph中的节点
    if (app.graph && app.graph._nodes) {
        console.log('\n📊 Graph中的节点:');
        app.graph._nodes.forEach((node, idx) => {
            console.log(`\n节点 [${idx}]:`, {
                id: node.id,
                type: node.type,
                title: node.title,
                pos: node.pos
            });
            
            // 尝试找到对应的DOM
            const nodeDOM = findNodeDOMByNode(node);
            if (nodeDOM) {
                console.log('  ✅ 找到DOM:', nodeDOM);
                console.log('  DOM类名:', nodeDOM.className);
                console.log('  DOM结构:', nodeDOM.outerHTML.substring(0, 200));
            } else {
                console.log('  ❌ 未找到DOM');
            }
        });
    }
}

/**
 * 通过节点对象查找DOM（增强版）
 */
function findNodeDOMByNode(node) {
    if (!node || !app.canvas) return null;
    
    const canvas = app.canvas.canvas;
    if (!canvas) return null;
    
    // 方法1: 直接属性（最可靠）
    if (node.domElement) {
        console.log('  ✅ 通过node.domElement找到');
        return node.domElement;
    }
    
    // 方法2: 通过canvas查找，尝试各种选择器
    const selectors = [
        `[data-node-id="${node.id}"]`,
        `[data-node-type="${node.type}"]`,
        `[data-id="${node.id}"]`,
        `#node_${node.id}`,
        `.node[data-id="${node.id}"]`,
        `.lgraph_node[data-id="${node.id}"]`
    ];
    
    for (const selector of selectors) {
        const el = canvas.querySelector(selector);
        if (el) {
            console.log(`  ✅ 通过选择器找到: ${selector}`);
            return el;
        }
    }
    
    // 方法3: 遍历所有可能的节点元素，检查node属性
    const possibleNodeElements = canvas.querySelectorAll('.lgraph_node, .node, [class*="node"], [class*="Node"]');
    for (const el of possibleNodeElements) {
        // 检查DOM元素是否有node属性指向当前节点
        if (el.node === node) {
            console.log('  ✅ 通过el.node属性找到');
            return el;
        }
        
        // 检查DOM元素的data属性
        const nodeId = el.getAttribute('data-node-id') || 
                      el.getAttribute('data-node-type') ||
                      el.getAttribute('data-id') ||
                      el.id;
        
        if (nodeId === String(node.id) || nodeId === node.type) {
            console.log(`  ✅ 通过data属性找到: ${nodeId}`);
            return el;
        }
    }
    
    // 方法4: 通过位置匹配（如果节点有pos）
    if (node.pos && possibleNodeElements.length > 0) {
        const nodePos = node.pos;
        const scale = app.canvas.ds?.scale || 1;
        const offset = app.canvas.ds?.offset || [0, 0];
        
        let closestEl = null;
        let closestDistance = Infinity;
        
        for (const el of possibleNodeElements) {
            const rect = el.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            
            const domX = (rect.left - canvasRect.left) / scale - offset[0];
            const domY = (rect.top - canvasRect.top) / scale - offset[1];
            
            const distance = Math.sqrt(
                Math.pow(domX - nodePos[0], 2) + 
                Math.pow(domY - nodePos[1], 2)
            );
            
            if (distance < closestDistance && distance < 50) {
                closestDistance = distance;
                closestEl = el;
            }
        }
        
        if (closestEl) {
            console.log(`  ✅ 通过位置匹配找到（距离: ${closestDistance.toFixed(2)}）`);
            return closestEl;
        }
    }
    
    return null;
}

/**
 * 研究ComfyUI如何扩展LiteGraph节点
 */
export function researchComfyUIExtensions() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 研究 ComfyUI 扩展机制');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 检查app对象
    console.log('\n📦 App对象结构:');
    console.log('app:', app);
    console.log('app类型:', typeof app);
    console.log('app属性:', Object.keys(app));
    
    // 检查LiteGraph
    if (typeof LiteGraph !== 'undefined') {
        console.log('\n📚 LiteGraph对象:');
        console.log('LiteGraph:', LiteGraph);
        console.log('LiteGraph.LGraphNode:', LiteGraph.LGraphNode);
        console.log('LiteGraph.createNode:', typeof LiteGraph.createNode);
        
        // 检查节点原型
        if (LiteGraph.LGraphNode) {
            console.log('\n🔬 LGraphNode原型:');
            const proto = LiteGraph.LGraphNode.prototype;
            console.log('原型方法:', Object.getOwnPropertyNames(proto));
            
            // 检查关键方法
            const keyMethods = ['onDraw', 'onResize', 'onAdded', 'onRemoved', 'computeSize'];
            keyMethods.forEach(method => {
                if (proto[method]) {
                    console.log(`  ${method}:`, typeof proto[method]);
                }
            });
        }
    }
    
    // 检查ComfyUI的节点扩展
    if (app && app.graph) {
        console.log('\n🎯 Graph对象:');
        console.log('graph:', app.graph);
        console.log('graph类型:', typeof app.graph);
        console.log('graph方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(app.graph)));
        
        // 检查节点添加方法
        if (app.graph.add) {
            console.log('\n➕ graph.add方法:');
            console.log('add:', app.graph.add);
            console.log('add类型:', typeof app.graph.add);
            console.log('add.toString():', app.graph.add.toString().substring(0, 200));
        }
    }
}

/**
 * 监听节点添加过程
 */
export function watchNodeCreation() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👀 监听节点创建过程');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!app || !app.graph) {
        console.error('❌ ComfyUI 未就绪');
        return;
    }
    
    // Hook graph.add
    const originalAdd = app.graph.add;
    let addCallCount = 0;
    
    app.graph.add = function(node) {
        addCallCount++;
        console.log(`\n[节点添加 #${addCallCount}]`);
        console.log('节点对象:', node);
        console.log('节点ID:', node.id);
        console.log('节点类型:', node.type);
        console.log('节点标题:', node.title);
        console.log('节点位置:', node.pos);
        console.log('节点类名:', node.constructor?.name);
        
        // 检查此时是否有DOM
        console.log('此时domElement:', node.domElement);
        console.log('此时canvas:', node.canvas);
        console.log('此时graph:', node.graph);
        
        // 检查节点是否有onAdded方法
        if (node.onAdded) {
            console.log('节点有onAdded方法');
        }
        
        // 调用原始方法
        const result = originalAdd.call(this, node);
        
        // 立即检查（同步）
        console.log('\n[节点添加 #' + addCallCount + ' - 同步检查]');
        console.log('调用后domElement:', node.domElement);
        
        // 多次延迟检查（因为DOM可能异步渲染）
        [50, 100, 200, 500].forEach(delay => {
            setTimeout(() => {
                console.log(`\n[节点添加 #${addCallCount} - ${delay}ms后检查]`);
                console.log(`${delay}ms后domElement:`, node.domElement);
                
                // 尝试查找DOM
                const nodeDOM = findNodeDOMByNode(node);
                if (nodeDOM) {
                    console.log('✅ 找到DOM:', nodeDOM);
                    console.log('DOM类名:', nodeDOM.className);
                    console.log('DOM ID:', nodeDOM.id);
                    console.log('DOM dataset:', nodeDOM.dataset);
                    console.log('DOM父元素:', nodeDOM.parentElement?.className);
                    console.log('DOM结构预览:', nodeDOM.outerHTML.substring(0, 500));
                    
                    // 检查DOM是否有node属性
                    if (nodeDOM.node) {
                        console.log('✅ DOM有node属性，指向节点对象');
                    }
                    
                    // 检查DOM的子元素结构
                    console.log('DOM子元素数量:', nodeDOM.children.length);
                    Array.from(nodeDOM.children).forEach((child, idx) => {
                        console.log(`  子元素[${idx}]:`, child.tagName, child.className);
                    });
                } else {
                    console.log('❌ 未找到DOM');
                }
            }, delay);
        });
        
        return result;
    };
    
    console.log('✅ 已Hook graph.add，请添加一个节点来观察');
    console.log('💡 注意：其他插件（如ui_mixlab）可能也会监听节点创建，产生404错误是正常的');
}

/**
 * 研究节点绘制方法
 */
export function researchNodeDrawing() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎨 研究节点绘制方法');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!app || !app.graph) {
        console.error('❌ ComfyUI 未就绪');
        return;
    }
    
    const nodes = app.graph._nodes || [];
    if (nodes.length === 0) {
        console.warn('⚠️ 画布上没有节点');
        return;
    }
    
    const firstNode = nodes[0];
    
    // 检查onDraw方法
    if (firstNode.onDraw) {
        console.log('\n✅ 节点有onDraw方法');
        console.log('onDraw类型:', typeof firstNode.onDraw);
        console.log('onDraw代码:', firstNode.onDraw.toString().substring(0, 500));
    } else {
        console.log('\n❌ 节点没有onDraw方法');
    }
    
    // 检查是否有自定义绘制
    const proto = Object.getPrototypeOf(firstNode);
    if (proto.onDraw) {
        console.log('\n✅ 原型有onDraw方法');
        console.log('原型onDraw代码:', proto.onDraw.toString().substring(0, 500));
    }
    
    // 检查canvas的绘制方法
    if (app.canvas && app.canvas.draw) {
        console.log('\n✅ Canvas有draw方法');
    }
    
    // 检查是否有requestRedraw
    if (app.canvas && app.canvas.requestRedraw) {
        console.log('\n✅ Canvas有requestRedraw方法');
    }
}

/**
 * 完整研究流程
 */
export function fullResearch() {
    console.log('🚀 开始完整研究流程...\n');
    
    researchLiteGraphNodeStructure();
    researchNodeDOMRendering();
    researchComfyUIExtensions();
    researchNodeDrawing();
    watchNodeCreation();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 研究完成！请查看上面的输出');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 提示：');
    console.log('1. 添加一个节点，观察节点创建过程');
    console.log('2. 检查节点的DOM结构');
    console.log('3. 查看节点对象的属性');
    console.log('4. 根据研究结果调整实现方案');
}

// 导出到全局，方便在控制台使用
if (typeof window !== 'undefined') {
    window.researchLiteGraphNodeStructure = researchLiteGraphNodeStructure;
    window.researchNodeDOMRendering = researchNodeDOMRendering;
    window.researchComfyUIExtensions = researchComfyUIExtensions;
    window.watchNodeCreation = watchNodeCreation;
    window.researchNodeDrawing = researchNodeDrawing;
    window.fullResearch = fullResearch;
    
    console.log('✅ 研究工具已加载！');
    console.log('在控制台运行 fullResearch() 开始完整研究');
}

