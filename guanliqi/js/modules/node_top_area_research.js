// 研究节点顶部区域的实际坐标
import { app } from "../../../scripts/app.js";

/**
 * 研究节点顶部区域的绘制
 */
export function researchNodeTopArea() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔬 研究节点顶部区域');
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
    
    // Hook onDrawForeground，观察绘制过程
    if (firstNode.onDrawForeground) {
        const original = firstNode.onDrawForeground;
        firstNode.onDrawForeground = function(ctx, canvas) {
            console.log('\n[绘制前景] 节点:', this.id, this.type);
            console.log('节点大小:', this.size);
            console.log('节点位置:', this.pos);
            
            // 调用原始方法
            const result = original.call(this, ctx, canvas);
            
            // 测试绘制：在节点顶部绘制一个测试矩形
            ctx.save();
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; // 半透明红色
            ctx.fillRect(0, 0, this.size[0], 24); // 顶部24px区域
            ctx.restore();
            
            console.log('✅ 已绘制测试矩形在顶部区域 (0, 0, ' + this.size[0] + ', 24)');
            
            return result;
        };
        
        console.log('✅ 已Hook onDrawForeground，请查看节点顶部是否有红色矩形');
    }
    
    // Hook drawTitleText，观察标题位置
    if (typeof LiteGraph !== 'undefined' && LiteGraph.LGraphNode) {
        const proto = LiteGraph.LGraphNode.prototype;
        if (proto.drawTitleText) {
            const original = proto.drawTitleText;
            proto.drawTitleText = function(ctx, title, pos, size) {
                console.log('\n[绘制标题] 节点:', this.id);
                console.log('标题:', title);
                console.log('标题位置 pos:', pos);
                console.log('标题大小 size:', size);
                console.log('节点大小:', this.size);
                
                const result = original.call(this, ctx, title, pos, size);
                
                // 在标题位置绘制一个测试点
                if (pos && pos.length >= 2) {
                    ctx.save();
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
                    ctx.beginPath();
                    ctx.arc(pos[0], pos[1], 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                    console.log('✅ 已在标题位置绘制绿色测试点');
                }
                
                return result;
            };
            
            console.log('✅ 已Hook drawTitleText，请观察标题位置');
        }
    }
    
    // 触发重绘
    if (app.canvas) {
        app.canvas.setDirty?.(true);
    }
    
    console.log('\n💡 提示：');
    console.log('1. 查看节点顶部是否有红色矩形（顶部24px区域）');
    console.log('2. 查看标题位置是否有绿色点');
    console.log('3. 根据观察结果调整按钮位置');
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.researchNodeTopArea = researchNodeTopArea;
    console.log('✅ 节点顶部区域研究工具已加载');
    console.log('在控制台运行 researchNodeTopArea() 开始研究');
}


