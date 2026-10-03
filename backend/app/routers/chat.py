from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.conversation import Conversation, Message
from app.schemas.chat import MessageCreate, ChatAnswerResponse, ConversationResponse, MessageResponse
from app.security.dependencies import get_optional_user
from app.services.agent_service import agent_service
from app.services.memory_service import memory_service
from app.services.voice_service import voice_service

router = APIRouter(prefix="/chat", tags=["Chat & Agent"])

def extract_memories_task(user_id: str, user_message: str, assistant_response: str, conv_id: str):
    """Background task to extract persistent memories without blocking chat response."""
    bg_db = SessionLocal()
    try:
        memory_service.process_conversation_for_memories(
            db=bg_db,
            user_id=user_id,
            user_message=user_message,
            assistant_response=assistant_response,
            conversation_id=conv_id
        )
    except Exception:
        pass
    finally:
        bg_db.close()

@router.post("", response_model=ChatAnswerResponse)
async def send_chat_message(
    payload: MessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """
    Main conversational endpoint:
    1. Persist user message with exact UTC timestamp and local time
    2. Retrieve conversation context
    3. Route through Agent Tool System (Profile, ChromaDB, Timeline, Vault)
    4. Generate Jeet's response
    5. Save assistant message
    6. Extract persistent long-term memories in background
    7. Generate natural speech audio
    """
    # 1. Get or create conversation
    conv = None
    if payload.conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == payload.conversation_id,
            Conversation.user_id == user.id
        ).first()

    if not conv:
        # Generate friendly title from user's first query
        title = payload.content[:35] + "..." if len(payload.content) > 35 else payload.content
        conv = Conversation(
            user_id=user.id,
            title=title or "Daily Chat"
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # 2. Record User Message
    now = datetime.utcnow()
    user_msg = Message(
        conversation_id=conv.id,
        user_id=user.id,
        role="user",
        content=payload.content,
        timestamp=now,
        timezone=payload.timezone or "Asia/Kolkata",
        local_time_str=now.strftime("%Y-%m-%d %I:%M %p")
    )
    db.add(user_msg)
    db.commit()

    # 3. Retrieve recent history for context
    history_records = db.query(Message).filter(
        Message.conversation_id == conv.id
    ).order_by(Message.timestamp.asc()).all()

    chat_history = [{"role": m.role, "content": m.content} for m in history_records[-10:]]

    # 4. Agent processing
    agent_result = agent_service.process_message(
        db=db,
        user_id=user.id,
        user_message=payload.content,
        chat_history=chat_history,
        timezone=payload.timezone or "Asia/Kolkata"
    )

    response_text = agent_result["response"]
    retrieved_sources = agent_result.get("retrieved_sources", [])

    # 5. Audio generation (immediate if in voice mode, async background for text mode)
    audio_url = None
    if payload.voice_mode:
        audio_url = await voice_service.text_to_speech(response_text)

    # 6. Save Assistant Message
    assistant_msg = Message(
        conversation_id=conv.id,
        user_id=user.id,
        role="assistant",
        content=response_text,
        audio_url=audio_url,
        timestamp=datetime.utcnow(),
        timezone=payload.timezone or "Asia/Kolkata",
        local_time_str=datetime.utcnow().strftime("%Y-%m-%d %I:%M %p"),
        metadata_json={"sources": retrieved_sources}
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    # In text mode, synthesize audio asynchronously so Replay works without blocking response
    if not payload.voice_mode:
        async def synthesize_text_bg(msg_id: str, text: str):
            url = await voice_service.text_to_speech(text)
            if url:
                bg_db = SessionLocal()
                try:
                    m = bg_db.query(Message).filter(Message.id == msg_id).first()
                    if m:
                        m.audio_url = url
                        bg_db.commit()
                except Exception:
                    pass
                finally:
                    bg_db.close()
        background_tasks.add_task(synthesize_text_bg, assistant_msg.id, response_text)

    # 7. Memory extraction pipeline runs asynchronously in background
    background_tasks.add_task(
        extract_memories_task,
        user.id,
        payload.content,
        response_text,
        conv.id
    )

    return ChatAnswerResponse(
        response=response_text,
        conversation_id=conv.id,
        message_id=assistant_msg.id,
        audio_url=audio_url,
        retrieved_sources=retrieved_sources,
        memories_extracted=[]
    )

@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(db: Session = Depends(get_db), user: User = Depends(get_optional_user)):
    return db.query(Conversation).filter(
        Conversation.user_id == user.id
    ).order_by(Conversation.updated_at.desc()).all()

@router.get("/conversations/{conv_id}", response_model=ConversationResponse)
def get_conversation_detail(conv_id: str, db: Session = Depends(get_db), user: User = Depends(get_optional_user)):
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: str, db: Session = Depends(get_db), user: User = Depends(get_optional_user)):
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"status": "deleted", "id": conv_id}
