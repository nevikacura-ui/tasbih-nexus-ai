"""Backend tests for current sprint:
- Health
- Founder invite codes (30, founder:true, issued_by:system)
- /api/invite/verify rules (identical reject, founder-pair accept, same-issuer reject)
- /api/invites/create unlimited
- /api/auth/otp/send (validation/403) — uses mongo-side hash injection to test verify happy path WITHOUT real WA spam
- /api/auth/otp/verify wrong/expired/correct flows + session 90-day
- Quran: surahs/surah/languages
- Calendar: today/month
- Noor Moment + rate limit
- Regression: /auth/me, /noor/today, /tasbih/state, /communities, /jamatkhanas count=99, /profile/sangat, /noor/digest
"""
import os
import hashlib
import requests
import pytest
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Read from frontend env file as fallback
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "tasbih_db")
mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]

FOUNDER_PAIR = ("EK48P89X", "S4YNQFPK")
TEST_PHONE_E164 = "+918108888330"
TEST_PHONE = "918108888330"
TEST_EMAIL = "TEST_otp_sprint@tasbih.test"


# ─── Fixtures ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def guest_token(s):
    r = s.post(f"{BASE_URL}/api/auth/guest", json={})
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


@pytest.fixture(scope="session")
def guest_client(s, guest_token):
    s.headers.update({"Authorization": f"Bearer {guest_token}"})
    return s


# ─── Health ──────────────────────────────────────────────────────────────────
def test_health(s):
    r = s.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200
    j = r.json()
    assert j.get("ok") is True


# ─── Founder invite codes seeded ─────────────────────────────────────────────
def test_founder_codes_seeded():
    count_all = db.invite_codes.count_documents({})
    count_founder = db.invite_codes.count_documents({"founder": True, "issued_by": "system"})
    assert count_all == 30, f"expected 30 invite_codes, got {count_all}"
    assert count_founder == 30, f"expected 30 founder codes, got {count_founder}"
    for code in FOUNDER_PAIR:
        d = db.invite_codes.find_one({"code": code})
        assert d is not None, f"code {code} missing"
        assert d.get("founder") is True
        assert d.get("issued_by") == "system"


# ─── /api/invite/verify ──────────────────────────────────────────────────────
def test_invite_verify_identical_rejected(s):
    r = s.post(f"{BASE_URL}/api/invite/verify",
               json={"code1": FOUNDER_PAIR[0], "code2": FOUNDER_PAIR[0]})
    assert r.status_code == 400
    assert "different" in r.json().get("detail", "").lower()


