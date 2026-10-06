import logging
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status
from app.services.llm_service import llm_service
from app.security.dependencies import get_optional_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vision", tags=["AI Vision"])

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp"
}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB

@router.post("/analyze")
async def analyze_image_endpoint(
    image: UploadFile = File(...),
    question: str = Form("Analyze this image and explain what is visible in detail."),
    conversation_id: Optional[str] = Form(None),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Multimodal Visual Intelligence Endpoint:
    Processes user-uploaded images (gallery, file picker, drag & drop) with Gemini Vision.
    Solves mathematical equations step-by-step, transcribes text, explains diagrams, and identifies objects.
    """
    # 1. Validate MIME type
    content_type = (image.content_type or "").lower()
    if content_type not in ALLOWED_MIME_TYPES:
        # Check filename extension fallback
        filename = (image.filename or "").lower()
        if filename.endswith((".jpg", ".jpeg")):
            content_type = "image/jpeg"
        elif filename.endswith(".png"):
            content_type = "image/png"
        elif filename.endswith(".webp"):
            content_type = "image/webp"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image type '{content_type}'. Please upload JPG, PNG, or WEBP."
            )

    # 2. Read and validate size
    try:
        image_bytes = await image.read()
    except Exception as e:
        logger.error(f"Failed to read image stream: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to read uploaded image.")

    if len(image_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded image is empty.")

    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image size exceeds 15MB limit ({len(image_bytes) // (1024*1024)}MB)."
        )

    clean_question = (question or "What is in this image?").strip()
    logger.info(f"Analyzing vision request: mime={content_type}, bytes={len(image_bytes)}, q='{clean_question[:50]}'")

    # 3. Analyze with Gemini Multimodal Vision
    result = llm_service.analyze_vision(
        image_bytes=image_bytes,
        mime_type=content_type,
        question=clean_question
    )

    if conversation_id:
        result["conversation_id"] = conversation_id

    return result
