"""
Sprint 3 backend tests — Admin org-verification + invite share-sheet email (Resend).

Covers:
- /api/admin/me (guest -> false, admin -> true)
- /api/admin/orgs (403 without admin, 200 with admin)
- /api/admin/orgs/{id}/verify (set, unset, cascade to communities + chat_messages, 404 if missing)
- /api/invites/send-email (valid -> Resend delivered@resend.dev, mints 2 codes; invalid email -> 400)
- Regression: /api/health, /api/auth/guest, /api/auth/me, /api/invites/mine
"""
import os
import time
import asyncio
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend/.env for the sub-shell case
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.strip().split("=", 1)[1].rstrip("/")
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "tasbih_db"


# ────────────────────────── helpers ──────────────────────────
def _guest(name="TEST_admin_inv"):
    s = requests.Session()
    r = s.post(f"{API}/auth/guest", json={"name": name}, timeout=15)
    assert r.status_code == 200, f"guest failed: {r.status_code} {r.text}"
    tok = r.json()["session_token"]
    uid = r.json()["user"]["user_id"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    s.cookies.clear()
    return s, tok, uid


async def _promote(user_id, status="admin"):
    cli = AsyncIOMotorClient(MONGO_URL)
    await cli[DB_NAME].users.update_one({"user_id": user_id}, {"$set": {"status": status}})
    cli.close()


async def _seed_org(org_id="TEST_org_alpha", owner_email="TEST_alpha@tasbih.test"):
    cli = AsyncIOMotorClient(MONGO_URL)
    db = cli[DB_NAME]
    from datetime import datetime, timezone
    await db.users.delete_many({"user_id": org_id})
    await db.users.insert_one({
        "user_id": org_id, "email": owner_email, "name": "Alpha Org Owner",
        "role": "org", "status": "active", "created_at": datetime.now(timezone.utc),
        "org_profile": {"name": "Alpha JK", "tagline": "Light", "category": "jamatkhana",
                        "country": "IN", "city": "Mumbai", "website": "https://x.test",
                        "verified": False},
    })
    await db.communities.delete_many({"_test_seed": True})
    await db.communities.insert_one({"community_id": "TEST_c1", "org_id": org_id, "name": "Alpha Circle",
                                     "verified": False, "_test_seed": True})
    await db.chat_messages.delete_many({"_test_seed": True})
    await db.chat_messages.insert_one({"message_id": "TEST_m1", "org_id": org_id, "text": "hi",
                                       "verified": False, "_test_seed": True})
    cli.close()


async def _cleanup_org(org_id="TEST_org_alpha"):
    cli = AsyncIOMotorClient(MONGO_URL)
    db = cli[DB_NAME]
    await db.users.delete_many({"user_id": org_id})
    await db.communities.delete_many({"_test_seed": True})
    await db.chat_messages.delete_many({"_test_seed": True})
    cli.close()


async def _cleanup_user(uid):
    cli = AsyncIOMotorClient(MONGO_URL)
    db = cli[DB_NAME]
    await db.users.delete_many({"user_id": uid})
    await db.sessions.delete_many({"user_id": uid})
    await db.invite_codes.delete_many({"issued_by": uid})
    cli.close()


# ────────────────────────── tests ──────────────────────────
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    assert r.json().get("ok") is True or r.json().get("status") in ("ok", "healthy")


def test_auth_guest_and_me():
    s, tok, uid = _guest()
    try:
        r = s.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        body = r.json()
        # /auth/me returns {user:{...}}
        u = body.get("user") or body
        assert u["user_id"] == uid
    finally:
        asyncio.run(_cleanup_user(uid))


def test_admin_me_guest_returns_false():
    s, tok, uid = _guest()
    try:
        r = s.get(f"{API}/admin/me", timeout=10)
        assert r.status_code == 200, r.text
        assert r.json() == {"is_admin": False}
    finally:
        asyncio.run(_cleanup_user(uid))


def test_admin_me_admin_returns_true():
    s, tok, uid = _guest()
    try:
        asyncio.run(_promote(uid, "admin"))
        r = s.get(f"{API}/admin/me", timeout=10)
        assert r.status_code == 200, r.text
        assert r.json() == {"is_admin": True}
    finally:
        asyncio.run(_cleanup_user(uid))


def test_admin_orgs_forbidden_without_admin():
    s, tok, uid = _guest()
    try:
        r = s.get(f"{API}/admin/orgs", timeout=10)
        assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text}"
    finally:
        asyncio.run(_cleanup_user(uid))


def test_admin_orgs_returns_list_for_admin():
    s, tok, uid = _guest()
    try:
        asyncio.run(_promote(uid, "admin"))
        asyncio.run(_seed_org())
        r = s.get(f"{API}/admin/orgs", timeout=10)
        assert r.status_code == 200, r.text
        orgs = r.json().get("orgs", [])
        match = [o for o in orgs if o.get("org_id") == "TEST_org_alpha"]
        assert match, f"seeded org not returned. orgs sample={orgs[:2]}"
        o = match[0]
        for k in ("org_id", "owner_email", "name", "tagline", "category",
                  "country", "city", "website", "verified", "created_at"):
            assert k in o, f"missing key '{k}' in {o}"
        assert o["verified"] is False
        assert o["name"] == "Alpha JK"
    finally:
        asyncio.run(_cleanup_org())
        asyncio.run(_cleanup_user(uid))


