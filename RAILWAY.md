# Deploying Tasbih.ai to Railway

Everything the kit README describes is already wired into this repo. Do these in order.

## 1. MongoDB Atlas
* `cloud.mongodb.com` → cluster → **Network Access** → add `0.0.0.0/0` (Railway uses dynamic IPs).
* Copy the SRV connection string and URL-encode any special chars in the password.

## 2. Railway project
* railway.app → **New Project → Deploy from GitHub repo** → pick this repo.
* Nixpacks auto-detects `/nixpacks.toml` at the root.

## 3. Environment variables
Copy every line from `/railway.env.example` into Railway → Variables → **Raw Editor**, then fill in the real values.

Do not paste an `PORT=` line; Railway supplies `$PORT` automatically.

## 4. First deploy
Watch Railway logs for:
```
INFO:tasbih:Serving React frontend from /app/frontend/build
INFO:tasbih:Tasbih.ai backend ready
INFO:     Uvicorn running on http://0.0.0.0:8080
```

If MongoDB fails: the Atlas network-access step above was skipped.

## 5. Point the URLs at yourself
After Railway assigns a domain (e.g. `web-production-xxxx.up.railway.app`), update in Variables:
```
REACT_APP_BACKEND_URL=https://web-production-xxxx.up.railway.app
REACT_APP_PUBLIC_URL=https://web-production-xxxx.up.railway.app
FRONTEND_URL=https://web-production-xxxx.up.railway.app
CORS_ORIGINS=https://web-production-xxxx.up.railway.app,https://www.tasbih.ai,https://tasbih.ai
```
Railway auto-redeploys on save.

## 6. Custom domain (www.tasbih.ai)
* Railway → Settings → Domains → **Add** `www.tasbih.ai`.
* At your DNS registrar add a `CNAME`: `www` → `web-production-xxxx.up.railway.app`.
* (Optional root) `A` or `ALIAS` on `@` → the IP Railway gives you.
* The non-www → www 301 is already handled by `_redirect_to_www` in `backend/server.py`.

## 7. Google OAuth
Google Cloud Console → Credentials → your Web Client:
* **Authorised JavaScript origins**: `https://www.tasbih.ai`, `https://tasbih.ai`, `https://web-production-xxxx.up.railway.app`
* **Authorised redirect URIs**: same three, each with `/auth/google/callback` appended if you use redirect flow.

## What was changed in the repo
* `/nixpacks.toml` — Railway build/start config (Node 22, apt Python, `emergentintegrations` PyPI index).
* `/railway.env.example` — full env template with Tasbih integrations.
* `/backend/server.py`:
  * CORS `allow_origins` now reads `CORS_ORIGINS` (comma-separated) — falls back to `*` when unset, so Emergent preview and local dev are unaffected.
  * Bottom of the file mounts `/frontend/build` (static + root + SPA catch-all) only if that directory exists, plus a `tasbih.ai → www.tasbih.ai` 301.

## Rollback
The frontend-serving block is guarded by `if _frontend_build_dir.exists()`. On Emergent preview the build dir isn't created, so **none of the Railway code paths run there** — you can keep both deployments live in parallel.
