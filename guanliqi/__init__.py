"""
ComfyUI 节点管理器插件
专注于节点分类和管理的侧边栏工具
"""

import os
import json
import logging
import subprocess
import sys
from aiohttp import web
import server

# 插件配置
WEB_DIRECTORY = "./js"
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

PLUGIN_NAME = "XiaoHaiNodeManager"
PLUGIN_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(PLUGIN_DIR, "data")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")
PLUGINS_DB_FILE = os.path.join(DATA_DIR, "plugins_database.json")
GITHUB_TOKEN_FILE = os.path.join(DATA_DIR, "github_token.txt")
MANAGED_PLUGINS_DIR = os.path.join(PLUGIN_DIR, "managed_plugins")

# 确保必要的目录存在
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MANAGED_PLUGINS_DIR, exist_ok=True)

# 配置日志
logger = logging.getLogger(PLUGIN_NAME)

# 自动迁移旧配置文件
OLD_CONFIG_FILE = os.path.join(PLUGIN_DIR, "config.json")
if os.path.exists(OLD_CONFIG_FILE) and not os.path.exists(CONFIG_FILE):
    try:
        import shutil
        shutil.move(OLD_CONFIG_FILE, CONFIG_FILE)
        logger.info(f"✓ 已将配置文件迁移到: {CONFIG_FILE}")
    except Exception as e:
        logger.warning(f"配置文件迁移失败: {e}")


# ========== 自动安装依赖 ==========
def install_package(package_name):
    """自动安装Python包"""
    try:
        logger.info(f"正在安装依赖包: {package_name}")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", package_name],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        logger.info(f"✓ 依赖包安装成功: {package_name}")
        return True
    except Exception as e:
        logger.error(f"✗ 依赖包安装失败: {package_name}, 错误: {e}")
        return False


def check_and_install_dependencies():
    """检查并安装必要的依赖"""
    dependencies = ['pypinyin']
    
    for package in dependencies:
        try:
            __import__(package)
            logger.info(f"✓ 依赖包已存在: {package}")
        except ImportError:
            logger.warning(f"⚠ 依赖包缺失: {package}，开始自动安装...")
            if not install_package(package):
                logger.error(f"✗ 无法安装 {package}，拼音搜索功能可能不可用")


# 检查并安装依赖
check_and_install_dependencies()

# 导入pypinyin（如果安装成功）
try:
    from pypinyin import lazy_pinyin, Style
    PYPINYIN_AVAILABLE = True
    logger.info("✓ pypinyin 加载成功，拼音搜索功能已启用")
except ImportError:
    PYPINYIN_AVAILABLE = False
    logger.warning("⚠ pypinyin 不可用，拼音搜索功能已禁用")


# ========== 动态加载 managed_plugins 目录下的节点 ==========
def load_managed_plugins():
    """
    动态加载 managed_plugins 目录下的所有插件节点
    """
    if not os.path.exists(MANAGED_PLUGINS_DIR):
        logger.warning(f"插件目录不存在: {MANAGED_PLUGINS_DIR}")
        return
    
    import sys
    import importlib
    
    # 将 managed_plugins 添加到 Python 路径
    if MANAGED_PLUGINS_DIR not in sys.path:
        sys.path.insert(0, MANAGED_PLUGINS_DIR)
    
    loaded_count = 0
    node_count = 0
    
    try:
        # 遍历 managed_plugins 目录
        for plugin_name in os.listdir(MANAGED_PLUGINS_DIR):
            plugin_path = os.path.join(MANAGED_PLUGINS_DIR, plugin_name)
            
            # 跳过非目录和隐藏文件
            if not os.path.isdir(plugin_path) or plugin_name.startswith('.') or plugin_name == '__pycache__':
                continue
            
            # 检查是否有 __init__.py
            init_file = os.path.join(plugin_path, '__init__.py')
            if not os.path.exists(init_file):
                logger.warning(f"跳过插件（缺少__init__.py）: {plugin_name}")
                continue
            
            try:
                # 动态导入插件模块
                logger.info(f"正在加载插件: {plugin_name}")
                module = importlib.import_module(plugin_name)
                
                # 获取节点映射
                if hasattr(module, 'NODE_CLASS_MAPPINGS'):
                    plugin_mappings = module.NODE_CLASS_MAPPINGS
                    NODE_CLASS_MAPPINGS.update(plugin_mappings)
                    
                    # 获取显示名称映射
                    if hasattr(module, 'NODE_DISPLAY_NAME_MAPPINGS'):
                        plugin_display_mappings = module.NODE_DISPLAY_NAME_MAPPINGS
                        NODE_DISPLAY_NAME_MAPPINGS.update(plugin_display_mappings)
                    
                    loaded_count += 1
                    node_count += len(plugin_mappings)
                    logger.info(f"✓ 已加载插件 [{plugin_name}]，包含 {len(plugin_mappings)} 个节点")
                else:
                    logger.warning(f"插件 [{plugin_name}] 没有导出 NODE_CLASS_MAPPINGS")
                
            except Exception as e:
                logger.error(f"✗ 加载插件 [{plugin_name}] 失败: {e}")
                import traceback
                traceback.print_exc()
                continue
    
    except Exception as e:
        logger.error(f"扫描插件目录失败: {e}")
    
    if loaded_count > 0:
        logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info(f"成功加载 {loaded_count} 个插件，共 {node_count} 个节点")
        logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")


# 在模块导入时立即加载托管插件
load_managed_plugins()


# ========== 建立模块名到文件夹名的映射 ==========
def build_module_to_folder_mapping():
    """
    扫描 custom_nodes 目录，建立模块名到文件夹名的映射
    用于处理文件夹名和模块名不一致的情况（如 bizyair -> bizyengine）
    """
    module_to_folder = {}
    
    # 获取 ComfyUI 的 custom_nodes 目录
    custom_nodes_dir = os.path.dirname(PLUGIN_DIR)
    
    if not os.path.exists(custom_nodes_dir):
        return module_to_folder
    
    try:
        import ast
        
        for folder_name in os.listdir(custom_nodes_dir):
            folder_path = os.path.join(custom_nodes_dir, folder_name)
            
            # 跳过非目录、隐藏文件夹和当前插件
            if not os.path.isdir(folder_path) or folder_name.startswith('.') or folder_name == '__pycache__':
                continue
            
            # 检查 __init__.py
            init_file = os.path.join(folder_path, '__init__.py')
            if not os.path.exists(init_file):
                continue
            
            try:
                # 读取 __init__.py 分析导入语句
                with open(init_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 尝试解析 AST
                try:
                    tree = ast.parse(content)
                    for node in ast.walk(tree):
                        # 查找 from xxx import 语句
                        if isinstance(node, ast.ImportFrom):
                            if node.module:
                                # 提取顶层模块名
                                top_module = node.module.split('.')[0]
                                # 如果不是相对导入
                                if not top_module.startswith('.'):
                                    module_to_folder[top_module] = folder_name
                        # 查找 import xxx 语句
                        elif isinstance(node, ast.Import):
                            for alias in node.names:
                                top_module = alias.name.split('.')[0]
                                module_to_folder[top_module] = folder_name
                except:
                    # 如果 AST 解析失败，使用简单的文本匹配
                    import re
                    # 匹配 from xxx import
                    from_imports = re.findall(r'from\s+([a-zA-Z_][a-zA-Z0-9_]*)', content)
                    for module in from_imports:
                        if module and not module.startswith('.'):
                            module_to_folder[module] = folder_name
                    
                    # 匹配 import xxx
                    imports = re.findall(r'^import\s+([a-zA-Z_][a-zA-Z0-9_]*)', content, re.MULTILINE)
                    for module in imports:
                        if module:
                            module_to_folder[module] = folder_name
                
            except Exception as e:
                logger.debug(f"分析插件 {folder_name} 时出错: {e}")
                continue
    
    except Exception as e:
        logger.error(f"建立模块映射时出错: {e}")
    
    logger.info(f"建立模块映射完成，共 {len(module_to_folder)} 个映射")
    return module_to_folder


# 全局模块映射表
MODULE_TO_FOLDER_MAP = build_module_to_folder_mapping()


def load_config():
    """加载配置文件"""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
                # 确保配置格式正确
                if 'folders' not in config:
                    config['folders'] = {}
                if 'settings' not in config:
                    config['settings'] = {}
                # 确保所有必需字段存在
                if 'hiddenPlugins' not in config:
                    config['hiddenPlugins'] = []
                if 'showHiddenPlugins' not in config:
                    config['showHiddenPlugins'] = False
                if 'folderNodes' not in config:
                    config['folderNodes'] = {}
                if 'nodeCustomNames' not in config:
                    config['nodeCustomNames'] = {}
                return config
        except Exception as e:
            logger.error(f"加载配置失败: {e}")
    
    # 默认配置
    return {
        "folders": {},
        "settings": {
            "auto_save": True
        },
        "hiddenPlugins": [],  # 隐藏的插件列表
        "showHiddenPlugins": False,  # 是否显示隐藏的插件
        "folderNodes": {},  # 文件夹中的节点 {folderId: [nodeIds]}
        "nodeCustomNames": {},  # 自定义节点名称（用于前缀功能）{nodeId: customName}
        "modal_auto_close_on_add": True  # Modal 添加节点后自动关闭
    }


def save_config(config):
    """保存配置文件"""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"保存配置失败: {e}")
        return False


