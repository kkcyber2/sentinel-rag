FROM python:3.11-slim

WORKDIR /app

# Copy project files
COPY requirements.txt .
COPY app/ app/
COPY tests/ tests/
COPY data/ data/

# Install dependencies with flexible versions to avoid conflicts
RUN pip install --no-cache-dir \
    langchain \
    langchain-community \
    langchain-ollama \
    langchain-text-splitters \
    chromadb \
    fastapi \
    uvicorn \
    streamlit \
    pypdf \
    pydantic \
    requests \
    pytest \
    httpx \
    python-dotenv

# Expose ports
EXPOSE 8000 8501

# Default to running the API
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
