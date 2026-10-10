# Aniketh: Frontend and UX lead

**Your job:** the two faces of Steady. Both are **phone apps** (web apps installed to the home screen, no native code), built from one Vite codebase and talking to one backend:

- The **patient app** (`/patient`) is calm: one thing per screen, big text, big buttons, one big mic.
- The **caregiver app** (`/caregiver`) puts status first, then detail, behind four bottom tabs.

You talk to the backend **only through `/api`**. You never call Gemini, ElevenLabs or Twilio yourself.

**Track:** Gemini is our main track, and we're going for the **ElevenLabs** and **UI/UX** superlatives. The UI/UX one is yours to win.

**Design reference:** Rushil shares the Figma Make file **`Steady-App-Design`** at H0. Its `src/index.css` holds the design tokens; take them from there instead of retyping colors. The companion is called **Steady** everywhere.

**No default names, no pronouns.** Every name on screen comes from `GET /api/profile`: `patient.preferred_name` for the patient, `caregiver.name` for the caregiver. Never write he/she/her for the patient; say "the patient" in labels or use the preferred name. The example data uses **Asha Patel** ("Asha", Hindi) with caregiver **Ravi Patel** (Son); those appear only because they're in the mock data.

**H0 = the moment hacking officially starts.** All times are hours from then.

---

## What you own

| You own | You never edit (ask the owner) |
|---|---|
| Everything in `frontend/` | Anything in `backend/` (Samarth, Rushil) |
| `frontend/package.json` and `package-lock.json`. Only you install packages. | `contracts/` (Rushil) |

## The two apps and their screens

No login. One patient and one caregiver per install. Both run on phones over the HTTPS tunnel.

### Patient app (`/patient`)

| # | Screen | Route | Data |
|---|---|---|---|
| P1 | **Language** (first run, and from a globe button on Home) | `/patient/language` | `GET /api/languages`, `PUT /api/patient/language` |
| P2 | **Home**: next medicine card + one big mic button | `/patient` | `GET /api/patient/today` |
| P3 | **Reminder → Talk → Confirm**: one state at a time, never stacked | `/patient/reminder` | `POST /api/demo/clock`, `POST /api/doses/{id}/confirm` |
| P4 | **Done**: warm closing | `/patient/done` | the `reply` from the last call |
| P5 | **Check-in** (evening/morning) | `/patient/checkin` | `GET /api/checkins/prompt`, `POST /api/checkins` |
| P6 | **Know more**: bottom sheet over Reminder or Home | (sheet) | `GET /api/meds/{med_id}/info` |

No sponsor labels and no scores in the patient app. At most a simple streak like "3 days in a row", and only if the API gives you the number.

### Caregiver app (`/caregiver`, bottom tabs)

Tabs use the URL hash, so the SMS link `/caregiver#alerts` opens straight on Alerts.

| # | Tab | Hash | Data |
|---|---|---|---|
| C1 | **Profile**: setup with sharing consent (also the first-run flow) | `#profile` | `GET/PUT /api/profile` |
| C2 | **Scan + review**: camera, then edit and confirm the schedule | `#scan` | `POST /api/setup/extract`, `POST /api/setup/confirm` |
| C3 | **Today**: doses, adherence, how reminders are fading | `#today` | `GET /api/caregiver/dashboard` |
| C4 | **Alerts**: alert card + check-in feed with "How Steady understood it" | `#alerts` | `GET /api/alerts/latest` (poll), dashboard |

First run: if `profile.setup_complete` is false (or `GET /api/profile` has no profile yet), the app opens on Profile, then Scan. The other tabs show a friendly "Finish setup first" state until then.

---

## H0 to H0:20: Prep while Rushil scaffolds

