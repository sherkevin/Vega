'''
Author: shervin sherkevin@163.com
Date: 2025-12-31 15:12:47
Description: 
FilePath: \Vega\src\server\test_mem0_simple.py
LastEditTime: 2025-12-31 15:14:13
LastEditors: shervin sherkevin@163.com

Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
'''
"""
简化的 mem0 测试 - 只测试初始化，不测试 API 调用
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from main.memory.mem0_client import mem0_client
from main.config import OPENAI_API_KEY, OPENAI_MODEL_NAME, OPENAI_API_BASE_URL

print("=" * 60)
print("Mem0 初始化状态检查")
print("=" * 60)

print("\n[1] 配置检查...")
print(f"    OPENAI_API_KEY: {'已配置' if OPENAI_API_KEY else '未配置'} (长度: {len(OPENAI_API_KEY) if OPENAI_API_KEY else 0})")
print(f"    OPENAI_MODEL_NAME: {OPENAI_MODEL_NAME}")
print(f"    OPENAI_API_BASE_URL: {OPENAI_API_BASE_URL}")

print("\n[2] mem0 客户端状态...")
if mem0_client.memory:
    print("    [OK] mem0 客户端已成功初始化")
    print("    ChromaDB 配置问题已解决")
    print("    长期记忆功能已启用")
else:
    print("    [ERROR] mem0 客户端未初始化")
    print("    长期记忆功能已禁用")

print("\n" + "=" * 60)
if mem0_client.memory:
    print("[SUCCESS] mem0 长期记忆功能已就绪")
    print("注意: API 调用测试需要有效的网络连接和 API key")
else:
    print("[WARNING] mem0 未初始化，长期记忆功能不可用")
print("=" * 60)

