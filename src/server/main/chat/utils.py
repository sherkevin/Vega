"""
简化的聊天逻辑 - 集成短期记忆（最近5轮）和长期记忆（mem0）
"""
import asyncio
import json
import logging
import re
import threading
import uuid
from typing import List, Dict, Any, AsyncGenerator
from datetime import datetime, timezone

from main.llm import run_agent, LLMProviderDownError
from main.db import MongoManager
from main.memory.mem0_client import mem0_client

logger = logging.getLogger(__name__)

def parse_assistant_response(assistant_messages: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    解析助手消息，提取最终内容和turn步骤
    """
    final_content = ""
    turn_steps = []
    
    # 处理所有助手消息，保留最后一个作为最终内容
    for msg in assistant_messages:
        if msg.get("role") == "assistant":
            content = msg.get("content")
            # 跳过None内容（函数调用）
            if content is None:
                continue
            
            # 提取内容（移除推理标签）
            cleaned_content = re.sub(r'<think>[\s\S]*?</think>', '', str(content), flags=re.DOTALL).strip()
            cleaned_content = re.sub(r'<think>[\s\S]*?</think>', '', cleaned_content, flags=re.DOTALL).strip()
            
            if cleaned_content:
                # 使用最后一个非空内容作为最终内容
                final_content = cleaned_content
                turn_steps.append({
                    "type": "thought",
                    "content": cleaned_content
                })
    
    # 如果没找到内容，尝试从消息中获取任何文本
    if not final_content:
        for msg in reversed(assistant_messages):
            if msg.get("role") == "assistant":
                content = msg.get("content")
                if content and isinstance(content, str):
                    final_content = content.strip()
                    break
    
    return {
        "final_content": final_content or "",
        "turn_steps": turn_steps if turn_steps else [{"type": "thought", "content": final_content}] if final_content else []
    }

async def generate_chat_llm_stream(
    user_id: str,
    conversation_id: str,
    user_message: str,
    db_manager: MongoManager
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    生成聊天流式响应，集成短期和长期记忆
    
    Args:
        user_id: 用户ID
        conversation_id: 会话ID
        user_message: 用户消息
        db_manager: MongoDB管理器
        
    Yields:
        流式响应事件
    """
    assistant_message_id = str(uuid.uuid4())
    
    try:
        # 1. 获取短期记忆（最近5轮对话 = 10条消息）
        recent_messages = await db_manager.get_recent_messages(user_id, conversation_id, limit=10)
        logger.info(f"Retrieved {len(recent_messages)} recent messages for user {user_id}")
        
        # 2. 检索长期记忆（mem0）
        long_term_memories = []
        try:
            long_term_memories = await mem0_client.search_memories(user_id, user_message, limit=5)
            logger.info(f"Retrieved {len(long_term_memories)} long-term memories for user {user_id}")
        except Exception as e:
            logger.warning(f"Failed to retrieve long-term memories: {e}")
        
        # 3. 构建消息列表
        messages = []
        
        # 添加长期记忆到系统提示（如果有）
        memory_context = ""
        if long_term_memories:
            memory_texts = [mem.get("memory", "") for mem in long_term_memories if mem.get("memory")]
            memory_context = "\n\nRelevant memories about the user:\n" + "\n".join(f"- {mem}" for mem in memory_texts)
        
        # 添加历史消息
        for msg in recent_messages:
            messages.append({
                "role": msg.get("role"),
                "content": msg.get("content", "")
            })
        
        # 添加当前用户消息
        messages.append({
            "role": "user",
            "content": user_message
        })
        
        # 4. 构建系统提示
        system_prompt = f"""You are a helpful AI assistant having a conversation with the user.

{memory_context}

Your role is to have natural, helpful conversations. Be friendly, informative, and concise. Use the memories provided to personalize your responses when relevant."""
        
        # 5. 运行LLM代理
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[Optional[Any]] = asyncio.Queue()
        
        def worker():
            try:
                logger.info(f"Starting agent worker for user {user_id}")
                for new_history_step in run_agent(system_message=system_prompt, function_list=[], messages=messages):
                    if new_history_step:
                        loop.call_soon_threadsafe(queue.put_nowait, new_history_step)
                logger.info(f"Agent worker completed for user {user_id}")
            except Exception as e:
                logger.error(f"Error in chat worker thread for user {user_id}: {e}", exc_info=True)
                loop.call_soon_threadsafe(queue.put_nowait, {"_error": str(e)})
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)
        
        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        
        last_yielded_final_content = ""
        final_assistant_messages = []
        
        try:
            while True:
                current_history = await queue.get()
                if current_history is None:
                    break
                if isinstance(current_history, dict) and "_error" in current_history:
                    raise Exception(f"Qwen Agent worker failed: {current_history['_error']}")
                if not isinstance(current_history, list):
                    continue
                
                if not current_history:
                    continue
                
                # 提取助手消息
                assistant_turn_start_index = next(
                    (i + 1 for i in range(len(current_history) - 1, -1, -1) 
                     if current_history[i].get('role') == 'user'), 
                    0
                )
                assistant_messages = current_history[assistant_turn_start_index:]
                final_assistant_messages = assistant_messages
                
                if not assistant_messages:
                    continue
                
                parsed_data = parse_assistant_response(assistant_messages)
                current_final_content = parsed_data.get("final_content", "")
                
                if len(current_final_content) > len(last_yielded_final_content):
                    new_token = current_final_content[len(last_yielded_final_content):]
                    event_payload = {
                        "type": "assistantStream",
                        "token": new_token,
                        "done": False,
                        "messageId": assistant_message_id
                    }
                    yield event_payload
                    last_yielded_final_content = current_final_content
        
        except asyncio.CancelledError:
            raise
        except LLMProviderDownError as e:
            logger.error(f"LLM provider is down for user {user_id}: {e}", exc_info=True)
            yield json.dumps({"type": "error", "message": "Sorry, our AI provider is currently down. Please try again later."}) + "\n"
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error during main chat agent run for user {user_id}: {error_msg}", exc_info=True)
            yield json.dumps({"type": "error", "message": f"An unexpected error occurred: {error_msg}"}) + "\n"
        finally:
            # 保存最终响应
            if final_assistant_messages:
                parsed_data = parse_assistant_response(final_assistant_messages)
                final_content = parsed_data.get("final_content", "")
                turn_steps = parsed_data.get("turn_steps", [])
                
                if final_content:
                    # 保存助手消息到数据库
                    await db_manager.add_message(
                        user_id=user_id,
                        conversation_id=conversation_id,
                        role="assistant",
                        content=final_content,
                        message_id=assistant_message_id,
                        turn_steps=turn_steps
                    )
                    
                    # 提取并存储长期记忆（异步，不阻塞响应）
                    try:
                        # 构建对话历史用于记忆提取
                        conversation_for_memory = messages + [{"role": "assistant", "content": final_content}]
                        await mem0_client.extract_and_store(user_id, conversation_for_memory)
                    except Exception as e:
                        logger.warning(f"Failed to extract memories: {e}")
                
                # 发送完成事件
                final_payload = {
                    "type": "assistantStream",
                    "token": "",
                    "done": True,
                    "messageId": assistant_message_id,
                    "final_content": final_content,
                    "turn_steps": turn_steps
                }
                yield final_payload
    
    except Exception as e:
        logger.error(f"Error in generate_chat_llm_stream for user {user_id}: {e}", exc_info=True)
        yield json.dumps({"type": "error", "message": f"An unexpected error occurred: {str(e)}"}) + "\n"

