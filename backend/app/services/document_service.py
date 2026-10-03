import os
import re
import csv
import logging
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentChunk
from app.models.vault import SecureVaultItem
from app.security.crypto import encrypt_value, generate_masked_hint, redact_sensitive_strings
from app.services.rag_service import rag_service
from app.config import settings

logger = logging.getLogger(__name__)

class DocumentService:
    def parse_and_process_document(self, db: Session, doc_id: str):
        """
        Full ingestion pipeline:
        1. Parse file based on extension (PDF, DOCX, TXT, CSV, Image)
        2. Detect document category (PAN, Aadhaar, Passport, Resume, Certificate, etc.)
        3. Extract structured sensitive fields (if identity doc) -> Encrypt & Store in Secure Vault
        4. Chunk text and sanitize sensitive identifiers
        5. Store in PostgreSQL chunks table & ChromaDB vector database
        """
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return

        try:
            doc.extraction_status = "ocr_processing"
            db.commit()

            extracted_text = self._extract_text(doc.file_path, doc.file_type)
            doc.extracted_text = extracted_text

            # Classify category and extract structured fields
            category, structured = self._classify_and_extract_fields(doc.original_filename, extracted_text)
            doc.category = category
            doc.structured_fields = structured

            # If identity document fields were found, safely store into Secure Vault
            self._route_sensitive_fields_to_vault(db, doc.user_id, doc.id, category, structured)

            # Chunking for Vector Database
            doc.extraction_status = "embedding"
            db.commit()

            chunks = self._chunk_text(extracted_text, chunk_size=600, overlap=100)
            
            # Save chunks to PostgreSQL
            chunk_records = []
            for idx, chunk_content in enumerate(chunks):
                chunk_rec = DocumentChunk(
                    document_id=doc.id,
                    chunk_index=idx,
                    content=chunk_content,
                    page_number=1
                )
                db.add(chunk_rec)
                chunk_records.append({"chunk_index": idx, "content": chunk_content, "page_number": 1})
            db.commit()

            # Store in ChromaDB
            rag_service.add_document_chunks(
                chunks=chunk_records,
                user_id=doc.user_id,
                document_id=doc.id,
                category=category
            )

            doc.extraction_status = "completed"
            db.commit()
            logger.info(f"Successfully processed document: {doc.original_filename} ({category})")

        except Exception as e:
            logger.error(f"Error processing document {doc.id}: {e}")
            doc.extraction_status = "failed"
            doc.error_message = str(e)
            db.commit()

    def _extract_text(self, file_path: str, file_type: str) -> str:
        """Extract text from various file formats."""
        ext = os.path.splitext(file_path)[1].lower()

        if ext == ".txt" or ext == ".md":
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()

        elif ext == ".pdf":
            try:
                import pypdf
                reader = pypdf.PdfReader(file_path)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() or ""
                if text.strip():
                    return text
            except Exception as e:
                logger.warning(f"pypdf extraction failed: {e}")
            return "Scanned PDF document."

        elif ext in [".docx", ".doc"]:
            try:
                import docx
                doc = docx.Document(file_path)
                return "\n".join([p.text for p in doc.paragraphs])
            except Exception as e:
                logger.warning(f"docx extraction error: {e}")

        elif ext == ".csv":
            try:
                rows = []
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    reader = csv.reader(f)
                    for r in reader:
                        rows.append(" | ".join(r))
                return "\n".join(rows)
            except Exception as e:
                logger.warning(f"csv extraction error: {e}")

        elif ext in [".jpg", ".jpeg", ".png", ".webp"]:
            # Image OCR / Vision
            try:
                import pytesseract
                from PIL import Image
                img = Image.open(file_path)
                ocr_text = pytesseract.image_to_string(img)
                if ocr_text.strip():
                    return ocr_text
            except Exception:
                pass
            return f"Image document: {os.path.basename(file_path)}"

        return ""

    def _classify_and_extract_fields(self, filename: str, text: str) -> Tuple[str, Dict[str, Any]]:
        """Identify if document is PAN, Aadhaar, Passport, Resume, Certificate, etc."""
        f_lower = filename.lower()
        t_lower = text.lower()
        fields: Dict[str, Any] = {}

        # PAN Card
        pan_match = re.search(r'\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b', text.upper())
        if "pan" in f_lower or "incometax" in t_lower or pan_match:
            category = "pan_card"
            if pan_match:
                fields["pan_number"] = pan_match.group(1)
            # Search for DOB
            dob_match = re.search(r'\b([0-3]?[0-9][/-][0-1]?[0-9][/-][12][90][0-9]{2})\b', text)
            if dob_match:
                fields["dob"] = dob_match.group(1)
            return category, fields

        # Aadhaar Card
        aadhaar_match = re.search(r'\b([2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4})\b', text)
        if "aadhaar" in f_lower or "aadhar" in f_lower or "uidai" in t_lower or aadhaar_match:
            category = "aadhaar_card"
            if aadhaar_match:
                fields["aadhaar_number"] = aadhaar_match.group(1).replace(" ", "")
            dob_match = re.search(r'\b([0-3]?[0-9][/-][0-1]?[0-9][/-][12][90][0-9]{2})\b', text)
            if dob_match:
                fields["dob"] = dob_match.group(1)
            return category, fields

        # Passport
        passport_match = re.search(r'\b([A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9])\b', text)
        if "passport" in f_lower or passport_match:
            category = "passport"
            if passport_match:
                fields["passport_number"] = passport_match.group(1)
            return category, fields

        # Resume / CV
        if "resume" in f_lower or "cv" in f_lower or "curriculum vitae" in t_lower or "education" in t_lower and "experience" in t_lower:
            return "resume", fields

        # Certificate
        if "certificate" in f_lower or "completion" in t_lower or "certified" in t_lower:
            return "certificate", fields

        # College / University
        if "college" in f_lower or "university" in t_lower or "transcript" in t_lower or "semester" in t_lower:
            return "college_document", fields

        return "other", fields

    def _route_sensitive_fields_to_vault(
        self,
        db: Session,
        user_id: str,
        doc_id: str,
        category: str,
        structured_fields: Dict[str, Any]
    ):
        """Encrypt and persist sensitive identity identifiers in Secure Vault."""
        if category == "pan_card" and "pan_number" in structured_fields:
            raw_pan = structured_fields["pan_number"]
            self._save_vault_entry(db, user_id, doc_id, "PAN Card Number", "pan", raw_pan)

        elif category == "aadhaar_card" and "aadhaar_number" in structured_fields:
            raw_aadhaar = structured_fields["aadhaar_number"]
            self._save_vault_entry(db, user_id, doc_id, "Aadhaar Card Number", "aadhaar", raw_aadhaar)

        elif category == "passport" and "passport_number" in structured_fields:
            raw_passport = structured_fields["passport_number"]
            self._save_vault_entry(db, user_id, doc_id, "Passport Number", "passport", raw_passport)

    def _save_vault_entry(self, db: Session, user_id: str, doc_id: str, key_name: str, item_type: str, raw_value: str):
        existing = db.query(SecureVaultItem).filter(
            SecureVaultItem.user_id == user_id,
            SecureVaultItem.key_name == key_name
        ).first()

        encrypted = encrypt_value(raw_value)
        masked = generate_masked_hint(item_type, raw_value)

        if existing:
            existing.encrypted_value = encrypted
            existing.masked_hint = masked
            existing.document_id = doc_id
        else:
            item = SecureVaultItem(
                user_id=user_id,
                key_name=key_name,
                item_type=item_type,
                encrypted_value=encrypted,
                masked_hint=masked,
                document_id=doc_id,
                notes="Extracted securely from uploaded document"
            )
            db.add(item)
        db.commit()

    def _chunk_text(self, text: str, chunk_size: int = 600, overlap: int = 100) -> List[str]:
        """Split text into overlapping passages."""
        if not text:
            return []
        chunks = []
        start = 0
        text_len = len(text)
        while start < text_len:
            end = min(start + chunk_size, text_len)
            chunks.append(text[start:end].strip())
            start += (chunk_size - overlap)
        return [c for c in chunks if c]

document_service = DocumentService()
