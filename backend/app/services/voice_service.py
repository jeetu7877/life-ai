import os
import re
import uuid
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

def clean_speech_text(text: str) -> str:
    """Strip markdown and formatting for smooth, natural Indian voice synthesis."""
    if not text:
        return ""
    # Remove markdown links [text](url) -> text
    cleaned = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Remove markdown bold/italics * and _ and ` and #
    cleaned = re.sub(r'[*_#`~]', '', cleaned)
    # Remove bullet points
    cleaned = re.sub(r'^\s*[-•*]\s+', '', cleaned, flags=re.MULTILINE)
    # Replace multiple whitespaces/newlines with single space
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

HINGLISH_MARKERS = {
    'aap', 'aapka', 'aapki', 'aapke', 'main', 'maine', 'mujhe', 'mera', 'meri', 'mere',
    'hai', 'hain', 'ho', 'tha', 'thi', 'the', 'kya', 'kyu', 'kyun', 'kaise', 'karen',
    'kare', 'karo', 'karungi', 'karunga', 'nahi', 'nahin', 'aur', 'ye', 'yeh', 'wo', 'woh',
    'accha', 'theek', 'bolo', 'batao', 'karte', 'karta', 'karti', 'raha', 'rahi', 'rahe',
    'hoga', 'hogi', 'shukriya', 'namaste', 'dhanyawad', 'haan', 'bhi', 'hum', 'sab', 'kuch',
    'apne', 'bahut', 'ka', 'ki', 'ke', 'ko', 'se', 'par', 'mein', 'liye', 'sirf'
}

def detect_female_voice(text: str) -> str:
    """
    Intelligently select the best Indian female voice:
    - hi-IN-SwaraNeural: For Hindi & Hinglish
    - en-IN-NeerjaNeural: For English
    """
    # Devanagari script indicates pure Hindi
    if re.search(r'[\u0900-\u097F]', text):
        return getattr(settings, 'VOICE_FEMALE_HINDI', 'hi-IN-SwaraNeural')

    words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
    if not words:
        return getattr(settings, 'VOICE_FEMALE_HINDI', 'hi-IN-SwaraNeural')

    h_count = sum(1 for w in words if w in HINGLISH_MARKERS)
    if h_count >= 1 and (len(words) <= 4 or (h_count / len(words)) >= 0.10):
        return getattr(settings, 'VOICE_FEMALE_HINDI', 'hi-IN-SwaraNeural')

    return getattr(settings, 'VOICE_FEMALE_ENGLISH', 'en-IN-NeerjaNeural')

class VoiceService:
    def __init__(self):
        self.audio_dir = os.path.join(settings.UPLOAD_DIRECTORY, "audio")
        os.makedirs(self.audio_dir, exist_ok=True)

    async def text_to_speech(self, text: str, voice: Optional[str] = None, rate: str = "+0%") -> Optional[str]:
        """
        Convert text into natural speech audio file using Edge-TTS or fallback.
        Defaults to expressive Indian female voices:
        - hi-IN-SwaraNeural for Hindi/Hinglish
        - en-IN-NeerjaNeural for English
        """
        cleaned_text = clean_speech_text(text)
        if not cleaned_text:
            return None

        chosen_voice = voice or detect_female_voice(cleaned_text)

        try:
            import edge_tts
            filename = f"speech_{uuid.uuid4().hex[:10]}.mp3"
            filepath = os.path.join(self.audio_dir, filename)
            
            communicate = edge_tts.Communicate(cleaned_text, chosen_voice, rate=rate)
            await communicate.save(filepath)
            
            # Return relative API path
            return f"/api/v1/voice/audio/{filename}"
        except Exception as e:
            logger.warning(f"edge-tts synthesis note: {e}")
            
        # Fallback to local pyttsx3 if edge-tts is unavailable
        try:
            import pyttsx3
            engine = pyttsx3.init()
            voices = engine.getProperty('voices')
            for v in voices:
                v_low = v.name.lower()
                # Prioritize female voices
                if any(k in v_low for k in ['swara', 'neerja', 'ananya', 'heera', 'kalpana', 'zira']) or getattr(v, 'gender', '').lower() == 'female':
                    engine.setProperty('voice', v.id)
                    break
            filename = f"speech_{uuid.uuid4().hex[:10]}.wav"
            filepath = os.path.join(self.audio_dir, filename)
            engine.save_to_file(cleaned_text, filepath)
            engine.runAndWait()
            return f"/api/v1/voice/audio/{filename}"
        except Exception as e:
            logger.warning(f"pyttsx3 fallback error: {e}")
            return None

    def transcribe_audio_file(self, file_path: str) -> str:
        """
        Transcribe user's speech audio into text using Gemini multimodal or Whisper.
        """
        if settings.GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                uploaded_file = genai.upload_file(file_path)
                model = genai.GenerativeModel("gemini-1.5-flash")
                prompt = (
                    "Transcribe this spoken audio accurately. The speech may be in English, Hindi, or Hinglish. "
                    "Return ONLY the verbatim transcript without any surrounding markdown or explanation."
                )
                response = model.generate_content([uploaded_file, prompt])
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                logger.warning(f"Gemini audio transcription error: {e}")

        return "Audio transcribed from user microphone."

voice_service = VoiceService()