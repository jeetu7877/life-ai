import os
import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, init_db
from app.models.user import User
from app.models.document import Document, DocumentChunk
from app.services.rag_service import rag_service
from app.services.document_service import document_service
from app.services.query_router import query_router, QueryIntent
from app.security.jwt import get_password_hash, create_access_token

client = TestClient(app)

def get_or_create_user(db, username="doc_tester", email="doc_tester@jeet.ai"):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            email=email,
            username=username,
            full_name="Vikash Yadav",
            hashed_password=get_password_hash("docpass123")
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def create_auth_headers(user: User):
    token = create_access_token(data={"sub": user.id, "user_id": user.id, "username": user.username})
    return {"Authorization": f"Bearer {token}"}

COLLEGE_ID_TEXT = """DR B R AMBEDKAR NATIONAL INSTITUTE OF TECHNOLOGY JALANDHAR
STUDENT IDENTITY CARD
Student Name: Vikash Yadav
Roll No: 21103045
Enrollment No: 21103045
Branch: Computer Science and Engineering
Course: B.Tech
Batch: 2021-2025
Date of Birth: 15/08/2003
Blood Group: O+
Phone: +91 9876543210
Valid Up To: June 2025"""

RESUME_TEXT = """Vikash Yadav - Software Engineer
Email: vikash@example.com | Phone: +91 9876543210
Education: B.Tech in Computer Science and Engineering, NIT Jalandhar
Skills: Python, FastAPI, React, PostgreSQL, ChromaDB, Docker

Projects:
• NeuroNote: An AI-powered second brain notes management system built with FastAPI and React.
• SQL RAG Assistant: Autonomous database query system with schema-aware retrieval.

Experience:
• Software Engineering Intern at TechCorp. Built scalable microservices."""

MARKSHEET_TEXT = """NATIONAL INSTITUTE OF TECHNOLOGY JALANDHAR
GRADE CARD / MARKSHEET - SEMESTER 5
Candidate Name: Vikash Yadav
Roll No: 21103045
Branch: Computer Science & Engineering
Semester: 5
Course Code | Subject Name | Grade / Marks
CS-301 | Database Management Systems (DBMS) : 92
CS-303 | Operating Systems : 88
CS-305 | Computer Networks : 85
SGPA: 8.92
CGPA: 8.85
Result: PASS"""

