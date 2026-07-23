import os

# Ollama / LLM Settings
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

# Gemini API Fallback Settings (for Cloud Run / CI environments)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Chunking & Retrieval Parameters
CHUNK_SIZE = 500
CHUNK_OVERLAP = 75
TOP_K_RESULTS = 4

# Chroma Vector Store
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
COLLECTION_NAME = "sentinel_docs"

# Multi-Agent Workflow Controls
MAX_REVISION_ATTEMPTS = 2
