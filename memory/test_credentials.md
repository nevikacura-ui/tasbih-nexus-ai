# Tasbih.ai — Test Credentials

> The default auth flow is **silent guest auto-login** (no credentials needed).
> Google OAuth is reachable at `/login` but requires a real Google account in the browser.

## Manual test session (admin/seeded user)
You can create an authenticated test session via `mongosh`:

```bash
mongosh tasbih_db --quiet --eval '
var userId = "test-user-amira";
var token  = "tt_amira_session";
db.users.updateOne(
  {user_id:userId},
  {$set:{user_id:userId,email:"amira@tasbih.ai",name:"Amira Test",picture:null,status:"member",city:"Toronto",invite_codes_used:["NOOR-ALPHA","NOOR-BETA"],referrals_received:2,invites_available:3,created_at:new Date()}},
  {upsert:true}
);
db.user_sessions.updateOne(
  {session_token:token},
  {$set:{user_id:userId,session_token:token,expires_at:new Date(Date.now()+7*24*3600*1000),created_at:new Date()}},
  {upsert:true}
);
print("Session token: "+token);
'
```

Then test:
```bash
BASE="https://be2e8ac9-4354-4086-8ac0-8b3db85a8926.preview.emergentagent.com"
curl -H "Authorization: Bearer tt_amira_session" $BASE/api/auth/me
```

In a browser, set a cookie named `session_token` with value `tt_amira_session` (`path=/`, `secure`, `samesite=None`).

## Bootstrap invitation codes
Seeded automatically on first startup if the `invite_codes` collection is empty:
- `NOOR-ALPHA`
- `NOOR-BETA`
- `NOOR-GAMMA`
- `NOOR-DELTA`
- `NOOR-EPSILON`

These can be used in the invite-code form once `INVITE_GATE_ENABLED=true`.

## Notes
- Google OAuth: no app-managed password is stored. Any Google account can sign in once OAuth is enabled.
- Guest sessions persist for 7 days via httpOnly cookie.
