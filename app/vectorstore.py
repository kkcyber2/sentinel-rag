import os
import uuid
from typing import List, Dict, Any
import chromadb

try:
    from langchain_ollama import OllamaEmbeddings
except ImportError:
    from langchain_community.embeddings import OllamaEmbeddings

from app.config import CHROMA_PERSIST_DIR, COLLECTION_NAME, TOP_K_RESULTS, OLLAMA_BASE_URL, EMBEDDING_MODEL

class ChromaVectorStore:
    """
    Production ChromaDB vector store wrapper for Sentinel-RAG.
    Generates real dense vector embeddings via LangChain OllamaEmbeddings (nomic-embed-text)
    and stores them in persistent ChromaDB collections.
    """
    def __init__(self, persist_dir: str = CHROMA_PERSIST_DIR, collection_name: str = COLLECTION_NAME):
        self.persist_dir = persist_dir
        self.collection_name = collection_name
        
        # Initialize persistent ChromaDB client
        os.makedirs(self.persist_dir, exist_ok=True)
        self.client = chromadb.PersistentClient(path=self.persist_dir)
        self.collection = self.client.get_or_create_collection(name=self.collection_name)
        
        # Initialize LangChain Ollama embeddings engine
        self._init_embeddings()

    def _init_embeddings(self):
        try:
            self.embeddings = OllamaEmbeddings(
                model=EMBEDDING_MODEL,
                base_url=OLLAMA_BASE_URL
            )
        except Exception as e:
            self.embeddings = None

    def get_embeddings(self) -> OllamaEmbeddings:
        if not self.embeddings:
            self._init_embeddings()
        if not self.embeddings:
            raise RuntimeError(f"Ollama Embeddings engine failed to initialize at {OLLAMA_BASE_URL}")
        return self.embeddings

    def add_documents(self, documents: List[Dict[str, Any]]) -> int:
        """
        Embeds chunks using OllamaEmbeddings and upserts them into Chroma collection.
        Raises a clear exception if Ollama embedding service is unreachable.
        """
        if not documents:
            return 0

        texts = [doc.get("text", "") for doc in documents if doc.get("text", "").strip()]
        metadatas = [doc.get("metadata", {}) for doc in documents if doc.get("text", "").strip()]
        
        if not texts:
            return 0

        # Generate embeddings via LangChain OllamaEmbeddings
        emb_engine = self.get_embeddings()
        try:
            vectors = emb_engine.embed_documents(texts)
        except Exception as e:
            raise RuntimeError(
                f"Vector embedding generation failed: Ollama embedding service '{EMBEDDING_MODEL}' "
                f"is unreachable at {OLLAMA_BASE_URL}. Original error: {str(e)}"
            ) from e

        # Generate unique IDs for chunk idempotency
        ids = []
        for i, meta in enumerate(metadatas):
            source = meta.get("source", "doc").replace("/", "_")
            page = meta.get("page", 1)
            chunk_idx = meta.get("chunk_index", i + 1)
            chunk_id = f"{source}_p{page}_c{chunk_idx}_{uuid.uuid4().hex[:6]}"
            ids.append(chunk_id)

        # Upsert into ChromaDB collection
        self.collection.add(
            ids=ids,
            embeddings=vectors,
            documents=texts,
            metadatas=metadatas
        )

        return len(texts)

    def search(self, query: str, top_k: int = TOP_K_RESULTS) -> List[Dict[str, Any]]:
        """
        Queries Chroma collection using semantic vector embedding of the query.
        Raises a clear exception if Ollama embedding service is unreachable.
        """
        if self.count() == 0:
            return []

        emb_engine = self.get_embeddings()
        try:
            query_vector = emb_engine.embed_query(query)
        except Exception as e:
            raise RuntimeError(
                f"Query vector embedding failed: Ollama embedding service '{EMBEDDING_MODEL}' "
                f"is unreachable at {OLLAMA_BASE_URL}. Original error: {str(e)}"
            ) from e

        results = self.collection.query(
            query_embeddings=[query_vector],
            n_results=min(top_k, self.count())
        )

        retrieved_chunks = []
        if results and results.get("documents") and results["documents"][0]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
            ids = results["ids"][0] if results.get("ids") else [f"id_{i}" for i in range(len(docs))]

            for idx in range(len(docs)):
                retrieved_chunks.append({
                    "id": ids[idx],
                    "text": docs[idx],
                    "metadata": metas[idx] or {}
                })

        return retrieved_chunks

    def clear(self):
        """
        Deletes and recreates the Chroma collection.
        """
        try:
            self.client.delete_collection(name=self.collection_name)
        except Exception:
            pass
        self.collection = self.client.get_or_create_collection(name=self.collection_name)

    def count(self) -> int:
        """
        Returns total count of stored chunks.
        """
        return self.collection.count()

# Singleton ChromaDB vector store instance
vector_store = ChromaVectorStore()
