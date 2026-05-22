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

## Implemented in this MVP (Phase 1–3 + smart engagement — May 2026)

## Latest sprint — Du'a P0 fix + P1 batch (May 22, 2026)

### P0 — Audio "stops right at the start" (root cause + fix)
- **Root cause**: ElevenLabs TTS returns **MONO** MP3 frames (channel mode `11`), but the silence-padding frames injected between segments were encoded as **Joint Stereo** (channel mode `01`). Mobile browser decoders (mobile Safari & Chrome) bail when channel mode flips mid-stream → the player froze the moment it hit the first silence gap after verse 1.
- **Fix** (`/app/backend/server.py`): silence-frame header byte 3 changed from `0x44` (Joint Stereo) → `0xC4` (Mono); cache schema bumped `5 → 6` so both voices rebuilt cleanly.
- **Verified**: 12,976 frames in the male MP3 are now 100% mono, zero stereo mixed in. Player advances past verse 1 in the live preview.

### P1 — Audio resume "Pick up where you left off"
- Backend: `POST /api/dua/progress` (throttled save every 5 s) + `GET /api/dua/progress` (returns saved position + voice).
- Frontend: gold-glass pill appears bottom-left when a saved position > 20 s exists. Tap → switches to saved voice, seeks to position, begins playback.

### P1 — Verse bookmarks + share-card export
- Backend: `GET /api/dua/bookmarks`, `POST /api/dua/bookmarks`, `DELETE /api/dua/bookmarks/{dua_id}`.
- Frontend: Bookmark + Share buttons on every Dua half-card. Share opens a cinematic preview card (Arabic + transliteration + English on the same rakaat gradient with mosque silhouette) with **Copy text** and native **Share** actions.

### P1 — Noor AI contextual Du'a suggestion
- Backend: `NOOR_SYSTEM_PROMPT` extended with a 15-verse curated theme catalogue. Claude appends a `[DUA:<id>]` marker when a verse fits the user's mood. Server strips the marker and attaches a `suggested_dua` object to the response.
- Frontend: After the stream finishes, a gold-bordered "SIT WITH THIS VERSE" mini-card slides in under Noor's reply, linking to `/dua`.

### Home credit
- Added a calm "Curated with care · Naushad & Shabnam Patel · Andheri Jamatkhana · Mumbai · India" footer to the Home page, matching the existing Profile & Login styling.

### Du'a Imam-overlap fix + content audit (May 22, 2026)
- **Bug**: At ~4:28 a faint "Mawlana ʿAly" voice was audible behind the master recitation. **Root cause**: when the user reached the 50-Imam interlude slide, the `ImamListInterlude` React component auto-started its own client-side audio (looping `<audio>` element fetching `/api/tasbih-name/audio`) — but the master MP3 already contained all 50 names embedded. Two voices were reciting the same 50 names from different positions → audible ghost voice.
- **Fix**: When `autoPlayActive` is true, the interlude no longer spawns its own audio. It now only mirrors the master's currently-spoken name via a new `masterDrivenName` prop (visual highlight + auto-scroll + tick check). The "Recite all" button is disabled while master plays.
- **Content audit doc** at `/app/memory/DUA_CONTENT_AUDIT.md` — 760-line export of all 110 verses + 50 Imam names. User confirmed the 50-name Tasbih is correct per Nizari Ismaili lineage: position #2 is Mawlana Husayn (Hasan al-Mujtaba not counted), and all three apparent duplicates (Nizar #19/#40, Mustansir #18/#32, Khalil Allah Ali #39/#45) reflect genuine distinct Imams.

### Du'a Completion Overlay (May 22, 2026)
- When the master MP3 reaches its natural end (`onended`), a calm completion modal slides up with:
  - Gold sparkle seal · "YĀ ʿALĪ MADAD · YOUR DU'A IS COMPLETE" eyebrow · "Carry the noor with you." headline
  - For **members**: mood pill row (Peaceful / Moved / Grateful / Still) + 3-line reflection textarea (280 chars) → "Add to Sangat" button → posts to `POST /api/journal` with `tags: ['holy_dua', 'after_dua']`
  - For **guests**: "Sign in to save this moment" CTA → links to /login
  - For both: a small "Share Tasbih with a friend" pill that opens the WhatsApp share sheet with the premium pre-filled message
