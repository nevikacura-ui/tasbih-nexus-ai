# Auth-Gated App Testing Playbook (Tasbih.ai)

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('tasbih_db');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  status: 'member',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API
```bash
curl -X GET "$BASE/api/auth/me" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
curl -X POST "$BASE/api/noor/chat" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_SESSION_TOKEN" -d '{"message":"As-salamu alaykum"}'
```

## Step 3: Browser Testing - Set cookie
```javascript
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "your-app.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
}]);
```

## Invite Code Bootstrap (for testing invite-only signup)
Seed admin-issued invite codes:
```bash
mongosh --eval "
use('tasbih_db');
db.invite_codes.insertMany([
  { code: 'NOOR-ALPHA', issued_by: 'system', used_by: null, created_at: new Date() },
  { code: 'NOOR-BETA',  issued_by: 'system', used_by: null, created_at: new Date() }
]);
"
```
