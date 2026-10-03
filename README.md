# 🟠 Jeet - Private Personal AI Companion

A production-quality personal AI companion named **Jeet** built for daily natural voice and text interactions, continuous long-term memory extraction, multi-format personal document ingestion (RAG), and zero-leakage encrypted sensitive vault storage.

---

## 🏛️ 1. Final Architecture

The system uses an **LLM + Agent + External Memory + RAG + Encrypted Vault** architecture. The LLM (Google Gemini) acts purely as the reasoning and generation engine; personal knowledge is never fine-tuned into weights, but stored externally and retrieved contextually.

```
                         USER
                           |
                    Text / Voice
                           |
                           v
                  Wake Word Detector
                       "Jeet"
                           |
                           v
                  Speech-to-Text (STT)
                           |
                           v
                  Personal AI Agent ("Jeet Brain")
                           |
          +----------------+----------------+
          |                |                |
          v                v                v
    Structured DB     Vector DB         Encrypted
    (PostgreSQL)      (ChromaDB)          Vault
          |                |                |
    - Daily Timeline  - Doc Chunks    - PAN / Aadhaar
    - Conversations   - Long-Term     - Passports
    - Profile           Memories      - Credentials
          |                |                |
          +-------+--------+----------------+
                  |
                  v
         LLM (Google Gemini)
                  |
                  v
          Response Generator
                  |
                  v
         Text-to-Speech (TTS)
                  |
                  v
               Speaker ("Haan, bolo.")
```

---

## 📁 2. Folder Structure

```
jeet-ai/
├── .env.example                 # Environment configuration template
├── .gitignore                   # Git ignore rules
├── docker-compose.yml           # PostgreSQL, Backend, and Frontend containers
├── Dockerfile.backend           # FastAPI production container
├── Dockerfile.frontend          # Vite + React production container
├── package_project.py           # Packager script to produce jeet-ai.zip
├── README.md                    # Comprehensive documentation
├── backend/
│   ├── requirements.txt         # Pinned backend dependencies
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI application entrypoint & CORS
│   │   ├── config.py            # Pydantic BaseSettings & env loading
│   │   ├── database.py          # SQLAlchemy session, PostgreSQL & SQLite fallback
│   │   ├── models/              # SQLAlchemy Database Models
│   │   │   ├── __init__.py
│   │   │   ├── user.py          # User & Auth model
│   │   │   ├── profile.py       # PersonalProfile model
│   │   │   ├── conversation.py  # Conversation & Message with exact timestamps
│   │   │   ├── memory.py        # Long-Term Memory (importance, confidence, status)
│   │   │   ├── document.py      # Document & DocumentChunk models
│   │   │   ├── vault.py         # SecureVaultItem (Fernet encrypted)
│   │   │   ├── timeline.py      # DailyActivity (chronological events)
│   │   │   └── audit.py         # AuditLog (access & query records)
│   │   ├── schemas/             # Pydantic v2 Request/Response validation
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── chat.py
│   │   │   ├── memory.py
│   │   │   ├── document.py
│   │   │   ├── profile.py
│   │   │   ├── timeline.py
│   │   │   ├── vault.py
│   │   │   └── voice.py
│   │   ├── security/            # Security & Cryptography
│   │   │   ├── __init__.py
│   │   │   ├── crypto.py        # Fernet AES-128, key derivation, masking & redaction
│   │   │   ├── jwt.py           # Bcrypt hashing & JWT encode/decode
│   │   │   └── dependencies.py  # get_current_user & get_optional_user
│   │   ├── services/            # Business Logic & Core AI Engines
│   │   │   ├── __init__.py
│   │   │   ├── llm_service.py   # Google Gemini conversational reasoning & extraction
│   │   │   ├── agent_service.py # "Jeet" Brain tool routing & answer synthesis
│   │   │   ├── memory_service.py# Deduplication, conflict resolution & superseding
│   │   │   ├── rag_service.py   # Persistent ChromaDB collections & semantic search
│   │   │   ├── document_service.py # Multi-format parser, OCR, field extraction
│   │   │   ├── timeline_service.py # Date query parser & calendar day aggregator
│   │   │   ├── voice_service.py # Speech STT & Neural TTS generation
│   │   │   └── vault_service.py # Encrypted vault storage & authorized reveal
│   │   └── routers/             # Clean FastAPI API Endpoints
│   │       ├── __init__.py
│   │       ├── auth.py          # /auth/register, /auth/login, /auth/me
│   │       ├── chat.py          # /chat, /conversations
│   │       ├── memory.py        # /memories, /memories/search
│   │       ├── documents.py     # /documents/upload, /documents
│   │       ├── profile.py       # /profile, /profile/update
│   │       ├── timeline.py      # /timeline
│   │       ├── vault.py         # /vault, /vault/{id}/reveal
│   │       ├── voice.py         # /voice/wake-status, /voice/synthesize
│   │       └── health.py        # /health
│   └── tests/
│       ├── __init__.py
│       ├── test_auth.py
│       ├── test_memory.py
│       └── test_agent.py
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.js       # Dark mode theme with orange accent
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx              # React Router & Layout
        ├── index.css
        ├── types/               # TypeScript interfaces
        │   └── index.ts
        ├── context/
        │   ├── AuthContext.tsx  # User session & auth state
        │   └── VoiceContext.tsx # Wake-word "Jeet" detector, state machine & audio player
        ├── services/
        │   └── api.ts           # Central Axios client
        ├── components/
        │   ├── Navbar.tsx       # Status bar & companion controls
        │   ├── Sidebar.tsx      # Sleek navigation
        │   ├── WakeWordIndicator.tsx # Glowing orb visualizer
        │   ├── VoiceWaveform.tsx     # Animated audio frequencies
        │   └── ProtectedRoute.tsx
        └── pages/
            ├── HomeVoicePage.tsx # Primary Alexa-style wake-word home experience
            ├── ChatPage.tsx      # Text & voice chat with exact timestamps & replay
            ├── MemoryPage.tsx    # Long-term memories by category with search & edit
            ├── TimelinePage.tsx  # Chronological daily activity stream
            ├── DocumentsPage.tsx # Ingestion portal for PDF, DOCX, TXT, CSV, images
            ├── ProfilePage.tsx   # Structured personal profile (skills, education, goals)
            ├── VaultPage.tsx     # AES-128 encrypted vault (PAN, Aadhaar, Passport)
            ├── SettingsPage.tsx  # Voice settings, privacy & data export
            └── AuthPage.tsx      # Login & registration modal
```

