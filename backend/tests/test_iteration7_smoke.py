"""
Iteration 7 smoke test — regression check after adding
`eslint: { enable: false }` to /app/frontend/craco.config.js.

This is a build-time-only change; verify no runtime regressions:
1) GET /api/health
2) GET /api/jamatkhanas — US Texas JKs still present, Spring JK at ~30.115,-95.543
3) POST /api/auth/guest — returns session_token
4) GET /api/noor/usage (guest) — {used_today, daily_limit:3, remaining_today}
5) GET /api/full-dua/timeline?voice=male — still returns segments
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


def _fresh():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ── 1) Health
def test_health_ok():
    r = _fresh().get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ── 2) Jamatkhanas — Texas coverage still present
def test_jamatkhanas_us_texas_spring_present():
    r = _fresh().get(f"{API}/jamatkhanas", params={"country": "United States"}, timeout=30)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    # Support either list or {"jamatkhanas": [...]} shape
    if isinstance(body, dict):
        jks = body.get("jamatkhanas") or body.get("items") or body.get("results") or []
    else:
        jks = body
    assert isinstance(jks, list) and len(jks) > 0, f"no JKs returned: {body}"
    # Look for Spring JK at ~30.115, -95.543
    spring = None
    for jk in jks:
        lat = jk.get("lat") or jk.get("latitude")
        lng = jk.get("lng") or jk.get("longitude") or jk.get("lon")
        try:
            if lat is not None and lng is not None:
                if abs(float(lat) - 30.115) < 0.05 and abs(float(lng) - (-95.543)) < 0.05:
                    spring = jk
                    break
        except Exception:
            continue
    assert spring is not None, (
        f"Spring TX JK (~30.115,-95.543) not found. First JK sample: {jks[0] if jks else 'empty'}"
    )
    # Sanity: state/name/address hints at Texas
    dump = str(spring).lower()
    assert "spring" in dump or "tx" in dump or "texas" in dump, f"Spring JK payload lacks TX hints: {spring}"


# ── 3) Guest auth
@pytest.fixture(scope="module")
def guest_token():
    r = _fresh().post(f"{API}/auth/guest", timeout=15)
    assert r.status_code == 200, r.text[:300]
    tok = r.json().get("session_token")
    assert tok and isinstance(tok, str) and len(tok) > 10, f"bad session_token: {r.json()}"
    return tok


def test_auth_guest_returns_session_token(guest_token):
    assert guest_token.startswith("guest_") or len(guest_token) > 10


# ── 4) Noor usage
def test_noor_usage_shape(guest_token):
    r = _fresh().get(
        f"{API}/noor/usage",
        headers={"Authorization": f"Bearer {guest_token}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert "used_today" in data
    assert data.get("daily_limit") == 3, f"daily_limit={data.get('daily_limit')}"
    assert "remaining_today" in data
    assert isinstance(data["used_today"], int)
    assert isinstance(data["remaining_today"], int)
    assert data["used_today"] + data["remaining_today"] == 3


# ── 5) Full-dua timeline still returns
def test_full_dua_timeline_male_ok():
    r = _fresh().get(f"{API}/full-dua/timeline", params={"voice": "male"}, timeout=60)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    segs = body.get("segments") or []
    assert isinstance(segs, list) and len(segs) > 100, f"segments={len(segs)}"
    assert body.get("total_segments") == len(segs)
