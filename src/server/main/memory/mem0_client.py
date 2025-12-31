"""
mem0客户端封装 - 用于长期记忆管理
"""
import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Try to import mem0ai, make it optional
try:
    from mem0ai import Memory
    MEM0_AVAILABLE = True
    MemoryType = type(Memory)
except ImportError:
    logger.warning("mem0ai package not installed. Long-term memory features will be disabled.")
    MEM0_AVAILABLE = False
    Memory = None
    MemoryType = Any

class Mem0Client:
    """mem0 client wrapper for long-term memory management"""
    
    def __init__(self):
        self.memory: Optional[MemoryType] = None
        self._initialize()
    
    def _initialize(self):
        """Initialize mem0 client"""
        if not MEM0_AVAILABLE:
            logger.warning("mem0ai not available, skipping initialization")
            self.memory = None
            return
        
        try:
            # Use ChromaDB as vector database (simple, no extra service needed)
            config = {
                "vector_store": {
                    "provider": "chroma",
                    "config": {
                        "collection_name": "memories",
                        "path": "./.mem0_db"  # Local storage path
                    }
                }
            }
            self.memory = Memory.from_config(config)
            logger.info("mem0 client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize mem0 client: {e}", exc_info=True)
            self.memory = None
    
    async def search_memories(self, user_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        检索与查询相关的长期记忆
        
        Args:
            user_id: 用户ID
            query: 查询文本
            limit: 返回的最大记忆数量
            
        Returns:
            相关记忆列表
        """
        if not self.memory:
            logger.warning("mem0 client not initialized, returning empty memories")
            return []
        
        try:
            # mem0的search方法
            results = self.memory.search(query=query, limit=limit, user_id=user_id)
            return results if results else []
        except Exception as e:
            logger.error(f"Error searching memories for user {user_id}: {e}", exc_info=True)
            return []
    
    async def add_memory(self, user_id: str, memory_text: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """
        添加新的长期记忆
        
        Args:
            user_id: 用户ID
            memory_text: 记忆文本
            metadata: 可选的元数据
            
        Returns:
            是否成功添加
        """
        if not self.memory:
            logger.warning("mem0 client not initialized, cannot add memory")
            return False
        
        try:
            # mem0的add方法
            self.memory.add(memory_text, user_id=user_id, metadata=metadata or {})
            logger.info(f"Added memory for user {user_id}: {memory_text[:50]}...")
            return True
        except Exception as e:
            logger.error(f"Error adding memory for user {user_id}: {e}", exc_info=True)
            return False
    
    async def extract_and_store(self, user_id: str, conversation_history: List[Dict[str, Any]]) -> bool:
        """
        从对话历史中提取重要信息并存储到mem0
        
        Args:
            user_id: 用户ID
            conversation_history: 对话历史列表
            
        Returns:
            是否成功提取和存储
        """
        if not self.memory:
            logger.warning("mem0 client not initialized, cannot extract memories")
            return False
        
        try:
            # 将对话历史转换为文本格式
            conversation_text = "\n".join([
                f"{msg.get('role', 'unknown')}: {msg.get('content', '')}"
                for msg in conversation_history
            ])
            
            # 使用mem0的extract方法自动提取记忆
            memories = self.memory.extract(conversation_text, user_id=user_id)
            
            if memories:
                logger.info(f"Extracted {len(memories)} memories for user {user_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error extracting memories for user {user_id}: {e}", exc_info=True)
            return False

# 全局mem0客户端实例
mem0_client = Mem0Client()

