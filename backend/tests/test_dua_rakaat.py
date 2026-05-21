"""Backend tests for Tasbih.ai /api/dua endpoint after Holy Du'a (6-rakaat / 110 items) refactor.

Covers:
  - GET /api/dua returns 110 items with required shape
  - 6 distinct rakaats (1..6)
  - Imam reference is 'Rahim' (NOT 'Karim/Kareem') anywhere in dua content
  - GET /api/dua/{id} happy path + 404
  - situation=rakaat-N filter
Regressions:
  - GET /api/ginan returns the renamed 'eji_sahebjī_tum_rahim' (NOT 'eji_sahebjī_tum_kareem')
  - GET /api/family-corner still works
  - /api/health and auth basic endpoints respond (no regression from content.py change)
"""

import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://noor-community-1.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- /api/dua list -------------
class TestDuaList:
    def test_dua_list_has_110_items(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dua", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "dua" in data
        assert len(data["dua"]) == 110, f"Expected 110 dua items, got {len(data['dua'])}"

    def test_dua_items_required_fields(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dua", timeout=30)
        data = r.json()
        required = {"id", "rakaat", "order", "situation", "title", "transliteration", "english", "arabic"}
        missing_examples = []
        for item in data["dua"][:20]:
            missing = required - set(item.keys())
            if missing:
                missing_examples.append({"id": item.get("id"), "missing": list(missing)})
        assert not missing_examples, f"Items missing required fields: {missing_examples}"

    def test_dua_six_distinct_rakaats(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dua", timeout=30)
        data = r.json()
        rakaats = sorted({item["rakaat"] for item in data["dua"]})
        assert rakaats == [1, 2, 3, 4, 5, 6], f"Expected rakaats 1..6, got {rakaats}"

    def test_dua_no_karim_anywhere(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dua", timeout=30)
        data = r.json()
        # Search every string field for the old spelling
        blob = ""
        for item in data["dua"]:
            for v in item.values():
                if isinstance(v, str):
                    blob += " " + v
        # Word-boundary, case-insensitive
        karim_hits = re.findall(r"\b(karim|kareem)\b", blob, flags=re.IGNORECASE)
        assert not karim_hits, f"Found legacy 'Karim/Kareem' references: {karim_hits[:5]}"

    def test_dua_contains_shah_rahim_al_husayni(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dua", timeout=30)
        data = r.json()
        joined = " ".join(
            v for item in data["dua"] for v in item.values() if isinstance(v, str)
        )
        assert "Shah Rahim al-Husayni" in joined, "Expected 'Shah Rahim al-Husayni' in dua content"

    def test_dua_first_item_is_bismillah(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dua", timeout=30)
        items = r.json()["dua"]
        # sort to be order-independent
        items_sorted = sorted(items, key=lambda d: (d["rakaat"], d["order"]))
        first = items_sorted[0]
        assert first["rakaat"] == 1
        assert "Bism" in first["transliteration"], f"First item transliteration: {first['transliteration']}"

    def test_dua_credit_field(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dua", timeout=30)
        data = r.json()
        assert "Naushad" in data.get("credit", "") and "Patel" in data.get("credit", "")


# ---------- /api/dua filter -----------
class TestDuaFilter:
    def test_dua_filter_rakaat_3(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dua", params={"situation": "rakaat-3"}, timeout=30)
        assert r.status_code == 200
        items = r.json()["dua"]
        assert len(items) > 0, "rakaat-3 filter returned no items"
        assert all(i["rakaat"] == 3 for i in items), (
            f"Some non-rakaat-3 items leaked through: {[(i['id'], i['rakaat']) for i in items if i['rakaat'] != 3][:3]}"
        )

    def test_dua_filter_each_rakaat_returns_items(self, api_client):
        for rk in range(1, 7):
            r = api_client.get(f"{BASE_URL}/api/dua", params={"situation": f"rakaat-{rk}"}, timeout=30)
            assert r.status_code == 200
            items = r.json()["dua"]
            assert len(items) > 0, f"rakaat-{rk} filter returned 0 items"
            assert all(i["rakaat"] == rk for i in items), f"rakaat-{rk} filter leaked other rakaats"


# ---------- /api/dua/{id} -------------
class TestDuaById:
    def test_dua_by_id_valid(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dua/r1_01_bismillah", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == "r1_01_bismillah"
        assert d["rakaat"] == 1
        assert "Bism" in d["transliteration"]

    def test_dua_by_id_404(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dua/does_not_exist_xyz", timeout=30)
        assert r.status_code == 404


# ---------- Regressions ---------------
class TestRegressions:
    def test_health(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/health", timeout=30)
        # Accept 200 or 204; we just want it to respond, not 5xx
        assert r.status_code < 500, f"health endpoint 5xx: {r.status_code} {r.text}"

    def test_ginan_has_rahim_rename(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/ginan", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        items = data.get("ginan") or data.get("items") or data
        if isinstance(items, dict):
            # Top-level dict — try to find a list
            for v in items.values():
                if isinstance(v, list):
                    items = v
                    break
        ids = [i.get("id") for i in items if isinstance(i, dict)]
        assert "eji_sahebjī_tum_rahim" in ids, f"Renamed ginan id missing. Sample ids: {ids[:5]}"
        assert "eji_sahebjī_tum_kareem" not in ids, "Old ginan id 'eji_sahebjī_tum_kareem' still present"

    def test_family_corner(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/family-corner", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "prompts" in data
        assert "stages" in data
        assert len(data["stages"]) >= 6

    def test_otp_endpoint_responds(self, api_client):
        # Just confirm route exists and doesn't 5xx on a malformed request — we accept 400/422/500-config errors.
        # Per credentials file MSG91_OTP_TEMPLATE_ID may be missing → 500 'OTP service not configured' is acceptable.
        r = api_client.post(f"{BASE_URL}/api/auth/otp/send", json={}, timeout=30)
        assert r.status_code in (400, 401, 403, 422, 500), f"Unexpected status: {r.status_code} {r.text[:200]}"