def test_invite_verify_founder_pair_accepted(s):
    # Both founder codes share issued_by='system' but founder:true bypasses same-issuer rule
    r = s.post(f"{BASE_URL}/api/invite/verify",
               json={"code1": FOUNDER_PAIR[0], "code2": FOUNDER_PAIR[1]})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("verified") is True
    assert "pending_token" in j and len(j["pending_token"]) > 10
    # Verify pending_token expires in ~20 minutes
    pending = db.pending_invites.find_one({"pending_token": j["pending_token"]})
    assert pending is not None
    exp = pending["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    delta = exp - datetime.now(timezone.utc)
    assert 19 * 60 <= delta.total_seconds() <= 21 * 60, f"pending expires_at delta={delta}"


def test_invite_verify_same_issuer_non_founder_rejected(s, guest_client):
    # Create 2 invites from same guest user → same issued_by → must reject
    r1 = guest_client.post(f"{BASE_URL}/api/invites/create")
    r2 = guest_client.post(f"{BASE_URL}/api/invites/create")
    assert r1.status_code == 200 and r2.status_code == 200, (r1.text, r2.text)
    c1 = r1.json()["code"]
    c2 = r2.json()["code"]
    r = s.post(f"{BASE_URL}/api/invite/verify", json={"code1": c1, "code2": c2})
    # NB: requests.Session in `s` still has the Bearer from guest_client fixture (same session)
    assert r.status_code == 400, r.text
    detail = r.json().get("detail", "").lower()
    assert "two different members" in detail or "different members" in detail
    # cleanup
    db.invite_codes.delete_many({"code": {"$in": [c1, c2]}})


def test_invites_create_unlimited(guest_client):
    # Create 6 invites in a row to confirm no quota
    codes = []
    for _ in range(6):
        r = guest_client.post(f"{BASE_URL}/api/invites/create")
        assert r.status_code == 200, r.text
        codes.append(r.json()["code"])
    assert len(set(codes)) == 6
    db.invite_codes.delete_many({"code": {"$in": codes}})


# ─── /api/auth/otp/send & verify (NO real WA — uses mongo hash injection) ────
@pytest.fixture()
def fresh_pending_token(s):
    r = s.post(f"{BASE_URL}/api/invite/verify",
               json={"code1": FOUNDER_PAIR[0], "code2": FOUNDER_PAIR[1]})
    assert r.status_code == 200, r.text
    return r.json()["pending_token"]


def test_otp_send_invalid_pending_returns_403(s):
    r = s.post(f"{BASE_URL}/api/auth/otp/send", json={
        "pending_token": "deadbeefdeadbeef",
        "email": TEST_EMAIL,
        "phone": TEST_PHONE_E164,
    })
    assert r.status_code == 403


def test_otp_verify_wrong_code_then_expired(s, fresh_pending_token):
    """Inject a fake OTP into mongo for known hash, then test wrong→increment, then expire→400 expired."""
    # Manually inject (skip /otp/send to avoid real WA)
    db.otp_codes.delete_many({"phone": TEST_PHONE})
    known = "123456"
    h = hashlib.sha256(f"{known}|{TEST_PHONE}|tasbih".encode()).hexdigest()
    now = datetime.now(timezone.utc)
    db.otp_codes.insert_one({
        "phone": TEST_PHONE, "email": TEST_EMAIL,
        "otp_hash": h, "attempts": 0,
        "created_at": now, "expires_at": now + timedelta(minutes=10),
    })
    # Wrong OTP increments attempts and returns 400
    r = s.post(f"{BASE_URL}/api/auth/otp/verify", json={
        "pending_token": fresh_pending_token,
        "email": TEST_EMAIL, "phone": TEST_PHONE_E164,
        "otp": "999999",
    })
    assert r.status_code == 400
    assert "match" in r.json().get("detail", "").lower()
    rec = db.otp_codes.find_one({"phone": TEST_PHONE})
    assert rec.get("attempts", 0) == 1

    # Expire it: backdate expires_at
    db.otp_codes.update_one({"phone": TEST_PHONE},
                            {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}})
    r = s.post(f"{BASE_URL}/api/auth/otp/verify", json={
        "pending_token": fresh_pending_token,
        "email": TEST_EMAIL, "phone": TEST_PHONE_E164,
        "otp": known,
    })
    assert r.status_code == 400
    assert "expired" in r.json().get("detail", "").lower()


def test_otp_verify_5_wrong_then_429(s, fresh_pending_token):
    db.otp_codes.delete_many({"phone": TEST_PHONE})
    known = "654321"
    h = hashlib.sha256(f"{known}|{TEST_PHONE}|tasbih".encode()).hexdigest()
    now = datetime.now(timezone.utc)
    db.otp_codes.insert_one({
        "phone": TEST_PHONE, "email": TEST_EMAIL,
        "otp_hash": h, "attempts": 5,  # already at threshold
        "created_at": now, "expires_at": now + timedelta(minutes=10),
    })
    r = s.post(f"{BASE_URL}/api/auth/otp/verify", json={
        "pending_token": fresh_pending_token,
        "email": TEST_EMAIL, "phone": TEST_PHONE_E164,
        "otp": "000000",
    })
    assert r.status_code == 429
    db.otp_codes.delete_many({"phone": TEST_PHONE})


