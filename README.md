# Prompt Hub

AI-assisted project planning tool — visual plans, contextual prompt generation, and feedback loops.

**Built by [Webgen](https://web-gen-lyart.vercel.app)**

## Structure

```
prompt-hub/
├── frontend/   # React + Vite + Tailwind + TypeScript
├── backend/    # Python + FastAPI + Pydantic AI + Mistral
└── context/    # Project context docs (design reference)
```

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Linux/macOS
# .venv\Scripts\activate       # Windows
pip install -e ".[dev]"
```

Create a `.env` file (or copy `.env.example`):

```env
MISTRAL_API_KEY=your-mistral-api-key
```

Start the server:

```bash
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` requests to the backend on port 8000.

## Scripts

| Command | Location | Purpose |
|---------|----------|---------|
| `npm run dev` | frontend/ | Start Vite dev server |
| `npm run lint` | frontend/ | ESLint |
| `npm run format` | frontend/ | Prettier |
| `uvicorn app.main:app --reload` | backend/ | Start FastAPI dev server |
| `ruff check .` | backend/ | Lint Python |
| `ruff format .` | backend/ | Format Python |

## License

© Webgen — https://web-gen-lyart.vercel.app
