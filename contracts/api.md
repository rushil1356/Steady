# Steady API contract

The files in `examples/` are the source of truth for every payload. `backend/app/contracts.py` mirrors them as Pydantic models, and a test checks that every example still parses. Aniketh generates frontend types from the backend's `/openapi.json`.

**Frozen after H1.** From then on, change only by **adding optional fields**, and post `CONTRACT CHANGE:` in the team chat first. Renaming or removing a field needs all three of us to agree.

## Two apps, one backend

Steady is two phone apps served by one Vite frontend and one FastAPI backend:

- **Patient app** at `/patient`: language choice, home, reminder and swipe-to-confirm, check-in, "Know more".
- **Caregiver app** at `/caregiver`, with bottom tabs **Today**, **Alerts**, **Scan** and **Profile**. Setup (profile, sharing consent, scanning bottles) happens here, on the caregiver's phone. The alert SMS links to `/caregiver#alerts`.

There is one patient and one caregiver per install, and no login (a hackathon demo). Both apps run on phones over the HTTPS tunnel, because phones only allow the microphone and live camera on secure pages.

## Endpoints

| Method | Path | Request | Response example | Model in `contracts.py` |
|---|---|---|---|---|
| GET | `/api/profile` | | `profile.json` | `Profile` |
| PUT | `/api/profile` | `profile.json` | `profile.json` | `Profile` |
| POST | `/api/setup/extract` | multipart, field `images` (1–6 photos from the caregiver's phone camera) | `extracted_meds.json` | `ExtractResponse` |
| GET | `/api/languages` | | `languages.json` | `LanguagesResponse` |
| PUT | `/api/patient/language` | `language.json` | `language.json` | `LanguageBody` |
| POST | `/api/setup/confirm` | `setup_confirm_request.json` (optional `language`) | `setup_confirm.json` | `ConfirmRequest` → `ConfirmResponse` |
| PUT | `/api/patient/interests` | `interests.json` | `interests.json` | `InterestsBody` |
| GET | `/api/patient/today` | | `today.json` | `Today` |
| GET | `/api/meds/{med_id}/info` | | `med_info.json` | `MedInfo` |
| POST | `/api/doses/{dose_id}/confirm` | `{"prompted": true}` | `dose_confirm.json` | `DoseConfirmRequest` → `DoseConfirmResponse` |
| GET | `/api/checkins/prompt` | | `checkin_prompt.json` | `CheckinPrompt` |
| POST | `/api/checkins` | multipart field `audio`, **or** JSON `{"text": "..."}` | `checkin_result.json` | `CheckinTextBody` → `CheckinResult` |
| GET | `/api/caregiver/dashboard` | | `dashboard.json` | `Dashboard` |
| GET | `/api/alerts/latest` | | `alerts_latest.json` | `AlertsLatest` |
| POST | `/api/alerts/{alert_id}/handled` | | `ok.json` | `OkResponse` |
| POST | `/api/demo/clock` | `{"time": "20:00"}` | `demo_clock.json` | `DemoClockRequest` → `DemoClockResponse` |
| POST | `/api/demo/two-weeks-later` | | `ok.json` | `OkResponse` |
| POST | `/api/demo/reset` | | `ok.json` | `OkResponse` |

`spoken.json` is the shape of every piece of speech (`Spoken`), and `analysis.json` is what `ai.analyze_checkin` returns (`Analysis`).

## Conventions

- **Times of day** are 24-hour `"HH:MM"` strings, such as `"20:00"`.
- **Date-times** are ISO 8601 local time without a timezone, such as `"2026-10-09T20:00:00"`. The backend's demo clock decides "now".
- **Tiers** are `"green"`, `"yellow"` or `"red"`.
- **Reminder levels** run from 1 (full spoken reminder) to 4 (silent monitoring). Higher means less support.
- **Dose status** is `"upcoming"`, `"due"`, `"taken"` or `"missed"`. **Calendar status** is `"ontime"`, `"late"` or `"missed"`.
- **Audio:** `audio_url` is a path under `/static/` (FastAPI serves `backend/static/`), or `null`. When it's `null`, the frontend speaks `text_en` with the phone's own voice.
- **Profile:** the caregiver fills it in at setup. `patient.preferred_name` is what Steady calls the patient out loud; nothing in the code has a default name. `caregiver.phone` is where alert texts go. `sharing_consent` must be `true` before setup can finish, because alerts are silent: `PUT /api/profile` with `setup_complete: true` and `sharing_consent: false` returns 400. The profile's `patient.language` and `patient.interests` are the same stored values that `PUT /api/patient/language` and `PUT /api/patient/interests` change.
- **No pronouns.** Text about the patient uses the preferred name ("Asha took both evening pills"), never he/she.
- **Language:** the patient's communication preference is set in the profile (and can be changed on the patient's own phone with `PUT /api/patient/language`), from `/api/languages`. Every `Spoken` carries `lang` (the patient's language code), `text_en`, and `text_local` (the text in that language, or `null` for English). When the language's `spoken` is `false`, the audio is English and `text_local` is the caption.
- **The closing line the patient hears never mentions the caregiver, alerts or reports.** Alerts go to the caregiver silently. The only exception: a red tier tells the patient to call 911 or get help nearby.
- **How Steady understood it:** `Analysis.why` (1–3 short reasons), `tone_note` and `heard_audio` come from Gemini and are shown in the caregiver app's Alerts tab. Show only these real fields: no made-up scores such as pitch in Hz or "% match".
- **Polling:** the caregiver app calls `GET /api/alerts/latest` every 3 seconds while open. When `latest_checkin_id` changes, refetch the dashboard. Twilio reports only sent or failed, so show "Text sent" and never "Read".
