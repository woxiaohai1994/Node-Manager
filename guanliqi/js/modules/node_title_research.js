// 研究节点标题渲染方式
import { app } from "../../../scripts/app.js";

/**
 * 研究节点标题渲染
 */
export function researchNodeTitleRendering() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔬 研究节点标题渲染方式');
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
    console.log('\n📦 节点对象:', firstNode);
    console.log('节点类型:', firstNode.type);
    console.log('节点标题:', firstNode.title);
    console.log('节点大小:', firstNode.size);
    console.log('节点位置:', firstNode.pos);
    
    // 检查绘制方法
    console.log('\n🎨 绘制方法检查:');
    
    // 检查onDrawBackground
    if (firstNode.onDrawBackground) {
        console.log('✅ 有 onDrawBackground 方法');
        console.log('onDrawBackground 代码:', firstNode.onDrawBackground.toString().substring(0, 500));
    } else {
        console.log('❌ 没有 onDrawBackground 方法');
    }
    
    // 检查onDrawForeground
    if (firstNode.onDrawForeground) {
        console.log('✅ 有 onDrawForeground 方法');
        console.log('onDrawForeground 代码:', firstNode.onDrawForeground.toString().substring(0, 500));
    } else {
        console.log('❌ 没有 onDrawForeground 方法');
    }
    
    // 检查原型方法
    const proto = Object.getPrototypeOf(firstNode);
    console.log('\n🔍 原型方法:');
    
    if (proto.onDrawBackground) {
        console.log('✅ 原型有 onDrawBackground');
        const code = proto.onDrawBackground.toString();
        console.log('代码长度:', code.length);
        // 查找标题相关的绘制代码
        if (code.includes('title') || code.includes('Title')) {
            console.log('✅ 找到标题相关代码');
            // 提取标题绘制部分
            const titleMatch = code.match(/title[^}]*\{[^}]*\}/gi);
            if (titleMatch) {
                console.log('标题绘制代码:', titleMatch[0].substring(0, 300));
            }
        }
    }
    
    if (proto.onDrawForeground) {
        console.log('✅ 原型有 onDrawForeground');
    }
    
    // Hook onDrawBackground 观察绘制过程
    if (firstNode.onDrawBackground) {
        const original = firstNode.onDrawBackground;
        firstNode.onDrawBackground = function(ctx, canvas) {
            console.log('\n[绘制背景] 开始绘制节点背景');
            console.log('节点ID:', this.id);
            console.log('节点大小:', this.size);
            console.log('Canvas状态:', {
                scale: canvas.ds?.scale,
                offset: canvas.ds?.offset
            });
            
            // 调用原始方法
            const result = original.call(this, ctx, canvas);
            
            // 绘制后检查
            console.log('[绘制背景] 绘制完成');
            
            return result;
        };
        
        console.log('✅ 已Hook onDrawBackground，请观察节点绘制');
    }
    
    // Hook onDrawForeground
    if (firstNode.onDrawForeground) {
        const original = firstNode.onDrawForeground;
        firstNode.onDrawForeground = function(ctx, canvas) {
            console.log('\n[绘制前景] 开始绘制节点前景');
            console.log('节点ID:', this.id);
            
            // 调用原始方法
            const result = original.call(this, ctx, canvas);
            
            // 绘制后检查
            console.log('[绘制前景] 绘制完成');
            
            return result;
        };
        
        console.log('✅ 已Hook onDrawForeground，请观察节点绘制');
    }
    
    // 检查LiteGraph的绘制方法
    if (typeof LiteGraph !== 'undefined' && LiteGraph.LGraphNode) {
        const LGraphNodeProto = LiteGraph.LGraphNode.prototype;
        
        console.log('\n📚 LiteGraph.LGraphNode 原型方法:');
        
        // 查找绘制相关方法
        const drawMethods = Object.getOwnPropertyNames(LGraphNodeProto).filter(name => 
            name.toLowerCase().includes('draw') || 
            name.toLowerCase().includes('render') ||
            name.toLowerCase().includes('paint')
        );
        
        console.log('绘制相关方法:', drawMethods);
        
        // 检查computeSize，了解节点结构
        if (LGraphNodeProto.computeSize) {
            console.log('\n📏 computeSize 方法:');
            const size = firstNode.computeSize?.();
            console.log('计算出的节点大小:', size);
        }
    }
    
    console.log('\n💡 提示：');
    console.log('1. 观察控制台输出，了解绘制顺序');
    console.log('2. 标题通常在 onDrawBackground 中绘制');
    console.log('3. 按钮应该在 onDrawForeground 中绘制，在标题之后');
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.researchNodeTitleRendering = researchNodeTitleRendering;
    console.log('✅ 标题渲染研究工具已加载');
    console.log('在控制台运行 researchNodeTitleRendering() 开始研究');
}


