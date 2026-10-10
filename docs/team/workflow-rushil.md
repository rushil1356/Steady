# Rushil: Team lead, AI and voice

**Your job:** make Steady understand and speak. You own every call to Gemini and ElevenLabs, the SMS sender, the shared contracts, final integration and the pitch.

**Track:** Gemini is the main track, so Gemini does the heavy lifting: it reads the label photos, listens to the check-in recording, judges the tier and explains why. Superlatives we're targeting: ElevenLabs (the voice) and UI/UX (Aniketh's two apps).

**The scaffold is already built and committed locally:** `backend/app/ai/`, `backend/app/voice/`, `backend/app/prompts/`, `contracts/`, the root files and these docs. In mock mode the tests give **60 passed, 15 skipped** (the skipped ones are the live evals). Your job at H0 is to push it, then spend the day making each function work live.

You hold two roles, the heaviest load on the team, so the plan is ordered by what the live demo needs first. If you're behind at **H8**, hand SMS to Samarth (about 20 lines) and keep going.

**H0 = the moment hacking officially starts.** All times are hours from then.

---

## What you own

| You own | You never edit (ask the owner) |
|---|---|
| Repo root: `.gitignore`, `.gitattributes`, `README.md` | `backend/app/main.py`, `config.py`, `contracts.py`, `routers/`, `models.py`, `engine/`, `clock.py`, `seed.py` (Samarth) |
| `contracts/`: the source of truth for every payload | `backend/requirements.txt` after H0 (Samarth) |
| `backend/app/ai/`, `backend/app/voice/`, `backend/app/prompts/` | Anything in `frontend/` (Aniketh) |
| `backend/static/demo-audio/`, `backend/scripts/pregenerate_audio.py`, `backend/requirements-extra.txt`, `backend/tests/test_ai_*.py` | |

---

## The functions you provide

Samarth's routes call only these. They already work in mock mode, so Samarth writes no stubs. **Keep the signatures stable; change only what's inside.**

`backend/app/ai/__init__.py`

```python
def extract_schedule(images: list[bytes]) -> list[ExtractedMed]: ...
    # 1-6 label photos straight from the phone. Mime is sniffed from the bytes (JPEG, PNG, WebP, HEIC).
    # Returns [] if nothing is readable; the Scan screen then lets the caregiver add rows.

def reminder_text(med: MedBrief, level: int, patient_name: str = "") -> str: ...
    # English. Level 1 = full reminder, level 2 = short nudge. No name -> the line starts without one.

def write_opener(interests: list[str], part_of_day: str = "evening") -> str | None: ...
    # "morning" | "evening". <= ~25 words, None about 1 in 5 times. Cached per day and part of day.

def analyze_checkin(transcript: str, meds: list[MedBrief], history: list[PastCheckin],
                    audio: bytes | None = None, patient_name: str = "",
                    lang: str = "en", part_of_day: str = "evening",
                    caregiver_name: str = "") -> Analysis: ...
    # audio = the raw recording (WebM, MP4, WAV...). caregiver_name is only used to keep it OUT of the closing line.

def rules_analysis(transcript, meds, history, patient_name="", part_of_day="evening",
                   transcript_en=None) -> Analysis: ...      # keyword-only fallback / safety net
def closing_line(tier: str, patient_name: str = "", part_of_day: str = "evening") -> str: ...
def simplify_label(med_name: str) -> MedInfo: ...
def list_languages() -> list[Language]: ...                  # the 13 languages for GET /api/languages
def is_supported(code: str) -> bool: ...
```

`backend/app/voice/__init__.py`

```python
def say(text_en: str, lang: str = "en") -> Spoken: ...
    # Translate (Gemini, cached) if lang != "en", synthesize (ElevenLabs), cache by content hash.
    # Spoken aloud in lang only if lang is in TTS_SPOKEN_LANGS; otherwise English audio + caption in lang.

def transcribe(audio: bytes, mime: str = "audio/webm", lang: str | None = None) -> str: ...
    # ElevenLabs speech-to-text, WebM or MP4 as-is. lang = the patient's language; "" on failure.

def send_sms(to: str, body: str) -> bool: ...                # never raises; False on failure
def alert_body(tier: str, summary: str) -> str: ...
    # "Steady: <summary> Open: <PUBLIC_BASE_URL>/caregiver#alerts", prefixed "URGENT: " for red
```