- Also clears the saved resume position so the "Pick up where you left off" pill doesn't appear next time.
- Dev-only test hook: open `/dua?testdua=1` and call `window.__tasbihTriggerCompletion()` in console to preview the modal without waiting for full playback.

### App Share + WhatsApp link preview (May 22, 2026)
- **Share Tasbih button** (`/app/frontend/src/components/ShareTasbihButton.jsx`) opens the OS share sheet (mobile) or WhatsApp Web (desktop) with a premium pre-filled message that rotates daily. Three message variants currently: "A small gift for you", "Yā ʿAlī madad 🌙 found a quiet space…", and "I think you'll feel this one".
- Drop-in surfaces: Home page bottom (next to Install app), Du'a completion modal.
- **Open Graph image** at `/og-share.jpg` (1200×630, 43 KB) — emerald-to-gold gradient, mosque silhouette, "Tasbih.ai · Remember. Reflect. Seek Noor." headline, feature pill at bottom. Generated by `/app/frontend/public/_make_og.py` — run that script to regenerate after brand changes.
- **Domain-aware**: `REACT_APP_PUBLIC_URL=https://tasbih.ai` in `frontend/.env` is the canonical app URL embedded in the share message AND in og:url/og:image meta tags (WhatsApp's crawler can't run JS so meta tags MUST be static). To switch to a custom domain, update `.env` and 3 occurrences in `frontend/public/index.html`.

- **New flow**: 2 invitation codes (2 different inviters; founder codes exempt) → **Google Sign-in (mandatory)** → 90-day session.
- **MSG91 WhatsApp OTP UI hidden** behind feature flag `OTP_LOGIN_ENABLED=false` in `Login.jsx`. Backend OTP endpoints kept for emergency rollback. Existing 90-day WhatsApp sessions continue to authenticate unchanged.
- **Cookie**: `/api/auth/session` now sets a 90-day HttpOnly cookie (was 7-day) so members stay signed in throughout an audit cycle.
- **Login UI**: after the 2-code verify, the user lands on a calm "One last step" card with a verified-codes chip and **Continue with Google** as the only forward action.
- **Invitation rules unchanged**: 2 codes from 2 different inviters; founder codes (30 seeded) exempt; codes are single-use; any member can mint unlimited new codes.
- **Imam pronunciation fix**: ElevenLabs was reading "al-Mustansir" as a separate English syllable ("al MUS-tan-sir"). Added `_tts_normalize_imam_name()` that rewrites " al-" → "n-" before synthesis so the Arabic wasl (definite-article elision) is naturally pronounced ("Mawlana-nal Mustansir"). Display names in the UI remain untouched. Cache schema bumped to 7; both voices rebuilt.
- **Verse cleanup**: `r6_11_mawlana_aly` no longer says "Allāhumma bi haqqi Mawlānā 'Aly" right before the 50-name Tasbih started with "Mawlana 'Aly" — the 'Aly suffix was removed from the verse to prevent the repeated name. The verse is now "Allāhumma bi haqqi Mawlānā" ("O Allah, in the name of our Lord") which flows directly into the names list.
- **50-Imam Tasbih pulse**: each name now flashes a 0.7s gold radial glow + scale pulse when the master MP3 reaches it, with auto-scroll into view.