---

## 🗄️ 3. Database Schema

PostgreSQL (with SQLite fallback for instant zero-dependency local runs):

1. **`users`**: `id` (UUID), `email`, `username`, `hashed_password`, `full_name`, `created_at`.
2. **`profiles`**: `id`, `user_id`, `name`, `preferred_name`, `education`, `college`, `degree`, `branch`, `skills` (JSON array), `projects` (JSON), `goals` (JSON), `preferences` (JSON), `current_focus`.
3. **`conversations`**: `id`, `user_id`, `title`, `is_active`, `created_at`, `updated_at`.
4. **`messages`**: `id`, `conversation_id`, `user_id`, `role`, `content`, `audio_url`, `timestamp` (UTC), `timezone`, `local_time_str`, `metadata_json`.
5. **`memories`**: `id`, `user_id`, `content`, `memory_type`, `importance` (1-5), `confidence` (0.0-1.0), `status` (active / superseded / archived), `event_date`, `last_confirmed_at`, `superseded_by_id`.
6. **`documents`**: `id`, `user_id`, `filename`, `original_filename`, `file_type`, `category` (pan_card, aadhaar, resume, etc.), `file_path`, `extraction_status`, `extracted_text`, `structured_fields` (JSON).
7. **`document_chunks`**: `id`, `document_id`, `chunk_index`, `content`, `page_number`, `chroma_id`.
8. **`secure_vault`**: `id`, `user_id`, `key_name`, `item_type`, `encrypted_value` (Fernet AES-128), `masked_hint` (e.g. `ABCDE****F`), `notes`.
9. **`daily_activities`**: `id`, `user_id`, `activity_date` (YYYY-MM-DD), `activity_time`, `title`, `description`, `category`, `project_tag`.
10. **`audit_logs`**: `id`, `user_id`, `action`, `resource`, `details`, `status`, `created_at`.

---

## 🧠 4. Long-Term Memory Architecture

- **Extraction Pipeline**: Conversational turns are analyzed after each exchange. Persistent facts (skills, projects, education, goals, decisions) are automatically identified, while transient chatter ("I want coffee") is ignored.
- **Confidence Scoring**: Each memory receives a confidence score (e.g. 0.95 for definite statements vs 0.70 for tentative plans).
- **Deduplication**: Repeating an existing fact ("I know Python") refreshes `last_confirmed_at` and boosts confidence rather than creating clutter duplicates.
- **Conflict Resolution & Superseding**: When changing data occurs (e.g., "My CGPA was 8.61", later "My current CGPA is 8.78"), the old memory is marked `status="superseded"` and linked to the new entry, preserving historical truth.

---

## 📄 5. RAG & Document Pipeline

