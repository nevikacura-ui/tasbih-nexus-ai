import React, { useEffect, useState } from "react";
import { RotateCcw, Flame, BookOpen, Sparkles } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const PHRASES = [
  { ar: "سُبْحَانَ ٱللَّٰه", tr: "SubḥānAllāh" },
  { ar: "ٱلْحَمْدُ لِلَّٰه",  tr: "Alḥamdulillāh" },
  { ar: "ٱللَّٰهُ أَكْبَر",   tr: "Allāhu Akbar" },
];

export default function TasbihPage() {
  const target = 99;
  const [count, setCount] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [state, setState] = useState({ today: 0, streak: 0, total: 0 });

  useEffect(() => { (async () => {
    try { const r = await api.get("/tasbih/state"); setState(r.data); } catch (e) {}
  })(); }, []);

  const pct = Math.min(count / target, 1);
  const circumference = 2 * Math.PI * 110;
  const phrase = PHRASES[phraseIdx];

  const persist = async (c) => {
    try {
      const r = await api.post("/tasbih/record", { phrase: phrase.tr, count: c, target });
      setState((s) => ({ ...s, total: r.data.total, streak: r.data.streak, today: (s.today || 0) + c }));
    } catch (e) {}
  };

  const onTap = () => {
    setCount((c) => {
      if (c + 1 >= target) {
        persist(target - c); // final increment of the cycle
        return target;
      }
      const next = c + 1;
      if (navigator.vibrate) navigator.vibrate(8);
      return next;
    });
  };

  const reset = () => {
    if (count > 0 && count < target) persist(count);
    setCount(0);
  };

  return (
    <MobileShell>
      <div className="relative min-h-screen" data-testid="tasbih-page">
        <NoorBackdrop />

        <header className="px-5 pt-9">
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Dhikr</p>
          <h1 className="mt-1 font-display text-2xl text-deep">Tasbih</h1>
        </header>

        <section className="mt-6 flex flex-col items-center px-5">
          <button
            onClick={() => setPhraseIdx((i) => (i + 1) % PHRASES.length)}
            className="text-center"
            data-testid="tasbih-phrase"
          >
            <p dir="rtl" className="font-display text-2xl text-deep">{phrase.ar}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-deep/55">{phrase.tr} · tap to change</p>
          </button>

          <button
            onClick={onTap}
            data-testid="tasbih-counter-btn"
            className="relative mt-6 tap-scale"
            aria-label="Increment tasbih"
          >
            <svg width="280" height="280" viewBox="0 0 280 280" className="-rotate-90">
              <circle cx="140" cy="140" r="110" stroke="rgba(15,61,54,0.10)" strokeWidth="6" fill="none" />
              <circle
                cx="140" cy="140" r="110"
                stroke="url(#gold-stroke)" strokeWidth="6" fill="none" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - pct)}
                className="transition-all duration-500"
              />
              <defs>
                <linearGradient id="gold-stroke" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#E1C089" />
                  <stop offset="100%" stopColor="#0F3D36" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="noor-ring animate-breathe bg-emerald-gradient text-ivory flex h-48 w-48 flex-col items-center justify-center rounded-full">
                <span className="font-display text-5xl" data-testid="tasbih-count">{count}</span>
                <span className="mt-1 text-[10px] uppercase tracking-[0.22em] text-gold">of {target}</span>
              </div>
            </div>
          </button>

          <button
            onClick={reset}
            data-testid="tasbih-reset"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-sand px-4 py-2 text-xs font-medium text-deep tap-scale"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </section>

        <section className="mt-8 px-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={Flame}     value={String(state.streak ?? 0)} label="Day streak" />
            <Stat icon={Sparkles}  value={String(state.total ?? 0)}  label="Total dhikr" />
            <Stat icon={BookOpen}  value={String(state.today ?? 0)}  label="Today" />
          </div>
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-lg text-deep">Today's Practice</h2>
          <div className="space-y-3">
            <PracticeRow icon={BookOpen} title="A short Qurʾanic reflection" sub="2 min · gentle read" cta="Read" />
            <PracticeRow icon={Sparkles} title="Morning duʿā" sub="Saved · tap to play" cta="Open" />
            <PracticeRow icon={Flame} title="Evening journal" sub="Prompt ready" cta="Write" />
          </div>
          <p className="mt-4 text-[10px] text-deep/45">
            Practices are reflective suggestions — not religious rulings.
          </p>
        </section>
      </div>
    </MobileShell>
  );
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="glass rounded-2xl p-3.5 text-center shadow-soft">
      <Icon className="mx-auto h-4 w-4 text-deep" />
      <p className="mt-1.5 font-display text-lg text-deep">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-deep/45">{label}</p>
    </div>
  );
}

function PracticeRow({ icon: Icon, title, sub, cta }) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-4 shadow-soft">
      <div className="bg-gold-gradient flex h-10 w-10 items-center justify-center rounded-full">
        <Icon className="h-4 w-4 text-deep" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-deep">{title}</p>
        <p className="text-xs text-deep/55">{sub}</p>
      </div>
      <span className="text-xs text-deep">{cta}</span>
    </div>
  );
}
