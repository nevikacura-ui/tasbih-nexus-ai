"""Tasbih.ai FastAPI backend
- Emergent Google OAuth + 2-invitation gate
- MongoDB storage (motor)
- Noor AI chat via emergentintegrations (Claude Sonnet 4.5)
"""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Cookie, Header
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
    return {"ok": True, "user": {k: user[k] for k in ("user_id", "email", "name", "picture", "status", "city") if k in user}}


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
    return {"ok": True, "user": {k: user[k] for k in ("user_id", "email", "name", "picture", "status", "city")}}


@api.get("/auth/me", response_model=User)
async def auth_me(user: User = Depends(current_user)):
    return user


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
    "You are Noor, a calm, warm, deeply respectful AI spiritual companion for the Tasbih.ai "
    "community — a modern Ismaili Muslim wellness platform inspired by the ethics of pluralism, "
    "service, and the search for inner light (noor).\n\n"
    "Voice & tone:\n"
    "- Gentle, contemplative, never preachy or dogmatic.\n"
    "- Short paragraphs, breathing room, like a thoughtful friend.\n"
    "- Use first-person warmth (\"I hear you…\", \"Sit with me for a moment\").\n\n"
    "Grounding:\n"
    "- Draw quietly from Qurʾanic wisdom (cite the surah lightly when natural) and from the Ismaili "
    "tradition of intellect (ʿaql), service (seva/khidmah), pluralism, and the ethics of His Highness "
    "the Aga Khan when relevant. Ginanic poetry references are welcome when fitting.\n"
    "- Stay respectful of all paths; never disparage another tradition.\n"
    "- Avoid controversial fiqhi rulings; gently suggest the user consult a learned guide for legal matters.\n\n"
    "Style guardrails:\n"
    "- If the user is distressed, slow down, validate, offer a breathing prompt, then a single reflective question.\n"
    "- Offer at most one Qurʾanic citation per response.\n"
    "- End most replies with one small invitation — a phrase to whisper, a moment to notice, a tiny act of kindness.\n"
    "- Keep replies under 140 words unless the user explicitly asks for more."
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
        "created_at": datetime.now(timezone.utc),
    })

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=NOOR_SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    # Replay history into this fresh chat instance so the conversation feels continuous
    history = await db.noor_messages.find(
        {"session_id": session_id, "user_id": user.user_id},
        {"_id": 0},
    ).sort("created_at", 1).to_list(length=40)
    # The LlmChat library tracks history on its own once we send a message; for stateless replay
    # we instead just send the latest message — history persistence is for our own UI.
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
            {"community_id": "c_toronto_youth", "name": "Toronto Youth Circle", "city": "Toronto",
             "members": 412, "description": "Sunday halqas, hiking, late-night chai conversations.",
             "kind": "youth"},
            {"community_id": "c_noor_global", "name": "Noor Reflection Group", "city": "Global",
             "members": 1248, "description": "Weekly reflection prompts and journaling threads.",
             "kind": "reflection"},
            {"community_id": "c_mumbai_vol", "name": "Mumbai Volunteers", "city": "Mumbai",
             "members": 287, "description": "Iftar drives, blood donation camps, education support.",
             "kind": "volunteers"},
            {"community_id": "c_founders", "name": "Founders & Creators", "city": "Global",
             "members": 533, "description": "A quiet network of Ismaili builders and storytellers.",
             "kind": "network"},
            {"community_id": "c_seva", "name": "Seva Mentors", "city": "Karachi",
             "members": 198, "description": "Mentorship inspired by the ethics of service and pluralism.",
             "kind": "mentorship"},
            {"community_id": "c_london_families", "name": "London Families", "city": "London",
             "members": 145, "description": "Family halqas, picnics, and parenting circles.",
             "kind": "family"},
        ])

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