# ========== API 路由 ==========

@server.PromptServer.instance.routes.get("/node-manager/config")
async def get_config(request):
    """获取配置"""
    try:
        config = load_config()
        return web.json_response({
            'success': True,
            'config': config
        })
    except Exception as e:
        logger.error(f"获取配置失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/config")
async def save_config_api(request):
    """保存配置"""
    try:
        data = await request.json()
        config = data.get('config', {})
        
        if save_config(config):
            return web.json_response({
                'success': True,
                'message': '配置已保存'
            })
        else:
            return web.json_response({
                'success': False,
                'error': '保存配置失败'
            }, status=500)
    except Exception as e:
        logger.error(f"保存配置失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/folder/create")
async def create_folder(request):
    """创建文件夹"""
    try:
        data = await request.json()
        folder_name = data.get('name', '').strip()
        parent_id = data.get('parent', None)
        
        if not folder_name:
            return web.json_response({
                'success': False,
                'error': '文件夹名称不能为空'
            }, status=400)
        
        config = load_config()
        
        # 计算层级
        level = 1
        if parent_id:
            parent = config['folders'].get(parent_id)
            if not parent:
                return web.json_response({
                    'success': False,
                    'error': '父文件夹不存在'
                }, status=400)
            level = parent.get('level', 1) + 1
            if level > 3:
                return web.json_response({
                    'success': False,
                    'error': '最多支持3级文件夹'
                }, status=400)
        
        # 生成唯一ID
        import time
        folder_id = f"folder_{int(time.time() * 1000)}"
        
        # 计算排序位置
        order = 0
        if parent_id:
            # 计算同级文件夹数量
            siblings = [f for f in config['folders'].values() 
                       if f.get('parent') == parent_id]
            order = len(siblings)
        else:
            # 根级文件夹
            root_folders = [f for f in config['folders'].values() 
                           if f.get('parent') is None]
            order = len(root_folders)
        
        # 创建文件夹
        config['folders'][folder_id] = {
            'name': folder_name,
            'parent': parent_id,
            'level': level,
            'order': order,
            'expanded': True
        }
        
        if save_config(config):
            return web.json_response({
                'success': True,
                'folder': {
                    'id': folder_id,
                    **config['folders'][folder_id]
                }
            })
        else:
            return web.json_response({
                'success': False,
                'error': '保存失败'
            }, status=500)
            
    except Exception as e:
        logger.error(f"创建文件夹失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/folder/rename")
async def rename_folder(request):
    """重命名文件夹"""
    try:
        data = await request.json()
        folder_id = data.get('id')
        new_name = data.get('name', '').strip()
        
        if not folder_id or not new_name:
            return web.json_response({
                'success': False,
                'error': '参数不完整'
            }, status=400)
        
        config = load_config()
        
        if folder_id not in config['folders']:
            return web.json_response({
                'success': False,
                'error': '文件夹不存在'
            }, status=404)
        
        config['folders'][folder_id]['name'] = new_name
        
        if save_config(config):
            return web.json_response({
                'success': True,
                'message': '重命名成功'
            })
        else:
            return web.json_response({
                'success': False,
                'error': '保存失败'
            }, status=500)
            
    except Exception as e:
        logger.error(f"重命名文件夹失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/folder/delete")
async def delete_folder(request):
    """删除文件夹"""
    try:
        data = await request.json()
        folder_ids = data.get('ids', [])
        
        if not folder_ids:
            return web.json_response({
                'success': False,
                'error': '未选择文件夹'
            }, status=400)
        
        config = load_config()
        
        # 递归获取所有子文件夹
        def get_all_children(parent_id):
            children = [parent_id]
            for fid, folder in config['folders'].items():
                if folder.get('parent') == parent_id:
                    children.extend(get_all_children(fid))
            return children
        
        # 收集所有要删除的文件夹
        to_delete = set()
        for folder_id in folder_ids:
            if folder_id in config['folders']:
                to_delete.update(get_all_children(folder_id))
        
        # 删除
        for folder_id in to_delete:
            if folder_id in config['folders']:
                del config['folders'][folder_id]
        
        if save_config(config):
            return web.json_response({
                'success': True,
                'message': f'已删除 {len(to_delete)} 个文件夹'
            })
        else:
            return web.json_response({
                'success': False,
                'error': '保存失败'
            }, status=500)
            
    except Exception as e:
        logger.error(f"删除文件夹失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/folder/move")
async def move_folder(request):
    """移动文件夹（拖拽）"""
    try:
        data = await request.json()
        folder_id = data.get('id')
        target_parent = data.get('target_parent', None)
        target_order = data.get('target_order', 0)
        
        if not folder_id:
            return web.json_response({
                'success': False,
                'error': '参数不完整'
            }, status=400)
        
        config = load_config()
        
        if folder_id not in config['folders']:
            return web.json_response({
                'success': False,
                'error': '文件夹不存在'
            }, status=404)
        
        folder = config['folders'][folder_id]
        
        # 检查是否移动到自己的子文件夹下
        def is_descendant(parent_id, child_id):
            if parent_id == child_id:
                return True
            for fid, f in config['folders'].items():
                if f.get('parent') == parent_id:
                    if is_descendant(fid, child_id):
                        return True
            return False
        
        if target_parent and is_descendant(folder_id, target_parent):
            return web.json_response({
                'success': False,
                'error': '不能移动到自己的子文件夹'
            }, status=400)
        
        # 计算新层级
        new_level = 1
        if target_parent:
            parent = config['folders'].get(target_parent)
            if not parent:
                return web.json_response({
                    'success': False,
                    'error': '目标父文件夹不存在'
                }, status=400)
            new_level = parent.get('level', 1) + 1
            if new_level > 3:
                return web.json_response({
                    'success': False,
                    'error': '最多支持3级文件夹'
                }, status=400)
        
        # 更新层级（递归更新子文件夹）
        def update_level(fid, level):
            config['folders'][fid]['level'] = level
            for child_id, child in config['folders'].items():
                if child.get('parent') == fid:
                    update_level(child_id, level + 1)
        
        # 更新父级和层级
        old_parent = folder.get('parent')
        folder['parent'] = target_parent
        update_level(folder_id, new_level)
        
        # 重新排序同级文件夹
        siblings = [fid for fid, f in config['folders'].items() 
                   if f.get('parent') == target_parent and fid != folder_id]
        siblings.insert(target_order, folder_id)
        
        for idx, fid in enumerate(siblings):
            config['folders'][fid]['order'] = idx
        
        # 重新排序原来父级下的文件夹
        if old_parent != target_parent:
            old_siblings = [fid for fid, f in config['folders'].items() 
                           if f.get('parent') == old_parent]
            for idx, fid in enumerate(sorted(old_siblings, 
                                            key=lambda x: config['folders'][x].get('order', 0))):
                config['folders'][fid]['order'] = idx
        
        if save_config(config):
            return web.json_response({
                'success': True,
                'message': '移动成功'
            })
        else:
            return web.json_response({
                'success': False,
                'error': '保存失败'
            }, status=500)
            
    except Exception as e:
        logger.error(f"移动文件夹失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/folder/toggle")
