import time
import re
import json
import logging
import concurrent.futures
from datetime import datetime
from typing import Dict, Any, List, Optional, Generator
from sqlalchemy.orm import Session

from app.models.profile import PersonalProfile
from app.models.conversation import Message
from app.services.llm_service import llm_service
from app.services.rag_service import rag_service
from app.services.timeline_service import timeline_service
from app.services.vault_service import vault_service
from app.services.document_service import document_service
from app.services.conversation_service import conversation_service
from app.services.query_router import query_router, QueryIntent, RoutePlan
from app.services.tools.registry import tool_registry
from app.services.github_service import github_service
from app.services.cache_service import cache_service
from app.services.context_manager import context_manager
from app.services.llm_providers import model_router
from app.services.goal_service import goal_service
from app.services.study_coach_service import study_coach_service
from app.services.analytics_service import analytics_service
from app.services.daily_brief_service import daily_brief_service
from app.services.what_changed_engine import what_changed_engine
from app.services.proactive_service import proactive_service
from app.services.knowledge_graph_service import knowledge_graph_service
from app.services.web_research_agent import web_research_agent
from app.services.life_twin_service import life_twin_service
from app.services.what_if_simulator import what_if_simulator
from app.services.time_machine_service import time_machine_service
from app.services.bottleneck_engine import bottleneck_engine
from app.services.project_health_service import project_health_service
from app.services.decision_debate_service import decision_debate_service
from app.services.pattern_detector_service import pattern_detector_service
from app.services.music_service import music_backend_service

logger = logging.getLogger("life.orchestrator")

