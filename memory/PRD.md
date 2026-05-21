# Tasbih.ai — Product Requirements Document (PRD)

## Vision
Tasbih.ai is an **independent, community-driven** AI-powered spiritual and community ecosystem for modern Muslim youth and families — with a deliberate **Ismaili wellness** tonality. It is **NOT** a religious authority, fatwa platform, or institutional representative.

The experience should feel:
**emotionally warm · spiritually calm · cinematically minimal · trustworthy · youth-first**

## Tech stack (delivered)
- **Frontend**: React 18 (CRA + CRACO), React Router v6, TailwindCSS, lucide-react, mobile-first
- **Backend**: FastAPI + Motor (MongoDB), emergentintegrations (Claude Sonnet 4.5)
- **Auth**: Emergent-managed Google OAuth (ready, behind `/login`) + 2-invitation gate (built, hidden behind a feature flag) + silent guest auto-login (current default)
- **AI**: Claude Sonnet 4.5 via Emergent Universal LLM Key
- **Hosting**: Supervisor-managed services on Kubernetes preview pod

## Design system
- Palette: Deep Emerald `#0F3D36`, Forest `#123F39`, Warm Sand Gold `#C9A46A`, Ivory `#F7F3EC`, Sand `#E8DFCB`
- Type: **Fraunces** (display serif) + **Inter** (sans)
- Glassmorphism, Noor halo, drifting gold particles, geometric overlay, breathing animations
- Custom splash screen using user-supplied cinematic art
- Brand wordmark on Login + Home

## User personas
- **Reflective youth** — wants calm daily reflection, journaling, dhikr, AI companion
- **Connected member** — joins circles, RSVPs to events, chats with community
- **Volunteer / mentor** — engages with seva drives and mentorship
- **Family / parent** — uses family circles, parenting resources (future)

## Implemented in this MVP (Phase 1 — May 2026)

### Auth & onboarding
- ✅ Silent **guest auto-login** (no login wall) — users land directly in the app
- ✅ `/login` screen with **Google OAuth** + "Skip — continue as guest"
- ✅ **Invite-code gate** (2-code requirement) — code in place, hidden via `INVITE_GATE_ENABLED=false`
- ✅ 4-step **onboarding** (welcome → goals → mood → city)
- ✅ Member invite generation (3 per user) + redemption flow

### Home
- ✅ Brand-wordmark header + guest/user avatar chip
- ✅ **Noor of the Day** hero (Quranic verse + AI reflection + CTA)
- ✅ Ritual cards (tasbih · streak · journal) wired to live backend data
- ✅ Next-prayer breathing ring
- ✅ "Your Circles" horizontal scroll
- ✅ Feature tiles: **Qurʾan**, **Ramadan**, Events, Volunteer
- ✅ Ramadan teaser card (auto-appears near/during Ramadan)
- ✅ Noor Reflections feed

### Noor AI companion
- ✅ Multi-turn chat with **Claude Sonnet 4.5**
- ✅ Persona prompt grounded in Ismaili ethics: pluralism, ʿaql, seva/khidmah, Aga Khan teachings
- ✅ Ginanic poetry references when natural
- ✅ Strict safety guardrails: NO fatwas, NO sectarian content, NO political/medical advice
- ✅ Crisis-aware responses (gentle helpline pointer)
- ✅ Suggested prompt chips ("I feel anxious", "Help me reflect"…)
- ✅ **Word-by-word streaming effect** for a calm typing reveal

### Tasbih
- ✅ Animated circular counter (0/99 default)
- ✅ Three phrases (SubḥānAllāh, Alḥamdulillāh, Allāhu Akbar) in Arabic + transliteration
- ✅ Haptic feedback (where supported)
- ✅ Persisted streak + total + today counts

### Qurʾan Reflections
- ✅ 5 curated **reflective summaries** (Aḍ-Ḍuḥā, Ash-Sharḥ, Ar-Raḥmān, Al-Kahf, Al-Ḥujurāt)
- ✅ Each card: Arabic text, theme, gentle summary, "small invitation"
- ✅ Deep-link to "Reflect with Noor"
- ✅ Clear disclaimer: reflective summaries, not rulings or tafsir

### Ramadan tools
- ✅ Auto-phase detection (before / during / after)
- ✅ 30-day daily log grid (tap to mark, persists per user)
- ✅ Suhoor intention, iftar gratitude, evening reflection tiles
- ✅ Auto-shown teaser card on Home when relevant

### Journal
- ✅ Private journal with title + body + mood
- ✅ Bottom-sheet entry modal (5 moods)
- ✅ Timeline list with timestamps

### Communities + Chat
- ✅ 6 seeded circles (Youth, Reflection, Volunteers, Founders, Mentors, Families)
- ✅ Search + 6 filters
- ✅ Join / Joined states (persisted)
- ✅ **Live community chat** — true WebSocket (`/api/ws/community/{id}`)
  - Real-time message delivery (no polling)
  - **Typing indicators** ("Layla is typing…")
  - REST fallback if socket drops
  - Optimistic UI on send
  - Glass message bubbles + auth via short-lived `/auth/token`
- ✅ **Community feed** (posts + likes + comments) — full Phase 2 community depth
  - Compose post (up to 2000 chars)
  - Heart-based reactions (toggle, persisted)
  - Threaded comments (up to 800 chars each)
  - Tabbed UI in each circle: **Live chat** ↔ **Feed**
