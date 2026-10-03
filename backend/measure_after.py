import sys
import os
import time
from fastapi.testclient import TestClient

# Ensure app is importable
sys.path.insert(0, os.path.dirname(__file__))
from app.main import app
from app.database import init_db

print("Initializing database and warming up client...")
init_db()
client = TestClient(app)
client.get("/api/v1/health")

queries = [
    ("Greeting Query", "Hello, kaise ho?"),
    ("Profile Query", "What is my college?"),
    ("Memory Query", "What is my best friend's name?"),
    ("Document Query", "What is in my resume?"),
    ("General Query", "Explain binary search in two sentences.")
]

print("=" * 60)
print("RUNNING AFTER BENCHMARK MEASUREMENTS (OPTIMIZED PIPELINE)")
print("=" * 60)

for label, query in queries:
    print(f"\n--- Testing: {label} ('{query}') ---")
    t0 = time.perf_counter()
    res = client.post("/api/v1/chat", json={
        "content": query,
        "timezone": "Asia/Kolkata",
        "voice_mode": False
    })
    t_end = time.perf_counter()
    assert res.status_code == 200, f"Error: {res.text}"
    data = res.json()
    print(f"Response (first 60 chars): {data['response'][:60]}...")
    print(f"Elapsed wall-clock time: {(t_end - t0) * 1000:.2f} ms")

print("\nAFTER Benchmark run complete.")