async def toggle_folder(request):
    """切换文件夹展开/折叠状态"""
    try:
        data = await request.json()
        folder_id = data.get('id')
        
        if not folder_id:
            return web.json_response({
                'success': False,
                'error': '参数不完整'
            }, status=400)
        
        config = load_config()
        
        if folder_id not in config['folders']:
            return web.json_response({
                'success': False,
                'error': '文件夹不存在'
            }, status=404)
        
        folder = config['folders'][folder_id]
        folder['expanded'] = not folder.get('expanded', True)
        
        if save_config(config):
            return web.json_response({
                'success': True,
                'expanded': folder['expanded']
            })
        else:
            return web.json_response({
                'success': False,
                'error': '保存失败'
            }, status=500)
            
    except Exception as e:
        logger.error(f"切换文件夹状态失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


# ========== 节点扫描功能 ==========

def scan_plugin_nodes():
    """扫描 managed_plugins 目录下的所有插件节点"""
    nodes = []
    plugins = {}
    
    if not os.path.exists(MANAGED_PLUGINS_DIR):
        logger.warning(f"插件目录不存在: {MANAGED_PLUGINS_DIR}")
        return {'nodes': nodes, 'plugins': plugins}
    
    try:
        # 遍历 managed_plugins 目录
        for plugin_name in os.listdir(MANAGED_PLUGINS_DIR):
            plugin_path = os.path.join(MANAGED_PLUGINS_DIR, plugin_name)
            
            # 跳过非目录和隐藏文件
            if not os.path.isdir(plugin_path) or plugin_name.startswith('.'):
                continue
            
            # 检查是否有 __init__.py
            init_file = os.path.join(plugin_path, '__init__.py')
            if not os.path.exists(init_file):
                continue
            
            try:
                # 读取 __init__.py 内容
                with open(init_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 尝试提取 NODE_CLASS_MAPPINGS 和 NODE_DISPLAY_NAME_MAPPINGS
                node_mappings = {}
                display_mappings = {}
                
                # 简单的方式：执行模块并获取变量
                # 注意：这里为了安全起见，暂时使用简单的字符串解析
                # 生产环境应该使用更安全的方式
                import re
                
                # 提取 NODE_CLASS_MAPPINGS
                mappings_match = re.search(r'NODE_CLASS_MAPPINGS\s*=\s*\{([^}]*)\}', content, re.DOTALL)
                if mappings_match:
                    # 这里简化处理，实际应该动态导入模块
                    pass
                
                # 为了演示，我们假设插件有一些示例节点
                # 实际使用时需要动态导入模块
                plugin_info = {
                    'name': plugin_name,
                    'path': plugin_path,
                    'node_count': 0
                }
                
                plugins[plugin_name] = plugin_info
                
                logger.info(f"已扫描插件: {plugin_name}")
                
            except Exception as e:
                logger.error(f"扫描插件 {plugin_name} 失败: {e}")
                continue
    
    except Exception as e:
        logger.error(f"扫描插件目录失败: {e}")
    
    return {'nodes': nodes, 'plugins': plugins}


def get_custom_nodes_dir():
    """获取 custom_nodes 目录路径"""
    # 当前插件在 custom_nodes/888888/
    # 向上两级就是 ComfyUI 根目录
    comfyui_root = os.path.dirname(os.path.dirname(PLUGIN_DIR))
    custom_nodes_dir = os.path.join(comfyui_root, 'custom_nodes')
    return custom_nodes_dir


def scan_custom_nodes_folders():
    """扫描 custom_nodes 目录下的所有插件文件夹"""
    plugins = []
    custom_nodes_dir = get_custom_nodes_dir()
    
    if not os.path.exists(custom_nodes_dir):
        logger.warning(f"custom_nodes 目录不存在: {custom_nodes_dir}")
        return plugins
    
    try:
        for item_name in os.listdir(custom_nodes_dir):
            item_path = os.path.join(custom_nodes_dir, item_name)
            
            # 跳过非目录和隐藏文件
            if not os.path.isdir(item_path):
                continue
            if item_name.startswith('.'):
                continue
            if item_name == '__pycache__':
                continue
            
            # 记录插件文件夹
            plugin_info = {
                'name': item_name,
                'path': item_path,
                'has_init': os.path.exists(os.path.join(item_path, '__init__.py')),
                'node_count': 0
            }
            
            plugins.append(plugin_info)
            logger.info(f"发现插件文件夹: {item_name}")
        
        logger.info(f"共发现 {len(plugins)} 个插件文件夹")
        
    except Exception as e:
        logger.error(f"扫描 custom_nodes 目录失败: {e}")
    
    return plugins


def get_comfyui_nodes():
    """获取 ComfyUI 所有已注册的节点"""
    nodes = []
    
    try:
        # 获取 ComfyUI 的 NODE_CLASS_MAPPINGS
        import nodes as comfy_nodes
        
        if hasattr(comfy_nodes, 'NODE_CLASS_MAPPINGS'):
            node_mappings = comfy_nodes.NODE_CLASS_MAPPINGS
            display_mappings = getattr(comfy_nodes, 'NODE_DISPLAY_NAME_MAPPINGS', {})
            
            for node_id, node_class in node_mappings.items():
                try:
                    # 获取节点信息
                    display_name = display_mappings.get(node_id, node_id)
                    
                    # 获取节点分类（如果有）
                    category = ""
                    if hasattr(node_class, 'CATEGORY'):
                        category = node_class.CATEGORY
                    
                    # 获取节点描述（如果有）
                    description = ""
                    if hasattr(node_class, 'DESCRIPTION'):
                        description = node_class.DESCRIPTION
                    elif node_class.__doc__:
                        description = node_class.__doc__.strip()
                    
                    # 判断来源 - 改进的识别逻辑
                    source = "ComfyUI"
                    if hasattr(node_class, '__module__'):
                        module_name = node_class.__module__
                        
                        # 方法1: 检查是否包含 custom_nodes (各种格式)
                        if 'custom_nodes' in module_name:
                            # Windows路径: F:\ai\ComfyUI\custom_nodes\plugin-name
                            if '\\custom_nodes\\' in module_name:
                                after_custom = module_name.split('\\custom_nodes\\')[1]
                                plugin_folder = after_custom.split('\\')[0]
                                # 处理 plugin-name.submodule 的情况，只取插件名
                                plugin_folder = plugin_folder.split('.')[0]
                                source = plugin_folder
                            # Unix路径: /path/to/custom_nodes/plugin-name
                            elif '/custom_nodes/' in module_name:
                                after_custom = module_name.split('/custom_nodes/')[1]
                                plugin_folder = after_custom.split('/')[0]
                                # 处理 plugin-name.submodule 的情况，只取插件名
                                plugin_folder = plugin_folder.split('.')[0]
                                source = plugin_folder
                            # 点分隔: custom_nodes.plugin_name.xxx
                            else:
                                parts = module_name.split('.')
                                if len(parts) >= 2:
                                    # custom_nodes.plugin_name -> plugin_name
                                    source = parts[1]
                        
                        # 方法2: 不包含 custom_nodes 但也不是内置节点
                        elif not module_name.startswith('nodes.') and not module_name.startswith('comfy.'):
                            # 直接从模块名提取第一部分
                            parts = module_name.split('.')
                            if len(parts) > 0 and parts[0] and parts[0] not in ['nodes', 'comfy']:
                                source = parts[0]
                        
                        # 方法3: 使用模块映射表（处理文件夹名和模块名不一致的情况）
                        # 例如 bizyair -> bizyengine, Hello nano banana -> Gemini_Imagen_Generator
                        if source != "ComfyUI" and source in MODULE_TO_FOLDER_MAP:
                            source = MODULE_TO_FOLDER_MAP[source]
                    
                    nodes.append({
                        'id': node_id,
                        'display_name': display_name,
                        'category': category,
                        'description': description,
                        'source': source,
                        'class_type': node_id
                    })
                    
                except Exception as e:
                    logger.error(f"处理节点 {node_id} 失败: {e}")
                    continue
        
        # 统计各来源的节点数量
        source_stats = {}
        for node in nodes:
            source = node.get('source', 'Unknown')
            source_stats[source] = source_stats.get(source, 0) + 1
        
        logger.info(f"获取到 {len(nodes)} 个已注册节点")
        logger.info(f"节点来源统计: {len(source_stats)} 个来源")
        
        # 显示前10个来源（按节点数排序）
        sorted_sources = sorted(source_stats.items(), key=lambda x: x[1], reverse=True)[:10]
        for source, count in sorted_sources:
            logger.info(f"  - {source}: {count} 个节点")
        
    except Exception as e:
        logger.error(f"获取 ComfyUI 节点失败: {e}")
    
    return nodes


@server.PromptServer.instance.routes.get("/node-manager/node-sources")
async def get_node_sources(request):
    """获取节点到插件来源的映射 (轻量级)"""
    try:
        all_nodes = get_comfyui_nodes()
        
        # 构建 node_id -> source 映射
        node_sources = {}
        for node in all_nodes:
            node_sources[node['id']] = node['source']
        
        return web.json_response({
            'success': True,
            'node_sources': node_sources
        })
        
    except Exception as e:
        logger.error(f"获取节点来源映射失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.get("/node-manager/nodes")
async def get_nodes(request):
    """获取所有节点列表"""
    try:
        # 获取 ComfyUI 所有已注册节点
        all_nodes = get_comfyui_nodes()
        
        # 按插件分组
        plugins_map = {}
        for node in all_nodes:
            source = node['source']
            if source not in plugins_map:
                plugins_map[source] = {
                    'name': source,
                    'nodes': [],
                    'node_count': 0
                }
            plugins_map[source]['nodes'].append(node)
            plugins_map[source]['node_count'] += 1
        
        return web.json_response({
            'success': True,
            'nodes': all_nodes,
            'plugins': list(plugins_map.values()),
            'total_count': len(all_nodes)
        })
        
    except Exception as e:
        logger.error(f"获取节点列表失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


def normalize_plugin_name(name):
    """标准化插件名称，用于匹配"""
    # 将连字符转为下划线，统一大小写
    return name.replace('-', '_').lower()


def build_category_tree(nodes_by_plugin):
    """为每个插件构建分类树"""
    plugin_trees = {}
    
    for plugin_name, nodes in nodes_by_plugin.items():
        # 构建分类树
        category_tree = {}
        
        for node in nodes:
            category = node.get('category', '')
            if not category:
                # 没有分类的节点，放到根目录
                if '_root_nodes' not in category_tree:
                    category_tree['_root_nodes'] = []
                category_tree['_root_nodes'].append(node)
                continue
            
            # 分割分类路径
            parts = [p.strip() for p in category.split('/') if p.strip()]
            
            if not parts:
                # 空分类，放到根目录
                if '_root_nodes' not in category_tree:
                    category_tree['_root_nodes'] = []
                category_tree['_root_nodes'].append(node)
                continue
            
            # 智能去除插件名前缀
            # 比如 "EasyUse/实用工具" -> "实用工具"
            # 尝试匹配插件名的各种变体
            first_part = parts[0]
            plugin_name_variations = [
                plugin_name,  # 原始名称
                plugin_name.replace('-', ''),  # 去连字符
                plugin_name.replace('_', ''),  # 去下划线
                plugin_name.replace('-', ' '),  # 连字符转空格
                plugin_name.replace('_', ' '),  # 下划线转空格
                plugin_name.lower(),  # 小写
                plugin_name.upper(),  # 大写
                ''.join(word.capitalize() for word in plugin_name.replace('-', ' ').replace('_', ' ').split())  # PascalCase
            ]
            
            # 检查第一部分是否是插件名的某个变体
            should_skip_first = False
            for variation in plugin_name_variations:
                if first_part.lower() == variation.lower():
                    should_skip_first = True
                    break
            
            # 如果第一部分是插件名，跳过它
            if should_skip_first and len(parts) > 1:
                parts = parts[1:]
            
            # 构建树结构
            current = category_tree
            for part in parts:
                if part not in current:
                    current[part] = {'_nodes': [], '_children': {}}
                current = current[part]['_children']
            
            # 添加节点到叶子分类
            parent = category_tree
            for part in parts[:-1]:
                parent = parent[part]['_children']
            if parts:
                parent[parts[-1]]['_nodes'].append(node)
        
        plugin_trees[plugin_name] = category_tree
    
    return plugin_trees


@server.PromptServer.instance.routes.get("/node-manager/debug/nodes")
async def debug_nodes(request):
    """调试：查看节点的模块信息"""
    try:
        import nodes as comfy_nodes
        
        all_nodes_debug = []
        
        if hasattr(comfy_nodes, 'NODE_CLASS_MAPPINGS'):
            node_mappings = comfy_nodes.NODE_CLASS_MAPPINGS
            display_mappings = getattr(comfy_nodes, 'NODE_DISPLAY_NAME_MAPPINGS', {})
            
            for node_id, node_class in node_mappings.items():
                module_name = node_class.__module__ if hasattr(node_class, '__module__') else 'Unknown'
                display_name = display_mappings.get(node_id, node_id)
                
                # 判断来源 - 使用和 get_comfyui_nodes 一样的逻辑
                source = "ComfyUI"
                if hasattr(node_class, '__module__'):
                    # 尝试从模块的 __file__ 属性获取实际文件路径（最准确）
                    try:
                        import sys
                        if module_name in sys.modules:
                            module_obj = sys.modules[module_name]
                            if hasattr(module_obj, '__file__') and module_obj.__file__:
                                file_path = module_obj.__file__
                                # 标准化路径分隔符
                                file_path = file_path.replace('\\', '/')
                                
                                # 查找 custom_nodes 目录
                                if '/custom_nodes/' in file_path:
                                    # 提取 custom_nodes 后的第一个文件夹名
                                    after_custom = file_path.split('/custom_nodes/')[1]
                                    plugin_folder = after_custom.split('/')[0]
                                    source = plugin_folder
                    except:
                        pass
                    
                    # 如果 __file__ 不可用，回退到解析 __module__
                    if source == "ComfyUI" and 'custom_nodes' in module_name:
                        if '\\custom_nodes\\' in module_name:
                            after_custom = module_name.split('\\custom_nodes\\')[1]
                            plugin_folder = after_custom.split('\\')[0]
                            plugin_folder = plugin_folder.split('.')[0]
                            source = plugin_folder
                        elif '/custom_nodes/' in module_name:
                            after_custom = module_name.split('/custom_nodes/')[1]
                            plugin_folder = after_custom.split('/')[0]
                            plugin_folder = plugin_folder.split('.')[0]
                            source = plugin_folder
                        else:
                            parts = module_name.split('.')
                            if len(parts) >= 2:
                                source = parts[1]
                    
                    # 如果还是 ComfyUI，尝试从模块名提取
                    if source == "ComfyUI" and not module_name.startswith('nodes.') and not module_name.startswith('comfy.'):
                        parts = module_name.split('.')
                        if len(parts) > 0 and parts[0] and parts[0] not in ['nodes', 'comfy']:
                            module_source = parts[0]
                            
                            # 使用模块映射表（处理文件夹名和模块名不一致的情况）
                            if module_source in MODULE_TO_FOLDER_MAP:
                                source = MODULE_TO_FOLDER_MAP[module_source]
                            else:
                                source = module_source
                
                all_nodes_debug.append({
                    'id': node_id,
                    'display_name': display_name,
                    'module': module_name,
                    'detected_source': source
                })
        
        return web.json_response({
            'success': True,
            'all_nodes': all_nodes_debug,
            'total_nodes': len(all_nodes_debug)
        })
        
    except Exception as e:
        logger.error(f"调试节点信息失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.get("/node-manager/plugins")
async def get_plugins(request):
    """获取所有插件文件夹列表（带分类树，包含重复检测）"""
    try:
        # 1. 扫描 custom_nodes 目录
        plugins = scan_custom_nodes_folders()
        
        # 2. 扫描 managed_plugins 目录
        managed_plugins = []
        if os.path.exists(MANAGED_PLUGINS_DIR):
            for folder in os.listdir(MANAGED_PLUGINS_DIR):
                folder_path = os.path.join(MANAGED_PLUGINS_DIR, folder)
                if os.path.isdir(folder_path) and not folder.startswith('.'):
                    managed_plugins.append(folder)
        
        # 3. 检测重复（同时在两个目录）
        managed_set = set(managed_plugins)
        for plugin in plugins:
            if plugin['name'] in managed_set:
                plugin['is_duplicate'] = True
                plugin['duplicate_source'] = 'managed_plugins'
            else:
                plugin['is_duplicate'] = False
        
        # 获取已注册的节点
        all_nodes = get_comfyui_nodes()
        
        # 按插件分组节点
        nodes_by_plugin = {}
        for node in all_nodes:
            source = node['source']
            if source not in nodes_by_plugin:
                nodes_by_plugin[source] = []
            nodes_by_plugin[source].append(node)
        
        # 构建分类树
        category_trees = build_category_tree(nodes_by_plugin)
        
        # 创建标准化映射
        for plugin in plugins:
            folder_name = plugin['name']
            # 尝试多种匹配方式
            # 1. 直接匹配
            if folder_name in nodes_by_plugin:
                plugin['node_count'] = len(nodes_by_plugin[folder_name])
                plugin['python_name'] = folder_name
                plugin['categories'] = category_trees.get(folder_name, {})
            else:
                # 2. 标准化匹配（连字符转下划线）
                normalized_folder = normalize_plugin_name(folder_name)
                found = False
                
                for source in nodes_by_plugin.keys():
                    normalized_source = normalize_plugin_name(source)
                    if normalized_folder == normalized_source:
                        plugin['node_count'] = len(nodes_by_plugin[source])
                        plugin['python_name'] = source  # 保存实际的Python模块名
                        plugin['categories'] = category_trees.get(source, {})
                        found = True
                        break
                
                if not found:
                    plugin['node_count'] = 0
                    plugin['python_name'] = folder_name
                    plugin['categories'] = {}
            
            plugin['has_nodes'] = plugin['node_count'] > 0
        
        # 按节点数量排序，节点多的在前
        plugins.sort(key=lambda x: x['node_count'], reverse=True)
        
        return web.json_response({
            'success': True,
            'plugins': plugins,
            'total_count': len(plugins)
        })
        
    except Exception as e:
        logger.error(f"获取插件列表失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/plugin/toggle-hidden")
async def toggle_hidden_plugins(request):
    """切换插件的隐藏状态"""
    try:
        data = await request.json()
        plugin_names = data.get('pluginNames', [])
        action = data.get('action', 'hide')  # 'hide' 或 'show'
        
        config = load_config()
        if 'hiddenPlugins' not in config:
            config['hiddenPlugins'] = []
        
        hidden_set = set(config['hiddenPlugins'])
        
        if action == 'hide':
            hidden_set.update(plugin_names)
        else:  # show
            hidden_set.difference_update(plugin_names)
        
        config['hiddenPlugins'] = list(hidden_set)
        save_config(config)
        
        return web.json_response({
            'success': True,
            'hiddenPlugins': config['hiddenPlugins']
        })
    except Exception as e:
        logger.error(f"切换插件隐藏状态失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/plugin/toggle-show-hidden")
async def toggle_show_hidden(request):
    """切换是否显示隐藏的插件"""
    try:
        data = await request.json()
        show_hidden = data.get('showHidden', False)
        
        config = load_config()
        config['showHiddenPlugins'] = show_hidden
        save_config(config)
        
        return web.json_response({
            'success': True,
            'showHiddenPlugins': show_hidden
        })
    except Exception as e:
        logger.error(f"切换显示隐藏插件失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/plugin/delete")
async def delete_plugins(request):
    """删除插件（真删除文件系统）"""
    try:
        data = await request.json()
        plugin_names = data.get('pluginNames', [])
        
        if not plugin_names:
            return web.json_response({
                'error': '未指定要删除的插件'
            }, status=400)
        
        # 获取 ComfyUI 的 custom_nodes 目录
        comfy_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        custom_nodes_dir = os.path.join(comfy_path, 'custom_nodes')
        
        deleted = []
        errors = []
        
        for plugin_name in plugin_names:
            try:
                plugin_path = os.path.join(custom_nodes_dir, plugin_name)
                
                # 安全检查：确保路径在 custom_nodes 目录内
                if not os.path.realpath(plugin_path).startswith(os.path.realpath(custom_nodes_dir)):
                    raise ValueError(f"非法路径: {plugin_name}")
                
                # 检查插件目录是否存在
                if not os.path.exists(plugin_path):
                    errors.append({
                        'plugin': plugin_name,
                        'error': '插件目录不存在'
                    })
                    continue
                
                # 检查是否是目录
                if not os.path.isdir(plugin_path):
                    errors.append({
                        'plugin': plugin_name,
                        'error': '路径不是目录'
                    })
                    continue
                
                # 删除目录
                import shutil
                shutil.rmtree(plugin_path)
                logger.info(f"✓ 已删除插件: {plugin_name}")
                deleted.append(plugin_name)
                
            except Exception as e:
                logger.error(f"✗ 删除插件失败: {plugin_name}, 错误: {e}")
                errors.append({
                    'plugin': plugin_name,
                    'error': str(e)
                })
        
        # 从配置中移除已删除插件的隐藏状态
        if deleted:
            config = load_config()
            hidden_plugins = config.get('hiddenPlugins', [])
            config['hiddenPlugins'] = [p for p in hidden_plugins if p not in deleted]
            save_config(config)
        
        response_data = {
            'success': len(deleted) > 0,
            'deleted': deleted,
            'errors': errors,
            'message': f'成功删除 {len(deleted)} 个插件' + (f'，{len(errors)} 个失败' if errors else '')
        }
        
        if len(deleted) > 0:
            return web.json_response(response_data)
        else:
            return web.json_response(response_data, status=400)
            
    except Exception as e:
        logger.error(f"删除插件失败: {e}")
        return web.json_response({
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/search/pinyin")
async def get_pinyin_data(request):
    """获取文本的拼音数据（用于前端搜索）"""
    try:
        if not PYPINYIN_AVAILABLE:
            return web.json_response({
                'success': False,
                'error': 'pypinyin 不可用'
            }, status=503)
        
        data = await request.json()
        texts = data.get('texts', [])
        
        if not isinstance(texts, list):
            return web.json_response({
                'success': False,
                'error': '参数 texts 必须是数组'
            }, status=400)
        
        # 批量获取拼音
        result = {}
        for text in texts:
            if not text or not isinstance(text, str):
                continue
            
            # 获取拼音首字母（小写）
            pinyin_initials = ''.join([py[0].lower() for py in lazy_pinyin(text, style=Style.FIRST_LETTER)])
            
            # 获取全拼（小写，用于更精确的匹配）
            pinyin_full = ''.join(lazy_pinyin(text, style=Style.NORMAL))
            
            result[text] = {
                'initials': pinyin_initials,  # 首字母：jzq
                'full': pinyin_full.lower()    # 全拼：jiazaiqi
            }
        
        return web.json_response({
            'success': True,
            'data': result,
            'count': len(result)
        })
        
    except Exception as e:
        logger.error(f"获取拼音数据失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


def load_github_token():
    """加载GitHub Token"""
    try:
        if os.path.exists(GITHUB_TOKEN_FILE):
            with open(GITHUB_TOKEN_FILE, 'r', encoding='utf-8') as f:
                token = f.read().strip()
                if token:
                    return token
    except Exception as e:
        logger.error(f"读取GitHub Token失败: {e}")
    return None


def load_plugins_database():
    """从数据库加载插件数据"""
    try:
        if os.path.exists(PLUGINS_DB_FILE):
            with open(PLUGINS_DB_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"读取插件数据库失败: {e}")
    return None


def save_plugins_database(data):
    """保存插件数据到数据库"""
    try:
        with open(PLUGINS_DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"保存插件数据库失败: {e}")
        return False


def merge_stars_to_plugins(plugins, stars_db):
    """将stars数据合并到插件列表"""
    for plugin in plugins:
        github_url = plugin.get('reference', '')
        if github_url.startswith('https://github.com/'):
            repo_path = github_url.replace('https://github.com/', '').replace('.git', '').rstrip('/')
            repo_key = '/'.join(repo_path.split('/')[:2])  # owner/repo
            if repo_key in stars_db:
                plugin['stars'] = stars_db[repo_key]
            else:
                plugin['stars'] = 0
        else:
            plugin['stars'] = 0
    return plugins


@server.PromptServer.instance.routes.get("/node-manager/store/available-plugins")
async def get_available_plugins(request):
    """获取可用插件列表（从数据库或GitHub）"""
    try:
        import aiohttp
        import asyncio
        from datetime import datetime, timedelta
        
        # 检查是否强制刷新（通过URL参数t或force_refresh）
        force_refresh = 't' in request.query or 'force_refresh' in request.query
        
        if force_refresh:
            logger.info("[插件商店] 🔄 强制刷新模式，跳过缓存")
        
        # 1. 尝试从数据库加载
        db_data = load_plugins_database()
        
        # 2. 检查数据库是否有效（1小时内），除非强制刷新
        if db_data and not force_refresh:
            last_update = db_data.get('last_update')
            if last_update:
                last_time = datetime.fromisoformat(last_update)
                if datetime.now() - last_time < timedelta(hours=1):
                    # 数据库有效，直接使用
                    installed_plugins = scan_custom_nodes_folders()
                    installed_names = {p['name'] for p in installed_plugins}
                    
                    # 获取插件列表和stars数据库
                    plugins = db_data.get('plugins', [])
                    stars_db = db_data.get('stars_db', {})
                    
                    # 更新安装状态和stars（关键修复：从stars_db重新合并stars）
                    for plugin in plugins:
                        plugin_name = plugin.get('plugin_name', '')
                        plugin['is_installed'] = plugin_name in installed_names
                        
                        # 从stars_db更新stars（修复缓存中stars为0的问题）
                        github_url = plugin.get('reference', '')
                        if github_url.startswith('https://github.com/'):
                            repo_path = github_url.replace('https://github.com/', '').replace('.git', '').rstrip('/')
                            repo_key = '/'.join(repo_path.split('/')[:2])
                            plugin['stars'] = stars_db.get(repo_key, 0)
                    
                    # 统计stars来源（缓存数据中也应该有stars_source字段）
                    local_count = sum(1 for p in plugins if p.get('stars_source') == 'local')
                    manager_count = sum(1 for p in plugins if p.get('stars_source') == 'manager')
                    none_count = sum(1 for p in plugins if p.get('stars_source') == 'none')
                    
                    logger.info(f"✓ 从缓存返回插件列表，共 {len(plugins)} 个插件")
                    logger.info(f"  - Stars来源: 本地{local_count} / Manager{manager_count} / 无{none_count}")
                    
                    return web.json_response({
                        'success': True,
                        'plugins': plugins,
                        'total_count': len(plugins),
                        'installed_count': len(installed_names),
                        'from_cache': True,
                        'stars_stats': {
                            'local': local_count,
                            'manager': manager_count,
                            'none': none_count
                        }
                    })
        
        # 3. 从GitHub获取最新数据
        plugin_list_url = "https://raw.githubusercontent.com/ltdrdata/ComfyUI-Manager/main/custom-node-list.json"
        github_stats_url = "https://raw.githubusercontent.com/ltdrdata/ComfyUI-Manager/main/github-stats.json"
        timeout = aiohttp.ClientTimeout(total=30)
        
        async with aiohttp.ClientSession(timeout=timeout) as session:
            # 获取插件列表
            async with session.get(plugin_list_url) as response:
                if response.status != 200:
                    raise Exception(f"获取插件列表失败: HTTP {response.status}")
                
                text = await response.text()
                plugin_data = json.loads(text)
            
            # 尝试获取ComfyUI-Manager的github-stats.json（预处理的stars数据）
            manager_stars = {}
            try:
                async with session.get(github_stats_url) as response:
                    if response.status == 200:
                        text = await response.text()
                        stats_data = json.loads(text)
                        # ComfyUI-Manager的格式：{ "owner/repo": { "stars": 123, ... }, ... }
                        for repo_key, repo_data in stats_data.items():
                            if isinstance(repo_data, dict) and 'stars' in repo_data:
                                manager_stars[repo_key] = repo_data['stars']
                        logger.info(f"✓ 成功获取ComfyUI-Manager的Stars数据，共 {len(manager_stars)} 个仓库")
            except Exception as e:
                logger.warning(f"⚠️ 获取ComfyUI-Manager的Stars数据失败: {e}")
                logger.warning(f"⚠️ 将仅使用本地stars_db数据")
            
            installed_plugins = scan_custom_nodes_folders()
            installed_names = {p['name'] for p in installed_plugins}
            
            custom_nodes = plugin_data.get('custom_nodes', [])
            
            # 处理插件数据
            for node in custom_nodes:
                if 'reference' in node:
                    github_url = node['reference']
                    if github_url.startswith('https://github.com/'):
                        repo_path = github_url.replace('https://github.com/', '').rstrip('/')
                        repo_path = repo_path.rstrip('.git')
                        plugin_name = repo_path.split('/')[-1]
                        node['plugin_name'] = plugin_name
                        node['is_installed'] = plugin_name in installed_names
                    else:
                        node['plugin_name'] = node.get('title', 'Unknown')
                        node['is_installed'] = False
                else:
                    node['plugin_name'] = node.get('title', 'Unknown')
                    node['is_installed'] = False
                
                # 合并stars数据（优先级：本地stars_db > Manager的github-stats > 0）
                github_url = node.get('reference', '')
                if github_url.startswith('https://github.com/'):
                    repo_path = github_url.replace('https://github.com/', '').replace('.git', '').rstrip('/')
                    repo_key = '/'.join(repo_path.split('/')[:2])
                    
                    # 优先使用本地stars_db（我们自己更新的）
                    if db_data and 'stars_db' in db_data and repo_key in db_data['stars_db']:
                        node['stars'] = db_data['stars_db'][repo_key]
                        node['stars_source'] = 'local'  # 标记来源
                    # 其次使用ComfyUI-Manager的数据
                    elif repo_key in manager_stars:
                        node['stars'] = manager_stars[repo_key]
                        node['stars_source'] = 'manager'  # 标记来源
                    else:
                        node['stars'] = 0
                        node['stars_source'] = 'none'
                else:
                    node['stars'] = 0
                    node['stars_source'] = 'none'
            
            # ✅ 循环结束后，合并Manager的stars到本地stars_db（作为备份）
            merged_stars_db = db_data.get('stars_db', {}) if db_data else {}
            for repo_key, stars in manager_stars.items():
                # 只有本地没有这个repo的数据时，才使用Manager的
                if repo_key not in merged_stars_db:
                    merged_stars_db[repo_key] = stars
            
            # 保存到数据库
            save_data = {
                'last_update': datetime.now().isoformat(),
                'plugins': custom_nodes,
                'stars_db': merged_stars_db
            }
            save_plugins_database(save_data)
            
            # 统计stars来源
            local_count = sum(1 for n in custom_nodes if n.get('stars_source') == 'local')
            manager_count = sum(1 for n in custom_nodes if n.get('stars_source') == 'manager')
            none_count = sum(1 for n in custom_nodes if n.get('stars_source') == 'none')
            
            logger.info(f"✓ 插件列表已保存到数据库，共 {len(custom_nodes)} 个插件")
            logger.info(f"  - Stars来源统计: 本地{local_count} / Manager{manager_count} / 无{none_count}")
            
            return web.json_response({
                'success': True,
                'plugins': custom_nodes,
                'total_count': len(custom_nodes),
                'installed_count': len(installed_names),
                'from_cache': False,
                'stars_stats': {
                    'local': local_count,
                    'manager': manager_count,
                    'none': none_count
                },
                'need_update_stars': none_count > 100  # 如果超过100个插件没有stars，建议更新
            })
        
    except asyncio.TimeoutError:
        logger.error("获取插件列表超时")
        return web.json_response({
            'success': False,
            'error': '请求超时，请检查网络连接'
        }, status=504)
    except Exception as e:
        logger.error(f"获取插件列表失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/store/update-stars-batch")
async def update_stars_batch(request):
    """批量更新指定插件的Stars（用于懒加载）"""
    try:
        import aiohttp
        import asyncio
        
        # 获取请求参数
        body = await request.json()
        repo_keys = body.get('repo_keys', [])
        
        if not repo_keys:
            return web.json_response({
                'success': False,
                'error': '未提供repo_keys'
            }, status=400)
        
        logger.info(f"[懒加载] 收到批量更新请求，共 {len(repo_keys)} 个插件")
        
        # 加载GitHub Token
        github_token = load_github_token()
        headers = {'Accept': 'application/vnd.github.v3+json'}
        if github_token:
            headers['Authorization'] = f'token {github_token}'
        
        # 加载数据库
        db_data = load_plugins_database()
        if not db_data:
            return web.json_response({
                'success': False,
                'error': '数据库未初始化'
            }, status=400)
        
        stars_db = db_data.get('stars_db', {})
        
        # 获取stars数据
        async def fetch_repo_stars(session, repo_key):
            try:
                # 如果已经有数据，跳过
                if repo_key in stars_db and stars_db[repo_key] > 0:
                    return repo_key, stars_db[repo_key], 'cached'
                
                api_url = f"https://api.github.com/repos/{repo_key}"
                async with session.get(api_url, headers=headers) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return repo_key, data.get('stargazers_count', 0), 'fetched'
                    else:
                        return repo_key, stars_db.get(repo_key, 0), 'error'
            except Exception as e:
                logger.debug(f"[懒加载] 获取 {repo_key} 失败: {e}")
                return repo_key, stars_db.get(repo_key, 0), 'error'
        
        timeout = aiohttp.ClientTimeout(total=10)
        results = {}
        
        async with aiohttp.ClientSession(timeout=timeout) as session:
            tasks = [fetch_repo_stars(session, repo_key) for repo_key in repo_keys]
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            updated_count = 0
            for response in responses:
                if isinstance(response, tuple):
                    repo_key, stars, source = response
                    results[repo_key] = stars
                    if source == 'fetched':
                        stars_db[repo_key] = stars
                        updated_count += 1
        
        # 更新数据库
        if updated_count > 0:
            db_data['stars_db'] = stars_db
            save_plugins_database(db_data)
            logger.info(f"[懒加载] ✓ 更新了 {updated_count} 个插件的stars")
        
        return web.json_response({
            'success': True,
            'results': results,
            'updated': updated_count,
            'total': len(repo_keys)
        })
    
    except Exception as e:
        logger.error(f"[懒加载] 批量更新失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/store/update-stars")
async def update_stars_database(request):
    """后台更新插件Stars数据"""
    try:
        import aiohttp
        import asyncio
        import time
        
        start_time = time.time()
        
        # 检查是否强制全量更新
        try:
            body = await request.json()
            force_full_update = body.get('force_full', False)
        except:
            force_full_update = False
        
        if force_full_update:
            logger.info("[Stars更新] 🔄 强制全量更新模式")
        else:
            logger.info("[Stars更新] 📊 增量更新模式（只更新缺失的stars）")
        
        # 加载GitHub Token（如果有）
        github_token = load_github_token()
        if github_token:
            logger.info("[Stars更新] ✓ 使用GitHub Token认证（限额: 5000次/小时）")
        else:
            logger.warning("[Stars更新] ⚠️ 未配置GitHub Token，使用未认证请求（限额: 60次/小时）")
            logger.warning("[Stars更新] ⚠️ 建议在 data/github_token.txt 中配置Token")
        
        # 从数据库加载插件列表
        db_data = load_plugins_database()
        if not db_data or 'plugins' not in db_data:
            logger.error("[Stars更新] 数据库为空或没有plugins字段")
            return web.json_response({
                'success': False,
                'error': '请先加载插件列表'
            }, status=400)
        
        plugins = db_data['plugins']
        stars_db = db_data.get('stars_db', {})
        
        logger.info(f"[Stars更新] 数据库中有 {len(plugins)} 个插件")
        logger.info(f"[Stars更新] 当前stars_db中有 {len(stars_db)} 条数据")
        
        # 筛选有GitHub URL的插件
        all_github_plugins = []
        plugins_to_update = []
        
        for plugin in plugins:
            github_url = plugin.get('reference', '')
            if github_url.startswith('https://github.com/'):
                repo_path = github_url.replace('https://github.com/', '').replace('.git', '').rstrip('/')
                repo_key = '/'.join(repo_path.split('/')[:2])
                all_github_plugins.append((plugin, repo_key))
                
                # 增量更新：只更新没有stars数据的插件（除非强制全量更新）
                if force_full_update or repo_key not in stars_db or stars_db.get(repo_key, 0) == 0:
                    plugins_to_update.append((plugin, repo_key))
        
        logger.info(f"[Stars更新] 共有 {len(all_github_plugins)} 个GitHub插件")
        logger.info(f"[Stars更新] 其中 {len(all_github_plugins) - len(plugins_to_update)} 个已有stars数据")
        logger.info(f"[Stars更新] 需要更新 {len(plugins_to_update)} 个插件")
        
        if not plugins_to_update:
            logger.warning("[Stars更新] 没有需要更新的插件")
            return web.json_response({
                'success': True,
                'message': '没有需要更新的插件',
                'updated': 0
            })
        
        # 批量获取stars（限制并发数量）
        timeout = aiohttp.ClientTimeout(total=10)
        updated_count = 0
        
        # 定义获取stars的函数（避免闭包问题）
        rate_limited = False
        
        # 准备请求头
        headers = {'Accept': 'application/vnd.github.v3+json'}
        if github_token:
            headers['Authorization'] = f'token {github_token}'
        
        async def fetch_single_repo_stars(session, repo_key):
            nonlocal rate_limited
            
            # 如果已经被限流，直接返回
            if rate_limited:
                return repo_key, None
            
            try:
                api_url = f"https://api.github.com/repos/{repo_key}"
                async with session.get(api_url, headers=headers) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return repo_key, data.get('stargazers_count', 0)
                    elif resp.status == 403:
                        # GitHub API 限流
                        rate_limited = True
                        remaining = resp.headers.get('X-RateLimit-Remaining', 'unknown')
                        reset_time = resp.headers.get('X-RateLimit-Reset', 'unknown')
                        logger.warning(f"⚠️ GitHub API 限流！剩余请求: {remaining}, 重置时间: {reset_time}")
                        logger.warning(f"⚠️ 建议配置 GitHub Token 以提高限额（5000次/小时）")
                        return repo_key, None
                    else:
                        logger.debug(f"获取 {repo_key} 的stars失败: HTTP {resp.status}")
                        return repo_key, None
            except Exception as e:
                logger.debug(f"获取 {repo_key} 的stars异常: {e}")
                return repo_key, None
        
        # 根据是否有Token调整批量大小和延迟
        if github_token:
            batch_size = 500  # 有Token时每批处理500个（极速模式）
            delay = 0.05      # 延迟0.05秒
            logger.info(f"[Stars更新] 🚀 极速模式：每批{batch_size}个，延迟{delay}秒")
        else:
            batch_size = 20   # 无Token时每批20个（保守）
            delay = 0.5       # 延迟0.5秒
            logger.info(f"[Stars更新] 🐢 标准模式：每批{batch_size}个，延迟{delay}秒（建议配置Token）")
        
        logger.info(f"[Stars更新] 开始批量获取stars...")
        
        async with aiohttp.ClientSession(timeout=timeout) as session:
            batch_num = 0
            total_batches = (len(plugins_to_update) + batch_size - 1) // batch_size
            
            for i in range(0, len(plugins_to_update), batch_size):
                batch = plugins_to_update[i:i+batch_size]
                batch_num += 1
                
                progress_percent = (i / len(plugins_to_update)) * 100
                logger.info(f"[Stars更新] 📊 批次 {batch_num}/{total_batches} ({progress_percent:.1f}%) - 处理 {i+1}-{min(i+batch_size, len(plugins_to_update))} / {len(plugins_to_update)}")
                
                # 创建任务列表（修复闭包问题）
                tasks = [fetch_single_repo_stars(session, repo_key) for plugin, repo_key in batch]
                
                # 并行执行
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # 更新数据库
                batch_success = 0
                for result in results:
                    if isinstance(result, Exception):
                        logger.warning(f"[Stars更新] 任务异常: {result}")
                    elif isinstance(result, tuple) and result[1] is not None:
                        repo_key, stars = result
                        stars_db[repo_key] = stars
                        updated_count += 1
                        batch_success += 1
                        if batch_success <= 3:  # 只打印前3个
                            logger.info(f"[Stars更新] ✓ {repo_key}: {stars} stars")
                
                completed_percent = ((i + len(batch)) / len(plugins_to_update)) * 100
                logger.info(f"[Stars更新] ✓ 批次 {batch_num}/{total_batches} 完成: {batch_success}/{len(batch)} 成功 | 总进度: {updated_count}/{len(plugins_to_update)} ({completed_percent:.1f}%)")
                
                # 如果被限流，停止处理
                if rate_limited:
                    logger.warning(f"⚠️ 检测到 GitHub API 限流，停止处理")
                    logger.warning(f"⚠️ 已成功获取 {updated_count} 个插件的stars")
                    logger.warning(f"⚠️ 剩余 {len(plugins_to_update) - (i + batch_size)} 个插件未处理")
                    break
                
                # 延迟避免API限制
                if i + batch_size < len(plugins_to_update):
                    await asyncio.sleep(delay)
        
        logger.info(f"[Stars更新] 批量获取完成，共获取到 {updated_count} 个stars")
        logger.info(f"[Stars更新] stars_db现在有 {len(stars_db)} 条数据")
        
        # 更新数据库中的plugins的stars
        plugins_updated = 0
        for plugin in plugins:
            github_url = plugin.get('reference', '')
            if github_url.startswith('https://github.com/'):
                repo_path = github_url.replace('https://github.com/', '').replace('.git', '').rstrip('/')
                repo_key = '/'.join(repo_path.split('/')[:2])
                old_stars = plugin.get('stars', 0)
                new_stars = stars_db.get(repo_key, 0)
                if new_stars > 0 and old_stars != new_stars:
                    plugin['stars'] = new_stars
                    plugins_updated += 1
        
        logger.info(f"[Stars更新] 更新了 {plugins_updated} 个插件的stars字段")
        
        # 保存到数据库
        from datetime import datetime
        save_data = {
            'last_update': db_data.get('last_update'),  # 保持插件列表的更新时间
            'last_stars_update': datetime.now().isoformat(),  # 记录stars更新时间
            'plugins': plugins,
            'stars_db': stars_db
        }
        
        logger.info(f"[Stars更新] 准备保存数据库...")
        logger.info(f"[Stars更新]   - plugins数量: {len(plugins)}")
        logger.info(f"[Stars更新]   - stars_db数量: {len(stars_db)}")
        
        save_result = save_plugins_database(save_data)
        
        if save_result:
            logger.info(f"✓ Stars更新完成，成功更新 {updated_count} 个插件，已保存到数据库")
        else:
            logger.error(f"✗ Stars更新完成，但保存数据库失败！")
        
        # 计算总耗时
        elapsed_time = time.time() - start_time
        minutes = int(elapsed_time // 60)
        seconds = int(elapsed_time % 60)
        time_str = f"{minutes}分{seconds}秒" if minutes > 0 else f"{seconds}秒"
        
        # 计算速度
        speed = updated_count / elapsed_time if elapsed_time > 0 else 0
        
        logger.info(f"[Stars更新] 🎉 全部完成！")
        logger.info(f"[Stars更新]   - 耗时: {time_str}")
        logger.info(f"[Stars更新]   - 成功: {updated_count}/{len(plugins_to_update)}")
        logger.info(f"[Stars更新]   - 速度: {speed:.1f} 个/秒")
        logger.info(f"[Stars更新]   - stars_db总数: {len(stars_db)}")
        
        # 构建返回消息
        message = f'✓ 成功更新 {updated_count}/{len(plugins_to_update)} 个插件 (耗时{time_str})'
        if rate_limited:
            message += ' (因GitHub API限流而中止)'
        
        return web.json_response({
            'success': True,
            'message': message,
            'updated': updated_count,
            'total': len(plugins_to_update),
            'elapsed_seconds': int(elapsed_time),
            'speed': round(speed, 1),
            'rate_limited': rate_limited,
            'note': '未认证的GitHub API每小时仅60次请求，建议配置GitHub Token以提高限额至5000次/小时' if rate_limited else None
        })
        
    except Exception as e:
        logger.error(f"更新Stars失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/store/install-plugin")
async def install_plugin(request):
    """安装插件（使用git clone）"""
    try:
        import aiohttp
        import asyncio
        
        data = await request.json()
        plugin_url = data.get('url', '')
        plugin_name = data.get('name', '')
        
        if not plugin_url:
            return web.json_response({
                'success': False,
                'error': '缺少插件URL'
            }, status=400)
        
        # 获取custom_nodes目录
        custom_nodes_dir = get_custom_nodes_dir()
        
        # 从URL提取插件名（如果没有提供）
        if not plugin_name:
            if plugin_url.startswith('https://github.com/'):
                repo_path = plugin_url.replace('https://github.com/', '').rstrip('/')
                plugin_name = repo_path.split('/')[-1]
            else:
                return web.json_response({
                    'success': False,
                    'error': '无法解析插件名称'
                }, status=400)
        
        # 目标目录
        target_dir = os.path.join(custom_nodes_dir, plugin_name)
        
        # 检查是否已安装
        if os.path.exists(target_dir):
            return web.json_response({
                'success': False,
                'error': f'插件已存在: {plugin_name}'
            }, status=409)
        
        # 使用git clone安装
        logger.info(f"正在安装插件: {plugin_name} from {plugin_url}")
        
        process = await asyncio.create_subprocess_exec(
            'git', 'clone', plugin_url, target_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            error_msg = stderr.decode('utf-8', errors='ignore')
            logger.error(f"安装插件失败: {error_msg}")
            return web.json_response({
                'success': False,
                'error': f'Git clone失败: {error_msg[:200]}'
            }, status=500)
        
        # 检查requirements.txt并安装依赖
        requirements_file = os.path.join(target_dir, 'requirements.txt')
        if os.path.exists(requirements_file):
            logger.info(f"正在安装插件依赖: {plugin_name}")
            try:
                process = await asyncio.create_subprocess_exec(
                    sys.executable, '-m', 'pip', 'install', '-r', requirements_file,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await process.communicate()
            except Exception as e:
                logger.warning(f"安装依赖失败: {e}")
        
        logger.info(f"✓ 插件安装成功: {plugin_name}")
        
        return web.json_response({
            'success': True,
            'message': f'插件 {plugin_name} 安装成功，请重启ComfyUI',
            'plugin_name': plugin_name,
            'requires_restart': True
        })
        
    except Exception as e:
        logger.error(f"安装插件失败: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


@server.PromptServer.instance.routes.post("/node-manager/detect-missing-nodes")
async def detect_missing_nodes(request):
    """检测当前工作流中缺失的节点"""
    try:
        import nodes as comfy_nodes
        
        # 获取所有已注册的节点类型
        if hasattr(comfy_nodes, 'NODE_CLASS_MAPPINGS'):
            registered_nodes = set(comfy_nodes.NODE_CLASS_MAPPINGS.keys())
        else:
            registered_nodes = set()
        
        # 获取前端传递的工作流
        data = await request.json()
        workflow = data.get('workflow', {})
        
        if not workflow:
            return web.json_response({
                'success': False,
                'error': '未提供工作流数据'
            }, status=400)
        
        # 提取工作流中使用的所有节点类型
        used_node_types = set()
        
        # 处理两种可能的工作流格式
        nodes_data = workflow.get('nodes', [])
        if not nodes_data:
            # 可能是另一种格式（直接以节点ID为键）
            for key, node in workflow.items():
                if isinstance(node, dict) and 'class_type' in node:
                    used_node_types.add(node['class_type'])
        else:
            # 标准格式
            for node in nodes_data:
                if isinstance(node, dict):
                    node_type = node.get('type') or node.get('class_type')
                    if node_type:
                        used_node_types.add(node_type)
        
        # 找出缺失的节点类型
        missing_node_types = used_node_types - registered_nodes
        
        if not missing_node_types:
            return web.json_response({
                'success': True,
                'missing_nodes': [],
                'message': '未检测到缺失的节点'
            })
        
        logger.info(f"检测到 {len(missing_node_types)} 个缺失节点: {missing_node_types}")
        
        # 从插件数据库中查找这些节点对应的插件
        db_data = load_plugins_database()
        node_to_plugin_map = {}
        
        if db_data and 'plugins' in db_data:
            for plugin in db_data['plugins']:
                plugin_name = plugin.get('plugin_name', plugin.get('title', ''))
                github_url = plugin.get('reference', '')
                
                # 检查插件提供的节点列表
                provided_nodes = plugin.get('nodes', [])
                if isinstance(provided_nodes, list):
                    for node_type in provided_nodes:
                        if node_type in missing_node_types:
                            node_to_plugin_map[node_type] = {
                                'node_type': node_type,
                                'plugin_name': plugin_name,
                                'github_url': github_url,
                                'title': plugin.get('title', plugin_name),
                                'description': plugin.get('description', '')
                            }
        
        # 构建缺失节点列表
        missing_nodes = []
        for node_type in missing_node_types:
            if node_type in node_to_plugin_map:
                missing_nodes.append(node_to_plugin_map[node_type])
            else:
                # 未找到对应插件的节点
                missing_nodes.append({
                    'node_type': node_type,
                    'plugin_name': f'未知插件 ({node_type})',
                    'github_url': '',
                    'title': '未知',
                    'description': '在插件数据库中未找到此节点的来源'
                })
        
        logger.info(f"找到 {len(missing_nodes)} 个缺失节点，其中 {len([n for n in missing_nodes if n['github_url']])} 个可以自动安装")
        
        return web.json_response({
            'success': True,
            'missing_nodes': missing_nodes,
            'total_missing': len(missing_node_types),
            'installable': len([n for n in missing_nodes if n['github_url']])
        })
        
    except Exception as e:
        logger.error(f"检测缺失节点失败: {e}", exc_info=True)
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


# 插件初始化
print(f"[{PLUGIN_NAME}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print(f"[{PLUGIN_NAME}] 📁 小海节点管理器已加载")
print(f"[{PLUGIN_NAME}] 📂 配置文件: {CONFIG_FILE}")
print(f"[{PLUGIN_NAME}] 📦 插件目录: {MANAGED_PLUGINS_DIR}")

# 显示已加载的托管节点
if NODE_CLASS_MAPPINGS:
    print(f"[{PLUGIN_NAME}] 🔌 已加载托管节点: {len(NODE_CLASS_MAPPINGS)} 个")
    for node_id in NODE_CLASS_MAPPINGS:
        display_name = NODE_DISPLAY_NAME_MAPPINGS.get(node_id, node_id)
        print(f"[{PLUGIN_NAME}]    - {node_id} ({display_name})")

# 测试扫描功能
try:
    custom_nodes_dir = get_custom_nodes_dir()
    print(f"[{PLUGIN_NAME}] 🔍 custom_nodes目录: {custom_nodes_dir}")
    if os.path.exists(custom_nodes_dir):
        plugins_count = len([d for d in os.listdir(custom_nodes_dir) if os.path.isdir(os.path.join(custom_nodes_dir, d))])
        print(f"[{PLUGIN_NAME}] ✅ 发现 {plugins_count} 个插件文件夹")
    else:
        print(f"[{PLUGIN_NAME}] ⚠️ custom_nodes目录不存在")
except Exception as e:
    print(f"[{PLUGIN_NAME}] ❌ 扫描失败: {e}")

print(f"[{PLUGIN_NAME}] 🌐 API路由已注册:")
print(f"[{PLUGIN_NAME}]   - GET  /node-manager/config")
print(f"[{PLUGIN_NAME}]   - POST /node-manager/config")
print(f"[{PLUGIN_NAME}]   - GET  /node-manager/nodes")
print(f"[{PLUGIN_NAME}]   - GET  /node-manager/plugins")
print(f"[{PLUGIN_NAME}]   - POST /node-manager/folder/*")
print(f"[{PLUGIN_NAME}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

