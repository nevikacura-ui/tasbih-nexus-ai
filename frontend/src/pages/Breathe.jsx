import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { nextPrayer, formatGap } from "../lib/prayerTimes";

// 4-4-4-4 box-breathing cycle (16 s) — gentle and beginner-friendly.
const CYCLE = [
  { phase: "Inhale",  seconds: 4 },
  { phase: "Hold",    seconds: 4 },
  { phase: "Exhale",  seconds: 4 },
  { phase: "Rest",    seconds: 4 },
];
const CYCLE_TOTAL = CYCLE.reduce((a, b) => a + b.seconds, 0);

export default function BreathePage() {
  const [now, setNow] = useState(() => new Date());
  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(0); // seconds into the current cycle
  const [cycles, setCycles] = useState(0);
  const startRef = useRef(performance.now());
  const baseRef = useRef(0); // accumulated seconds at last pause

  // 1s tick for clock + countdown
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Breathing animation engine — runs at ~20 FPS, drives `elapsed` smoothly.
  useEffect(() => {
    if (!running) {
      baseRef.current = elapsed;
      return;
    }
    startRef.current = performance.now();
    let raf;
    const tick = () => {
      const dt = (performance.now() - startRef.current) / 1000;
      const total = baseRef.current + dt;
      const cyc = Math.floor(total / CYCLE_TOTAL);
      const rem = total - cyc * CYCLE_TOTAL;
      setElapsed(rem);
      setCycles(cyc);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Compute current phase + scale of the ring
  const { phaseLabel, phaseSecondsLeft, scale } = useMemo(() => {
    let acc = 0;
    for (let i = 0; i < CYCLE.length; i++) {
      const seg = CYCLE[i];
      if (elapsed < acc + seg.seconds) {
        const within = elapsed - acc;
        const t = within / seg.seconds; // 0..1
        // Smooth scale: inhale 0.6 → 1.0, hold 1.0, exhale 1.0 → 0.6, rest 0.6
        let s = 0.6;
        if (seg.phase === "Inhale") s = 0.6 + 0.4 * easeInOut(t);
        else if (seg.phase === "Hold") s = 1.0;
        else if (seg.phase === "Exhale") s = 1.0 - 0.4 * easeInOut(t);
        else s = 0.6;
        return {
          phaseLabel: seg.phase,
          phaseSecondsLeft: Math.max(1, Math.ceil(seg.seconds - within)),
          scale: s,
        };
      }
      acc += seg.seconds;
    }
    return { phaseLabel: "Inhale", phaseSecondsLeft: 4, scale: 0.6 };
  }, [elapsed]);

  const next = useMemo(() => nextPrayer(now), [now]);
  const gap = formatGap(next.at, now);

  return (
    <div className="relative min-h-[100svh] bg-ivory text-deep" data-testid="breathe-page">
      <NoorBackdrop />
      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[480px] flex-col px-6 pb-10 pt-5">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link
            to="/"
            data-testid="breathe-back"
            aria-label="Back to Home"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-deep/10 bg-ivory/70 shadow-soft tap-scale"
          >
            <ArrowLeft className="h-4 w-4 text-deep" />
          </Link>
          <p className="text-[10px] uppercase tracking-[0.28em] text-deep/55">Breathe with the ring</p>
          <div className="w-10" />
        </header>

        {/* Next prayer card */}
        <section className="mt-6 text-center">
          <p className="text-[10px] uppercase tracking-[0.28em] text-gold">
            {next.isTomorrow ? "Tomorrow's first light" : "Next moment"}
          </p>
          <h1
            className="mt-2 font-display leading-tight text-deep"
            style={{ fontSize: "clamp(34px, 9vw, 48px)" }}
            data-testid="breathe-prayer-name"
          >
            {next.label}
          </h1>
          <p className="mt-1 text-sm text-deep/65">
            {next.note} · in <span data-testid="breathe-gap" className="font-medium text-deep">{gap}</span>
          </p>
        </section>

        {/* Breathing ring — fills the visual centre */}
        <section className="relative flex flex-1 items-center justify-center py-6">
          <div className="relative h-[280px] w-[280px]">
            {/* Outer halo */}
            <div
              className="bg-noor absolute inset-0 rounded-full blur-2xl"
              style={{ opacity: 0.55 + scale * 0.35, transform: `scale(${0.85 + scale * 0.25})` }}
              aria-hidden="true"
            />
            {/* Outer ring */}
            <div
              className="absolute inset-0 rounded-full border border-gold/40"
              style={{ transform: `scale(${0.6 + scale * 0.4})`, transition: "transform 80ms linear" }}
              aria-hidden="true"
            />
            {/* Inner emerald orb */}
            <div
              className="bg-emerald-gradient absolute inset-8 rounded-full shadow-glow"
              style={{ transform: `scale(${scale})`, transition: "transform 80ms linear" }}
              aria-hidden="true"
            />
            {/* Centred text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p
                className="text-[10px] uppercase tracking-[0.32em] text-ivory/80"
                data-testid="breathe-phase"
              >
                {phaseLabel}
              </p>
              <p className="mt-1 font-display text-5xl leading-none text-ivory" data-testid="breathe-count">
                {phaseSecondsLeft}
              </p>
            </div>
          </div>
        </section>

        {/* Cycles + play/pause */}
        <section className="mt-2 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Cycles</p>
            <p className="font-display text-2xl text-deep" data-testid="breathe-cycles">{cycles}</p>
          </div>

          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            data-testid="breathe-toggle"
            aria-label={running ? "Pause breathing" : "Resume breathing"}
            className="bg-emerald-gradient text-ivory shadow-elegant flex h-14 w-14 items-center justify-center rounded-full tap-scale"
          >
            {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}
          </button>

          <div className="w-[60px] text-right">
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Box</p>
            <p className="font-display text-2xl text-deep">4·4·4·4</p>
          </div>
        </section>

        <p className="mt-6 px-2 text-center text-[11px] leading-relaxed text-deep/50">
          A gentle box-breath: inhale for four, hold for four, exhale for four, rest for four. Stay as long as feels kind.
        </p>
      </div>
    </div>
  );
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Local helpers removed — now imported from /app/frontend/src/lib/prayerTimes.js
