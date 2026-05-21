# Tasbih.ai · Launch-Ready Audit (Feb 2026)

## ✅ What's working end-to-end (live-tested today)

| Flow | Status | Evidence |
|---|---|---|
| **Invite gate** (2 codes, 2 different inviters) | ✅ Live | `/api/invite/verify` rejects same-issuer non-founder pairs; founder pair `FF26CT3U + 39UQR5SQ` accepted in audit run |
| **MSG91 WhatsApp OTP** | ✅ **Live, real message delivered** | Audit run sent OTP to `+918108888330`, MSG91 returned `request_id: 3e0671f7...`, OTP verify created user with 90-day session |
| **Resend email invite** | ✅ Live (sandbox sender) | Audit run: `delivered@resend.dev` → email_id returned, 2 fresh codes minted and tied to recipient |
| **Google OAuth backend** | ✅ Live but not exposed in UI | `/api/auth/session` endpoint healthy (400 on empty payload = correctly validating). Frontend doesn't show a Google button — email + OTP is the primary path per user choice. Backend kept for future. |
| **Noor of the Day** | ✅ | API returns `verse_ar`, `verse_en`, `ref`, `reflection`. Home now uses 3-attempt retry with progressive backoff to handle auth race. |
| **Noor Moment (chat AI)** | ✅ Live | Tested in earlier sprint; rate-limit 1/min/community enforced |
| **Quran reader** | ✅ Live | 114 surahs via alquran.cloud, 9 translations (Sahih, Asad, Jalandhry, Hamidullah, etc.) |
| **Ismaili Calendar** | ✅ Live | Salgirah, Imamat Day, Navroz, Eid-e-Ghadir, Ashura, Chandraat (Hijri-derived) |
| **Admin org-verification** | ✅ Live | `/admin` page, cascade to circles + posts |
| **Verified Stewards public page** | ✅ Live | `/stewards` — calm directory of verified orgs |
| **Bottom nav** (flat fixed bar, hide-on-scroll) | ✅ | Home · Noor · Circles · Calendar · Profile |
| **PWA manifest** | ✅ | Name, icons (192/512/apple-touch), theme color #0F3D36, standalone display |
| **53/53 pytest cases** | ✅ pass in 15s | `cd /app && python3 -m pytest backend/tests/` |

## 🔧 Dead/hardcoded UX fixed this audit

| Before | After |
|---|---|
| Home tile: "Events · Noor Night · Sat" (hardcoded) | "Events · `<next real event title>` / No upcoming yet" (live from `/api/events`) |
| Home tile: "Volunteer · 3 drives nearby" → `/circles` | "Khidmah · Soft recognition" → `/khidmah` (real destination) |
| Bottom nav 5th item: Events | Calendar (better surfacing for a key feature) |
| Calendar buried — only reachable from "On the calendar" strip if it appears | Permanent home in bottom nav |
| Noor of the Day stuck on "Loading reflection…" if auth race | 3-retry exponential backoff in Home fetch |

## ⚠️ Launch blockers to resolve before App Store / Play Store

### 🔴 P0 — Native wrapper required for app stores
Tasbih.ai is currently a **mobile-first PWA** (Progressive Web App). Apple's App Store does **NOT** accept pure PWAs directly. You have two viable paths:

1. **Capacitor wrap (recommended, ~6–8 h)**
   - Wraps the existing React build into a thin iOS/Android shell.
   - Same code, same UX, no rewrite. Push notifications, biometric unlock, app icon, splash all native.
   - Bundle size ~5 MB. Single deploy pipeline.
   - I can build this in a separate sprint when you're ready.

2. **PWA install + "Add to Home Screen" (free, today)**
   - Already works on Android (Chrome menu → "Install app").
   - Works on iOS via Safari → Share → "Add to Home Screen" (but no push notifications, limited offline).
   - Use this to soft-launch with the 30 founder codes before investing in the native wrap.

### 🟠 P1 — Resend domain verification still pending (waiting on your DNS)
- Domain `mail.tasbih.ai` is registered with Resend (id `ae3c7fd6-d890-4690-a47c-9013cb18213a`).
- **3 DNS records to add** at your `tasbih.ai` DNS provider — exact records in `/app/memory/RESEND_DNS_SETUP.md`.
- **Without this, email invites only deliver to your own Resend signup email** (the sandbox restriction).
- Once you add the DNS records, tell me and I'll verify + flip `RESEND_FROM` to `noor@mail.tasbih.ai`.

