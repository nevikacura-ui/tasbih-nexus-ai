import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Heart, Sparkles, Moon, Sun, Check } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

export default function QuranPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null); // selected reflection id

  useEffect(() => {
    (async () => {
      try { const r = await api.get("/quran/reflections"); setItems(r.data.reflections || []); } catch (e) {}
    })();
  }, []);

  const selected = items.find((i) => i.id === open);

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[480px]" data-testid="quran-page">
      <NoorBackdrop />
      <header className="flex items-center gap-3 px-5 pt-9">
        <Link to="/" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
          <ArrowLeft className="h-4 w-4 text-deep" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Reflect</p>
          <h1 className="font-display text-2xl text-deep">Qurʾan Reflections</h1>
        </div>
      </header>

      <p className="px-5 pt-3 text-[10px] text-deep/45">
        Reflective summaries — not rulings or tafsir. Read with your own heart.
      </p>

      <section className="mt-5 space-y-3 px-5 pb-10">
        {items.map((q) => (
          <article
            key={q.id}
            onClick={() => setOpen(q.id)}
            data-testid={`quran-card-${q.id}`}
            className="glass tap-scale cursor-pointer rounded-2xl p-4 shadow-soft"
          >
            <div className="flex items-start gap-3">
              <div className="bg-gold-gradient flex h-10 w-10 items-center justify-center rounded-full">
                <BookOpen className="h-4 w-4 text-deep" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">Surah {q.surah} · {q.ref}</p>
                <p className="mt-1 font-display text-lg text-deep">{q.theme}</p>
                <p className="mt-2 text-xs leading-relaxed text-deep/70 line-clamp-2">{q.summary}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      {selected && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-deep/30 backdrop-blur-sm" data-testid="quran-modal" onClick={() => setOpen(null)}>
          <div className="glass w-full max-w-[480px] rounded-t-[28px] p-5 shadow-elegant" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-deep/15" />
            <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">Surah {selected.surah} · {selected.ref}</p>
            <h2 className="mt-1 font-display text-2xl text-deep">{selected.theme}</h2>
            <p dir="rtl" className="mt-4 text-right text-lg leading-relaxed text-deep/90" style={{ fontFamily: "Fraunces, serif" }}>
              {selected.ar}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-deep/85">{selected.summary}</p>
            <div className="mt-4 rounded-2xl bg-sand/60 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-deep/55">A small invitation</p>
              <p className="mt-1 text-sm text-deep">{selected.invitation}</p>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setOpen(null)} data-testid="quran-close" className="flex-1 rounded-full bg-sand py-3 text-sm font-medium text-deep tap-scale">
                Close
              </button>
              <Link to="/noor" data-testid="quran-noor" onClick={() => setOpen(null)} className="bg-emerald-gradient text-ivory shadow-elegant flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-medium tap-scale">
                <Sparkles className="h-4 w-4" /> Reflect with Noor
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RamadanCard() {
  const [state, setState] = useState(null);
  useEffect(() => {
    (async () => { try { const r = await api.get("/ramadan/state"); setState(r.data); } catch (e) {} })();
  }, []);
  if (!state) return null;
  if (state.phase === "after") return null;

  return (
    <Link to="/ramadan" data-testid="ramadan-card" className="relative block overflow-hidden rounded-3xl shadow-elegant tap-scale">
      <div className="bg-emerald-gradient absolute inset-0" />
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gold/30 blur-3xl" />
      <div className="relative p-5 text-ivory">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gold">
          <Moon className="h-3.5 w-3.5" /> Ramadan {new Date().getFullYear() + (state.phase === "before" ? (state.days_until > 60 ? 1 : 0) : 0)}
        </div>
        {state.phase === "before" ? (
          <>
            <p className="mt-3 font-display text-2xl">{state.days_until} days to go</p>
            <p className="mt-1 text-xs text-ivory/75">Set intentions, soften the heart, prepare a quiet plan.</p>
          </>
        ) : (
          <>
            <p className="mt-3 font-display text-2xl">Day {state.day} of {state.total}</p>
            <p className="mt-1 text-xs text-ivory/75">A quiet log for today's fast →</p>
          </>
        )}
      </div>
    </Link>
  );
}

export function RamadanPage() {
  const [state, setState] = useState(null);
  const [busyDay, setBusyDay] = useState(null);

  const load = async () => {
    try { const r = await api.get("/ramadan/state"); setState(r.data); } catch (e) {}
  };
  useEffect(() => { load(); }, []);

  const logDay = async (day) => {
    setBusyDay(day);
    try { await api.post("/ramadan/log", { day }); await load(); } finally { setBusyDay(null); }
  };

  if (!state) return null;
  const logged = new Set(state.logged_days || []);

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[480px]" data-testid="ramadan-page">
      <NoorBackdrop />
      <header className="flex items-center gap-3 px-5 pt-9">
        <Link to="/" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
          <ArrowLeft className="h-4 w-4 text-deep" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Quiet month</p>
          <h1 className="font-display text-2xl text-deep">Ramadan</h1>
        </div>
      </header>

      <section className="mt-5 px-5">
        <div className="bg-emerald-gradient noor-ring text-ivory relative overflow-hidden rounded-3xl p-6 shadow-elegant" data-testid="ramadan-hero">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/30 blur-3xl" />
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gold">
            <Moon className="h-3.5 w-3.5" /> {state.phase === "during" ? `Day ${state.day} of ${state.total}` : state.phase === "before" ? `${state.days_until} days until` : "Recently passed"}
          </div>
          <p className="mt-3 font-display text-2xl leading-tight">
            {state.phase === "during"
              ? "A slow, gentle day."
              : state.phase === "before"
                ? "A month is approaching."
                : "Carry its softness forward."}
          </p>
          <p className="mt-2 text-xs text-ivory/75">
            Tasbih.ai's Ramadan tools are reflective — not rulings. Listen to your own heart and trusted guides.
          </p>
        </div>
      </section>

      <section className="mt-6 px-5">
        <h2 className="mb-3 font-display text-base text-deep">Daily log</h2>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: state.total }).map((_, i) => {
            const day = i + 1;
            const done = logged.has(day);
            const isToday = state.phase === "during" && state.day === day;
            return (
              <button
                key={day}
                disabled={busyDay === day || (state.phase === "before" && !done)}
                onClick={() => logDay(day)}
                data-testid={`ramadan-day-${day}`}
                className={`relative flex h-14 flex-col items-center justify-center rounded-2xl text-xs font-medium tap-scale ${
                  done
                    ? "bg-emerald-gradient text-ivory shadow-soft"
                    : isToday
                      ? "bg-gold-gradient text-deep shadow-glow"
                      : "glass text-deep shadow-soft"
                } disabled:opacity-50`}
              >
                {done && <Check className="absolute right-1 top-1 h-3 w-3" />}
                <span className="font-display text-base">{day}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] text-deep/45">
          Tap a day to mark a quiet log. We track for you, never for anyone else.
        </p>
      </section>

      <section className="mt-7 px-5 pb-10">
        <h2 className="mb-3 font-display text-base text-deep">Today's invitations</h2>
        <div className="space-y-2.5">
          <Tile icon={Sun} title="Suhoor intention" sub="One sentence — what is your fast for today?" />
          <Tile icon={Heart} title="Iftar gratitude" sub="Three quiet thank-yous before breaking the fast." />
          <Tile icon={Sparkles} title="Evening reflection" sub="A short ayah, a soft journal line." />
        </div>
      </section>
    </div>
  );
}

function Tile({ icon: Icon, title, sub }) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-4 shadow-soft">
      <div className="bg-gold-gradient flex h-10 w-10 items-center justify-center rounded-full">
        <Icon className="h-4 w-4 text-deep" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-deep">{title}</p>
        <p className="text-[11px] text-deep/55">{sub}</p>
      </div>
    </div>
  );
}
