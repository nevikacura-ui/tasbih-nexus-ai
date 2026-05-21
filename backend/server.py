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
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")

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
    role: str = "member"  # "member" | "org"
    org_profile: Optional[dict] = None
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
    """Validate that BOTH invite codes are real, unused, AND issued by two
    different inviters (founder codes are exempt — they're the bootstrap pool).
    """
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
    # Two-different-issuer rule (community vouching). Founder codes bypass.
    d1, d2 = found[code1], found[code2]
    is_founder = bool(d1.get("founder")) or bool(d2.get("founder"))
    if not is_founder and d1.get("issued_by") == d2.get("issued_by"):
        raise HTTPException(
            status_code=400,
            detail="Both invitation codes must come from two different members. Ask another friend in the jamat for the second code.",
        )
    # Stash a short-lived pending token so OAuth/registration can confirm both codes were verified
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
            "expires_at": datetime.now(timezone.utc) + timedelta(days=90),
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
        "invites_available": 3,
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


# ──────────────────────────────────────────────────────────────────────────────
# MSG91 WhatsApp OTP — phone+email registration after invite verify
# Uses MSG91's WhatsApp Outbound API with an approved Meta Authentication template
# (`nevika_otp_verify`). We generate the OTP locally, store a hash with 10-minute
# TTL, send via WhatsApp, and verify against our own hash. No OTP-section template
# needed — it reuses the already-approved WhatsApp template.
# Required env: MSG91_AUTH_KEY, MSG91_INTEGRATED_NUMBER (e.g. 918108888330),
#              MSG91_WA_TEMPLATE (e.g. nevika_otp_verify)
# ──────────────────────────────────────────────────────────────────────────────
MSG91_AUTH_KEY = os.environ.get("MSG91_AUTH_KEY", "")
MSG91_INTEGRATED_NUMBER = os.environ.get("MSG91_INTEGRATED_NUMBER", "")
MSG91_WA_TEMPLATE = os.environ.get("MSG91_WA_TEMPLATE", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM", "Tasbih.ai <onboarding@resend.dev>")
APP_PUBLIC_URL = os.environ.get("APP_PUBLIC_URL", "https://tasbih.ai")


class OtpSendIn(BaseModel):
    pending_token: str
    email: str
    phone: str  # E.164 with leading + (e.g. +918108888330)


class OtpVerifyIn(BaseModel):
    pending_token: str
    email: str
    phone: str
    otp: str
    name: Optional[str] = None


def _normalize_phone(p: str) -> str:
    """Strip everything but digits — MSG91 expects country-code without '+'."""
    digits = "".join(ch for ch in (p or "") if ch.isdigit())
    return digits


def _hash_otp(otp: str, phone: str) -> str:
    import hashlib
    return hashlib.sha256(f"{otp}|{phone}|tasbih".encode()).hexdigest()


async def _send_wa_otp_msg91(phone_e164_no_plus: str, otp: str) -> dict:
    """Send a 6-digit OTP via MSG91 WhatsApp Outbound API using the
    pre-approved Meta Authentication template `nevika_otp_verify`.
    The template body is "{{1}} is your verification code..." with a Copy Code
    button, so we pass the OTP both as body variable and as the button URL param.
    """
    if not (MSG91_AUTH_KEY and MSG91_INTEGRATED_NUMBER and MSG91_WA_TEMPLATE):
        raise HTTPException(status_code=500, detail="WhatsApp OTP is not configured on the server.")
    payload = {
        "integrated_number": MSG91_INTEGRATED_NUMBER,
        "content_type": "template",
        "payload": {
            "messaging_product": "whatsapp",
            "type": "template",
            "template": {
                "name": MSG91_WA_TEMPLATE,
                "language": {"code": "en", "policy": "deterministic"},
                "namespace": None,
                "to_and_components": [
                    {
                        "to": [phone_e164_no_plus],
                        "components": {
                            "body_1": {"type": "text", "value": otp},
                            "button_1": {"subtype": "url", "type": "text", "value": otp},
                        },
                    }
                ],
            },
        },
    }
    headers = {"authkey": MSG91_AUTH_KEY, "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.post(
                "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
                json=payload, headers=headers,
            )
        try:
            data = r.json()
        except Exception:
            data = {"raw": r.text}
        if r.status_code >= 400 or str(data.get("status", "")).lower() == "error":
            logger.warning(f"MSG91 WA send failed: status={r.status_code} body={data}")
            detail = (data.get("message") if isinstance(data, dict) else None) or "Could not send WhatsApp OTP."
            raise HTTPException(status_code=502, detail=str(detail))
        logger.info(f"MSG91 WA OTP sent to {phone_e164_no_plus}: {data}")
        return data
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"msg91 wa send exception: {e}")
        raise HTTPException(status_code=502, detail="Could not reach WhatsApp OTP service.")


@api.post("/auth/otp/send")
async def auth_otp_send(body: OtpSendIn):
    """Send a 6-digit OTP via WhatsApp using MSG91 + Meta-approved template."""
    email = (body.email or "").strip().lower()
    phone = _normalize_phone(body.phone)
    if "@" not in email or len(email) < 5:
        raise HTTPException(status_code=400, detail="Please enter a valid email.")
    if len(phone) < 8 or len(phone) > 15:
        raise HTTPException(status_code=400, detail="Please enter a valid phone number with country code.")
    pending = await db.pending_invites.find_one({"pending_token": body.pending_token}, {"_id": 0})
    if not pending:
        raise HTTPException(status_code=403, detail="Invitation expired. Please re-enter codes.")
    # Generate + persist OTP (hashed) with 10-minute expiry
    import secrets
    otp = "".join(secrets.choice("0123456789") for _ in range(6))
    now = datetime.now(timezone.utc)
    await db.otp_codes.delete_many({"phone": phone})  # invalidate prior
    await db.otp_codes.insert_one({
        "phone": phone,
        "email": email,
        "otp_hash": _hash_otp(otp, phone),
        "attempts": 0,
        "created_at": now,
        "expires_at": now + timedelta(minutes=10),
    })
    await _send_wa_otp_msg91(phone, otp)
    await db.pending_invites.update_one(
        {"pending_token": body.pending_token},
        {"$set": {"email": email, "phone": phone, "otp_sent_at": now}},
    )
    return {"ok": True, "channel": "whatsapp", "sent_to": phone, "expires_in_minutes": 10}


