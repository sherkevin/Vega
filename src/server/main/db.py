"""
简化的MongoDB管理 - 只保留消息相关功能
"""
import datetime
import uuid
import logging
import motor.motor_asyncio
from pymongo import ASCENDING, DESCENDING, IndexModel
from bson import ObjectId
from typing import Dict, List, Optional, Any

from main.config import MONGO_URI, MONGO_DB_NAME

logger = logging.getLogger(__name__)

MESSAGES_COLLECTION = "messages"
CONVERSATIONS_COLLECTION = "conversations"

class MongoManager:
    """简化的MongoDB管理器 - 只处理消息"""
    
    def __init__(self):
        self.client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
        self.db = self.client[MONGO_DB_NAME]
        self.messages_collection = self.db[MESSAGES_COLLECTION]
        self.conversations_collection = self.db[CONVERSATIONS_COLLECTION]
        logger.info(f"[MongoManager] Initialized. Database: {MONGO_DB_NAME}")

    async def initialize_db(self):
        """初始化数据库索引"""
        logger.info("[MongoManager] Ensuring indexes...")
        
        message_indexes = [
            IndexModel([("message_id", ASCENDING)], unique=True, name="message_id_unique_idx"),
            IndexModel([("user_id", ASCENDING), ("timestamp", DESCENDING)], name="message_user_timestamp_idx"),
            IndexModel([("conversation_id", ASCENDING), ("timestamp", DESCENDING)], name="message_conversation_timestamp_idx"),
        ]
        
        conversation_indexes = [
            IndexModel([("conversation_id", ASCENDING)], unique=True, name="conversation_id_unique_idx"),
            IndexModel([("user_id", ASCENDING), ("updated_at", DESCENDING)], name="conversation_user_updated_idx"),
        ]
        
        try:
            await self.messages_collection.create_indexes(message_indexes)
            await self.conversations_collection.create_indexes(conversation_indexes)
            logger.info("Indexes ensured for messages and conversations collections")
        except Exception as e:
            logger.error(f"Index creation failed: {e}", exc_info=True)

    async def create_conversation(self, user_id: str, conversation_id: Optional[str] = None, title: Optional[str] = None) -> Dict:
        """创建新会话"""
        if not conversation_id:
            conversation_id = str(uuid.uuid4())
        
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        
        conversation_doc = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "title": title or "New Chat",
            "created_at": now_utc,
            "updated_at": now_utc,
        }
        
        await self.conversations_collection.insert_one(conversation_doc)
        logger.info(f"Created conversation {conversation_id} for user {user_id}")
        return conversation_doc

    async def get_conversations(self, user_id: str, limit: int = 50) -> List[Dict]:
        """获取用户的所有会话列表"""
        cursor = self.conversations_collection.find(
            {"user_id": user_id}
        ).sort("updated_at", DESCENDING).limit(limit)
        
        conversations = await cursor.to_list(length=limit)
        
        result = []
        for conv in conversations:
            result.append({
                "conversation_id": conv.get("conversation_id"),
                "title": conv.get("title", "New Chat"),
                "created_at": conv.get("created_at").isoformat() if isinstance(conv.get("created_at"), datetime.datetime) else conv.get("created_at"),
                "updated_at": conv.get("updated_at").isoformat() if isinstance(conv.get("updated_at"), datetime.datetime) else conv.get("updated_at"),
            })
        
        return result

    async def update_conversation_title(self, user_id: str, conversation_id: str, title: str):
        """更新会话标题"""
        await self.conversations_collection.update_one(
            {"user_id": user_id, "conversation_id": conversation_id},
            {"$set": {"title": title, "updated_at": datetime.datetime.now(datetime.timezone.utc)}}
        )

    async def delete_conversation(self, user_id: str, conversation_id: str) -> bool:
        """删除会话及其所有消息"""
        # 删除会话
        conv_result = await self.conversations_collection.delete_one({
            "user_id": user_id,
            "conversation_id": conversation_id
        })
        
        # 删除会话的所有消息
        msg_result = await self.messages_collection.delete_many({
            "user_id": user_id,
            "conversation_id": conversation_id
        })
        
        logger.info(f"Deleted conversation {conversation_id} and {msg_result.deleted_count} messages")
        return conv_result.deleted_count > 0

    async def add_message(
        self, 
        user_id: str, 
        role: str, 
        content: str, 
        conversation_id: str,
        message_id: Optional[str] = None,
        turn_steps: Optional[List[Dict]] = None
    ) -> Dict:
        """
        添加消息到数据库
        
        Args:
            user_id: 用户ID
            role: 消息角色 (user/assistant)
            content: 消息内容
            message_id: 可选的消息ID
            turn_steps: 可选的turn步骤（用于assistant消息）
            
        Returns:
            创建的消息文档
        """
        if not message_id:
            message_id = str(uuid.uuid4())
        
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        
        message_doc = {
            "message_id": message_id,
            "user_id": user_id,
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "timestamp": now_utc,
            "turn_steps": turn_steps or []
        }
        
        await self.messages_collection.insert_one(message_doc)
        
        # 更新会话的更新时间
        await self.conversations_collection.update_one(
            {"conversation_id": conversation_id, "user_id": user_id},
            {"$set": {"updated_at": now_utc}},
            upsert=True
        )
        
        logger.info(f"Added {role} message for user {user_id} in conversation {conversation_id}")
        return message_doc

    async def get_recent_messages(self, user_id: str, conversation_id: str, limit: int = 10) -> List[Dict]:
        """
        获取会话最近的消息（用于短期记忆）
        
        Args:
            user_id: 用户ID
            conversation_id: 会话ID
            limit: 返回的消息数量（默认10，即5轮对话）
            
        Returns:
            消息列表，按时间倒序
        """
        cursor = self.messages_collection.find(
            {"user_id": user_id, "conversation_id": conversation_id}
        ).sort("timestamp", DESCENDING).limit(limit)
        
        messages = await cursor.to_list(length=limit)
        # 反转顺序，使其按时间正序
        messages.reverse()
        
        # 转换为标准格式
        result = []
        for msg in messages:
            result.append({
                "role": msg.get("role"),
                "content": msg.get("content", ""),
                "message_id": msg.get("message_id"),
                "timestamp": msg.get("timestamp").isoformat() if isinstance(msg.get("timestamp"), datetime.datetime) else msg.get("timestamp")
            })
        
        return result

    async def get_message_history(
        self, 
        user_id: str, 
        limit: int = 10, 
        before_timestamp_iso: Optional[str] = None
    ) -> List[Dict]:
        """
        获取消息历史（分页支持）
        
        Args:
            user_id: 用户ID
            limit: 返回的消息数量
            before_timestamp_iso: 可选的时间戳（ISO格式），用于分页
            
        Returns:
            消息列表
        """
        query = {"user_id": user_id}
        
        if before_timestamp_iso:
            try:
                before_dt = datetime.datetime.fromisoformat(before_timestamp_iso.replace('Z', '+00:00'))
                query["timestamp"] = {"$lt": before_dt}
            except Exception as e:
                logger.warning(f"Invalid timestamp format: {before_timestamp_iso}, {e}")
        
        cursor = self.messages_collection.find(query).sort("timestamp", DESCENDING).limit(limit)
        messages = await cursor.to_list(length=limit)
        messages.reverse()
        
        result = []
        for msg in messages:
            result.append({
                "role": msg.get("role"),
                "content": msg.get("content", ""),
                "message_id": msg.get("message_id"),
                "timestamp": msg.get("timestamp").isoformat() if isinstance(msg.get("timestamp"), datetime.datetime) else msg.get("timestamp")
            })
        
        return result

    async def delete_message(self, user_id: str, conversation_id: str, message_id: str) -> bool:
        """删除指定消息"""
        result = await self.messages_collection.delete_one({
            "user_id": user_id,
            "conversation_id": conversation_id,
            "message_id": message_id
        })
        return result.deleted_count > 0

    async def delete_all_messages(self, user_id: str, conversation_id: str) -> int:
        """删除会话的所有消息"""
        result = await self.messages_collection.delete_many({
            "user_id": user_id,
            "conversation_id": conversation_id
        })
        return result.deleted_count

# 全局MongoDB管理器实例
mongo_manager = MongoManager()

