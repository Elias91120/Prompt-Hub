# Prompt Hub Backend

FastAPI + Pydantic AI backend, powered by **Mistral AI**.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate      # Linux/macOS
# .venv\Scripts\activate       # Windows
pip install -e ".[dev]"
```

## Configuration

Copy the `.env.example` at the project root and fill in your Mistral API key:

```bash
cp .env.example .env
# Edit .env and set MISTRAL_API_KEY=your-key-here
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MISTRAL_API_KEY` | *(required)* | Your Mistral AI API key |
| `PROMPTHUB_BASE_URL` | `https://api.mistral.ai/v1` | OpenAI-compatible endpoint |
| `PROMPTHUB_MODEL` | `mistral-large-latest` | Model name |

> The backend talks to any **OpenAI-compatible** chat-completions endpoint.
> You can point `PROMPTHUB_BASE_URL` at Ollama, LM Studio, vLLM, or any
> other provider — only the URL and model name change.

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

## Lint & Format

```bash
ruff check .
ruff format .
```

## Tests

```bash
pytest
```