@api.post("/auth/otp/verify")
async def auth_otp_verify(body: OtpVerifyIn, response: Response):
    """Verify the OTP against our hashed store and finalize registration (90-day session)."""
    email = (body.email or "").strip().lower()
    phone = _normalize_phone(body.phone)
    otp = (body.otp or "").strip()
    if len(otp) < 4 or len(otp) > 8:
        raise HTTPException(status_code=400, detail="Please enter the verification code.")
    pending = await db.pending_invites.find_one({"pending_token": body.pending_token}, {"_id": 0})
    if not pending:
        raise HTTPException(status_code=403, detail="Invitation expired. Please re-enter codes.")
    rec = await db.otp_codes.find_one({"phone": phone}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=400, detail="No verification code found. Please request a new code.")
    exp = rec.get("expires_at")
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        await db.otp_codes.delete_one({"phone": phone})
        raise HTTPException(status_code=400, detail="That code expired. Please request a new one.")
    if rec.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new code.")
    import hmac
    if not hmac.compare_digest(rec["otp_hash"], _hash_otp(otp, phone)):
        await db.otp_codes.update_one({"phone": phone}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="That code didn't match. Try again.")

    # Confirm invite codes still valid + consume on first registration
    codes = [pending.get("code1"), pending.get("code2")]
    code_docs = await db.invite_codes.find({"code": {"$in": codes}}, {"_id": 0}).to_list(length=10)

    user = await db.users.find_one({"$or": [{"email": email}, {"phone": phone}]}, {"_id": 0})
    if not user:
        if len(code_docs) != 2 or any(c.get("used_by") for c in code_docs):
            raise HTTPException(status_code=403, detail="Invitation codes are no longer valid.")
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "phone": phone,
            "name": (body.name or email.split("@")[0]).strip()[:80],
            "picture": None,
            "status": "member",
            "city": None,
            "invite_codes_used": codes,
            "referrals_received": 2,
            "invites_available": 3,
            "role": "member",
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(dict(user))
        await db.invite_codes.update_many(
            {"code": {"$in": codes}},
            {"$set": {"used_by": user_id, "used_at": datetime.now(timezone.utc)}},
        )
    # 90-day session
    session_token = f"sess_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=90),
        "created_at": datetime.now(timezone.utc),
    })
    await db.otp_codes.delete_one({"phone": phone})
    await db.pending_invites.delete_one({"pending_token": body.pending_token})
    response.set_cookie(
        key="session_token", value=session_token,
        max_age=90 * 24 * 60 * 60, httponly=True, secure=True, samesite="none", path="/",
    )
    return {
        "ok": True,
        "session_token": session_token,
        "user": {k: user.get(k) for k in ("user_id", "email", "phone", "name", "status", "city")},
    }


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
    codes = await db.invite_codes.find({"issued_by": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    return {"codes": codes, "available": "unlimited"}


# ──────────────────────────────────────────────────────────────────────────────
# Invite a friend via email (Resend)
# Two-tap: pick a friend's email, we send them a calm note with two unused codes.
# ──────────────────────────────────────────────────────────────────────────────
class InviteEmailIn(BaseModel):
    to_email: str
    to_name: Optional[str] = ""
    second_inviter_name: Optional[str] = ""  # optional "from me and Sara" co-sign


def _invite_email_html(*, recipient_name: str, sender_name: str, second_inviter: str, code1: str, code2: str, app_url: str) -> str:
    """Tiny inline-CSS email. Calm. No growth-hack tone."""
    cosigner = f" and {second_inviter}" if (second_inviter or "").strip() else ""
    safe_name = (recipient_name or "").strip() or "friend"
    return f"""\
<!doctype html>
<html><body style="margin:0;padding:0;background:#F6F1E7;font-family:Georgia,'Times New Roman',serif;color:#0F3D36;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFBF2;border-radius:20px;padding:36px 28px;box-shadow:0 18px 40px rgba(15,61,54,0.10);">
        <tr><td align="center" style="padding-bottom:6px;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#0F3D36;opacity:0.55;">
          Yā ʿAlī Madad
        </td></tr>
        <tr><td align="center" style="padding-bottom:18px;">
          <span style="display:inline-block;font-family:Georgia,serif;font-size:30px;line-height:1.05;color:#0F3D36;">Tasbih<span style="color:#C9A46A">.</span>ai</span>
        </td></tr>
        <tr><td style="font-size:15px;line-height:1.65;color:#0F3D36;padding:0 4px 14px;">
          Dear {safe_name},
        </td></tr>
        <tr><td style="font-size:15px;line-height:1.7;color:#0F3D36;padding:0 4px 18px;">
          {sender_name}{cosigner} would love for you to step into <strong>Tasbih.ai</strong> — a quiet, invite-only companion for reflection, dhikr, and gentle community for the global jamat.
        </td></tr>
        <tr><td style="padding:6px 4px 4px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#0F3D36;opacity:0.45;">
          Your two invitation codes
        </td></tr>
        <tr><td align="center" style="padding:8px 4px 4px;">
          <table role="presentation" cellpadding="0" cellspacing="8"><tr>
            <td align="center" style="background:#0F3D36;color:#C9A46A;font-family:Menlo,Consolas,monospace;font-size:18px;letter-spacing:0.32em;padding:14px 22px;border-radius:14px;">{code1}</td>
            <td align="center" style="background:#0F3D36;color:#C9A46A;font-family:Menlo,Consolas,monospace;font-size:18px;letter-spacing:0.32em;padding:14px 22px;border-radius:14px;">{code2}</td>
          </tr></table>
        </td></tr>
        <tr><td style="font-size:13px;line-height:1.7;color:#0F3D36;opacity:0.75;padding:14px 4px 6px;">
          Both codes are from <strong>two different members</strong> who quietly vouch for you. They unlock one registration on the app.
        </td></tr>
        <tr><td align="center" style="padding:22px 4px 6px;">
          <a href="{app_url}/login?c1={code1}&amp;c2={code2}" style="display:inline-block;background:#0F3D36;color:#F6F1E7;text-decoration:none;font-size:14px;font-weight:500;padding:14px 28px;border-radius:999px;letter-spacing:0.02em;">Open Tasbih.ai →</a>
        </td></tr>
        <tr><td style="font-size:12px;line-height:1.6;color:#0F3D36;opacity:0.55;padding:22px 4px 0;text-align:center;">
          Independent · community-driven · non-authoritative<br/>
          You received this because {sender_name} chose to share Tasbih.ai with you. If this isn't for you, please simply ignore it.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


@api.post("/invites/send-email")
async def send_invite_email(body: InviteEmailIn, user: User = Depends(current_user)):
    """Mint TWO fresh codes issued by the sender (and optionally co-signed by a
    second member) and send them to the recipient via Resend."""
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured. Add RESEND_API_KEY in backend/.env.")
    to_email = (body.to_email or "").strip().lower()
    if "@" not in to_email or len(to_email) < 5:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    # Mint two fresh unique codes issued by this user
    codes = []
    seen = set()
    for _ in range(20):
        if len(codes) == 2:
            break
        c = _gen_invite_code()
        if c in seen:
            continue
        seen.add(c)
        if not await db.invite_codes.find_one({"code": c}, {"_id": 0}):
            codes.append(c)
    if len(codes) != 2:
        raise HTTPException(status_code=500, detail="Could not generate codes. Try again.")
    now = datetime.now(timezone.utc)
    await db.invite_codes.insert_many([
        {"code": codes[0], "issued_by": user.user_id, "used_by": None, "created_at": now, "shared_with_email": to_email},
        {"code": codes[1], "issued_by": user.user_id, "used_by": None, "created_at": now, "shared_with_email": to_email},
    ])

    sender_name = (user.name or "A friend").strip()
    html = _invite_email_html(
        recipient_name=(body.to_name or "").strip(),
        sender_name=sender_name,
        second_inviter=(body.second_inviter_name or "").strip(),
        code1=codes[0], code2=codes[1],
        app_url=APP_PUBLIC_URL,
    )
    subject = f"Yā ʿAlī Madad — {sender_name} invited you to Tasbih.ai"
    payload = {"from": RESEND_FROM, "to": [to_email], "subject": subject, "html": html}
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                json=payload,
            )
        try:
            data = r.json()
        except Exception:
            data = {"raw": r.text}
        if r.status_code >= 400:
            logger.warning(f"Resend failed: status={r.status_code} body={data}")
            detail = (data.get("message") if isinstance(data, dict) else None) or "Could not send the email."
            # roll back code creation so the user isn't left with phantom codes
            await db.invite_codes.delete_many({"code": {"$in": codes}})
            raise HTTPException(status_code=502, detail=str(detail))
        email_id = data.get("id") if isinstance(data, dict) else None
        logger.info(f"Resend OK to={to_email} id={email_id} codes={codes}")
        return {"ok": True, "to": to_email, "codes": codes, "email_id": email_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"resend exception: {e}")
        await db.invite_codes.delete_many({"code": {"$in": codes}})
        raise HTTPException(status_code=502, detail="Could not reach the email service.")


_INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I for legibility


def _gen_invite_code() -> str:
    import secrets
    return "".join(secrets.choice(_INVITE_ALPHABET) for _ in range(8))


@api.post("/invites/create")
async def create_invite(user: User = Depends(current_user)):
    # Unlimited invitation generation — every member can invite as many as they wish.
    # Generate unique alphanumeric 8-char code
    for _ in range(8):
        code = _gen_invite_code()
        if not await db.invite_codes.find_one({"code": code}, {"_id": 0}):
            break
    doc = {
        "code": code,
        "issued_by": user.user_id,
        "used_by": None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.invite_codes.insert_one(dict(doc))
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
# Noor Moment — a unique chat feature.
# Any member can invoke Noor AI to drop a single short calming reflection
# into the live chat, visible to everyone. Rate-limited to 1 per minute per
# community to keep the AI presence rare and meaningful.
# ──────────────────────────────────────────────────────────────────────────────
NOOR_MOMENT_PROMPTS = [
    "Drop a 1-2 sentence calm Ginanic-tone reflection for a group of friends gathered in conversation. Tone: warm, quiet, never preachy.",
    "Offer a 1-2 sentence soft pause — like a gentle breath taken together. No religious instruction.",
    "Share a 1-2 sentence reminder about kindness or patience, drawn lightly from Ismaili pluralist wisdom.",
    "Whisper a 1-2 sentence reflection on listening — what it means to truly hear another. No fatwa.",
    "Bring a 1-2 sentence gratitude prompt to the conversation, gentle and grounding.",
]


@api.post("/communities/{community_id}/noor-moment")
async def noor_moment(community_id: str, user: User = Depends(current_user)):
    comm = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    if not comm:
        raise HTTPException(status_code=404, detail="Community not found")
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="Noor is offline right now.")
    # Per-community rate-limit: 1 noor moment per 60 seconds
    last = await db.chat_messages.find_one(
        {"community_id": community_id, "kind": "noor_moment"},
        {"_id": 0, "created_at": 1},
        sort=[("created_at", -1)],
    )
    if last:
        last_ts = last.get("created_at")
        if isinstance(last_ts, str):
            last_ts = datetime.fromisoformat(last_ts)
        if last_ts and last_ts.tzinfo is None:
            last_ts = last_ts.replace(tzinfo=timezone.utc)
        if last_ts and (datetime.now(timezone.utc) - last_ts).total_seconds() < 60:
            secs = 60 - int((datetime.now(timezone.utc) - last_ts).total_seconds())
            raise HTTPException(status_code=429, detail=f"Noor is still resting. Try again in {secs}s.")
    import random
    prompt = random.choice(NOOR_MOMENT_PROMPTS)
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"noor_moment_{community_id}",
            system_message=NOOR_SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        reflection = await chat.send_message(UserMessage(text=prompt))
        reflection = (reflection or "").strip()
        if len(reflection) > 360:
            reflection = reflection[:357].rstrip() + "…"
    except Exception as e:
        logger.warning(f"noor moment failed: {e}")
        reflection = "A gentle pause for all of us. Breathe — three slow breaths together."
    msg = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "community_id": community_id,
        "user_id": "noor",
        "author_name": "Noor",
        "kind": "noor_moment",
        "invoked_by": user.user_id,
        "invoked_by_name": user.name,
        "text": reflection,
        "created_at": datetime.now(timezone.utc),
    }
    await db.chat_messages.insert_one(dict(msg))
    # Broadcast over WebSocket so all open clients see it instantly
    payload = {**msg, "created_at": msg["created_at"].isoformat(), "type": "message"}
    await hub.broadcast(community_id, payload)
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
    as_org: bool = False


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
    is_org = body.as_org and user.role == "org" and user.org_profile
    org_name = (user.org_profile or {}).get("name") if is_org else None
    post = {
        "post_id": f"post_{uuid.uuid4().hex[:12]}",
        "community_id": community_id,
        "user_id": user.user_id,
        "author_name": org_name if is_org else user.name,
        "author_kind": "org" if is_org else "user",
        "org_id": user.user_id if is_org else None,
        "verified": bool(is_org and (user.org_profile or {}).get("verified")),
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
    target_author_id = None
    if action == "remove":
        if r["target_type"] == "post":
            t = await db.posts.find_one({"post_id": r["target_id"]}, {"_id": 0})
            target_author_id = (t or {}).get("user_id")
            await db.posts.update_one({"post_id": r["target_id"]}, {"$set": {"removed": True, "text": "[removed by moderator]"}})
        elif r["target_type"] == "comment":
            t = await db.comments.find_one({"comment_id": r["target_id"]}, {"_id": 0})
            target_author_id = (t or {}).get("user_id")
            await db.comments.update_one({"comment_id": r["target_id"]}, {"$set": {"removed": True, "text": "[removed by moderator]"}})
        elif r["target_type"] == "message":
            t = await db.chat_messages.find_one({"message_id": r["target_id"]}, {"_id": 0})
            target_author_id = (t or {}).get("user_id")
            await db.chat_messages.update_one({"message_id": r["target_id"]}, {"$set": {"removed": True, "text": "[removed by moderator]"}})
    await db.reports.update_one(
        {"report_id": report_id},
        {"$set": {"status": "resolved", "action": action, "resolved_by": user.user_id, "resolved_at": datetime.now(timezone.utc)}},
    )
    if action == "remove" and target_author_id:
        await _notify(
            target_author_id, "mod_action",
            "A moderator removed one of your posts",
            "Please review our community guidelines — be kind, no fatwas, no debates.",
        )
    await _notify(
        r["reporter_id"], "report_resolved",
        "Your report was reviewed",
        f"Action: {action}. Thank you for keeping the circle calm.",
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
# Admin · Organisation verification
# ──────────────────────────────────────────────────────────────────────────────
def _require_admin(u: User):
    if u.status != "admin" and u.email.lower() != "admin@tasbih.ai":
        raise HTTPException(status_code=403, detail="Admins only")


@api.get("/admin/me")
async def admin_me(user: User = Depends(current_user)):
    is_admin = user.status == "admin" or user.email.lower() == "admin@tasbih.ai"
    return {"is_admin": is_admin}


@api.get("/admin/orgs")
async def admin_list_orgs(user: User = Depends(current_user)):
    _require_admin(user)
    users = await db.users.find({"role": "org", "org_profile": {"$ne": None}}, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    out = []
    for u in users:
        op = u.get("org_profile") or {}
        out.append({
            "org_id": u["user_id"],
            "owner_email": u.get("email"),
            "owner_name": u.get("name"),
            "name": op.get("name") or "",
            "tagline": op.get("tagline") or "",
            "category": op.get("category") or "other",
            "country": op.get("country") or "Global",
            "city": op.get("city") or "Global",
            "website": op.get("website") or "",
            "verified": bool(op.get("verified")),
            "created_at": u.get("created_at"),
        })
    return {"orgs": out}


class AdminVerifyIn(BaseModel):
    verified: bool


@api.post("/admin/orgs/{org_id}/verify")
async def admin_verify_org(org_id: str, body: AdminVerifyIn, user: User = Depends(current_user)):
    _require_admin(user)
    res = await db.users.update_one(
        {"user_id": org_id, "role": "org"},
        {"$set": {"org_profile.verified": bool(body.verified),
                  "org_profile.verified_at": datetime.now(timezone.utc) if body.verified else None,
                  "org_profile.verified_by": user.user_id if body.verified else None}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Organisation not found")
    # Cascade to circles + posts so badges update everywhere
    await db.communities.update_many({"org_id": org_id}, {"$set": {"verified": bool(body.verified)}})
    await db.chat_messages.update_many({"org_id": org_id}, {"$set": {"verified": bool(body.verified)}})
    return {"ok": True, "org_id": org_id, "verified": bool(body.verified)}


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
        await _notify(
            r["mentee_id"], "mentorship_accepted",
            f"{user.name} accepted your mentorship request",
            "A new chapter — reach out and say salaam.",
            link="/mentors",
        )
    else:
        await _notify(
            r["mentee_id"], "mentorship_declined",
            f"{user.name} couldn't take new mentees right now",
            "Try another mentor whose path resonates.",
            link="/mentors",
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
# Jamatkhana directory + nearest finder
# ──────────────────────────────────────────────────────────────────────────────
import math

def _haversine_km(lat1, lng1, lat2, lng2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))


@api.get("/jamatkhanas")
async def list_jamatkhanas(country: Optional[str] = None, city: Optional[str] = None, q: Optional[str] = None):
    query = {}
    if country: query["country"] = country
    if city: query["city"] = city
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
            {"country": {"$regex": q, "$options": "i"}},
        ]
    items = await db.jamatkhanas.find(query, {"_id": 0}).sort([("country", 1), ("city", 1), ("name", 1)]).to_list(length=2000)
    return {"jamatkhanas": items}


@api.get("/jamatkhanas/countries")
async def jamatkhana_countries():
    items = await db.jamatkhanas.distinct("country")
    return {"countries": sorted(items)}


@api.get("/jamatkhanas/cities")
async def jamatkhana_cities(country: str):
    items = await db.jamatkhanas.distinct("city", {"country": country})
    return {"cities": sorted(items)}


@api.get("/jamatkhanas/nearby")
async def jamatkhanas_nearby(lat: float, lng: float, limit: int = 5):
    items = await db.jamatkhanas.find({}, {"_id": 0}).to_list(length=5000)
    for it in items:
        if it.get("lat") is not None and it.get("lng") is not None:
            it["distance_km"] = round(_haversine_km(lat, lng, it["lat"], it["lng"]), 1)
        else:
            it["distance_km"] = None
    items = [i for i in items if i["distance_km"] is not None]
    items.sort(key=lambda x: x["distance_km"])
    return {"nearby": items[:limit]}


# ──────────────────────────────────────────────────────────────────────────────
# User-created communities + fixed categories
# ──────────────────────────────────────────────────────────────────────────────
COMMUNITY_CATEGORIES = ["spiritual", "ecdc", "empowerment", "social_work", "health", "education", "other"]


class CommunityIn(BaseModel):
    name: str
    category: str
    country: str = "Global"
    city: str = "Global"
    description: str = ""
    as_org: bool = False


@api.get("/communities/categories")
async def community_categories():
    return {"categories": [
        {"id": "spiritual", "label": "Spiritual Growth"},
        {"id": "ecdc", "label": "Family & ECDC"},
        {"id": "empowerment", "label": "Youth Empowerment"},
        {"id": "social_work", "label": "Social Work & Volunteering"},
        {"id": "health", "label": "Health & Wellbeing"},
        {"id": "education", "label": "Education & Learning"},
        {"id": "other", "label": "Other"},
    ]}


@api.post("/communities")
async def create_community(body: CommunityIn, user: User = Depends(current_user)):
    if body.category not in COMMUNITY_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    name = body.name.strip()
    if len(name) < 3:
        raise HTTPException(status_code=400, detail="Community name is too short.")
    community_id = f"c_{uuid.uuid4().hex[:10]}"
    is_org = body.as_org and user.role == "org" and user.org_profile
    org_name = (user.org_profile or {}).get("name") if is_org else None
    doc = {
        "community_id": community_id,
        "name": name,
        "category": body.category,
        "kind": body.category,
        "country": body.country.strip() or "Global",
        "city": body.city.strip() or "Global",
        "description": body.description.strip()[:600],
        "members": 1,
        "official": bool(is_org),
        "verified": bool(is_org and (user.org_profile or {}).get("verified")),
        "org_id": user.user_id if is_org else None,
        "org_name": org_name,
        "created_by": user.user_id,
        "moderators": [user.user_id],
        "created_at": datetime.now(timezone.utc),
        "seed_version": 2,
    }
    await db.communities.insert_one(dict(doc))
    await db.memberships.update_one(
        {"user_id": user.user_id, "community_id": community_id},
        {"$set": {"user_id": user.user_id, "community_id": community_id,
                  "joined_at": datetime.now(timezone.utc), "role": "creator"}},
        upsert=True,
    )
    return doc


def _is_community_mod(user: User, community: dict) -> bool:
    if _is_moderator(user):
        return True
    mods = community.get("moderators") or []
    return user.user_id in mods or community.get("created_by") == user.user_id


@api.get("/communities/{community_id}/moderation")
async def community_mod_queue(community_id: str, user: User = Depends(current_user)):
    comm = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    if not comm:
        raise HTTPException(status_code=404, detail="Community not found")
    if not _is_community_mod(user, comm):
        raise HTTPException(status_code=403, detail="Community moderators only.")
    # Find posts/comments/messages belonging to this community, then their reports
    posts = await db.posts.find({"community_id": community_id}, {"_id": 0, "post_id": 1}).to_list(length=2000)
    post_ids = [p["post_id"] for p in posts]
    comments = await db.comments.find({"post_id": {"$in": post_ids}}, {"_id": 0, "comment_id": 1}).to_list(length=5000)
    comment_ids = [c["comment_id"] for c in comments]
    messages = await db.chat_messages.find({"community_id": community_id}, {"_id": 0, "message_id": 1}).to_list(length=5000)
    message_ids = [m["message_id"] for m in messages]
    reports = await db.reports.find({"$or": [
        {"target_type": "post", "target_id": {"$in": post_ids}},
        {"target_type": "comment", "target_id": {"$in": comment_ids}},
        {"target_type": "message", "target_id": {"$in": message_ids}},
    ], "status": "open"}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    # Enrich targets
    for r in reports:
        if r["target_type"] == "post":
            r["target"] = await db.posts.find_one({"post_id": r["target_id"]}, {"_id": 0})
        elif r["target_type"] == "comment":
            r["target"] = await db.comments.find_one({"comment_id": r["target_id"]}, {"_id": 0})
        elif r["target_type"] == "message":
            r["target"] = await db.chat_messages.find_one({"message_id": r["target_id"]}, {"_id": 0})
    return {"community": comm, "is_moderator": True, "reports": reports}


# ──────────────────────────────────────────────────────────────────────────────
# Notifications
# ──────────────────────────────────────────────────────────────────────────────
async def _notify(user_id: str, kind: str, title: str, body: str = "", link: Optional[str] = None, meta: Optional[dict] = None):
    if not user_id:
        return
    await db.notifications.insert_one({
        "notification_id": f"ntf_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "kind": kind,
        "title": title,
        "body": body,
        "link": link,
        "meta": meta or {},
        "read": False,
        "created_at": datetime.now(timezone.utc),
    })


@api.get("/notifications")
async def list_notifications(user: User = Depends(current_user)):
    items = await db.notifications.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(length=80)
    unread = sum(1 for n in items if not n.get("read"))
    return {"notifications": items, "unread": unread}


@api.post("/notifications/mark-read")
async def mark_read(user: User = Depends(current_user)):
    await db.notifications.update_many({"user_id": user.user_id, "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ──────────────────────────────────────────────────────────────────────────────
# Home Jamatkhana + Geocoding (city lookup)
# ──────────────────────────────────────────────────────────────────────────────
class HomeJKIn(BaseModel):
    jk_id: str


@api.post("/profile/home-jamatkhana")
async def set_home_jk(body: HomeJKIn, user: User = Depends(current_user)):
    jk = await db.jamatkhanas.find_one({"jk_id": body.jk_id}, {"_id": 0})
    if not jk:
        raise HTTPException(status_code=404, detail="Jamatkhana not found")
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"home_jk_id": jk["jk_id"], "home_jk": jk, "city": jk["city"]}},
    )
    return {"ok": True, "jamatkhana": jk}


@api.get("/geocode")
async def geocode_city(q: str):
    """Lightweight free-text city lookup against our jamatkhana directory.
    Returns matching cities + nearby JKs. No external API needed."""
    q = (q or "").strip()
    if len(q) < 2:
        return {"matches": [], "jamatkhanas": []}
    matches = await db.jamatkhanas.find(
        {"$or": [
            {"city": {"$regex": q, "$options": "i"}},
            {"country": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
        ]}, {"_id": 0}
    ).limit(12).to_list(length=12)
    cities = []
    seen = set()
    for m in matches:
        key = (m["city"], m["country"])
        if key in seen:
            continue
        seen.add(key)
        cities.append({"city": m["city"], "country": m["country"]})
    return {"matches": cities, "jamatkhanas": matches}


# ──────────────────────────────────────────────────────────────────────────────
# Nominatim-backed open geocoder (free, no key) — used when user types a city
# that isn't in our JK directory.
# ──────────────────────────────────────────────────────────────────────────────
async def _nominatim_lookup(query: str) -> Optional[dict]:
    q = (query or "").strip()
    if len(q) < 2:
        return None
    # Tiny in-memory cache to be polite to the free tier
    cached = await db.geocode_cache.find_one({"q": q.lower()}, {"_id": 0})
    if cached and cached.get("hit"):
        return cached.get("result")
    result = None
    # Primary: Google Geocoding API (most reliable, key-based)
    if GOOGLE_MAPS_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as hc:
                r = await hc.get(
                    "https://maps.googleapis.com/maps/api/geocode/json",
                    params={"address": q, "key": GOOGLE_MAPS_API_KEY, "language": "en"},
                )
                r.raise_for_status()
                data = r.json() or {}
                if data.get("status") == "OK" and data.get("results"):
                    item = data["results"][0]
                    loc = item.get("geometry", {}).get("location") or {}
                    comps = item.get("address_components") or []
                    city = ""
                    country = ""
                    for c in comps:
                        types = c.get("types") or []
                        if not city and ("locality" in types or "postal_town" in types or "administrative_area_level_2" in types):
                            city = c.get("long_name") or ""
                        if "country" in types:
                            country = c.get("long_name") or ""
                    result = {
                        "lat": float(loc.get("lat")),
                        "lng": float(loc.get("lng")),
                        "city": city or q,
                        "country": country,
                        "display_name": item.get("formatted_address") or "",
                    }
                else:
                    logger.warning(f"google geocode non-OK: {data.get('status')} {data.get('error_message','')}")
        except Exception as e:
            logger.warning(f"google geocode failed: {e}")
    # Fallback 1: Open-Meteo Geocoding (free, no key)
    if not result:
        try:
            async with httpx.AsyncClient(timeout=10) as hc:
                r = await hc.get(
                    "https://geocoding-api.open-meteo.com/v1/search",
                    params={"name": q, "count": 1, "language": "en", "format": "json"},
                )
                r.raise_for_status()
                data = r.json() or {}
                arr = data.get("results") or []
                if arr:
                    item = arr[0]
                    result = {
                        "lat": float(item["latitude"]),
                        "lng": float(item["longitude"]),
                        "city": item.get("name") or q,
                        "country": item.get("country") or "",
                        "display_name": ", ".join([x for x in [item.get("name"), item.get("admin1"), item.get("country")] if x]),
                    }
        except Exception as e:
            logger.warning(f"open-meteo geocode failed: {e}")
    # Fallback 2: Nominatim
    if not result:
        try:
            async with httpx.AsyncClient(timeout=10) as hc:
                r = await hc.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": q, "format": "json", "limit": 1, "addressdetails": 1, "accept-language": "en"},
                    headers={"User-Agent": "Tasbih.ai/1.0 (community ed.)", "Accept-Language": "en"},
                )
                r.raise_for_status()
                arr = r.json() or []
                if arr:
                    item = arr[0]
                    addr = item.get("address") or {}
                    city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("hamlet") or addr.get("county") or item.get("display_name", "").split(",")[0]
                    result = {
                        "lat": float(item["lat"]),
                        "lng": float(item["lon"]),
                        "city": city or q,
                        "country": addr.get("country") or "",
                        "display_name": item.get("display_name") or "",
                    }
        except Exception as e:
            logger.warning(f"nominatim failed: {e}")
    if not result:
        await db.geocode_cache.update_one({"q": q.lower()}, {"$set": {"q": q.lower(), "hit": False, "ts": datetime.now(timezone.utc)}}, upsert=True)
        return None
    await db.geocode_cache.update_one({"q": q.lower()}, {"$set": {"q": q.lower(), "hit": True, "result": result, "ts": datetime.now(timezone.utc)}}, upsert=True)
    return result


class CityIn(BaseModel):
    city: str


@api.post("/profile/city")
async def set_profile_city(body: CityIn, user: User = Depends(current_user)):
    """Geocode the user's free-text city via Nominatim and save lat/lng + canonical name."""
    raw = (body.city or "").strip()
    if not raw:
        await db.users.update_one({"user_id": user.user_id}, {"$unset": {"city": "", "home_city": ""}})
        return {"ok": True, "city": None}
    geo = await _nominatim_lookup(raw)
    update = {"city": (geo or {}).get("city") or raw}
    if geo:
        update["home_city"] = {
            "name": geo["city"],
            "country": geo["country"],
            "lat": geo["lat"],
            "lng": geo["lng"],
            "display_name": geo["display_name"],
        }
    await db.users.update_one({"user_id": user.user_id}, {"$set": update})
    return {"ok": True, "city": update["city"], "geo": geo}


# ──────────────────────────────────────────────────────────────────────────────
# My Sangat — personal spiritual passport
# ──────────────────────────────────────────────────────────────────────────────
@api.get("/profile/sangat")
async def my_sangat(user: User = Depends(current_user)):
    # Memberships → communities
    mems = await db.memberships.find({"user_id": user.user_id}, {"_id": 0}).to_list(length=100)
    cids = [m["community_id"] for m in mems]
    communities = await db.communities.find({"community_id": {"$in": cids}}, {"_id": 0}).to_list(length=100)
    by_id = {c["community_id"]: c for c in communities}
    enriched_mems = [{**m, "community": by_id.get(m["community_id"])} for m in mems if by_id.get(m["community_id"])]

    # Mentor connections (mentee accepted requests)
    accepted_sent = await db.mentorship_requests.find(
        {"mentee_id": user.user_id, "status": "accepted"}, {"_id": 0}
    ).to_list(length=20)
    mentor_ids = [a["mentor_id"] for a in accepted_sent]
    mentor_users = await db.users.find({"user_id": {"$in": mentor_ids}}, {"_id": 0, "user_id": 1, "name": 1, "city": 1}).to_list(length=20)
    mentor_profiles = await db.mentor_profiles.find({"user_id": {"$in": mentor_ids}}, {"_id": 0}).to_list(length=20)
    by_uid = {u["user_id"]: u for u in mentor_users}
    bp_uid = {p["user_id"]: p for p in mentor_profiles}
    mentors = [{**by_uid.get(mid, {}), "headline": (bp_uid.get(mid) or {}).get("headline")} for mid in mentor_ids]

    # Mentees (mentor accepted received)
    accepted_recv = await db.mentorship_requests.find(
        {"mentor_id": user.user_id, "status": "accepted"}, {"_id": 0}
    ).to_list(length=50)
    mentee_count = len(accepted_recv)

    # Khidmah for current month (reuse aggregate)
    now = datetime.now(timezone.utc)
    start, end = _month_window(now.year, now.month)
    points = 0
    # Volunteer RSVPs
    vol_event_ids = [e["event_id"] for e in await db.events.find({"tag": "Volunteer"}, {"_id": 0, "event_id": 1}).to_list(length=200)]
    rsvps_n = await db.rsvps.count_documents({"user_id": user.user_id, "event_id": {"$in": vol_event_ids}, "rsvp_at": {"$gte": start, "$lt": end}}) if vol_event_ids else 0
    posts_n = await db.posts.count_documents({"user_id": user.user_id, "created_at": {"$gte": start, "$lt": end}, "likes": {"$gte": 1}})
    comments_long = await db.comments.find({"user_id": user.user_id, "created_at": {"$gte": start, "$lt": end}}, {"_id": 0, "text": 1}).to_list(length=2000)
    comments_n = sum(1 for c in comments_long if len(c.get("text") or "") >= 60)
    mentor_accept_n = await db.mentorship_requests.count_documents({"mentor_id": user.user_id, "status": "accepted", "responded_at": {"$gte": start, "$lt": end}})
    mentee_accept_n = await db.mentorship_requests.count_documents({"mentee_id": user.user_id, "status": "accepted", "responded_at": {"$gte": start, "$lt": end}})
    points = rsvps_n * KHIDMAH_RULES["volunteer_rsvp"] + posts_n * KHIDMAH_RULES["post_with_likes"] + comments_n * KHIDMAH_RULES["kind_comment"] + mentor_accept_n * KHIDMAH_RULES["mentorship_accepted_mentor"] + mentee_accept_n * KHIDMAH_RULES["mentorship_accepted_mentee"]

    # Tasbih streak
    tasbih = await db.tasbih_state.find_one({"user_id": user.user_id}, {"_id": 0}) or {"streak": 0, "total": 0}

    # Home jamatkhana + city geo
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    home_jk = user_doc.get("home_jk")
    home_city = user_doc.get("home_city")

    # All jamatkhanas matching member cities so map can plot them
    city_keys = []
    for m in enriched_mems:
        c = (m.get("community") or {})
        if c.get("city") and c.get("city") != "Global":
            city_keys.append(c["city"])
    nearby_jks = []
    if city_keys:
        nearby_jks = await db.jamatkhanas.find({"city": {"$in": list(set(city_keys))}}, {"_id": 0}).to_list(length=200)

    return {
        "user": {"user_id": user.user_id, "name": user.name, "city": user.city, "status": user.status},
        "home_jamatkhana": home_jk,
        "home_city": home_city,
        "city_jamatkhanas": nearby_jks,
        "memberships": enriched_mems,
        "mentors": mentors,
        "mentee_count": mentee_count,
        "khidmah_points": points,
        "tasbih_streak": tasbih.get("streak", 0),
        "tasbih_total": tasbih.get("total", 0),
        "month": now.strftime("%B %Y"),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Noor Digest — weekly personalised reflection
# ──────────────────────────────────────────────────────────────────────────────
def _week_window():
    now = datetime.now(timezone.utc)
    # Week starts Sunday 00:00 UTC
    weekday = (now.weekday() + 1) % 7  # Sun=0
    start = (now - timedelta(days=weekday)).replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=7)
    return start, end, start.strftime("%Y-W%U")


@api.get("/noor/year-mosaic")
async def noor_year_mosaic(user: User = Depends(current_user)):
    """52-tile visualisation of all saved Sunday digests for the current year."""
    now = datetime.now(timezone.utc)
    year = now.year
    start = datetime(year, 1, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    entries = await db.journal_entries.find(
        {"user_id": user.user_id, "tags": "noor-digest",
         "created_at": {"$gte": start, "$lt": end}},
        {"_id": 0}
    ).sort("created_at", 1).to_list(length=60)
    by_week = {}
    for e in entries:
        ts = e.get("created_at")
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        iso = ts.isocalendar()
        by_week[iso.week] = {
            "title": e.get("title") or "",
            "body": e.get("body") or "",
            "date": ts.date().isoformat(),
            "entry_id": e.get("entry_id"),
        }
    tiles = []
    for w in range(1, 54):
        tile = by_week.get(w)
        tiles.append({
            "week": w,
            "lit": bool(tile),
            "title": (tile or {}).get("title", ""),
            "body": (tile or {}).get("body", ""),
            "date": (tile or {}).get("date", ""),
            "entry_id": (tile or {}).get("entry_id"),
        })
    current_iso = now.isocalendar()
    return {
        "year": year,
        "current_week": current_iso.week,
        "tiles": tiles,
        "lit_count": len(by_week),
    }



@api.get("/noor/digest")
async def noor_digest(user: User = Depends(current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    start, end, key = _week_window()
    # Return cached digest if already generated this week
    cached = await db.noor_digests.find_one({"user_id": user.user_id, "week_key": key}, {"_id": 0})
    if cached:
        return cached

    # Pull this week's gentle data
    journal = await db.journal.find({"user_id": user.user_id, "created_at": {"$gte": start, "$lt": end}}, {"_id": 0}).sort("created_at", 1).to_list(length=20)
    tasbih_sessions = await db.tasbih_sessions.find({"user_id": user.user_id, "created_at": {"$gte": start, "$lt": end}}, {"_id": 0}).to_list(length=200)
    dhikr_count = sum(t.get("count", 0) for t in tasbih_sessions)
    dhikr_days = len({t.get("day") for t in tasbih_sessions})
    streak = (await db.tasbih_state.find_one({"user_id": user.user_id}, {"_id": 0}) or {}).get("streak", 0)
    mems = await db.memberships.count_documents({"user_id": user.user_id})
    sangat = await my_sangat(user)
    khidmah_pts = sangat.get("khidmah_points", 0)

    if not journal and dhikr_count == 0 and khidmah_pts == 0:
        digest_text = (
            "A quiet week — the kind that doesn't ask much of you. \n"
            "Sometimes the holy thing is just to keep showing up gently. "
            "May the days ahead be soft on your heart, and may one small ritual return to you this week."
        )
        themes = ["stillness"]
    else:
        journal_excerpts = "\n".join([f"- {(j.get('title') or 'entry')}: {(j.get('body') or '')[:160]}" for j in journal[:6]]) or "(no journal entries)"
        prompt = (
            f"This is a private weekly reflection for a user of Tasbih.ai. Write a calm, "
            f"4-sentence digest in second person ('You…') drawing only on the data below. "
            f"Do NOT invent facts. End with one tiny invitation for next week.\n\n"
            f"Data:\n"
            f"- Journal entries this week:\n{journal_excerpts}\n"
            f"- Tasbih dhikr count this week: {dhikr_count} (across {dhikr_days} day(s)). Current streak: {streak} day(s).\n"
            f"- Communities joined: {mems}. Khidmah points this month: {khidmah_pts}.\n\n"
            f"Tone: gentle, warm, never preachy. Avoid platitudes. No fatwas. No religious rulings."
        )
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"digest_{user.user_id}_{key}",
                system_message=NOOR_SYSTEM_PROMPT,
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            digest_text = await chat.send_message(UserMessage(text=prompt))
        except Exception as e:
            logger.exception("digest failed")
            digest_text = "This week, you showed up. That is its own quiet victory."
        themes = []
        if journal: themes.append("reflection")
        if dhikr_count > 0: themes.append("dhikr")
        if khidmah_pts > 0: themes.append("khidmah")

    doc = {
        "user_id": user.user_id,
        "week_key": key,
        "window_start": start.isoformat(),
        "window_end": end.isoformat(),
        "text": digest_text,
        "themes": themes,
        "stats": {
            "dhikr_count": dhikr_count,
            "dhikr_days": dhikr_days,
            "streak": streak,
            "journal_entries": len(journal),
            "khidmah_points": khidmah_pts,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.noor_digests.insert_one(dict(doc))
    return doc


# ──────────────────────────────────────────────────────────────────────────────
# Organisations — "Become an org" + directory
# ──────────────────────────────────────────────────────────────────────────────
ORG_CATEGORIES = {"spiritual", "ecdc", "empowerment", "social_work", "health", "education", "other"}


class OrgProfileIn(BaseModel):
    name: str
    tagline: Optional[str] = ""
    description: str = ""
    category: str = "other"
    country: str = "Global"
    city: str = "Global"
    website: Optional[str] = ""
    logo_url: Optional[str] = ""


@api.get("/orgs")
async def list_orgs(country: Optional[str] = None, category: Optional[str] = None, q: Optional[str] = None, verified_only: bool = False):
    query = {"role": "org", "org_profile": {"$ne": None}}
    if country:
        query["org_profile.country"] = country
    if category:
        query["org_profile.category"] = category
    if verified_only:
        query["org_profile.verified"] = True
    if q:
        query["$or"] = [
            {"org_profile.name": {"$regex": q, "$options": "i"}},
            {"org_profile.description": {"$regex": q, "$options": "i"}},
            {"org_profile.city": {"$regex": q, "$options": "i"}},
        ]
    users = await db.users.find(query, {"_id": 0, "user_id": 1, "org_profile": 1, "picture": 1}).to_list(length=200)
    items = []
    for u in users:
        op = u.get("org_profile") or {}
        items.append({
            "org_id": u["user_id"],
            "name": op.get("name") or "",
            "tagline": op.get("tagline") or "",
            "description": op.get("description") or "",
            "category": op.get("category") or "other",
            "country": op.get("country") or "Global",
            "city": op.get("city") or "Global",
            "website": op.get("website") or "",
            "logo_url": op.get("logo_url") or u.get("picture") or "",
            "verified": bool(op.get("verified")),
        })
    return {"orgs": items}


@api.get("/orgs/me")
async def my_org(user: User = Depends(current_user)):
    return {"role": user.role, "org_profile": user.org_profile}


@api.post("/orgs/me")
async def become_or_update_org(body: OrgProfileIn, user: User = Depends(current_user)):
    name = (body.name or "").strip()
    if len(name) < 3:
        raise HTTPException(status_code=400, detail="Organisation name is too short.")
    if body.category not in ORG_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category.")
    existing = (await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}).get("org_profile") or {}
    org = {
        "name": name,
        "tagline": (body.tagline or "")[:140],
        "description": (body.description or "")[:1500],
        "category": body.category,
        "country": (body.country or "Global").strip() or "Global",
        "city": (body.city or "Global").strip() or "Global",
        "website": (body.website or "")[:200],
        "logo_url": (body.logo_url or "")[:500],
        "verified": bool(existing.get("verified")),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"role": "org", "org_profile": org}},
    )
    return {"ok": True, "role": "org", "org_profile": org}


@api.delete("/orgs/me")
async def retire_org(user: User = Depends(current_user)):
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"role": "member", "org_profile": None}},
    )
    return {"ok": True, "role": "member"}


@api.get("/orgs/{org_id}")
async def get_org(org_id: str):
    u = await db.users.find_one({"user_id": org_id, "role": "org"}, {"_id": 0})
    if not u or not u.get("org_profile"):
        raise HTTPException(status_code=404, detail="Organisation not found")
    op = u["org_profile"]
    # Org's circles + events
    circles = await db.communities.find({"created_by": org_id}, {"_id": 0}).sort("created_at", -1).to_list(length=50)
    events = await db.events.find({"org_id": org_id}, {"_id": 0}).sort("date", 1).to_list(length=50)
    return {
        "org_id": org_id,
        "name": op.get("name") or "",
        "tagline": op.get("tagline") or "",
        "description": op.get("description") or "",
        "category": op.get("category") or "other",
        "country": op.get("country") or "Global",
        "city": op.get("city") or "Global",
        "website": op.get("website") or "",
        "logo_url": op.get("logo_url") or u.get("picture") or "",
        "verified": bool(op.get("verified")),
        "circles": circles,
        "events": events,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Quran reader — authentic text via alquran.cloud (free, no key)
# ──────────────────────────────────────────────────────────────────────────────
QURAN_EDITIONS = {
    "ar":  "quran-uthmani",          # always returned
    "en":  "en.sahih",                # Sahih International (recognised authentic English)
    "en2": "en.asad",                 # Muhammad Asad
    "ur":  "ur.jalandhry",            # Fateh Muhammad Jalandhry
    "fr":  "fr.hamidullah",
    "tr":  "tr.diyanet",
    "id":  "id.indonesian",
    "ru":  "ru.kuliev",
    "es":  "es.cortes",
    "de":  "de.aburida",
}
QURAN_LANG_LABELS = {
    "en": "English (Sahih International)",
    "en2": "English (Muhammad Asad)",
    "ur": "اردو (Urdu)",
    "fr": "Français",
    "tr": "Türkçe",
    "id": "Bahasa Indonesia",
    "ru": "Русский",
    "es": "Español",
    "de": "Deutsch",
}


@api.get("/quran/surahs")
async def quran_surahs():
    cached = await db.quran_cache.find_one({"key": "surah_list"}, {"_id": 0})
    if cached and cached.get("data"):
        return {"surahs": cached["data"]}
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.get("https://api.alquran.cloud/v1/surah")
            r.raise_for_status()
            data = r.json().get("data") or []
    except Exception as e:
        logger.warning(f"quran list failed: {e}")
        raise HTTPException(status_code=502, detail="Could not load Quran index.")
    surahs = [{
        "number": s["number"],
        "name": s["name"],
        "english_name": s["englishName"],
        "english_translation": s["englishNameTranslation"],
        "revelation_type": s["revelationType"],
        "ayah_count": s["numberOfAyahs"],
    } for s in data]
    await db.quran_cache.update_one({"key": "surah_list"}, {"$set": {"key": "surah_list", "data": surahs, "ts": datetime.now(timezone.utc)}}, upsert=True)
    return {"surahs": surahs}


@api.get("/quran/languages")
async def quran_languages():
    return {"languages": [{"id": k, "label": v} for k, v in QURAN_LANG_LABELS.items()]}


@api.get("/quran/surah/{number}")
async def quran_surah(number: int, lang: str = "en"):
    if number < 1 or number > 114:
        raise HTTPException(status_code=400, detail="Surah number must be 1-114.")
    lang = lang if lang in QURAN_EDITIONS else "en"
    ed = QURAN_EDITIONS[lang]
    cache_key = f"surah_{number}_{lang}"
    cached = await db.quran_cache.find_one({"key": cache_key}, {"_id": 0})
    if cached and cached.get("data"):
        return cached["data"]
    try:
        async with httpx.AsyncClient(timeout=20) as hc:
            r = await hc.get(f"https://api.alquran.cloud/v1/surah/{number}/editions/quran-uthmani,{ed}")
            r.raise_for_status()
            arr = r.json().get("data") or []
    except Exception as e:
        logger.warning(f"quran surah {number} {lang} failed: {e}")
        raise HTTPException(status_code=502, detail="Could not load surah right now.")
    if len(arr) < 2:
        raise HTTPException(status_code=502, detail="Translation unavailable.")
    ar = arr[0]
    tr = arr[1]
    ayahs = []
    for i, a_ar in enumerate(ar.get("ayahs") or []):
        a_tr = tr["ayahs"][i] if i < len(tr.get("ayahs") or []) else {}
        ayahs.append({
            "number": a_ar.get("numberInSurah"),
            "ar": a_ar.get("text") or "",
            "tr": a_tr.get("text") or "",
            "juz": a_ar.get("juz"),
            "sajda": bool(a_ar.get("sajda") and a_ar["sajda"] is not False),
        })
    doc = {
        "number": ar.get("number"),
        "name": ar.get("name"),
        "english_name": ar.get("englishName"),
        "english_translation": ar.get("englishNameTranslation"),
        "revelation_type": ar.get("revelationType"),
        "language": lang,
        "language_label": QURAN_LANG_LABELS.get(lang, lang),
        "translator": tr.get("edition", {}).get("englishName") if isinstance(tr.get("edition"), dict) else None,
        "ayah_count": ar.get("numberOfAyahs"),
        "ayahs": ayahs,
    }
    await db.quran_cache.update_one({"key": cache_key}, {"$set": {"key": cache_key, "data": doc, "ts": datetime.now(timezone.utc)}}, upsert=True)
    return doc


# ──────────────────────────────────────────────────────────────────────────────
# Ismaili Calendar — fixed dates + Hijri-derived important dates + Chandraat
# ──────────────────────────────────────────────────────────────────────────────
from hijri_converter import Hijri, Gregorian  # noqa: E402

# Gregorian-fixed events (same date every year)
GREGORIAN_EVENTS = [
    {"id": "salgirah", "month": 12, "day": 13, "title": "Salgirah", "subtitle": "Birthday of His Highness the Aga Khan", "kind": "imamat", "reflection": "A day of gratitude — for vision held over decades, and the soft thread of guidance that binds the global jamat."},
    {"id": "imamat_day", "month": 7, "day": 11, "title": "Imamat Day", "subtitle": "Accession of His Highness", "kind": "imamat", "reflection": "Remembering the unbroken thread of light — from Hazrat Ali to today's Imam. A quiet recommitment to seva and pluralism."},
    {"id": "navroz", "month": 3, "day": 21, "title": "Navroz", "subtitle": "New Year of renewal", "kind": "festival", "reflection": "A new spring of the soul. Pause, set one gentle intention for the year, and reach out to a loved one."},
    {"id": "didar_day", "month": 7, "day": 1, "title": "Diamond Jubilee remembrance", "subtitle": "A milestone of giving", "kind": "imamat", "reflection": "Remembering decades of khidmah, education, and the soft work of building a better world."},
]

# Hijri-fixed events (Hijri month, day)
HIJRI_EVENTS = [
    {"id": "ashura", "h_month": 1, "h_day": 10, "title": "Yawm-e-Ashura", "subtitle": "10 Muharram — remembrance of Imam Hussein", "kind": "remembrance", "reflection": "A day held tenderly across centuries. Sit with the weight of sacrifice; let it soften you toward those who suffer today."},
    {"id": "yawm_e_ali", "h_month": 7, "h_day": 13, "title": "Yawm-e-Ali", "subtitle": "Birth of Hazrat Ali (a.s.)", "kind": "imamat", "reflection": "Reflect on the courage and intellect (ʿaql) embodied by Mawla Ali — and how that light still walks through the present Imam."},
    {"id": "ramadan_start", "h_month": 9, "h_day": 1, "title": "1st of Ramadan", "subtitle": "The quiet month begins", "kind": "fasting", "reflection": "A month of stillness, restraint and remembrance. Begin gently — even one sincere intention is enough."},
    {"id": "laylat_qadr", "h_month": 9, "h_day": 27, "title": "Lailat-ul-Qadr", "subtitle": "Night of Power (commonly observed)", "kind": "fasting", "reflection": "On this hush of a night, mercy is closer than usual. Whisper one honest dua and let it rest."},
    {"id": "eid_fitr", "h_month": 10, "h_day": 1, "title": "Eid-ul-Fitr", "subtitle": "Celebration after Ramadan", "kind": "festival", "reflection": "Joy carried gently. Share a meal, mend a small distance, and remember those without one today."},
    {"id": "hajj", "h_month": 12, "h_day": 9, "title": "Day of Arafah", "subtitle": "Hajj day of standing", "kind": "remembrance", "reflection": "A day of presence and humility before the One. Wherever you are, stand still for a moment."},
    {"id": "eid_adha", "h_month": 12, "h_day": 10, "title": "Eid-ul-Adha", "subtitle": "Festival of sacrifice", "kind": "festival", "reflection": "What are you being asked to release this year? Sacrifice rarely looks how we expect."},
    {"id": "eid_ghadir", "h_month": 12, "h_day": 18, "title": "Eid-e-Ghadir", "subtitle": "Designation of Mawla Ali at Ghadir Khumm", "kind": "imamat", "reflection": "The beginning of the visible thread of Imamat — a designation of love and trust, still alive today."},
]


def _gregorian_to_hijri(y: int, m: int, d: int):
    try:
        h = Gregorian(y, m, d).to_hijri()
        return {"year": h.year, "month": h.month, "day": h.day, "month_name": h.month_name(), "day_name": h.day_name()}
    except Exception:
        return None


def _hijri_to_gregorian(hy: int, hm: int, hd: int):
    try:
        g = Hijri(hy, hm, hd).to_gregorian()
        return datetime(g.year, g.month, g.day, tzinfo=timezone.utc).date()
    except Exception:
        return None


def _chandraat_for_hijri_month(hy: int, hm: int):
    """Chandraat = evening before the 1st of a Hijri month (sighting of the new crescent).
    We mark the Gregorian date corresponding to the LAST day of the PREVIOUS Hijri month."""
    prev_m = hm - 1 if hm > 1 else 12
    prev_y = hy if hm > 1 else hy - 1
    # Hijri months are 29 or 30 days; we ask the converter which one
    for last_day in (30, 29):
        try:
            h = Hijri(prev_y, prev_m, last_day)
            g = h.to_gregorian()
            return datetime(g.year, g.month, g.day, tzinfo=timezone.utc).date()
        except Exception:
            continue
    return None


def _events_in_range(start_date, end_date):
    """Compute every Ismaili-significant event between two dates (inclusive)."""
    events = []
    cursor = start_date
    while cursor <= end_date:
        y, m, d = cursor.year, cursor.month, cursor.day
        # Gregorian-fixed
        for e in GREGORIAN_EVENTS:
            if e["month"] == m and e["day"] == d:
                events.append({**e, "date": cursor.isoformat()})
        # Hijri-fixed (convert today's Hijri date, match against HIJRI_EVENTS)
        h = _gregorian_to_hijri(y, m, d)
        if h:
            for e in HIJRI_EVENTS:
                if h["month"] == e["h_month"] and h["day"] == e["h_day"]:
                    events.append({**e, "date": cursor.isoformat(), "hijri": h})
            # Chandraat = last day of a Hijri month
            try:
                next_day = cursor + timedelta(days=1)
                h2 = _gregorian_to_hijri(next_day.year, next_day.month, next_day.day)
                if h2 and h2["day"] == 1:
                    events.append({
                        "id": f"chandraat_{h2['year']}_{h2['month']}",
                        "title": "Chandraat",
                        "subtitle": f"Eve of {h2['month_name']} {h2['year']} AH",
                        "kind": "chandraat",
                        "reflection": "The new moon arrives. A quiet pause before the next chapter — bring your heart in.",
                        "date": cursor.isoformat(),
                        "hijri": h,
                    })
            except Exception:
                pass
        cursor = cursor + timedelta(days=1)
    return events


@api.get("/calendar/today")
async def calendar_today():
    today = datetime.now(timezone.utc).date()
    h = _gregorian_to_hijri(today.year, today.month, today.day)
    horizon = today + timedelta(days=14)
    upcoming = _events_in_range(today, horizon)
    return {
        "today": today.isoformat(),
        "hijri": h,
        "upcoming": upcoming,
    }


@api.get("/calendar/month")
async def calendar_month(year: int, month: int):
    if not (2024 <= year <= 2100 and 1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Invalid year/month.")
    first = datetime(year, month, 1, tzinfo=timezone.utc).date()
    # last day of the month
    if month == 12:
        next_first = datetime(year + 1, 1, 1, tzinfo=timezone.utc).date()
    else:
        next_first = datetime(year, month + 1, 1, tzinfo=timezone.utc).date()
    last = next_first - timedelta(days=1)
    events = _events_in_range(first, last)
    # Hijri label for the 1st of this month (just for header)
    h_first = _gregorian_to_hijri(first.year, first.month, first.day)
    h_last = _gregorian_to_hijri(last.year, last.month, last.day)
    return {
        "year": year,
        "month": month,
        "first_iso": first.isoformat(),
        "last_iso": last.isoformat(),
        "hijri_first": h_first,
        "hijri_last": h_last,
        "events": events,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Curated content — Ginan, Dua, Family/ECDC
# Source: /app/backend/content.py (curated by Naushad & Shabnam Patel)
# ──────────────────────────────────────────────────────────────────────────────
try:
    from content import GINAN, DUA, FAMILY_CORNER  # type: ignore
except Exception:
    GINAN, DUA, FAMILY_CORNER = [], [], []


@api.get("/ginan")
async def list_ginan(theme: Optional[str] = None, q: Optional[str] = None):
    items = list(GINAN)
    if theme:
        items = [g for g in items if g.get("theme") == theme]
    if q:
        q_ = q.lower()
        items = [g for g in items if q_ in (g.get("title", "") + " " + g.get("english", "") + " " + g.get("pir", "")).lower()]
    return {"ginan": items, "credit": "Curated by Naushad & Shabnam Patel · Andheri Jamatkhana · Mumbai · India"}


@api.get("/ginan/{ginan_id}")
async def get_ginan(ginan_id: str):
    for g in GINAN:
        if g.get("id") == ginan_id:
            return g
    raise HTTPException(status_code=404, detail="Ginan not found")


@api.get("/dua")
async def list_dua(situation: Optional[str] = None, q: Optional[str] = None):
    items = list(DUA)
    if situation:
        s_ = situation.lower()
        items = [d for d in items if s_ in (d.get("situation", "") + " " + d.get("title", "")).lower()]
    if q:
        q_ = q.lower()
        items = [d for d in items if q_ in (d.get("title", "") + " " + d.get("english", "") + " " + d.get("transliteration", "")).lower()]
    return {"dua": items, "credit": "Curated by Naushad & Shabnam Patel · Andheri Jamatkhana · Mumbai · India"}


@api.get("/dua/{dua_id}")
async def get_dua(dua_id: str):
    for d in DUA:
        if d.get("id") == dua_id:
            return d
    raise HTTPException(status_code=404, detail="Dua not found")


@api.get("/family-corner")
async def family_corner(stage: Optional[str] = None):
    items = list(FAMILY_CORNER)
    if stage:
        items = [f for f in items if f.get("stage") == stage or f.get("stage") == "all"]
    # Stages summary for the UI tabs
    stage_meta = [
        {"id": "infant", "label": "Infant · 0–2"},
        {"id": "toddler", "label": "Toddler · 2–4"},
        {"id": "early", "label": "Early · 4–7"},
        {"id": "middle", "label": "Middle · 7–11"},
        {"id": "adolescent", "label": "Adolescent · 11–15"},
        {"id": "teen", "label": "Teen · 15–18"},
        {"id": "all", "label": "Any age"},
    ]
    return {"prompts": items, "stages": stage_meta, "credit": "Curated by Naushad & Shabnam Patel · Andheri Jamatkhana · Mumbai · India"}


# ──────────────────────────────────────────────────────────────────────────────
# Seeding
# ──────────────────────────────────────────────────────────────────────────────
async def seed_data():
    # Bootstrap 30 founder invite codes (only if NONE exist anywhere)
    if await db.invite_codes.count_documents({}) == 0:
        import secrets
        founder_codes = []
        seen = set()
        while len(founder_codes) < 30:
            code = "".join(secrets.choice(_INVITE_ALPHABET) for _ in range(8))
            if code in seen:
                continue
            seen.add(code)
            founder_codes.append(code)
        await db.invite_codes.insert_many([
            {"code": c, "issued_by": "system", "used_by": None, "founder": True,
             "created_at": datetime.now(timezone.utc)}
            for c in founder_codes
        ])
        logger.info(f"Seeded {len(founder_codes)} founder invite codes")

    # Drop legacy demo communities once, then reseed canonical category circles
    if await db.communities.count_documents({"seed_version": {"$ne": 2}}) > 0:
        await db.communities.delete_many({"seed_version": {"$ne": 2}})

    if await db.communities.count_documents({}) == 0:
        # Six FIXED canonical category circles — every member can join these.
        canonical = [
            ("c_spiritual", "Spiritual Growth", "spiritual",
             "Reflections, Qurʾan, dhikr, journaling — the quiet centre of the platform."),
            ("c_ecdc", "Family & ECDC", "ecdc",
             "Early childhood development, parenting circles, family halqas."),
            ("c_empowerment", "Youth Empowerment", "empowerment",
             "Mentorship, skills, scholarships, career growth for young members."),
            ("c_socialwork", "Social Work & Volunteering", "social_work",
             "Volunteer drives, seva, food banks, blood drives, community service."),
            ("c_health", "Health & Wellbeing", "health",
             "Mental health peer circles, fitness, nutrition, caregiver support."),
            ("c_education", "Education & Learning", "education",
             "Tutoring, study groups, scholarship support, lifelong learners."),
        ]
        await db.communities.insert_many([
            {
                "community_id": cid, "name": name, "category": cat,
                "city": "Global", "country": "Global",
                "members": 0, "kind": cat, "official": True,
                "description": desc, "seed_version": 2,
                "created_at": datetime.now(timezone.utc),
            }
            for (cid, name, cat, desc) in canonical
        ])
    else:
        # Backfill country / category on legacy docs if any survived
        await db.communities.update_many({"country": {"$exists": False}}, {"$set": {"country": "Global"}})
        await db.communities.update_many({"category": {"$exists": False}}, {"$set": {"category": "other"}})

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
        # No seeded mentors — let real users create their own profiles.
        # An empty mentor list is intentional; the Mentors page shows a friendly
        # "Be the first mentor" empty state with a "Become a mentor" CTA.
        pass

    if await db.reflections.count_documents({}) == 0:
        # No demo reflections — the feed will populate from real community activity.
        pass

    # ── Jamatkhana directory ──
    # Bumped seed version forces a full reseed so new entries flow in.
    if await db.jamatkhanas.count_documents({"seed_version": {"$gte": 2}}) == 0:
        await db.jamatkhanas.delete_many({})
        jks = [
            # Canada
            ("Ismaili Centre Toronto", "Toronto", "Canada", 43.7286, -79.3373, "49 Wynford Drive, Toronto"),
            ("Headquarters Jamatkhana Toronto", "Toronto", "Canada", 43.6532, -79.3832, "Downtown Toronto"),
            ("Bayview Jamatkhana", "Toronto", "Canada", 43.7800, -79.3760, "Bayview Ave area, Toronto"),
            ("Don Mills Jamatkhana", "Toronto", "Canada", 43.7421, -79.3457, "Don Mills, Toronto"),
            ("Mississauga Jamatkhana", "Mississauga", "Canada", 43.5890, -79.6441, "Mississauga, ON"),
            ("Brampton Jamatkhana", "Brampton", "Canada", 43.7315, -79.7624, "Brampton, ON"),
            ("Markham Jamatkhana", "Markham", "Canada", 43.8561, -79.3370, "Markham, ON"),
            ("Calgary Jamatkhana (Headquarters)", "Calgary", "Canada", 51.0447, -114.0719, "Calgary, AB"),
            ("Calgary South Jamatkhana", "Calgary", "Canada", 50.9667, -114.0832, "Calgary South, AB"),
            ("Edmonton Jamatkhana", "Edmonton", "Canada", 53.5461, -113.4938, "Edmonton, AB"),
            ("Vancouver Jamatkhana (Burnaby)", "Burnaby", "Canada", 49.2488, -122.9805, "Burnaby, BC"),
            ("Surrey Jamatkhana", "Surrey", "Canada", 49.1913, -122.8490, "Surrey, BC"),
            ("Ottawa Jamatkhana", "Ottawa", "Canada", 45.4215, -75.6972, "Ottawa, ON"),
            ("Montreal Jamatkhana", "Montreal", "Canada", 45.5017, -73.5673, "Montreal, QC"),
            ("Winnipeg Jamatkhana", "Winnipeg", "Canada", 49.8951, -97.1384, "Winnipeg, MB"),
            ("Halifax Jamatkhana", "Halifax", "Canada", 44.6488, -63.5752, "Halifax, NS"),
            # United States
            ("Ismaili Jamatkhana & Center, Plano", "Plano", "United States", 33.0198, -96.6989, "Plano, TX"),
            ("Sugarland Jamatkhana", "Sugar Land", "United States", 29.5994, -95.6147, "Sugar Land, TX"),
            ("Headquarters Jamatkhana Houston", "Houston", "United States", 29.7604, -95.3698, "Houston, TX"),
            ("Houston SW Jamatkhana", "Houston", "United States", 29.6516, -95.5777, "Houston SW, TX"),
            ("Austin Jamatkhana", "Austin", "United States", 30.2672, -97.7431, "Austin, TX"),
            ("San Antonio Jamatkhana", "San Antonio", "United States", 29.4241, -98.4936, "San Antonio, TX"),
            ("Atlanta Jamatkhana", "Atlanta", "United States", 33.7490, -84.3880, "Atlanta, GA"),
            ("Charlotte Jamatkhana", "Charlotte", "United States", 35.2271, -80.8431, "Charlotte, NC"),
            ("Manhattan Jamatkhana", "New York", "United States", 40.7831, -73.9712, "Upper West Side, NY"),
            ("Long Island Jamatkhana", "Long Island", "United States", 40.7891, -73.1350, "Long Island, NY"),
            ("Iselin Jamatkhana", "Iselin", "United States", 40.5754, -74.3221, "Iselin, NJ"),
            ("Boston Jamatkhana", "Burlington", "United States", 42.5048, -71.1956, "Burlington, MA"),
            ("Los Angeles Jamatkhana", "Sunset", "United States", 34.0982, -118.3267, "Sunset, CA"),
            ("Orange County Jamatkhana", "Anaheim", "United States", 33.8366, -117.9143, "Anaheim, CA"),
            ("San Diego Jamatkhana", "San Diego", "United States", 32.7157, -117.1611, "San Diego, CA"),
            ("Bay Area Jamatkhana", "Sunnyvale", "United States", 37.3688, -122.0363, "Sunnyvale, CA"),
            ("Sacramento Jamatkhana", "Sacramento", "United States", 38.5816, -121.4944, "Sacramento, CA"),
            ("Chicago Jamatkhana", "Glenview", "United States", 42.0697, -87.7878, "Glenview, IL"),
            ("Orlando Jamatkhana", "Orlando", "United States", 28.5383, -81.3792, "Orlando, FL"),
            ("Miami Jamatkhana", "Miami", "United States", 25.7617, -80.1918, "Miami, FL"),
            ("Tampa Jamatkhana", "Tampa", "United States", 27.9506, -82.4572, "Tampa, FL"),
            ("DC Metro Jamatkhana", "Washington", "United States", 38.9072, -77.0369, "Washington, DC"),
            ("Seattle Jamatkhana", "Seattle", "United States", 47.6062, -122.3321, "Seattle, WA"),
            ("Phoenix Jamatkhana", "Phoenix", "United States", 33.4484, -112.0740, "Phoenix, AZ"),
            ("Denver Jamatkhana", "Denver", "United States", 39.7392, -104.9903, "Denver, CO"),
            # United Kingdom
            ("Ismaili Centre London", "London", "United Kingdom", 51.4955, -0.1747, "1-7 Cromwell Gardens, London SW7"),
            ("Aga Khan Centre", "London", "United Kingdom", 51.5410, -0.1276, "10 Handyside Street, King's Cross, London"),
            ("Headquarters Jamatkhana London (South Kensington)", "London", "United Kingdom", 51.4955, -0.1747, "South Kensington, London"),
            ("Hounslow Jamatkhana", "Hounslow", "United Kingdom", 51.4685, -0.3614, "Hounslow, London"),
            ("Wembley Jamatkhana", "Wembley", "United Kingdom", 51.5560, -0.2802, "Wembley, London"),
            ("Walthamstow Jamatkhana", "Walthamstow", "United Kingdom", 51.5825, -0.0190, "Walthamstow, London"),
            ("Manchester Jamatkhana", "Manchester", "United Kingdom", 53.4808, -2.2426, "Manchester"),
            ("Birmingham Jamatkhana", "Birmingham", "United Kingdom", 52.4862, -1.8904, "Birmingham"),
            ("Glasgow Jamatkhana", "Glasgow", "United Kingdom", 55.8642, -4.2518, "Glasgow"),
            ("Leicester Jamatkhana", "Leicester", "United Kingdom", 52.6369, -1.1398, "Leicester"),
            # Portugal
            ("Ismaili Centre Lisbon", "Lisbon", "Portugal", 38.7510, -9.1985, "Av. Lusíada, Lisboa"),
            ("Porto Jamatkhana", "Porto", "Portugal", 41.1579, -8.6291, "Porto"),
            # France & Belgium
            ("Jamatkhana Paris", "Paris", "France", 48.8566, 2.3522, "Paris"),
            ("Lyon Jamatkhana", "Lyon", "France", 45.7640, 4.8357, "Lyon"),
            ("Brussels Jamatkhana", "Brussels", "Belgium", 50.8503, 4.3517, "Brussels"),
            # UAE
            ("Ismaili Centre Dubai", "Dubai", "UAE", 25.2289, 55.3236, "Bur Dubai"),
            ("Dubai Marina Jamatkhana", "Dubai", "UAE", 25.0805, 55.1403, "Dubai Marina"),
            ("Khalifa City Jamatkhana", "Abu Dhabi", "UAE", 24.4257, 54.5870, "Khalifa City, Abu Dhabi"),
            ("Sharjah Jamatkhana", "Sharjah", "UAE", 25.3463, 55.4209, "Sharjah"),
            # Kenya & Tanzania & Uganda
            ("Headquarters Jamatkhana Nairobi", "Nairobi", "Kenya", -1.2864, 36.8172, "Nairobi"),
            ("Parklands Jamatkhana Nairobi", "Nairobi", "Kenya", -1.2630, 36.8200, "Parklands, Nairobi"),
            ("Mombasa Jamatkhana", "Mombasa", "Kenya", -4.0435, 39.6682, "Mombasa"),
            ("Kisumu Jamatkhana", "Kisumu", "Kenya", -0.0917, 34.7679, "Kisumu"),
            ("Dar es Salaam Jamatkhana", "Dar es Salaam", "Tanzania", -6.7924, 39.2083, "Dar es Salaam"),
            ("Arusha Jamatkhana", "Arusha", "Tanzania", -3.3869, 36.6829, "Arusha"),
            ("Kampala Jamatkhana", "Kampala", "Uganda", 0.3476, 32.5825, "Kampala"),
            # India
            ("Hasanabad Jamatkhana", "Mumbai", "India", 18.9750, 72.8258, "Mazgaon, Mumbai"),
            ("Darkhana Jamatkhana Mumbai", "Mumbai", "India", 18.9388, 72.8354, "Mumbai"),
            ("Bandra Jamatkhana", "Mumbai", "India", 19.0596, 72.8295, "Bandra, Mumbai"),
            ("Pune Jamatkhana", "Pune", "India", 18.5204, 73.8567, "Pune"),
            ("Ahmedabad Jamatkhana", "Ahmedabad", "India", 23.0225, 72.5714, "Ahmedabad"),
            ("Hyderabad Jamatkhana", "Hyderabad", "India", 17.3850, 78.4867, "Hyderabad"),
            ("Bangalore Jamatkhana", "Bangalore", "India", 12.9716, 77.5946, "Bangalore"),
            ("Chennai Jamatkhana", "Chennai", "India", 13.0827, 80.2707, "Chennai"),
            ("Delhi Jamatkhana", "New Delhi", "India", 28.6139, 77.2090, "New Delhi"),
            ("Vadodara Jamatkhana", "Vadodara", "India", 22.3072, 73.1812, "Vadodara"),
            ("Surat Jamatkhana", "Surat", "India", 21.1702, 72.8311, "Surat"),
            # Pakistan
            ("Garden Jamatkhana", "Karachi", "Pakistan", 24.8693, 67.0231, "Garden, Karachi"),
            ("Darkhana Jamatkhana Karachi", "Karachi", "Pakistan", 24.8607, 67.0011, "Karachi"),
            ("Kharadar Jamatkhana", "Karachi", "Pakistan", 24.8475, 67.0070, "Kharadar, Karachi"),
            ("Lahore Jamatkhana", "Lahore", "Pakistan", 31.5204, 74.3587, "Lahore"),
            ("Islamabad Jamatkhana", "Islamabad", "Pakistan", 33.6844, 73.0479, "Islamabad"),
            ("Rawalpindi Jamatkhana", "Rawalpindi", "Pakistan", 33.5651, 73.0169, "Rawalpindi"),
            ("Hunza Aliabad Jamatkhana", "Hunza", "Pakistan", 36.3169, 74.6500, "Aliabad, Hunza"),
            ("Gilgit Jamatkhana", "Gilgit", "Pakistan", 35.9208, 74.3144, "Gilgit"),
            ("Skardu Jamatkhana", "Skardu", "Pakistan", 35.2954, 75.6334, "Skardu"),
            ("Chitral Jamatkhana", "Chitral", "Pakistan", 35.8511, 71.7848, "Chitral"),
            # Tajikistan / Afghanistan / Syria
            ("Ismaili Centre Dushanbe", "Dushanbe", "Tajikistan", 38.5598, 68.7870, "Dushanbe"),
            ("Khorog Jamatkhana", "Khorog", "Tajikistan", 37.4894, 71.5556, "Khorog, GBAO"),
            ("Murghab Jamatkhana", "Murghab", "Tajikistan", 38.1734, 73.9722, "Murghab"),
            ("Salamiyah Jamatkhana", "Salamiyah", "Syria", 35.0117, 37.0533, "Salamiyah"),
            # Bangladesh / Singapore / Australia / Madagascar
            ("Singapore Jamatkhana", "Singapore", "Singapore", 1.3521, 103.8198, "Singapore"),
            ("Sydney Jamatkhana", "Sydney", "Australia", -33.8688, 151.2093, "Sydney"),
            ("Melbourne Jamatkhana", "Melbourne", "Australia", -37.8136, 144.9631, "Melbourne"),
            ("Brisbane Jamatkhana", "Brisbane", "Australia", -27.4698, 153.0251, "Brisbane"),
            ("Perth Jamatkhana", "Perth", "Australia", -31.9505, 115.8605, "Perth"),
            ("Dhaka Jamatkhana", "Dhaka", "Bangladesh", 23.8103, 90.4125, "Dhaka"),
            ("Antananarivo Jamatkhana", "Antananarivo", "Madagascar", -18.8792, 47.5079, "Antananarivo"),
        ]
        await db.jamatkhanas.insert_many([
            {
                "jk_id": f"jk_{i:03d}",
                "name": name,
                "city": city,
                "country": country,
                "lat": lat,
                "lng": lng,
                "address": addr,
                "type": "jamatkhana",
                "seed_version": 2,
            }
            for i, (name, city, country, lat, lng, addr) in enumerate(jks, start=1)
        ])


@app.on_event("startup")
async def on_startup():
    await seed_data()
    logger.info("Tasbih.ai backend ready")


app.include_router(api)
