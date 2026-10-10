# Samarth: Backend lead

**Your job:** the API, the database, the profile, the demo clock, the fading engine, the alert rules, the dashboard numbers and the demo data. Your routes are the only thing the two frontend apps (patient `/patient` and caregiver `/caregiver`) talk to, and the only place Rushil's AI and voice functions get called.

**H0 = the moment hacking officially starts.** All times are hours from then.

**Track:** Gemini is our main track; we're also going for the ElevenLabs and UI/UX superlatives. For you that means Gemini really listens to the check-in recording, so pass the audio through (see the check-in pipeline).

---

## What you own

| You own | You never edit (ask the owner) |
|---|---|
| Everything in `backend/` except Rushil's folders: `main.py`, `config.py`, `contracts.py`, `mocks.py`, `db.py`, `models.py`, `routers/`, `engine/`, `clock.py`, `seed.py`, `tests/` (except `test_ai_*.py`), `requirements.txt`, `.env.example` after H0 | `backend/app/ai/`, `backend/app/voice/`, `backend/app/prompts/`, `backend/static/demo-audio/` (Rushil) |
| `.github/` (CI) | `contracts/` (Rushil; you mirror it in `contracts.py`) |
| | Anything in `frontend/` (Aniketh) |

Rushil's H0 scaffold already contains `app/contracts.py` (yours from then on) and working `ai/` and `voice/` modules that return example data in mock mode. **Don't write stubs**; just call them.

**No default names, no pronouns.** Nothing in the backend hard-codes a patient or caregiver name. Every name comes from the profile (`profile.patient.preferred_name`, `profile.caregiver.name`). Text about the patient uses the preferred name or "the patient", never he/she.

---

## Before H0:20

Install Python 3.11+. Wait for Rushil's **"Scaffold is up."** Then clone, copy `backend/.env.example` to `backend/.env`, and keep `USE_MOCKS=1`.

---

## H0:20 to H1:30: Backend skeleton (top priority)

This unblocks both teammates, so ship it before anything else. Branch: `samarth/skeleton`.

```
backend/
  requirements.txt
  app/
    main.py          # FastAPI app, CORS, StaticFiles at /static, includes EVERY router below
    config.py        # pydantic-settings Settings; one field per key in .env.example
    contracts.py     # ALREADY IN THE SCAFFOLD: every request/response model. You own it now.
    mocks.py         # load(name) -> dict, reads ../contracts/examples/<name>.json
    db.py            # SQLModel engine from DATABASE_URL, get_session()
    models.py
    clock.py
    routers/   profile.py  setup.py  patient.py  meds.py  doses.py  checkins.py  caregiver.py  alerts.py  demo.py
    engine/    fading.py  alerts.py  doses.py
    ai/  voice/  prompts/    # ALREADY IN THE SCAFFOLD (Rushil). Don't edit.
  static/audio/.gitkeep
  static/demo-audio/.gitkeep
  seed.py
  tests/test_smoke.py
```

**`main.py` router registration:** include every router at H0:20, including `profile` (`GET/PUT /api/profile`) and `alerts` (`GET /api/alerts/latest` and `POST /api/alerts/{alert_id}/handled`). No new routers after that.

**`requirements.txt`** (put in everything the team will need, so nobody edits it later):

```
fastapi
uvicorn[standard]
sqlmodel
pydantic-settings
python-multipart
python-dotenv
httpx
google-genai
elevenlabs
twilio
imageio-ffmpeg
pytest
ruff
```

`imageio-ffmpeg` ships an ffmpeg binary inside the wheel. Rushil's `ai/` uses it to turn phone recordings (WebM from Android/Chrome, MP4 from iPhone) into WAV so Gemini can listen. No system install needed.

**Every route returns its example from `contracts/examples/` through its Pydantic model.** That validates the examples against your models and gives Aniketh real URLs from H1:30. The endpoint-to-example mapping is in `contracts/api.md`.

**Calling Rushil's functions** (`from app import ai, voice`). Load the profile first; `profile` below means the saved `Profile` row.

