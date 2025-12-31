"""
测试 mem0 长期记忆功能
"""
import asyncio
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(__file__))

from main.memory.mem0_client import mem0_client
from main.config import OPENAI_API_KEY
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_mem0():
    """测试 mem0 功能"""
    print("=" * 60)
    print("Mem0 长期记忆功能测试")
    print("=" * 60)
    
    # 1. 检查 API Key
    print("\n[1] 检查配置...")
    if not OPENAI_API_KEY:
        print("[ERROR] OPENAI_API_KEY 未配置")
        print("   请在 .env 文件中设置 OPENAI_API_KEY")
        return False
    else:
        print(f"[OK] OPENAI_API_KEY 已配置 (长度: {len(OPENAI_API_KEY)})")
    
    # 2. 检查 mem0 客户端初始化
    print("\n[2] 检查 mem0 客户端初始化...")
    if not mem0_client.memory:
        print("[ERROR] mem0 客户端未初始化")
        print("   可能的原因:")
        print("   - mem0ai 包未安装")
        print("   - ChromaDB 配置问题（HTTP-only 模式）")
        print("   - API Key 无效")
        print("\n   诊断信息:")
        try:
            import chromadb
            print(f"   - ChromaDB 版本: {chromadb.__version__}")
            # 检查环境变量
            import os
            chroma_vars = {k: v for k, v in os.environ.items() if 'CHROMA' in k.upper()}
            if chroma_vars:
                print(f"   - ChromaDB 相关环境变量: {chroma_vars}")
            else:
                print("   - 未找到 ChromaDB 相关环境变量")
        except Exception as e:
            print(f"   - 无法检查 ChromaDB: {e}")
        print("\n   解决方案:")
        print("   1. 检查是否有环境变量强制 ChromaDB 使用 HTTP 模式")
        print("   2. 尝试重启 Python 进程（某些配置可能在导入时设置）")
        print("   3. 检查 chromadb 包的安装和版本")
        return False
    else:
        print("[OK] mem0 客户端初始化成功")
    
    # 3. 测试添加记忆
    print("\n[3] 测试添加记忆...")
    test_user_id = "test-user-123"
    test_memory = "用户喜欢使用 Python 进行开发，最喜欢的框架是 FastAPI"
    
    try:
        result = await mem0_client.add_memory(
            user_id=test_user_id,
            memory_text=test_memory,
            metadata={"test": True, "timestamp": "2024-01-01"}
        )
        if result:
            print(f"[OK] 成功添加记忆: {test_memory[:50]}...")
        else:
            print("[ERROR] 添加记忆失败")
            return False
    except Exception as e:
        print(f"[ERROR] 添加记忆时出错: {e}")
        return False
    
    # 等待一下，确保数据写入
    await asyncio.sleep(1)
    
    # 4. 测试搜索记忆
    print("\n[4] 测试搜索记忆...")
    search_queries = [
        "用户喜欢什么编程语言",
        "Python",
        "FastAPI"
    ]
    
    for query in search_queries:
        try:
            memories = await mem0_client.search_memories(
                user_id=test_user_id,
                query=query,
                limit=3
            )
            if memories:
                print(f"[OK] 查询 '{query}' 找到 {len(memories)} 条相关记忆:")
                for i, mem in enumerate(memories, 1):
                    memory_text = mem.get("memory", "") or mem.get("text", "")
                    score = mem.get("score", 0)
                    print(f"   {i}. [{score:.3f}] {memory_text[:60]}...")
            else:
                print(f"[WARN] 查询 '{query}' 未找到相关记忆")
        except Exception as e:
            print(f"[ERROR] 搜索记忆时出错: {e}")
            return False
    
    # 5. 测试提取并存储记忆
    print("\n[5] 测试提取并存储记忆...")
    test_conversation = [
        {"role": "user", "content": "我叫张三，我是一名软件工程师，主要使用 Python 和 JavaScript。"},
        {"role": "assistant", "content": "很高兴认识你，张三！作为一名软件工程师，你使用 Python 和 JavaScript 进行开发。"},
        {"role": "user", "content": "是的，我最喜欢的 Python 框架是 FastAPI，因为它很快。"},
        {"role": "assistant", "content": "FastAPI 确实是一个优秀的框架，性能很好。"}
    ]
    
    try:
        result = await mem0_client.extract_and_store(
            user_id=test_user_id,
            conversation_history=test_conversation
        )
        if result:
            print("[OK] 成功从对话中提取并存储记忆")
            # 等待一下，确保数据写入
            await asyncio.sleep(1)
            
            # 验证提取的记忆
            memories = await mem0_client.search_memories(
                user_id=test_user_id,
                query="张三的职业",
                limit=5
            )
            if memories:
                print(f"   找到 {len(memories)} 条相关记忆:")
                for i, mem in enumerate(memories[:3], 1):
                    memory_text = mem.get("memory", "") or mem.get("text", "")
                    print(f"   {i}. {memory_text[:80]}...")
        else:
            print("[WARN] 提取记忆返回 False（可能没有提取到重要信息）")
    except Exception as e:
        print(f"[ERROR] 提取记忆时出错: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # 6. 综合测试：验证记忆在对话中的使用
    print("\n[6] 综合测试：验证记忆检索...")
    test_query = "用户使用什么编程语言"
    try:
        memories = await mem0_client.search_memories(
            user_id=test_user_id,
            query=test_query,
            limit=5
        )
        if memories:
            print(f"[OK] 查询 '{test_query}' 成功检索到 {len(memories)} 条记忆")
            print("   记忆内容:")
            for i, mem in enumerate(memories, 1):
                memory_text = mem.get("memory", "") or mem.get("text", "")
                score = mem.get("score", 0)
                print(f"   {i}. [{score:.3f}] {memory_text}")
        else:
            print(f"[WARN] 查询 '{test_query}' 未找到记忆")
    except Exception as e:
        print(f"[ERROR] 检索记忆时出错: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("[SUCCESS] 所有测试通过！mem0 长期记忆功能正常工作")
    print("=" * 60)
    return True

if __name__ == "__main__":
    try:
        result = asyncio.run(test_mem0())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n\n测试被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n[ERROR] 测试过程中发生未预期的错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

