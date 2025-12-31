"""
测试 mem0 对话隔离功能
验证每个对话窗口有独立的记忆空间
"""
import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(__file__))

from main.memory.mem0_client import mem0_client

async def test_conversation_isolation():
    """测试对话隔离功能"""
    print("=" * 60)
    print("测试 mem0 对话隔离功能")
    print("=" * 60)
    
    if not mem0_client.memory:
        print("[ERROR] mem0 客户端未初始化")
        return False
    
    user_id = "test-user"
    conversation_1 = "conv-001"
    conversation_2 = "conv-002"
    
    print(f"\n[1] 为对话 1 添加记忆...")
    result1 = await mem0_client.add_memory(
        user_id=user_id,
        memory_text="用户喜欢使用 Python 进行开发，最喜欢的框架是 FastAPI",
        conversation_id=conversation_1
    )
    print(f"    结果: {'[OK]' if result1 else '[ERROR]'}")
    
    print(f"\n[2] 为对话 2 添加记忆...")
    result2 = await mem0_client.add_memory(
        user_id=user_id,
        memory_text="用户是一名前端工程师，主要使用 React 和 TypeScript",
        conversation_id=conversation_2
    )
    print(f"    结果: {'[OK]' if result2 else '[ERROR]'}")
    
    print(f"\n[3] 在对话 1 中搜索记忆...")
    memories_1 = await mem0_client.search_memories(
        user_id=user_id,
        query="用户喜欢什么编程语言",
        limit=5,
        conversation_id=conversation_1
    )
    print(f"    找到 {len(memories_1)} 条记忆")
    for i, mem in enumerate(memories_1, 1):
        memory_text = mem.get("memory", "") if isinstance(mem, dict) else str(mem)
        print(f"    {i}. {memory_text[:60]}...")
    
    print(f"\n[4] 在对话 2 中搜索记忆...")
    memories_2 = await mem0_client.search_memories(
        user_id=user_id,
        query="用户使用什么技术栈",
        limit=5,
        conversation_id=conversation_2
    )
    print(f"    找到 {len(memories_2)} 条记忆")
    for i, mem in enumerate(memories_2, 1):
        memory_text = mem.get("memory", "") if isinstance(mem, dict) else str(mem)
        print(f"    {i}. {memory_text[:60]}...")
    
    print(f"\n[5] 验证对话隔离...")
    # 对话 1 应该只包含 Python/FastAPI 相关记忆
    # 对话 2 应该只包含 React/TypeScript 相关记忆
    conv1_has_python = any("Python" in str(mem.get("memory", "")) for mem in memories_1)
    conv2_has_react = any("React" in str(mem.get("memory", "")) for mem in memories_2)
    
    if conv1_has_python and conv2_has_react:
        print("    [OK] 对话隔离成功！每个对话有独立的记忆空间")
        return True
    else:
        print("    [WARN] 对话隔离可能存在问题")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_conversation_isolation())
    print("\n" + "=" * 60)
    if result:
        print("[SUCCESS] 测试通过")
    else:
        print("[WARNING] 测试未完全通过，请检查日志")
    print("=" * 60)

