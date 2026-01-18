// js/modules/group_research.js
// 研究 ComfyUI LiteGraph Group（分组）结构，便于后续在画布节点上扩展批量分类功能

import { app } from "../../../scripts/app.js";

function ensureGraph() {
    if (!app || !app.graph) {
        console.warn('[GroupResearch] ComfyUI 未就绪，graph 不存在');
        return null;
    }
    return app.graph;
}

function getGraphGroups(graph = ensureGraph()) {
    if (!graph) return [];
    return graph._groups || graph.groups || [];
}

function getGraphNodes(graph = ensureGraph()) {
    if (!graph) return [];
    return graph._nodes || graph.nodes || [];
}

function summarizeGroup(group, index) {
    if (!group) return null;
    const rect = group.rect || group.bounding || [group.pos?.[0] || 0, group.pos?.[1] || 0, group.size?.[0] || 0, group.size?.[1] || 0];
    return {
        index,
        title: group.title,
        id: group.id ?? group.uid ?? group.title,
        color: group.color,
        pos: group.pos || [rect[0], rect[1]],
        size: group.size || [rect[2], rect[3]],
        locked: !!group.locked,
        visible: group.visible !== false
    };
}

function detectNodesInsideGroup(group, graph = ensureGraph()) {
    if (!group || !graph) return [];
    const nodes = getGraphNodes(graph);
    const rect = group.rect || group.bounding || [group.pos?.[0] || 0, group.pos?.[1] || 0, group.size?.[0] || 0, group.size?.[1] || 0];
    const [gx, gy, gw, gh] = rect;
    return nodes
        .filter(node => Array.isArray(node.pos) && Array.isArray(node.size))
        .filter(node => {
            const [nx, ny] = node.pos;
            const [nw, nh] = node.size;
            return nx >= gx && ny >= gy && (nx + nw) <= (gx + gw) && (ny + nh) <= (gy + gh);
        })
        .map(node => ({
            graphNodeId: node.id,
            comfyClass: node.comfyClass || node.type,
            title: node.title,
            pos: node.pos,
            size: node.size
        }));
}

function logCurrentGroups() {
    const graph = ensureGraph();
    if (!graph) return;
    const groups = getGraphGroups(graph);
    console.group(`[GroupResearch] 当前分组 (${groups.length})`);
    groups.forEach((group, index) => {
        console.log(`[#${index}]`, summarizeGroup(group, index));
    });
    console.groupEnd();
    return groups;
}

function logGroupDetails(index = 0) {
    const graph = ensureGraph();
    if (!graph) return;
    const groups = getGraphGroups(graph);
    if (!groups.length) {
        console.warn('[GroupResearch] graph 上没有任何分组');
        return;
    }
    const target = groups[index] || groups[0];
    console.group(`[GroupResearch] 分组详情 #${index}`);
    console.log('基本信息:', summarizeGroup(target, index));
    console.log('完整对象:', target);
    console.log('包含节点:', detectNodesInsideGroup(target, graph));
    console.groupEnd();
}

function logSelectedNodesGroups() {
    const graph = ensureGraph();
    if (!graph) return;
    const selectedNodes = (graph._nodes || []).filter(node => node.selected);
    if (!selectedNodes.length) {
        console.warn('[GroupResearch] 当前没有选中的节点');
        return;
    }
    console.group(`[GroupResearch] 选中节点 (${selectedNodes.length})`);
    selectedNodes.forEach(node => {
        const info = {
            graphNodeId: node.id,
            comfyClass: node.comfyClass || node.type,
            title: node.title,
            pos: node.pos,
            size: node.size
        };
        console.log(info);
    });
    console.groupEnd();
}

function hookGroupEvents() {
    if (hookGroupEvents._installed) {
        console.log('[GroupResearch] 已 Hook group 事件');
        return;
    }
    if (typeof LiteGraph === 'undefined' || !LiteGraph.LGraph) {
        console.warn('[GroupResearch] LiteGraph 不可用，无法 Hook group 事件');
        return;
    }
    const graphProto = LiteGraph.LGraph.prototype;
    if (!graphProto) {
        console.warn('[GroupResearch] 找不到 LGraph 原型');
        return;
    }
    
    const originalAddGroup = graphProto.addGroup;
    graphProto.addGroup = function(title) {
        const group = originalAddGroup ? originalAddGroup.call(this, title) : null;
        console.log('[GroupResearch] 新建分组:', summarizeGroup(group, this.groups?.length - 1));
        return group;
    };
    
    const originalRemoveGroup = graphProto.removeGroup;
    graphProto.removeGroup = function(group) {
        console.log('[GroupResearch] 删除分组:', group?.title || group);
        return originalRemoveGroup ? originalRemoveGroup.call(this, group) : undefined;
    };
    
    hookGroupEvents._installed = true;
    console.log('[GroupResearch] ✅ 已 Hook addGroup/removeGroup');
}

if (typeof window !== 'undefined') {
    window.groupResearch = {
        logCurrentGroups,
        logGroupDetails,
        logSelectedNodesGroups,
        hookGroupEvents
    };
    console.log('%c[GroupResearch] 已加载。可在控制台调用 groupResearch.logCurrentGroups() / logGroupDetails(idx) / hookGroupEvents()', 'color:#4caf50');
}


