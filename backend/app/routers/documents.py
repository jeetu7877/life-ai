import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.schemas.document import DocumentResponse
from app.security.dependencies import get_optional_user
from app.services.document_service import document_service
from app.services.rag_service import rag_service
from app.config import settings

router = APIRouter(prefix="/documents", tags=["Personal Documents"])

@router.post("/upload", response_model=List[DocumentResponse])
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """
    Upload one or multiple personal documents (PDF, DOCX, TXT, CSV, images).
    Triggers parsing, OCR, field extraction, vault routing, chunking, and ChromaDB indexing.
    """
    created_docs = []

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
        file_path = os.path.join(settings.UPLOAD_DIRECTORY, unique_filename)

        # Save to disk
        async with aiofiles.open(file_path, "wb") as out_file:
            content = await file.read()
            await out_file.write(content)

        # Compute SHA-256 file hash for deduplication
        file_hash = document_service.compute_file_hash(content)

        # Check if identical document already uploaded by this user
        existing_doc = db.query(Document).filter(
            Document.user_id == user.id,
            Document.file_hash == file_hash
        ).first()

        if existing_doc:
            existing_doc.file_path = file_path
            existing_doc.original_filename = file.filename
            existing_doc.file_size = len(content)
            existing_doc.extraction_status = "pending"
            db.commit()
            db.refresh(existing_doc)
            document_service.parse_and_process_document(db, existing_doc.id)
            created_docs.append(existing_doc)
            continue

        doc = Document(
            user_id=user.id,
            filename=unique_filename,
            original_filename=file.filename,
            file_type=ext.replace(".", "") or "unknown",
            category="other",
            file_path=file_path,
            file_size=len(content),
            file_hash=file_hash,
            extraction_status="pending"
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        created_docs.append(doc)

        # Run document extraction pipeline immediately / background task
        document_service.parse_and_process_document(db, doc.id)

    return created_docs

@router.get("", response_model=List[DocumentResponse])
def get_documents(db: Session = Depends(get_db), user: User = Depends(get_optional_user)):
    return db.query(Document).filter(
        Document.user_id == user.id
    ).order_by(Document.created_at.desc()).all()

@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: str, db: Session = Depends(get_db), user: User = Depends(get_optional_user)):
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.post("/{doc_id}/reprocess", response_model=DocumentResponse)
def reprocess_document(doc_id: str, db: Session = Depends(get_db), user: User = Depends(get_optional_user)):
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    document_service.parse_and_process_document(db, doc.id)
    db.refresh(doc)
    return doc

@router.delete("/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db), user: User = Depends(get_optional_user)):
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove from disk if exists
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass

    # Delete chunks from ChromaDB
    rag_service.delete_document(doc.id)

    db.delete(doc)
    db.commit()
    return {"status": "deleted", "id": doc_id}