### 🟠 P1 — Apple Developer account + Google Play console
- Apple Developer Program — **$99/year**. Needed for App Store submission.
- Google Play Console — **$25 one-time**.
- App icons, screenshots (6.7", 6.5", 5.5" device sizes), privacy policy URL, support URL.

### 🟡 P2 — Production environment hardening (already mostly done)
| Item | Status |
|---|---|
| Cookie `secure: True, samesite: none` | ✅ |
| Backend `.env` secrets not in git | ✅ |
| MongoDB connection via `MONGO_URL` env | ✅ |
| `INVITE_GATE_ENABLED = true` | ✅ |
| 90-day sessions | ✅ |
| Bcrypt hashing | N/A — using OTP not password |
| Rate-limit on OTP send | ⚠️ Add a per-phone 60-sec throttle (currently any user can spam send) — easy fix |
| Rate-limit on `/invites/create` | ⚠️ Currently unlimited (intentional per your spec) but consider a daily ceiling like 10/day to prevent abuse |
| Sentry / error tracking | ❌ Recommend adding before launch — Sentry free tier handles 5k events/mo |

### 🟢 P2 — Quality-of-life recommendations

1. **Deep-link invite codes from emails** — Resend email's "Open Tasbih.ai →" button could pass `?c1=NWWP5LQW&c2=EVUVCTFD` so codes are pre-filled in the invite form. Two-tap registration. (~30 min)
2. **Animated splash → home transition** — currently splash has a hard cut. A 300 ms fade would feel premium. (~15 min)
3. **Empty states polish** — `/journal`, `/mentors`, `/events`, `/khidmah` all need calm empty-state copy and an action. Currently some show nothing. (~1 h)
4. **Privacy & Terms pages** — required for App Store + Resend reputation. I can draft both. (~45 min)
5. **OG image for `tasbih.ai` link previews** — when someone shares the URL on WhatsApp/iMessage, currently shows a blank preview. Need a 1200×630 image. (you provide art, I wire it)

## 🧪 Recommended pre-launch test checklist (run manually on a real phone)

1. Open `tasbih.ai` on iPhone Safari → Add to Home Screen → confirm icon + splash look right
2. Same on Android Chrome → "Install app"
3. Cold sign-up with two unused founder codes → OTP → 90-day session
4. Force-quit, reopen, confirm still signed in (cookie + localStorage fallback)
5. Send a Noor Moment in a circle → ensure all open browsers see it via WebSocket
6. Set a city → /sangat map renders correctly
7. Create an org → invite a 2nd test phone → 2nd phone signs up using your org's vouch
8. Run `/calendar` and confirm Chandraat dates align with your local sighting (they may differ by a day — expected)
9. Tap "Invite a friend by email" → send to your own email → confirm calm HTML rendering

---

## 📋 What I'd ship to App Store v1

**Bundle exactly these features. Everything else is post-launch.**

- ✅ Invite-gated signup (2 codes from 2 inviters)
- ✅ WhatsApp OTP registration via MSG91 (`nevika_otp_verify`)
- ✅ Email invite via Resend (after domain verification)
- ✅ Home with Noor of the Day, Noor Digest, Calendar strip, Streaks, Circles, Khidmah
- ✅ Noor AI chat + Noor Moment in circles
- ✅ Authentic Quran reader with 9 translations
- ✅ Ismaili Calendar (Salgirah, Imamat Day, Navroz, Chandraat, etc.)
- ✅ Tasbih counter + Journal + Mentorship + Khidmah leaderboard
- ✅ Communities (Circles) with WebSocket live chat
- ✅ Become an Org + Verified Stewards directory
- ✅ Jamatkhana locator with geo-distance
- ✅ My Sangat spiritual passport with Leaflet map
- ✅ Admin verification UI

**Cut for v1.1+:** Ginan + Dua libraries · FCM push (Expo wrapper) · Voice rooms (cancelled) · Family/ECDC parenting module · Year-in-Noor mosaic · Org-only event creation gate.
