import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, BookOpen, Heart, ArrowRight, Flame, Calendar, Users, HandHeart } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

export default function HomePage() {
  const { user } = useAuth();
  const [noor, setNoor] = useState(null);
  const [reflections, setReflections] = useState([]);
  const [tasbih, setTasbih] = useState({ today: 0, streak: 0, total: 0 });
  const [comms, setComms] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [n, r, t, c] = await Promise.all([
          api.get("/noor/today"),
          api.get("/reflections"),
          api.get("/tasbih/state"),
          api.get("/communities"),
        ]);
        setNoor(n.data);
        setReflections(r.data.reflections || []);
        setTasbih(t.data);
        setComms((c.data.communities || []).slice(0, 4));
      } catch (e) {}
    })();
  }, []);

  const firstName = (user?.name || "").split(" ")[0] || "Friend";

  return (
    <MobileShell>
      <div className="relative">
        <NoorBackdrop />

        <header className="px-5 pb-2 pt-9 animate-float-up" data-testid="home-greeting">
          <div className="flex items-center justify-between">
            <img src="/logo-wordmark.png" alt="Tasbih.ai" className="h-7 w-auto select-none" />
            <Link to="/profile" className="glass shadow-soft flex h-9 w-9 items-center justify-center rounded-full tap-scale" aria-label="Profile">
              <span className="bg-gold-gradient h-6 w-6 rounded-full text-deep flex items-center justify-center font-display text-xs">
                {firstName?.[0] || "G"}
              </span>
            </Link>
          </div>
          <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-deep/45">As-salāmu ʿalaykum</p>
          <h1 className="mt-1 font-display text-2xl font-medium text-deep">
            Welcome back, <span className="text-gold-gradient">{firstName}</span>
          </h1>
        </header>

        {/* NOOR OF THE DAY hero */}
        <section className="px-5 pt-5">
          <div className="relative overflow-hidden rounded-[28px] shadow-elegant" data-testid="noor-of-day">
            <div className="bg-emerald-gradient absolute inset-0" />
            <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-gold/30 blur-3xl" />
            <div className="absolute -bottom-16 -left-10 h-64 w-64 rounded-full bg-gold/15 blur-3xl" />
            {/* Mosque silhouette */}
            <svg className="absolute bottom-0 left-0 w-full opacity-[0.16]" viewBox="0 0 400 100" preserveAspectRatio="none">
              <path d="M0 100 L0 60 L40 60 L40 40 Q60 20 80 40 L80 60 L120 60 L120 50 L160 50 L160 30 Q180 10 200 30 L200 50 L240 50 L240 60 L280 60 L280 40 Q300 20 320 40 L320 60 L360 60 L360 70 L400 70 L400 100 Z"
                fill="#C9A46A"/>
            </svg>

            <div className="relative p-6 text-ivory">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gold">
                <Sparkles className="h-3.5 w-3.5" /> Noor of the Day
              </div>
              {noor?.verse_ar && (
                <p className="mt-4 text-right text-base leading-relaxed text-gold/95" dir="rtl" style={{ fontFamily: "Fraunces, serif" }}>
                  {noor.verse_ar}
                </p>
              )}
              <p className="mt-3 font-display text-[19px] leading-snug">
                {noor?.verse_en || "Loading reflection…"}
              </p>
              <p className="mt-2 text-xs text-ivory/70">{noor?.ref}</p>

              <div className="glass-dark mt-5 rounded-2xl p-3.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-gold">AI Reflection</p>
                <p className="mt-1.5 text-sm text-ivory/90">{noor?.reflection}</p>
                <Link
                  to="/noor"
                  data-testid="reflect-now-cta"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gold tap-scale"
                >
                  Reflect with Noor <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <p className="mt-3 text-[10px] text-ivory/45">
                Noor is a reflective companion, not a religious authority.
              </p>
            </div>
          </div>
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

        {/* Feature tiles */}
        <section className="mt-6 grid grid-cols-2 gap-3 px-5">
          <FeatureTile to="/events" icon={Calendar} title="Events" subtitle="Noor Night · Sat" tint="emerald" test="tile-events" />
          <FeatureTile to="/circles" icon={HandHeart} title="Volunteer" subtitle="3 drives nearby" tint="gold" test="tile-volunteer" />
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
