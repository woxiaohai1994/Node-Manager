// js/node_api.js
// 节点相关API调用

/**
 * 从后端获取节点到插件的映射关系
 */
async function fetchNodeSourceMapping() {
    try {
        const response = await fetch('/node-manager/node-sources');
        const data = await response.json();
        
        if (data.success) {
            return data.node_sources || {};
        } else {
            console.error('获取节点来源映射失败:', data.error);
            return {};
        }
    } catch (error) {
        console.error('获取节点来源映射异常:', error);
        return {};
    }
}

/**
 * 获取所有节点列表（从前端 LiteGraph.registered_node_types）
 */
async function fetchNodes() {
    try {
        // 等待 LiteGraph 就绪
        if (typeof LiteGraph === 'undefined' || !LiteGraph.registered_node_types) {
            console.warn('[节点API] LiteGraph 尚未就绪，稍后重试...');
            await new Promise(resolve => setTimeout(resolve, 500));
            return fetchNodes(); // 递归重试
        }
        
        // 从后端获取节点来源映射 (node_id -> source)
        const nodeSourceMap = await fetchNodeSourceMapping();
        console.log('[节点API] 节点来源映射加载完成，共', Object.keys(nodeSourceMap).length, '个节点');
        
        // 从前端 LiteGraph 获取节点信息（已汉化）
        const litegraphNodes = LiteGraph.registered_node_types;
        const nodes = [];
        const pluginsMap = {}; // source -> {name, nodes: []}
        
        // 遍历所有注册的节点
        for (const nodeType in litegraphNodes) {
            try {
                const nodeInfo = litegraphNodes[nodeType];
                
                // 获取节点的基本信息（汉化后的）
                const node = {
                    id: nodeType,
                    display_name: nodeInfo.title || nodeType,
                    category: nodeInfo.category || '',
                    description: nodeInfo.description || '',
                    source: nodeSourceMap[nodeType] || 'ComfyUI',  // 从映射表获取来源
                    class_type: nodeType
                };
                
                nodes.push(node);
                
                // 按插件分组
                const source = node.source;
                if (!pluginsMap[source]) {
                    pluginsMap[source] = {
                        name: source,
                        nodes: []
                    };
                }
                pluginsMap[source].nodes.push(node);
                
            } catch (error) {
                console.warn('[节点API] 处理节点失败:', nodeType, error);
            }
        }
        
        // 转换为插件数组
        const plugins = Object.values(pluginsMap);
        
        console.log('[节点API] 从 LiteGraph 加载完成，共', nodes.length, '个节点，', plugins.length, '个插件');
        
        return {
            nodes: nodes,
            plugins: plugins,
            totalCount: nodes.length
        };
        
    } catch (error) {
        console.error('[节点API] 获取节点列表异常:', error);
        return {
            nodes: [],
            plugins: [],
            totalCount: 0
        };
    }
}

export { fetchNodes };

