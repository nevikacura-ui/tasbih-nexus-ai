"""Tasbih.ai FastAPI backend
- Emergent Google OAuth + 2-invitation gate
- MongoDB storage (motor)
- Noor AI chat via emergentintegrations (Claude Sonnet 4.5)
"""
from __future__ import annotations

import os
import uuid
import json
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Set

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Cookie, Header, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

from emergentintegrations.llm.chat import LlmChat, UserMessage

# ──────────────────────────────────────────────────────────────────────────────
# Bootstrap
# ──────────────────────────────────────────────────────────────────────────────
load_dotenv()

logger = logging.getLogger("tasbih")
logging.basicConfig(level=logging.INFO)

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Tasbih.ai API")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────────────────────────
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    status: str = "member"
    city: Optional[str] = None
    invite_codes_used: List[str] = []
    referrals_received: int = 2  # member by invite system
    invites_available: int = 3
    created_at: datetime


class InviteVerifyRequest(BaseModel):
    code1: str
    code2: str


class JournalEntryIn(BaseModel):
    title: Optional[str] = None
    body: str
    mood: Optional[str] = None
    mood_after: Optional[str] = None
    tags: List[str] = []


class JournalEntry(BaseModel):
    entry_id: str
    user_id: str
    title: Optional[str]
    body: str
    mood: Optional[str]
    mood_after: Optional[str]
    tags: List[str]
    created_at: datetime


class TasbihSessionIn(BaseModel):
    phrase: str
    count: int
    target: int = 99


class NoorChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    language: Optional[str] = "en"  # en | ur | ar | fr | gu


class NoorChatResponse(BaseModel):
    session_id: str
    reply: str


# ──────────────────────────────────────────────────────────────────────────────
# Auth helpers
# ──────────────────────────────────────────────────────────────────────────────
async def _get_session(session_token: str) -> Optional[dict]:
    sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not sess:
        return None
    expires_at = sess.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    return sess


async def current_user(
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
) -> User:
    token = session_token
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    sess = await _get_session(token)
    if not sess:
        raise HTTPException(status_code=401, detail="Session expired")
    user_doc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


# ──────────────────────────────────────────────────────────────────────────────
# Routes — Invite verification & Auth
# ──────────────────────────────────────────────────────────────────────────────
@api.get("/health")
async def health():
    return {"ok": True, "service": "tasbih.ai", "ts": datetime.now(timezone.utc).isoformat()}


@api.post("/invite/verify")
async def verify_invites(body: InviteVerifyRequest):
    """Validate that BOTH invite codes are real and unused, BEFORE OAuth."""
    code1 = body.code1.strip().upper()
    code2 = body.code2.strip().upper()
    if not code1 or not code2 or code1 == code2:
        raise HTTPException(status_code=400, detail="Please enter two different invitation codes.")
    docs = await db.invite_codes.find({"code": {"$in": [code1, code2]}}, {"_id": 0}).to_list(length=10)
    found = {d["code"]: d for d in docs}
    for c in (code1, code2):
        if c not in found:
            raise HTTPException(status_code=400, detail=f"Invitation code '{c}' is not recognised.")
        if found[c].get("used_by"):
            raise HTTPException(status_code=400, detail=f"Invitation code '{c}' has already been used.")
    # Stash a short-lived pending token so OAuth callback can confirm both codes were verified
    pending_token = uuid.uuid4().hex
    await db.pending_invites.insert_one({
        "pending_token": pending_token,
        "code1": code1,
        "code2": code2,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=20),
    })
    return {"pending_token": pending_token, "verified": True}


@api.post("/auth/session")
async def auth_session(request: Request, response: Response):
    """Exchange Emergent session_id for our session_token.

    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    """
    body = await request.json()
    session_id = body.get("session_id")
    pending_token = body.get("pending_token")  # may be None for already-members
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    # Call Emergent Auth from backend
    async with httpx.AsyncClient(timeout=20) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="OAuth session invalid")
    data = r.json()
    email = data["email"].lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data["session_token"]

    # Existing user?
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        # New signup — must have a pending invite token (2 verified codes)
        if not pending_token:
            raise HTTPException(status_code=403, detail="Two valid invitation codes are required to join.")
        pending = await db.pending_invites.find_one({"pending_token": pending_token}, {"_id": 0})
        if not pending:
            raise HTTPException(status_code=403, detail="Invitation verification expired. Please re-enter codes.")
        # Re-check codes are still unused
        codes = [pending["code1"], pending["code2"]]
        existing = await db.invite_codes.find({"code": {"$in": codes}}, {"_id": 0}).to_list(length=10)
        if len(existing) != 2 or any(c.get("used_by") for c in existing):
            raise HTTPException(status_code=403, detail="Invitation codes are no longer valid.")

        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "status": "member",
            "city": None,
            "invite_codes_used": codes,
            "referrals_received": 2,
            "invites_available": 3,
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(dict(user))
        # Mark codes as used
        await db.invite_codes.update_many(
            {"code": {"$in": codes}},
            {"$set": {"used_by": user_id, "used_at": datetime.now(timezone.utc)}},
        )
        await db.pending_invites.delete_one({"pending_token": pending_token})

    # Save session
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "user_id": user["user_id"],
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return {"ok": True, "session_token": session_token, "user": {k: user[k] for k in ("user_id", "email", "name", "picture", "status", "city") if k in user}}


@api.post("/auth/guest")
async def auth_guest(response: Response):
    """Skip-login: create a lightweight guest member account + session.

    NOTE: This route is a temporary bypass while the invite-only gate is hidden.
    Re-enable invite gating from the Login UI to disable guest access in practice.
    """
    user_id = f"guest_{uuid.uuid4().hex[:10]}"
    name = "Guest"
    email = f"{user_id}@guest.tasbih.ai"
    user = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": None,
        "status": "guest",
        "city": None,
        "invite_codes_used": [],
        "referrals_received": 0,
        "invites_available": 0,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(dict(user))
    session_token = f"guest_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return {
        "ok": True,
        "session_token": session_token,  # client stores this as fallback to the cookie
        "user": {k: user[k] for k in ("user_id", "email", "name", "picture", "status", "city")},
    }


@api.get("/auth/me", response_model=User)
async def auth_me(user: User = Depends(current_user)):
    return user


