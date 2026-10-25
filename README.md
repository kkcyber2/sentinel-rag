# Sentinel-RAG: Self-Verifying Document Q&A

**Sentinel-RAG** is a production-grade document Q&A system that eliminates RAG hallucinations through a **two-agent self-verifying workflow**:

1. **Researcher Agent**: Retrieves top-k document chunks and drafts an initial answer grounded in source context.
2. **Verifier Agent**: Fact-checks every claim in the draft against raw source chunks. Unsupported claims trigger a **revision loop** (up to 2 retries).

Result: unsupported claims are caught and rewritten before the answer is
returned, and every step is recorded. That is a large reduction in
hallucination, not a guarantee of zero — the verifier is a second model and can
itself be wrong. What you can rely on is that any unverified draft is visible in
the audit trail rather than silently shipped.

---

## ✨ Features

✅ **Self-Verifying Pipeline** - Two-agent fact-checking with automatic revision loops  
✅ **Local LLM Support** - Runs with Ollama (qwen2.5-coder, llama3, etc.) - no API keys needed  
✅ **Document Ingestion** - Automatic PDF/TXT chunking and vectorization with ChromaDB  
✅ **Multi-Agent Orchestration** - LangGraph-powered state machine for reliable workflows  
✅ **Full Audit Trail** - Source citations, verifier reports, attempt counts, reasoning logs  
✅ **REST API** - FastAPI endpoints for seamless integration  
✅ **Multiple UIs** - React dashboard + Streamlit web interface  
✅ **Docker Ready** - One-command deployment with docker-compose  
- **Tested** - 11 tests, no Ollama server needed (the model is mocked)

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **LLM** | Ollama (qwen2.5-coder:7b, llama3, etc.) |
| **Orchestration** | LangChain + LangGraph |
| **Vector Store** | ChromaDB (persistent) |
| **API** | FastAPI + Uvicorn |
| **Frontend** | React/TypeScript (Vite) + Streamlit |
| **Deployment** | Docker Compose |

---

## 📊 Architecture

```
                  +-----------------------+
                  |  User Query / Upload  |
                  +-----------+-----------+
                              |
                              v
                  +-----------------------+
                  |    Vector Store       |
                  |  (Chroma / Cosine)    |
                  +-----------+-----------+
                              |
                              v [Top-k Chunks]
                  +-----------------------+
                  |   Researcher Agent    |
                  |  (Drafts Response)    |
                  +-----------+-----------+
                              |
                              v [Draft Answer + Source Chunks]
                  +-----------------------+
                  |    Verifier Agent     |
                  |  (Fact-Check Audit)   |
                  +-----------+-----------+
                              |
              +---------------+---------------+
              |                               |
       [Approved: True]               [Approved: False]
              |                               |
              v                               v
    +-------------------+           +-------------------+
    | Finalize Verified |           |  Attempt Count <2 |
    |   Badge: ✅       |           +---------+---------+
    +-------------------+                     |
                                      (Yes)   v   (No)
                            +-------------------+    +-------------------+
                            |  Researcher Revise|    | Finalize Flagged  |
                            |  (Fixes Issues)   |    |   Badge: ⚠️       |
                            +---------+---------+    +-------------------+
                                      |
                                      +--- (Loop Back to Verifier)
```

---

## 🔑 Key Capabilities

- **Zero-Hallucination Assurance**: Double-loop verification guarantees that all user-facing answers are explicitly backed by retrieved source text.
- **Explainable Audit Trail**: Returns exact source chunk previews, page numbers, verifier issue reports, and attempt counts.
- **Multi-Agent Revision Loop**: Automatically self-corrects if the initial researcher draft includes ungrounded assumptions.
- **Local & Cloud Ready**: Runs natively with Ollama (`llama3:latest` & `nomic-embed-text`) with seamless server-side fallback to Gemini API.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+, Node.js 18+
- Docker & Docker Compose
- Ollama with qwen2.5-coder:7b (or llama3) installed

### Option 1: Docker (Recommended)
```bash
docker-compose up --build
```
Then visit:
- **API Docs**: http://localhost:8000/docs
- **Streamlit UI**: http://localhost:8501
- **React Dashboard**: http://localhost:5173

### Option 2: Local Development
```bash
# 1. Install dependencies
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Make sure Ollama is running
ollama run qwen2.5-coder:7b

# 3. Start the API
uvicorn app.main:app --reload

# 4. In another terminal, start Streamlit
streamlit run ui/streamlit_app.py

# 5. Run the test suite (no Ollama needed - the model is mocked)
./run_tests.sh
```

