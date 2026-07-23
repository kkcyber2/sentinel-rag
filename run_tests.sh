#!/bin/bash
# Test runner script for Sentinel RAG

echo "🔧 Starting test suite with qwen2.5-coder:7b..."
echo "=================================================="

# Set environment
export PYTHONPATH=/app
export OLLAMA_MODEL=qwen2.5-coder:7b
export OLLAMA_BASE_URL=http://ollama:11434

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama service..."
sleep 5

# Check Ollama connection
if ! curl -s http://ollama:11434/api/tags > /dev/null; then
    echo "❌ Ollama service not reachable at http://ollama:11434"
    exit 1
fi

echo "✅ Ollama service is ready"
echo ""

# Run tests
echo "📋 Running unit tests..."
python -m pytest tests/ -v --tb=short

echo ""
echo "=================================================="
echo "✅ Test run complete!"
