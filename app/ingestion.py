import os
from typing import List, Dict, Any

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter

from app.config import CHUNK_SIZE, CHUNK_OVERLAP
from app.vectorstore import vector_store

def get_text_splitter(chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP) -> RecursiveCharacterTextSplitter:
    """
    Returns configured LangChain RecursiveCharacterTextSplitter.
    """
    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""]
    )

def recursive_character_text_splitter(text: str, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP) -> List[str]:
    """
    Splits text into chunks using LangChain RecursiveCharacterTextSplitter.
    """
    splitter = get_text_splitter(chunk_size, chunk_overlap)
    return splitter.split_text(text)

def ingest_file(file_path: str, custom_filename: str = None) -> int:
    """
    Ingests a PDF or TXT file using LangChain text splitters,
    extracts metadata, and adds embeddings into ChromaDB vector store.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    filename = custom_filename or os.path.basename(file_path)
    file_ext = os.path.splitext(file_path)[1].lower()

    raw_text_pages = []

    if file_ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            raw_text_pages.append((1, f.read()))
    elif file_ext == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            for idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                if text.strip():
                    raw_text_pages.append((idx + 1, text))
        except Exception:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                raw_text_pages.append((1, f.read()))
    else:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            raw_text_pages.append((1, f.read()))

    splitter = get_text_splitter(CHUNK_SIZE, CHUNK_OVERLAP)
    documents_to_add = []
    global_chunk_index = 0

    for page_num, page_text in raw_text_pages:
        if not page_text.strip():
            continue
        
        chunks = splitter.split_text(page_text)
        
        for chunk in chunks:
            if not chunk.strip():
                continue
            global_chunk_index += 1
            documents_to_add.append({
                "text": chunk,
                "metadata": {
                    "source": filename,
                    "page": page_num,
                    "chunk_index": global_chunk_index
                }
            })

    added_count = vector_store.add_documents(documents_to_add)
    return added_count
