from pydantic import BaseModel
from typing import Optional

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None  # Auto-selects female Indian voice (hi-IN-SwaraNeural or en-IN-NeerjaNeural)
    rate: Optional[str] = "+0%"

class WakeWordStatusResponse(BaseModel):
    wake_word: str = "Life"
    status: str = "listening"
    greeting: str = "Haan, bolo."
    silence_timeout_seconds: int = 7
