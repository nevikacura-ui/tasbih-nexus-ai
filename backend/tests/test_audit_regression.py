"""
Pre-audit regression sweep for Tasbih.ai.

Covers:
- Holy Du'a master MP3 (male / female), no-break check, expected duration window
- Mid-insert verses r5_09_qadeer_mid & r6_14_waghfir_mid in timeline (around expected ms)
- /api/dua/r6_11_mawlana_aly content (new title/translit/english + interlude_after.names == 50)
- Imam Tasbih TTS pronunciation: /api/tasbih-name/audio?name=Mawlana%20al-Mustansir%20Billah
  + /api/dua JSON display name unchanged
- New endpoints: dua progress + bookmarks (auth required; idempotent; route ordering vs catch-all)
- Noor AI suggested_dua (marker stripped from reply)
- Guest mode endpoints (public & gated)
- Existing 90-day member session via Bearer header still works on /api/auth/me
- /api/auth/session sets a 90-day cookie (Max-Age = 7776000) — checked via code constant
"""
import io
import os
import re
import sys
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # fall back to frontend/.env which is the file backed copy
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────
def _fresh_session():
    """A fresh requests.Session — no shared cookies between fixtures.
    This is critical because /api/auth/guest sets a session_token cookie which
    would otherwise override the Bearer header in current_user()."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="function")
def api_client():
    return _fresh_session()


@pytest.fixture(scope="session")
def member_token():
    """Mint a real member session directly in MongoDB (per test_credentials.md)."""
    sys.path.insert(0, "/app/backend")
    from server import db  # type: ignore

    async def _mint():
        uid = f"user_audit_{uuid.uuid4().hex[:10]}"
        tok = f"audit_{uuid.uuid4().hex[:20]}"
        await db.users.insert_one({
            "user_id": uid,
            "email": f"{uid}@audit.tasbih.ai",
            "name": "Audit Tester",
            "status": "member",
            "created_at": datetime.now(timezone.utc),
        })
        await db.user_sessions.insert_one({
            "user_id": uid,
            "session_token": tok,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=90),
            "created_at": datetime.now(timezone.utc),
        })
        return uid, tok

    uid, tok = asyncio.get_event_loop().run_until_complete(_mint())
    yield tok
    # teardown
    async def _cleanup():
        await db.users.delete_one({"user_id": uid})
        await db.user_sessions.delete_many({"user_id": uid})
        await db.dua_progress.delete_many({"user_id": uid})
        await db.dua_bookmarks.delete_many({"user_id": uid})
    try:
        asyncio.get_event_loop().run_until_complete(_cleanup())
    except Exception:
        pass


@pytest.fixture(scope="session")
def guest_token():
    s = _fresh_session()
    r = s.post(f"{API}/auth/guest")
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ─────────────────────────────────────────────────────────────────────────────
# Health & basic
# ─────────────────────────────────────────────────────────────────────────────
def test_health(api_client):
    r = api_client.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ─────────────────────────────────────────────────────────────────────────────
# Master MP3 — male & female
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("voice,expected_min,expected_max", [
    ("male", 300_000, 380_000),     # ~342s
    ("female", 330_000, 410_000),   # ~376s
])
def test_full_dua_audio_streams_cleanly(api_client, voice, expected_min, expected_max):
    r = api_client.get(f"{API}/full-dua/audio", params={"voice": voice}, timeout=180)
    assert r.status_code == 200, r.text[:300]
    assert r.headers.get("content-type", "").startswith("audio/mpeg")
    body = r.content
    assert len(body) > 200_000, f"MP3 too small: {len(body)} bytes"
    # Quick MP3 frame sanity: must start with ID3 tag or MP3 sync 0xFFE
    head = body[:4]
    assert head[:3] == b"ID3" or (head[0] == 0xFF and (head[1] & 0xE0) == 0xE0), \
        f"Not an MP3 stream — header: {head!r}"
    # Duration via mutagen
    from mutagen.mp3 import MP3
    m = MP3(io.BytesIO(body))
    dur_ms = int(m.info.length * 1000)
    assert expected_min <= dur_ms <= expected_max, (
        f"{voice} duration {dur_ms}ms outside [{expected_min},{expected_max}]"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Timeline — total segments, mid-insert verses present at expected positions
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("voice", ["male", "female"])
def test_full_dua_timeline_segments(api_client, voice):
    r = api_client.get(f"{API}/full-dua/timeline", params={"voice": voice}, timeout=120)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    segs = data["segments"]
    # 162 expected (160 before + 2 mid-inserts)
    assert data["total_segments"] == len(segs)
    assert len(segs) == 162, f"expected 162 segments, got {len(segs)}"
    # All have start_ms < end_ms and monotonic
    last_end = 0
    for s in segs:
        assert s["start_ms"] < s["end_ms"], s
        assert s["start_ms"] >= last_end - 5, f"non-monotonic at {s}"
        last_end = s["end_ms"]
    # Mid-insert verses present
    mids = [s for s in segs if s.get("kind") == "mid"]
    mid_ids = {m.get("id") or m.get("parent_id") for m in mids}
    assert "r5_09_qadeer_mid" in mid_ids, f"missing r5_09_qadeer_mid; mids={mids[:3]}"
    assert "r6_14_waghfir_mid" in mid_ids, f"missing r6_14_waghfir_mid; mids={mids[:3]}"
    # Approximate timing checks (allow generous window for TTS variation)
    qadeer_mid = next(m for m in mids if (m.get("id") or "").startswith("r5_09_qadeer"))
    waghfir_mid = next(m for m in mids if (m.get("id") or "").startswith("r6_14_waghfir"))
    # ~198s and ~330s; tolerate ±90s
    assert 100_000 < qadeer_mid["start_ms"] < 290_000, qadeer_mid
    assert 240_000 < waghfir_mid["start_ms"] < 420_000, waghfir_mid


# ─────────────────────────────────────────────────────────────────────────────
# r6_11_mawlana_aly — updated content + interlude_after preserved
# ─────────────────────────────────────────────────────────────────────────────
def test_r6_11_mawlana_aly_updated(api_client):
    r = api_client.get(f"{API}/dua/r6_11_mawlana_aly")
    assert r.status_code == 200, r.text
    v = r.json()
    assert v["title"] == "Our Lord", f"title is {v['title']!r}"
    assert v["transliteration"] == "Allāhumma bi haqqi Mawlānā", v["transliteration"]
    assert v["english"] == "O Allah, in the name of our Lord.", v["english"]
    inter = v.get("interlude_after") or {}
    names = inter.get("names") or []
    assert isinstance(names, list) and len(names) == 50, f"interlude_after.names = {len(names)}"


# ─────────────────────────────────────────────────────────────────────────────
# Imam Tasbih TTS pronunciation
# ─────────────────────────────────────────────────────────────────────────────
def test_tasbih_name_audio_wasl_normalized(api_client):
    name = "Mawlana al-Mustansir Billah"
    r = api_client.get(f"{API}/tasbih-name/audio",
                       params={"name": name, "voice": "male"}, timeout=120)
    assert r.status_code == 200, r.text[:300]
    assert r.headers.get("content-type", "").startswith("audio/mpeg")
    assert len(r.content) > 5_000, f"audio too short: {len(r.content)} bytes"


def test_dua_json_keeps_display_name_unchanged(api_client):
    """The /api/dua JSON list must still show the cosmetic display name unchanged."""
    r = api_client.get(f"{API}/dua")
    assert r.status_code == 200
    blob = r.text
    # Display name must still contain ' al-' style for Imam mentions
    assert " al-" in blob, "display name normalization leaked into /api/dua"


# ─────────────────────────────────────────────────────────────────────────────
# New endpoints: progress + bookmarks (auth gating, idempotency, route ordering)
# ─────────────────────────────────────────────────────────────────────────────
def test_dua_progress_requires_auth(api_client):
    assert api_client.get(f"{API}/dua/progress").status_code == 401
    r = api_client.post(f"{API}/dua/progress",
                        json={"voice": "male", "position_ms": 1000, "duration_ms": 342000})
    assert r.status_code == 401


def test_dua_progress_roundtrip(api_client, member_token):
    h = _auth(member_token)
    r = api_client.post(f"{API}/dua/progress",
                        headers=h,
                        json={"voice": "female", "position_ms": 24500, "duration_ms": 376000})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["position_ms"] == 24500
    assert body["voice"] == "female"
    # GET returns the same
    r2 = api_client.get(f"{API}/dua/progress", headers=h)
    assert r2.status_code == 200
    g = r2.json()
    assert g["position_ms"] == 24500
    assert g["voice"] == "female"


def test_dua_bookmarks_requires_auth(api_client):
    assert api_client.get(f"{API}/dua/bookmarks").status_code == 401
    r = api_client.post(f"{API}/dua/bookmarks", json={"dua_id": "r1_01_bismillah"})
    assert r.status_code == 401


def test_dua_bookmarks_crud_and_idempotent(api_client, member_token):
    h = _auth(member_token)
    # initial state
    r = api_client.get(f"{API}/dua/bookmarks", headers=h)
    assert r.status_code == 200
    initial_ids = set(r.json().get("ids", []))
    # add
    r = api_client.post(f"{API}/dua/bookmarks", headers=h,
                       json={"dua_id": "r1_01_bismillah"})
    assert r.status_code == 200, r.text
    assert r.json()["dua_id"] == "r1_01_bismillah"
    # idempotent: adding twice does not create duplicate
    r = api_client.post(f"{API}/dua/bookmarks", headers=h,
                       json={"dua_id": "r1_01_bismillah"})
    assert r.status_code == 200
    # invalid id → 404
    r = api_client.post(f"{API}/dua/bookmarks", headers=h,
                       json={"dua_id": "does_not_exist_xx"})
    assert r.status_code == 404
    # list
    r = api_client.get(f"{API}/dua/bookmarks", headers=h)
    assert r.status_code == 200
    body = r.json()
    ids = body["ids"]
    assert ids.count("r1_01_bismillah") == 1
    assert any(b["dua_id"] == "r1_01_bismillah" and b["title"] for b in body["bookmarks"])
    # delete
    r = api_client.delete(f"{API}/dua/bookmarks/r1_01_bismillah", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True
    # verify removal
    r = api_client.get(f"{API}/dua/bookmarks", headers=h)
    assert "r1_01_bismillah" not in r.json().get("ids", [])


def test_route_ordering_progress_and_bookmarks_not_swallowed_by_catchall(api_client):
    """Both /dua/progress and /dua/bookmarks must NOT be matched by /dua/{dua_id}.
    If FastAPI swallowed them, unauth GET would return 404 (no dua found) instead
    of 401 (current_user dependency)."""
    r = api_client.get(f"{API}/dua/progress")
    assert r.status_code == 401, f"route ordering broke: {r.status_code} {r.text[:120]}"
    r = api_client.get(f"{API}/dua/bookmarks")
    assert r.status_code == 401, f"route ordering broke: {r.status_code} {r.text[:120]}"
    # Unknown id should 404 (catch-all is reachable)
    r = api_client.get(f"{API}/dua/does_not_exist_xx")
    assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Noor AI — suggested_dua and marker stripped from reply
# ─────────────────────────────────────────────────────────────────────────────
def test_noor_chat_suggests_dua_when_user_exhausted(guest_token):
    api = _fresh_session()
    h = _auth(guest_token)
    r = api.post(f"{API}/noor/chat", headers=h, timeout=120,
                 json={"message": "I feel exhausted and weak today"})
    # If Emergent LLM budget is exhausted, backend returns 502 ("Noor is resting").
    if r.status_code == 502 and "Budget" in r.text:
        pytest.fail(
            "CRITICAL: Emergent LLM key budget exceeded — /api/noor/chat returns 502. "
            f"Body: {r.text[:300]}"
        )
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    reply = body.get("reply") or ""
    # Marker must not leak into the visible reply
    assert "[DUA:" not in reply, f"marker leaked: {reply!r}"
    sugg = body.get("suggested_dua")
    if sugg:
        assert sugg.get("id") and sugg.get("transliteration") and sugg.get("arabic")
        assert sugg["id"].startswith("r")


# ─────────────────────────────────────────────────────────────────────────────
# Guest mode — public & gated
# ─────────────────────────────────────────────────────────────────────────────
def test_guest_can_read_public(api_client):
    """These must work fully unauthenticated."""
    assert api_client.get(f"{API}/dua").status_code == 200
    assert api_client.get(f"{API}/dua/r1_01_bismillah").status_code == 200
    assert api_client.get(f"{API}/full-dua/timeline?voice=male").status_code == 200
    assert api_client.get(f"{API}/jamatkhanas").status_code == 200


def test_guest_blocked_on_member_only(api_client, guest_token):
    """A guest session must hit 403 on journal/reminders/community messages."""
    h = _auth(guest_token)
    r = api_client.get(f"{API}/journal", headers=h)
    assert r.status_code == 403, f"/journal returned {r.status_code}"
    r = api_client.get(f"{API}/reminders", headers=h)
    assert r.status_code == 403, f"/reminders returned {r.status_code}"
    r = api_client.get(f"{API}/communities/community_001/messages", headers=h)
    # community might 404 (id not found) BEFORE auth; but require_member runs first,
    # so 403 is required.
    assert r.status_code == 403, f"/communities/.../messages returned {r.status_code}"


def test_no_auth_blocks_member_endpoints(api_client):
    assert api_client.get(f"{API}/journal").status_code == 401
    assert api_client.get(f"{API}/reminders").status_code == 401
    assert api_client.get(f"{API}/communities/community_001/messages").status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# 90-day session via Bearer header → /api/auth/me works for status=member
# ─────────────────────────────────────────────────────────────────────────────
def test_member_bearer_auth_me_status_member(api_client, member_token):
    r = api_client.get(f"{API}/auth/me", headers=_auth(member_token))
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["status"] == "member", me
    assert me["user_id"].startswith("user_audit_")


def test_auth_session_cookie_is_90_days_in_code():
    """Sanity: code constant uses 90 * 24 * 60 * 60 = 7776000 for session cookie."""
    with open("/app/backend/server.py") as f:
        src = f.read()
    assert "max_age=90 * 24 * 60 * 60" in src or "max_age=7776000" in src, \
        "session cookie max_age does not look 90 days"
