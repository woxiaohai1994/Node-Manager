#!/usr/bin/env python3
"""测试GitHub Token"""
import os
import requests

TOKEN_FILE = "data/github_token.txt"

def test_github_token():
    """测试GitHub Token是否有效"""
    print("=" * 60)
    print("GitHub Token 测试工具")
    print("=" * 60)
    
    # 1. 检查文件是否存在
    if not os.path.exists(TOKEN_FILE):
        print("\n❌ 错误: 未找到 github_token.txt 文件")
        print(f"   请在 {TOKEN_FILE} 中配置你的GitHub Token")
        print("\n配置说明：")
        print("1. 访问: https://github.com/settings/tokens")
        print("2. 生成新Token（勾选 public_repo 权限）")
        print("3. 将Token保存到 data/github_token.txt")
        return False
    
    # 2. 读取Token
    with open(TOKEN_FILE, 'r') as f:
        token = f.read().strip()
    
    if not token:
        print("\n❌ 错误: github_token.txt 文件为空")
        return False
    
    print(f"\n✓ 找到Token: {token[:10]}...{token[-4:]}")
    
    # 3. 测试Token
    print("\n正在测试Token...")
    
    headers = {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': f'token {token}'
    }
    
    try:
        # 测试API请求
        response = requests.get('https://api.github.com/rate_limit', headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            core = data['resources']['core']
            
            print("\n✅ Token验证成功！\n")
            print(f"限额信息:")
            print(f"  - 总限额: {core['limit']} 次/小时")
            print(f"  - 剩余: {core['remaining']} 次")
            print(f"  - 重置时间: {core['reset']}")
            
            if core['limit'] == 5000:
                print("\n🎉 完美！你的Token可以每小时请求5000次")
            else:
                print(f"\n⚠️ 警告：限额只有{core['limit']}次，请检查Token权限")
            
            return True
            
        elif response.status_code == 401:
            print("\n❌ Token无效或已过期")
            print("   请重新生成Token")
            return False
            
        else:
            print(f"\n❌ 请求失败: HTTP {response.status_code}")
            print(f"   {response.text}")
            return False
            
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        return False

if __name__ == "__main__":
    success = test_github_token()
    print("\n" + "=" * 60)
    if success:
        print("✓ 测试通过！现在可以一次性更新所有插件的Stars了")
    else:
        print("✗ 测试失败，请检查配置")
    print("=" * 60)


