import os
import re
import csv
import json
import hashlib
import logging
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentChunk
from app.models.vault import SecureVaultItem
from app.security.crypto import encrypt_value, generate_masked_hint, redact_sensitive_strings
from app.services.rag_service import rag_service
from app.services.embedding_service import embedding_service
from app.services.llm_service import get_gemini_client, CANDIDATE_MODELS
from app.config import settings

logger = logging.getLogger("life.document")

class DocumentService:
    """
    Production-Grade Document Intelligence System:
    - Ingests PDFs, DOCX, TXT, CSV, Images with Multi-tier OCR & Vision.
    - Deep Structured Field Extraction (College IDs, Marksheets, Resumes, Identity docs, Certificates).
    - Table Extraction for Marksheets / Transcripts (Subject & Marks breakdown).
    - Sub-millisecond Direct Field-Level Search before vector retrieval.
    - Duplicate detection via SHA-256 content hashing.
    - Full PostgreSQL canonical persistence with derived ChromaDB vector indexing.
    """

    def compute_file_hash(self, file_content: bytes) -> str:
        """Compute SHA-256 hash for document content to detect duplicates and re-uploads."""
        return hashlib.sha256(file_content).hexdigest()

    def parse_and_process_document(self, db: Session, doc_id: str):
        """
        Full ingestion pipeline:
        1. Validate & extract text / OCR / Vision across pages
        2. Detect document category (College ID, Marksheet, Resume, Certificate, PAN, etc.)
        3. Extract structured fields (Roll Number, Enrollment, Branch, CGPA, Subject Marks table, etc.)
        4. Store structured fields and canonical full text in PostgreSQL
        5. Semantic chunking with page number preservation
        6. Compute persistent vector embeddings in PostgreSQL & upsert to ChromaDB
        """
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return

        try:
            logger.info(f"[DOC_UPLOAD] user_id={doc.user_id} filename={doc.original_filename} size={doc.file_size} file_type={doc.file_type}")
            doc.extraction_status = "ocr_processing"
            db.commit()

            # Step 1: Text extraction & page-level mapping
            extracted_text, page_map = self._extract_text_and_pages(doc.file_path, doc.file_type)
            doc.extracted_text = extracted_text

            # Step 2: Classify category and extract structured fields
            category, structured = self._classify_and_extract_fields(doc.original_filename, extracted_text)
            doc.category = category
            doc.structured_fields = structured

            # Step 3: Route identity documents to Secure Vault
            self._route_sensitive_fields_to_vault(db, doc.user_id, doc.id, category, structured)

            # Step 4: Chunking and PostgreSQL persistence
            doc.extraction_status = "embedding"
            db.commit()

            # Clean any old chunks for this document if re-processing / updating
            db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()
            rag_service.delete_document(doc.id)
            db.commit()

            chunks = self._chunk_document(extracted_text, page_map, chunk_size=600, overlap=100)
            
            chunk_records = []
            for idx, c_info in enumerate(chunks):
                content = c_info["content"]
                p_num = c_info.get("page_number", 1)
                
                # Compute persistent vector embedding
                emb = embedding_service.get_embedding(content)
                
                chunk_rec = DocumentChunk(
                    document_id=doc.id,
                    user_id=doc.user_id,
                    chunk_index=idx,
                    content=content,
                    page_number=p_num,
                    embedding=emb
                )
                db.add(chunk_rec)
                chunk_records.append({
                    "chunk_index": idx,
                    "content": content,
                    "page_number": p_num
                })
            db.commit()
            logger.info(f"[DOC_DB_SAVE] id={doc.id} chunks_saved={len(chunks)} status=completed")

            # Step 5: ChromaDB derived index update
            rag_service.add_document_chunks(
                chunks=chunk_records,
                user_id=doc.user_id,
                document_id=doc.id,
                category=category
            )
            logger.info(f"[DOC_VECTOR_INDEX] id={doc.id} collection=personal_documents chunk_count={len(chunks)}")

            doc.extraction_status = "completed"
            db.commit()
            logger.info(f"Successfully processed document: {doc.original_filename} ({category}) with {len(structured)} fields.")

        except Exception as e:
            logger.error(f"Error processing document {doc.id}: {e}")
            doc.extraction_status = "failed"
            doc.error_message = str(e)
            db.commit()

    def _extract_text_and_pages(self, file_path: str, file_type: str) -> Tuple[str, Dict[int, str]]:
        """
        Extract text page-by-page from various file formats.
        Supports: PDF, DOCX (paragraphs + tables), CSV (markdown tables), TXT/MD, Images (OCR & Vision).
        """
        ext = os.path.splitext(file_path)[1].lower()
        page_map: Dict[int, str] = {}
        full_text = ""

        # 1. Plain Text / Markdown
        if ext in [".txt", ".md", ".json"]:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    full_text = f.read()
                page_map[1] = full_text
                logger.info(f"[DOC_PARSE] id={os.path.basename(file_path)} pages=1 char_count={len(full_text)} parser=plain_text")
                return full_text, page_map
            except Exception as e:
                logger.warning(f"Plain text reading error: {e}")

        # 2. PDF Documents
        elif ext == ".pdf":
            try:
                import pypdf
                reader = pypdf.PdfReader(file_path)
                page_texts = []
                for idx, page in enumerate(reader.pages):
                    p_text = page.extract_text() or ""
                    page_map[idx + 1] = p_text
                    if p_text.strip():
                        page_texts.append(f"--- Page {idx + 1} ---\n{p_text.strip()}")
                
                full_text = "\n\n".join(page_texts)
                # If PDF has selectable text
                if len(full_text.strip()) > 30:
                    logger.info(f"[DOC_PARSE] id={os.path.basename(file_path)} pages={len(reader.pages)} char_count={len(full_text)} parser=pypdf")
                    return full_text, page_map
                else:
                    logger.info(f"PDF {file_path} contains minimal selectable text; triggering Vision/OCR tier.")
            except Exception as e:
                logger.warning(f"pypdf extraction error: {e}")

            # Scanned PDF fallback via Gemini Multimodal Vision
            vision_text = self._ocr_with_gemini_vision(file_path, mime_type="application/pdf")
            if vision_text:
                page_map[1] = vision_text
                logger.info(f"[DOC_OCR] id={os.path.basename(file_path)} engine=gemini_vision char_count={len(vision_text)}")
                return vision_text, page_map

            return "Scanned PDF document.", {1: "Scanned PDF document."}

        # 3. Microsoft Word (DOCX / DOC)
        elif ext in [".docx", ".doc"]:
            try:
                import docx
                doc = docx.Document(file_path)
                parts = []
                # Extract paragraphs
                for p in doc.paragraphs:
                    if p.text.strip():
                        parts.append(p.text.strip())
                # Extract tables
                for table in doc.tables:
                    table_rows = []
                    for row in table.rows:
                        row_vals = [cell.text.strip() for cell in row.cells]
                        table_rows.append(" | ".join(row_vals))
                    if table_rows:
                        parts.append("\n" + "\n".join(table_rows) + "\n")
                
                full_text = "\n".join(parts)
                page_map[1] = full_text
                logger.info(f"[DOC_PARSE] id={os.path.basename(file_path)} pages=1 char_count={len(full_text)} parser=python_docx")
                return full_text, page_map
            except Exception as e:
                logger.warning(f"DOCX extraction error: {e}")

        # 4. CSV Documents (formatted as markdown table)
        elif ext == ".csv":
            try:
                rows = []
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    reader = csv.reader(f)
                    for r in reader:
                        rows.append(" | ".join(r))
                full_text = "\n".join(rows)
                page_map[1] = full_text
                logger.info(f"[DOC_PARSE] id={os.path.basename(file_path)} pages=1 char_count={len(full_text)} parser=csv")
                return full_text, page_map
            except Exception as e:
                logger.warning(f"CSV extraction error: {e}")

        # 5. Image Documents (JPG, PNG, WEBP)
        elif ext in [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"]:
            # Tier 1: Local OCR via pytesseract
            try:
                import pytesseract
                from PIL import Image
                img = Image.open(file_path)
                ocr_text = pytesseract.image_to_string(img)
                if ocr_text and len(ocr_text.strip()) > 15:
                    logger.info(f"[DOC_OCR] id={os.path.basename(file_path)} engine=pytesseract char_count={len(ocr_text)}")
                    page_map[1] = ocr_text.strip()
                    return ocr_text.strip(), page_map
            except Exception as ex:
                logger.debug(f"Pytesseract note: {ex}")

            # Tier 2: Gemini Multimodal Vision OCR
            mime = "image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png"
            vision_text = self._ocr_with_gemini_vision(file_path, mime_type=mime)
            if vision_text:
                logger.info(f"[DOC_OCR] id={os.path.basename(file_path)} engine=gemini_vision char_count={len(vision_text)}")
                page_map[1] = vision_text
                return vision_text, page_map

            return f"Image document: {os.path.basename(file_path)}", {1: f"Image document: {os.path.basename(file_path)}"}

        return "", {1: ""}

    def _ocr_with_gemini_vision(self, file_path: str, mime_type: str = "image/jpeg") -> Optional[str]:
        """High-accuracy multimodal OCR extraction using Google Gemini Vision."""
        genai = get_gemini_client()
        if not genai:
            return None

        prompt = (
            "You are an expert document OCR engine. Perform complete and exact OCR on this document.\n"
            "Extract all text, labels, field names, student ID numbers, roll numbers, names, dates, "
            "and all tabular information (such as subjects, marks, grades, SGPA/CGPA).\n"
            "Preserve layout and structure accurately without summarizing or omitting any details."
        )

        for candidate in CANDIDATE_MODELS:
            try:
                model = genai.GenerativeModel(model_name=candidate)
                with open(file_path, "rb") as f:
                    file_bytes = f.read()

                cookie_part = {"mime_type": mime_type, "data": file_bytes}
                res = model.generate_content([cookie_part, prompt])
                if res and res.text and len(res.text.strip()) > 10:
                    return res.text.strip()
            except Exception as e:
                logger.warning(f"Gemini vision OCR note with {candidate}: {e}")
                continue
        return None

    def _classify_and_extract_fields(self, filename: str, text: str) -> Tuple[str, Dict[str, Any]]:
        """
        Classifies document and extracts structured fields at granular field-level detail.
        Extracts: roll_number, enrollment_number, student_name, college, branch, course,
        semester, cgpa, sgpa, subjects & marks breakdown, dob, phone, email, etc.
        """
        f_lower = filename.lower()
        t_lower = text.lower()
        fields: Dict[str, Any] = {}

        # ----------------- 1. Identity & Sensitive Docs -----------------
        # PAN Card
        pan_match = re.search(r'\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b', text.upper())
        if "pan" in f_lower or "incometax" in t_lower or pan_match:
            category = "pan_card"
            if pan_match:
                fields["pan_number"] = pan_match.group(1)
            dob_m = re.search(r'\b([0-3]?[0-9][/-][0-1]?[0-9][/-][12][90][0-9]{2})\b', text)
            if dob_m:
                fields["dob"] = dob_m.group(1)
            self._extract_common_identity_fields(text, fields)
            logger.info(f"[DOC_CLASSIFY] category={category}")
            logger.info(f"[DOC_STRUCTURED_EXTRACT] field_count={len(fields)} fields_found={list(fields.keys())}")
            return category, fields

        # Aadhaar Card
        aadhaar_match = re.search(r'\b([2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4})\b', text)
        if "aadhaar" in f_lower or "aadhar" in f_lower or "uidai" in t_lower or aadhaar_match:
            category = "aadhaar_card"
            if aadhaar_match:
                fields["aadhaar_number"] = aadhaar_match.group(1).replace(" ", "")
            dob_m = re.search(r'\b([0-3]?[0-9][/-][0-1]?[0-9][/-][12][90][0-9]{2})\b', text)
            if dob_m:
                fields["dob"] = dob_m.group(1)
            self._extract_common_identity_fields(text, fields)
            logger.info(f"[DOC_CLASSIFY] category={category}")
            logger.info(f"[DOC_STRUCTURED_EXTRACT] field_count={len(fields)} fields_found={list(fields.keys())}")
            return category, fields

        # Passport
        passport_match = re.search(r'\b([A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9])\b', text)
        if "passport" in f_lower or passport_match:
            category = "passport"
            if passport_match:
                fields["passport_number"] = passport_match.group(1)
            self._extract_common_identity_fields(text, fields)
            logger.info(f"[DOC_CLASSIFY] category={category}")
            logger.info(f"[DOC_STRUCTURED_EXTRACT] field_count={len(fields)} fields_found={list(fields.keys())}")
            return category, fields

        # ----------------- 2. Academic: College ID -----------------
        is_id_card = any(k in f_lower for k in ["id", "identity", "card", "college_id", "studentid"]) or \
                     any(k in t_lower for k in ["identity card", "student id", "student card", "college id", "valid upto", "id no"])

        # ----------------- 3. Academic: Marksheet / Transcript -----------------
        is_marksheet = any(k in f_lower for k in ["marksheet", "transcript", "grade", "result", "grade_card", "dmc"]) or \
                       ("semester" in t_lower and any(k in t_lower for k in ["marks", "sgpa", "cgpa", "credits", "grade point"]))

        # ----------------- 4. Professional: Resume / CV -----------------
        is_resume = any(k in f_lower for k in ["resume", "cv", "curriculum_vitae"]) or \
                    ("curriculum vitae" in t_lower) or \
                    ("experience" in t_lower and "education" in t_lower and ("skills" in t_lower or "projects" in t_lower))

        # ----------------- 5. Professional: Offer / Internship Letter -----------------
        is_offer_letter = any(k in f_lower for k in ["offer", "appointment", "internship", "joining"]) or \
                          ("offer of employment" in t_lower or "internship offer" in t_lower or "letter of appointment" in t_lower)

        # ----------------- 6. Certificate -----------------
        is_certificate = "certificate" in f_lower or "completion" in t_lower or "has successfully completed" in t_lower

        # Extract Universal Fields (Roll No, Enrollment No, Registration No, College, Branch, DOB, Phone, Email)
        self._extract_academic_and_contact_fields(text, fields)

        if is_id_card:
            category = "college_id"
        elif is_marksheet:
            category = "marksheet"
            self._extract_marksheet_table_fields(text, fields)
        elif is_resume:
            category = "resume"
            self._extract_resume_fields(text, fields)
        elif is_offer_letter:
            category = "offer_letter"
        elif is_certificate:
            category = "certificate"
        elif any(k in t_lower for k in ["college", "university", "institute", "semester"]):
            category = "college_document"
        else:
            category = "other"

        # Optional LLM Enhancement for non-standard formats
        self._supplement_fields_with_llm(category, text, fields)

        logger.info(f"[DOC_CLASSIFY] category={category}")
        logger.info(f"[DOC_STRUCTURED_EXTRACT] field_count={len(fields)} fields_found={list(fields.keys())}")
        return category, fields

    def _extract_academic_and_contact_fields(self, text: str, fields: Dict[str, Any]):
        """Extract core institutional identifiers using robust regex patterns."""
        # 1. Roll Number
        roll_pats = [
            r'(?:roll\s*(?:no|number)?|rollno|id\s*no\.?)\s*[:=\-]?\s*([A-Za-z0-9/\-]+)',
            r'\broll\s*#\s*([A-Za-z0-9/\-]+)',
            r'\b([0-9]{7,12})\b'  # Numeric student roll numbers
        ]
        for pat in roll_pats:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                val = m.group(1).strip().rstrip(".,")
                if len(val) >= 3 and not any(w in val.lower() for w in ["number", "student"]):
                    fields["roll_number"] = val
                    break

        # 2. Enrollment / Registration Number
        enroll_pats = [
            r'(?:enrollment\s*(?:no|number)?|enrolment\s*(?:no|number)?|enrol\s*no\.?)\s*[:=\-]?\s*([A-Za-z0-9/\-]+)',
            r'(?:registration\s*(?:no|number)?|reg\s*(?:no|number)?\.?|regn\s*no\.?)\s*[:=\-]?\s*([A-Za-z0-9/\-]+)'
        ]
        for pat in enroll_pats:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                val = m.group(1).strip().rstrip(".,")
                if len(val) >= 3 and not any(w in val.lower() for w in ["number", "date"]):
                    fields["enrollment_number"] = val
                    fields["registration_number"] = val
                    break

        # 3. Student / Candidate Name
        name_pats = [
            r'(?:student\s*name|candidate\s*name|name\s*of\s*student|name)\s*[:=\-]?\s*([A-Za-z\s\.]+?)(?:\n|$|,)',
            r'(?:mr\.|ms\.|shri)\s+([A-Za-z\s]+?)(?:\n|$|,)'
        ]
        for pat in name_pats:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                name_val = m.group(1).strip().rstrip(".,")
                if len(name_val) >= 3 and not any(w in name_val.lower() for w in ["college", "university", "school", "exam", "grade"]):
                    fields["student_name"] = name_val.title()
                    break

        # 4. College / University
        col_pats = [
            r'(?:college|institution|institute|university)\s*[:=\-]?\s*([A-Za-z\s,\.\(\)]+?)(?:\n|$)',
            r'\b(National\s+Institute\s+of\s+Technology[A-Za-z\s,]+)\b',
            r'\b(Indian\s+Institute\s+of\s+Technology[A-Za-z\s,]+)\b',
            r'\b([A-Za-z\s]+(?:University|Engineering\s+College|Institute\s+of\s+Technology))\b'
        ]
        for pat in col_pats:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                col_val = m.group(1).strip().rstrip(".,")
                if len(col_val) >= 4 and not any(w in col_val.lower() for w in ["roll", "student", "branch"]):
                    fields["college"] = col_val
                    break

        # 5. Branch / Department
        branch_pats = [
            r'(?:branch|department|dept\.?|stream|discipline)\s*[:=\-]?\s*([A-Za-z\s&]+?)(?:\n|$|,)',
            r'\b(Computer\s+Science(?:\s+and\s+Engineering)?|Information\s+Technology|Mechanical|Electrical|Civil|Electronics)\b'
        ]
        for pat in branch_pats:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                b_val = m.group(1).strip().rstrip(".,")
                if len(b_val) >= 2:
                    fields["branch"] = b_val.title()
                    break

        # 6. Course / Degree
        course_pats = [
            r'(?:course|programme|degree)\s*[:=\-]?\s*([A-Za-z\.\s]+?)(?:\n|$|,)',
            r'\b(B\.?Tech|M\.?Tech|B\.?E\.?|BCA|MCA|B\.?Sc|M\.?Sc|MBA)\b'
        ]
        for pat in course_pats:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                c_val = m.group(1).strip().rstrip(".,")
                if len(c_val) >= 2:
                    fields["course"] = c_val.upper()
                    break

        # 7. Batch / Session
        batch_m = re.search(r'(?:batch|session|admission\s*year)\s*[:=\-]?\s*(\d{4}(?:\s*-\s*\d{2,4})?)', text, re.IGNORECASE)
        if batch_m:
            fields["batch"] = batch_m.group(1).strip()

        # 8. Date of Birth
        dob_m = re.search(r'(?:d\.?o\.?b\.?|date\s*of\s*birth)\s*[:=\-]?\s*([0-3]?[0-9][/-][0-1]?[0-9][/-][12][90][0-9]{2})', text, re.IGNORECASE)
        if dob_m:
            fields["dob"] = dob_m.group(1).strip()
            fields["date_of_birth"] = dob_m.group(1).strip()

        # 9. Blood Group
        bg_m = re.search(r'(?:blood\s*group|b\.g\.?)\s*[:=\-]?\s*([ABOab][+-])', text, re.IGNORECASE)
        if bg_m:
            fields["blood_group"] = bg_m.group(1).strip().upper()

        # 10. Phone / Mobile
        phone_m = re.search(r'(?:phone|mobile|contact|tel\.?)\s*[:=\-]?\s*([+0-9\s\-]{10,15})', text, re.IGNORECASE)
        if phone_m:
            p_val = re.sub(r'[^0-9+]', '', phone_m.group(1).strip())
            if len(p_val) >= 10:
                fields["phone"] = p_val

        # 11. Email
        email_m = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
        if email_m:
            fields["email"] = email_m.group(0).strip().lower()

    def _extract_marksheet_table_fields(self, text: str, fields: Dict[str, Any]):
        """Extract marksheet semester, SGPA/CGPA, and tabular subject-marks mapping."""
        # Semester
        sem_m = re.search(r'(?:semester|sem\.?)\s*[:=\-]?\s*([0-9IVX]+)', text, re.IGNORECASE)
        if sem_m:
            fields["semester"] = sem_m.group(1).strip()

        # CGPA
        cgpa_m = re.search(r'(?:cgpa|cumulative\s*grade\s*point(?:\s*average)?)\s*[:=\-]?\s*([0-9]+\.?[0-9]*)', text, re.IGNORECASE)
        if cgpa_m:
            fields["cgpa"] = cgpa_m.group(1).strip()

        # SGPA
        sgpa_m = re.search(r'(?:sgpa|semester\s*grade\s*point(?:\s*average)?)\s*[:=\-]?\s*([0-9]+\.?[0-9]*)', text, re.IGNORECASE)
        if sgpa_m:
            fields["sgpa"] = sgpa_m.group(1).strip()

        # Subject & Marks breakdown
        subjects_dict = {}
        # Parse table lines or subject lines like: DBMS : 88, DBMS | 88 | A
        common_subjects = [
            "DBMS", "Database Management Systems", "Database Management", 
            "Operating Systems", "OS", "Computer Networks", "CN", 
            "Data Structures", "DSA", "Algorithms", "Software Engineering", 
            "Machine Learning", "Artificial Intelligence", "AI", "Theory of Computation",
            "Compiler Design", "Web Development", "Computer Architecture", "Mathematics"
        ]

        for subj in common_subjects:
            # Allow optional abbreviations or text in parens like Database Management Systems (DBMS), and delimiters
            pat = rf'\b{re.escape(subj)}\b(?:\s*\([^)]*\))?\s*[:|,\-]?\s*([0-9]{{1,3}}(?:\.[0-9]+)?|\b[A-F][+-]?\b)'
            m = re.search(pat, text, re.IGNORECASE)
            if not m:
                # Also try if the subject was inside parens, e.g. (DBMS) : 92
                pat2 = rf'\({re.escape(subj)}\)\s*[:|,\-]?\s*([0-9]{{1,3}}(?:\.[0-9]+)?|\b[A-F][+-]?\b)'
                m = re.search(pat2, text, re.IGNORECASE)
            if not m:
                # Also handle pipe table row format: | DBMS | 92 |
                pat3 = rf'\|\s*{re.escape(subj)}[^\n|]*\|\s*([0-9]{{1,3}}(?:\.[0-9]+)?|\b[A-F][+-]?\b)'
                m = re.search(pat3, text, re.IGNORECASE)

            if m:
                val = m.group(1).strip()
                subjects_dict[subj] = {"marks_or_grade": val}
                canonical_key = subj.lower().replace(" ", "_") + "_marks"
                fields[canonical_key] = val
                if "dbms" in subj.lower():
                    fields["dbms_marks"] = val

        if subjects_dict:
            fields["subjects"] = subjects_dict

    def _extract_resume_fields(self, text: str, fields: Dict[str, Any]):
        """Extract projects, skills, and links from resume."""
        lower = text.lower()
        # Projects detection
        if "project" in lower:
            proj_lines = []
            for line in text.splitlines():
                if any(w in line.lower() for w in ["project:", "projects:", "developed", "built", "implemented"]) and len(line.strip()) > 10:
                    proj_lines.append(line.strip())
            if proj_lines:
                fields["projects"] = proj_lines[:5]

        # Skills detection
        if "skill" in lower:
            skill_keywords = ["python", "java", "c++", "fastapi", "react", "node.js", "docker", "sql", "git", "aws", "machine learning"]
            found_skills = [sk.title() for sk in skill_keywords if sk in lower]
            if found_skills:
                fields["skills"] = found_skills

    def _extract_common_identity_fields(self, text: str, fields: Dict[str, Any]):
        """Extract Name, DOB, and Father's Name from government identity documents."""
        dob_m = re.search(r'(?:d\.?o\.?b\.?|date\s*of\s*birth)\s*[:=\-]?\s*([0-3]?[0-9][/-][0-1]?[0-9][/-][12][90][0-9]{2})', text, re.IGNORECASE)
        if dob_m and "dob" not in fields:
            fields["dob"] = dob_m.group(1).strip()
            fields["date_of_birth"] = dob_m.group(1).strip()

        name_m = re.search(r'(?:name|holder)\s*[:=\-]?\s*([A-Za-z\s]+?)(?:\n|$|,)', text, re.IGNORECASE)
        if name_m and "name" not in fields:
            fields["name"] = name_m.group(1).strip().title()

    def _supplement_fields_with_llm(self, category: str, text: str, fields: Dict[str, Any]):
        """Supplement fields with LLM if Gemini is available for complex documents."""
        genai = get_gemini_client()
        if not genai or len(text.strip()) < 40:
            return

        prompt = f"""
Extract key structured attributes from this {category} document as a JSON dictionary.
Do NOT hallucinate or guess. Only extract values present in the text.
Document Text:
\"\"\"{text[:2500]}\"\"\"

Return ONLY valid JSON with keys like:
roll_number, student_name, enrollment_number, college, branch, semester, cgpa, subjects (as dict of subject: marks)
"""
        for candidate in CANDIDATE_MODELS:
            try:
                model = genai.GenerativeModel(model_name=candidate)
                res = model.generate_content(prompt)
                t = res.text.strip()
                if t.startswith("```json"):
                    t = t[7:]
                if t.endswith("```"):
                    t = t[:-3]
                parsed = json.loads(t.strip())
                if isinstance(parsed, dict):
                    for k, v in parsed.items():
                        if k not in fields and v:
                            fields[k] = v
                    break
            except Exception:
                continue

    def _route_sensitive_fields_to_vault(self, db: Session, user_id: str, doc_id: str, category: str, structured_fields: Dict[str, Any]):
        """Encrypt and persist sensitive identity identifiers in Secure Vault."""
        if category == "pan_card" and "pan_number" in structured_fields:
            self._save_vault_entry(db, user_id, doc_id, "PAN Card Number", "pan", structured_fields["pan_number"])
        elif category == "aadhaar_card" and "aadhaar_number" in structured_fields:
            self._save_vault_entry(db, user_id, doc_id, "Aadhaar Card Number", "aadhaar", structured_fields["aadhaar_number"])
        elif category == "passport" and "passport_number" in structured_fields:
            self._save_vault_entry(db, user_id, doc_id, "Passport Number", "passport", structured_fields["passport_number"])

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

    def _chunk_document(self, text: str, page_map: Dict[int, str], chunk_size: int = 600, overlap: int = 100) -> List[Dict[str, Any]]:
        """Split document into passages with page numbers preserved."""
        if not text:
            return []
        
        chunks = []
        # If we have multiple pages, chunk page by page
        if len(page_map) > 1:
            for p_num, p_text in page_map.items():
                if not p_text.strip():
                    continue
                start = 0
                t_len = len(p_text)
                while start < t_len:
                    end = min(start + chunk_size, t_len)
                    chunk_str = p_text[start:end].strip()
                    if chunk_str:
                        chunks.append({"content": chunk_str, "page_number": p_num})
                    start += (chunk_size - overlap)
        else:
            # Single page chunking
            start = 0
            t_len = len(text)
            while start < t_len:
                end = min(start + chunk_size, t_len)
                chunk_str = text[start:end].strip()
                if chunk_str:
                    chunks.append({"content": chunk_str, "page_number": 1})
                start += (chunk_size - overlap)

        return chunks

    # ==================== FIELD-LEVEL DIRECT SEARCH ====================

    def find_structured_field_in_user_documents(
        self,
        db: Session,
        user_id: str,
        query: str,
        target_doc_category: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Direct field-level structured search in <5ms without requiring vector search.
        Identifies target attribute (roll_number, enrollment_number, dbms_marks, etc.)
        or full document dumps across authenticated user's documents.
        """
        q_lower = query.lower().strip()
        user_docs = db.query(Document).filter(Document.user_id == user_id).all()
        if not user_docs:
            return None

        # Filter by document category if explicitly specified
        if target_doc_category:
            filtered = [d for d in user_docs if d.category == target_doc_category]
            if filtered:
                user_docs = filtered

        # 1. Full Details / Complete Details of a Document (e.g. "Give me all details from my college ID")
        is_full_detail_req = any(p in q_lower for p in [
            "all details", "every detail", "complete detail", "full detail", 
            "what is written on my college id", "college id me kya", "sab details", "details from my college id"
        ])
        if is_full_detail_req:
            # Look for college ID or document specified
            target_doc = None
            if any(k in q_lower for k in ["college id", "id card", "id"]):
                target_doc = next((d for d in user_docs if d.category == "college_id"), None)
            elif "marksheet" in q_lower:
                target_doc = next((d for d in user_docs if d.category == "marksheet"), None)
            elif "resume" in q_lower:
                target_doc = next((d for d in user_docs if d.category == "resume"), None)

            if not target_doc and user_docs:
                target_doc = user_docs[0]

            if target_doc:
                summary = self._build_document_full_summary(target_doc)
                logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field=FULL_DOCUMENT found=True doc_id={target_doc.id}")
                return {
                    "is_full_summary": True,
                    "summary_text": summary,
                    "document_name": target_doc.original_filename,
                    "document_category": target_doc.category,
                    "document_id": target_doc.id
                }

        # 2. Document Identification (e.g. "Which document contains my enrollment number?")
        if any(p in q_lower for p in ["which document", "kis document", "kisme hai", "konse document"]):
            if any(k in q_lower for k in ["enrollment", "enrolment", "registration"]):
                for doc in user_docs:
                    s_fields = doc.structured_fields or {}
                    if "enrollment_number" in s_fields or "registration_number" in s_fields or "enrollment" in (doc.extracted_text or "").lower():
                        val = s_fields.get("enrollment_number") or s_fields.get("registration_number") or "present"
                        logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field=which_doc_enrollment found=True doc_id={doc.id}")
                        return {
                            "is_full_summary": False,
                            "field_name": "enrollment_number",
                            "field_value": val,
                            "answer_text": f"Your enrollment number is {val}, found in your uploaded document: {doc.original_filename} ({doc.category.replace('_', ' ').title()}).",
                            "document_name": doc.original_filename,
                            "document_category": doc.category,
                            "document_id": doc.id
                        }
            if any(k in q_lower for k in ["roll number", "roll no"]):
                for doc in user_docs:
                    s_fields = doc.structured_fields or {}
                    if "roll_number" in s_fields or "roll no" in (doc.extracted_text or "").lower():
                        val = s_fields.get("roll_number") or "present"
                        logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field=which_doc_roll found=True doc_id={doc.id}")
                        return {
                            "is_full_summary": False,
                            "field_name": "roll_number",
                            "field_value": val,
                            "answer_text": f"Your roll number is {val}, found in your uploaded document: {doc.original_filename} ({doc.category.replace('_', ' ').title()}).",
                            "document_name": doc.original_filename,
                            "document_category": doc.category,
                            "document_id": doc.id
                        }

        # 3. Roll Number
        if any(k in q_lower for k in ["roll number", "roll no", "rollno", "id number"]):
            for doc in user_docs:
                s_fields = doc.structured_fields or {}
                if "roll_number" in s_fields:
                    val = s_fields["roll_number"]
                    logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field=roll_number found=True doc_id={doc.id}")
                    return {
                        "is_full_summary": False,
                        "field_name": "roll_number",
                        "field_value": val,
                        "answer_text": f"Your roll number is {val}, according to your uploaded {doc.category.replace('_', ' ').title()} ({doc.original_filename}).",
                        "document_name": doc.original_filename,
                        "document_category": doc.category,
                        "document_id": doc.id
                    }

        # 4. Enrollment Number / Registration Number
        if any(k in q_lower for k in ["enrollment number", "enrollment no", "enrolment", "registration number", "reg no"]):
            for doc in user_docs:
                s_fields = doc.structured_fields or {}
                val = s_fields.get("enrollment_number") or s_fields.get("registration_number")
                if val:
                    logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field=enrollment_number found=True doc_id={doc.id}")
                    return {
                        "is_full_summary": False,
                        "field_name": "enrollment_number",
                        "field_value": val,
                        "answer_text": f"Your enrollment number is {val}, according to your uploaded {doc.category.replace('_', ' ').title()} ({doc.original_filename}).",
                        "document_name": doc.original_filename,
                        "document_category": doc.category,
                        "document_id": doc.id
                    }

        # 5. Subject Marks (e.g. "What are my marks in DBMS?", "DBMS marks")
        if any(k in q_lower for k in ["dbms", "database"]):
            for doc in user_docs:
                s_fields = doc.structured_fields or {}
                if "dbms_marks" in s_fields:
                    val = s_fields["dbms_marks"]
                    logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field=dbms_marks found=True doc_id={doc.id}")
                    return {
                        "is_full_summary": False,
                        "field_name": "dbms_marks",
                        "field_value": val,
                        "answer_text": f"Your marks in DBMS are {val}, according to your uploaded {doc.category.replace('_', ' ').title()} ({doc.original_filename}).",
                        "document_name": doc.original_filename,
                        "document_category": doc.category,
                        "document_id": doc.id
                    }

        # 6. CGPA / SGPA
        if any(k in q_lower for k in ["cgpa", "sgpa"]):
            for doc in user_docs:
                s_fields = doc.structured_fields or {}
                cgpa = s_fields.get("cgpa")
                sgpa = s_fields.get("sgpa")
                sem = s_fields.get("semester", "")
                if cgpa or sgpa:
                    val_str = f"CGPA: {cgpa}" if cgpa else f"SGPA: {sgpa}"
                    if sem:
                        val_str = f"Semester {sem} {val_str}"
                    logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field=cgpa found=True doc_id={doc.id}")
                    return {
                        "is_full_summary": False,
                        "field_name": "cgpa",
                        "field_value": cgpa or sgpa,
                        "answer_text": f"According to your uploaded marksheet ({doc.original_filename}), your {val_str}.",
                        "document_name": doc.original_filename,
                        "document_category": doc.category,
                        "document_id": doc.id
                    }

        # 7. Branch / Department
        if any(k in q_lower for k in ["branch", "department"]) and any(w in q_lower for w in ["document", "id", "card", "college id"]):
            for doc in user_docs:
                s_fields = doc.structured_fields or {}
                if "branch" in s_fields:
                    val = s_fields["branch"]
                    logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field=branch found=True doc_id={doc.id}")
                    return {
                        "is_full_summary": False,
                        "field_name": "branch",
                        "field_value": val,
                        "answer_text": f"Your branch is {val}, according to your uploaded {doc.category.replace('_', ' ').title()} ({doc.original_filename}).",
                        "document_name": doc.original_filename,
                        "document_category": doc.category,
                        "document_id": doc.id
                    }

        # 8. Date of Birth
        if any(k in q_lower for k in ["date of birth", "dob", "birth date"]) and any(w in q_lower for w in ["document", "id", "card", "uploaded"]):
            for doc in user_docs:
                s_fields = doc.structured_fields or {}
                val = s_fields.get("dob") or s_fields.get("date_of_birth")
                if val:
                    logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field=dob found=True doc_id={doc.id}")
                    return {
                        "is_full_summary": False,
                        "field_name": "dob",
                        "field_value": val,
                        "answer_text": f"Your date of birth according to your uploaded {doc.category.replace('_', ' ').title()} ({doc.original_filename}) is {val}.",
                        "document_name": doc.original_filename,
                        "document_category": doc.category,
                        "document_id": doc.id
                    }

        # 9. Phone Number / Email in Document
        if any(k in q_lower for k in ["phone", "mobile", "contact", "email"]) and any(w in q_lower for w in ["document", "id", "card", "uploaded", "file"]):
            for doc in user_docs:
                s_fields = doc.structured_fields or {}
                val = s_fields.get("phone") or s_fields.get("email")
                if val:
                    field_n = "phone" if "phone" in s_fields else "email"
                    logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field={field_n} found=True doc_id={doc.id}")
                    return {
                        "is_full_summary": False,
                        "field_name": field_n,
                        "field_value": val,
                        "answer_text": f"The {field_n} present in your uploaded {doc.category.replace('_', ' ').title()} ({doc.original_filename}) is {val}.",
                        "document_name": doc.original_filename,
                        "document_category": doc.category,
                        "document_id": doc.id
                    }

        # 10. Resume Projects
        if "project" in q_lower and any(w in q_lower for w in ["resume", "cv", "document", "uploaded"]):
            for doc in user_docs:
                if doc.category == "resume":
                    s_fields = doc.structured_fields or {}
                    if "projects" in s_fields and s_fields["projects"]:
                        val = s_fields["projects"]
                        val_str = "\n".join(f"• {p}" for p in val)
                        logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field=projects found=True doc_id={doc.id}")
                        return {
                            "is_full_summary": False,
                            "field_name": "projects",
                            "field_value": val,
                            "answer_text": f"According to your uploaded Resume ({doc.original_filename}), here are your projects:\n{val_str}",
                            "document_name": doc.original_filename,
                            "document_category": doc.category,
                            "document_id": doc.id
                        }

        # 11. College / Institute specified according to document
        if any(k in q_lower for k in ["college", "university", "institute"]) and any(w in q_lower for w in ["document", "id", "card", "college id", "uploaded", "in the pdf"]):
            for doc in user_docs:
                s_fields = doc.structured_fields or {}
                if "college" in s_fields:
                    val = s_fields["college"]
                    logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field=college found=True doc_id={doc.id}")
                    return {
                        "is_full_summary": False,
                        "field_name": "college",
                        "field_value": val,
                        "answer_text": f"According to your uploaded {doc.category.replace('_', ' ').title()} ({doc.original_filename}), your college is {val}.",
                        "document_name": doc.original_filename,
                        "document_category": doc.category,
                        "document_id": doc.id
                    }

        # 12. Student Name on Document
        if any(k in q_lower for k in ["student name", "name on my id", "name in document", "name on document"]):
            for doc in user_docs:
                s_fields = doc.structured_fields or {}
                val = s_fields.get("student_name") or s_fields.get("name")
                if val:
                    logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field=name found=True doc_id={doc.id}")
                    return {
                        "is_full_summary": False,
                        "field_name": "name",
                        "field_value": val,
                        "answer_text": f"According to your uploaded {doc.category.replace('_', ' ').title()} ({doc.original_filename}), your name is {val}.",
                        "document_name": doc.original_filename,
                        "document_category": doc.category,
                        "document_id": doc.id
                    }

        logger.info(f"[DOC_FIELD_LOOKUP] user_id={user_id} target_field=none found=False")
        return None

    def _build_document_full_summary(self, doc: Document) -> str:
        """Construct an exhaustive, human-readable breakdown of all extracted fields."""
        fields = doc.structured_fields or {}
        lines = [f"Here are all the details from your uploaded {doc.category.replace('_', ' ').title()} ({doc.original_filename}):\n"]
        
        field_labels = {
            "student_name": "Student Name",
            "name": "Name",
            "roll_number": "Roll Number",
            "enrollment_number": "Enrollment Number",
            "registration_number": "Registration Number",
            "college": "College / Institute",
            "branch": "Branch",
            "course": "Course",
            "batch": "Batch",
            "semester": "Semester",
            "cgpa": "CGPA",
            "sgpa": "SGPA",
            "dob": "Date of Birth",
            "date_of_birth": "Date of Birth",
            "blood_group": "Blood Group",
            "phone": "Phone",
            "email": "Email"
        }

        for k, label in field_labels.items():
            if k in fields and fields[k]:
                lines.append(f"• **{label}**: {fields[k]}")

        # If subjects table exists
        if "subjects" in fields and isinstance(fields["subjects"], dict):
            lines.append("\n**Subjects & Marks:**")
            for subj, data in fields["subjects"].items():
                m_val = data.get("marks_or_grade") if isinstance(data, dict) else data
                lines.append(f"  - {subj}: {m_val}")

        # If resume projects exist
        if "projects" in fields and isinstance(fields["projects"], list):
            lines.append("\n**Projects Mentioned:**")
            for proj in fields["projects"]:
                lines.append(f"  - {proj}")

        lines.append(f"\n**Source:** {doc.original_filename} ({doc.category.replace('_', ' ').title()})")
        return "\n".join(lines)

document_service = DocumentService()
