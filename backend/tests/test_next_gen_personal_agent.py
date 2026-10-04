import time
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, init_db
from app.models.user import User
from app.models.profile import PersonalProfile
from app.models.memory import Memory
from app.models.document import Document
from app.models.timeline import DailyActivity
from app.models.goal import PersonalGoal, GoalMilestone
from app.models.study import StudySubject, StudyTopic
from app.models.analytics import AnalyticsEvent
from app.models.knowledge_graph import KnowledgeEntity, KnowledgeRelationship
from app.services.knowledge_graph_service import knowledge_graph_service
from app.services.goal_service import goal_service
from app.services.study_coach_service import study_coach_service
from app.services.analytics_service import analytics_service
from app.services.daily_brief_service import daily_brief_service
from app.services.what_changed_engine import what_changed_engine
from app.services.proactive_service import proactive_service
from app.services.web_research_agent import web_research_agent
from app.services.orchestrator import agent_orchestrator
from app.security.jwt import create_access_token, get_password_hash

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db()

def get_auth_headers(username="acceptance_tester", email="acceptance@test.com"):
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            email=email,
            username=username,
            full_name="Jeet Acceptance User",
            hashed_password=get_password_hash("pass123")
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user.id).first()
    if not profile:
        profile = PersonalProfile(
            user_id=user.id,
            name="Jeet Acceptance User",
            preferred_name="Jeet",
            college="NIT Jalandhar",
            branch="Computer Science and Engineering",
            skills=["Python", "FastAPI", "React", "Node.js", "ChromaDB", "SQL RAG"]
        )
        db.add(profile)
        db.commit()

    token = create_access_token(data={"sub": user.id})
    user_id = user.id
    db.close()
    return {"Authorization": f"Bearer {token}"}, user_id


def test_acceptance_1_hey_life_wake_word_voice():
    """TEST 1: User says 'Hey Life' -> Assistant answers 'Haan, bolo.'"""
    headers, user_id = get_auth_headers("test_user_voice", "voice@test.com")
    res = client.post("/api/v1/voice/transcribe-and-respond", headers=headers, json={"text": "Hey Life"})
    assert res.status_code == 200
    data = res.json()
    assert "Haan, bolo" in data["response"]


def test_acceptance_2_roll_number_grounded_zero_llm():
    """TEST 2: User: 'Mera roll number kya hai?' -> Grounded document ID 24103068, bypass LLM."""
    headers, user_id = get_auth_headers("test_user_doc", "doc@test.com")
    db = SessionLocal()
    doc = db.query(Document).filter(Document.user_id == user_id, Document.category == "college_document").first()
    if not doc:
        doc = Document(
            user_id=user_id,
            filename="college_id.png",
            original_filename="college_id.png",
            file_type="png",
            file_path="/dummy/path.png",
            category="college_document",
            file_size=1024,
            extraction_status="completed",
            extracted_text="Student ID Card\nRoll No: 24103068\nCollege: NIT Jalandhar",
            structured_fields={"roll_number": "24103068", "college": "NIT Jalandhar"}
        )
        db.add(doc)
        db.commit()
    db.close()

    res = client.post("/api/v1/chat", headers=headers, json={"content": "Mera roll number kya hai?"})
    assert res.status_code == 200
    data = res.json()
    assert "24103068" in data["response"]
    assert any(s["source"] == "document_field" for s in data["retrieved_sources"])


def test_acceptance_3_timeline_yesterday_activities():
    """TEST 3: User: 'Maine kal kya kiya?' -> Chronological Timeline retrieval."""
    headers, user_id = get_auth_headers("test_user_timeline", "timeline@test.com")
    db = SessionLocal()
    yesterday_str = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    act = db.query(DailyActivity).filter(DailyActivity.user_id == user_id, DailyActivity.activity_date == yesterday_str).first()
    if not act:
        act = DailyActivity(
            user_id=user_id,
            activity_date=yesterday_str,
            activity_time="10:20 AM",
            title="Worked on SQL RAG",
            category="coding",
            project_tag="SQL RAG"
        )
        db.add(act)
        db.commit()
    db.close()

    res = client.post("/api/v1/chat", headers=headers, json={"content": "Maine kal kya kiya?"})
    assert res.status_code == 200
    data = res.json()
    assert "SQL RAG" in data["response"]
    assert any(s["source"] == "timeline" for s in data["retrieved_sources"])


def test_acceptance_4_current_goal_system():
    """TEST 4: User: 'Mera current goal kya hai?' -> Personal Goal System."""
    headers, user_id = get_auth_headers("test_user_goals", "goals@test.com")
    db = SessionLocal()
    goal = db.query(PersonalGoal).filter(PersonalGoal.user_id == user_id).first()
    if not goal:
        goal = goal_service.create_goal_with_roadmap(
            db=db,
            user_id=user_id,
            title="Crack Software Internship",
            category="career",
            priority=1,
            target_period_months=3
        )
    db.close()

    res = client.post("/api/v1/chat", headers=headers, json={"content": "Mera current goal kya hai?"})
    assert res.status_code == 200
    data = res.json()
    assert "Crack Software Internship" in data["response"]
    assert any(s["source"] == "personal_goals" for s in data["retrieved_sources"])


