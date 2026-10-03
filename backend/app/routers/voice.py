import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
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