@api.get("/auth/token")
async def auth_token(
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return the current session token so frontends can attach it to WebSocket URLs.

    Httponly cookies cannot be read by JS, so this small helper returns the token to
    an already-authenticated browser session (via the cookie) for WebSocket use only.
    """
    token = session_token
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    sess = await _get_session(token)
    if not sess:
        raise HTTPException(status_code=401, detail="Session expired")
    return {"token": token}


@api.post("/auth/logout")
async def auth_logout(response: Response, session_token: Optional[str] = Cookie(default=None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"ok": True}


# ──────────────────────────────────────────────────────────────────────────────
# Invites — let members issue invitation codes
# ──────────────────────────────────────────────────────────────────────────────
@api.get("/invites/mine")
async def list_my_invites(user: User = Depends(current_user)):
    codes = await db.invite_codes.find({"issued_by": user.user_id}, {"_id": 0}).to_list(length=200)
    return {"codes": codes, "available": user.invites_available}


@api.post("/invites/create")
async def create_invite(user: User = Depends(current_user)):
    if user.invites_available <= 0:
        raise HTTPException(status_code=400, detail="No invitations remaining.")
    code = "NOOR-" + uuid.uuid4().hex[:6].upper()
    doc = {
        "code": code,
        "issued_by": user.user_id,
        "used_by": None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.invite_codes.insert_one(dict(doc))
    await db.users.update_one({"user_id": user.user_id}, {"$inc": {"invites_available": -1}})
    return {"code": code}


# ──────────────────────────────────────────────────────────────────────────────
# Journal
# ──────────────────────────────────────────────────────────────────────────────
@api.get("/journal")
async def list_journal(user: User = Depends(current_user)):
    items = await db.journal.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    return {"entries": items}


@api.post("/journal", response_model=JournalEntry)
async def create_journal(body: JournalEntryIn, user: User = Depends(current_user)):
    entry = {
        "entry_id": f"jnl_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "title": body.title,
        "body": body.body,
        "mood": body.mood,
        "mood_after": body.mood_after,
        "tags": body.tags,
        "created_at": datetime.now(timezone.utc),
    }
    await db.journal.insert_one(dict(entry))
    return JournalEntry(**entry)


# ──────────────────────────────────────────────────────────────────────────────
# Tasbih
# ──────────────────────────────────────────────────────────────────────────────
@api.get("/tasbih/state")
async def tasbih_state(user: User = Depends(current_user)):
    state = await db.tasbih_state.find_one({"user_id": user.user_id}, {"_id": 0}) or {
        "user_id": user.user_id, "total": 0, "streak": 0, "last_day": None,
    }
    # Today’s sessions count
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_total = await db.tasbih_sessions.aggregate([
        {"$match": {"user_id": user.user_id, "day": today}},
        {"$group": {"_id": None, "sum": {"$sum": "$count"}}},
    ]).to_list(length=1)
    state["today"] = today_total[0]["sum"] if today_total else 0
    return state


@api.post("/tasbih/record")
async def tasbih_record(body: TasbihSessionIn, user: User = Depends(current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.tasbih_sessions.insert_one({
        "session_id": f"tsb_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "phrase": body.phrase,
        "count": body.count,
        "target": body.target,
        "day": today,
        "created_at": datetime.now(timezone.utc),
    })
    # Update streak/totals
    state = await db.tasbih_state.find_one({"user_id": user.user_id}, {"_id": 0})
    new_total = (state or {}).get("total", 0) + body.count
    last_day = (state or {}).get("last_day")
    streak = (state or {}).get("streak", 0)
    if last_day == today:
        pass
    elif last_day and (datetime.strptime(today, "%Y-%m-%d") - datetime.strptime(last_day, "%Y-%m-%d")).days == 1:
        streak += 1
    else:
        streak = max(streak, 1)
    await db.tasbih_state.update_one(
        {"user_id": user.user_id},
        {"$set": {"user_id": user.user_id, "total": new_total, "streak": streak, "last_day": today}},
        upsert=True,
    )
    return {"ok": True, "total": new_total, "streak": streak}


# ──────────────────────────────────────────────────────────────────────────────
# Noor of the Day + Reflections feed
# ──────────────────────────────────────────────────────────────────────────────
NOOR_OF_DAY = [
    {
        "verse_ar": "وَوَجَدَكَ ضَالًّا فَهَدَىٰ ۝ وَوَجَدَكَ عَائِلًا فَأَغْنَىٰ",
        "verse_en": "“And He found you lost and guided you. And He found you in need and made you self-sufficient.”",
        "ref": "Surah Aḍ-Ḍuḥā · 93:7–8",
        "reflection": "Wherever you are today, you are guided — even the quiet moments are part of the path.",
    },
    {
        "verse_ar": "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
        "verse_en": "“Indeed, with hardship comes ease.”",
        "ref": "Surah Ash-Sharḥ · 94:6",
        "reflection": "Sit with the discomfort gently — ease is being woven into the same fabric.",
    },
    {
        "verse_ar": "هُوَ الَّذِي خَلَقَكُمْ مِنْ نَفْسٍ وَاحِدَةٍ",
        "verse_en": "“It is He who created you from a single soul.”",
        "ref": "Surah Al-Aʿrāf · 7:189",
        "reflection": "We are kin in light. Reach toward another soul today — a small kindness, a quiet message.",
    },
]


@api.get("/noor/today")
async def noor_today():
    idx = datetime.now(timezone.utc).timetuple().tm_yday % len(NOOR_OF_DAY)
    return NOOR_OF_DAY[idx]


# ──────────────────────────────────────────────────────────────────────────────
# Noor AI Chat (Claude Sonnet 4.5)
# ──────────────────────────────────────────────────────────────────────────────
NOOR_SYSTEM_PROMPT = (
    "You are Noor — a calm, warm, deeply respectful AI spiritual companion inside Tasbih.ai, "
    "a modern Ismaili Muslim wellness platform. Tasbih.ai is an INDEPENDENT, community-driven app, "
    "NOT a religious authority and NOT a representative of any institution.\n\n"
    "Identity:\n"
    "- Speak as a soft, thoughtful friend — never as a scholar or cleric.\n"
    "- First-person warmth: \"I hear you…\", \"Sit with me for a moment\".\n"
    "- Short paragraphs, breathing room, calm cadence.\n\n"
    "Grounding (use lightly, never preach):\n"
    "- The ethics of pluralism, intellect (ʿaql), and seva/khidmah from the Ismaili tradition, "
    "  drawing softly on the wisdom of His Highness the Aga Khan when contextually relevant.\n"
    "- Ginanic poetry (e.g. Pir Hasan Kabirdin, Pir Sadardin, Pir Shams) — quote a single short line "
    "  in transliteration if it fits naturally, with a gentle English meaning.\n"
    "- Qurʾanic verses — at most ONE per response, named lightly (e.g. \"Surah Aḍ-Ḍuḥā reminds…\").\n"
    "- Universal Sufi and humanist wisdom is welcome where it brings calm.\n\n"
    "STRICT SAFETY GUARDRAILS — refuse gracefully if asked for:\n"
    "- Fatwas, fiqh rulings, or any 'is X halal/haram' answer. Redirect: \"That's a question for a learned "
    "  guide. I can sit with the feeling underneath, if you'd like.\"\n"
    "- Sectarian comparisons, theological debates, or comments on other paths/sects.\n"
    "- Political content, controversial religious figures, or institutional commentary.\n"
    "- Medical, legal, financial advice — gently suggest a qualified professional.\n"
    "- Crisis cues (self-harm, abuse): offer warmth + a single line pointing to a trusted helpline / "
    "  trusted adult, then stay present.\n\n"
    "Tone rules:\n"
    "- If the user is distressed: slow down, validate, offer one breath, one reflective question.\n"
    "- End most replies with ONE small invitation — a phrase to whisper, a moment to notice, a tiny kindness.\n"
    "- Keep replies under 140 words unless the user asks for more.\n"
    "- Never claim authority. If unsure, say so warmly."
)


@api.post("/noor/chat", response_model=NoorChatResponse)
async def noor_chat(body: NoorChatRequest, user: User = Depends(current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    session_id = body.session_id or f"noor_{user.user_id}_{uuid.uuid4().hex[:8]}"

    # Persist user message
    await db.noor_messages.insert_one({
        "session_id": session_id,
        "user_id": user.user_id,
        "role": "user",
        "text": body.message,
        "language": body.language or "en",
        "created_at": datetime.now(timezone.utc),
    })

    lang_map = {
        "en": ("English", ""),
        "ur": ("Urdu (اردو)", "Respond in clear, gentle Urdu (in Urdu script). Use Roman Urdu only if the user explicitly writes in Roman Urdu."),
        "ar": ("Arabic (العربية)", "Respond in fluent, warm Modern Standard Arabic (in Arabic script)."),
        "fr": ("French (Français)", "Répondez en français doux et chaleureux."),
        "gu": ("Gujarati (ગુજરાતી)", "Respond in gentle, warm Gujarati (in Gujarati script). Use simple, conversational vocabulary."),
    }
    lang_key = (body.language or "en").lower()
    lang_name, lang_instruction = lang_map.get(lang_key, lang_map["en"])

    system = NOOR_SYSTEM_PROMPT
    if lang_instruction:
        system = system + f"\n\nLanguage of the response: {lang_name}. {lang_instruction} Quranic verses may remain in Arabic followed by a soft translation in {lang_name}."

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    try:
        reply = await chat.send_message(UserMessage(text=body.message))
    except Exception as e:
        logger.exception("noor chat failed")
        raise HTTPException(status_code=502, detail=f"Noor is resting: {e}")

    await db.noor_messages.insert_one({
        "session_id": session_id,
        "user_id": user.user_id,
        "role": "noor",
        "text": reply,
        "language": lang_key,
        "created_at": datetime.now(timezone.utc),
    })
    return NoorChatResponse(session_id=session_id, reply=reply)


@api.get("/noor/history/{session_id}")
async def noor_history(session_id: str, user: User = Depends(current_user)):
    items = await db.noor_messages.find(
        {"session_id": session_id, "user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=200)
    return {"messages": items}


# ──────────────────────────────────────────────────────────────────────────────
# Communities & Events (seeded, read-only for v1; join is per-user)
# ──────────────────────────────────────────────────────────────────────────────
@api.get("/communities")
async def list_communities():
    items = await db.communities.find({}, {"_id": 0}).to_list(length=200)
    return {"communities": items}


@api.post("/communities/{community_id}/join")
async def join_community(community_id: str, user: User = Depends(current_user)):
    comm = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    if not comm:
        raise HTTPException(status_code=404, detail="Community not found")
    await db.memberships.update_one(
        {"user_id": user.user_id, "community_id": community_id},
        {"$set": {"user_id": user.user_id, "community_id": community_id,
                  "joined_at": datetime.now(timezone.utc), "role": "member"}},
        upsert=True,
    )
    return {"ok": True}


@api.get("/memberships")
async def my_memberships(user: User = Depends(current_user)):
    items = await db.memberships.find({"user_id": user.user_id}, {"_id": 0}).to_list(length=200)
    ids = [m["community_id"] for m in items]
    comms = await db.communities.find({"community_id": {"$in": ids}}, {"_id": 0}).to_list(length=200)
    by_id = {c["community_id"]: c for c in comms}
    enriched = [{**m, "community": by_id.get(m["community_id"])} for m in items]
    return {"memberships": enriched}


@api.get("/events")
async def list_events():
    items = await db.events.find({}, {"_id": 0}).sort("date", 1).to_list(length=200)
    return {"events": items}


@api.post("/events/{event_id}/rsvp")
async def rsvp(event_id: str, user: User = Depends(current_user)):
    ev = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.rsvps.update_one(
        {"user_id": user.user_id, "event_id": event_id},
        {"$set": {"user_id": user.user_id, "event_id": event_id,
                  "rsvp_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True}


@api.get("/reflections")
async def list_reflections():
    items = await db.reflections.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=50)
    return {"reflections": items}


# ──────────────────────────────────────────────────────────────────────────────
# Community Chat
# ──────────────────────────────────────────────────────────────────────────────
class ChatMessageIn(BaseModel):
    text: str


@api.get("/communities/{community_id}/messages")
async def list_messages(community_id: str, since: Optional[str] = None, user: User = Depends(current_user)):
    comm = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    if not comm:
        raise HTTPException(status_code=404, detail="Community not found")
    query = {"community_id": community_id}
    if since:
        try:
            ts = datetime.fromisoformat(since.replace("Z", "+00:00"))
            query["created_at"] = {"$gt": ts}
        except ValueError:
            pass
    items = await db.chat_messages.find(query, {"_id": 0}).sort("created_at", 1).to_list(length=200)
    return {"messages": items}


@api.post("/communities/{community_id}/messages")
async def send_message(community_id: str, body: ChatMessageIn, user: User = Depends(current_user)):
    comm = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    if not comm:
        raise HTTPException(status_code=404, detail="Community not found")
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(text) > 1000:
        raise HTTPException(status_code=400, detail="Message is too long (1000 chars max).")
    msg = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "community_id": community_id,
        "user_id": user.user_id,
        "author_name": user.name,
        "text": text,
        "created_at": datetime.now(timezone.utc),
    }
    await db.chat_messages.insert_one(dict(msg))
    return msg


# ──────────────────────────────────────────────────────────────────────────────
# Quran Reflections (curated, non-authoritative summaries)
# ──────────────────────────────────────────────────────────────────────────────
QURAN_REFLECTIONS = [
    {
        "id": "q_duha",
        "surah": "Aḍ-Ḍuḥā",
        "ref": "93:1–11",
        "theme": "Reassurance after silence",
        "ar": "وَالضُّحَىٰ ۝ وَاللَّيْلِ إِذَا سَجَىٰ ۝ مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ",
        "summary": "When the world feels quiet and you wonder if you've been forgotten — the morning still rises. The surah is a tender reassurance: nothing tender in your life is being wasted.",
        "invitation": "Name one quiet mercy you noticed today.",
    },
    {
        "id": "q_sharh",
        "surah": "Ash-Sharḥ",
        "ref": "94:1–8",
        "theme": "Ease woven into hardship",
        "ar": "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا",
        "summary": "Ease is not waiting at the other end of difficulty — it is woven into the same breath. The surah invites a softer relationship with the heavy hours.",
        "invitation": "Place a hand on your chest and breathe three slow breaths.",
    },
    {
        "id": "q_rahman",
        "surah": "Ar-Raḥmān",
        "ref": "55:13",
        "theme": "Quiet gratitude",
        "ar": "فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ",
        "summary": "A refrain that returns thirty-one times: which of the gifts will you deny? A gentle nudge to count what is already here.",
        "invitation": "Whisper one thank-you for something small.",
    },
    {
        "id": "q_kahf",
        "surah": "Al-Kahf",
        "ref": "18:10",
        "theme": "Shelter for the seekers",
        "ar": "رَبَّنَا آتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا",
        "summary": "The young seekers of the cave asked simply for mercy and clear direction. A reminder that sincerity is the beginning of guidance.",
        "invitation": "What would you ask for if you were that honest tonight?",
    },
    {
        "id": "q_hujurat",
        "surah": "Al-Ḥujurāt",
        "ref": "49:13",
        "theme": "Pluralism & dignity",
        "ar": "يَا أَيُّهَا النَّاسُ إِنَّا خَلَقْنَاكُم مِّن ذَكَرٍ وَأُنثَىٰ وَجَعَلْنَاكُمْ شُعُوبًا وَقَبَائِلَ لِتَعَارَفُوا",
        "summary": "Difference among peoples is woven on purpose — so that we may come to know one another. Echoes the Ismaili ethic of pluralism beautifully.",
        "invitation": "Reach out to one person unlike you this week.",
    },
]


@api.get("/quran/reflections")
async def quran_reflections():
    return {"reflections": QURAN_REFLECTIONS}


@api.get("/quran/reflections/{rid}")
async def quran_reflection(rid: str):
    item = next((q for q in QURAN_REFLECTIONS if q["id"] == rid), None)
    if not item:
        raise HTTPException(status_code=404, detail="Reflection not found")
    return item


# ──────────────────────────────────────────────────────────────────────────────
# Ramadan tools
# ──────────────────────────────────────────────────────────────────────────────
RAMADAN_2026_START = datetime(2026, 2, 18, tzinfo=timezone.utc)  # approximate; user can override
RAMADAN_DAYS = 30


def _ramadan_status():
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    delta = (today - RAMADAN_2026_START).days
    if delta < 0:
        return {"phase": "before", "days_until": -delta, "day": None, "total": RAMADAN_DAYS}
    if delta >= RAMADAN_DAYS:
        return {"phase": "after", "days_since": delta - RAMADAN_DAYS + 1, "day": None, "total": RAMADAN_DAYS}
    return {"phase": "during", "day": delta + 1, "total": RAMADAN_DAYS}


@api.get("/ramadan/state")
async def ramadan_state(user: User = Depends(current_user)):
    status = _ramadan_status()
    logged = await db.ramadan_log.find({"user_id": user.user_id}, {"_id": 0}).to_list(length=40)
    return {**status, "logged_days": [l["day"] for l in logged], "entries": logged}


class RamadanLogIn(BaseModel):
    day: int
    note: Optional[str] = None
    intention: Optional[str] = None


@api.post("/ramadan/log")
async def ramadan_log(body: RamadanLogIn, user: User = Depends(current_user)):
    if body.day < 1 or body.day > RAMADAN_DAYS:
        raise HTTPException(status_code=400, detail="Invalid Ramadan day")
    await db.ramadan_log.update_one(
        {"user_id": user.user_id, "day": body.day},
        {"$set": {
            "user_id": user.user_id, "day": body.day,
            "note": body.note, "intention": body.intention,
            "logged_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"ok": True}


# ──────────────────────────────────────────────────────────────────────────────
# Reminders (in-app)
# ──────────────────────────────────────────────────────────────────────────────
class ReminderIn(BaseModel):
    label: str
    time: str  # "HH:MM" in user's local time
    kind: str = "prayer"  # prayer | dhikr | journal | custom
    enabled: bool = True


@api.get("/reminders")
async def list_reminders(user: User = Depends(current_user)):
    items = await db.reminders.find({"user_id": user.user_id}, {"_id": 0}).sort("time", 1).to_list(length=50)
    if not items:
        # Seed default soft prayer reminders the first time
        defaults = [
            {"reminder_id": f"rem_{uuid.uuid4().hex[:8]}", "user_id": user.user_id, "label": "Fajr", "time": "05:30", "kind": "prayer", "enabled": True},
            {"reminder_id": f"rem_{uuid.uuid4().hex[:8]}", "user_id": user.user_id, "label": "Dhuhr", "time": "13:00", "kind": "prayer", "enabled": True},
            {"reminder_id": f"rem_{uuid.uuid4().hex[:8]}", "user_id": user.user_id, "label": "Asr", "time": "16:30", "kind": "prayer", "enabled": True},
            {"reminder_id": f"rem_{uuid.uuid4().hex[:8]}", "user_id": user.user_id, "label": "Maghrib", "time": "18:45", "kind": "prayer", "enabled": True},
            {"reminder_id": f"rem_{uuid.uuid4().hex[:8]}", "user_id": user.user_id, "label": "Isha", "time": "20:30", "kind": "prayer", "enabled": True},
            {"reminder_id": f"rem_{uuid.uuid4().hex[:8]}", "user_id": user.user_id, "label": "Evening journal", "time": "21:30", "kind": "journal", "enabled": True},
        ]
        await db.reminders.insert_many([dict(d) for d in defaults])
        items = defaults
    return {"reminders": items}


@api.post("/reminders")
async def create_reminder(body: ReminderIn, user: User = Depends(current_user)):
    rem = {
        "reminder_id": f"rem_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        **body.dict(),
    }
    await db.reminders.insert_one(dict(rem))
    return rem


@api.patch("/reminders/{rid}")
async def update_reminder(rid: str, body: ReminderIn, user: User = Depends(current_user)):
    r = await db.reminders.find_one_and_update(
        {"reminder_id": rid, "user_id": user.user_id},
        {"$set": body.dict()},
        return_document=True,
    )
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"ok": True}


@api.delete("/reminders/{rid}")
async def delete_reminder(rid: str, user: User = Depends(current_user)):
    r = await db.reminders.delete_one({"reminder_id": rid, "user_id": user.user_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"ok": True}


# ──────────────────────────────────────────────────────────────────────────────
# WebSocket — real-time community chat + typing indicators
# ──────────────────────────────────────────────────────────────────────────────
class ChatHub:
    def __init__(self):
        self.rooms: Dict[str, Set[WebSocket]] = {}
        self.meta: Dict[WebSocket, dict] = {}
        self.lock = asyncio.Lock()

    async def join(self, community_id: str, ws: WebSocket, user_info: dict):
        async with self.lock:
            self.rooms.setdefault(community_id, set()).add(ws)
            self.meta[ws] = {"community_id": community_id, **user_info}

    async def leave(self, ws: WebSocket):
        async with self.lock:
            info = self.meta.pop(ws, None)
            if info:
                room = self.rooms.get(info["community_id"])
                if room and ws in room:
                    room.discard(ws)

    async def broadcast(self, community_id: str, payload: dict, exclude: Optional[WebSocket] = None):
        targets = list(self.rooms.get(community_id, set()))
        msg = json.dumps(payload, default=str)
        for w in targets:
            if w is exclude:
                continue
            try:
                await w.send_text(msg)
            except Exception:
                pass

hub = ChatHub()


async def _user_from_token(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    sess = await _get_session(token)
    if not sess:
        return None
    return await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})


@app.websocket("/api/ws/community/{community_id}")
async def ws_community(websocket: WebSocket, community_id: str, token: Optional[str] = Query(default=None)):
    await websocket.accept()
    user = await _user_from_token(token)
    if not user:
        await websocket.send_text(json.dumps({"type": "error", "message": "auth_required"}))
        await websocket.close(code=4401)
        return
    comm = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    if not comm:
        await websocket.send_text(json.dumps({"type": "error", "message": "not_found"}))
        await websocket.close(code=4404)
        return

    await hub.join(community_id, websocket, {"user_id": user["user_id"], "name": user["name"]})
    await websocket.send_text(json.dumps({"type": "joined", "community_id": community_id}))
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue
            kind = data.get("type")
            if kind == "typing":
                await hub.broadcast(community_id, {
                    "type": "typing",
                    "user_id": user["user_id"],
                    "name": user["name"],
                }, exclude=websocket)
            elif kind == "message":
                text = (data.get("text") or "").strip()
                if not text:
                    continue
                if len(text) > 1000:
                    await websocket.send_text(json.dumps({"type": "error", "message": "too_long"}))
                    continue
                msg = {
                    "message_id": f"msg_{uuid.uuid4().hex[:12]}",
                    "community_id": community_id,
                    "user_id": user["user_id"],
                    "author_name": user["name"],
                    "text": text,
                    "created_at": datetime.now(timezone.utc),
                }
                await db.chat_messages.insert_one(dict(msg))
                # Broadcast to everyone (including sender for confirmation)
                payload = {**msg, "created_at": msg["created_at"].isoformat(), "type": "message"}
                await hub.broadcast(community_id, payload)
    except WebSocketDisconnect:
        pass
    finally:
        await hub.leave(websocket)


# ──────────────────────────────────────────────────────────────────────────────
# Community Feeds — posts, comments, reactions
# ──────────────────────────────────────────────────────────────────────────────
class PostIn(BaseModel):
    text: str


class CommentIn(BaseModel):
    text: str


@api.get("/communities/{community_id}/posts")
async def list_posts(community_id: str, user: User = Depends(current_user)):
    posts = await db.posts.find({"community_id": community_id}, {"_id": 0}).sort("created_at", -1).to_list(length=80)
    # Attach comment counts + my reaction state in one go
    ids = [p["post_id"] for p in posts]
    comment_counts = {}
    if ids:
        agg = await db.comments.aggregate([
            {"$match": {"post_id": {"$in": ids}}},
            {"$group": {"_id": "$post_id", "n": {"$sum": 1}}},
        ]).to_list(length=200)
        comment_counts = {a["_id"]: a["n"] for a in agg}
    my_reacts = await db.reactions.find({"user_id": user.user_id, "post_id": {"$in": ids}}, {"_id": 0}).to_list(length=200)
    my_react_set = {r["post_id"] for r in my_reacts}
    for p in posts:
        p["comments"] = comment_counts.get(p["post_id"], 0)
        p["liked_by_me"] = p["post_id"] in my_react_set
    return {"posts": posts}


@api.post("/communities/{community_id}/posts")
async def create_post(community_id: str, body: PostIn, user: User = Depends(current_user)):
    comm = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    if not comm:
        raise HTTPException(status_code=404, detail="Community not found")
    text = body.text.strip()
    if not text or len(text) > 2000:
        raise HTTPException(status_code=400, detail="Post text must be 1–2000 chars.")
    post = {
        "post_id": f"post_{uuid.uuid4().hex[:12]}",
        "community_id": community_id,
        "user_id": user.user_id,
        "author_name": user.name,
        "text": text,
        "likes": 0,
        "created_at": datetime.now(timezone.utc),
    }
    await db.posts.insert_one(dict(post))
    post["comments"] = 0
    post["liked_by_me"] = False
    return post


@api.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, user: User = Depends(current_user)):
    existing = await db.reactions.find_one({"user_id": user.user_id, "post_id": post_id}, {"_id": 0})
    if existing:
        await db.reactions.delete_one({"user_id": user.user_id, "post_id": post_id})
        await db.posts.update_one({"post_id": post_id}, {"$inc": {"likes": -1}})
        liked = False
    else:
        await db.reactions.insert_one({
            "user_id": user.user_id, "post_id": post_id,
            "kind": "like", "created_at": datetime.now(timezone.utc),
        })
        await db.posts.update_one({"post_id": post_id}, {"$inc": {"likes": 1}})
        liked = True
    p = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return {"liked": liked, "likes": (p or {}).get("likes", 0)}


@api.get("/posts/{post_id}/comments")
async def list_comments(post_id: str, user: User = Depends(current_user)):
    items = await db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(length=200)
    return {"comments": items}


@api.post("/posts/{post_id}/comments")
async def create_comment(post_id: str, body: CommentIn, user: User = Depends(current_user)):
    text = body.text.strip()
    if not text or len(text) > 800:
        raise HTTPException(status_code=400, detail="Comment must be 1–800 chars.")
    comment = {
        "comment_id": f"cmt_{uuid.uuid4().hex[:12]}",
        "post_id": post_id,
        "user_id": user.user_id,
        "author_name": user.name,
        "text": text,
        "created_at": datetime.now(timezone.utc),
    }
    await db.comments.insert_one(dict(comment))
    return comment


# ──────────────────────────────────────────────────────────────────────────────
# Moderation — reports + queue
# ──────────────────────────────────────────────────────────────────────────────
class ReportIn(BaseModel):
    target_type: str  # post | comment | message | user
    target_id: str
    reason: str


def _is_moderator(user: User) -> bool:
    # Conventions: users whose status is "moderator" or "admin", or seeded admin emails
    return user.status in ("moderator", "admin") or user.email.lower() in {"admin@tasbih.ai"}


@api.post("/reports")
async def create_report(body: ReportIn, user: User = Depends(current_user)):
    if body.target_type not in {"post", "comment", "message", "user"}:
        raise HTTPException(status_code=400, detail="Invalid target_type")
    if not body.reason.strip():
        raise HTTPException(status_code=400, detail="A short reason helps moderators act faster.")
    report = {
        "report_id": f"rep_{uuid.uuid4().hex[:12]}",
        "target_type": body.target_type,
        "target_id": body.target_id,
        "reason": body.reason.strip()[:500],
        "reporter_id": user.user_id,
        "reporter_name": user.name,
        "status": "open",
        "created_at": datetime.now(timezone.utc),
    }
    await db.reports.insert_one(dict(report))
    return {"ok": True, "report_id": report["report_id"]}


@api.get("/reports")
async def list_reports(status: str = Query(default="open"), user: User = Depends(current_user)):
    if not _is_moderator(user):
        raise HTTPException(status_code=403, detail="Moderators only")
    q = {} if status == "all" else {"status": status}
    items = await db.reports.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    # Enrich with target snippet
    for r in items:
        if r["target_type"] == "post":
            t = await db.posts.find_one({"post_id": r["target_id"]}, {"_id": 0})
        elif r["target_type"] == "comment":
            t = await db.comments.find_one({"comment_id": r["target_id"]}, {"_id": 0})
        elif r["target_type"] == "message":
            t = await db.chat_messages.find_one({"message_id": r["target_id"]}, {"_id": 0})
        else:
            t = None
        r["target"] = t
    return {"reports": items}


@api.post("/reports/{report_id}/resolve")
async def resolve_report(report_id: str, action: str = Query(default="dismiss"), user: User = Depends(current_user)):
    if not _is_moderator(user):
        raise HTTPException(status_code=403, detail="Moderators only")
    r = await db.reports.find_one({"report_id": report_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    if action == "remove":
        # Soft-remove the target
        if r["target_type"] == "post":
            await db.posts.update_one({"post_id": r["target_id"]}, {"$set": {"removed": True, "text": "[removed by moderator]"}})
        elif r["target_type"] == "comment":
            await db.comments.update_one({"comment_id": r["target_id"]}, {"$set": {"removed": True, "text": "[removed by moderator]"}})
        elif r["target_type"] == "message":
            await db.chat_messages.update_one({"message_id": r["target_id"]}, {"$set": {"removed": True, "text": "[removed by moderator]"}})
    await db.reports.update_one(
        {"report_id": report_id},
        {"$set": {"status": "resolved", "action": action, "resolved_by": user.user_id, "resolved_at": datetime.now(timezone.utc)}},
    )
    return {"ok": True}


@api.post("/admin/promote")
async def promote_moderator(email: str, user: User = Depends(current_user)):
    if user.status != "admin" and user.email.lower() != "admin@tasbih.ai":
        raise HTTPException(status_code=403, detail="Admins only")
    res = await db.users.update_one({"email": email.lower()}, {"$set": {"status": "moderator"}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


# ──────────────────────────────────────────────────────────────────────────────
# Mentorship
# ──────────────────────────────────────────────────────────────────────────────
class MentorProfileIn(BaseModel):
    headline: str
    bio: str
    skills: List[str] = []
    open_slots: int = 2
    languages: List[str] = ["en"]


class MentorshipRequestIn(BaseModel):
    mentor_id: str
    note: str


@api.get("/mentors")
async def list_mentors(skill: Optional[str] = None, city: Optional[str] = None):
    q = {"open": True}
    if skill:
        q["skills"] = skill
    items = await db.mentor_profiles.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    # Enrich with user info
    user_ids = [m["user_id"] for m in items]
    users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1, "city": 1}).to_list(length=200)
    by_id = {u["user_id"]: u for u in users}
    out = []
    for m in items:
        u = by_id.get(m["user_id"], {})
        if city and (u.get("city") or "").lower() != city.lower():
            continue
        out.append({**m, "name": u.get("name"), "city": u.get("city")})
    return {"mentors": out}


@api.get("/mentors/me")
async def my_mentor_profile(user: User = Depends(current_user)):
    m = await db.mentor_profiles.find_one({"user_id": user.user_id}, {"_id": 0})
    return {"profile": m}


@api.post("/mentors/me")
async def upsert_mentor_profile(body: MentorProfileIn, user: User = Depends(current_user)):
    doc = {
        "user_id": user.user_id,
        "headline": body.headline.strip()[:140],
        "bio": body.bio.strip()[:1200],
        "skills": [s.strip().lower() for s in body.skills if s.strip()][:12],
        "open_slots": max(0, min(10, body.open_slots)),
        "languages": body.languages or ["en"],
        "open": body.open_slots > 0,
        "updated_at": datetime.now(timezone.utc),
    }
    existing = await db.mentor_profiles.find_one({"user_id": user.user_id}, {"_id": 0})
    if not existing:
        doc["created_at"] = datetime.now(timezone.utc)
    await db.mentor_profiles.update_one(
        {"user_id": user.user_id},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True}


@api.delete("/mentors/me")
async def delete_mentor_profile(user: User = Depends(current_user)):
    await db.mentor_profiles.delete_one({"user_id": user.user_id})
    return {"ok": True}


@api.post("/mentorship/request")
async def request_mentorship(body: MentorshipRequestIn, user: User = Depends(current_user)):
    if body.mentor_id == user.user_id:
        raise HTTPException(status_code=400, detail="You cannot request yourself.")
    mentor = await db.mentor_profiles.find_one({"user_id": body.mentor_id}, {"_id": 0})
    if not mentor or not mentor.get("open"):
        raise HTTPException(status_code=404, detail="Mentor is not accepting requests.")
    if mentor.get("open_slots", 0) <= 0:
        raise HTTPException(status_code=400, detail="Mentor has no open spots.")
    # Prevent duplicate open requests
    existing = await db.mentorship_requests.find_one({
        "mentor_id": body.mentor_id, "mentee_id": user.user_id, "status": "pending"
    }, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending request with this mentor.")
    req = {
        "request_id": f"req_{uuid.uuid4().hex[:12]}",
        "mentor_id": body.mentor_id,
        "mentee_id": user.user_id,
        "mentee_name": user.name,
        "note": body.note.strip()[:600],
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
    }
    await db.mentorship_requests.insert_one(dict(req))
    return req


@api.get("/mentorship/requests")
async def my_requests(user: User = Depends(current_user)):
    sent = await db.mentorship_requests.find({"mentee_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    received = await db.mentorship_requests.find({"mentor_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    # Enrich sent with mentor name
    mentor_ids = [r["mentor_id"] for r in sent]
    mentor_users = await db.users.find({"user_id": {"$in": mentor_ids}}, {"_id": 0}).to_list(length=200)
    by_id = {u["user_id"]: u for u in mentor_users}
    for r in sent:
        r["mentor_name"] = (by_id.get(r["mentor_id"]) or {}).get("name")
    return {"sent": sent, "received": received}


@api.patch("/mentorship/requests/{rid}")
async def update_request(rid: str, action: str = Query(...), user: User = Depends(current_user)):
    r = await db.mentorship_requests.find_one({"request_id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    if r["mentor_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the mentor can update this request.")
    if action not in {"accept", "decline"}:
        raise HTTPException(status_code=400, detail="Invalid action.")
    new_status = "accepted" if action == "accept" else "declined"
    await db.mentorship_requests.update_one(
        {"request_id": rid},
        {"$set": {"status": new_status, "responded_at": datetime.now(timezone.utc)}},
    )
    if action == "accept":
        await db.mentor_profiles.update_one(
            {"user_id": user.user_id},
            {"$inc": {"open_slots": -1}},
        )
    return {"ok": True, "status": new_status}


# ──────────────────────────────────────────────────────────────────────────────
# Hierarchical circles (countries → cities → circles)
# ──────────────────────────────────────────────────────────────────────────────
@api.get("/circles/hierarchy")
async def circles_hierarchy():
    items = await db.communities.find({}, {"_id": 0}).to_list(length=400)
    tree: Dict[str, Dict[str, List[dict]]] = {}
    for c in items:
        country = c.get("country") or "Global"
        city = c.get("city") or "Global"
        tree.setdefault(country, {}).setdefault(city, []).append(c)
    # Shape into list-of-list for easy rendering
    out = []
    for country, cities in tree.items():
        c_block = {"country": country, "cities": []}
        for city, circles in cities.items():
            c_block["cities"].append({"city": city, "circles": circles})
        out.append(c_block)
    return {"tree": out}


# ──────────────────────────────────────────────────────────────────────────────
# Khidmah Leaderboard — soft monthly recognition of service
# ──────────────────────────────────────────────────────────────────────────────
KHIDMAH_RULES = {
    "volunteer_rsvp": 3,        # RSVP to an event tagged "Volunteer"
    "post_with_likes": 1,       # Each post that received ≥1 like
    "kind_comment": 2,          # Comment ≥60 chars (assumed thoughtful)
    "mentorship_accepted_mentor": 5,
    "mentorship_accepted_mentee": 3,
}


def _month_window(year: int, month: int):
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    return start, end


@api.get("/khidmah/leaderboard")
async def khidmah_leaderboard(
    year: Optional[int] = None,
    month: Optional[int] = None,
    user: User = Depends(current_user),
):
    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month
    start, end = _month_window(y, m)

    scores: Dict[str, dict] = {}

    def bump(uid: str, name: str, reason: str, weight: int):
        s = scores.setdefault(uid, {"user_id": uid, "name": name, "points": 0, "breakdown": {}})
        s["points"] += weight
        s["breakdown"][reason] = s["breakdown"].get(reason, 0) + weight

    # 1) Volunteer RSVPs in window
    vol_event_ids = [e["event_id"] for e in await db.events.find({"tag": "Volunteer"}, {"_id": 0, "event_id": 1}).to_list(length=200)]
    if vol_event_ids:
        rsvps = await db.rsvps.find({"event_id": {"$in": vol_event_ids}, "rsvp_at": {"$gte": start, "$lt": end}}, {"_id": 0}).to_list(length=2000)
        uids = list({r["user_id"] for r in rsvps})
        users_map = {u["user_id"]: u for u in await db.users.find({"user_id": {"$in": uids}}, {"_id": 0}).to_list(length=2000)}
        for r in rsvps:
            u = users_map.get(r["user_id"])
            if not u: continue
            bump(u["user_id"], u["name"], "volunteer_rsvp", KHIDMAH_RULES["volunteer_rsvp"])

    # 2) Posts that received at least one like (post created in window)
    posts = await db.posts.find({"created_at": {"$gte": start, "$lt": end}, "likes": {"$gte": 1}}, {"_id": 0}).to_list(length=2000)
    for p in posts:
        bump(p["user_id"], p.get("author_name") or "Member", "post_with_likes", KHIDMAH_RULES["post_with_likes"])

    # 3) Kind comments — comment longer than 60 chars
    comments = await db.comments.find({"created_at": {"$gte": start, "$lt": end}}, {"_id": 0}).to_list(length=5000)
    for c in comments:
        if len(c.get("text") or "") >= 60:
            bump(c["user_id"], c.get("author_name") or "Member", "kind_comment", KHIDMAH_RULES["kind_comment"])

    # 4) Mentorship accepted — both mentor and mentee
    accepted = await db.mentorship_requests.find({"status": "accepted", "responded_at": {"$gte": start, "$lt": end}}, {"_id": 0}).to_list(length=2000)
    mentor_ids = list({a["mentor_id"] for a in accepted})
    mentee_ids = list({a["mentee_id"] for a in accepted})
    all_ids = list({*mentor_ids, *mentee_ids})
    users_map = {u["user_id"]: u for u in await db.users.find({"user_id": {"$in": all_ids}}, {"_id": 0}).to_list(length=2000)}
    for a in accepted:
        mn = users_map.get(a["mentor_id"])
        if mn:
            bump(mn["user_id"], mn["name"], "mentorship_accepted_mentor", KHIDMAH_RULES["mentorship_accepted_mentor"])
        me = users_map.get(a["mentee_id"])
        if me:
            bump(me["user_id"], me["name"], "mentorship_accepted_mentee", KHIDMAH_RULES["mentorship_accepted_mentee"])

    board = sorted(scores.values(), key=lambda s: s["points"], reverse=True)
    # Rank
    for i, s in enumerate(board):
        s["rank"] = i + 1

    my_entry = next((s for s in board if s["user_id"] == user.user_id), {
        "user_id": user.user_id, "name": user.name, "points": 0, "breakdown": {}, "rank": None,
    })

    return {
        "year": y,
        "month": m,
        "window_start": start.isoformat(),
        "window_end": end.isoformat(),
        "rules": KHIDMAH_RULES,
        "leaders": board[:25],
        "you": my_entry,
        "total_participants": len(board),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Seeding
# ──────────────────────────────────────────────────────────────────────────────
async def seed_data():
    # Bootstrap invite codes (only if NONE exist anywhere)
    if await db.invite_codes.count_documents({}) == 0:
        await db.invite_codes.insert_many([
            {"code": "NOOR-ALPHA", "issued_by": "system", "used_by": None,
             "created_at": datetime.now(timezone.utc)},
            {"code": "NOOR-BETA", "issued_by": "system", "used_by": None,
             "created_at": datetime.now(timezone.utc)},
            {"code": "NOOR-GAMMA", "issued_by": "system", "used_by": None,
             "created_at": datetime.now(timezone.utc)},
            {"code": "NOOR-DELTA", "issued_by": "system", "used_by": None,
             "created_at": datetime.now(timezone.utc)},
            {"code": "NOOR-EPSILON", "issued_by": "system", "used_by": None,
             "created_at": datetime.now(timezone.utc)},
        ])

    if await db.communities.count_documents({}) == 0:
        await db.communities.insert_many([
            {"community_id": "c_toronto_youth", "name": "Toronto Youth Circle", "city": "Toronto", "country": "Canada",
             "members": 412, "description": "Sunday halqas, hiking, late-night chai conversations.",
             "kind": "youth"},
            {"community_id": "c_noor_global", "name": "Noor Reflection Group", "city": "Global", "country": "Global",
             "members": 1248, "description": "Weekly reflection prompts and journaling threads.",
             "kind": "reflection"},
            {"community_id": "c_mumbai_vol", "name": "Mumbai Volunteers", "city": "Mumbai", "country": "India",
             "members": 287, "description": "Iftar drives, blood donation camps, education support.",
             "kind": "volunteers"},
            {"community_id": "c_founders", "name": "Founders & Creators", "city": "Global", "country": "Global",
             "members": 533, "description": "A quiet network of Ismaili builders and storytellers.",
             "kind": "network"},
            {"community_id": "c_seva", "name": "Seva Mentors", "city": "Karachi", "country": "Pakistan",
             "members": 198, "description": "Mentorship inspired by the ethics of service and pluralism.",
             "kind": "mentorship"},
            {"community_id": "c_london_families", "name": "London Families", "city": "London", "country": "United Kingdom",
             "members": 145, "description": "Family halqas, picnics, and parenting circles.",
             "kind": "family"},
            {"community_id": "c_dubai_youth", "name": "Dubai Youth Circle", "city": "Dubai", "country": "UAE",
             "members": 256, "description": "Beach halqas, study groups, and quiet evening reflections.",
             "kind": "youth"},
            {"community_id": "c_paris_reflection", "name": "Cercle Paris", "city": "Paris", "country": "France",
             "members": 89, "description": "Réflexions en français, soirées Noor mensuelles.",
             "kind": "reflection"},
        ])
    else:
        # Backfill country field for older seeded docs
        await db.communities.update_many({"country": {"$exists": False}, "city": "Toronto"}, {"$set": {"country": "Canada"}})
        await db.communities.update_many({"country": {"$exists": False}, "city": "Mumbai"}, {"$set": {"country": "India"}})
        await db.communities.update_many({"country": {"$exists": False}, "city": "Karachi"}, {"$set": {"country": "Pakistan"}})
        await db.communities.update_many({"country": {"$exists": False}, "city": "London"}, {"$set": {"country": "United Kingdom"}})
        await db.communities.update_many({"country": {"$exists": False}, "city": "Global"}, {"$set": {"country": "Global"}})

    if await db.events.count_documents({}) == 0:
        await db.events.insert_many([
            {"event_id": "e_noor_night", "title": "Noor Night · Reflections under the stars",
             "date": "2026-02-14", "time": "8:00 PM", "where": "Toronto Ismaili Jamatkhana",
             "tag": "Spiritual", "going": 92, "featured": True,
             "description": "An evening of soft light, recitations, and shared silence."},
            {"event_id": "e_youth_halqa", "title": "Youth halqa: Surah Al-Kahf",
             "date": "2026-02-22", "time": "7:00 PM", "where": "Mississauga Community Centre",
             "tag": "Spiritual", "going": 38, "featured": False,
             "description": "A reflective reading on patience, knowledge and youth."},
            {"event_id": "e_blood_drive", "title": "Blood donation drive",
             "date": "2026-02-25", "time": "10:00 AM", "where": "Downtown Community Hall",
             "tag": "Volunteer", "going": 122, "featured": False,
             "description": "Khidmah drive — one quiet hour can save three lives."},
            {"event_id": "e_founders_dinner", "title": "Founders circle dinner",
             "date": "2026-02-28", "time": "7:30 PM", "where": "Online + Toronto",
             "tag": "Network", "going": 24, "featured": False,
             "description": "An intimate dinner for builders and storytellers."},
            {"event_id": "e_iftar_prep", "title": "Iftar prep volunteer team",
             "date": "2026-03-02", "time": "4:00 PM", "where": "Local Jamatkhana",
             "tag": "Volunteer", "going": 58, "featured": False,
             "description": "Cook, serve and share — six spots left."},
        ])

    if await db.mentor_profiles.count_documents({}) == 0:
        # Seed mentor users + profiles
        sample_mentors = [
            {"user_id": "m_sana", "name": "Dr. Sana", "email": "sana@tasbih.ai", "city": "Toronto",
             "headline": "Pediatrician · open to first-generation pre-meds",
             "bio": "Twenty years in pediatrics. I love supporting students who are first-generation in medicine. Happy to talk about MCAT, residency, and balancing faith with long hospital nights.",
             "skills": ["medicine", "career", "youth"]},
            {"user_id": "m_hamza", "name": "Hamza Karim", "email": "hamza@tasbih.ai", "city": "Dubai",
             "headline": "SaaS founder · helping new builders ship",
             "bio": "Founded two SaaS companies (one acquired). I mentor Muslim builders 1:1 — product, fundraising, hiring, and the quieter side of staying spiritually grounded while building.",
             "skills": ["startup", "product", "fundraising"]},
            {"user_id": "m_ayesha", "name": "Ayesha Devji", "email": "ayesha@tasbih.ai", "city": "London",
             "headline": "Senior designer · Figma, accessibility, portfolios",
             "bio": "Design lead at a fintech. I review portfolios, do mock interviews, and help newer designers find a craft they love. Particularly happy to mentor women entering tech.",
             "skills": ["design", "ux", "career"]},
            {"user_id": "m_yusuf", "name": "Yusuf Damji", "email": "yusuf@tasbih.ai", "city": "Karachi",
             "headline": "Teacher · ECDC educators network",
             "bio": "Twelve years teaching. I help newer educators find their voice, plan curricula, and bring spiritual grounding into the classroom in a respectful, non-authoritative way.",
             "skills": ["education", "teaching", "family"]},
        ]
        for m in sample_mentors:
            await db.users.update_one(
                {"user_id": m["user_id"]},
                {"$set": {
                    "user_id": m["user_id"], "name": m["name"], "email": m["email"],
                    "picture": None, "status": "member", "city": m["city"],
                    "invite_codes_used": [], "referrals_received": 2, "invites_available": 3,
                    "created_at": datetime.now(timezone.utc),
                }},
                upsert=True,
            )
            await db.mentor_profiles.insert_one({
                "user_id": m["user_id"],
                "headline": m["headline"],
                "bio": m["bio"],
                "skills": m["skills"],
                "open_slots": 2,
                "languages": ["en"],
                "open": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            })

    if await db.reflections.count_documents({}) == 0:
        await db.reflections.insert_many([
            {"reflection_id": "r1", "author": "Layla", "circle": "Noor Circle · London",
             "text": "Sat with the dawn today. The silence felt like a quiet answer to a prayer I hadn't said out loud yet.",
             "likes": 42, "created_at": datetime.now(timezone.utc) - timedelta(hours=2)},
            {"reflection_id": "r2", "author": "Imran", "circle": "Students · Karachi",
             "text": "Started writing one ayah a day in my journal. Small ritual, big shift in how I notice my hours.",
             "likes": 28, "created_at": datetime.now(timezone.utc) - timedelta(hours=5)},
            {"reflection_id": "r3", "author": "Sahar", "circle": "Seva Mentors · Dubai",
             "text": "Tonight I helped a younger cousin with her homework. She thanked me — but I think the lighter heart was mine.",
             "likes": 51, "created_at": datetime.now(timezone.utc) - timedelta(hours=9)},
        ])


@app.on_event("startup")
async def on_startup():
    await seed_data()
    logger.info("Tasbih.ai backend ready")


app.include_router(api)
