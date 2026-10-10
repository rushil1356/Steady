# Steady

A Gemini-first voice medication companion for older adults, as two mobile apps (patient and caregiver): Steady reminds, fades its reminders as the habit forms, listens to short spoken check-ins, and silently texts the caregiver when something sounds off. Built with Gemini and ElevenLabs at HackRU Fall 2026.

## Repo layout

| Path | What's there | Owner |
|---|---|---|
| `contracts/` | Every API payload, as example JSON. The source of truth. | Rushil |
| `backend/app/ai/`, `backend/app/voice/` | Gemini, ElevenLabs and Twilio calls | Rushil |
| `backend/` (everything else) | FastAPI app, database, fading engine, alerts, seed data | Samarth |
| `frontend/` | Patient app (`/patient`) and caregiver app (`/caregiver`), both mobile | Aniketh |
| `docs/team/` | Each person's workflow and the team's git rules | Each person |

Read `docs/team/workflow-<your-name>.md` before your first commit.

## Run it

Needs Python 3.11+ and Node 20+.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                  # USE_MOCKS=1 works with no keys
uvicorn app.main:app --reload --port 8000

cd ../frontend
npm install && npm run dev                            # http://localhost:5173

# phones need HTTPS for mic and camera; put the printed URL in PUBLIC_BASE_URL
cloudflared tunnel --url http://localhost:5173
```
