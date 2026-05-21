import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, Heart, BookOpen, HandHeart, Users, Leaf } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const GOALS = [
  { id: "reflect", label: "Daily reflection", icon: Sparkles },
  { id: "dhikr",   label: "Tasbih & dhikr",  icon: Leaf },
  { id: "journal", label: "Journaling",      icon: BookOpen },
  { id: "calm",    label: "Inner calm",      icon: Heart },
  { id: "seva",    label: "Volunteering",    icon: HandHeart },
  { id: "circles", label: "Community circles", icon: Users },
];

const MOODS = [
  { id: "calm", label: "Calm", tint: "bg-emerald-gradient" },
  { id: "seeking", label: "Seeking", tint: "bg-gold-gradient" },
  { id: "grateful", label: "Grateful", tint: "bg-emerald-gradient" },
  { id: "heavy", label: "Heavy", tint: "bg-gold-gradient" },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState([]);
  const [mood, setMood] = useState(null);
  const [city, setCity] = useState("");

  const toggleGoal = (id) =>
    setGoals((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const finish = async () => {
    sessionStorage.setItem("tasbih_onboarding", JSON.stringify({ goals, mood, city }));
    if (city && city.trim().length >= 2) {
      try { await api.post("/profile/city", { city: city.trim() }); } catch (_) {}
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-6 py-10">
      <NoorBackdrop />
      <header className="animate-float-up">
        <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Step {step + 1} of 4</p>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-deep/10">
          <div
            className="h-full bg-gold-gradient transition-all duration-500"
            style={{ width: `${((step + 1) / 4) * 100}%` }}
          />
        </div>
      </header>

      <section className="mt-10 flex-1">
        {step === 0 && (
          <div className="animate-float-up" data-testid="onb-welcome">
            <div className="mx-auto mb-8 h-24 w-24 rounded-full bg-gold-gradient noor-ring animate-breathe shadow-glow" />
            <h1 className="font-display text-3xl leading-tight text-deep">
              A quiet space, <br/>made for your <span className="text-gold-gradient">Noor</span>.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-deep/65">
              Tasbih.ai is your independent AI-powered companion for reflection, dhikr,
              and meaningful community — never a religious authority, always a calm friend.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="animate-float-up" data-testid="onb-goals">
            <h2 className="font-display text-2xl text-deep">What feels meaningful right now?</h2>
            <p className="mt-2 text-sm text-deep/60">Pick a few. We'll quietly shape your journey.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {GOALS.map((g) => {
                const Icon = g.icon;
                const active = goals.includes(g.id);
                return (
                  <button
                    key={g.id}
                    data-testid={`goal-${g.id}`}
                    onClick={() => toggleGoal(g.id)}
                    className={`glass tap-scale rounded-2xl p-4 text-left transition-all ${
                      active ? "ring-2 ring-gold shadow-glow" : "shadow-soft"
                    }`}
                  >
                    <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${active ? "bg-emerald-gradient" : "bg-sand"}`}>
                      <Icon className={`h-4 w-4 ${active ? "text-gold" : "text-deep"}`} />
                    </span>
                    <p className="text-sm font-medium text-deep">{g.label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-float-up" data-testid="onb-mood">
            <h2 className="font-display text-2xl text-deep">How is your heart today?</h2>
            <p className="mt-2 text-sm text-deep/60">No wrong answer. We'll meet you here.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {MOODS.map((m) => {
                const active = mood === m.id;
                return (
                  <button
                    key={m.id}
                    data-testid={`mood-${m.id}`}
                    onClick={() => setMood(m.id)}
                    className={`rounded-3xl p-6 text-left font-display text-xl tap-scale transition-all ${
                      active
                        ? `${m.tint} text-ivory shadow-elegant`
                        : "glass text-deep shadow-soft"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-float-up" data-testid="onb-city">
            <h2 className="font-display text-2xl text-deep">Where are you reflecting from?</h2>
            <p className="mt-2 text-sm text-deep/60">
              We'll quietly surface circles and events near you. Skip if you prefer.
            </p>
            <input
              data-testid="onb-city-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City — e.g. Toronto"
              className="mt-6 w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-3.5 text-sm outline-none focus:border-gold"
            />
            <div className="mt-8 glass rounded-2xl p-4 shadow-soft">
              <p className="text-[11px] uppercase tracking-[0.18em] text-deep/45">A gentle note</p>
              <p className="mt-1 text-xs leading-relaxed text-deep/65">
                Tasbih.ai is independent and community-driven. We never give fatwas, theological rulings,
                or speak on behalf of any institution. Noor is here to reflect with you — not to instruct you.
              </p>
            </div>
          </div>
        )}
      </section>

      <footer className="space-y-3 pb-2">
        {step < 3 ? (
          <button
            data-testid="onb-next"
            onClick={next}
            className="bg-emerald-gradient text-ivory shadow-elegant flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium tap-scale"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            data-testid="onb-finish"
            onClick={finish}
            className="bg-emerald-gradient text-ivory shadow-elegant flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium tap-scale"
          >
            Enter Tasbih.ai <ArrowRight className="h-4 w-4" />
          </button>
        )}
        <button
          data-testid="onb-skip"
          onClick={finish}
          className="block w-full text-center text-xs text-deep/45"
        >
          Skip for now
        </button>
      </footer>
    </div>
  );
}