Install Node 20+ and `cloudflared` (`brew install cloudflared`, or the binary from Cloudflare's site). Open `Steady-App-Design`, then list your components:

- Shared: `SpokenCaption`, `PillDot`, `BottomSheet`, `EmptyState`, `DemoControls`
- Patient: `ProgressRing`, `NextMedCard`, `MicButton`, `SwipeToConfirm`, `LanguagePicker`
- Caregiver: `TabBar`, `StatusPill`, `TierChip`, `AlertCard`, `UnderstoodPanel`, `KpiTile`, `MoodChart`, `UnpromptedChart`, `AdherenceCalendar`, `MedCard`

---

## H0:20 to H1:30: Skeleton with two entry routes and shared tokens

Wait for **"Scaffold is up."** Pull, then branch `aniketh/skeleton`.

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install react-router-dom recharts tailwindcss @tailwindcss/vite
```

**`vite.config.ts`:**

```ts
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    allowedHosts: [".trycloudflare.com"],   // the HTTPS tunnel's hostname
    proxy: {
      "/api": "http://localhost:8000",
      "/static": "http://localhost:8000",
    },
  },
});
```

**Two entry routes, one codebase:**
- `src/patient/PatientApp.tsx` handles `/patient/*` with its own layout (centered, max width 440px).
- `src/caregiver/CaregiverApp.tsx` handles `/caregiver` with the bottom `TabBar` and hash tabs.
- `/` redirects to `/patient`.
- Each app gets its own web manifest (`public/patient.webmanifest` with `start_url: "/patient"`, `public/caregiver.webmanifest` with `start_url: "/caregiver"`), so each installs to the home screen as its own app. Each layout sets the `<link rel="manifest">` href on mount.

**Design tokens: one shared file.** Copy the theme block from `Steady-App-Design`'s `src/index.css` into `frontend/src/styles/tokens.css` (Tailwind v4 `@theme`), and import it from `src/index.css`. Both apps use only these tokens; no hex values in components. For reference, the Figma Make design uses:

| Token | Value | Use |
|---|---|---|
| navy | `#1e1b4b` | Headings, primary text |
| indigo | `#312e81` | Primary action |
| green | `#15803d` | Taken, swipe bar, green tier |
| amber | `#ea580c` | Yellow tier, "Call your doctor if" |
| background | `#f8fafc` | Warm page background |

Red tier and missed doses use the red from the token file. If the Figma file and this table disagree, the Figma file wins.

- **Font:** Atkinson Hyperlegible (400, 700) from Google Fonts in `index.html`, for everything. It was designed for low-vision readers.
- **Headings must be bold.** Tailwind's preflight resets `h1`/`h2` weight, so add `h1, h2, h3 { font-weight: 700; }` in `index.css`.
- **Touch targets:** at least 56px tall everywhere, in both apps. Patient body text at least 18px, headings 30–36px.
- **`DemoControls`:** a dashed strip that shows only with `?demo=1`, with three buttons: Fast-forward to 8 PM, Two weeks later, and Reset.

**Done when:** `/patient`, `/patient/language`, `/patient/reminder`, `/patient/checkin`, `/patient/done` and all four `/caregiver#…` tabs render an empty shell with the right font and colors. Merge it, then post **"Frontend skeleton merged."**

---

## H1:30 to H2:15: API types and client

After Samarth posts **"Mock API is live"**, generate types from the backend:

```bash
cd frontend
npx openapi-typescript http://localhost:8000/openapi.json -o src/api/schema.d.ts
```

- **Rerun it** after any backend merge that changes a shape.
- **Never hand-write response types.** They'd drift from the backend, and that drift is exactly the "works on my machine" bug this setup avoids.
- `src/api/client.ts` has one function per endpoint (see "API at a glance" below). It throws on non-2xx responses with the server's message. Components never call `fetch` directly.
- Prefix every request, and every `audio_url`, with `import.meta.env.VITE_API_BASE ?? ""`. Locally that's empty and the proxy handles it; on a backup deploy it points at the backend.
- A small `useProfile()` hook loads `GET /api/profile` once and gives every screen the names, phones and language.

---

## H2:15 to H4: HTTPS tunnel on a real phone

This used to be late in the plan. It's now early, because the mic and live camera don't work on a phone without it, and every screen after this needs testing on a phone.

1. Run the backend and `npm run dev`, then `cloudflared tunnel --url http://localhost:5173`. You get `https://<random>.trycloudflare.com`.
2. Post that URL in chat. Rushil or Samarth puts it in `backend/.env` as `PUBLIC_BASE_URL`, so SMS links point at it. (The URL changes each time `cloudflared` restarts, so keep it running.)
3. Open `<url>/patient?demo=1` on one phone and `<url>/caregiver` on another.
4. Wire the bare minimum to mock data: Home shows `today.next` and the patient's name; Today shows `kpis` as plain text. Ugly is fine.
5. Prove the hard parts now, with throwaway buttons: a tap plays a sound, the mic permission prompt appears and a recording comes back, and the camera input opens the rear camera.

**Done when:** both apps show mock data from the real backend on a phone, through the tunnel (the **H4** sync point).

---

## H4 to H6:30: Patient screens (Language, Home, Reminder → Talk → Confirm, Done)

**Language** (`GET /api/languages`, then `PUT /api/patient/language`):
- Shown on first run of the patient app, and reachable from a globe button on Home. (The caregiver also picks a language in Profile; this lets the patient change it on their own phone.)
- Ask the question in several languages at once, since you don't know theirs yet: "Which language should Steady speak?" plus the same line in Hindi and Spanish.
- One big button per language (there are 13), showing its `native_name` large (हिन्दी, Español, ગુજરાતી) and its English `name` small.
- Languages with `spoken: false` get a small note: "Captions in this language, voice in English".
- Tapping a language saves it and goes to Home. Every spoken line from then on comes back in that language.

**Home** (`GET /api/patient/today`):
- Date, then "Good evening, {today.patient.name}".
- A progress ring showing `taken_count` of `total_count`.
- The **next medicine card** from `next` (time + `label`, with a pill dot per dose), linking to Reminder, with a small **Know more** button.
- "A thought for tonight", shown only when `thought` isn't null.
- **One big mic button**, "Talk to Steady", linking to Check-in. Nothing else competes with it.

**Reminder → Talk → Confirm.** The data comes from `POST /api/demo/clock` (via DemoControls). Show **one state at a time**; each replaces the last instead of stacking cards:
1. **Reminder:** the pill circle in `color`, the name, "1 yellow pill · for blood pressure" (from `look` and `purpose`), and the caption card (below). The reminder audio plays.
2. **Talk** (optional): the mic button, for "I already took it" or a question. Same recording code as Check-in.
3. **Confirm:** the swipe-up bar, with "Tap to confirm instead" and "Remind me in 10 min" under it.
- The caption card: the patient's language (`text_local`) large, English (`text_en`) small underneath, and a replay button. For English, `text_local` is `null`, so show `text_en` large and nothing under it. Set `lang` on the caption element so screen readers pronounce it correctly.
- With 2 due doses, show "1 of 2" and move to the next after confirming.
- Confirm calls `POST /api/doses/{id}/confirm` with `{"prompted": true}`. When the patient confirms from Home before any reminder, send `false`. That's what makes reminders fade.

**Done:**
- A full green ring and Steady's reply, as text and audio.
- The reply is always a warm thank-you and "have a good evening/morning". **Never show anything on the patient's screen about the caregiver being told, an alert or a report,** even when one was sent. The alert appears only in the caregiver app. (A red tier is the exception; its reply tells the patient to call 911.)
- **Back to today**, plus a plain **Call {caregiver.name}** button (`tel:` link) that is always there, so it never hints that something was sent.

### Swipe to confirm (behavior spec)

- The green bar sits at the bottom of a taller track and follows the finger up. The green fill grows behind it.
- **Releasing before 75% of the track springs it back.** Past 75%, it locks at the top, shows "Taken", vibrates (where allowed), and confirms 600 ms later.
- Pressing Enter or Space on the focused bar confirms, so it works with a keyboard.
- The "Tap to confirm instead" link always sits under it, for hands with tremors.
- Respect `prefers-reduced-motion`.

```tsx
function SwipeToConfirm({ onConfirm }: { onConfirm: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const BAR = 76;
  const max = () => (track.current?.clientHeight ?? 184) - BAR;

  const finish = () => {
    setDone(true);
    setDy(max());
    navigator.vibrate?.(30);
    setTimeout(onConfirm, 600);
  };
  const ease = dragging ? "none" : "transform .3s, height .3s";

  return (
    <div ref={track} className="relative h-[184px] overflow-hidden rounded-[26px] bg-green/15 touch-none select-none">
      <div className="absolute inset-x-0 bottom-0 rounded-[26px] bg-green"
           style={{ height: BAR + dy, transition: ease }} />
      <button
        className="absolute inset-x-0 bottom-0 h-[76px] rounded-[26px] text-[22px] font-bold text-white"
        style={{ transform: `translateY(${-dy}px)`, transition: ease }}
        aria-label="I took it. Swipe up to confirm, or press Enter."
        onPointerDown={(e) => {
          if (done) return;
          startY.current = e.clientY;
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (dragging) setDy(Math.max(0, Math.min(max(), startY.current - e.clientY)));
        }}
        onPointerUp={() => {
          setDragging(false);
          if (dy >= max() * 0.75) finish();
          else setDy(0);
        }}
        onPointerCancel={() => { setDragging(false); setDy(0); }}
        onClick={(e) => { if (e.detail === 0 && !done) finish(); }}   // keyboard: Enter / Space
      >
        {done ? "Taken" : "I took it"}
      </button>
    </div>
  );
}
```

### Audio rules (phones are strict)

- **Browsers play sound only after a tap.** On the first tap (Fast-forward, Talk to Steady, or a language button), create **one shared `Audio` element** and play a short silent clip from inside that tap handler. Reuse that element for every reminder and reply afterward. Without this, iPhones block audio that starts after a network request.
- If `audio_url` is `null`, fall back to `speechSynthesis.speak()` with `text_en`. That includes languages with `spoken: false`: the voice is English, and `text_local` is the caption in the patient's language.
- Every spoken line also appears as text, always.

---

## H6:30 to H8: Check-in and Know more

**Check-in:**
1. `GET /api/checkins/prompt`. Show `opener` small (it may be `null`) and `question` big, and play both.
2. The big mic button. Tap once to start: show "Listening…" and a timer. Tap again to stop. No time limit.
3. Record with `MediaRecorder` and send the Blob as-is (see "Camera and mic on phones").
4. A **Type instead** link opens a textarea that posts JSON `{"text": "..."}` to the same endpoint.
5. While waiting, show "Steady is listening…". Then go to Done and play `reply`. Gemini listens to the recording itself, so this can take a few seconds; keep the waiting state calm, not a spinner wall.

**Know more** (bottom sheet, `GET /api/meds/{med_id}/info`):
- A drag handle, a close button, and 4 cards: What it's for, How to take it, You might notice, and Call your doctor if (on an amber background).
- **Read this to me** plays `spoken`, or uses `speechSynthesis` if it's null.
- Below the cards, a few suggestions based on the patient's interests (from the profile), such as the day's thought. Keep it light.
- Footer: "Questions? Ask your pharmacist or doctor." plus the `source` line.

---

## H8 to H10: Caregiver Profile and Scan

**Profile** (setup, and editable later; `GET` then `PUT /api/profile`):
1. **The patient:** full name, preferred name ("What should Steady call them out loud?"), phone.
2. **Language:** the same `LanguagePicker` as the patient app, labeled "Which language should Steady speak with {preferred name}?" Save it as `patient.language`.
3. **Interests:** chips (Uplifting thoughts, Clean jokes, Proverbs in their language, Cricket, plus "Add"). Saved as `patient.interests`. Ask Samarth whether `PUT /api/profile` also updates what the opener uses; if not, also call `PUT /api/patient/interests`.
4. **You, the caregiver:** name, relationship, phone. Say plainly that alert texts go to this phone.
5. **Sharing consent:** because alerts are silent, say so plainly, and the patient (with the caregiver) agrees once: "Steady will share how {preferred name} is feeling with {caregiver name}, so they can help when it's needed. {preferred name} won't be told each time." A checkbox that must be ticked; **Continue** stays disabled until `sharing_consent` is true.
6. Save with `PUT /api/profile`, then go to Scan.

**Scan + review:**
1. **Camera:** `<input type="file" accept="image/*" capture="environment" multiple>` styled as a big "Scan a bottle" button. This is the reliable path on every phone. An optional live `getUserMedia` viewfinder is a stretch goal, never the only way in.
2. Show thumbnails of the 1–6 photos, with a remove button on each and "Add another".
3. Send them as field `images` to `POST /api/setup/extract`. Show "Reading the labels…".
4. **Review list** (cards, not a wide table, since it's a phone): name, dose, time, purpose, all editable.
   - Highlight cards with `needs_review: true`.
   - Cards with `high_risk: true` show "Keep this on always remind?" with the toggle on.
5. **Confirm schedule** calls `POST /api/setup/confirm` with the medications and `language`, refetches the profile (now `setup_complete`), and goes to Today.

### H10: Gate 1

Run it on two phones with Rushil and Samarth: caregiver phone scans a bottle, the patient phone plays the reminder, the patient says "I'm dizzy", the SMS buzzes, and the alert shows in the caregiver app within about 3 seconds. Note every UI bug.

---

## H10 to H14: Caregiver Today and Alerts, with 3-second polling

**Today** (`GET /api/caregiver/dashboard`), top to bottom:
1. **Header:** the patient's preferred name, a **status pill** (icon + `headline`, never color alone), and **Call {preferred name}** (`tel:` the patient's phone).
2. **Today's doses:** `kpis.today_taken` of `kpis.today_total`, plus the medication cards below.
3. **KPI tiles** (2×2 on a phone): on time over 30 days (`on_time_pct_30d`, with `on_time_doses_30d` of `doses_30d` under it), taken without a reminder this week (`unprompted_this_week` of `doses_this_week`), check-ins answered in 14 days.
4. **How reminders are fading:** `UnpromptedChart`, a Recharts `BarChart` of `unprompted_by_week` with a value on each bar and the current week darker. One sentence under it saying what it means.
5. **Mood:** `MoodChart`, a `LineChart` of `mood_14d` with a `ReferenceArea` for `usual_range` labeled "{preferred name}'s usual range", and the last point labeled.
6. **30-day calendar:** green = on time, amber = late, red outline + ✕ = missed, with a legend.
7. **Medication cards:** pill dot, name and purpose, schedule, reminder level as dots + a lock icon when `always_remind`, independence number + sparkline from `spark_14d`, last taken.

**Alerts:**
1. **Alert card** (when there's an active alert): tier chip and time, `title`, `summary`, `note` in muted text, and "Text sent" or "Text not sent" from `sms_sent`. Buttons: **Call {preferred name}**, **Read the check-in** (scrolls to the check-in with `checkin_id`), **Mark as handled** (`POST /api/alerts/{id}/handled`).
2. **Check-in feed** from `dashboard.checkins`, newest first. Each item opens a **"How Steady understood it"** panel:
   - Tier chip (icon + word)
   - `symptoms` as chips
   - `tone_note` ("Slower and quieter than recent check-ins")
   - `why`, as 1–3 bullets
   - The patient's words (`quote`, with `lang` set) and the English (`quote_en`) under it
   - A small line from `heard_audio`: "Steady listened to the recording" or "From the transcript only"

**Polling.** While the caregiver app is open, poll `GET /api/alerts/latest` every 3 seconds. When `latest_checkin_id` changes, refetch the dashboard:

```ts
useEffect(() => {
  let lastId: number | null | undefined;
  const tick = async () => {
    if (document.hidden) return;
    const latest = await api.alertsLatest();
    setAlert(latest.alert);
    if (latest.latest_checkin_id !== lastId) {
      lastId = latest.latest_checkin_id;
      setDashboard(await api.dashboard());
    }
  };
  tick();
  const id = setInterval(tick, 3000);
  return () => clearInterval(id);
}, []);
```

When a new alert arrives, switch the badge on the Alerts tab and briefly announce it (`aria-live="polite"`).

Give every section a designed empty state, such as "No check-ins yet", in case seed data is missing.

**Done when:** Today and Alerts show seeded history (the **H14** sync point), and a check-in on the patient phone shows up in Alerts within about 3 seconds.

---

## Camera and mic on phones

- **Secure origin only.** Phones allow the mic and live camera only on `https://` pages (and `localhost`, which a phone can't use). Over `http://192.168.x.x` they fail silently. Always test through the tunnel.
- **Camera:** `<input type="file" accept="image/*" capture="environment">` is the reliable path. It works on iPhone and Android without any permission code. A live viewfinder is optional.
- **Mic formats differ:** iPhone (Safari) records **MP4** (`audio/mp4`), Android (Chrome) records **WebM** (`audio/webm`). Don't force a `mimeType` on `MediaRecorder`; let the phone pick.
- **Send the Blob as-is with its MIME type.** The backend converts to WAV for Gemini. Don't convert in the browser.

```ts
const recorder = new MediaRecorder(stream);          // no mimeType option
// ...collect chunks...
const blob = new Blob(chunks, { type: recorder.mimeType });
const ext = blob.type.includes("mp4") ? "m4a" : "webm";
const form = new FormData();
form.append("audio", blob, `checkin.${ext}`);
await api.postCheckinAudio(form);
```

- Stop the stream's tracks after recording, so the phone's mic indicator turns off.

## Don't show fake numbers

Show only fields the API returns. No made-up metrics anywhere, even as decoration:

- No "pitch 18 Hz", "98% match", "confidence 0.92" or waveform analysis that isn't real. "How Steady understood it" uses only `why`, `tone_note`, `symptoms`, `heard_audio` and the transcripts.
- Twilio reports only sent or failed: show "Text sent", never "Delivered" or "Read 8:18".
- If a field is missing or null, show an empty state, not a placeholder number.
- The patient app shows no scores at all.

---

## H14 to H18: Accessibility pass and device testing

This is what wins the **UI/UX** superlative, so don't skip it.

- [ ] Text contrast is at least 4.5:1 everywhere (check muted text on every background).
- [ ] Every button and image has a label; icon-only buttons have `aria-label`.
- [ ] Run the whole patient flow with **VoiceOver (iPhone) and TalkBack (Android)**.
- [ ] Status never relies on color alone: there's always an icon and a word.
- [ ] Every spoken line also appears as text, with `lang` set.
- [ ] The layout still works at 200% system font size, in both apps.
- [ ] Touch targets are at least 56px; no time limits on patient actions.
- [ ] Headings are bold and in order; keyboard focus is visible.
- [ ] Both apps install to the home screen on iPhone and Android and open on the right start page.
- [ ] Test on an iPhone and an Android if the team has both: audio after the first tap, the mic, the camera, the swipe.
- [ ] **Backup deploy:** Vercel with `VITE_API_BASE` set to Samarth's backup backend URL.

## H18 onward: Freeze and polish

`fix` PRs only. At H20, take clean phone screenshots of every patient screen and every caregiver tab for Devpost, and help record the backup video: the patient phone and caregiver phone side by side, the patient says "I'm dizzy", the SMS buzzes and the alert appears in the caregiver app within about 3 seconds.

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