**What Samarth passes in, all from the profile:** `patient_name = profile.patient.preferred_name`, `lang = profile.patient.language`, `caregiver_name = profile.caregiver.name`, and `send_sms(profile.caregiver.phone or CAREGIVER_PHONE, alert_body(tier, analysis.caregiver_summary))`. There is no default name anywhere.

The types (`ExtractedMed`, `MedBrief`, `PastCheckin`, `Analysis`, `MedInfo`, `Language`, `Spoken`) live in `backend/app/contracts.py`, which mirrors `contracts/examples/`.

Rules every function already follows (keep it that way):

- **Mocks.** With `USE_MOCKS=1` each function returns the matching example from `contracts/examples/` and calls no API. Samarth and Aniketh develop with mocks on, so they never wait for you and never spend your credits.
- **Never crash a request.** API errors are caught, logged, and replaced with a safe fallback:
  - `say` returns `audio_url=None`, and the app speaks with the phone's own voice.
  - `analyze_checkin` falls back to `rules_analysis` (keywords on the English text).
  - `transcribe` returns `""`; `send_sms` returns `False`.
- **Cache everything that costs money.** Audio is cached by a hash of text + voice + model in `backend/static/audio/` (gitignored); committed demo audio in `backend/static/demo-audio/` is checked first. Translations, openers and label summaries are cached as JSON in `backend/.cache/` (gitignored).
- **No pronouns.** Summaries and `why` use the preferred name ("Asha took both evening pills"), never he/she.

---

## The plan, step by step

### Step 0: Before H0 (~45 min, at check-in)

- **Keys.**
  - Gemini: create a key in Google AI Studio.
  - ElevenLabs: ask at check-in whether MLH or a sponsor is handing out credits before you pay for anything.
  - Twilio: make a trial account and **verify the demo caregiver's phone now**. Trial accounts only text verified numbers.
- **Tunnel.** Install `cloudflared` and run `cloudflared tunnel --url http://localhost:5173` once to check it gives you a `https://….trycloudflare.com` URL. Phones only allow the mic and live camera on HTTPS.
- **Labels.** Make 4 fake prescription labels (Metoprolol, Warfarin, Atorvastatin, Vitamin D, matching `extracted_meds.json`), print them and stick them on real bottles.
- **Done when:** the keys are in `backend/.env` and `cd backend && USE_MOCKS=1 pytest -q` passes (60 passed, 15 skipped).

### Step 1: H0 to H0:20: Push the repo (before anyone else commits)

Nobody else pushes until you post **"Scaffold is up."**

1. Create the GitHub repo `steady-care`. Add Samarth and Aniketh as collaborators.
2. **Settings → General → Pull Requests:** allow **squash merging only**, and turn on **Automatically delete head branches**.
3. If the repo is public, add a branch rule on `main` that requires a pull request. On a private free-plan repo this may not exist; then "never push to main" is on the honor system.
4. Push the local scaffold commits straight to `main` (`git remote add origin … && git push -u origin main`). This is the only direct push to `main` all weekend.
5. Post in the team chat: **"Scaffold is up. Clone now."**
6. Share the Figma Make design and the project plan from each page's Share menu. They can't open the links until you do.
7. DM each person the keys they need. Never put keys in the repo or a public channel. Everyone keeps keys in their own `backend/.env`.

### Step 2: H0:20 to H1: Freeze the contracts (team lead)

- Run a **10-minute walkthrough of `contracts/api.md`** with both of them. Cover:
  - `GET/PUT /api/profile`: patient full name, preferred name, phone, language, interests; caregiver name, relationship, phone; `sharing_consent` (must be true to finish setup).
  - `GET /api/alerts/latest`, polled every 3 s by the caregiver app; when `latest_checkin_id` changes it refetches the dashboard.
  - The two mobile apps: patient at `/patient`, caregiver at `/caregiver` (Today, Alerts, Scan, Profile).
  - The "How Steady understood it" fields: `why`, `tone_note`, `heard_audio`, `transcript_en`.
