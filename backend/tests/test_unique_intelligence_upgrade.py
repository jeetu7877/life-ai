import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, init_db
from app.models.user import User
from app.models.profile import PersonalProfile
from app.models.goal import PersonalGoal, GoalMilestone
from app.models.study import StudySubject, StudyTopic
from app.models.timeline import DailyActivity
from app.models.memory import Memory
from app.models.knowledge_graph import KnowledgeEntity, KnowledgeRelationship
from app.models.journal import JournalEntry
from app.security.jwt import create_access_token, get_password_hash

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db()

def get_auth_headers(username="intel_tester", email="intel@test.com"):
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            email=email,
            username=username,
            full_name="Intelligence Tester",
            hashed_password=get_password_hash("pass123")
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user.id).first()
    if not profile:
        profile = PersonalProfile(
            user_id=user.id,
            name="Intelligence Tester",
            preferred_name="Jeet",
            college="NIT Jalandhar",
            branch="Computer Science and Engineering",
            skills=["Python", "FastAPI", "React", "Node.js", "PostgreSQL", "ChromaDB"]
        )
        db.add(profile)
        db.commit()

    token = create_access_token(data={"sub": user.id})
    user_id = user.id
    db.close()
    return {"Authorization": f"Bearer {token}"}, user_id


def test_acceptance_1_life_twin_current_situation():
    """TEST 1: User: 'What do you know about my current situation?' -> Life Twin summary using verified data."""
    headers, user_id = get_auth_headers("user_twin", "twin@test.com")
    db = SessionLocal()
    
    # Add active goal
    goal = PersonalGoal(user_id=user_id, title="Crack Software Engineering Internship", category="career", status="in_progress")
    db.add(goal)
    db.commit()
    db.close()

    res = client.post("/api/v1/chat", headers=headers, json={"content": "What do you know about my current situation?"})
    assert res.status_code == 200
    data = res.json()
    resp = data["response"]
    assert "Life Twin" in resp or "NIT Jalandhar" in resp
    assert "Computer Science and Engineering" in resp or "CSE" in resp
    assert "Internship" in resp


def test_acceptance_2_what_if_simulator():
    """TEST 2: User: 'What if I study DSA 2 hours daily for 30 days?' -> Scenario with assumptions and uncertainty."""
    headers, user_id = get_auth_headers("user_what_if", "whatif@test.com")
    res = client.post("/api/v1/chat", headers=headers, json={"content": "What if I study DSA 2 hours daily for 30 days?"})
    assert res.status_code == 200
    data = res.json()
    resp = data["response"]
    assert "What-If" in resp
    assert "Expected Effort" in resp
    assert "Trade-offs" in resp or "Risks" in resp
    assert "estimate" in resp.lower() or "analytical" in resp.lower() or "assumptions" in resp.lower()


def test_acceptance_3_time_machine_retrieval():
    """TEST 3: User: 'What was I doing one month ago?' -> Time Machine retrieval."""
    headers, user_id = get_auth_headers("user_tm", "tm@test.com")
    db = SessionLocal()
    
    one_month_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    act = DailyActivity(
        user_id=user_id,
        activity_date=one_month_ago,
        activity_time="14:00",
        title="SQL RAG Vector Search Optimization",
        description="Implemented hybrid retrieval benchmark on ChromaDB",
        category="coding"
    )
    db.add(act)
    db.commit()
    db.close()

    res = client.post("/api/v1/chat", headers=headers, json={"content": "What was I doing one month ago?"})
    assert res.status_code == 200
    data = res.json()
    resp = data["response"]
    assert "Time Machine" in resp
    assert "SQL RAG Vector Search Optimization" in resp


def test_acceptance_4_why_am_i_stuck_bottleneck():
    """TEST 4: User: 'Why am I stuck?' -> Evidence-based bottleneck analysis."""
    headers, user_id = get_auth_headers("user_stuck", "stuck@test.com")
    res = client.post("/api/v1/chat", headers=headers, json={"content": "Why am I stuck?"})
    assert res.status_code == 200
    data = res.json()
    resp = data["response"]
    assert "PROBLEM" in resp
    assert "EVIDENCE" in resp
    assert "LIKELY CAUSE" in resp
    assert "RECOMMENDED ACTION" in resp
    assert "activity suggests" in resp.lower()


