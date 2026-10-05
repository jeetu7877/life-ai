FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for audio, PDF, OCR, and PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    espeak \
    tesseract-ocr \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies from backend/requirements.txt
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY backend/ .

# Ensure storage directories exist
RUN mkdir -p uploads/audio chroma_db

# Expose default port
EXPOSE 8000

# Start FastAPI application using dynamic Render PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
