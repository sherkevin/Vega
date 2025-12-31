"""
mem0客户端封装 - 用于长期记忆管理
"""
import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# CRITICAL: For ChromaDB 1.4.0+, we must NOT set legacy environment variables
# Remove any legacy ChromaDB environment variables that might cause issues
# ChromaDB 1.4.0+ uses a new API and doesn't support old config like CHROMA_DB_IMPL
os.environ.pop("CHROMA_DB_IMPL", None)  # Remove legacy config
os.environ.pop("IS_PERSISTENT", None)  # Remove legacy config
os.environ.pop("CHROMA_API_IMPL", None)  # Let ChromaDB use default
# Remove any HTTP-related environment variables that might force HTTP mode
os.environ.pop("CHROMA_SERVER_HOST", None)
os.environ.pop("CHROMA_SERVER_HTTP_PORT", None)
os.environ.pop("CHROMA_HTTP_HOST", None)
os.environ.pop("CHROMA_HTTP_PORT", None)

# CRITICAL FIX: Force is_thin_client to False to prevent HTTP-only mode
# This must be done before chromadb.config is imported
try:
    import chromadb.config
    chromadb.config.is_thin_client = False
except (ImportError, AttributeError):
    pass  # chromadb not installed or config module not available

# Import config to get API key and model name
try:
    from main.config import OPENAI_API_KEY as CONFIG_API_KEY, OPENAI_MODEL_NAME, OPENAI_API_BASE_URL
except ImportError:
    CONFIG_API_KEY = None
    OPENAI_MODEL_NAME = None
    OPENAI_API_BASE_URL = None

# Try to import mem0ai (or mem0), make it optional
try:
    # Try mem0ai first (newer package name)
    try:
        from mem0ai import Memory
    except ImportError:
        # Fallback to mem0 (older package name)
        from mem0 import Memory
    MEM0_AVAILABLE = True
    MemoryType = type(Memory)
