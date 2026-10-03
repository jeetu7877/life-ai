import os
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.config import settings
from app.security.crypto import redact_sensitive_strings

logger = logging.getLogger(__name__)

class RAGService:
    def __init__(self):
        self.persist_directory = settings.CHROMA_PERSIST_DIRECTORY
        os.makedirs(self.persist_directory, exist_ok=True)
        
        # Initialize Persistent Chroma Client
        self.client = chromadb.PersistentClient(
            path=self.persist_directory,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        
        # Collections
        self.doc_collection = self.client.get_or_create_collection(
            name="personal_documents",
            metadata={"description": "Extracted text chunks from personal documents"}
        )
        self.memory_collection = self.client.get_or_create_collection(
            name="personal_memories",
            metadata={"description": "Semantic index of long-term personal facts and experiences"}
        )

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
        ids = []
        documents = []
        metadatas = []
        
        for c in chunks:
            chunk_id = f"doc_{document_id}_{c['chunk_index']}"
            safe_text = redact_sensitive_strings(c["content"])
            
            ids.append(chunk_id)
            documents.append(safe_text)
            metadatas.append({
                "user_id": user_id,
                "document_id": document_id,
                "category": category,
                "chunk_index": c["chunk_index"],
                "page_number": c.get("page_number", 1) or 1
            })
            
        if ids:
            self.doc_collection.upsert(
                ids=ids,
                documents=documents,
                metadatas=metadatas
            )
            logger.info(f"Upserted {len(ids)} chunks for document {document_id}")

    def add_memory(
        self,
        memory_id: str,
        user_id: str,
        content: str,
        memory_type: str,
        event_date: Optional[str] = None
    ):
        """Index a long-term memory into ChromaDB."""
        safe_content = redact_sensitive_strings(content)
        self.memory_collection.upsert(
            ids=[f"mem_{memory_id}"],
            documents=[safe_content],
            metadatas=[{
                "user_id": user_id,
                "memory_id": memory_id,
                "memory_type": memory_type,
                "event_date": event_date or ""
            }]
        )

    def search_documents(
        self,
        user_id: str,
        query: str,
        top_k: int = 4,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve most relevant document snippets for user query."""
        try:
            # Fast path: Skip vector embedding if no documents exist
            if self.doc_collection.count() == 0:
                return []

            where_clause = {"user_id": user_id}
            if category:
                where_clause["category"] = category
                
            results = self.doc_collection.query(
                query_texts=[query],
                n_results=top_k,
                where=where_clause
            )
            
            output = []
            if results and results.get("documents") and results["documents"][0]:
                for doc, meta, doc_id in zip(results["documents"][0], results["metadatas"][0], results["ids"][0]):
                    output.append({
                        "id": doc_id,
                        "content": doc,
                        "metadata": meta
                    })
            return output
        except Exception as e:
            logger.error(f"Error searching ChromaDB documents: {e}")
            return []

    def search_memories(
        self,
        user_id: str,
        query: str,
        top_k: int = 5,
        memory_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant long-term memories using semantic similarity."""
        try:
            # Fast path: Skip vector embedding if no memories exist
            if self.memory_collection.count() == 0:
                return []

            where_clause = {"user_id": user_id}
            if memory_type:
                where_clause["memory_type"] = memory_type
                
            results = self.memory_collection.query(
                query_texts=[query],
                n_results=top_k,
                where=where_clause
            )
            
            output = []
            if results and results.get("documents") and results["documents"][0]:
                for doc, meta, mem_id in zip(results["documents"][0], results["metadatas"][0], results["ids"][0]):
                    output.append({
                        "id": mem_id,
                        "content": doc,
                        "metadata": meta
                    })
            return output
        except Exception as e:
            logger.error(f"Error searching ChromaDB memories: {e}")
            return []

    def delete_document(self, document_id: str):
        """Remove document chunks from ChromaDB."""
        try:
            self.doc_collection.delete(where={"document_id": document_id})
        except Exception as e:
            logger.warning(f"Error deleting document {document_id} from vector store: {e}")

    def delete_memory(self, memory_id: str):
        """Remove single memory from ChromaDB."""
        try:
            self.memory_collection.delete(ids=[f"mem_{memory_id}"])
        except Exception as e:
            logger.warning(f"Error deleting memory {memory_id} from vector store: {e}")

rag_service = RAGService()
