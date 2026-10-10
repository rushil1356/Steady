"""Pydantic mirror of contracts/examples/*.json.

Owner: Samarth (shipped in Rushil's H0 scaffold so everyone starts from the same types).
Frozen after H1: only add OPTIONAL fields, and post "CONTRACT CHANGE:" in chat first.
tests/test_ai_mock.py checks that every example file still parses into these models.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Tier = Literal["green", "yellow", "red"]
DoseStatus = Literal["upcoming", "due", "taken", "missed"]
DayStatus = Literal["ontime", "late", "missed"]


# ---------- shared ----------

class Spoken(BaseModel):
    text_en: str
    text_local: str | None = None
    lang: str = "en"
    audio_url: str | None = None


class OkResponse(BaseModel):
    ok: bool = True


# ---------- profile (one patient, one caregiver; the caregiver fills it in at setup) ----------

class PatientProfile(BaseModel):
    full_name: str
    preferred_name: str           # what Steady calls them out loud: "Asha", "Grandma", "Mr. Lee"
    phone: str | None = None
    language: str = "en"          # communication preference, a code from /api/languages
    interests: list[str] = Field(default_factory=list)


class CaregiverProfile(BaseModel):
    name: str
    relationship: str | None = None   # "Son", "Daughter", "Neighbor"
    phone: str                        # where alert texts go


class Profile(BaseModel):
    patient: PatientProfile
    caregiver: CaregiverProfile
    sharing_consent: bool = False     # the patient agreed that check-in notes go to this caregiver
    setup_complete: bool = False


# ---------- language preference ----------

class Language(BaseModel):
    code: str             # "en", "hi", "gu", ...
    name: str             # English name: "Hindi"
    native_name: str      # shown on the picker: "हिन्दी"
    spoken: bool          # True = Steady speaks it aloud; False = captions in it, English voice


class LanguagesResponse(BaseModel):
    languages: list[Language]


class LanguageBody(BaseModel):
    language: str


# ---------- setup ----------

class ExtractedMed(BaseModel):
    name: str
    dose: str | None = None
    times: list[str] = Field(default_factory=list)
    purpose: str | None = None
    look: str | None = None
    color: str | None = None
    high_risk: bool = False
    needs_review: bool = False


class ExtractResponse(BaseModel):
    medications: list[ExtractedMed]


class ConfirmMed(ExtractedMed):
    always_remind: bool = False


class ConfirmRequest(BaseModel):
    medications: list[ConfirmMed]
    language: str | None = None   # the patient's communication preference, chosen first in setup


class ConfirmResponse(BaseModel):
    ok: bool = True
    count: int


class InterestsBody(BaseModel):
    interests: list[str]


# ---------- inputs to Rushil's ai/ functions ----------

class MedBrief(BaseModel):
    id: str
    name: str
    dose: str | None = None
    purpose: str | None = None
    look: str | None = None
    high_risk: bool = False


class PastCheckin(BaseModel):
    at: str
    transcript: str = ""
    symptoms: list[str] = Field(default_factory=list)
    tier: Tier = "green"


# ---------- analysis and med info ----------

class DoseConfirmation(BaseModel):
    med_id: str
    taken: bool


class Analysis(BaseModel):
    dose_confirmations: list[DoseConfirmation] = Field(default_factory=list)
    symptoms: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)
    orientation_ok: bool = True
    mood_score: float | None = None
    tone_note: str | None = None
    suggested_tier: Tier = "green"
    transcript_en: str | None = None    # the patient's words in English (same as the transcript if they spoke English)
    why: list[str] = Field(default_factory=list)   # 1-3 short reasons for the tier, shown as "How Steady understood it"
    heard_audio: bool = False           # True when Gemini listened to the recording, not just the transcript
    caregiver_summary: str
    patient_reply_en: str               # the closing line the patient hears; never mentions the caregiver or alerts


class MedInfo(BaseModel):
    med_name: str
    what_for: str
    how_to_take: str
    side_effects: str
    call_doctor_if: str
    source: str
    source_url: str | None = None
    spoken: Spoken | None = None


# ---------- patient ----------

class PatientRef(BaseModel):
    name: str
    language: str


class TodayDose(BaseModel):
    dose_id: int
    med_id: str
    name: str
    dose: str | None = None
    time: str
    look: str | None = None
    color: str | None = None
    status: DoseStatus
    level: int
    always_remind: bool = False


class NextDose(BaseModel):
    time: str
    dose_ids: list[int]
    label: str


class Thought(BaseModel):
    text: str
    because: str


class Today(BaseModel):
    patient: PatientRef
    now: str
    taken_count: int
    total_count: int
    doses: list[TodayDose]
    next: NextDose | None = None
    thought: Thought | None = None
    streak_days: int | None = None    # days in a row with every dose taken; the patient app shows "3 days in a row"


class DoseConfirmRequest(BaseModel):
    prompted: bool = True


class MedState(BaseModel):
    id: str
    level: int
    streak: int
    independence: int


class DoseConfirmResponse(BaseModel):
    dose_id: int
    status: DoseStatus
    med: MedState


# ---------- demo ----------

class DemoClockRequest(BaseModel):
    time: str


class DueDose(BaseModel):
    dose_id: int
    med_id: str
    name: str
    dose: str | None = None
    purpose: str | None = None
    look: str | None = None
    color: str | None = None
    level: int
    always_remind: bool = False
    reminder: Spoken


class DemoClockResponse(BaseModel):
    now: str
    due: list[DueDose]


# ---------- check-ins ----------

class CheckinPrompt(BaseModel):
    opener: Spoken | None = None
    question: Spoken


class CheckinTextBody(BaseModel):
    text: str


class AlertRef(BaseModel):
    id: int
    tier: Tier
    title: str
    sms_sent: bool


class CheckinResult(BaseModel):
    checkin_id: int
    transcript: str
    analysis: Analysis
    tier: Tier
    alert: AlertRef | None = None
    reply: Spoken


# ---------- caregiver dashboard ----------

class Status(BaseModel):
    tier: Tier
    headline: str
    updated_at: str


class ActiveAlert(BaseModel):
    id: int
    tier: Tier
    title: str
    summary: str
    note: str | None = None
    created_at: str
    sms_sent: bool
    why: list[str] = Field(default_factory=list)
    tone_note: str | None = None
    checkin_id: int | None = None


class AlertsLatest(BaseModel):
    """GET /api/alerts/latest: the caregiver app polls this every 3 seconds."""
    alert: ActiveAlert | None = None          # newest unhandled alert, or null
    latest_checkin_id: int | None = None      # changes whenever a new check-in lands; refetch the feed then
    updated_at: str


class Kpis(BaseModel):
    today_taken: int
    today_total: int
    on_time_pct_30d: int
    on_time_doses_30d: int
    doses_30d: int
    unprompted_this_week: int
    doses_this_week: int
    checkins_answered_14d: int


class MoodPoint(BaseModel):
    date: str
    score: float | None = None


class WeekValue(BaseModel):
    label: str
    value: int


class CalendarDay(BaseModel):
    date: str
    status: DayStatus


class CheckinRow(BaseModel):
    at: str
    quote: str                         # what the patient said, in their language
    tier: Tier
    tag: str
    id: int | None = None
    quote_en: str | None = None        # English, when they spoke another language
    symptoms: list[str] = Field(default_factory=list)
    tone_note: str | None = None
    why: list[str] = Field(default_factory=list)
    heard_audio: bool = False


class DashboardMed(BaseModel):
    id: str
    name: str
    dose: str | None = None
    purpose: str | None = None
    color: str | None = None
    schedule: str
    level: int
    always_remind: bool = False
    independence: int
    spark_14d: list[int] = Field(default_factory=list)
    last_taken: str | None = None


class Dashboard(BaseModel):
    status: Status
    active_alert: ActiveAlert | None = None
    kpis: Kpis
    mood_14d: list[MoodPoint]
    usual_range: list[float]
    unprompted_by_week: list[WeekValue]
    calendar_30d: list[CalendarDay]
    checkins: list[CheckinRow]
    medications: list[DashboardMed]
    interests: list[str]