class AgentOrchestrator:
    """
    Central Autonomous Agent Orchestrator:
    - Normalizes incoming requests across text & hands-free voice.
    - Zero-LLM Fast-paths (<5ms greetings, <10ms profile, <20ms vault, <5ms doc fields, <10ms simple memory).
    - Multi-level caching (L1 in-process, L2 optional Redis, Semantic response cache).
    - Parallel multi-source retrieval (concurrent memory, document, code search).
    - Smart Context Management (strict budgeting, relevance filtering).
    - Model tier routing (Small / Large / Ollama fallback).
    - Token streaming support.
    - Structured performance latency tracking ([PERF] logs & diagnostics).
    """

    def process_request(
        self,
        db: Session,
        user_id: str,
        user_message: str,
        chat_history: List[Dict[str, str]],
        conversation_id: Optional[str] = None,
        timezone: str = "Asia/Kolkata"
    ) -> Dict[str, Any]:
        t0 = time.perf_counter()
        retrieved_sources: List[Dict[str, Any]] = []
        tools_executed: List[Dict[str, Any]] = []
        context_memories = ""
        context_docs = ""
        context_code = ""
        user_profile_summary = ""

        timing_metrics = {
            "router_ms": 0.0,
            "cache_ms": 0.0,
            "profile_ms": 0.0,
            "tools_ms": 0.0,
            "memory_ms": 0.0,
            "document_ms": 0.0,
            "github_ms": 0.0,
            "llm_ms": 0.0,
            "total_ms": 0.0,
            "llm_used": False,
            "cache_hit": "MISS",
            "provider": "none"
        }

        raw_msg = user_message.strip()
        lower_msg = raw_msg.lower()

        # Step 0: Semantic Response Cache Check (<1ms)
        t_cache_start = time.perf_counter()
        cached = cache_service.get_semantic_response(user_id, raw_msg)
        timing_metrics["cache_ms"] = round((time.perf_counter() - t_cache_start) * 1000, 2)
        if cached and cached.get("response"):
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["cache_hit"] = "HIT_L1"
            timing_metrics["llm_used"] = False
            logger.info(f"[PERF] route=CACHE cache=HIT total={total_ms}ms")
            return {
                "response": cached["response"],
                "retrieved_sources": cached.get("retrieved_sources", [{"source": "semantic_cache"}]),
                "tools_executed": cached.get("tools_executed", []),
                "timing": timing_metrics
            }

        # Step 1: High-Speed Fast-Path Routing (<1ms)
        t_route_start = time.perf_counter()
        plan: RoutePlan = query_router.plan_route(raw_msg)
        intent = plan.intent
        sub_cat = plan.sub_category
        timing_metrics["router_ms"] = round((time.perf_counter() - t_route_start) * 1000, 2)

        # FAST PATH 1: Casual Greetings & Chit-chat (<5ms, 0 DB, 0 Vector, 0 LLM)
        if intent == QueryIntent.GREETING:
            greeting_resp = query_router.handle_greeting_fast_path(raw_msg)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": greeting_resp,
                "retrieved_sources": [{"source": "fast_greeting"}],
                "tools_executed": [],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=GREETING cache=MISS db=0ms vector=0ms llm=false total={total_ms}ms")
            return result

        # FAST PATH 1.5: Indian Standard Time & Date Query (<2ms, IST)
        is_time_date_query = any(p in lower_msg for p in [
            "kya time", "kitne baje", "time batao", "current time", "what time",
            "what is the time", "aaj kya date", "aaj ki date", "today date",
            "what is today's date", "kaun sa din", "what day is today", "aaj kaun sa din"
        ])
        if is_time_date_query:
            from datetime import timezone as dt_tz, timedelta
            try:
                from zoneinfo import ZoneInfo
                ist_tz = ZoneInfo("Asia/Kolkata")
                now_ist = datetime.now(ist_tz)
            except Exception:
                ist_tz = dt_tz(timedelta(hours=5, minutes=30))
                now_ist = datetime.now(ist_tz)

            time_formatted = now_ist.strftime("%I:%M %p")
            date_formatted = now_ist.strftime("%A, %d %B %Y")

            if "date" in lower_msg or "din" in lower_msg:
                reply = f"Aaj {date_formatted} hai, aur abhi Indian Standard Time ke hisaab se {time_formatted} ho rahe hain."
            else:
                reply = f"Abhi Indian Standard Time ke anusaar {time_formatted} ho rahe hain ({date_formatted})."

            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            return {
                "response": reply,
                "retrieved_sources": [{"source": "india_standard_time"}],
                "tools_executed": [],
                "timing": timing_metrics
            }

        # FAST PATH 1.6: Music Search & Playback Controller (<15ms)
        is_music_stop = any(p in lower_msg for p in [
            "stop song", "song stop", "stop music", "music stop", "gaana stop", "gana stop",
            "music band karo", "gaana band karo", "gana band karo", "song band karo",
            "isko band karo", "band karo isko", "gaana roko", "gana roko", "music roko", "song roko",
            "roko isko"
        ]) or lower_msg in ["stop", "stop karo", "band karo"]

        is_music_pause = any(p in lower_msg for p in [
            "gaana pause", "gana pause", "pause music", "pause song", "song pause", "music pause", "ye gaana pause karo"
        ]) or lower_msg in ["pause", "pause karo"]

        is_music_resume = any(p in lower_msg for p in ["resume music", "resume song", "gaana chalu karo", "gana chalu karo", "continue music", "phir se chalao", "ye phir se chalao"]) or lower_msg in ["resume", "resume karo", "continue"]
        is_music_next = any(p in lower_msg for p in ["next song", "agla gaana", "agla gana", "change song", "gaana badlo", "gana badlo", "next track"]) or lower_msg in ["next", "agla"]
        is_music_prev = any(p in lower_msg for p in ["previous song", "pichhla gaana", "pichla gana", "pichhla gana"]) or lower_msg in ["previous", "pichhla", "pichla"]
        has_music_action = any(act in lower_msg for act in [
            "chalao", "chlao", "chala do", "chla do", "chala de", "chla de", "chalana",
            "bajao", "bjao", "baja do", "bja do", "baja de", "bja de",
            "lagao", "lgao", "laga do", "lga do", "lagana", "laga de", "lga de",
            "sunao", "suna do", "suna de", "play"
        ])
        is_music_play = has_music_action and any(w in lower_msg for w in [
            "gaana", "gana", "geet", "song", "music", "track", "play", "chalao", "chlao", "bajao", "bjao", "lagao", "lgao", "sunao"
        ])

        if is_music_stop:
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            return {
                "response": "Music stop kar diya hai.",
                "retrieved_sources": [{"source": "music_controller"}],
                "tools_executed": [{"tool": "music_control", "action": "stop"}],
                "timing": timing_metrics
            }

        if is_music_pause:
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            return {
                "response": "Gaana pause kar diya hai.",
                "retrieved_sources": [{"source": "music_controller"}],
                "tools_executed": [{"tool": "music_control", "action": "pause"}],
                "timing": timing_metrics
            }

        if is_music_resume:
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            return {
                "response": "Gaana resume kar diya hai.",
                "retrieved_sources": [{"source": "music_controller"}],
                "tools_executed": [{"tool": "music_control", "action": "resume"}],
                "timing": timing_metrics
            }

        if is_music_next:
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            return {
                "response": "Agla gaana chala rahi hoon.",
                "retrieved_sources": [{"source": "music_controller"}],
                "tools_executed": [{"tool": "music_control", "action": "next"}],
                "timing": timing_metrics
            }

        if is_music_prev:
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            return {
                "response": "Pichhla gaana chala rahi hoon.",
                "retrieved_sources": [{"source": "music_controller"}],
                "tools_executed": [{"tool": "music_control", "action": "previous"}],
                "timing": timing_metrics
            }

        if is_music_play:
            song_query = re.sub(r'^(hey\s*life|life|ai|hey\s*ai|plz|please|yaar|bhai|sun|suno)\s*', '', lower_msg, flags=re.IGNORECASE)
            song_query = re.sub(r'(gaana chalao|gana chalao|gaana chlao|gana chlao|gaana bajao|gana bajao|gaana bjao|song chalao|song chlao|music chalao|music chlao|music play|song play|play music|play song|play karo|play kar do|play|chalao|chlao|chala do|chla do|chala de|chla de|chalana|chalu karo|bajao|bjao|baja do|bja do|baja de|bja de|lagao|lgao|laga do|lga do|lagana|laga de|lga de|sunao|suna do|suna de|suno|ke gaane|ke gane)', '', song_query, flags=re.IGNORECASE)
            song_query = re.sub(r'\b(ka|ke|ki|ko|me|mein|se|pe|par)\b', ' ', song_query, flags=re.IGNORECASE)
            song_query = re.sub(r'\b(ye|yeh|koi|ek|achha|accha|naya|purana|favourite|favorite|top|hit|song|gaana|gana|geet|music|track)\b', ' ', song_query, flags=re.IGNORECASE).strip()
            if not song_query or len(song_query) < 2:
                song_query = "Bollywood Top Hits"

            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    search_res = concurrent.futures.ThreadPoolExecutor().submit(
                        asyncio.run, music_backend_service.search(song_query, client_id=f"user_{user_id}", limit=5)
                    ).result(timeout=4.0)
                else:
                    search_res = loop.run_until_complete(music_backend_service.search(song_query, client_id=f"user_{user_id}", limit=5))
            except Exception as se:
                logger.warning(f"[MUSIC_FAST] Search execution note: {se}")
                search_res = {"results": []}

            results = search_res.get("results", [])
            compilation_regex = r"(jukebox|mashup|compilation|all\s*songs|nonstop|non-stop|full\s*album|collection|top\s*\d+\s*songs|hits\s*20\d\d)"
            is_explicit_comp = bool(re.search(r"(jukebox|mashup|compilation|all\s*songs|nonstop|non-stop|collection)", song_query, flags=re.IGNORECASE))
            single_track = None
            if not is_explicit_comp and results:
                for r in results:
                    if not re.search(compilation_regex, r.get("title", ""), flags=re.IGNORECASE):
                        single_track = r
                        break
            top_track = single_track if single_track else (results[0] if results else None)

            if top_track:
                raw_t = top_track.get("title", song_query)
                clean_t = re.sub(r'\[.*?\]|\(.*?\)|\|.*$', '', raw_t)
                clean_t = re.sub(r'(official\s*video|official\s*audio|full\s*song|video\s*song)', '', clean_t, flags=re.IGNORECASE).strip()
                track_title = clean_t if clean_t else raw_t
            else:
                track_title = song_query

            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            return {
                "response": f"Theek hai! {track_title} gaana chala rahi hoon.",
                "retrieved_sources": [{"source": "music_search", "provider": "youtube"}],
                "tools_executed": [{"tool": "music_play", "intent": "MUSIC_PLAY", "query": song_query, "track": top_track}],
                "timing": timing_metrics
            }

        # FAST PATH 1.7: Smart Alarm Controller (<5ms)
        is_alarm_query = any(k in lower_msg for k in ["alarm", "alram", "elarm", "utha dena", "wake me up", "jagana", "jaga dena", "baje utha"])
        if is_alarm_query and not any(k in lower_msg for k in ["kya hota", "kaise hota", "what is"]):
            # Check for dismiss
            if any(k in lower_msg for k in ["band karo", "roko", "dismiss", "stop", "off karo"]):
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                timing_metrics["llm_used"] = False
                return {
                    "response": "Alarm band kar diya hai.",
                    "retrieved_sources": [{"source": "alarm_controller"}],
                    "tools_executed": [{"tool": "alarm_control", "action": "dismiss"}],
                    "timing": timing_metrics
                }

            # Check for relative delay (e.g. 10 minute baad)
            min_match = re.search(r'(\d+)\s*(?:minute|min|minto?)\s*(?:baad|later|me|mein)?', lower_msg)
            if min_match:
                mins = int(min_match.group(1))
                from datetime import timezone as dt_tz, timedelta
                try:
                    from zoneinfo import ZoneInfo
                    ist_tz = ZoneInfo("Asia/Kolkata")
                    target_dt = datetime.now(ist_tz) + timedelta(minutes=mins)
                except Exception:
                    ist_tz = dt_tz(timedelta(hours=5, minutes=30))
                    target_dt = datetime.now(ist_tz) + timedelta(minutes=mins)

                time_str = target_dt.strftime("%I:%M %p")
                target_ts = int(target_dt.timestamp() * 1000)
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                timing_metrics["llm_used"] = False
                return {
                    "response": f"Done! {mins} minute baad ({time_str}) ka alarm set kar diya hai.",
                    "retrieved_sources": [{"source": "alarm_controller"}],
                    "tools_executed": [{"tool": "alarm_create", "time_str": time_str, "timestamp_ms": target_ts, "label": f"{mins} Minute Quick Alarm"}],
                    "timing": timing_metrics
                }

            # Normalize Hindi number words
            normalized_alarm = lower_msg
            hindi_nums = {
                'ek': '1', 'do': '2', 'teen': '3', 'char': '4', 'chaar': '4',
                'paanch': '5', 'panch': '5', 'chhe': '6', 'che': '6', 'chhah': '6',
                'saat': '7', 'sat': '7', 'aath': '8', 'ath': '8', 'nau': '9', 'no': '9',
                'das': '10', 'dus': '10', 'gyarah': '11', 'barah': '12'
            }
            for hw, hn in hindi_nums.items():
                normalized_alarm = re.sub(rf'\b{hw}\b(?=\s*(?:baje|am|pm))', hn, normalized_alarm)

            time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(?:baje|am|pm|o\'clock)?', normalized_alarm)
            if not time_match:
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                timing_metrics["llm_used"] = False
                return {
                    "response": "Aapko kitne baje ka alarm lagana hai? Jaise bolein: 'kal subah 6 baje ka alarm laga do'.",
                    "retrieved_sources": [{"source": "alarm_controller"}],
                    "tools_executed": [],
                    "timing": timing_metrics
                }

            hour = int(time_match.group(1))
            minute = int(time_match.group(2)) if time_match.group(2) else 0
            is_pm = any(p in lower_msg for p in ["pm", "shaam", "sham", "dopahar", "raat", "night", "evening"])
            is_am = any(p in lower_msg for p in ["am", "subah", "morning", "bhor"])
            is_tomorrow = any(p in lower_msg for p in ["kal", "tomorrow"])

            if is_pm and hour < 12:
                hour += 12
            elif is_am and hour == 12:
                hour = 0
            elif not is_pm and not is_am:
                if 8 <= hour <= 11:
                    hour += 12

            from datetime import timezone as dt_tz, timedelta
            try:
                from zoneinfo import ZoneInfo
                ist_tz = ZoneInfo("Asia/Kolkata")
                now_ist = datetime.now(ist_tz)
            except Exception:
                ist_tz = dt_tz(timedelta(hours=5, minutes=30))
                now_ist = datetime.now(ist_tz)

            alarm_dt = now_ist.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if is_tomorrow or alarm_dt <= now_ist:
                alarm_dt += timedelta(days=1)

            time_str = alarm_dt.strftime("%I:%M %p")
            target_ts = int(alarm_dt.timestamp() * 1000)
            day_word = "kal " if is_tomorrow or alarm_dt.date() > now_ist.date() else ""

            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            return {
                "response": f"Done! {day_word}{time_str} ka alarm set kar diya hai.",
                "retrieved_sources": [{"source": "alarm_controller"}],
                "tools_executed": [{"tool": "alarm_create", "time_str": time_str, "timestamp_ms": target_ts, "label": f"{day_word}{time_str} Alarm".strip()}],
                "timing": timing_metrics
            }

        # FAST PATH 2: Level 1 Profile Memory (<10ms, direct SQL lookup)
        if intent == QueryIntent.PROFILE:
            t_profile_start = time.perf_counter()
            profile_resp = query_router.handle_profile_fast_path(db, user_id, sub_cat)
            timing_metrics["profile_ms"] = round((time.perf_counter() - t_profile_start) * 1000, 2)
            if profile_resp:
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                timing_metrics["llm_used"] = False
                result = {
                    "response": profile_resp,
                    "retrieved_sources": [{"source": "profile_memory", "category": sub_cat}],
                    "tools_executed": [],
                    "timing": timing_metrics
                }
                cache_service.set_semantic_response(user_id, raw_msg, result)
                logger.info(f"[PERF] route=PROFILE sub={sub_cat} cache=MISS db={timing_metrics['profile_ms']}ms llm=false total={total_ms}ms")
                return result

        # FAST PATH 3: Secure Vault Queries (<30ms)
        if intent == QueryIntent.VAULT:
            secret_val = vault_service.query_by_type_or_name(db, user_id, raw_msg)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            if secret_val:
                return {
                    "response": f"Aapka requested document number hai: {secret_val}",
                    "retrieved_sources": [{"source": "secure_vault", "status": "authorized_retrieval"}],
                    "tools_executed": [],
                    "timing": timing_metrics
                }
            else:
                return {
                    "response": "Mujhe aapke secure vault mein yeh number nahi mila. Aap document upload kar sakte hain ya Vault section mein add kar sakte hain.",
                    "retrieved_sources": [],
                    "tools_executed": [],
                    "timing": timing_metrics
                }

        # FAST PATH 4: Document Structured Field Lookup (<5ms)
        if intent == QueryIntent.DOCUMENT:
            t_doc_field_start = time.perf_counter()
            field_res = document_service.find_structured_field_in_user_documents(db, user_id, raw_msg)
            doc_field_ms = round((time.perf_counter() - t_doc_field_start) * 1000, 2)
            timing_metrics["document_ms"] = doc_field_ms
            if field_res:
                ans = field_res.get("summary_text") if field_res.get("is_full_summary") else field_res.get("answer_text")
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                timing_metrics["llm_used"] = False
                result = {
                    "response": ans,
                    "retrieved_sources": [{
                        "source": "document_field",
                        "document_id": field_res.get("document_id"),
                        "document_name": field_res.get("document_name"),
                        "document_category": field_res.get("document_category"),
                        "field_name": field_res.get("field_name", "full_summary")
                    }],
                    "tools_executed": [{
                        "tool": "lookup_document_field",
                        "status": "success",
                        "field": field_res.get("field_name")
                    }],
                    "timing": timing_metrics
                }
                cache_service.set_semantic_response(user_id, raw_msg, result)
                logger.info(f"[PERF] route=DOC_FIELD db={doc_field_ms}ms llm=false total={total_ms}ms")
                return result

        # FAST PATH 5: Simple Memory Lookup (<10ms, e.g. best friend / bestie)
        if intent == QueryIntent.MEMORY:
            mem_fast = query_router.handle_simple_memory_fast_path(db, user_id, raw_msg)
            if mem_fast:
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                timing_metrics["llm_used"] = False
                result = {
                    "response": mem_fast,
                    "retrieved_sources": [{"source": "long_term_memory", "mode": "fast_path"}],
                    "tools_executed": [],
                    "timing": timing_metrics
                }
                cache_service.set_semantic_response(user_id, raw_msg, result)
                logger.info(f"[PERF] route=MEMORY_FAST db=fast llm=false total={total_ms}ms")
                return result

        # FAST PATH 6: Personal Goals & Next Steps (<10ms)
        if intent == QueryIntent.GOALS:
            rec_data = goal_service.get_next_recommended_step(db, user_id)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": rec_data["recommendation"],
                "retrieved_sources": [{"source": "personal_goals", "goal": rec_data.get("goal")}],
                "tools_executed": [{"tool": "get_next_recommended_step", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=GOALS db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 7: Study Coach & Weak Spots (<15ms)
        if intent == QueryIntent.STUDY:
            subject_detected = "JavaScript" if "javascript" in lower_msg or "js" in lower_msg else ("Python" if "python" in lower_msg else "DSA")
            study_resp = study_coach_service.format_weak_spot_answer(db, user_id, subject_detected)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": study_resp,
                "retrieved_sources": [{"source": "study_coach", "subject": subject_detected}],
                "tools_executed": [{"tool": "get_weak_topics", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=STUDY db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 8: Productivity Analytics (<10ms)
        if intent == QueryIntent.ANALYTICS:
            analytics_resp = analytics_service.format_productivity_summary(db, user_id)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": analytics_resp,
                "retrieved_sources": [{"source": "productivity_analytics"}],
                "tools_executed": [{"tool": "get_aggregated_metrics", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=ANALYTICS db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 9: Daily AI Brief (<15ms)
        if intent == QueryIntent.DAILY_BRIEF:
            brief_resp = daily_brief_service.format_brief_text(db, user_id)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": brief_resp,
                "retrieved_sources": [{"source": "daily_brief"}],
                "tools_executed": [{"tool": "generate_brief", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=DAILY_BRIEF db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 10: 'What Changed?' Engine (<15ms)
        if intent == QueryIntent.WHAT_CHANGED:
            diff_resp = what_changed_engine.format_diff_response(db, user_id, raw_msg)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": diff_resp,
                "retrieved_sources": [{"source": "what_changed_engine"}],
                "tools_executed": [{"tool": "analyze_changes_since", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=WHAT_CHANGED db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 11: Timeline (Yesterday / Today Queries) (<10ms)
        if intent == QueryIntent.TIMELINE and plan.can_bypass_llm:
            from datetime import timedelta
            yesterday_str = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
            acts = timeline_service.get_activities_for_date(db, user_id, yesterday_str)
            if acts:
                act_lines = [f"• {a.activity_time or ''} {a.title}: {a.description or ''}".strip() for a in acts]
                timeline_resp = f"Aapne kal ({yesterday_str}) ye kaam kiye the:\n" + "\n".join(act_lines)
            else:
                timeline_resp = f"Aapke record ke mutabik kal ({yesterday_str}) ke liye koi specific activity log nahi thi."
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": timeline_resp,
                "retrieved_sources": [{"source": "timeline", "date": yesterday_str, "records_found": len(acts)}],
                "tools_executed": [{"tool": "get_activities_for_date", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=TIMELINE db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 12: Life Twin Current Situation (<10ms)
        if intent == QueryIntent.LIFE_TWIN:
            twin_resp = life_twin_service.format_twin_summary(db, user_id)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": twin_resp,
                "retrieved_sources": [{"source": "life_twin"}],
                "tools_executed": [{"tool": "query_life_twin_state", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=LIFE_TWIN db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 13: What-If Counterfactual Simulator (<15ms)
        if intent == QueryIntent.WHAT_IF:
            what_if_resp = what_if_simulator.format_simulation_response(db, user_id, raw_msg)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": what_if_resp,
                "retrieved_sources": [{"source": "what_if_simulator"}],
                "tools_executed": [{"tool": "run_what_if_simulation", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=WHAT_IF db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 14: Month Diff / Snapshot Comparison (<15ms)
        if intent == QueryIntent.MONTH_DIFF:
            diff_resp = life_twin_service.format_snapshot_comparison(db, user_id)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": diff_resp,
                "retrieved_sources": [{"source": "life_twin_snapshots"}],
                "tools_executed": [{"tool": "compare_snapshots", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=MONTH_DIFF db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 15: Personal Time Machine (<15ms)
        if intent == QueryIntent.TIME_MACHINE:
            tm_resp = time_machine_service.format_time_machine_response(db, user_id, raw_msg)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": tm_resp,
                "retrieved_sources": [{"source": "time_machine"}],
                "tools_executed": [{"tool": "replay_time_machine", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=TIME_MACHINE db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 16: Bottleneck Engine / 'Why Am I Stuck?' (<15ms)
        if intent == QueryIntent.BOTTLENECK:
            stuck_resp = bottleneck_engine.format_bottleneck_response(db, user_id, raw_msg)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": stuck_resp,
                "retrieved_sources": [{"source": "bottleneck_engine"}],
                "tools_executed": [{"tool": "diagnose_stuck_bottleneck", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=BOTTLENECK db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 17: Connected Knowledge Graph / Life Map (<10ms)
        if intent == QueryIntent.CONNECTED_GRAPH:
            graph_resp = knowledge_graph_service.format_connected_map(db, user_id, raw_msg)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": graph_resp,
                "retrieved_sources": [{"source": "knowledge_graph"}],
                "tools_executed": [{"tool": "query_knowledge_graph", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=CONNECTED_GRAPH db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 18: Decision Debate (<15ms)
        if intent == QueryIntent.DECISION_DEBATE:
            debate_resp = decision_debate_service.format_debate_response(db, user_id, raw_msg)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": debate_resp,
                "retrieved_sources": [{"source": "decision_debate"}],
                "tools_executed": [{"tool": "debate_decision_options", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=DECISION_DEBATE db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 19: Project Health (<15ms)
        if intent == QueryIntent.PROJECT_HEALTH:
            health_resp = project_health_service.format_project_health(db, user_id, "Life AI")
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": health_resp,
                "retrieved_sources": [{"source": "project_health"}],
                "tools_executed": [{"tool": "analyze_project_health", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=PROJECT_HEALTH db=fast llm=false total={total_ms}ms")
            return result

        # FAST PATH 20: Pattern Detector (<15ms)
        if intent == QueryIntent.PATTERN_DETECTOR:
            pattern_resp = pattern_detector_service.format_pattern_response(db, user_id)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": pattern_resp,
                "retrieved_sources": [{"source": "pattern_detector"}],
                "tools_executed": [{"tool": "detect_personal_patterns", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            logger.info(f"[PERF] route=PATTERN_DETECTOR db=fast llm=false total={total_ms}ms")
            return result

        # Step 2: Intent-based Tool Dispatch & Context Gathering
        t_tools_start = time.perf_counter()

        # Tool Check A: Reminders & Tasks
        is_reminder_intent = intent == QueryIntent.REMINDER or any(w in lower_msg for w in ["remind me", "set a reminder", "yaad dila dena", "reminder lagao", "remind"])
        is_task_intent = intent == QueryIntent.TASK or any(w in lower_msg for w in ["create a task", "add task", "todo list", "task bana do", "add a task", "new task"])
        is_task_list_intent = any(w in lower_msg for w in ["my tasks", "list tasks", "show tasks", "mere tasks", "pending tasks"])

        if is_reminder_intent:
            rem_res = tool_registry.execute_tool(
                tool_name="create_reminder",
                user_id=user_id,
                args={"title": raw_msg, "remind_at": datetime.utcnow().isoformat()},
                db=db,
                conversation_id=conversation_id
            )
            if rem_res.success:
                tools_executed.append({"tool": "create_reminder", "status": "success", "title": raw_msg})
                retrieved_sources.append({"source": "reminder_service"})
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                return {
                    "response": f"Maine aapka reminder note kar liya hai: '{raw_msg}'. Sahi waqt par aapko alert mil jayega.",
                    "retrieved_sources": retrieved_sources,
                    "tools_executed": tools_executed,
                    "timing": timing_metrics
                }

        if is_task_intent:
            task_title = raw_msg
            for prefix in ["create a task to", "create a task", "add task to", "add a task to", "add task"]:
                if lower_msg.startswith(prefix):
                    task_title = raw_msg[len(prefix):].strip(" :")
                    break
            t_res = tool_registry.execute_tool(
                tool_name="create_task",
                user_id=user_id,
                args={"title": task_title, "category": "personal", "priority": "medium"},
                db=db,
                conversation_id=conversation_id
            )
            if t_res.success:
                tools_executed.append({"tool": "create_task", "status": "success", "title": task_title})
                retrieved_sources.append({"source": "task_planner"})
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                return {
                    "response": f"Task '{task_title}' aapke planner mein successfully add kar diya gaya hai.",
                    "retrieved_sources": retrieved_sources,
                    "tools_executed": tools_executed,
                    "timing": timing_metrics
                }

        if is_task_list_intent:
            list_res = tool_registry.execute_tool(
                tool_name="list_tasks",
                user_id=user_id,
                args={"limit": 10},
                db=db,
                conversation_id=conversation_id
            )
            if list_res.success and list_res.data:
                task_items = [f"• [{t['status'].upper()}] {t['title']} ({t['priority']} priority)" for t in list_res.data]
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                return {
                    "response": "Aapke current tasks:\n" + "\n".join(task_items),
                    "retrieved_sources": [{"source": "task_planner"}],
                    "tools_executed": [{"tool": "list_tasks", "status": "success", "count": len(list_res.data)}],
                    "timing": timing_metrics
                }

        # Tool Check B: GitHub Code Repository Brain
        is_github_intent = intent == QueryIntent.GITHUB_CODE or any(w in lower_msg for w in [
            "github", "repo", "repos", "repository", "repositories", "codebase", "sql rag", "backend samjhao",
            "function", "class", "code dekho", "show code", "inspect repo", "mere project", "mera project",
            "mere projects", "mera code", "mere code"
        ])
        if is_github_intent:
            t_gh_start = time.perf_counter()
            gh_res = tool_registry.execute_tool(
                tool_name="search_github_code",
                user_id=user_id,
                args={"query": raw_msg, "top_k": 4},
                db=db,
                conversation_id=conversation_id
            )
            timing_metrics["github_ms"] = round((time.perf_counter() - t_gh_start) * 1000, 2)
            if gh_res.success and gh_res.data:
                snippets = []
                for item in gh_res.data:
                    snippets.append(f"[{item['repository']} - {item['file_path']} (lines {item['start_line']}-{item['end_line']})]:\n```{item['language']}\n{item['content']}\n```")
                context_code = "\n\n".join(snippets)
                retrieved_sources.append({"source": "github_code", "count": len(gh_res.data)})
                tools_executed.append({"tool": "search_github_code", "status": "success", "count": len(gh_res.data)})
            else:
                # 1. Try on-the-fly auto-indexing if a specific repo was mentioned
                try:
                    import asyncio
                    token = github_service.get_user_token(db, user_id)
                    if token:
                        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                            auto_indexed_repo = executor.submit(
                                asyncio.run,
                                github_service.auto_index_matching_repo_for_query(db, user_id, raw_msg)
                            ).result(timeout=10.0)
                        if auto_indexed_repo:
                            re_res = tool_registry.execute_tool(
                                tool_name="search_github_code",
                                user_id=user_id,
                                args={"query": raw_msg, "repo_name": auto_indexed_repo, "top_k": 4},
                                db=db,
                                conversation_id=conversation_id
                            )
                            if re_res.success and re_res.data:
                                snippets = []
                                for item in re_res.data:
                                    snippets.append(f"[{item['repository']} - {item['file_path']} (lines {item['start_line']}-{item['end_line']})]:\n```{item['language']}\n{item['content']}\n```")
                                context_code = "\n\n".join(snippets)
                                retrieved_sources.append({"source": "github_code", "count": len(re_res.data)})
                                tools_executed.append({"tool": "search_github_code", "status": "success", "count": len(re_res.data)})
                except Exception as ex:
                    logger.debug(f"Auto-index on the fly note: {ex}")

                # 2. If still no code snippets, provide full repository overview of user's account
                if not context_code:
                    try:
                        from app.models.connected_account import ConnectedAccount
                        token = github_service.get_user_token(db, user_id)
                        account = db.query(ConnectedAccount).filter(
                            ConnectedAccount.user_id == user_id,
                            ConnectedAccount.provider == "github"
                        ).first()
                        if token and account:
                            uname = account.account_username or "user"
                            import asyncio
                            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                                remote_repos = executor.submit(asyncio.run, github_service.list_remote_repositories(token)).result(timeout=5.0)
                            if remote_repos:
                                r_lines = [f"• **{r['name']}** ({r.get('language') or 'General'}) - {r.get('description') or 'Project repository'}" for r in remote_repos[:20]]
                                context_code = (
                                    f"=== USER GITHUB ACCOUNT CONNECTED (@{uname}) ===\n"
                                    f"The user has connected their GitHub account with {len(remote_repos)} total repositories.\n"
                                    f"Here is the list of repositories on their account:\n" + "\n".join(r_lines) + "\n\n"
                                    f"Instructions: Answer the user's question by summarizing their projects from the list above. Explain what projects they have, highlight key projects, and offer to deep dive into the code architecture, functions, or backend of any specific project!"
                                )
                                retrieved_sources.append({"source": "github_remote_repos", "count": len(remote_repos)})
                                tools_executed.append({"tool": "list_github_repos", "status": "success", "count": len(remote_repos)})
                    except Exception as ex:
                        logger.debug(f"GitHub fallback listing note: {ex}")

        # Tool Check C: Public Web Search
        is_web_intent = intent == QueryIntent.WEB_SEARCH or any(w in lower_msg for w in [
            "search the web", "search online", "internet par dekho", "google karo",
            "latest release", "current weather", "web search"
        ])
        if is_web_intent:
            web_res = tool_registry.execute_tool(
                tool_name="search_web",
                user_id=user_id,
                args={"query": raw_msg, "max_results": 4},
                db=db,
                conversation_id=conversation_id
            )
            if web_res.success and web_res.data:
                web_snippets = [f"• [{w['title']}]({w['url']}): {w['snippet']}" for w in web_res.data]
                context_memories += "\n=== PUBLIC WEB SEARCH RESULTS ===\n" + "\n".join(web_snippets)
                retrieved_sources.append({"source": "web_search", "count": len(web_res.data)})
                tools_executed.append({"tool": "search_web", "status": "success", "count": len(web_res.data)})

        # Check if research/internship query (Web Research Agent)
        is_internship_search = any(w in lower_msg for w in [
            "internship opportunities", "internships find", "internship find karo",
            "suitable for me", "internship khojo", "internship search", "opportunities find"
        ])
        if is_internship_search:
            intern_resp = web_research_agent.format_internship_response(db, user_id)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            timing_metrics["llm_used"] = False
            result = {
                "response": intern_resp,
                "retrieved_sources": [{"source": "web_search", "agent": "web_research_agent"}],
                "tools_executed": [{"tool": "research_internships", "status": "success"}],
                "timing": timing_metrics
            }
            cache_service.set_semantic_response(user_id, raw_msg, result)
            return result

        timing_metrics["tools_ms"] = round((time.perf_counter() - t_tools_start) * 1000, 2)

        # Step 3: Semantic Memory & Profile Retrieval (strictly Indian Standard Time / IST)
        from datetime import timezone as dt_tz, timedelta
        try:
            from zoneinfo import ZoneInfo
            target_tz = ZoneInfo(timezone or "Asia/Kolkata")
            now_dt = datetime.now(target_tz)
        except Exception:
            target_tz = dt_tz(timedelta(hours=5, minutes=30))
            now_dt = datetime.now(target_tz)

        current_time_str = now_dt.strftime("%A, %d %B %Y, %I:%M %p (Indian Standard Time, IST)")

        # Fetch Structured Profile
        has_personal_intent = (intent in [QueryIntent.PROFILE, QueryIntent.MEMORY, QueryIntent.TIMELINE] or any(
            w in lower_msg for w in ["my", "mera", "meri", "mere", "about me", "who am i", "my name", "my skills", "my college"]
        )) and intent not in [QueryIntent.GENERAL, QueryIntent.DOCUMENT]
        if has_personal_intent:
            t_profile_start = time.perf_counter()
            from app.services.profile_cache import profile_cache
            profile = profile_cache.get_profile_dict(db, user_id)
            if profile:
                user_profile_summary = (
                    f"Name: {profile.get('name') or profile.get('preferred_name') or 'Friend'}\n"
                    f"Skills: {', '.join(profile.get('skills', [])) if profile.get('skills') else 'None'}\n"
                    f"College/Education: {profile.get('college') or profile.get('education') or 'None'}\n"
                    f"Branch: {profile.get('branch') or 'None'}\n"
                    f"Projects: {', '.join([str(p) for p in profile.get('projects', [])]) if profile.get('projects') else 'None'}"
                )
            timing_metrics["profile_ms"] = round((time.perf_counter() - t_profile_start) * 1000, 2)

        # Determine retrieval requirements
        needs_memory = intent in [QueryIntent.MEMORY, QueryIntent.TIMELINE] or any(
            w in lower_msg for w in [
                "remember", "yaad", "dost", "friend", "bestie", "favourite", "favorite",
                "preference", "mera", "meri", "mere", "my", "who is my", "what is my",
                "where do i", "where did i", "what did i", "tell me about my"
            ]
        )
        needs_docs = intent == QueryIntent.DOCUMENT or any(
            dk in lower_msg for dk in ["document", "pdf", "file", "resume", "marksheet", "uploaded", "in my resume", "my cv"]
        )

        # PARALLEL RETRIEVAL: Execute Memory & Document search concurrently if both needed
        if needs_memory and needs_docs:
            t_par_start = time.perf_counter()
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                f_mem = executor.submit(tool_registry.execute_tool, "search_memories", user_id, {"query": raw_msg, "top_k": 4}, db, conversation_id)
                f_doc = executor.submit(tool_registry.execute_tool, "search_documents", user_id, {"query": raw_msg, "top_k": 3}, db, conversation_id)
                mem_res = f_mem.result(timeout=4.0)
                doc_res = f_doc.result(timeout=4.0)
            timing_metrics["memory_ms"] = round((time.perf_counter() - t_par_start) * 1000, 2)
            timing_metrics["document_ms"] = timing_metrics["memory_ms"]
            if mem_res.success and mem_res.data:
                mem_texts = [f"• {m['content']}" for m in mem_res.data]
                context_memories += "\n=== PERSONAL LONG-TERM MEMORY ===\n" + "\n".join(mem_texts)
                retrieved_sources.append({"source": "long_term_memory", "count": len(mem_res.data)})
                tools_executed.append({"tool": "search_memories", "status": "success", "count": len(mem_res.data)})
            if doc_res.success and doc_res.data:
                doc_texts = [f"• [Doc snippet] {d['content']}" for d in doc_res.data]
                context_docs = "\n".join(doc_texts)
                retrieved_sources.append({"source": "documents", "count": len(doc_res.data)})
                tools_executed.append({"tool": "search_documents", "status": "success", "count": len(doc_res.data)})
        else:
            if needs_memory:
                t_mem_start = time.perf_counter()
                mem_res = tool_registry.execute_tool(
                    tool_name="search_memories",
                    user_id=user_id,
                    args={"query": raw_msg, "top_k": 4},
                    db=db,
                    conversation_id=conversation_id
                )
                timing_metrics["memory_ms"] = round((time.perf_counter() - t_mem_start) * 1000, 2)
                if mem_res.success and mem_res.data:
                    mem_texts = [f"• {m['content']}" for m in mem_res.data]
                    context_memories += "\n=== PERSONAL LONG-TERM MEMORY ===\n" + "\n".join(mem_texts)
                    retrieved_sources.append({"source": "long_term_memory", "count": len(mem_res.data)})
                    tools_executed.append({"tool": "search_memories", "status": "success", "count": len(mem_res.data)})

            if needs_docs:
                t_doc_start = time.perf_counter()
                doc_res = tool_registry.execute_tool(
                    tool_name="search_documents",
                    user_id=user_id,
                    args={"query": raw_msg, "top_k": 3},
                    db=db,
                    conversation_id=conversation_id
                )
                timing_metrics["document_ms"] = round((time.perf_counter() - t_doc_start) * 1000, 2)
                if doc_res.success and doc_res.data:
                    doc_texts = [f"• [Doc snippet] {d['content']}" for d in doc_res.data]
                    context_docs = "\n".join(doc_texts)
                    retrieved_sources.append({"source": "documents", "count": len(doc_res.data)})
                    tools_executed.append({"tool": "search_documents", "status": "success", "count": len(doc_res.data)})

        # Step 4: Add rolling conversation summary if available
        summary_text = ""
        if conversation_id:
            summary = conversation_service.get_or_create_summary(db, conversation_id, user_id=user_id, max_messages_trigger=15)
            if summary and summary.summary_text:
                summary_text = summary.summary_text
                context_memories += f"\n=== CONVERSATION SESSION SUMMARY ===\n{summary_text}"

        # Combine code context with document context
        if context_code:
            context_docs += "\n\n=== RELEVANT GITHUB CODE SNIPPETS ===\n" + context_code

        # Step 5: Smart Context Manager (Budgeting & Relevance Gating)
        budgeted = context_manager.filter_and_budget(
            intent=intent,
            context_docs=context_docs,
            context_memories=context_memories,
            context_code="",
            user_profile_summary=user_profile_summary,
            chat_history=chat_history,
            summary_text=summary_text
        )

        # Step 6: Grounded Answer Synthesis with Model Selection
        t_llm_start = time.perf_counter()
        timing_metrics["llm_used"] = True
        provider = model_router.get_provider(tier=plan.suggested_model)
        timing_metrics["provider"] = "ollama" if provider.__class__.__name__ == "OllamaProvider" else "gemini"

        final_answer = llm_service.generate_chat_response(
            user_message=raw_msg,
            chat_history=budgeted["chat_history"],
            context_docs=budgeted["context_docs"],
            context_memories=budgeted["context_memories"],
            user_profile_summary=budgeted["user_profile_summary"],
            current_time_str=current_time_str
        )
        timing_metrics["llm_ms"] = round((time.perf_counter() - t_llm_start) * 1000, 2)

        total_ms = round((time.perf_counter() - t0) * 1000, 2)
        timing_metrics["total_ms"] = total_ms

        logger.info(
            f"[PERF] route={intent.value} total={total_ms}ms router={timing_metrics['router_ms']}ms "
            f"tools={timing_metrics['tools_ms']}ms mem={timing_metrics['memory_ms']}ms "
            f"llm={timing_metrics['llm_ms']}ms provider={timing_metrics['provider']}"
        )

        return {
            "response": final_answer,
            "retrieved_sources": retrieved_sources,
            "tools_executed": tools_executed,
            "timing": timing_metrics
        }

    def process_request_stream(
        self,
        db: Session,
        user_id: str,
        user_message: str,
        chat_history: List[Dict[str, str]],
        conversation_id: Optional[str] = None,
        timezone: str = "Asia/Kolkata"
    ) -> Generator[str, None, None]:
        """
        Server-Sent Events (SSE) partial response streamer:
        Yields JSON-formatted events:
        - "meta": { route, timing, sources, tools }
        - "token": { text }
        - "done": { total_ms, full_text }
        """
        # Execute routing and context gathering
        plan = query_router.plan_route(user_message)
        
        # If fast path can bypass LLM, yield metadata and instant answer
        if plan.can_bypass_llm:
            fast_res = self.process_request(db, user_id, user_message, chat_history, conversation_id, timezone)
            yield f"data: {json.dumps({'type': 'meta', 'route': plan.intent.value, 'timing': fast_res['timing'], 'sources': fast_res['retrieved_sources']})}\n\n"
            yield f"data: {json.dumps({'type': 'token', 'text': fast_res['response']})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'total_ms': fast_res['timing']['total_ms'], 'full_text': fast_res['response']})}\n\n"
            return

        # Otherwise, yield metadata first
        t0 = time.time()
        yield f"data: {json.dumps({'type': 'meta', 'route': plan.intent.value, 'model_tier': plan.suggested_model})}\n\n"

        # Gather context
        non_stream_res = self.process_request(db, user_id, user_message, chat_history, conversation_id, timezone)
        full_text = non_stream_res["response"]
        
        # Stream out words in natural chunks
        words = full_text.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield f"data: {json.dumps({'type': 'token', 'text': chunk})}\n\n"
            time.sleep(0.015)  # smooth natural token delivery cadence

        total_ms = round((time.time() - t0) * 1000, 2)
        yield f"data: {json.dumps({'type': 'done', 'total_ms': total_ms, 'full_text': full_text})}\n\n"

agent_orchestrator = AgentOrchestrator()