- ✅ Mentorship grid (4 sample mentors)

### Events
- ✅ Featured event hero (Noor Night)
- ✅ "Coming up" event cards with date chips + RSVP
- ✅ Volunteer drives grid

### Reminders & in-app nudges
- ✅ Default seeded reminders (5 prayer times + evening journal)
- ✅ Add / toggle / delete reminders (CRUD)
- ✅ **Soft in-app toast** — polls every 25s, shows a calm glassmorphism toast when a reminder time arrives (no system notifications)

### Profile
- ✅ Stats (streak, dhikr, entries)
- ✅ Badge strip
- ✅ Row-links to Invites, Journal, Tasbih, Reminders, **Moderation queue**
- ✅ Memberships list
- ✅ Sign out
- ✅ Non-authority disclaimer

### Mentorship (Phase 3)
- ✅ Browse mentors with skill filter chips
- ✅ Seeded mentor profiles (Dr. Sana · medicine, Hamza · startup, Ayesha · design, Yusuf · education)
- ✅ Mentor profile detail sheet (bio + skills + slots remaining)
- ✅ Send mentorship request with personal note
- ✅ Requests tab (sent + received) with Accept / Decline workflow for mentors
- ✅ Auto-decrements open slots on acceptance

### Hierarchical circles (Phase 3)
- ✅ Communities now have `country` field
- ✅ Circles page has a second filter row: **All · Canada · Global · India · Pakistan · UK · UAE · France**
- ✅ Hierarchy endpoint `/api/circles/hierarchy` returns country → city → circles tree
- ✅ Seeded 2 new global circles (Dubai Youth, Cercle Paris)

### Multilingual Noor (Phase 4)
- ✅ Language picker (Globe icon) on Noor page
- ✅ 5 supported languages: **English · Urdu (اردو) · Arabic (العربية) · French · Gujarati (ગુજરાતી)**
- ✅ System prompt dynamically adds the response-language instruction
- ✅ Quranic verses remain in Arabic with soft translation in selected language
- ✅ Preference saved to localStorage per device

### Khidmah Leaderboard (smart engagement)
- ✅ Soft, **service-only** scoring (not vanity metrics):
  - Volunteer RSVPs +3
  - Loved posts +1
  - Kind comments (≥60 chars) +2
  - Mentorship offered (mentor) +5
  - Mentorship received (mentee) +3
- ✅ Monthly window with **Prev / Next** navigation
- ✅ "Your khidmah" hero with point total, rank, and breakdown chips
- ✅ Top-25 leaderboard with crown badge for #1
- ✅ Rules card so members know exactly how to earn (encourages real-world acts, not posting)

### Auth resilience
- ✅ **Non-blocking auth bootstrap** — Protected wrapper no longer gates the UI. Pages render immediately and auth syncs in the background.
- ✅ **Cookie + localStorage token dual fallback** — guest endpoint returns `session_token` in JSON body, frontend stores it, axios interceptor attaches it as `Authorization: Bearer …` on every request. Works even when mobile browsers block cookies.
- ✅ Axios timeout: 15s (so requests never hang silently)
- ✅ Faster splash (1.1s show → 1.7s gone)
- ✅ Auth gate flag `INVITE_GATE_ENABLED` still **off** for free testing

### Splash + brand
- ✅ Cinematic full-screen **splash on first session** (user-supplied art)
- ✅ Favicon, PWA manifest, theme color
- ✅ Wordmark on Login + Home headers

## Backlog / Next phases

### Phase 2 — Community depth (P0)
- [ ] Community feeds (posts, comments, reactions, media)
- [ ] Real-time websocket chat (replace polling)
- [ ] Reporting + moderation queue
- [ ] City / Country hierarchical communities
- [ ] Voice rooms

### Phase 3 — Mentorship & trust (P1)
- [ ] Mentor profiles, skill tags, matching
- [ ] Mentee request flow
- [ ] Trust scoring + referral analytics
- [ ] Anti-spam / rate limits

### Phase 4 — Advanced AI + global (P1/P2)
- [ ] Multilingual Noor (Urdu, Arabic, French, Gujarati)
- [ ] Streaming AI responses
- [ ] Personalized daily Noor based on journal sentiment
- [ ] Mood-based recommendations
- [ ] Voice journaling
- [ ] Family / ECDC module

### Phase 5 — Production hardening
- [ ] Email + Apple OAuth
- [ ] Switchable invite-only mode (flip `INVITE_GATE_ENABLED=true`)
- [ ] Push notifications (mobile)
- [ ] Admin dashboard (user management, moderation, analytics)
- [ ] Native Expo wrapper for App Store / Play Store

## Engineering notes
- **Feature flag** for invite gate: `INVITE_GATE_ENABLED` in `/app/frontend/src/pages/Login.jsx`
- **Auto-guest** behavior: `/app/frontend/src/lib/auth.js` — visiting any URL other than `/login` silently creates a guest session
- **Noor AI prompt**: edit `NOOR_SYSTEM_PROMPT` in `/app/backend/server.py`
- **Seeded data** is idempotent — only inserts when collections are empty

## Test credentials
- See `/app/memory/test_credentials.md`