def test_acceptance_5_connected_knowledge_graph():
    """TEST 5: User: 'Show me how my projects and goals are connected.' -> Knowledge Graph."""
    headers, user_id = get_auth_headers("user_kg_conn", "kgconn@test.com")
    res = client.post("/api/v1/chat", headers=headers, json={"content": "Show me how my projects and goals are connected."})
    assert res.status_code == 200
    data = res.json()
    resp = data["response"]
    assert "Knowledge Graph" in resp or "Connected" in resp
    assert "Life AI" in resp
    assert "Internship" in resp


def test_acceptance_6_what_changed_this_month():
    """TEST 6: User: 'What changed in my life this month?' -> Compare snapshots and timeline."""
    headers, user_id = get_auth_headers("user_diff", "diff@test.com")
    res = client.post("/api/v1/chat", headers=headers, json={"content": "What changed in my life this month?"})
    assert res.status_code == 200
    data = res.json()
    resp = data["response"]
    assert "Improved" in resp
    assert "Declined" in resp or "Attention" in resp
    assert "Added" in resp


def test_acceptance_7_decision_debate():
    """TEST 7: User: 'Should I focus on DSA or projects?' -> Decision Debate."""
    headers, user_id = get_auth_headers("user_debate", "debate@test.com")
    res = client.post("/api/v1/chat", headers=headers, json={"content": "Should I focus on DSA or projects?"})
    assert res.status_code == 200
    data = res.json()
    resp = data["response"]
    assert "Decision Debate" in resp
    assert "Option A" in resp
    assert "Option B" in resp
    assert "RECOMMENDED ACTION" in resp


def test_acceptance_8_project_health():
    """TEST 8: User: 'Is my Life AI project healthy?' -> Project Health."""
    headers, user_id = get_auth_headers("user_health", "health@test.com")
    res = client.post("/api/v1/chat", headers=headers, json={"content": "Is my Life AI project healthy?"})
    assert res.status_code == 200
    data = res.json()
    resp = data["response"]
    assert "Project Health Analysis" in resp
    assert "Code Activity" in resp
    assert "Testing" in resp
    assert "Security" in resp
    assert "Deployment" in resp


def test_acceptance_9_pattern_detector():
    """TEST 9: User: 'Do you notice any pattern in my work?' -> Pattern Detector."""
    headers, user_id = get_auth_headers("user_pat", "pat@test.com")
    res = client.post("/api/v1/chat", headers=headers, json={"content": "Do you notice any pattern in my work?"})
    assert res.status_code == 200
    data = res.json()
    resp = data["response"]
    assert "Pattern Detector" in resp
    assert "Evidence" in resp or "Pattern" in resp


def test_acceptance_10_what_should_i_do_next():
    """TEST 10: User: 'What should I do next?' -> Goals + tasks + Life Twin + recent activity."""
    headers, user_id = get_auth_headers("user_next", "next@test.com")
    db = SessionLocal()
    g = PersonalGoal(user_id=user_id, title="Placement Preparation", category="career", status="in_progress")
    db.add(g)
    db.commit()
    db.refresh(g)
    m = GoalMilestone(user_id=user_id, goal_id=g.id, title="Solve 5 Dynamic Programming Problems", status="pending", order_index=1)
    db.add(m)
    db.commit()
    db.close()

    res = client.post("/api/v1/chat", headers=headers, json={"content": "What should I do next?"})
    assert res.status_code == 200
    data = res.json()
    resp = data["response"]
    assert "Solve 5 Dynamic Programming Problems" in resp or "Placement Preparation" in resp or "recommend" in resp.lower()


def test_user_data_isolation():
    """Verify User A's private Life Twin and Journal entries cannot be accessed by User B."""
    headers_a, user_id_a = get_auth_headers("user_iso_a", "iso_a@test.com")
    headers_b, user_id_b = get_auth_headers("user_iso_b", "iso_b@test.com")

    # User A creates a journal entry
    res = client.post("/api/v1/journal", headers=headers_a, json={
        "title": "Private Diary Entry User A",
        "content": "Secret algorithmic roadmap discussion.",
        "category": "private_journal"
    })
    assert res.status_code == 200

    # User B lists journal entries -> must NOT contain User A's entry
    res_b = client.get("/api/v1/journal", headers=headers_b)
    assert res_b.status_code == 200
    entries_b = res_b.json()
    for entry in entries_b:
        assert entry["title"] != "Private Diary Entry User A"