- Contracts are **frozen at H1**. After that, only optional fields, announced with `CONTRACT CHANGE:`.
- **Done when:** Samarth's backend and Aniketh's frontend both run in mock mode against the contracts.

### Step 3: H1 to H3: Prescription extraction (Gemini)

- **AI Studio first.** Paste the prompt from `app/prompts/` and try it on **photos taken with a phone**: straight on, angled, and with glare. Fix the prompt there, where iteration is fast, then copy it back.
- Put the photos in `backend/tests/fixtures/labels/` with the right answer in `expected.json` (format in the test's docstring), then run `USE_MOCKS=0 pytest tests/test_ai_extract.py -v`.
- Photos go to Gemini with their real mime type, sniffed from the bytes. iPhone HEIC is fine; don't convert.
- A missing or unreadable field comes back `null` with `needs_review: true`. Never guess a dose.
- `high_risk: true` for blood thinners, insulin, seizure and heart-rhythm drugs (the Scan review screen suggests "always remind").
- `GEMINI_MODEL` overrides the default in `_gemini.py`; use the current Flash model Google lists at the event.
- **Done when:** the 4 labels come back right **3 runs in a row**, including at least one angled shot.

### Step 4: H3 to H5: Voice out (ElevenLabs)

- Pick **one multilingual voice** (`ELEVENLABS_VOICE_ID`). `ELEVENLABS_VOICE_ID_<LANG>` can override it per language if one sounds wrong.
- **Listen to it in English, Hindi, Spanish and Tamil.** Put only the ones that sound right in `TTS_SPOKEN_LANGS`. Every other language of the 13 gets a caption in that language with an English voice. Tell the team which languages are spoken.
- Reminders use the **preferred name from the profile**, never a default. With Asha as an example:
  - Level 1: "Asha, it's time for your blood pressure pill, the yellow one."
  - Level 2: a short nudge, "Asha, your yellow pill."
- **Cache check:** call `say()` twice with the same line; the second call must return instantly with the same `audio_url`.
- **Done when:** a reminder plays **on a phone, through the tunnel**, in two languages.

### Step 5: H5 to H8: Voice in and check-in analysis (core Gemini)

- **Record on both phones:** Android Chrome sends **WebM**, iPhone Safari sends **MP4**. `transcribe` passes both to ElevenLabs as-is.
- **Gemini hears the audio.** `analyze_checkin(audio=…)` converts WebM/MP4 to 16 kHz WAV with the ffmpeg bundled in `imageio-ffmpeg` (Samarth has it in `requirements.txt`), so Gemini judges how the patient sounds, not just the words. `heard_audio` is true when that worked.
- Run the 12 sample transcripts in `contracts/examples/transcripts/` (fine, mild, repeated dizziness, red flags, plus Hindi red and Spanish repeat): `USE_MOCKS=0 pytest tests/test_ai_analyze.py -v`. Tune `app/prompts/` until they pass.
- Read the actual output, not just the tier. Check:
  - `suggested_tier` (only a suggestion: Samarth's `engine/alerts.py` can raise it, never lower it; the keyword safety net can also only raise it)
  - `symptoms`: short lowercase words (dizzy, tired, no appetite, pain, nausea)
  - `tone_note` and `why` (1–3 short reasons): real observations, no invented numbers
  - `caregiver_summary`: 1–2 plain sentences of what was said, using the preferred name, no diagnosis, no pronouns
  - `transcript_en`: the patient's words in English, whatever language they spoke
- **Closing line (`patient_reply_en`):** a warm thank-you and "have a good evening/morning". It **never mentions alerts, reports, family or the caregiver's name**; `safe_reply()` swaps out any model line that does. Red tier always gets the fixed 911 line instead.
- **Done when:** all 12 pass, and **Hindi red-flag speech recorded on a real phone** comes back red.

### Step 6: H8 to H9: SMS

- Alerts go to `profile.caregiver.phone`; `CAREGIVER_PHONE` in `.env` is only a fallback.
- Body comes from `alert_body`: `Steady: <caregiver_summary> Open: <tunnel URL>/caregiver#alerts`, with `URGENT: ` in front for red. Set `PUBLIC_BASE_URL` to the tunnel URL so the link works on the phone.
- If you're behind at H8, hand this to Samarth (about 20 lines with `send_sms` + `alert_body` already written).
- **Done when:** the caregiver phone buzzes and the link opens the caregiver app on the **Alerts** tab.

### Step 7: H9 to H10: Two-phone integration gate (everyone)

Set `USE_MOCKS=0`, start the tunnel, and run the whole path on two real phones:

1. Caregiver phone: Scan tab → photograph the bottles → review → confirm.
2. Patient phone: the reminder plays → swipe up to confirm.
3. Patient phone: check-in → say **"I'm dizzy"**.
4. Caregiver phone: the SMS arrives and the alert appears in the caregiver app within **~3 seconds**.

- **Done when:** it works **twice in a row**. No new features from anyone until then.

### Step 8: H10 to H12: "Know more"

- `simplify_label` fetches the label from openFDA (generic name, then brand name), e.g.
  `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"metoprolol"&limit=1`
- Gemini rewrites indications, dosage, adverse reactions and warnings in plain words into `what_for`, `how_to_take`, `side_effects`, `call_doctor_if`, **using only the label text**. `source_url` links the label.
- **Done when:** you have read all 4 cards against their labels yourself.

### Step 9: H12 to H13: Openers

- `write_opener(interests, part_of_day)` draws from the profile's interests (for the demo persona: uplifting thoughts, clean jokes, Hindi proverbs, cricket).
- No medical content. No lyrics or quotes attributed to real people. Returns `None` sometimes so it doesn't get repetitive.
- Optional: `OPENER_SEARCH=1` turns on **Google Search grounding** for one light, current fact (last night's cricket). Worth a line in the Gemini-track pitch.
- Samarth skips the opener whenever there's an unhandled red alert.

### Step 10: H13 to H14: Pre-generate demo audio

- From `backend/`: `USE_MOCKS=0 python -m scripts.pregenerate_audio`. Name and language default to `contracts/examples/profile.json`; override with `DEMO_PATIENT=… DEMO_LANG=…` (run once per demo language).
- It writes reminders, check-in questions, closing lines and fallback openers to `backend/static/demo-audio/`; `say()` finds them by the same hash. Commit the mp3s.
- **Done when:** the demo plays its audio with **Wi-Fi off**.

### Step 11: H14 to H18: One stretch (pick at H14)

- **(a) Tone vs baseline:** compare each check-in's tone with the patient's first-week check-ins. Best fit for the Gemini track.
- **(b) Weekly summary:** Gemini writes a short weekly summary for the caregiver app's Today tab.

Extra packages go in `requirements-extra.txt`, never `requirements.txt`.

### Step 12: H18 onward: Freeze and pitch

- **H18–20:** run the demo end to end 3 times. Log every bug as a GitHub issue assigned to its owner.
- **H20:** record the backup video, then tag: `git tag demo-v1 && git push origin demo-v1`.
- **H21–23:** Devpost page, architecture diagram, screenshots from both phones.
- **H22–24:** rehearse the 3-minute pitch with a timer. Both phones on stage, side by side; **the alert arriving on the caregiver phone is the climax.**

### Lead check-ins (5 minutes each)

| When | Question |
|---|---|
| **H4** | Is anyone blocked? |
| **H9** | The two-phone gate: does it work? |
| **H14** | Which stretch, or none? |
| **H18** | Freeze: only `fix` PRs from here. |

---

## Appendix A: Root files

These match the files in the repo exactly.

### `.gitignore`

```
# secrets
.env
.env.*
!.env.example

# python
__pycache__/
*.pyc
.venv/
venv/
.pytest_cache/
.ruff_cache/
*.db
backend/.cache/

# node
node_modules/
dist/

# generated audio (demo-audio/ IS committed)
backend/static/audio/*
!backend/static/audio/.gitkeep

# os / editors
.DS_Store
Thumbs.db
.vscode/
.idea/
```

### `.gitattributes`

```
* text=auto eol=lf
*.mp3 binary
*.png binary
*.jpg binary
*.jpeg binary
*.heic binary
```

### `backend/.env.example`

```
# 1 = every AI, voice and SMS call returns example data and costs nothing. Set 0 to use real APIs.
USE_MOCKS=1
DATABASE_URL=sqlite:///./steady.db
# Phones need HTTPS for the mic and camera: set this to your cloudflared tunnel URL (https://....trycloudflare.com)
PUBLIC_BASE_URL=http://localhost:5173

# Gemini (Google AI Studio). Leave GEMINI_MODEL empty to use the default in app/ai/_gemini.py.
GEMINI_API_KEY=
GEMINI_MODEL=
# 1 = check-in openers may use Google Search grounding for one light, current fact (e.g. last night's cricket)
OPENER_SEARCH=0

# ElevenLabs
ELEVENLABS_API_KEY=
# One multilingual voice for every language. Optionally override per language: ELEVENLABS_VOICE_ID_HI=..., _ES=...
ELEVENLABS_VOICE_ID=
# Leave empty for the defaults in app/voice/tts.py and app/voice/stt.py.
ELEVENLABS_TTS_MODEL=
ELEVENLABS_STT_MODEL=
# Languages Steady speaks out loud. Any other chosen language gets captions in that language and an English voice.
# Only add a language after you've heard it and it sounds right.
TTS_SPOKEN_LANGS=en,es,hi,ta,zh,ko,ar,pt

# Twilio (trial accounts can only text verified numbers)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
# Alerts go to the caregiver phone saved in the profile. This is only a fallback if the profile has none.
CAREGIVER_PHONE=
```

---

## Appendix B: Contracts

`contracts/api.md` has the endpoint table, the conventions (times, tiers, levels, language, no pronouns, silent alerts, polling) and, for each endpoint, the example file that shows its payload. The examples live in **`contracts/examples/`** and are the source of truth; a test checks that each one parses into its model in `contracts.py`. They use the demo persona Asha Patel (preferred name "Asha", Hindi) with caregiver Ravi Patel (Son).

| File | What it is |
|---|---|
| `profile.json` | `GET/PUT /api/profile`: patient, caregiver, `sharing_consent`, `setup_complete` |
| `extracted_meds.json` | `POST /api/setup/extract`: the draft schedule read from label photos |
| `languages.json` | `GET /api/languages`: the 13 languages and whether each is spoken aloud |
| `language.json` | `PUT /api/patient/language` body and response |
| `setup_confirm_request.json` | `POST /api/setup/confirm` body: the schedule the caregiver confirmed |
| `setup_confirm.json` | `POST /api/setup/confirm` response |
| `interests.json` | `PUT /api/patient/interests` body and response |
| `today.json` | `GET /api/patient/today`: doses, progress, next dose, a thought |
| `med_info.json` | `GET /api/meds/{med_id}/info`: the "Know more" card |
| `dose_confirm.json` | `POST /api/doses/{dose_id}/confirm` response |
| `checkin_prompt.json` | `GET /api/checkins/prompt`: opener + question, with audio |
| `checkin_result.json` | `POST /api/checkins`: transcript, analysis, tier, alert, spoken reply |
| `analysis.json` | What `ai.analyze_checkin` returns, including `why`, `tone_note`, `heard_audio`, `transcript_en` |
| `dashboard.json` | `GET /api/caregiver/dashboard`: everything the caregiver app's Today and Alerts tabs show |
| `alerts_latest.json` | `GET /api/alerts/latest`: the active alert and `latest_checkin_id`, polled every 3 s |
| `spoken.json` | The shape of every piece of speech (`Spoken`) |
| `demo_clock.json` | `POST /api/demo/clock`: due doses with their spoken reminders |
| `ok.json` | `{"ok": true}` for handled, two-weeks-later and reset |
| `transcripts/` | The 12 sample check-ins and `expected.json` with the tier each should get |

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