- **Dua content (`backend/content.py`)**: replaced 20 situational duas with the **full Holy Du'a from user's 2025-dua-translation.pdf** — 110 verse-cards across 6 rakaats. Each item: `{id, rakaat, order, situation: "rakaat-N", title, transliteration, english, arabic}`. Imam reference globally updated **Karim → Rahim** (Aga Khan IV → Aga Khan V transition); also renamed ginan `eji_sahebjī_tum_kareem` → `eji_sahebjī_tum_rahim`.
- **Dua page (`frontend/src/pages/Dua.jsx`)**: Instagram-style scroll-snap feed. **Two duas paired per card** (paired within rakaat, odd-tail solo). Cinematic per-rakaat gradients (emerald/teal/plum/ruby/olive/blue) + mosque silhouette SVG + light rays + grain overlay. Transliteration is the primary large display; English directly below; **Arabic revealed on tap**. Floating gold filter button → 6-rakaat jump sheet.
- **In-slide inserts (`mid_insert` field)**: Slide 44 — "Yā 'Aly yā Muhammad..." gold-bordered glass card between duas. Slide 56 — "My Prostration" verse insert.
- **Dedicated Tasbih interlude slide (`interlude_after` field)**: Slide 54 is a full-bleed dedicated card showing the **Tasbih of the 50 Imams** (from Mawlana 'Aly to Noor Mawlana Shah Rahim al-Husayni). Tap-to-count: each name has an empty circle that fills gold with a ✓ when tapped, strikes through the name, and updates a "X / 50 recited" gold progress bar. Reset button appears once anything is ticked.
- **Bottom nav**: Calendar replaced with Dua (BookOpenText icon). Calendar moved to top of Profile page.
- **Tests**: `backend/tests/test_dua_rakaat.py` — 15 cases, all green.


### Demo cleanup
- ✅ All fake mentor names removed (Dr. Sana, Hamza Karim, Ayesha Devji, Yusuf Damji deleted)
- ✅ Hand-written "Layla / Imran / Sahar" demo reflections removed
- ✅ Legacy demo communities (Toronto Youth Circle, Mumbai Volunteers, etc.) replaced with **six canonical category circles**:
  Spiritual Growth · Family & ECDC · Youth Empowerment · Social Work & Volunteering · Health & Wellbeing · Education & Learning

### Jamatkhana directory (new)
- ✅ **47 jamatkhanas seeded** across **13 countries** (Canada, US, UK, France, Portugal, UAE, Kenya, Tanzania, India, Pakistan, Tajikistan, Singapore, Australia) with lat/lng
- ✅ "Use my current location" — browser Geolocation API + Haversine distance → returns sorted nearest 5
- ✅ Browse by country → city dropdowns with cascading filters
- ✅ Full-text search across name/city/country
- ✅ Direct "Open in Google Maps" link per jamatkhana
- ✅ Accessible from Profile → "Find your Jamatkhana"

### User-created communities + fixed categories (new)
- ✅ Floating + button on Circles page opens **Create circle modal** (name, category, country, city, description)
- ✅ 7 fixed categories: Spiritual · ECDC · Empowerment · Social Work · Health · Education · Other
- ✅ Creator auto-joined with `role: creator`
- ✅ Filter chips reflect categories (no more `youth/volunteers/etc` vanity tags)

### Become a mentor (new)
- ✅ Third tab on Mentors page: "Become a mentor" / "My profile"
- ✅ Form: Headline (140 chars) · Bio (1200 chars) · Skills (comma-sep, max 12) · Open spots · Languages
- ✅ Profile is `open: true` whenever open_slots > 0
- ✅ Retire button to take profile offline
- ✅ Live edit + save with toast feedback
- ✅ Empty-state on browse view encourages "Be the first mentor"

### Notifications (new)
- ✅ Backend notifications collection + auto-creation on:
  - Mentorship request received (notifies mentor)
  - Mentorship accepted / declined (notifies mentee)
  - Moderator content removal (notifies original author + reporter)
- ✅ `/notifications` page with read/unread state
- ✅ Bell icon in Home header with gold unread badge
- ✅ Auto-marks read on view

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
- ✅ Auth gate flag `INVITE_GATE_ENABLED` is **ON** as of Feb 2026 — two codes from two **different** inviters required (founder codes exempt). 90-day sessions.

### Greeting & branding (Feb 2026)
- ✅ Greeting switched to **"Yā ʿAlī Madad"** (Ismaili) across Login + Home headers — previously "As-salāmu ʿalaykum".
- ✅ Login page logo enlarged (128px) and centered; the previously empty top of the screen now reads as a calm cinematic hero.

### Invitation system (Feb 2026)
- ✅ **30 founder codes** (8-char alphanumeric, no 0/O/1/I) seeded with `founder: true` flag — bootstrap pool for the first 15 user pairs.
- ✅ **Unlimited per-user generation** — any member can mint as many codes as they wish; `invites_available` no longer enforced.
- ✅ **Two-different-issuer rule** — `/api/invite/verify` rejects 2 codes from the same `issued_by` user (community-vouching integrity). Founder codes bypass this rule.

### MSG91 WhatsApp OTP registration (Feb 2026)
- ✅ Backend: `POST /api/auth/otp/send` (sends 6-digit OTP via MSG91 SendOTP) and `POST /api/auth/otp/verify` (verifies + creates user with 90-day session).
- ✅ Env vars: `MSG91_AUTH_KEY` (set), `MSG91_OTP_TEMPLATE_ID` (**pending — user must paste from MSG91 dashboard → OTP → Templates with `##OTP##` placeholder**).
- ✅ Login flow: 2 codes → name/email/WhatsApp → 6-digit OTP → 90-day session. No phone pre-fill. Country picker covers 14 markets.

### Content sprint · Ginan, Dua, Family/ECDC (Feb 2026)
- ✅ **Curated content module** at `/app/backend/content.py` — easy to edit/extend without touching server logic.
- ✅ **Ginan library** (`/ginan`) — 12 starter ginans from Pir Hasan Kabirdin, Pir Sadardin, Pir Shams. Each has Gujarati script + transliteration + gentle English meaning + theme. Themes: remembrance, love, light, journey, surrender, service. Search + filter chips.
- ✅ **Dua library** (`/dua`) — 20 short reflective duas in Arabic + transliteration + gentle English. Situations: morning, evening, anxiety, healing, gratitude, parents, travel, sleep, etc. Mix of traditional + personal.
- ✅ **Family Corner** (`/family`) — 18 calm parenting prompts across 7 stages: Infant (0-2), Toddler (2-4), Early (4-7), Middle (7-11), Adolescent (11-15), Teen (15-18), Any age. Each has duration estimate + soft phrasing. Not clinical advice (disclaimer present).
- ✅ All three pages: respectful disclaimer in the footer, "Reflect with Noor" CTA on detail modals, search + filter chips.
- ✅ Profile rows added: `row-ginan` · `row-dua` · `row-family`.
- ✅ **Credit line** added to Login footer + Profile footer: *Content curated with care by Naushad & Shabnam Patel · Andheri Jamatkhana · Mumbai · India*.

### Launch polish (Feb 2026)
- ✅ **Deep-link invite codes** — emails now use `/login?c1=...&c2=...`; Login parses URL params and pre-fills both codes. Two-tap registration from email to app.
- ✅ **Privacy Policy** at `/privacy` (public, no auth) — plain-English data practices, third-party list (MSG91, Resend, Anthropic, Google Geocoding, OSM, alquran.cloud), user rights, children clause, Noor AI disclaimer.
- ✅ **Terms of Use** at `/terms` (public, no auth) — invitation rules, conduct, Noor AI disclaimer, organisation accounts, content licence, governing law.
- ✅ Footer links on Login + Profile pages (Privacy · Terms · Contact).
- ✅ **Year in Noor mosaic** at `/year-in-noor` — 52 quiet tile-grid; each lit tile is a saved Sunday digest. Tap to read the week's reflection. Linked from Noor Digest page.
- ✅ **`/api/noor/year-mosaic`** endpoint — pulls all journal entries tagged `noor-digest` for current year, returns 53-tile array (ISO weeks) with current-week marker.
- ✅ **Onboarding note** at `/app/memory/ONBOARDING_NOTE.md` — copy-paste short + long versions for the first 15 inviters, with each pre-filled deep-link.

### Launch-readiness audit (Feb 2026)
- ✅ Live-tested MSG91 WhatsApp OTP end-to-end (real send + verify via hash-injected code → 90-day session)
- ✅ Live-tested Resend email invite (sandbox sender, `delivered@resend.dev`)
- ✅ Backend regression: 53/53 pytest cases pass
- ✅ Dead/hardcoded Home tiles fixed: Events → real next event, "Volunteer" → Khidmah
- ✅ Calendar promoted to bottom nav (replacing Events)
- ✅ Verified Stewards public page at `/stewards`
- ✅ Noor of the Day fetch made resilient with 3-attempt exponential backoff
- 📄 Full audit document at `/app/memory/LAUNCH_AUDIT.md`

### Admin org-verification + Resend domain registration (Feb 2026)
- ✅ Backend admin endpoints: `GET /api/admin/me`, `GET /api/admin/orgs`, `POST /api/admin/orgs/{id}/verify` with cascade to `communities` + `chat_messages` so the verified badge appears everywhere instantly.
- ✅ Admin guard: `status == "admin"` OR `email == "admin@tasbih.ai"`. Profile shows a hidden `Admin · Stewards` row only when `/api/admin/me` returns `is_admin: true`.
- ✅ Frontend `/admin` page with Pending / Verified sections, single-tap toggle, calm copy, cascading update.
- ✅ Resend domain `mail.tasbih.ai` registered with Resend API (`id: ae3c7fd6-d890-4690-a47c-9013cb18213a`, region `us-east-1`, status `not_started`). DNS records documented at `/app/memory/RESEND_DNS_SETUP.md` for user to paste at the domain provider. Once verified, switch `RESEND_FROM` to `Tasbih.ai <noor@mail.tasbih.ai>`.

### Bottom nav rebuild (Feb 2026)
- ✅ MobileShell bottom-nav rewritten: full-width flat bar (no floating pill), 71px tall, fixed at bottom with `pb-[env(safe-area-inset-bottom)]` for iOS notch.
- ✅ Hide-on-scroll-down (translate-y-full) / reveal-on-scroll-up (translate-y-0) using `requestAnimationFrame`-throttled scroll listener with 6px deadband.
- ✅ Main content padded `pb-24` so no list item is ever obscured.

### Bottom nav + email invite (Feb 2026)
- ✅ Bottom nav rebuilt as a flat **fixed bar with hide-on-scroll-down / reveal-on-scroll-up** (was a floating pill that clipped content). Safe-area-inset on iOS. `pb-24` content padding ensures nothing is obscured.
- ✅ **"Invite a friend by email"** share-sheet on `/invites` — recipient email + optional name + optional co-signer ("from me and Sara"). Backend mints two fresh codes issued_by the sender, tied to the recipient's email via `shared_with_email`, sends via **Resend** with a calm Georgia-serif HTML email (emerald + gold, Yā ʿAlī Madad header, two large code chips, Open Tasbih.ai CTA). Rolls back code creation on Resend failure.
- ✅ Env: `RESEND_API_KEY` (set), `RESEND_FROM=Tasbih.ai <onboarding@resend.dev>` (sandbox), `APP_PUBLIC_URL` (preview URL).
- ⚠️ Sandbox-sender caveat: `onboarding@resend.dev` only delivers to the Resend account owner's verified email on the free tier. Production needs a verified domain.

### Noor Moment (unique chat feature, Feb 2026)
- ✅ Anyone in a community chat can tap the gold **Sparkles** button to invite Noor AI to drop a single 1-2 sentence calm reflection into the live conversation.
- ✅ Rate-limited to **1 per 60 seconds per community** to keep Noor's presence rare and meaningful.
- ✅ Special cinematic rendering — full-width emerald gradient card with gold glow halo, labelled `Noor Moment · invited by <name>`.
- ✅ Broadcasts via existing WebSocket so all open clients see it instantly.

### Phase 4 / engagement (Feb 2026)
- ✅ **Jamatkhana directory expanded to 146 entries** across 25+ countries (Canada, US, UK, Portugal, France, UAE, Kenya, Tanzania, India, Pakistan, Tajikistan, Singapore, Australia, Madagascar, Mozambique, Syria, Afghanistan, etc.). Duplicate seed block removed.
- ✅ **Become an organisation** — new `role: "org"` on User + `org_profile` doc (name, tagline, description, category, country, city, website, logo, verified). Backend: `GET /api/orgs`, `GET/POST/DELETE /api/orgs/me`, `GET /api/orgs/{id}`. Frontend: `/orgs` directory + `/orgs/me` form. Profile row-link added.
- ✅ **Post as organisation** — `as_org` flag on `POST /communities/{id}/posts` attaches org name + verified badge. Community creation also accepts `as_org` → marks `official: true` and stamps `org_id` / `org_name`. UI shows checkbox in feed composer + create-circle modal, and badges on cards.
- ✅ **City geocoding (free-text)** — Google Geocoding API (primary, key in `backend/.env`) → Open-Meteo (free fallback) → Nominatim (last resort). `POST /api/profile/city` resolves city → {city, country, lat, lng}. Wired into Onboarding step 4.
- ✅ **Noor Digest** — weekly Sunday reflection (`GET /api/noor/digest`). Generates a calm 4-sentence summary on-demand using Claude Sonnet 4.5, only from the user's own data (journal + tasbih + khidmah). Cached per ISO week with deterministic `generated_at` serialization. Home card on `/` → `/noor/digest` page with **"Save to journal"** button that drops the digest into the user's private journal with `noor-digest` tag — a quiet yearly mosaic of Sunday reflections.
- ✅ **My Sangat — spiritual passport** — `/sangat` page with Leaflet + OpenStreetMap map plotting the user's home city, home jamatkhana, and jamatkhanas near every circle they've joined. Stat tiles for tasbih streak, khidmah, circles, mentors. Backend: `GET /api/profile/sangat`.

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
