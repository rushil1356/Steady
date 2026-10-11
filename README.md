# Steady

A voice medication companion for older adults, as two phone-first web apps: one for the patient, one for their caregiver.
Steady reminds, then **fades its reminders as the habit forms**. It runs a short spoken check-in, **listens** to how the
patient sounds, and **silently texts the caregiver** when something is off. Built at HackRU Fall 2026 with Gemini,
ElevenLabs and Twilio.

## What it does

**Patient app (`/patient`)**
- Shows today's medicines and the next dose; speaks a reminder when one is due; swipe up to confirm.
- A short check-in chat with Steady ("How are you feeling?"), by voice or typing, with live captions.
- English (default) or Hindi. Large text and buttons, one thing on screen at a time.
- Never shows scores, tiers or alerts. The closing line is a warm thank-you; only a red-flag check-in tells the patient to call 911.

**Caregiver app (`/caregiver`)**
- **Profile:** patient and caregiver details, language, interests, and the patient's consent to share check-in notes.
- **Scan:** photograph the medicine bottles; Gemini reads the labels into a schedule you review and confirm (or add by hand).
- **Home / Today:** adherence, mood trend, how reminders are fading, and the day's doses.
- **Alerts:** a silent alert plus an SMS, and each check-in with "How Steady understood it" (symptoms, tone, reasons, English translation).

**How reminders fade:** every medicine has a level from 1 (full spoken reminder) to 4 (silent). Taking a dose without
being prompted moves it toward silent; missing doses brings reminders back. High-risk medicines can be set to always remind.

## How the sponsor tech is used

| Tech | Used for |
|---|---|
| **Gemini** | Reads medicine labels from photos; **listens to the check-in recording** (not only the transcript) to judge symptoms, tone and urgency; writes the opening line and the closing reply; translates for the caregiver. |
| **ElevenLabs** | Steady's voice (text to speech) and speech to text for check-ins. |
| **Twilio** | The silent SMS to the caregiver, with a link to the Alerts tab. |

## Architecture

```
frontend/  React 19 + Vite + Tailwind (patient and caregiver apps, one codebase)
backend/   FastAPI + SQLModel (SQLite)
  app/ai/       Gemini calls (label reading, check-in analysis, openers, translation)
  app/voice/    ElevenLabs speech and Twilio SMS
  app/engine/   scheduling, reminder fading, alert rules
contracts/ every API payload as example JSON (the source of truth); contracts/api.md lists the endpoints
```

## Run it

Needs Python 3.11+ and Node 20+.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env     # USE_MOCKS=1 runs everything on example data with no keys; set 0 and add keys for real calls
uvicorn app.main:app --port 8000

cd ../frontend
npm install && npm run dev                            # http://localhost:5173

# Phones need HTTPS for the microphone and camera. Put the printed URL in PUBLIC_BASE_URL (backend/.env), then restart the backend.
cloudflared tunnel --url http://localhost:5173
```

Keys go in `backend/.env` (never committed): `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. See `backend/.env.example`.
Twilio trial accounts can only text verified numbers.

Tests: `cd backend && pytest`

## Demo

Open `/patient` and `/caregiver` on two phones. In the demo box on the patient app: **Start fresh**, set up the profile and
medicines on the caregiver phone, tap **Load sample history** (adds two weeks of example history so the dashboard charts are populated and "dizzy again" is recognised as a repeat), **Fast-forward to next dose**, swipe to confirm, then say "I took my medicine, but I feel very
dizzy." The caregiver phone gets the text and the alert appears within seconds. **Two weeks later** shows the reminders fading.

## Honest limits

- One patient and one caregiver per install, no login. Multi-household pairing is the next step.
- A new profile starts with an empty dashboard. The 30-day numbers and mood trend only appear after **Load sample history** in the demo box, and they are example data, not real use.
- Steady is a wellness companion, not a medical device. Its observations are not diagnoses.
- Check-in wording and the medicine "Know more" notes are AI-generated and should be reviewed by a clinician before real use.

## Team

Rushil (AI, voice, SMS, integration), Samarth (backend, scheduling and alert engine), Aniketh (frontend and design).
Git rules and each person's workflow are in `docs/team/`.
