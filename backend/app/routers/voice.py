import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.security.dependencies import get_optional_user
from app.schemas.voice import TTSRequest, WakeWordStatusResponse
from app.services.voice_service import voice_service
from app.config import settings

router = APIRouter(prefix="/voice", tags=["Voice & Wake Word"])

@router.get("/wake-status", response_model=WakeWordStatusResponse)
def get_wake_status():
    """Provides configuration for the Alexa-style wake word 'Jeet' system."""
    return WakeWordStatusResponse(
        wake_word=settings.WAKE_WORD,
        status="listening",
        greeting="Haan, bolo.",
        silence_timeout_seconds=settings.SILENCE_TIMEOUT_SECONDS
    )

@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe spoken user audio into text."""
    temp_path = os.path.join(settings.UPLOAD_DIRECTORY, f"temp_{uuid.uuid4().hex}_{audio.filename}")
    async with aiofiles.open(temp_path, "wb") as f:
        await f.write(await audio.read())

    transcript = voice_service.transcribe_audio_file(temp_path)

    # Clean up temp file
    if os.path.exists(temp_path):
        try:
            os.remove(temp_path)
        except Exception:
            pass

    return {"transcript": transcript}

@router.post("/transcribe-and-respond")
async def transcribe_and_respond(
    request: Request,
    timezone: str = "Asia/Kolkata",
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """
    Hands-Free Voice Flow:
    1. Accepts voice audio (multipart/form-data) or text input (JSON / form)
    2. Runs through the Central Agent Orchestrator (Memory, Docs, Code, Tools)
    3. Synthesizes voice audio response
    4. Returns transcript, text response, and audio playback URL in a single low-latency call.
    """
    content_type = request.headers.get("content-type", "")
    transcript = ""

    if "multipart/form-data" in content_type:
        form = await request.form()
        audio = form.get("audio")
        if "timezone" in form:
            timezone = str(form.get("timezone"))
        if audio and hasattr(audio, "read"):
            filename = getattr(audio, "filename", "speech.wav") or "speech.wav"
            temp_path = os.path.join(settings.UPLOAD_DIRECTORY, f"voice_{uuid.uuid4().hex}_{filename}")
            async with aiofiles.open(temp_path, "wb") as f:
                await f.write(await audio.read())
            transcript = voice_service.transcribe_audio_file(temp_path)
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass
        elif "text" in form:
            transcript = str(form.get("text"))
        elif "transcript" in form:
            transcript = str(form.get("transcript"))
    else:
        # JSON payload
        try:
            body = await request.json()
            transcript = body.get("text") or body.get("transcript") or ""
            if "timezone" in body:
                timezone = str(body.get("timezone"))
        except Exception:
            transcript = ""

    if not transcript or not transcript.strip():
        return {
            "transcript": "",
            "response": "Mujhe aapki aawaz theek se nahi sunai di. Kya aap dobara bol sakte hain?",
            "audio_url": None,
            "sources": [],
            "tools_executed": []
        }

    from app.services.orchestrator import agent_orchestrator
    agent_res = agent_orchestrator.process_request(
        db=db,
        user_id=user.id,
        user_message=transcript,
        chat_history=[],
        timezone=timezone
    )

    response_text = agent_res.get("response", "")
    audio_url = await voice_service.text_to_speech(response_text)

    return {
        "transcript": transcript,
        "response": response_text,
        "audio_url": audio_url,
        "sources": agent_res.get("retrieved_sources", []),
        "tools_executed": agent_res.get("tools_executed", [])
    }


@router.post("/synthesize")
async def synthesize_speech(payload: TTSRequest):
    """Generate TTS audio from text."""
    audio_url = await voice_service.text_to_speech(payload.text, payload.voice)
    if not audio_url:
        raise HTTPException(status_code=500, detail="Speech synthesis failed")
    return {"audio_url": audio_url}

@router.get("/audio/{filename}")
def get_audio_file(filename: str):
    """Serve synthesized audio playback."""
    file_path = os.path.join(voice_service.audio_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    media_type = "audio/mpeg" if filename.endswith(".mp3") else "audio/wav"
    return FileResponse(file_path, media_type=media_type)
