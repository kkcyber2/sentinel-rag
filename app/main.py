import os
import tempfile
import urllib.request
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.config import OLLAMA_BASE_URL, OLLAMA_MODEL
from app.vectorstore import vector_store
from app.ingestion import ingest_file
from app.graph import run_sentinel_workflow

app = FastAPI(
    title="Sentinel-RAG API",
    description="Self-Verifying Document Q&A with LangChain, LangGraph, and ChromaDB",
    version="2.0.0"
)

class QuestionRequest(BaseModel):
    question: str

class AskResponse(BaseModel):
    answer: str
    verified: bool
    sources: List[Dict[str, Any]]
    issues: List[str]
    attempt_count: Optional[int] = 0
    audit_trail: Optional[List[Dict[str, Any]]] = []

@app.get("/health")
def health_check():
    """
    Checks ChromaDB vector store status and pings Ollama daemon.
    """
    ollama_reachable = False
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL.rstrip('/')}/api/tags")
        with urllib.request.urlopen(req, timeout=2) as resp:
            if resp.status == 200:
                ollama_reachable = True
    except Exception:
        ollama_reachable = False

    return {
        "status": "ok",
        "vector_store": {
            "chunk_count": vector_store.count(),
            "engine": "ChromaDB"
        },
        "ollama": {
            "base_url": OLLAMA_BASE_URL,
            "reachable": ollama_reachable,
            "model": OLLAMA_MODEL
        }
    }

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Uploads a document file (.pdf or .txt) and ingests it into ChromaDB vector database.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename missing.")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".txt", ".pdf"]:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .pdf or .txt")

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        added_chunks = ingest_file(tmp_path, custom_filename=file.filename)
        os.remove(tmp_path)

        return {
            "status": "success",
            "filename": file.filename,
            "chunks_added": added_chunks,
            "total_chunks": vector_store.count()
        }
    except Exception as e:
        if "unreachable" in str(e).lower() or "ollama" in str(e).lower():
            raise HTTPException(
                status_code=503,
                detail=f"Service Unavailable: Vector embedding failed because Ollama service is unreachable. {str(e)}"
            )
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@app.post("/ask", response_model=AskResponse)
def ask_question(request: QuestionRequest):
    """
    Executes Sentinel-RAG LangGraph multi-agent workflow (Researcher -> Verifier -> Revise -> Finalize).
    """
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    if vector_store.count() == 0:
        raise HTTPException(
            status_code=400,
            detail="No documents ingested yet. Please upload a PDF or TXT document first."
        )

    try:
        result = run_sentinel_workflow(question)
        return AskResponse(
            answer=result["answer"],
            verified=result["verified"],
            sources=result["sources"],
            issues=result["issues"],
            attempt_count=result.get("attempt_count", 0),
            audit_trail=result.get("audit_trail", [])
        )
    except Exception as e:
        err_msg = str(e)
        if "unavailable" in err_msg.lower() or "unreachable" in err_msg.lower() or "connection" in err_msg.lower():
            raise HTTPException(
                status_code=503,
                detail=f"Service Unavailable: {err_msg}"
            )
        raise HTTPException(status_code=500, detail=f"Workflow execution error: {err_msg}")

@app.post("/reset")
def reset_store():
    """
    Clears ChromaDB vector store.
    """
    vector_store.clear()
    return {"status": "cleared", "total_chunks": 0}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