def test_admin_verify_org_sets_and_cascades():
    s, tok, uid = _guest()
    try:
        asyncio.run(_promote(uid, "admin"))
        asyncio.run(_seed_org())
        r = s.post(f"{API}/admin/orgs/TEST_org_alpha/verify", json={"verified": True}, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True and body.get("verified") is True

        # Verify cascade in mongo
        cli = AsyncIOMotorClient(MONGO_URL)
        async def _check():
            db = cli[DB_NAME]
            u = await db.users.find_one({"user_id": "TEST_org_alpha"}, {"_id": 0})
            c = await db.communities.find_one({"community_id": "TEST_c1"}, {"_id": 0})
            m = await db.chat_messages.find_one({"message_id": "TEST_m1"}, {"_id": 0})
            return u, c, m
        u, c, m = asyncio.run(_check())
        cli.close()
        assert (u.get("org_profile") or {}).get("verified") is True
        assert c.get("verified") is True
        assert m.get("verified") is True
    finally:
        asyncio.run(_cleanup_org())
        asyncio.run(_cleanup_user(uid))


def test_admin_verify_org_unset_cascades():
    s, tok, uid = _guest()
    try:
        asyncio.run(_promote(uid, "admin"))
        asyncio.run(_seed_org())
        # first set
        s.post(f"{API}/admin/orgs/TEST_org_alpha/verify", json={"verified": True}, timeout=10)
        # then unset
        r = s.post(f"{API}/admin/orgs/TEST_org_alpha/verify", json={"verified": False}, timeout=10)
        assert r.status_code == 200
        assert r.json().get("verified") is False

        cli = AsyncIOMotorClient(MONGO_URL)
        async def _check():
            db = cli[DB_NAME]
            u = await db.users.find_one({"user_id": "TEST_org_alpha"}, {"_id": 0})
            c = await db.communities.find_one({"community_id": "TEST_c1"}, {"_id": 0})
            m = await db.chat_messages.find_one({"message_id": "TEST_m1"}, {"_id": 0})
            return u, c, m
        u, c, m = asyncio.run(_check())
        cli.close()
        assert (u.get("org_profile") or {}).get("verified") is False
        assert c.get("verified") is False
        assert m.get("verified") is False
    finally:
        asyncio.run(_cleanup_org())
        asyncio.run(_cleanup_user(uid))


def test_admin_verify_org_404_for_missing():
    s, tok, uid = _guest()
    try:
        asyncio.run(_promote(uid, "admin"))
        r = s.post(f"{API}/admin/orgs/TEST_org_does_not_exist/verify",
                   json={"verified": True}, timeout=10)
        assert r.status_code == 404, r.text
    finally:
        asyncio.run(_cleanup_user(uid))


def test_invites_send_email_invalid_email_returns_400():
    s, tok, uid = _guest()
    try:
        r = s.post(f"{API}/invites/send-email",
                   json={"to_email": "not-an-email", "to_name": "X"}, timeout=15)
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"
    finally:
        asyncio.run(_cleanup_user(uid))


def test_invites_send_email_delivered_resend_dev_mints_two_codes():
    s, tok, uid = _guest()
    try:
        recipient = "delivered@resend.dev"
        r = s.post(f"{API}/invites/send-email",
                   json={"to_email": recipient, "to_name": "Test Friend",
                         "second_inviter_name": ""},
                   timeout=30)
        assert r.status_code == 200, f"expected 200 got {r.status_code} {r.text}"
        data = r.json()
        assert data.get("ok") is True
        assert data.get("to") == recipient
        codes = data.get("codes") or []
        assert isinstance(codes, list) and len(codes) == 2, f"expected 2 codes, got {codes}"
        assert codes[0] != codes[1]
        assert "email_id" in data  # Resend returns id

        # Verify two fresh codes in DB tied to this user + recipient
        cli = AsyncIOMotorClient(MONGO_URL)
        async def _check():
            db = cli[DB_NAME]
            return await db.invite_codes.find(
                {"code": {"$in": codes}}, {"_id": 0}
            ).to_list(length=10)
        docs = asyncio.run(_check())
        cli.close()
        assert len(docs) == 2
        for d in docs:
            assert d["issued_by"] == uid
            assert d.get("shared_with_email") == recipient
            assert d.get("used_by") is None
    finally:
        asyncio.run(_cleanup_user(uid))


def test_invites_mine_regression():
    s, tok, uid = _guest()
    try:
        # Create one code so /invites/mine has data
        rc = s.post(f"{API}/invites/create", timeout=10)
        assert rc.status_code == 200
        r = s.get(f"{API}/invites/mine", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        # accept either shape
        codes = body.get("codes") or body.get("invites") or body
        assert codes is not None
    finally:
        asyncio.run(_cleanup_user(uid))