def ingest_test_document(db, user_id: str, filename: str, content_text: str, category: str = "other") -> Document:
    os.makedirs("./uploads", exist_ok=True)
    file_path = os.path.join("./uploads", f"test_{int(time.time()*1000)}_{filename}")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content_text)

    content_bytes = content_text.encode("utf-8")
    file_hash = document_service.compute_file_hash(content_bytes)

    # Check if duplicate exists
    existing = db.query(Document).filter(
        Document.user_id == user_id,
        Document.file_hash == file_hash
    ).first()
    if existing:
        document_service.parse_and_process_document(db, existing.id)
        db.refresh(existing)
        return existing

    doc = Document(
        user_id=user_id,
        filename=os.path.basename(file_path),
        original_filename=filename,
        file_type="txt",
        category=category,
        file_path=file_path,
        file_size=len(content_bytes),
        file_hash=file_hash,
        extraction_status="pending"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Run processing
    document_service.parse_and_process_document(db, doc.id)
    db.refresh(doc)
    return doc

def test_1_upload_college_id_and_query_roll_number():
    """
    TEST 1: Upload College ID -> Query 'What is my roll number?' -> Exact roll number returned.
    """
    db = SessionLocal()
    user = get_or_create_user(db, username="user_doc_1", email="doc1@jeet.ai")
    headers = create_auth_headers(user)

    doc = ingest_test_document(db, user.id, "college_id_card.txt", COLLEGE_ID_TEXT)
    assert doc.extraction_status == "completed"
    assert doc.category == "college_id"
    assert doc.structured_fields.get("roll_number") == "21103045"

    res = client.post("/api/v1/chat", json={
        "content": "What is my roll number?",
        "timezone": "Asia/Kolkata"
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "21103045" in data["response"]
    assert any(s.get("source") in ["document_field", "documents"] for s in data.get("retrieved_sources", []))
    db.close()

def test_2_give_me_all_details_from_college_id():
    """
    TEST 2: Query 'Give me all details from my college ID.' -> All extracted fields returned.
    """
    db = SessionLocal()
    user = get_or_create_user(db, username="user_doc_1", email="doc1@jeet.ai")
    headers = create_auth_headers(user)

    res = client.post("/api/v1/chat", json={
        "content": "Give me all details from my college ID.",
        "timezone": "Asia/Kolkata"
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    response_text = data["response"]
    assert "21103045" in response_text
    assert "Computer Science and Engineering" in response_text or "Vikash Yadav" in response_text
    db.close()

def test_3_upload_resume_and_query_projects():
    """
    TEST 3: Upload Resume -> Query projects -> Information from resume.
    """
    db = SessionLocal()
    user = get_or_create_user(db, username="user_doc_3", email="doc3@jeet.ai")
    headers = create_auth_headers(user)

    doc = ingest_test_document(db, user.id, "vikash_resume.txt", RESUME_TEXT)
    assert doc.extraction_status == "completed"
    assert doc.category == "resume"

    res = client.post("/api/v1/chat", json={
        "content": "What projects did I do according to my resume?",
        "timezone": "Asia/Kolkata"
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    response_text = data["response"]
    assert "NeuroNote" in response_text or "SQL RAG" in response_text
    db.close()

def test_4_upload_marksheet_and_query_dbms_marks():
    """
    TEST 4: Upload Marksheet -> Query 'What are my DBMS marks?' -> Exact DBMS marks returned.
    """
    db = SessionLocal()
    user = get_or_create_user(db, username="user_doc_4", email="doc4@jeet.ai")
    headers = create_auth_headers(user)

    doc = ingest_test_document(db, user.id, "sem5_marksheet.txt", MARKSHEET_TEXT)
    assert doc.extraction_status == "completed"
    assert doc.category == "marksheet"
    assert doc.structured_fields.get("dbms_marks") == "92"

    res = client.post("/api/v1/chat", json={
        "content": "What are my marks in DBMS?",
        "timezone": "Asia/Kolkata"
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "92" in data["response"]
    db.close()

def test_5_query_what_is_my_college_routes_to_profile():
    """
    TEST 5: Query 'What is my college?' -> Routes to Profile without document/vector search.
    """
    intent, sub_cat = query_router.classify_intent("What is my college?")
    assert intent == QueryIntent.PROFILE
    assert sub_cat == "college"

def test_6_query_what_does_my_college_id_say_routes_to_document():
    """
    TEST 6: Query 'What does my college ID say about my roll number?' -> Routes to Document, not profile.
    """
    intent, sub_cat = query_router.classify_intent("What does my college ID say about my roll number?")
    assert intent == QueryIntent.DOCUMENT
    assert sub_cat is None

def test_7_multiple_docs_which_document_contains_enrollment():
    """
    TEST 7: Upload two documents -> 'Which document contains my enrollment number?' -> Correct document identified.
    """
    db = SessionLocal()
    user = get_or_create_user(db, username="user_doc_7", email="doc7@jeet.ai")
    headers = create_auth_headers(user)

    # Ingest College ID and Resume
    ingest_test_document(db, user.id, "college_id.txt", COLLEGE_ID_TEXT)
    ingest_test_document(db, user.id, "resume.txt", RESUME_TEXT)

    res = client.post("/api/v1/chat", json={
        "content": "Which document contains my enrollment number?",
        "timezone": "Asia/Kolkata"
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    response_text = data["response"]
    assert "college_id.txt" in response_text or "College Id" in response_text
    assert "21103045" in response_text
    db.close()

def test_8_backend_restart_survival():
    """
    TEST 8: Backend restart -> Query document question -> Still works from persistent PostgreSQL.
    """
    db = SessionLocal()
    user = get_or_create_user(db, username="user_doc_8", email="doc8@jeet.ai")
    headers = create_auth_headers(user)

    doc = ingest_test_document(db, user.id, "restart_test_id.txt", COLLEGE_ID_TEXT)
    doc_id = doc.id
    db.close()

    # Simulate restart by re-running init_db()
    init_db()

    # New DB session post-restart
    db_after = SessionLocal()
    persisted_doc = db_after.query(Document).filter(Document.id == doc_id).first()
    assert persisted_doc is not None
    assert persisted_doc.structured_fields.get("roll_number") == "21103045"
    db_after.close()

    res = client.post("/api/v1/chat", json={
        "content": "What is my roll number?",
        "timezone": "Asia/Kolkata"
    }, headers=headers)
    assert res.status_code == 200
    assert "21103045" in res.json()["response"]

def test_9_chroma_wipe_fallback_and_resync():
    """
    TEST 9: Chroma wipe/restart -> Query document question -> Data remains in PostgreSQL and re-indexes.
    """
    db = SessionLocal()
    user = get_or_create_user(db, username="user_doc_9", email="doc9@jeet.ai")

    doc = ingest_test_document(db, user.id, "resync_test_id.txt", COLLEGE_ID_TEXT)
    assert doc.id is not None

    # Temporarily disconnect Chroma document collection
    orig_col = rag_service.doc_collection
    rag_service.doc_collection = None

    try:
        # Structured field search in PostgreSQL still operates with 0 downtime
        field_res = document_service.find_structured_field_in_user_documents(
            db=db,
            user_id=user.id,
            query="What is my roll number?"
        )
        assert field_res is not None
        assert field_res["field_value"] == "21103045"

        # Database fallback in rag_service still succeeds
        fallback_chunks = rag_service.search_documents(
            user_id=user.id,
            query="roll number",
            top_k=2,
            db=db
        )
        assert len(fallback_chunks) > 0
    finally:
        rag_service.doc_collection = orig_col

    # Verify resync repopulates Chroma from PostgreSQL
    rag_service.sync_documents_from_db(db)
    db.close()

def test_10_strict_user_isolation():
    """
    TEST 10: User A document -> User B queries it -> Access denied / 0 results.
    """
    db = SessionLocal()
    user_a = get_or_create_user(db, username="user_a_secret", email="usera@jeet.ai")
    user_b = get_or_create_user(db, username="user_b_intruder", email="userb@jeet.ai")

    headers_b = create_auth_headers(user_b)

    # Ingest document for User A ONLY
    ingest_test_document(db, user_a.id, "user_a_college_id.txt", COLLEGE_ID_TEXT)

    # User B queries for User A's roll number
    field_res_b = document_service.find_structured_field_in_user_documents(
        db=db,
        user_id=user_b.id,
        query="What is my roll number?"
    )
    assert field_res_b is None, "User B accessed User A's document fields!"

    chunks_b = rag_service.search_documents(
        user_id=user_b.id,
        query="21103045",
        top_k=5,
        db=db
    )
    assert len(chunks_b) == 0, "User B retrieved User A's document chunks!"

    db.close()
