"""Check-in answer (any language, text and optionally the recording) -> Analysis.

Gemini does the reading, and when a recording is passed it also LISTENS (tone_note, mood_score, heard_audio).
A keyword pass runs on every check-in as a safety net, on the English version of what the patient said: its red flags
are always kept, and the final suggested tier is never lower than the keyword tier.
If Gemini fails, the keyword pass alone is returned, so a check-in never errors.

What the patient HEARS at the end (patient_reply_en) never mentions the caregiver, alerts or reports. The alert goes
to the caregiver silently. The one exception is an emergency: then the patient is told to call 911 or get help nearby.
Steady never assumes pronouns: summaries use the patient's preferred name.
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel

from app.contracts import Analysis, DoseConfirmation, MedBrief, PastCheckin
from app.prompts import ANALYZE_SYSTEM

from . import _gemini
from ._env import load_example, log, use_mocks
from .languages import language_name
from .translate import to_english

TIER_RANK = {"green": 0, "yellow": 1, "red": 2}

RED_FLAG_PATTERNS: list[tuple[str, str]] = [
    (r"\b(fell|fall(en)?|tripped|slipped)\b", "a fall"),
    (r"\bchest\b.*\b(pain|tight|hurt|pressure|heavy)|\b(pain|tight|pressure)\b.*\bchest\b", "chest pain or tightness"),
    (r"(can'?t|cannot|hard to|trouble|difficult(y)? to) breath|short(ness)? of breath|out of breath", "trouble breathing"),
    (r"\b(faint(ed)?|passed out|black(ed)? out)\b", "fainting"),
    (r"don'?t know where i am|where am i|i'?m lost", "confusion about where they are"),
    (r"\bslurr", "slurred speech"),
    (r"(one side|left side|right side).*(weak|numb)|(weak|numb).*(one side|left side|right side)", "weakness on one side"),
]

SYMPTOM_PATTERNS: list[tuple[str, str]] = [
    (r"dizz|light.?headed|room (is )?spinning|vertigo", "dizzy"),
    (r"\btired\b|exhausted|no energy|\bweak\b|sleepy|fatigue", "tired"),
    (r"appetite|not (very )?hungry|didn'?t eat|haven'?t eaten|couldn'?t eat", "no appetite"),
    (r"\bpain\b|\bhurts?\b|\bache\b|aching|\bsore\b", "pain"),
    (r"nause|sick to my stomach|vomit|threw up", "nausea"),
    (r"\bsad\b|feel(ing)? (low|down)|depressed|crying", "sad"),
    (r"lonely|alone all day", "lonely"),
]

MISSED_DOSE = re.compile(r"(forgot|didn'?t take|skipped|missed|haven'?t taken).{0,20}(pill|medicine|tablet|dose|it|them)", re.I)
TOOK_ALL = re.compile(r"\b(took|taken|had) (them|my pills|my medicines?|all|both|everything)\b", re.I)

# What the patient hears at the end. Never mentions the caregiver, reports or alerts.
# {name} is ", Asha" style (with the comma) or "" when no preferred name is set.
REPLIES = {
    "green": "Thank you{name}. It was lovely talking with you. Have a good {part}.",
    "yellow": "Thank you for telling me{name}. Take it easy and rest well. Have a good {part}.",
    "red": "{Name}please call 911 now, or ask someone near you for help right away.",
}

# A model-written closing line containing any of these is replaced with the warm template.
# The caregiver's own name is added per call (see _reporting_pattern).
_REPORTING_WORDS = (
    r"caregiver|care giver|family|grandson|granddaughter|son|daughter|husband|wife|doctor|nurse|911|emergency|"
    r"hospital|notif\w*|alert\w*|report\w*|inform\w*|let (him|her|them|\w+) know|tell (him|her|them)|"
    r"pass (it|this) on|share (this|it)"
)


def _reporting_pattern(caregiver_name: str = "") -> re.Pattern[str]:
    names = [re.escape(w) for w in re.findall(r"[^\W\d_]{2,}", caregiver_name or "")]
    words = "|".join([*names, _REPORTING_WORDS])
    return re.compile(rf"\b({words})\b", re.I)


def closing_line(tier: str, patient_name: str = "", part_of_day: str = "evening") -> str:
    name = (patient_name or "").strip()
    line = REPLIES[tier].format(name=f", {name}" if name else "", Name=f"{name}, " if name else "", part=part_of_day)
    return line[0].upper() + line[1:]


def safe_reply(reply: str | None, tier: str, patient_name: str, part_of_day: str, caregiver_name: str = "") -> str:
    """Emergency -> fixed 911 line. Otherwise keep the model's line unless it mentions reporting to anyone."""
    if tier == "red":
        return closing_line("red", patient_name, part_of_day)
    reply = (reply or "").strip()
    if not reply or len(reply) > 240 or _reporting_pattern(caregiver_name).search(reply):
        return closing_line(tier, patient_name, part_of_day)
    return reply


def _keyword_scan(text: str) -> tuple[list[str], list[str]]:
    t = text.lower()
    reds = [label for pattern, label in RED_FLAG_PATTERNS if re.search(pattern, t)]
    symptoms = [label for pattern, label in SYMPTOM_PATTERNS if re.search(pattern, t)]
    return reds, symptoms


