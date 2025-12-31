"""
Chat routes - No authentication required
"""
import json
import logging
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from main.chat.utils import generate_chat_llm_stream
from main.db import mongo_manager

router = APIRouter(
    prefix="/api/chat",
    tags=["Chat"]
)

logger = logging.getLogger(__name__)

# Fixed user ID for all users (no authentication)
DEFAULT_USER_ID = "default-user"

class ChatMessageInput(BaseModel):
    """Chat message input model"""
    message: str
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None

class DeleteMessageRequest(BaseModel):
    """Delete message request model"""
    conversation_id: str
    message_id: Optional[str] = None
    clear_all: bool = False

@router.post("/message", summary="Send chat message")
async def chat_endpoint(request_body: ChatMessageInput):
    """
    Process chat message and return streaming response
    """
    if not request_body.message or not request_body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    user_id = DEFAULT_USER_ID
    
    # Get or create conversation_id
    conversation_id = request_body.conversation_id
    if not conversation_id:
        # Create new conversation
        conv = await mongo_manager.create_conversation(user_id)
        conversation_id = conv["conversation_id"]
    
    # Ensure conversation exists
    conv_exists = await mongo_manager.conversations_collection.find_one({
        "conversation_id": conversation_id,
        "user_id": user_id
    })
    if not conv_exists:
        await mongo_manager.create_conversation(user_id, conversation_id)
    
    # Save user message
    await mongo_manager.add_message(
        user_id=user_id,
        conversation_id=conversation_id,
        role="user",
        content=request_body.message.strip(),
        message_id=request_body.message_id
    )
    
    async def event_stream_generator():
        try:
            async for event in generate_chat_llm_stream(
                user_id=user_id,
                conversation_id=conversation_id,
                user_message=request_body.message.strip(),
                db_manager=mongo_manager
            ):
                if event:
                    yield json.dumps(event) + "\n"
        except Exception as e:
            logger.error(f"Error in chat stream: {e}", exc_info=True)
            error_response = {
                "type": "error",
                "message": "Sorry, I encountered an error while processing your request."
            }
            yield json.dumps(error_response) + "\n"
    
    return StreamingResponse(
        event_stream_generator(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
        }
    )

@router.get("/history", summary="Get chat history")
async def get_chat_history(conversation_id: str, limit: int = 30):
    """
    Get chat history for a conversation
    """
    messages = await mongo_manager.get_recent_messages(DEFAULT_USER_ID, conversation_id, limit=limit)
    return {"messages": messages}

@router.get("/conversations", summary="Get all conversations")
async def get_conversations(limit: int = 50):
    """
    Get all conversations for the default user
    """
    conversations = await mongo_manager.get_conversations(DEFAULT_USER_ID, limit=limit)
    return {"conversations": conversations}

@router.post("/conversations", summary="Create new conversation")
async def create_conversation(title: Optional[str] = None):
    """
    Create a new conversation
    """
    conv = await mongo_manager.create_conversation(DEFAULT_USER_ID, title=title)
    return {"conversation_id": conv["conversation_id"], "title": conv["title"]}

class UpdateConversationRequest(BaseModel):
    """Update conversation request model"""
    title: str

@router.put("/conversations/{conversation_id}", summary="Update conversation")
async def update_conversation(conversation_id: str, request: UpdateConversationRequest):
    """
    Update conversation title
    """
    await mongo_manager.update_conversation_title(DEFAULT_USER_ID, conversation_id, request.title)
    return {"message": "Conversation updated successfully.", "title": request.title}

@router.delete("/conversations/{conversation_id}", summary="Delete conversation")
async def delete_conversation(conversation_id: str):
    """
    Delete a conversation and all its messages
    """
    success = await mongo_manager.delete_conversation(DEFAULT_USER_ID, conversation_id)
    if success:
        return {"message": "Conversation deleted successfully."}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

@router.post("/delete", summary="Delete message")
async def delete_message(request: DeleteMessageRequest):
    """
    Delete a specific message or clear all messages in a conversation
    """
    user_id = DEFAULT_USER_ID
    
    if request.clear_all:
        deleted_count = await mongo_manager.delete_all_messages(user_id, request.conversation_id)
        return {"message": f"Successfully deleted {deleted_count} messages."}
    
    if request.message_id:
        success = await mongo_manager.delete_message(user_id, request.conversation_id, request.message_id)
        if success:
            return {"message": "Message deleted successfully."}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
    
    raise HTTPException(status_code=400, detail="Either message_id or clear_all must be provided")

