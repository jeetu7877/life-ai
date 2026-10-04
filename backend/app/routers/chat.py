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
    import time
    t_req_start = time.perf_counter()
    auth_ms = getattr(user, "_auth_ms", 0.0)

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

    # 3. Retrieve recent history for context (Push LIMIT to SQL database)
    t_hist_start = time.perf_counter()
    history_records = db.query(Message).filter(
        Message.conversation_id == conv.id
    ).order_by(Message.timestamp.desc()).limit(10).all()

    chat_history = [{"role": m.role, "content": m.content} for m in reversed(history_records)]
    history_ms = round((time.perf_counter() - t_hist_start) * 1000, 2)

    # 4. Agent processing (run in worker thread to prevent event-loop starvation)
    import asyncio
    agent_result = await asyncio.to_thread(
        agent_service.process_message,
        db=db,
        user_id=user.id,
        user_message=payload.content,
        chat_history=chat_history,
        timezone=payload.timezone or "Asia/Kolkata",
        conversation_id=conv.id
    )

    response_text = agent_result["response"]
    retrieved_sources = agent_result.get("retrieved_sources", [])
    tools_executed = agent_result.get("tools_executed", [])
    agent_timing = agent_result.get("timing", {})

    # 5. Audio generation (only if in voice mode)
    t_tts_start = time.perf_counter()
    audio_url = None
    if payload.voice_mode:
        audio_url = await voice_service.text_to_speech(response_text)
    tts_ms = round((time.perf_counter() - t_tts_start) * 1000, 2)

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

    # 7. Memory extraction pipeline: commit deterministic facts immediately (<1ms)
    lower_content = payload.content.lower().strip()
    is_greeting = any(s.get("source") in ["fast_greeting", "profile_memory", "secure_vault"] for s in retrieved_sources)
    is_general_query = lower_content.startswith(("explain", "what is", "how do", "how does", "why is", "tell me about"))
    has_fact_marker = any(k in lower_content for k in [
        "mera", "meri", "mere", "mujhe", "maine", "i am", "i'm", "my", "i have", 
        "i work", "i live", "i like", "i prefer", "remember", "yaad", "favorite",
        "bestie", "best friend", "dost"
    ])
    should_extract = not is_greeting and not is_general_query and (has_fact_marker or not lower_content.endswith("?"))

    extracted_memories = []
    if should_extract:
        try:
            extracted_memories = memory_service.process_conversation_for_memories(
                db=db,
                user_id=user.id,
                user_message=payload.content,
                assistant_response=response_text,
                conversation_id=conv.id,
                source_message_id=user_msg.id
            )
        except Exception as e:
            import logging
            logging.getLogger("life.chat").warning(f"Memory extraction note: {e}")

    total_ms = round((time.perf_counter() - t_req_start) * 1000, 2)
    profile_ms = agent_timing.get("profile_ms", 0.0)
    memory_ms = agent_timing.get("memory_ms", 0.0)
    vector_ms = agent_timing.get("vector_ms", 0.0)
    document_ms = agent_timing.get("document_ms", 0.0)
    llm_ms = agent_timing.get("llm_ms", 0.0)

    perf_log = (
        f"\n[PERF]\n"
        f"auth_ms={auth_ms:.2f}\n"
        f"profile_ms={profile_ms:.2f}\n"
        f"memory_ms={memory_ms:.2f}\n"
        f"vector_ms={vector_ms:.2f}\n"
        f"history_ms={history_ms:.2f}\n"
        f"document_ms={document_ms:.2f}\n"
        f"llm_ms={llm_ms:.2f}\n"
        f"tts_ms={tts_ms:.2f}\n"
        f"total_ms={total_ms:.2f}\n"
    )
    import logging
    logging.getLogger("life.perf").info(perf_log)
    print(perf_log)

    return ChatAnswerResponse(
        response=response_text,
        conversation_id=conv.id,
        message_id=assistant_msg.id,
        audio_url=audio_url,
        retrieved_sources=retrieved_sources,
        tools_executed=tools_executed,
        memories_extracted=[m.id for m in extracted_memories]
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