def rules_analysis(transcript: str, meds: list[MedBrief], history: list[PastCheckin],
                   patient_name: str = "", part_of_day: str = "evening",
                   transcript_en: str | None = None) -> Analysis:
    """Deterministic keyword analysis on the English text. The fallback, and the safety net under Gemini."""
    english = (transcript_en or transcript).strip()
    reds, symptoms = _keyword_scan(english)
    earlier = {s for c in history for s in c.symptoms}
    repeated = [s for s in symptoms if s in earlier]
    missed = bool(MISSED_DOSE.search(english))

    tier: Literal["green", "yellow", "red"] = "red" if reds else ("yellow" if repeated or missed else "green")
    confirmations = [DoseConfirmation(med_id=m.id, taken=True) for m in meds] if TOOK_ALL.search(english) else []

    who = (patient_name or "").strip() or "The patient"
    quote = english if len(english) <= 160 else english[:157].rstrip() + "..."
    summary = f'{who} said: "{quote}"' if quote else f"{who} didn't say anything in this check-in."
    if repeated:
        summary += f" {who} also mentioned feeling {', '.join(repeated)} earlier this week."

    why = [f"Said: {r}" for r in reds]
    why += [f"{s.capitalize()} came up again (also earlier this week)" for s in repeated]
    if missed:
        why.append("Mentioned a missed dose")

    return Analysis(
        dose_confirmations=confirmations,
        symptoms=symptoms,
        red_flags=reds,
        orientation_ok=not any("confusion" in r for r in reds),
        mood_score=None,
        tone_note=None,
        suggested_tier=tier,
        transcript_en=english or None,
        why=why[:3],
        heard_audio=False,
        caregiver_summary=summary,
        patient_reply_en=closing_line(tier, patient_name, part_of_day),
    )


class _Dose(BaseModel):
    med_id: str
    taken: bool


class _Out(BaseModel):  # Gemini-facing schema: no defaults
    dose_confirmations: list[_Dose]
    symptoms: list[str]
    red_flags: list[str]
    orientation_ok: bool
    mood_score: float
    tone_note: str | None
    suggested_tier: Literal["green", "yellow", "red"]
    transcript_en: str
    why: list[str]
    caregiver_summary: str
    patient_reply_en: str


def _context(transcript: str, meds: list[MedBrief], history: list[PastCheckin], patient_name: str, lang: str) -> str:
    med_lines = "\n".join(
        f"- med_id={m.id}: {m.name} {m.dose or ''} ({m.purpose or 'purpose unknown'})" for m in meds
    ) or "- (none listed)"
    hist_lines = "\n".join(
        f"- {c.at}: symptoms={c.symptoms or 'none'}; said: \"{c.transcript[:200]}\"" for c in history[-7:]
    ) or "- (no earlier check-ins)"
    return (
        f"Patient's name: {patient_name or 'not given'}. Language: {language_name(lang)}.\n"
        f"Medicines:\n{med_lines}\n\n"
        f"Earlier check-ins this week:\n{hist_lines}\n\n"
        f"Steady just asked how they are feeling. The answer:\n\"\"\"{transcript.strip()}\"\"\""
    )


def analyze_checkin(transcript: str, meds: list[MedBrief], history: list[PastCheckin],
                    audio: bytes | None = None, patient_name: str = "",
                    lang: str = "en", part_of_day: str = "evening", caregiver_name: str = "") -> Analysis:
    """patient_name = the preferred name from the profile. caregiver_name keeps it out of the closing line.
    audio = the raw recording (WebM, MP4, WAV...). It is converted for Gemini, which then judges how they sound."""
    if use_mocks():
        return Analysis(**load_example("analysis"))

    english = to_english(transcript, lang)  # safety net runs on English
    base = rules_analysis(transcript, meds, history, patient_name, part_of_day, transcript_en=english)
    if not transcript.strip():
        return base

    try:
        parts: list = [_context(transcript, meds, history, patient_name, lang)]
        part = _gemini.audio_part(audio) if audio else None
        if part is not None:
            listen = ("Here is the recording of the answer. Listen to how they sound (pace, energy, clarity, "
                      "pauses) and use it for mood_score, tone_note and why.")
            parts += [listen, part]
        system = ANALYZE_SYSTEM.format(part_of_day=part_of_day)
        out = _gemini.generate_json(parts, _Out, system, temperature=0.2)
    except Exception:  # noqa: BLE001
        log.exception("analyze_checkin: Gemini failed, using keyword analysis")
        return base

    # Run the keyword net on Gemini's English too, in case to_english failed and returned the original.
    model_reds, _ = _keyword_scan(out.transcript_en or "")
    valid_ids = {m.id for m in meds}
    red_flags = list(dict.fromkeys([*base.red_flags, *model_reds, *(r.strip() for r in out.red_flags if r.strip())]))
    symptoms = list(dict.fromkeys([*(s.strip().lower() for s in out.symptoms if s.strip()), *base.symptoms]))

    tier = max(out.suggested_tier, base.suggested_tier, key=TIER_RANK.__getitem__)
    if red_flags:
        tier = "red"

    return Analysis(
        dose_confirmations=[DoseConfirmation(med_id=d.med_id, taken=d.taken)
                            for d in out.dose_confirmations if d.med_id in valid_ids] or base.dose_confirmations,
        symptoms=symptoms,
        red_flags=red_flags,
        orientation_ok=out.orientation_ok and base.orientation_ok,
        mood_score=round(min(10.0, max(0.0, out.mood_score)), 1),
        tone_note=(out.tone_note or None) if part is not None else None,
        suggested_tier=tier,
        transcript_en=(out.transcript_en or english or None),
        why=list(dict.fromkeys([*base.why, *(w.strip() for w in out.why if w.strip())]))[:3],
        heard_audio=part is not None,
        caregiver_summary=out.caregiver_summary.strip() or base.caregiver_summary,
        patient_reply_en=safe_reply(out.patient_reply_en, tier, patient_name, part_of_day, caregiver_name),
    )