- **Supported Formats**: PDF (`pypdf`), DOCX (`python-docx`), TXT, CSV, and Images (OCR via Tesseract / Gemini Vision).
- **Classification**: Automatic categorization into `pan_card`, `aadhaar_card`, `passport`, `resume`, `certificate`, `college_document`, `notes`.
- **Sensitive Data Routing**: Identity numbers (PAN, Aadhaar, Passport) detected during extraction are **automatically encrypted into the Secure Vault** and redacted from chunk text.
- **ChromaDB Collections**:
  - `personal_documents`: Chunks with metadata (`user_id`, `document_id`, `category`, `page_number`).
  - `personal_memories`: Semantic memories with metadata (`user_id`, `memory_type`, `event_date`).

---

## 🎙️ 6. Voice & Wake-Word Architecture

- **Wake Phrase**: **"Jeet"**
- **Wake Greeting**: **"Haan, bolo."**
- **State Machine**:
  1. **Idle**: Browser continuously listens only for the wake phrase "Jeet".
  2. **Wake Up**: User says "Jeet" -> Assistant responds with "Haan, bolo." -> Status transitions to **Listening...**.
  3. **Multi-Turn Conversation**: User asks follow-up questions without needing to repeat "Jeet" before every sentence!
  4. **Speaking**: Neural voice synthesis (`hi-IN-MadhurNeural` for Hindi/Hinglish, `en-IN-PrabhatNeural` for English).
  5. **Silence Timeout**: After 7.5 seconds of silence, the system smoothly returns to **Idle** state waiting for "Jeet" again.
  6. **Manual Fallback**: Orb button can be clicked to talk immediately.

---

## 🔒 7. Security & Privacy Architecture

- **Field-Level Encryption at Rest**: Sensitive vault fields (PAN, Aadhaar, Passport, API Keys) use Fernet (AES-128 in CBC mode with PKCS7 padding and HMAC authentication).
- **Zero Plaintext Leakage**: Raw identifiers are never stored in ChromaDB embeddings, raw prompts, or application logs.
- **Masked Hints**: Safe masks (e.g. `XXXX-XXXX-9842`) are displayed in normal UI views; raw decryption is only executed upon authorized reveal.
- **User Isolation**: All queries enforce strict `user_id` filtering.

---

## 🌐 8. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Register new user & initialize profile |
| `POST` | `/api/v1/auth/login` | Authenticate & retrieve JWT token |
| `GET` | `/api/v1/auth/me` | Current user profile |
| `POST` | `/api/v1/chat` | Send message, get response, audio & extract memories |
| `GET` | `/api/v1/chat/conversations` | List conversation sessions |
| `GET` | `/api/v1/memories` | List long-term memories (with category filter) |
| `POST` | `/api/v1/memories` | Add custom memory |
| `PATCH` | `/api/v1/memories/{id}` | Edit memory |
| `DELETE` | `/api/v1/memories/{id}` | Delete memory |
| `POST` | `/api/v1/documents/upload` | Upload multiple documents (PDF, DOCX, TXT, CSV, IMG) |
| `GET` | `/api/v1/documents` | List uploaded documents & processing status |
| `GET` | `/api/v1/timeline` | Get chronological daily activities by date |
| `POST` | `/api/v1/timeline` | Log daily activity |
| `GET` | `/api/v1/profile` | Get personal structured profile |
| `PATCH` | `/api/v1/profile` | Update personal profile |
| `GET` | `/api/v1/vault` | Get masked secure vault items |
| `POST` | `/api/v1/vault` | Store encrypted sensitive item |
| `POST` | `/api/v1/vault/{id}/reveal`| Authorized reveal of sensitive item |
| `GET` | `/api/v1/voice/wake-status` | Get wake-word configuration |
| `POST` | `/api/v1/voice/synthesize` | Generate speech audio |
| `GET` | `/api/v1/health` | Service health status |

---

## 🚀 9. Quick Start Guide

### Option A: Local Run (Instant Zero-Dependency)

#### 1. Backend Setup:
```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# Linux / Mac
source venv/bin/activate

pip install -r requirements.txt
cp ../.env.example .env
```
*(Add your `GEMINI_API_KEY` in `.env`)*

Start the backend server:
```bash
python -m app.main
# Server runs on http://localhost:8000 (Swagger docs at http://localhost:8000/docs)
```

#### 2. Frontend Setup:
```bash
cd ../frontend
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

---

### Option B: Docker Compose

```bash
docker-compose up --build
```
This launches:
- PostgreSQL on `localhost:5432`
- FastAPI Backend on `localhost:8000`
- React Frontend on `localhost:5173`

---

## 🧪 10. Running Tests

```bash
cd backend
pytest -v tests/
```

---

## 📦 11. Packaging Project ZIP

To package the entire codebase into `jeet-ai.zip`:
```bash
python package_project.py
```
This generates `jeet-ai.zip` ready for distribution.
