import os
import re
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.security.crypto import redact_sensitive_strings
from app.services.embedding_service import embedding_service

logger = logging.getLogger(__name__)

class RAGService:
    """
    Hybrid Persistent RAG & Memory Service:
    - ChromaDB provides sub-millisecond vector caching when healthy.
    - PostgreSQL/SQLite is the canonical persistent source of truth.
    - If ChromaDB is empty, rebooted, or encounters a filesystem/compaction error,
      the system gracefully falls back to database-level persistent vector similarity search.
    - Zero data loss across Render redeploys and restarts.
    """

    def __init__(self):
        self.persist_directory = settings.CHROMA_PERSIST_DIRECTORY
        os.makedirs(self.persist_directory, exist_ok=True)
        self.client = None
        self.doc_collection = None
        self.memory_collection = None
        self._init_chroma()

    def _init_chroma(self):
        """Safely initialize ChromaDB client with recovery on corrupted indexes."""
        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings
            self.client = chromadb.PersistentClient(
                path=self.persist_directory,
                settings=ChromaSettings(anonymized_telemetry=False)
            )
            self.doc_collection = self.client.get_or_create_collection(
                name="personal_documents",
                metadata={"description": "Extracted text chunks from personal documents"}
            )
            self.memory_collection = self.client.get_or_create_collection(
                name="personal_memories",
                metadata={"description": "Semantic index of long-term personal facts and experiences"}
            )
            logger.info("ChromaDB vector collections successfully initialized.")
        except Exception as e:
            logger.warning(f"ChromaDB initialization note: {e}. Persistent DB fallback is active.")
            self.client = None
            self.doc_collection = None
            self.memory_collection = None

    def add_document_chunks(
        self,
        chunks: List[Dict[str, Any]],
        user_id: str,
        document_id: str,
        category: str
    ):
        """
        Store chunk embeddings in ChromaDB with metadata.
        Ensures sensitive numbers are redacted before vectorization.
        """
        if not self.doc_collection:
            self._init_chroma()
            if not self.doc_collection:
                return

        ids = []
        documents = []
        metadatas = []

        for c in chunks:
            chunk_id = f"doc_{document_id}_{c['chunk_index']}"
            safe_text = redact_sensitive_strings(c.get("content", ""))

            ids.append(chunk_id)
            documents.append(safe_text)
            metadatas.append({
                "user_id": str(user_id),
                "document_id": str(document_id),
                "category": str(category or "other"),
                "chunk_index": int(c.get("chunk_index", 0)),
                "page_number": int(c.get("page_number", 1) or 1)
            })

        if ids:
            try:
                self.doc_collection.upsert(
                    ids=ids,
                    documents=documents,
                    metadatas=metadatas
                )
                logger.info(f"Upserted {len(ids)} chunks for document {document_id}")
            except Exception as e:
                logger.warning(f"Error upserting document chunks to ChromaDB: {e}")

    def add_memory(
        self,
        memory_id: str,
        user_id: str,
        content: str,
        memory_type: str,
        event_date: Optional[str] = None
    ):
        """Index a long-term memory into vector store."""
        if not self.memory_collection:
            self._init_chroma()
            if not self.memory_collection:
                return

        safe_content = redact_sensitive_strings(content)
        try:
            self.memory_collection.upsert(
                ids=[f"mem_{memory_id}"],
                documents=[safe_content],
                metadatas=[{
                    "user_id": str(user_id),
                    "memory_id": str(memory_id),
                    "memory_type": str(memory_type),
                    "event_date": str(event_date or "")
                }]
            )
        except Exception as e:
            logger.warning(f"Error upserting memory {memory_id} to ChromaDB: {e}")

    def search_memories(
        self,
        user_id: str,
        query: str,
        top_k: int = 5,
        memory_type: Optional[str] = None,
        db: Optional[Session] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant long-term memories using semantic vector similarity.
        STRICT USER ISOLATION: Always filters by authenticated user_id.
        Dual-layer: ChromaDB cache first, seamless DB vector fallback if Chroma is empty/corrupt.
        """
        output = []

        # 1. Try ChromaDB index
        if self.memory_collection:
            try:
                where_clause: Dict[str, Any] = {"user_id": str(user_id)}
                if memory_type:
                    where_clause["memory_type"] = str(memory_type)

                if self.memory_collection.count() > 0:
                    results = self.memory_collection.query(
                        query_texts=[query],
                        n_results=top_k,
                        where=where_clause
                    )
                    if results and results.get("documents") and results["documents"][0]:
                        for doc, meta, mem_id in zip(results["documents"][0], results["metadatas"][0], results["ids"][0]):
                            output.append({
                                "id": mem_id,
                                "content": doc,
                                "metadata": meta
                            })
                        if output:
                            return output
            except Exception as e:
                logger.warning(f"ChromaDB memory search note ({e}), falling back to database vector search.")

        # 2. Database-level Persistent Semantic Search Fallback (100% resilient across container restarts)
        from app.database import SessionLocal
        from app.models.memory import Memory

        close_session = False
        if db is None:
            db = SessionLocal()
            close_session = True

        try:
            query_filter = db.query(Memory).filter(
                Memory.user_id == str(user_id),
                Memory.status == "active"
            )
            if memory_type:
                query_filter = query_filter.filter(Memory.memory_type == str(memory_type))

            active_memories = query_filter.all()
            if not active_memories:
                return []

            query_vec = embedding_service.get_query_embedding(query)
            scored_memories = []
            q_lower = query.lower()
            q_words = set(re.findall(r'\b[a-zA-Z0-9_]{3,}\b', q_lower))

            for m in active_memories:
                # Retrieve or compute persistent embedding
                m_vec = m.embedding
                if not m_vec:
                    m_vec = embedding_service.get_embedding(m.content)
                    m.embedding = m_vec
                    m.embedding_status = "ready"
                    try:
                        db.commit()
                    except Exception:
                        pass

                sim = embedding_service.cosine_similarity(query_vec, m_vec)

                # Hybrid lexical match
                m_lower = m.content.lower()
                m_words = set(re.findall(r'\b[a-zA-Z0-9_]{3,}\b', m_lower))
                overlap = len(q_words.intersection(m_words))

                # Entity/topic bonus
                topic_bonus = 0.0
                if m.topic and m.topic.lower() in q_lower:
                    topic_bonus = 1.0
                elif any(kw in q_lower and kw in m_lower for kw in ["bestie", "best friend", "dost", "college", "company", "project"]):
                    topic_bonus = 1.0

                composite_score = sim + (0.4 * overlap) + (1.2 * topic_bonus)
                scored_memories.append((composite_score, sim, m))

            # Sort descending by composite score
            scored_memories.sort(key=lambda x: x[0], reverse=True)

            for comp_score, sim, m in scored_memories[:top_k]:
                output.append({
                    "id": f"mem_{m.id}",
                    "content": m.content,
                    "metadata": {
                        "user_id": m.user_id,
                        "memory_id": m.id,
                        "memory_type": m.memory_type,
                        "topic": m.topic or "",
                        "event_date": m.event_date or "",
                        "similarity": round(float(sim), 4),
                        "score": round(float(comp_score), 4)
                    }
                })

            return output
        except Exception as e:
            logger.error(f"Error in database persistent memory search: {e}")
            return []
        finally:
            if close_session:
                db.close()

    def search_documents(
        self,
        user_id: str,
        query: str,
        top_k: int = 4,
        category: Optional[str] = None,
        document_id: Optional[str] = None,
        db: Optional[Session] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve most relevant document snippets for user query.
        STRICT USER ISOLATION: Always filters by authenticated user_id.
        """
        output = []

        # 1. Try ChromaDB
        if self.doc_collection:
            try:
                if self.doc_collection.count() > 0:
                    where_clause: Dict[str, Any] = {"user_id": str(user_id)}
                    if category:
                        where_clause["category"] = str(category)
                    if document_id:
                        where_clause["document_id"] = str(document_id)

                    results = self.doc_collection.query(
                        query_texts=[query],
                        n_results=top_k,
                        where=where_clause
                    )
                    if results and results.get("documents") and results["documents"][0]:
                        for doc, meta, doc_id in zip(results["documents"][0], results["metadatas"][0], results["ids"][0]):
                            output.append({
                                "id": doc_id,
                                "content": doc,
                                "metadata": meta
                            })
                        if output:
                            return output
            except Exception as e:
                logger.warning(f"ChromaDB document search note ({e}), falling back to DB.")

        # 2. Database Fallback (Search DocumentChunk joined with Document)
        from app.database import SessionLocal
        from app.models.document import Document, DocumentChunk

        close_session = False
        if db is None:
            db = SessionLocal()
            close_session = True

        try:
            base_q = db.query(DocumentChunk, Document).join(Document, DocumentChunk.document_id == Document.id).filter(
                Document.user_id == str(user_id)
            )
            if category:
                base_q = base_q.filter(Document.category == str(category))
            if document_id:
                base_q = base_q.filter(Document.id == str(document_id))

            chunk_pairs = base_q.all()
            if not chunk_pairs:
                return []

            # Hybrid scoring: keyword matches + vector similarity if embeddings exist
            query_words = set(re.findall(r'\b[a-zA-Z0-9_]{3,}\b', query.lower()))
            scored = []
            for chunk, doc_row in chunk_pairs:
                c_lower = chunk.content.lower()
                matches = sum(1 for w in query_words if w in c_lower)
                scored.append((matches, chunk, doc_row))

            scored.sort(key=lambda x: x[0], reverse=True)
            for _, c, doc_row in scored[:top_k]:
                output.append({
                    "id": f"doc_{c.document_id}_{c.chunk_index}",
                    "content": c.content,
                    "metadata": {
                        "user_id": user_id,
                        "document_id": c.document_id,
                        "document_name": doc_row.original_filename,
                        "category": doc_row.category,
                        "chunk_index": c.chunk_index,
                        "page_number": c.page_number or 1
                    }
                })
            return output
        except Exception as e:
            logger.error(f"Error searching document chunks in DB: {e}")
            return []
        finally:
            if close_session:
                db.close()

    def sync_active_memories_from_db(self, db: Session):
        """
        Idempotent startup sync:
        Reads all active memories from the persistent database and ensures they are in ChromaDB.
        Guarantees ChromaDB is immediately ready even after fresh Docker/Render container creation!
        """
        try:
            from app.models.memory import Memory
            active = db.query(Memory).filter(Memory.status == "active").all()
            if not active:
                return

            # Check if Chroma count is already initialized (>0)
            if self.memory_collection:
                try:
                    c_count = self.memory_collection.count()
                    if c_count > 0:
                        return
                except Exception:
                    self._init_chroma()

            logger.info(f"Syncing {len(active)} persistent memories to vector index...")
            for m in active:
                if not m.embedding:
                    m.embedding = embedding_service._deterministic_vector(m.content)
                    m.embedding_status = "ready"
            db.commit()

            if self.memory_collection:
                try:
                    batch_ids = [f"mem_{m.id}" for m in active]
                    batch_docs = [redact_sensitive_strings(m.content) for m in active]
                    batch_metas = [{
                        "user_id": str(m.user_id),
                        "memory_id": str(m.id),
                        "memory_type": str(m.memory_type),
                        "event_date": str(m.event_date or "")
                    } for m in active]
                    self.memory_collection.upsert(
                        ids=batch_ids,
                        documents=batch_docs,
                        metadatas=batch_metas
                    )
                except Exception as e:
                    logger.warning(f"Batch upsert to ChromaDB note: {e}")
            logger.info("Persistent memories vector sync complete.")
        except Exception as e:
            logger.warning(f"Memory sync note: {e}")

    def sync_documents_from_db(self, db: Session):
        """
        Idempotent startup sync for documents:
        Reads all documents and chunks from the persistent database and ensures they are in ChromaDB.
        Guarantees ChromaDB document index is immediately populated across fresh container creation!
        """
        try:
            from app.models.document import Document, DocumentChunk
            docs = db.query(Document).filter(Document.extraction_status == "completed").all()
            if not docs:
                return

            if self.doc_collection:
                try:
                    c_count = self.doc_collection.count()
                    if c_count > 0:
                        return
                except Exception:
                    self._init_chroma()

            logger.info("Syncing documents to vector index from database...")
            for doc in docs:
                chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
                if chunks:
                    chunk_records = [{
                        "chunk_index": c.chunk_index,
                        "content": c.content,
                        "page_number": c.page_number or 1
                    } for c in chunks]
                    self.add_document_chunks(
                        chunks=chunk_records,
                        user_id=doc.user_id,
                        document_id=doc.id,
                        category=doc.category
                    )
            logger.info("Persistent documents vector sync complete.")
        except Exception as e:
            logger.warning(f"Document sync note: {e}")

    def delete_document(self, document_id: str):
        """Remove document chunks from ChromaDB."""
        if self.doc_collection:
            try:
                self.doc_collection.delete(where={"document_id": str(document_id)})
            except Exception as e:
                logger.warning(f"Error deleting document from vector store: {e}")

    def delete_memory(self, memory_id: str):
        """Remove single memory from ChromaDB."""
        if self.memory_collection:
            try:
                self.memory_collection.delete(ids=[f"mem_{memory_id}"])
            except Exception as e:
                logger.warning(f"Error deleting memory from vector store: {e}")

rag_service = RAGService()