| Call | Notes |
|---|---|
| `ai.extract_schedule(images)` | Returns `[]` if nothing could be read. Return that; the Scan tab lets the caregiver add rows by hand. |
| `ai.reminder_text(med, level, patient_name=profile.patient.preferred_name)` | Then pass the text to `voice.say(text, profile.patient.language)`. With an empty name the line just starts without one. |
| `ai.write_opener(profile.patient.interests, "evening")` | May return `None`. Cached per day and part of day, so Home and Check-in show the same line. `OPENER_SEARCH=1` lets it use Google Search grounding; nothing changes for you. |
| `ai.analyze_checkin(transcript, meds, history, audio=audio_bytes, patient_name=profile.patient.preferred_name, lang=profile.patient.language, part_of_day="evening", caregiver_name=profile.caregiver.name)` | `history` = `PastCheckin`s from the last 7 days. `audio` = the raw uploaded bytes (or `None` for typed text); Gemini listens to it. It never raises. `analysis.transcript_en` is the answer in English; use it for the dashboard `quote_en`. `caregiver_name` keeps the caregiver out of the closing line. |
| `ai.simplify_label(med_name)` | Already cached on disk per drug. You can still store it in `MedInfo`. |
| `voice.say(text_en, lang)` | Returns `Spoken`; `audio_url` may be `None` (the frontend speaks `text_en` with the phone's voice). Always pass `profile.patient.language`. |
| `voice.transcribe(audio, mime, profile.patient.language)` | Returns `""` if it heard nothing. Treat that as an empty answer: reply "I didn't catch that" and don't create an alert. |
| `ai.list_languages()`, `ai.is_supported(code)` | For `GET /api/languages` (13 languages), and to validate `PUT /api/patient/language` and the language in `PUT /api/profile` (400 on an unknown code). `TTS_SPOKEN_LANGS` decides which are spoken aloud; the rest get captions with an English voice. Not your logic; it's already in `Language.spoken`. |
| `voice.send_sms(profile.caregiver.phone, voice.alert_body(tier, summary))` | Returns `True` or `False`; never raises. `alert_body` links to `<PUBLIC_BASE_URL>/caregiver#alerts`, so the text opens the Alerts tab. `CAREGIVER_PHONE` in `.env` is only a fallback when the profile has no phone. |
| `from app.prompts import CHECKIN_QUESTION` | Use `CHECKIN_QUESTION["evening"]` (or `["morning"]`) as the question text, so the pre-generated audio is reused. |

All of these run in mock mode with no keys (`USE_MOCKS=1`).

**CORS / proxy:** both apps load from Vite, and Vite proxies `/api` and `/static` to `localhost:8000`, through the tunnel too. So every request reaches you as same-origin from localhost. CORS only needs `http://localhost:5173`; adding `PUBLIC_BASE_URL` is harmless but not required. Run uvicorn on localhost; you never need a public backend URL for the live demo.

**`tests/test_smoke.py`:** with `USE_MOCKS=1`, call every endpoint through FastAPI's `TestClient`, then assert a 200 status and that the response parses into its contract model. **This test keeps the three of you in sync.** Everyone runs it before every backend PR.

**Done when:** `uvicorn` starts, `/docs` lists all 18 endpoints, and the smoke test passes. Merge it, then post **"Backend skeleton merged. Mock API is live."**

---

## H1:30 to H2: CI (optional, about 15 minutes)

`.github/workflows/checks.yml` runs on every PR, so a broken merge is caught before it lands:

```yaml
name: checks
on: [pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: backend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r requirements.txt
      - run: USE_MOCKS=1 pytest -q
  frontend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npm run build
```

Add the frontend job only after Aniketh's skeleton merges, or it fails on a missing folder.

---

## H2 to H3: Data model, profile and setup routes

```
Profile     id (always 1: one row per install),
            patient_full_name, patient_preferred_name, patient_phone, patient_language,
            patient_interests (JSON list),
            caregiver_name, caregiver_relationship, caregiver_phone,
            sharing_consent, setup_complete
Patient     id, fading_enabled          # names, language and interests live on Profile
Medication  id (slug, e.g. "med_metoprolol"), patient_id, name, dose, times (JSON list of "HH:MM"),
            purpose, look, color, high_risk, always_remind, level, streak
Dose        id, medication_id, scheduled_at, status (upcoming | due | taken | missed),
            prompted, confirmed_at
CheckIn     id, patient_id, created_at, transcript, transcript_en, analysis (JSON), tier, mood_score,
            symptoms (JSON list), why (JSON list), tone_note, heard_audio
Alert       id, patient_id, checkin_id (nullable), tier, title, summary, note,
            created_at, sms_sent, handled
MedInfo     med_name (primary key), payload (JSON), fetched_at
```

Keep the full `Analysis` JSON too, but store `why`, `tone_note`, `heard_audio`, `transcript_en` and `symptoms` as their own columns so the dashboard's `CheckinRow` and `ActiveAlert` (and `GET /api/alerts/latest`) can return them without re-parsing.

- **`GET /api/profile`:** return the `Profile` row as the `Profile` model. Before setup there's no row: return an empty profile with `setup_complete: false` (empty strings, no made-up names), so the caregiver app opens the Profile tab as its first-run flow.
- **`PUT /api/profile`:** save the whole profile. Validate `patient.language` with `ai.is_supported`. **Setup can't complete without consent:** if the request has `setup_complete: true` but `sharing_consent` isn't `true`, return 400 ("Sharing consent is required, because alerts are silent"). Return the saved profile.
- `POST /api/setup/extract`: pass the uploaded images (1–6 photos from the Scan tab) to `ai.extract_schedule`. Don't save anything.
- `GET /api/languages`: return `ai.list_languages()`.
- `PUT /api/patient/language`: save the patient's communication preference to `Profile.patient_language` (the patient can change it from the patient app). Every spoken line from then on uses it. Reject unknown codes with `ai.is_supported`.
- `POST /api/setup/confirm`: save the medications, plus `language` if it's sent. Copy `always_remind` from whatever the caregiver ticked.
- `PUT /api/patient/interests`: save the list to `Profile.patient_interests`.
- `GET /api/patient/today`: today's doses with status, `taken_count`, `total_count`, `next`, `thought` (from `ai.write_opener`, cached per day-part), and `patient` = `{name: preferred_name, language}`.
- `engine/doses.py`:
  - `ensure_today(now)` creates a `Dose` for each medication time today if it's missing.
  - It marks a dose `missed` once it's 2 hours past its time without being taken.

---

## H3 to H5: Fading engine

This is the part no competitor has, so make it solid and fully tested. Convention: **level 1 is the full reminder; level 4 is silent monitoring.** Keep that the same everywhere.

| Event | Rule |
|---|---|
| `always_remind` is set, or the patient's fading is off | Level stays at 1 |
| Dose taken **without** a prompt | `streak += 1`. At 5: `level = min(level + 1, 4)` and `streak = 0` |
| Dose taken **after** a prompt | `streak = 0` (the 5 must be consecutive) |
| Dose missed | `streak = 0`. If there are 2+ misses in the last 7 days: `level = 1`, plus a yellow alert "2 misses this week". Otherwise: `level = max(level - 1, 1)` |
| After any event | `independence` = share of the last 14 doses taken without a prompt, from 0 to 100 |

What each level means at dose time:

1. A full spoken reminder, repeated after 15 minutes if unconfirmed.
2. One short reminder.
3. No reminder; the check-in asks about it at the end of the dose window.
4. Nothing; the daily check-in confirms it.

**Done when:** `tests/test_fading.py` has one test per row above, and every test passes.

### H4 (15 minutes out of the fading block): Running on real phones

Both apps are mobile, and phones only allow the mic and live camera over HTTPS, so this check happens now, not at the end.

- **Live setup:** backend and frontend on one laptop, behind **one HTTPS tunnel** (`cloudflared tunnel --url http://localhost:5173`) that points at Vite. Vite proxies `/api` and `/static` to you on `localhost:8000`, so no separate public backend is needed.
- Put the tunnel URL in `backend/.env` as `PUBLIC_BASE_URL` (the SMS link uses it) and restart uvicorn.
- With Aniketh: open `/patient` on one phone and `/caregiver` on another through the tunnel. Both should show mock data from your backend, and a typed check-in should reach `POST /api/checkins`.
- **Backup deploy (later, any time after H15):** Render or Railway.
  - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  - Copy the env vars from `.env`.
  - Free tiers sleep and are slow to wake, so never depend on this during the live pitch; it's the link judges can open later.
  - SQLite on these hosts resets on every deploy; seeding on startup covers that.

**Done when:** both phones load their app over the tunnel and the H4 sync point is met.

---

## H5 to H6: Clock, fast-forward and confirm

- **`clock.py`:** `now()` returns real time, unless the demo has set a time; then it returns that. Add `set_time(hh_mm)` and `reset()`. Every part of the backend uses `clock.now()`, never `datetime.now()`.
- **`POST /api/demo/clock {"time": "20:00"}`:** set the clock, run `ensure_today`, and return the due doses that get a spoken reminder (level 1–2, or `always_remind`). Each one carries `reminder = voice.say(ai.reminder_text(med, level, patient_name=profile.patient.preferred_name), profile.patient.language)`.
- **`POST /api/doses/{dose_id}/confirm {"prompted": true}`:** mark the dose taken, run the fading engine, and return the updated medication.

---

## H6 to H8: Check-in pipeline

**`GET /api/checkins/prompt`:**
- `opener` comes from `ai.write_opener(profile.patient.interests, part_of_day)`. Skip it (return `null`) when an unhandled red alert exists.
- `question` is `CHECKIN_QUESTION["evening"]` ("How are you feeling this evening?") or `["morning"]`.
- Pass both through `voice.say(..., profile.patient.language)`.

**`POST /api/checkins`** accepts multipart `audio` (WebM from Android/Chrome, MP4 from iPhone), **or** JSON `{"text": "..."}` (the typed fallback):

1. `transcript = voice.transcribe(audio, mime, profile.patient.language)`, or the text as given.
2. `analysis = ai.analyze_checkin(transcript, meds, last_7_days_of_checkins, audio=audio_bytes, patient_name=profile.patient.preferred_name, lang=profile.patient.language, part_of_day="evening", caregiver_name=profile.caregiver.name)`. Pass the **raw audio bytes** you received (`None` for typed text); Gemini listens to the recording itself, and `analysis.heard_audio` tells you whether it did.
3. `tier = engine.alerts.decide(analysis, history, misses)`.
4. If the tier is red or yellow: create an `Alert`, call `voice.send_sms(profile.caregiver.phone, voice.alert_body(tier, summary))`, and store `sms_sent`.
5. Save the `CheckIn`, including `mood_score`, `transcript_en`, `symptoms`, `why`, `tone_note` and `heard_audio`.
6. `reply = voice.say(analysis.patient_reply_en, profile.patient.language)`.

**The alert is silent.** The patient hears only a warm closing line, a thank-you and "have a good evening" (e.g. "Thank you for telling me, Asha. Take it easy and rest well. Have a good evening."). Never add anything to the reply about the caregiver, an SMS or a report; `analyze_checkin` already guards this. Steps 3–4 happen in the background, and the caregiver sees the alert in the caregiver app and by text. The only exception is red, where `patient_reply_en` already says to call 911.

**`engine/alerts.py` `decide()`:**

- **Red** if `analysis.red_flags` isn't empty.
- **Yellow** if any symptom appears in 2+ check-ins in the last 7 days (counting this one), or there are 2+ missed doses in the last 7 days.
- **Green** otherwise.
- **The final tier is the higher of your rule and `analysis.suggested_tier`.** The AI can raise the tier, never lower it.
- Alert `title`: plain, such as "Dizziness mentioned twice this week". `summary` = `analysis.caregiver_summary`.
- Alert `note` (optional): if a reported symptom appears in a medication's cached label `side_effects`, use "Dizziness is listed as a common side effect of Metoprolol. Worth mentioning to the doctor." Otherwise leave it `null`.

**Done when:** `tests/test_alerts.py` covers red, the repeated-symptom yellow, the missed-dose yellow, green, and "the AI can raise but not lower", with the AI mocked.

---

## H8 to H10: Dashboard and alert polling from real data

Build `GET /api/caregiver/dashboard` from your tables. It feeds the caregiver app's **Today** and **Alerts** tabs. The shape must match `contracts/examples/dashboard.json`.

| Field | How to compute it |
|---|---|
| `status`, `active_alert` | Latest unhandled alert. No alert means green, "All good". `active_alert` also carries `why`, `tone_note` and `checkin_id` from the linked check-in. |
| `kpis` | Today taken/total; on-time % over 30 days (late = confirmed more than 30 min after schedule); unprompted doses this week out of the total; check-ins answered in the last 14 days |
| `mood_14d` | One score per day, from that day's check-in |
| `usual_range` | Lowest and highest mood score from the patient's first 7 check-ins |
| `unprompted_by_week` | The last 4 weeks |
| `calendar_30d` | `ontime`, `late` or `missed` for each day |
| `checkins` | Latest 5. Each `CheckinRow`: `id`, `at`, `quote` (what the patient said, in their language), `quote_en` (`transcript_en`), `tier`, a short `tag`, `symptoms`, `tone_note`, `why`, `heard_audio`. This is the "How Steady understood it" panel. |
| `medications` | Level, `always_remind`, independence, `spark_14d`, `last_taken` |
| `interests` | From `Profile.patient_interests` |

Only return real stored values. No made-up numbers (no pitch in Hz, no "% match", no "Read" time; Twilio only tells you sent or failed, which is `sms_sent`).

**`GET /api/alerts/latest`** (`AlertsLatest`, see `contracts/examples/alerts_latest.json`): `alert` = the newest unhandled alert as an `ActiveAlert` (or `null`), `latest_checkin_id` = the id of the newest check-in, and `updated_at` = `clock.now()`. The caregiver app polls this **every 3 seconds** and refetches the dashboard when `latest_checkin_id` changes, so keep it cheap: two indexed queries (`ORDER BY id DESC LIMIT 1`), no AI calls, no dashboard maths.

Also build `POST /api/alerts/{alert_id}/handled`.

### H10: Gate 1 with Rushil

Run the whole flow with `USE_MOCKS=0` on the phones: Scan photo → schedule → reminder plays → spoken check-in → SMS to `profile.caregiver.phone` → alert appears in the caregiver app within ~3 seconds. Fix together whatever breaks.

---

## H10 to H13: Seed data and demo controls

`seed.py` builds two states, with dates relative to the demo clock so the data always looks current. It uses the demo profile from `contracts/examples/profile.json`; that's the only place these names appear.

**Start state** (matches the Steady design):
- Profile: patient **Asha Patel**, preferred name "Asha", language `hi` (Hindi), interests from the example; caregiver **Ravi Patel** (Son) with the example phone; `sharing_consent: true`, `setup_complete: true`. Fading on. `reset` keeps whatever language was last picked, so the demo can show the picker.
- Four medications at level 1: Metoprolol, Warfarin (`always_remind`), Atorvastatin and Vitamin D.
- 14 days of check-ins in Hindi (with `transcript_en` filled in): mood mostly 7–8. Include a check-in 3 days ago, "दोपहर के खाने के बाद थोड़ा चक्कर आया" ("I felt a little dizzy after lunch", symptom `dizzy`), so tonight's dizziness triggers yellow by the rule.
- 30 days of doses with 3 late and 1 missed. Today's morning doses taken.

**Two weeks later state:**
- Levels: Metoprolol 2, Warfarin 1 (locked), Atorvastatin 3, Vitamin D 4.
- Independence: 64, 71, 79, 93.
- Unprompted doses by week: 6, 11, 15, 19.

Endpoints:
- `POST /api/demo/reset` loads the start state.
- `POST /api/demo/two-weeks-later` loads the second state.
- Seed the start state on startup if the database is empty.

**Done when:** reset takes under 10 seconds, and the caregiver app's Today and Alerts tabs look like the design.

---

## H13 to H15: Demo hardening

- Re-run the H4 phone check with real APIs: the patient phone and the caregiver phone side by side, the patient says "I'm dizzy", the SMS buzzes and the alert appears in the caregiver app within ~3 seconds.
- Make sure `GET /api/alerts/latest` stays fast with the seeded data (it's hit every 3 seconds per open caregiver app).
- Set up the backup deploy (see H4) if it isn't done yet.

---

## H15 to H18: Remaining routes

- **`GET /api/meds/{med_id}/info`:** call `ai.simplify_label` and cache the result in the `MedInfo` table, so each drug costs one Gemini call in total. Fill `spoken` with `voice.say(what_for + " " + how_to_take, profile.patient.language)`.
- **SMS fallback:** if `send_sms` returns `False`, keep the alert anyway. The caregiver app polls `/api/alerts/latest` every 3 seconds, so it still appears on stage.

## H18 onward: Feature freeze

`fix` PRs only. Rehearse the demo-control sequence with Rushil: reset, fast-forward to 8 PM, check-in on the patient phone, alert on the caregiver phone, two weeks later.

---

## Working in sync (identical in all three files)

### Who owns what

| Path | Owner |
|---|---|
| `.gitignore`, `.gitattributes`, `README.md`, `contracts/` | Rushil |
| `backend/app/ai/`, `backend/app/voice/`, `backend/app/prompts/`, `backend/static/demo-audio/`, `backend/scripts/pregenerate_audio.py`, `backend/requirements-extra.txt`, `backend/tests/test_ai_*.py` | Rushil |
| Everything else in `backend/` (`main.py`, `config.py`, `contracts.py`, `mocks.py`, `db.py`, `models.py`, `routers/`, `engine/`, `clock.py`, `seed.py`, `tests/`, `requirements.txt`, `.env.example` after H0), plus `.github/` | Samarth |
| `frontend/` | Aniketh |
| `docs/team/workflow-<name>.md` | That person |

**Only the owner edits a file.** Need a change in someone else's file? Message them. If it's one line and they're busy, open a PR that touches only that line and tag them.

### The seven rules

1. **Never push to `main`.** Everything goes through a pull request. The only exception is Rushil's H0 scaffold commit.
2. **Edit only files you own.**
3. **Start every task from a fresh `main`.**
4. **Keep branches short:** open the PR within 90 minutes of creating the branch.
5. **Merge `main` into your branch** at least every hour, and every time someone posts "merged".
6. **Never commit** `.env`, `*.db`, `node_modules/`, generated audio or any key.
7. **After H1, contracts change only by adding optional fields.** Renaming or removing a field needs all three of you to agree in chat first.

### Your loop for every task

```bash
# 1. Start from a fresh main
git switch main
git pull

# 2. One branch per task, named <name>/<task>
git switch -c samarth/fading-engine

# 3. Commit small and often. Stage your own paths; never `git add .`
git add backend/app/engine/fading.py backend/tests/test_fading.py
git commit -m "feat(engine): step level down after 5 unprompted doses"

# 4. Before the PR (and at least hourly), bring in everyone else's work
git fetch origin
git merge origin/main          # resolve any conflicts, then run the checks below

# 5. Push and open the PR
git push -u origin samarth/fading-engine
```

On GitHub, open the PR. Once the checks pass, click **Squash and merge**; the branch deletes itself. Then post in chat: **"Merged fading engine. Pull main."**

We merge `main` into branches instead of rebasing, so **nobody ever needs to force-push.**

Commit messages use the form `type(area): what changed`.

- Types: `feat`, `fix`, `test`, `chore`, `docs`
- Areas: `ai`, `voice`, `api`, `engine`, `db`, `ui`, `dash`, `contracts`

### Checks before every PR

- [ ] Ran `git merge origin/main`, and no conflict markers are left (`git grep -n "<<<<<<<"` prints nothing)
- [ ] If you touched the backend: `cd backend && USE_MOCKS=1 pytest -q` passes
- [ ] If you touched the frontend: `cd frontend && npm run build` passes
- [ ] You ran the app, and your feature works with everyone's latest code
- [ ] `git status` shows no `.env`, `.db`, audio cache or `node_modules`
- [ ] The PR description says what to click or call to test it

### Files that cause conflicts, and the rule for each

| File | Rule |
|---|---|
| `backend/requirements.txt` | Samarth adds every known package at H0:20. Need another? Ask Samarth. Stretch packages go in `requirements-extra.txt` (Rushil). |
| `frontend/package.json`, `package-lock.json` | Only Aniketh runs `npm install <pkg>`. Nobody hand-edits the lockfile. |
| `backend/app/main.py` | Samarth registers every router at H0:20. No new routers after that. |
| `backend/app/contracts.py`, `contracts/` | Frozen after H1. Only add optional fields, and only after posting `CONTRACT CHANGE:` in chat. |
| `backend/.env.example` | Every key is listed at H0. Adding a key? Post it in chat. |
| Formatting | Python: `ruff format` on your own files only. Frontend: Prettier on `frontend/` only. Never reformat someone else's file. |
| Line endings | `.gitattributes` forces LF, so Windows and Mac machines don't rewrite each other's lines. |

### Resolving a conflict

1. `git status` lists the conflicted files.
2. Each conflict sits between `<<<<<<<` and `>>>>>>>`. Usually you keep both sides.
3. **If the file isn't yours, stop:** run `git merge --abort` and message the owner.
4. Fix it, run `git add <file>` and `git commit`, then run the checks.
5. Stuck? `git merge --abort` puts you back where you were. Never delete someone else's code to make a conflict go away.

### Mistakes and how to undo them

| Mistake | Fix |
|---|---|
| Committed on `main` but didn't push | `git switch -c <name>/<task>` (your commits come with you), then `git switch main && git reset --hard origin/main` |
| Pushed a key or `.env` | **Revoke the key in that service immediately** and make a new one, then remove the file. Deleting the commit isn't enough. |
| A merge went wrong | `git merge --abort` |
| Lost work | `git reflog` lists every recent state; `git switch -c rescue <hash>` brings one back |

### Sync points

| When | What must be true |
|---|---|
| **H1** | Contracts frozen. The backend skeleton returns mock data for every endpoint. |
| **H4** | **Mock end to end:** both apps (`/patient` and `/caregiver`) show mock data from the real backend, on a phone, through the HTTPS tunnel. |
| **H10** | **Gate 1, real end to end on two phones:** caregiver phone scans a bottle → schedule confirmed → patient phone plays the reminder → spoken check-in → SMS on the caregiver phone and the alert in the caregiver app within about 3 seconds. If it isn't working, cut stretch goals. |
| **H14** | The caregiver app's Today and Alerts tabs show seeded history. |
| **H18** | **Feature freeze.** Only `fix` PRs from here on. |
| **H20** | Backup video recorded; `demo-v1` tag pushed. |

Every 4 hours, take 5 minutes in chat: what's done, what's blocked, what gets cut.

### API at a glance

Full shapes are in `contracts/`.

| Method | Path | What it does | Backend calls |
|---|---|---|---|
| GET | `/api/profile` | Patient + caregiver profile and consent | |
| PUT | `/api/profile` | Save the profile from caregiver setup | |
| POST | `/api/setup/extract` | Label photos from the caregiver's phone → draft schedule (not saved) | `ai.extract_schedule` |
| GET | `/api/languages` | Languages Steady can speak, for the picker | `ai.list_languages` |
| PUT | `/api/patient/language` | Change the patient's language from the patient app | |
| POST | `/api/setup/confirm` | Save the schedule (and optional `language`) the caregiver confirmed | |
| PUT | `/api/patient/interests` | Save the patient's interests | |
| GET | `/api/patient/today` | Today's doses, progress, next dose, a thought | `ai.write_opener` |
| GET | `/api/meds/{med_id}/info` | "Know more" card | `ai.simplify_label`, `voice.say` |
| POST | `/api/doses/{dose_id}/confirm` | Mark taken; update fading | `engine.fading` |
| GET | `/api/checkins/prompt` | Opener + question, with audio | `ai.write_opener`, `voice.say` |
| POST | `/api/checkins` | The patient's answer → analysis, tier, alert, spoken reply | `voice.transcribe`, `ai.analyze_checkin`, `engine.alerts`, `voice.send_sms`, `voice.say` |
| GET | `/api/caregiver/dashboard` | Everything in the caregiver app's Today and Alerts tabs | |
| GET | `/api/alerts/latest` | Newest unhandled alert + latest check-in id; the caregiver app polls it every 3 s | |
| POST | `/api/alerts/{alert_id}/handled` | Mark an alert handled | |
| POST | `/api/demo/clock` | Set the demo time; returns due reminders | `ai.reminder_text`, `voice.say` |
| POST | `/api/demo/two-weeks-later` | Load the faded state | `seed` |
| POST | `/api/demo/reset` | Back to the start state | `seed` |

### Local setup (everyone, once)

Needs Python 3.11+ and Node 20+.

```bash
git clone <repo-url> && cd steady-care

cd backend
python -m venv .venv
source .venv/bin/activate              # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                   # paste your keys; keep USE_MOCKS=1 unless you're testing real APIs
uvicorn app.main:app --reload --port 8000     # API docs at http://localhost:8000/docs

cd ../frontend
npm install
npm run dev                            # http://localhost:5173 (proxies /api and /static to :8000)

# Phones: open a tunnel to the frontend (mic and camera need HTTPS)
cloudflared tunnel --url http://localhost:5173
# then open https://<random>.trycloudflare.com/patient and /caregiver on the phones,
# and put that URL in backend/.env as PUBLIC_BASE_URL so SMS links work
```