def test_otp_verify_happy_path_creates_user_and_session(s, fresh_pending_token):
    """Inject correct hash → verify → user created, codes consumed, 90-day session."""
    db.otp_codes.delete_many({"phone": TEST_PHONE})
    db.users.delete_many({"phone": TEST_PHONE})
    db.users.delete_many({"email": TEST_EMAIL})
    # Reset founder codes in case a previous flaky run consumed them
    db.invite_codes.update_many(
        {"code": {"$in": list(FOUNDER_PAIR)}},
        {"$set": {"used_by": None, "used_at": None}},
    )
    known = "246810"
    h = hashlib.sha256(f"{known}|{TEST_PHONE}|tasbih".encode()).hexdigest()
    now = datetime.now(timezone.utc)
    db.otp_codes.insert_one({
        "phone": TEST_PHONE, "email": TEST_EMAIL,
        "otp_hash": h, "attempts": 0,
        "created_at": now, "expires_at": now + timedelta(minutes=10),
    })
    r = s.post(f"{BASE_URL}/api/auth/otp/verify", json={
        "pending_token": fresh_pending_token,
        "email": TEST_EMAIL, "phone": TEST_PHONE_E164,
        "otp": known,
        "name": "TEST_OTP_User",
    })
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("ok") is True
    token = j.get("session_token")
    assert token and token.startswith("sess_")
    # 90-day session in db
    sess = db.user_sessions.find_one({"session_token": token})
    assert sess is not None
    exp = sess["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    days = (exp - datetime.now(timezone.utc)).days
    assert 89 <= days <= 90, f"session expects ~90d, got {days}"
    # Codes consumed
    used_count = db.invite_codes.count_documents({"code": {"$in": list(FOUNDER_PAIR)}, "used_by": {"$ne": None}})
    assert used_count == 2
    # Cleanup: drop session and user, restore codes for further runs
    user_id = j["user"]["user_id"]
    db.user_sessions.delete_many({"user_id": user_id})
    db.users.delete_one({"user_id": user_id})
    db.invite_codes.update_many(
        {"code": {"$in": list(FOUNDER_PAIR)}},
        {"$set": {"used_by": None, "used_at": None}},
    )
    # CRITICAL: server set session_token cookie on the requests.Session; clear it
    # so subsequent guest-bearer requests aren't auth'd with this deleted session.
    s.cookies.clear()


# ─── Quran ───────────────────────────────────────────────────────────────────
def test_quran_surahs_114(s):
    r = s.get(f"{BASE_URL}/api/quran/surahs")
    assert r.status_code == 200, r.text
    surahs = r.json().get("surahs") or r.json().get("data") or r.json()
    if isinstance(surahs, dict) and "surahs" in surahs:
        surahs = surahs["surahs"]
    assert isinstance(surahs, list)
    assert len(surahs) == 114, f"expected 114, got {len(surahs)}"


def test_quran_surah_1_en(s):
    r = s.get(f"{BASE_URL}/api/quran/surah/1?lang=en")
    assert r.status_code == 200, r.text
    j = r.json()
    # Locate ayahs list
    ayahs = j.get("ayahs") or (j.get("data", {}).get("ayahs") if isinstance(j.get("data"), dict) else None)
    assert isinstance(ayahs, list) and len(ayahs) == 7, f"got {len(ayahs) if ayahs else 'no'} ayahs"
    a = ayahs[0]
    assert "ar" in a and "tr" in a, f"ayah keys: {list(a.keys())}"
    assert a["ar"].strip() and a["tr"].strip()


def test_quran_surah_1_ur(s):
    r = s.get(f"{BASE_URL}/api/quran/surah/1?lang=ur")
    assert r.status_code == 200
    j = r.json()
    ayahs = j.get("ayahs") or (j.get("data", {}).get("ayahs") if isinstance(j.get("data"), dict) else None)
    assert ayahs and len(ayahs) == 7


def test_quran_languages_min9(s):
    r = s.get(f"{BASE_URL}/api/quran/languages")
    assert r.status_code == 200
    langs = r.json().get("languages") or r.json()
    if isinstance(langs, dict) and "languages" in langs:
        langs = langs["languages"]
    assert isinstance(langs, list)
    codes = {l.get("id") if isinstance(l, dict) else l for l in langs}
    for c in ("en", "ur", "fr", "tr", "id", "ru", "es", "de"):
        assert c in codes, f"missing language {c}, got {codes}"
    assert len(langs) >= 9


# ─── Calendar ────────────────────────────────────────────────────────────────
def test_calendar_today(s):
    r = s.get(f"{BASE_URL}/api/calendar/today")
    assert r.status_code == 200
    j = r.json()
    h = j.get("hijri")
    assert h and all(k in h for k in ("year", "month", "day", "month_name", "day_name")), h
    assert isinstance(j.get("upcoming"), list)


def test_calendar_march_2026(s):
    r = s.get(f"{BASE_URL}/api/calendar/month?year=2026&month=3")
    assert r.status_code == 200
    titles = [e.get("title", "").lower() for e in r.json().get("events", [])]
    blob = " | ".join(titles)
    for needle in ("navroz", "chandraat", "lailat", "eid"):
        assert needle in blob, f"missing {needle} in March 2026 events: {titles}"


def test_calendar_dec_2026_salgirah(s):
    r = s.get(f"{BASE_URL}/api/calendar/month?year=2026&month=12")
    assert r.status_code == 200
    events = r.json().get("events", [])
    sal = [e for e in events if "salgirah" in e.get("title", "").lower()]
    assert sal, f"no Salgirah in Dec 2026: {events}"
    # date must be 2026-12-13
    assert any(e.get("date", "").endswith("12-13") or e.get("gregorian", "").endswith("12-13") or "2026-12-13" in str(e) for e in sal), sal


# ─── Noor Moment ─────────────────────────────────────────────────────────────
def test_noor_moment_and_rate_limit(guest_client):
    # Pick first community
    rc = guest_client.get(f"{BASE_URL}/api/communities")
    assert rc.status_code == 200, rc.text
    cs = rc.json().get("communities") or rc.json()
    if isinstance(cs, dict) and "communities" in cs:
        cs = cs["communities"]
    assert cs, "no communities returned"
    community_id = cs[0]["community_id"]
    # Clear previous noor_moment messages so rate limit doesn't false-trigger
    db.chat_messages.delete_many({"community_id": community_id, "kind": "noor_moment"})

    r1 = guest_client.post(f"{BASE_URL}/api/communities/{community_id}/noor-moment")
    assert r1.status_code == 200, r1.text
    m = r1.json()
    assert m.get("kind") == "noor_moment"
    assert 1 <= len(m.get("text", "")) <= 360

    r2 = guest_client.post(f"{BASE_URL}/api/communities/{community_id}/noor-moment")
    assert r2.status_code == 429
    assert "resting" in r2.json().get("detail", "").lower()


# ─── Regression ──────────────────────────────────────────────────────────────
def test_auth_me(guest_client):
    r = guest_client.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200


def test_noor_today(guest_client):
    r = guest_client.get(f"{BASE_URL}/api/noor/today")
    assert r.status_code == 200


def test_tasbih_state(guest_client):
    r = guest_client.get(f"{BASE_URL}/api/tasbih/state")
    assert r.status_code == 200


def test_communities(guest_client):
    r = guest_client.get(f"{BASE_URL}/api/communities")
    assert r.status_code == 200


def test_jamatkhanas_count_99(guest_client):
    r = guest_client.get(f"{BASE_URL}/api/jamatkhanas")
    assert r.status_code == 200, r.text
    j = r.json()
    items = j.get("jamatkhanas") or j.get("items") or j
    if isinstance(items, dict):
        items = items.get("jamatkhanas") or list(items.values())
    assert len(items) == 99, f"expected 99 jamatkhanas, got {len(items)}"


def test_profile_sangat(guest_client):
    r = guest_client.get(f"{BASE_URL}/api/profile/sangat")
    assert r.status_code == 200


def test_noor_digest(guest_client):
    r = guest_client.get(f"{BASE_URL}/api/noor/digest")
    assert r.status_code == 200
