# Tasbih.ai — Test Credentials

## Auth flow (as of pre-audit, May 22 2026)
Two codes from two **different** inviters → **Google Sign-in (mandatory)** → 90-day session.
Founder codes (`founder:true` in MongoDB) bypass the same-issuer check.

MSG91 WhatsApp OTP path is **hidden** behind a frontend feature flag (`OTP_LOGIN_ENABLED=false`
in `/app/frontend/src/pages/Login.jsx`). Backend endpoints `/api/auth/otp/send` and
`/api/auth/otp/verify` still exist for emergency rollback but are not surfaced in the UI.

## 30 Founder Invitation Codes (8-char alphanumeric, no 0/O/1/I)
All have `issued_by:"system"` and `founder:true` in MongoDB. Pair them as you like:

```
01. RR43CLBG    02. 3TLB2RK4    03. B8DZHT2P    04. QMPHQ59Y    05. CBU8LQG6
06. UFLHJW4J    07. EK48P89X    08. S4YNQFPK    09. X8PK3D9N    10. DDJT3RNY
11. 6ULEDDAT    12. WJ4BM7YH    13. FF26CT3U    14. 39UQR5SQ    15. 53Q7H6WC
16. RC8S3HSH    17. FB726CEW    18. TEBJGZ2A    19. ZGC325D2    20. UFGL76K6
21. KMLBR6H9    22. UB6ZPB68    23. K82UUQWV    24. M86P5US6    25. AF5WQ2RY
26. REE75BCT    27. 9A8Y2C57    28. R2EZ9W6Y    29. 649PJKUW    30. 7HDEAU36
```

Owner pair (recommended for testing): **RR43CLBG + 3TLB2RK4**

## Google Sign-in
- Frontend redirect: `https://auth.emergentagent.com/?redirect=<window.location.origin>/`
- Returns to `/` with `#session_id=…` in the URL hash
- `AuthCallback.jsx` reads the hash, POSTs `{ session_id, pending_token }` to `/api/auth/session`
- Backend calls `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data` with `X-Session-ID` header to fetch the verified user identity
- 90-day session cookie (`session_token`, HttpOnly + Secure + SameSite=None)

## Guest path
`POST /api/auth/guest` still exists. Guests can use Home, Noor AI, Dua, Jamatkhanas, and the
50-Imam Tasbih card. Tapping Circles/Profile triggers the `<LoginRequired>` wall.

## Manual session bypass for backend testing
```python
import asyncio, sys, uuid
from datetime import datetime, timezone, timedelta
sys.path.insert(0, '/app/backend')
from server import db
async def main():
    uid = f"user_{uuid.uuid4().hex[:12]}"
    tok = f"audit_{uuid.uuid4().hex[:16]}"
    await db.users.insert_one({
        "user_id": uid, "email": "audit@tasbih.ai",
        "name": "Audit Tester", "status": "member",
        "created_at": datetime.now(timezone.utc),
    })
    await db.user_sessions.insert_one({
        "user_id": uid, "session_token": tok,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=90),
        "created_at": datetime.now(timezone.utc),
    })
    print(f"BEARER={tok}")
asyncio.run(main())
```
Then: `curl -H "Authorization: Bearer $BEARER" "$API/api/auth/me"`