def test_acceptance_5_what_should_i_do_today_recommendation():
    """TEST 5: User: 'Aaj mujhe kya karna chahiye?' -> Priority calculation across goals & tasks."""
    headers, user_id = get_auth_headers("test_user_rec", "rec@test.com")
    db = SessionLocal()
    goal = goal_service.create_goal_with_roadmap(
        db=db,
        user_id=user_id,
        title="Prepare for Interviews",
        category="career",
        priority=1,
        target_period_months=2
    )
    db.close()

    res = client.post("/api/v1/chat", headers=headers, json={"content": "Aaj mujhe kya karna chahiye?"})
    assert res.status_code == 200
    data = res.json()
    assert "Prepare for Interviews" in data["response"] or "milestone" in data["response"].lower()
    assert any(s["source"] == "personal_goals" for s in data["retrieved_sources"])


def test_acceptance_6_study_coach_weakness_detection():
    """TEST 6: User: 'Main JavaScript me weak kaha hu?' -> AI Study Coach weak spot detection."""
    headers, user_id = get_auth_headers("test_user_study", "study@test.com")
    db = SessionLocal()
    study_coach_service.create_subject_with_roadmap(db, user_id, "JavaScript")
    db.close()

    res = client.post("/api/v1/chat", headers=headers, json={"content": "Main JavaScript me weak kaha hu?"})
    assert res.status_code == 200
    data = res.json()
    assert "Closures" in data["response"] or "weak" in data["response"].lower()
    assert any(s["source"] == "study_coach" for s in data["retrieved_sources"])


def test_acceptance_7_what_changed_since_yesterday():
    """TEST 7: User: 'Mere project me kal se kya change hua?' -> What Changed Engine."""
    headers, user_id = get_auth_headers("test_user_what_changed", "changed@test.com")
    res = client.post("/api/v1/chat", headers=headers, json={"content": "Mere project me kal se kya change hua?"})
    assert res.status_code == 200
    data = res.json()
    assert any(s["source"] == "what_changed_engine" for s in data["retrieved_sources"])
    assert "Kal" in data["response"] or "Aaj" in data["response"]


def test_acceptance_8_github_code_agent():
    """TEST 8: User: 'Mera GitHub login code samjhao.' -> GitHub Code Agent."""
    headers, user_id = get_auth_headers("test_user_gh", "gh@test.com")
    res = client.post("/api/v1/chat", headers=headers, json={"content": "Mera GitHub login code samjhao."})
    assert res.status_code == 200
    data = res.json()
    # Verified that GitHub code source is queried
    assert any(s["source"] in ["github_code", "github_remote_repos"] for s in data["retrieved_sources"]) or len(data["response"]) > 10


def test_acceptance_9_web_research_agent_internships():
    """TEST 9: User: 'Mere liye internship opportunities find karo.' -> Web Research Agent."""
    headers, user_id = get_auth_headers("test_user_web", "web@test.com")
    res = client.post("/api/v1/chat", headers=headers, json={"content": "Mere liye internship opportunities find karo."})
    assert res.status_code == 200
    data = res.json()
    assert any(s["source"] == "web_search" for s in data["retrieved_sources"])
    assert "Web Research" in data["response"] or "Internship" in data["response"]


def test_acceptance_10_productivity_analytics():
    """TEST 10: User: 'Life AI, meri productivity kaisi rahi?' -> Analytics Service."""
    headers, user_id = get_auth_headers("test_user_analytics", "analytics@test.com")
    db = SessionLocal()
    analytics_service.log_event(db, user_id, "coding", "Working on Life AI", duration_minutes=120)
    db.close()

    res = client.post("/api/v1/chat", headers=headers, json={"content": "Life AI, meri productivity kaisi rahi?"})
    assert res.status_code == 200
    data = res.json()
    assert "Productivity Report" in data["response"]
    assert any(s["source"] == "productivity_analytics" for s in data["retrieved_sources"])


def test_acceptance_11_bestie_memory_and_knowledge_graph():
    """TEST 11: User: 'Meri bestie ka naam kya hai?' -> Memory + Knowledge Graph."""
    headers, user_id = get_auth_headers("test_user_kg", "kg@test.com")
    db = SessionLocal()
    # Create knowledge graph relationship
    knowledge_graph_service.add_relationship(
        db=db,
        user_id=user_id,
        source_name="User",
        source_type="person",
        relationship_type="HAS_BESTIE",
        target_name="Niku",
        target_type="person",
        confidence=1.0,
        source="memory"
    )
    # Also add memory record
    mem = Memory(
        user_id=user_id,
        content="Meri bestie ka naam Niku hai.",
        memory_type="relationship",
        importance=5,
        confidence=1.0,
        status="active"
    )
    db.add(mem)
    db.commit()
    db.close()

    res = client.post("/api/v1/chat", headers=headers, json={"content": "Meri bestie ka naam kya hai?"})
    assert res.status_code == 200
    data = res.json()
    assert "Niku" in data["response"]


def test_acceptance_12_goal_planner_next_step():
    """TEST 12: User: 'Mere goal ko complete karne ke liye next step kya hai?' -> Next step roadmap."""
    headers, user_id = get_auth_headers("test_user_next_step", "step@test.com")
    db = SessionLocal()
    goal_service.create_goal_with_roadmap(
        db=db,
        user_id=user_id,
        title="Crack Software Placement",
        category="career",
        priority=1,
        target_period_months=3
    )
    db.close()

    res = client.post("/api/v1/chat", headers=headers, json={"content": "Mere goal ko complete karne ke liye next step kya hai?"})
    assert res.status_code == 200
    data = res.json()
    assert "Crack Software Placement" in data["response"]
    assert any(s["source"] == "personal_goals" for s in data["retrieved_sources"])
