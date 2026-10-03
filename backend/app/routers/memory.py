from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.memory import Memory
from app.schemas.memory import MemoryCreate, MemoryUpdate, MemoryResponse, MemorySearchQuery
from app.security.dependencies import get_optional_user
from app.services.memory_service import memory_service
from app.services.rag_service import rag_service
from app.services.embedding_service import embedding_service

router = APIRouter(prefix="/memories", tags=["Long-Term Memory"])

@router.get("", response_model=List[MemoryResponse])
def get_memories(
    memory_type: Optional[str] = None,
    status: Optional[str] = "active",
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    query = db.query(Memory).filter(Memory.user_id == user.id)
    if memory_type:
        query = query.filter(Memory.memory_type == memory_type)
    if status:
        query = query.filter(Memory.status == status)
    return query.order_by(Memory.created_at.desc()).all()

@router.post("", response_model=MemoryResponse)
def create_memory(
    mem_in: MemoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    # Compute persistent vector embedding
    embedding_vector = embedding_service.get_embedding(mem_in.content)

    mem = Memory(
        user_id=user.id,
        content=mem_in.content,
        memory_type=mem_in.memory_type,
        importance=mem_in.importance,
        confidence=mem_in.confidence,
        event_date=mem_in.event_date,
        metadata_json=mem_in.metadata_json or {},
        embedding=embedding_vector,
        embedding_status="ready"
    )
    db.add(mem)
    db.commit()
    db.refresh(mem)

    # Index in vector store (safe try/except inside add_memory)
    rag_service.add_memory(
        memory_id=mem.id,
        user_id=user.id,
        content=mem.content,
        memory_type=mem.memory_type,
        event_date=mem.event_date
    )
    return mem

@router.patch("/{mem_id}", response_model=MemoryResponse)
def update_memory(
    mem_id: str,
    mem_in: MemoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    mem = db.query(Memory).filter(Memory.id == mem_id, Memory.user_id == user.id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    if mem_in.content is not None:
        mem.content = mem_in.content
        mem.embedding = embedding_service.get_embedding(mem_in.content)
        mem.embedding_status = "ready"
    if mem_in.memory_type is not None:
        mem.memory_type = mem_in.memory_type
    if mem_in.importance is not None:
        mem.importance = mem_in.importance
    if mem_in.confidence is not None:
        mem.confidence = mem_in.confidence
    if mem_in.status is not None:
        mem.status = mem_in.status
    if mem_in.event_date is not None:
        mem.event_date = mem_in.event_date

    db.commit()
    db.refresh(mem)

    # Re-index in vector cache
    rag_service.add_memory(
        memory_id=mem.id,
        user_id=user.id,
        content=mem.content,
        memory_type=mem.memory_type,
        event_date=mem.event_date
    )
    return mem

@router.delete("/{mem_id}")
def delete_memory(
    mem_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    success = memory_service.delete_memory(db, mem_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"status": "deleted", "id": mem_id}

@router.post("/search")
def search_memories(
    search_in: MemorySearchQuery,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    results = rag_service.search_memories(
        user_id=user.id,
        query=search_in.query,
        top_k=search_in.limit,
        memory_type=search_in.memory_type,
        db=db
    )
    return {"query": search_in.query, "results": results}
