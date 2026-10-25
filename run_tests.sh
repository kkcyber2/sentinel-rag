#!/bin/bash
# Run the suite locally. No Ollama server is needed: the tests mock the model.
set -e
cd "$(dirname "$0")"
export PYTHONPATH="$PWD"
exec python -m pytest tests/ "$@"