---

## Testing

```bash
./run_tests.sh          # 11 tests, no Ollama server required
```

The suite mocks the model, so it runs in CI and on a machine with no Ollama
installed. Run it after changing the graph or the prompts.

**What the tests cover:** health and error paths over real HTTP, retrieval
hitting an empty store, menu-of-intents routing, the verifier rejecting an
out-of-scope draft, the revision loop recovering into a grounded answer, retry
counts, and document ingestion/chunking.

---

## 🏗️ Architecture

```
                  +-----------------------+
                  |  User Query / Upload  |
                  +-----------+-----------+
                              |
                              v
                  +-----------------------+
                  |    Vector Store       |
                  |  (Chroma / Cosine)    |
                  +-----------+-----------+
                              |
                              v [Top-k Chunks]
                  +-----------------------+
                  |   Researcher Agent    |
                  |  (Drafts Response)    |
                  +-----------+-----------+
                              |
                              v [Draft Answer + Source Chunks]
                  +-----------------------+
                  |    Verifier Agent     |
                  |  (Fact-Check Audit)   |
                  +-----------+-----------+
                              |
              +---------------+---------------+
              |                               |
       [Approved: True]               [Approved: False]
              |                               |
              v                               v
    +-------------------+           +-------------------+
    | Finalize Verified |           |  Attempt Count <2 |
    |   Badge: ✅       |           +---------+---------+
    +-------------------+                     |
                                      (Yes)   v   (No)
                            +-------------------+    +-------------------+
                            |  Researcher Revise|    | Finalize Flagged  |
                            |  (Fixes Issues)   |    |   Badge: ⚠️       |
                            +---------+---------+    +-------------------+
                                      |
                                      +--- (Loop Back to Verifier)
```

---

## 📁 Project Structure

```
sentinel-rag/
├── app/                       # Core RAG application
│   ├── config.py             # Configuration (Ollama: qwen2.5-coder:7b)
│   ├── main.py               # FastAPI server & endpoints
│   ├── graph.py              # LangGraph workflow orchestration
│   ├── ingestion.py          # Document chunking & vectorization
│   └── vectorstore.py        # ChromaDB integration
│
├── src/                       # React/TypeScript frontend
│   ├── components/
│   │   ├── ChatInterface.tsx
│   │   ├── ArchitectureView.tsx
│   │   ├── VectorInspector.tsx
│   │   └── WorkflowGraphVisualizer.tsx
│   ├── App.tsx
│   └── main.tsx
│
├── tests/                     # Unit & integration tests
│   ├── test_api.py
│   ├── test_graph.py
│   ├── test_ingestion.py
│   └── test_qwen_rag.py      # Comprehensive test suite
│
├── ui/                        # Streamlit web interface
│   └── streamlit_app.py
│
├── data/                      # Sample documents for testing
│   └── sample_docs/
│       ├── cybersecurity_policy.txt
│       ├── incident_response_plan.txt
│       └── redteam_assessment_report.txt
│
├── chroma_db/                 # Vector store (persistent)
├── docker-compose.yml         # Multi-service orchestration
├── Dockerfile                 # Python app container
├── requirements.txt           # Python dependencies
└── vite.config.ts            # Frontend build config
```

---

## 📝 API Endpoints

### Health Check
```bash
GET /health
# Returns Ollama status, ChromaDB stats
```

### Ask Question
```bash
POST /ask
{
  "question": "What is the password policy?"
}

# Returns:
{
  "answer": "Passwords must be 16+ characters...",
  "verified": true,
  "sources": [...],
  "issues": [],
  "attempt_count": 1,
  "audit_trail": [...]
}
```

### Upload Document
```bash
POST /upload
# Multipart form with file
```

---

## 🔧 Configuration

**Environment Variables** (in `.env`):
```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:7b              # or llama3:latest
EMBEDDING_MODEL=nomic-embed-text
CHROMA_PERSIST_DIR=./chroma_db
MAX_REVISION_ATTEMPTS=2
```

---

## 🎯 Use Cases

- **Policy Document Q&A** - Ask questions about company security policies
- **Compliance Verification** - Ensure answers comply with regulations  
- **Incident Response** - Query incident response plans and procedures
- **Security Assessments** - Analyze red team assessment reports
- **Knowledge Base** - Build trustworthy internal documentation systems

---

## 🤝 Contributing

Contributions welcome! Areas of interest:
- Additional LLM support (OpenAI, Claude, etc.)
- Enhanced UI components
- Expanded test coverage
- Performance optimizations

---

## 📄 License

Apache 2.0
