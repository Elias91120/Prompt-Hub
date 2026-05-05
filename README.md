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

## Authentification (Supabase)

Prompt Hub utilise **Supabase Auth** (projet `fjhdsmrsangexacypkxb`, AWS `eu-west-1`)
avec inscription par e-mail + mot de passe et lien de confirmation.

### Configuration Dashboard Supabase (à faire une fois manuellement)

1. **Auth → Providers → Email**
   - Activer « Enable Email provider »
   - Activer « Confirm email » (vérification obligatoire avant connexion)
2. **Auth → URL Configuration**
   - `Site URL` : `https://<votre-domaine-prod>` (ex. `https://prompt-hub.vercel.app`)
   - `Redirect URLs` (un par ligne) :
     - `http://localhost:6052/auth/callback`
     - `https://<votre-domaine-prod>/auth/callback`
3. **Settings → API**
   - Copier la **Project URL** → `VITE_SUPABASE_URL`
   - Copier la clé **`anon` / `publishable`** → `VITE_SUPABASE_ANON_KEY`
   - Copier le **JWT Secret** (section « JWT Settings ») → `SUPABASE_JWT_SECRET` (backend)

### Variables d'environnement

Frontend (`frontend/.env.local`) :

```env
VITE_SUPABASE_URL=https://fjhdsmrsangexacypkxb.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
```

Backend (`backend/.env` + Render) :

```env
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase-settings
SUPABASE_URL=https://fjhdsmrsangexacypkxb.supabase.co
```

### Modèle de propriété

- Chaque projet a une colonne `owner_id` (uuid → `auth.users.id`) et `is_demo` (bool).
- Les projets créés avant l'introduction de l'auth sont marqués `is_demo = true`,
  visibles en lecture par tous mais non modifiables.
- Les nouvelles créations exigent une session authentifiée.

## License

© Webgen — https://web-gen-lyart.vercel.app