except ImportError:
    logger.warning("mem0ai/mem0 package not installed. Long-term memory features will be disabled.")
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
            # Get API key from config or environment
            api_key = CONFIG_API_KEY or os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.warning("OPENAI_API_KEY not found, mem0 will not be initialized")
                self.memory = None
                return
            
            # Create persistent storage directory
            persist_path = os.path.abspath("./.mem0_db")
            os.makedirs(persist_path, exist_ok=True)
            
            # Import chromadb AFTER environment variables are set and is_thin_client is fixed
            # Don't import chromadb here - let mem0 handle it to avoid initialization issues
            # import chromadb
            
            # Set environment variables for mem0's OpenAI client
            # mem0 reads OPENAI_BASE_URL from environment, not OPENAI_API_BASE_URL
            if OPENAI_API_BASE_URL:
                os.environ["OPENAI_BASE_URL"] = OPENAI_API_BASE_URL
            
            # Map model names to available models
            # Based on error message, available models include: GLM-4-Flash, DeepSeek-V3.2-Instruct, etc.
            llm_model = "GLM-4-Flash"  # Default fallback
            if OPENAI_MODEL_NAME:
                # Map common model names to available variants
                if "DeepSeek-V3.2" in OPENAI_MODEL_NAME:
                    llm_model = "DeepSeek-V3.2-Instruct"
                elif "GLM-4" in OPENAI_MODEL_NAME:
                    llm_model = "GLM-4-Flash"
                else:
                    llm_model = OPENAI_MODEL_NAME
            
            # Map embedding model to available models
            # Available embedding models: GLM-Embedding-2, GLM-Embedding-3, Doubao-Embedding-Text
            embedder_model = "GLM-Embedding-3"  # Use available embedding model
            
            # Use ChromaDB as vector database
            # mem0's ChromaVectorStore will create the client internally
            # It expects 'path' for local persistent storage
            # The is_thin_client=False fix above ensures it won't use HTTP mode
            config = {
                "vector_store": {
                    "provider": "chroma",
                    "config": {
                        "collection_name": "memories",
                        "path": persist_path  # Local storage path
                    }
                },
                "embedder": {
                    "provider": "openai",
                    "config": {
                        "api_key": api_key,
                        "model": embedder_model,  # Use available embedding model
                        "openai_base_url": OPENAI_API_BASE_URL if OPENAI_API_BASE_URL else None
                    }
                },
                "llm": {
                    "provider": "openai",
                    "config": {
                        "api_key": api_key,
                        "model": llm_model,  # Use mapped model name
                        "openai_base_url": OPENAI_API_BASE_URL if OPENAI_API_BASE_URL else None
                    }
                }
            }
            self.memory = Memory.from_config(config)
            logger.info("mem0 client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize mem0 client: {e}", exc_info=True)
            self.memory = None
    
    async def search_memories(self, user_id: str, query: str, limit: int = 5, conversation_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        检索与查询相关的长期记忆
        
        Args:
            user_id: 用户ID
            query: 查询文本
            limit: 返回的最大记忆数量
            conversation_id: 对话ID，用于隔离不同对话的记忆
            
        Returns:
            相关记忆列表，每个元素为字典格式 {"memory": str, "score": float}
        """
        if not self.memory:
            logger.warning("mem0 client not initialized, returning empty memories")
            return []
        
        try:
            # 使用 conversation_id 来隔离不同对话的记忆
            # 格式: {user_id}:{conversation_id} 或 {user_id} (如果没有 conversation_id)
            memory_user_id = f"{user_id}:{conversation_id}" if conversation_id else user_id
            
            # mem0的search方法
            results = self.memory.search(query=query, limit=limit, user_id=memory_user_id)
            
            # 处理返回结果：确保返回格式统一
            if not results:
                return []
            
            # mem0 可能返回不同格式：
            # 1. 字典列表，每个字典包含 "memory" 或 "text" 字段
            # 2. 字符串列表
            # 3. 其他格式（如包含 "results" 字段的字典）
            formatted_results = []
            
            # 如果返回的是单个字典，可能包含 "results" 字段
            if isinstance(results, dict):
                if "results" in results:
                    # 提取 results 字段中的内容
                    results = results["results"]
                elif "memory" in results or "text" in results:
                    # 单个记忆字典
                    formatted_results.append({
                        "memory": results.get("memory", results.get("text", str(results))),
                        "score": results.get("score", results.get("distance", 0.0))
                    })
                    return formatted_results
            
            # 处理列表格式
            if isinstance(results, (list, tuple)):
                for item in results:
                    if isinstance(item, dict):
                        # 字典格式，提取 memory 或 text 字段
                        memory_text = item.get("memory") or item.get("text") or item.get("content") or str(item)
                        score = item.get("score") or item.get("distance") or item.get("similarity") or 0.0
                        formatted_results.append({
                            "memory": memory_text,
                            "score": float(score) if score else 0.0
                        })
                    elif isinstance(item, str):
                        # 字符串格式
                        formatted_results.append({
                            "memory": item,
                            "score": 0.0
                        })
                    else:
                        # 其他格式，尝试转换为字符串
                        formatted_results.append({
                            "memory": str(item),
                            "score": 0.0
                        })
            else:
                # 单个非字典结果
                formatted_results.append({
                    "memory": str(results),
                    "score": 0.0
                })
            
            return formatted_results
        except Exception as e:
            logger.error(f"Error searching memories for user {user_id} (conversation: {conversation_id}): {e}", exc_info=True)
            return []
    
    async def add_memory(self, user_id: str, memory_text: str, metadata: Optional[Dict[str, Any]] = None, conversation_id: Optional[str] = None) -> bool:
        """
        添加新的长期记忆
        
        Args:
            user_id: 用户ID
            memory_text: 记忆文本
            metadata: 可选的元数据
            conversation_id: 对话ID，用于隔离不同对话的记忆
            
        Returns:
            是否成功添加
        """
        if not self.memory:
            logger.warning("mem0 client not initialized, cannot add memory")
            return False
        
        try:
            # 使用 conversation_id 来隔离不同对话的记忆
            # 格式: {user_id}:{conversation_id} 或 {user_id} (如果没有 conversation_id)
            memory_user_id = f"{user_id}:{conversation_id}" if conversation_id else user_id
            
            # 在 metadata 中添加 conversation_id 以便后续查询
            memory_metadata = metadata or {}
            if conversation_id:
                memory_metadata["conversation_id"] = conversation_id
            
            # mem0的add方法
            self.memory.add(memory_text, user_id=memory_user_id, metadata=memory_metadata)
            logger.info(f"Added memory for user {user_id} (conversation: {conversation_id}): {memory_text[:50]}...")
            return True
        except Exception as e:
            logger.error(f"Error adding memory for user {user_id} (conversation: {conversation_id}): {e}", exc_info=True)
            return False
    
    async def extract_and_store(self, user_id: str, conversation_history: List[Dict[str, Any]], conversation_id: Optional[str] = None) -> bool:
        """
        从对话历史中提取重要信息并存储到mem0
        
        Args:
            user_id: 用户ID
            conversation_history: 对话历史列表
            conversation_id: 对话ID，用于隔离不同对话的记忆
            
        Returns:
            是否成功提取和存储
        """
        if not self.memory:
            logger.warning("mem0 client not initialized, cannot extract memories")
            return False
        
        try:
            # 使用 conversation_id 来隔离不同对话的记忆
            # 格式: {user_id}:{conversation_id} 或 {user_id} (如果没有 conversation_id)
            memory_user_id = f"{user_id}:{conversation_id}" if conversation_id else user_id
            
            # 将对话历史转换为文本格式
            conversation_text = "\n".join([
                f"{msg.get('role', 'unknown')}: {msg.get('content', '')}"
                for msg in conversation_history
            ])
            
            # 准备 metadata，包含 conversation_id
            metadata = {}
            if conversation_id:
                metadata["conversation_id"] = conversation_id
            
            # 使用mem0的extract方法自动提取记忆
            # extract 方法可能需要 metadata 参数，如果支持的话
            try:
                memories = self.memory.extract(conversation_text, user_id=memory_user_id, metadata=metadata)
            except TypeError:
                # 如果 extract 不支持 metadata 参数，只传 user_id
                memories = self.memory.extract(conversation_text, user_id=memory_user_id)
            
            if memories:
                logger.info(f"Extracted {len(memories)} memories for user {user_id} (conversation: {conversation_id})")
                return True
            return False
        except Exception as e:
            logger.error(f"Error extracting memories for user {user_id} (conversation: {conversation_id}): {e}", exc_info=True)
            return False

# 全局mem0客户端实例
mem0_client = Mem0Client()

