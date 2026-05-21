import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { useState } from "react";
import { RotateCcw, Flame, BookOpen, Sparkles } from "lucide-react";

export const Route = createFileRoute("/spiritual")({
  head: () => ({
    meta: [
      { title: "Spiritual — Tasbih.ai" },
      { name: "description", content: "Tasbih counter, reflections, duas, and journaling — your calm daily practice." },
    ],
  }),
  component: SpiritualPage,
});

const phrases = ["SubhānAllāh", "Alhamdulillāh", "Allāhu Akbar"];

function SpiritualPage() {
  const [count, setCount] = useState(33);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const target = 99;
  const pct = Math.min(count / target, 1);
  const circumference = 2 * Math.PI * 110;

  return (
    <MobileShell>
      <div className="relative min-h-screen">
        <NoorBackdrop />

        <header className="px-5 pt-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dhikr</p>
          <h1 className="mt-1 font-display text-2xl text-foreground">Tasbih</h1>
        </header>

        <section className="mt-6 flex flex-col items-center px-5">
          <p className="font-display text-xl text-primary">{phrases[phraseIdx]}</p>
          <button
            onClick={() => setPhraseIdx((i) => (i + 1) % phrases.length)}
            className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground"
          >
            Tap to change
          </button>

          <button
            onClick={() => setCount((c) => (c >= target ? c : c + 1))}
            className="relative mt-6 transition-transform active:scale-95"
            aria-label="Increment tasbih"
          >
            <svg width="260" height="260" viewBox="0 0 260 260" className="-rotate-90">
              <circle cx="130" cy="130" r="110" stroke="oklch(0.9 0.012 85)" strokeWidth="6" fill="none" />
              <circle
                cx="130"
                cy="130"
                r="110"
                stroke="url(#gold-stroke)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - pct)}
                className="transition-all duration-500"
              />
              <defs>
                <linearGradient id="gold-stroke" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="oklch(0.82 0.1 85)" />
                  <stop offset="100%" stopColor="oklch(0.45 0.08 160)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="noor-ring animate-breathe bg-emerald-gradient text-primary-foreground flex h-44 w-44 flex-col items-center justify-center rounded-full">
                <span className="font-display text-5xl">{count}</span>
                <span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-accent">of {target}</span>
              </div>
            </div>
          </button>

          <button
            onClick={() => setCount(0)}
            className="bg-secondary text-secondary-foreground mt-6 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </section>

        <section className="mt-8 px-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={Flame} value="14" label="Day streak" />
            <Stat icon={Sparkles} value="2.4k" label="Total dhikr" />
            <Stat icon={BookOpen} value="6" label="Reflections" />
          </div>
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-lg text-foreground">Today's Practice</h2>
          <div className="space-y-3">
            {practice.map((p) => (
              <div key={p.title} className="glass flex items-center gap-3 rounded-2xl p-4 shadow-soft">
                <div className="bg-gold-gradient flex h-10 w-10 items-center justify-center rounded-full">
                  <p.icon className="h-4 w-4 text-deep" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.sub}</p>
                </div>
                <span className="text-xs text-primary">{p.cta}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </MobileShell>
  );
}

function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) {
  return (
    <div className="glass rounded-2xl p-3.5 text-center shadow-soft">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-1.5 font-display text-lg text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

const practice = [
  { icon: BookOpen, title: "Surah Yāsīn reflection", sub: "5 min · AI summary", cta: "Read" },
  { icon: Sparkles, title: "Morning du'ā", sub: "Saved · Tap to play", cta: "Open" },
  { icon: Flame, title: "Evening journal", sub: "Prompt ready", cta: "Write" },
];
