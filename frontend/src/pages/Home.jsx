import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, BookOpen, Heart, ArrowRight, Flame, Calendar, Users, HandHeart, Moon, Bell, Star } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { InstallAppButton } from "../components/InstallAppBanner";
import { RamadanCard } from "./Quran";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

export default function HomePage() {
  const { user } = useAuth();
  const [noor, setNoor] = useState(null);
  const [reflections, setReflections] = useState([]);
  const [tasbih, setTasbih] = useState({ today: 0, streak: 0, total: 0 });
  const [comms, setComms] = useState([]);
  const [unread, setUnread] = useState(0);
  const [nextEvent, setNextEvent] = useState(null);
  const [todayCal, setTodayCal] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fetchOnce = (url) => api.get(url);
      const fetchRetry = async (url, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try { return await fetchOnce(url); }
          catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, 400 * (i + 1)));
          }
        }
      };
      try {
        const [n, r, t, c, nt, ev, cal] = await Promise.all([
          fetchRetry("/noor/today").catch(() => ({ data: null })),
          api.get("/reflections").catch(() => ({ data: { reflections: [] } })),
          api.get("/tasbih/state").catch(() => ({ data: { today: 0, streak: 0, total: 0 } })),
          api.get("/communities").catch(() => ({ data: { communities: [] } })),
          api.get("/notifications").catch(() => ({ data: { unread: 0 } })),
          api.get("/events").catch(() => ({ data: { events: [] } })),
          api.get("/calendar/today").catch(() => ({ data: null })),
        ]);
        if (cancelled) return;
        setNoor(n.data);
        setReflections(r.data.reflections || []);
        setTasbih(t.data);
        setComms((c.data.communities || []).slice(0, 4));
        setUnread(nt.data.unread || 0);
        const evs = (ev.data?.events || []).filter((e) => new Date(e.date) >= new Date(new Date().setHours(0, 0, 0, 0)));
        setNextEvent(evs[0] || null);
        setTodayCal(cal.data || null);
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, []);

  const firstName = (user?.name || "").split(" ")[0] || "Friend";

  return (
    <MobileShell>
      <div className="relative">
        <NoorBackdrop />

        <header className="px-5 pb-2 pt-9 animate-float-up" data-testid="home-greeting">
          <div className="flex items-center justify-between">
            <img src="/logo-wordmark.png" alt="Tasbih.ai" className="h-12 w-auto select-none" />
            <div className="flex items-center gap-2">
              <Link to="/notifications" data-testid="home-bell" className="glass shadow-soft relative flex h-9 w-9 items-center justify-center rounded-full tap-scale">
                <Bell className="h-4 w-4 text-deep" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-gradient px-1 text-[9px] font-semibold text-deep" data-testid="home-bell-badge">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link to="/profile" className="glass shadow-soft flex h-9 w-9 items-center justify-center rounded-full tap-scale" aria-label="Profile">
                <span className="bg-gold-gradient h-6 w-6 rounded-full text-deep flex items-center justify-center font-display text-xs">
                  {firstName?.[0] || "G"}
                </span>
              </Link>
            </div>
          </div>
          <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-deep/45">Yā ʿAlī Madad</p>
          <h1 className="mt-1 font-display text-2xl font-medium text-deep">
            Welcome back, <span className="text-gold-gradient">{firstName}</span>
          </h1>
        </header>

        {/* NOOR OF THE DAY · premium hero */}
        <section className="px-5 pt-6" data-testid="noor-of-day-section">
          <div
            className="relative overflow-hidden rounded-[32px] shadow-elegant"
            style={{
              background:
                "linear-gradient(155deg, #07241F 0%, #0F3D36 38%, #1a5a4e 72%, #0a2a24 100%)",
            }}
            data-testid="noor-of-day"
          >
            {/* Layered light, dust, depth */}
            <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#E8C36A]/35 blur-[100px]" />
            <div className="absolute -bottom-20 -left-12 h-72 w-72 rounded-full bg-[#E8C36A]/15 blur-[80px]" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
              }}
            />
            {/* Tiny stars */}
            {[
              [40, 28], [120, 50], [320, 38], [70, 92], [200, 16], [280, 110],
            ].map(([x, y], i) => (
              <span
                key={i}
                className="absolute h-[2px] w-[2px] rounded-full bg-[#F4D88A]/70"
                style={{ left: `${x}px`, top: `${y}px`, boxShadow: "0 0 6px #F4D88A88" }}
                aria-hidden="true"
              />
            ))}
            {/* Refined jamatkhana silhouette */}
            <svg
              viewBox="0 0 400 120"
              preserveAspectRatio="xMidYMax slice"
              className="absolute inset-x-0 bottom-0 h-24 w-full opacity-[0.22]"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="nd-fade" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E8C36A" stopOpacity="0" />
                  <stop offset="100%" stopColor="#E8C36A" stopOpacity="0.8" />
                </linearGradient>
              </defs>
              {/* Left + right minarets */}
              <path d="M30,120 L30,52 Q33,46 33,42 Q33,34 30,30 Q27,34 27,42 Q27,46 30,52 Z M26,52 L34,52 L34,120 Z" fill="url(#nd-fade)" />
              <path d="M370,120 L370,52 Q373,46 373,42 Q373,34 370,30 Q367,34 367,42 Q367,46 370,52 Z M366,52 L374,52 L374,120 Z" fill="url(#nd-fade)" />
              {/* Side wings */}
              <path d="M60,120 L60,86 L130,86 L130,120 Z M270,120 L270,86 L340,120 Z" fill="url(#nd-fade)" />
              {/* Central dome + arch */}
              <path d="M140,120 L140,82 Q140,46 200,40 Q260,46 260,82 L260,120 Z" fill="url(#nd-fade)" />
              <circle cx="200" cy="36" r="2" fill="#E8C36A" opacity="0.9" />
              {/* Flanking sub-domes */}
              <path d="M85,120 L85,90 Q85,72 105,70 Q125,72 125,90 L125,120 Z" fill="url(#nd-fade)" />
              <path d="M275,120 L275,90 Q275,72 295,70 Q315,72 315,90 L315,120 Z" fill="url(#nd-fade)" />
            </svg>

            <div className="relative px-7 pb-7 pt-6 text-ivory">
              {/* Eyebrow */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#F4D88A]">
                  <Sparkles className="h-3.5 w-3.5" /> Noor of the Day
                </div>
                <span className="text-[10px] uppercase tracking-[0.22em] text-ivory/45">
                  {new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
                </span>
              </div>

              {/* Arabic — large, golden, with subtle glow */}
              {noor?.verse_ar && (
                <p
                  dir="rtl"
                  className="mt-7 text-right leading-[1.85]"
                  style={{
                    fontFamily: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif",
                    fontSize: "clamp(20px, 5.4vw, 28px)",
                    color: "#F4D88A",
                    textShadow: "0 2px 20px rgba(232,195,106,0.35)",
                  }}
                  data-testid="noor-arabic"
                >
                  {noor.verse_ar}
                </p>
              )}

              {/* Gold rule */}
              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(232,195,106,0.6) 50%, transparent 100%)" }} />
                <span className="text-[8px] uppercase tracking-[0.32em] text-[#E8C36A]/65">verse</span>
                <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(232,195,106,0.6) 50%, transparent 100%)" }} />
              </div>

              {/* English — display serif */}
              <p
                className="font-display leading-[1.28]"
                style={{ fontSize: "clamp(20px, 5.6vw, 26px)", textShadow: "0 2px 18px rgba(0,0,0,0.35)" }}
                data-testid="noor-english"
              >
                {noor?.verse_en || "Loading reflection…"}
              </p>
              <p className="mt-2 text-[11px] tracking-wide text-[#E8C36A]/75">{noor?.ref}</p>

              {/* Reflection — glass card */}
              <div
                className="mt-6 rounded-2xl border border-[#E8C36A]/20 bg-black/30 p-4 backdrop-blur-md"
                data-testid="noor-reflection"
              >
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#F4D88A]">
                  AI Reflection
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-ivory/90">
                  {noor?.reflection || "A gentle thought is on its way."}
                </p>
                <Link
                  to="/noor"
                  data-testid="reflect-now-cta"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#E8C36A]/40 bg-[#E8C36A]/10 px-4 py-2 text-xs font-medium text-[#F4D88A] backdrop-blur-md tap-scale"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Reflect with Noor
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <p className="mt-4 text-center text-[10px] italic text-ivory/40">
                Noor is a reflective companion, not a religious authority.
              </p>
            </div>
          </div>
        </section>

        {/* Noor Digest — weekly Sunday reflection */}
        <section className="mt-5 px-5">
          <Link to="/noor/digest" data-testid="home-digest-card" className="glass tap-scale block rounded-2xl p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="bg-gold-gradient flex h-10 w-10 items-center justify-center rounded-full">
                <Sparkles className="h-4 w-4 text-deep" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-[0.22em] text-gold">Sunday reflection</p>
                <p className="text-sm font-medium text-deep">Your Noor Digest is ready</p>
                <p className="text-[11px] text-deep/55">A gentle 4-sentence summary of your week</p>
              </div>
              <ArrowRight className="h-4 w-4 text-deep/45" />
            </div>
          </Link>
        </section>

        {/* Rituals */}
        <section className="mt-6 px-5">
          <div className="grid grid-cols-3 gap-3">
            <RitualCard to="/tasbih" icon={Sparkles} label="Tasbih" value={String(tasbih?.today ?? 0)} test="ritual-tasbih" />
            <RitualCard to="/tasbih" icon={Flame} label="Streak" value={`${tasbih?.streak ?? 0}d`} test="ritual-streak" />
            <RitualCard to="/journal" icon={BookOpen} label="Journal" value="New" test="ritual-journal" />
          </div>
        </section>

        {/* Next prayer breathing */}
        <section className="mt-5 px-5">
          <div className="glass block rounded-3xl p-5 shadow-soft" data-testid="next-prayer-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-deep/45">Next moment</p>
                <p className="mt-1 font-display text-xl text-deep">Maghrib</p>
                <p className="text-xs text-deep/55">soft reminder in 2h 14m</p>
                <p className="mt-2 text-[11px] font-medium text-deep/75">Tap to breathe with the ring →</p>
              </div>
              <div className="relative h-16 w-16">
                <div className="noor-ring animate-breathe absolute inset-0 rounded-full" />
                <div className="bg-gold-gradient absolute inset-2 rounded-full opacity-90" />
              </div>
            </div>
          </div>
        </section>

        {/* Circles strip */}
        <section className="mt-7 px-5">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-lg text-deep">Your Circles</h2>
            <Link to="/circles" className="text-xs font-medium text-deep/70" data-testid="see-all-circles">See all</Link>
          </div>
          <div className="-mx-5 flex gap-3 overflow-x-auto no-scrollbar px-5 pb-2">
            {comms.map((c) => (
              <div key={c.community_id} className="glass min-w-[210px] rounded-2xl p-4 shadow-soft" data-testid={`home-circle-${c.community_id}`}>
                <div className="bg-emerald-gradient mb-3 flex h-10 w-10 items-center justify-center rounded-full">
                  <Users className="h-5 w-5 text-gold" />
                </div>
                <p className="text-sm font-medium text-deep">{c.name}</p>
                <p className="mt-0.5 text-xs text-deep/55">{c.members} members · {c.city}</p>
                <p className="mt-3 line-clamp-2 text-xs text-deep/70">{c.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Today on the calendar */}
        {todayCal?.upcoming?.length > 0 && (
          <section className="mt-5 px-5">
            <Link to="/calendar" data-testid="home-calendar-strip" className="glass tap-scale flex items-center gap-3 rounded-2xl p-3.5 shadow-soft">
              <div className="bg-emerald-gradient flex h-10 w-10 items-center justify-center rounded-full">
                <Calendar className="h-4 w-4 text-gold" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-[0.22em] text-gold">On the calendar</p>
                <p className="text-sm font-medium text-deep">{todayCal.upcoming[0].title}</p>
                <p className="text-[11px] text-deep/55">{todayCal.upcoming[0].date}{todayCal.hijri ? ` · ${todayCal.hijri.day} ${todayCal.hijri.month_name}` : ""}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-deep/45" />
            </Link>
          </section>
        )}

        {/* Feature tiles */}
        <section className="mt-6 grid grid-cols-2 gap-3 px-5">
          <FeatureTile
            to="/events"
            icon={Calendar}
            title="Events"
            subtitle={nextEvent ? `${nextEvent.title}` : "No upcoming yet"}
            tint="emerald"
            test="tile-events"
          />
          <FeatureTile
            to="/khidmah"
            icon={HandHeart}
            title="Khidmah"
            subtitle="Soft recognition"
            tint="gold"
            test="tile-volunteer"
          />
        </section>

        {/* Noor Reflections */}
        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-lg text-deep">Noor Reflections</h2>
          <div className="space-y-3">
            {reflections.map((r) => (
              <article key={r.reflection_id} className="glass rounded-2xl p-4 shadow-soft" data-testid={`reflection-${r.reflection_id}`}>
                <div className="flex items-center gap-2.5">
                  <div className="bg-gold-gradient text-deep flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold">
                    {r.author?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-deep">{r.author}</p>
                    <p className="text-[10px] uppercase tracking-wider text-deep/45">{r.circle}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-deep/85">{r.text}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-deep/50">
                  <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {r.likes}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Quiet credit — a small thank-you to the curators */}
        <section className="mt-10 px-5 pb-2" data-testid="home-credit-section">
          <div className="mx-auto max-w-xs text-center">
            <div className="mx-auto mb-5 flex justify-center">
              <InstallAppButton testId="home-install-app-btn" />
            </div>
            <div className="mx-auto h-px w-12 bg-gradient-to-r from-transparent via-deep/20 to-transparent" />
            <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-deep/40">
              Curated with care
            </p>
            <p
              className="mt-2 text-[11px] leading-relaxed text-deep/55"
              data-testid="home-credit"
            >
              <strong className="text-deep/70">Naushad &amp; Shabnam Patel</strong>
              <br />
              Andheri Jamatkhana · Mumbai · India
            </p>
          </div>
        </section>
      </div>
    </MobileShell>
  );
}

function RitualCard({ icon: Icon, label, value, to, test }) {
  return (
    <Link to={to} data-testid={test} className="glass tap-scale flex flex-col items-start gap-2 rounded-2xl p-3.5 shadow-soft">
      <span className="bg-emerald-gradient flex h-8 w-8 items-center justify-center rounded-full">
        <Icon className="h-4 w-4 text-gold" />
      </span>
      <div>
        <p className="font-display text-base text-deep">{value}</p>
        <p className="text-[10px] uppercase tracking-wider text-deep/45">{label}</p>
      </div>
    </Link>
  );
}

function FeatureTile({ to, icon: Icon, title, subtitle, tint, test }) {
  return (
    <Link
      to={to}
      data-testid={test}
      className={`relative overflow-hidden rounded-2xl p-4 shadow-soft tap-scale ${
        tint === "emerald" ? "bg-emerald-gradient text-ivory" : "bg-gold-gradient text-deep"
      }`}
    >
      <Icon className="h-5 w-5 opacity-90" />
      <p className="mt-6 font-display text-lg">{title}</p>
      <p className="text-xs opacity-80">{subtitle}</p>
    </Link>
  );
}
