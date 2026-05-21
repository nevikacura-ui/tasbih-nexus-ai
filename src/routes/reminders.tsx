import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { useEffect, useState } from "react";
import { Bell, Moon, Sun, Sunrise, Sunset, Sparkles, Flame, BookOpen, Volume2, VolumeX, Check } from "lucide-react";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "Reminders — Tasbih.ai" },
      { name: "description", content: "Customize prayer reminders and calm daily notifications to keep your streak." },
    ],
  }),
  component: RemindersPage,
});

type Prayer = {
  key: string;
  name: string;
  icon: typeof Sun;
  time: string;
  enabled: boolean;
  lead: number; // minutes before
};

type Cadence = "gentle" | "balanced" | "frequent";
type Tone = "noor-chime" | "soft-bell" | "whisper" | "silent";

const STORAGE_KEY = "tasbih.reminders.v1";

const defaultPrayers: Prayer[] = [
  { key: "fajr", name: "Fajr", icon: Sunrise, time: "05:12", enabled: true, lead: 10 },
  { key: "dhuhr", name: "Dhuhr", icon: Sun, time: "12:48", enabled: true, lead: 5 },
  { key: "asr", name: "Asr", icon: Sun, time: "15:56", enabled: true, lead: 5 },
  { key: "maghrib", name: "Maghrib", icon: Sunset, time: "17:42", enabled: true, lead: 0 },
  { key: "isha", name: "Isha", icon: Moon, time: "19:14", enabled: false, lead: 10 },
];

type DailyReminder = { key: string; label: string; sub: string; icon: typeof Sparkles; time: string; enabled: boolean };

const defaultDaily: DailyReminder[] = [
  { key: "tasbih", label: "Evening Tasbih", sub: "Protect your streak", icon: Sparkles, time: "20:30", enabled: true },
  { key: "journal", label: "Noor Journal", sub: "One ayah · one thought", icon: BookOpen, time: "21:30", enabled: true },
  { key: "streak", label: "Streak Guard", sub: "Quiet nudge if you forget", icon: Flame, time: "22:45", enabled: true },
];

function RemindersPage() {
  const [prayers, setPrayers] = useState<Prayer[]>(defaultPrayers);
  const [daily, setDaily] = useState<DailyReminder[]>(defaultDaily);
  const [cadence, setCadence] = useState<Cadence>("gentle");
  const [tone, setTone] = useState<Tone>("noor-chime");
  const [quiet, setQuiet] = useState({ from: "22:00", to: "05:00", enabled: true });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.prayers) setPrayers(s.prayers);
      if (s.daily) setDaily(s.daily);
      if (s.cadence) setCadence(s.cadence);
      if (s.tone) setTone(s.tone);
      if (s.quiet) setQuiet(s.quiet);
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ prayers, daily, cadence, tone, quiet }),
      );
      setSaved(true);
      const id = setTimeout(() => setSaved(false), 1400);
      return () => clearTimeout(id);
    }, 250);
    return () => clearTimeout(t);
  }, [prayers, daily, cadence, tone, quiet]);

  const activePrayers = prayers.filter((p) => p.enabled).length;
  const activeDaily = daily.filter((d) => d.enabled).length;

  return (
    <MobileShell>
      <div className="relative">
        <NoorBackdrop />

        <header className="px-5 pt-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Settings</p>
          <h1 className="mt-1 font-display text-2xl text-foreground">Reminders & Noor Nudges</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Calm, customizable notifications to help you stay present and protect your streak.
          </p>
        </header>

        <section className="mt-5 px-5">
          <div className="bg-emerald-gradient text-primary-foreground shadow-elegant relative overflow-hidden rounded-3xl p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-accent">
              <Bell className="h-3.5 w-3.5" /> Today
            </div>
            <p className="mt-3 font-display text-[19px] leading-snug">
              {activePrayers} prayer reminders · {activeDaily} daily nudges
            </p>
            <p className="mt-1 text-xs text-primary-foreground/70">
              Quiet hours {quiet.enabled ? `${quiet.from} – ${quiet.to}` : "off"} · {cadence} cadence
            </p>
            <div
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider transition-opacity ${
                saved ? "bg-accent/20 text-accent opacity-100" : "opacity-0"
              }`}
            >
              <Check className="h-3 w-3" /> Saved
            </div>
          </div>
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-lg text-foreground">Prayer Reminders</h2>
          <div className="space-y-2.5">
            {prayers.map((p, idx) => (
              <div key={p.key} className="glass rounded-2xl p-4 shadow-soft">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                      p.enabled ? "bg-gold-gradient text-deep" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <p.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.enabled ? `Notify ${p.lead === 0 ? "at adhan" : `${p.lead} min before`}` : "Off"}
                    </p>
                  </div>
                  <Toggle
                    on={p.enabled}
                    onChange={(v) =>
                      setPrayers((arr) => arr.map((x, i) => (i === idx ? { ...x, enabled: v } : x)))
                    }
                  />
                </div>
                {p.enabled && (
                  <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={p.time}
                        onChange={(e) =>
                          setPrayers((arr) =>
                            arr.map((x, i) => (i === idx ? { ...x, time: e.target.value } : x)),
                          )
                        }
                        className="bg-secondary/70 text-foreground rounded-full px-3 py-1.5 text-xs focus:outline-none"
                      />
                      <div className="flex gap-1">
                        {[0, 5, 10, 15].map((m) => (
                          <button
                            key={m}
                            onClick={() =>
                              setPrayers((arr) =>
                                arr.map((x, i) => (i === idx ? { ...x, lead: m } : x)),
                              )
                            }
                            className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
                              p.lead === m
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary/70 text-muted-foreground"
                            }`}
                          >
                            {m === 0 ? "On time" : `−${m}m`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-lg text-foreground">Daily Noor Nudges</h2>
          <div className="space-y-2.5">
            {daily.map((d, idx) => (
              <div key={d.key} className="glass flex items-center gap-3 rounded-2xl p-4 shadow-soft">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    d.enabled ? "bg-emerald-gradient text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <d.icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{d.label}</p>
                  <p className="text-[11px] text-muted-foreground">{d.sub}</p>
                </div>
                <input
                  type="time"
                  value={d.time}
                  disabled={!d.enabled}
                  onChange={(e) =>
                    setDaily((arr) => arr.map((x, i) => (i === idx ? { ...x, time: e.target.value } : x)))
                  }
                  className="bg-secondary/70 text-foreground rounded-full px-3 py-1.5 text-xs focus:outline-none disabled:opacity-50"
                />
                <Toggle
                  on={d.enabled}
                  onChange={(v) =>
                    setDaily((arr) => arr.map((x, i) => (i === idx ? { ...x, enabled: v } : x)))
                  }
                />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-lg text-foreground">Calm Cadence</h2>
          <div className="glass rounded-2xl p-2 shadow-soft">
            <div className="grid grid-cols-3 gap-1">
              {(["gentle", "balanced", "frequent"] as Cadence[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCadence(c)}
                  className={`rounded-xl px-3 py-2 text-xs font-medium capitalize transition-all ${
                    cadence === c
                      ? "bg-emerald-gradient text-primary-foreground shadow-glow"
                      : "text-muted-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            {cadence === "gentle" && "Minimum interruption — only essentials and streak protection."}
            {cadence === "balanced" && "A steady rhythm of reminders throughout your day."}
            {cadence === "frequent" && "More nudges for deepening practice and habit building."}
          </p>
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-lg text-foreground">Notification Tone</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                { k: "noor-chime", label: "Noor Chime", icon: Sparkles },
                { k: "soft-bell", label: "Soft Bell", icon: Bell },
                { k: "whisper", label: "Whisper", icon: Volume2 },
                { k: "silent", label: "Silent", icon: VolumeX },
              ] as { k: Tone; label: string; icon: typeof Bell }[]
            ).map((t) => (
              <button
                key={t.k}
                onClick={() => setTone(t.k)}
                className={`glass flex items-center gap-2.5 rounded-2xl p-3.5 text-left transition-all ${
                  tone === t.k ? "ring-primary/60 shadow-glow ring-2" : ""
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    tone === t.k ? "bg-gold-gradient text-deep" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-foreground">{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-lg text-foreground">Quiet Hours</h2>
          <div className="glass rounded-2xl p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="bg-secondary text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full">
                <Moon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Pause notifications</p>
                <p className="text-[11px] text-muted-foreground">Only Fajr will still reach you.</p>
              </div>
              <Toggle on={quiet.enabled} onChange={(v) => setQuiet((q) => ({ ...q, enabled: v }))} />
            </div>
            {quiet.enabled && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span>From</span>
                <input
                  type="time"
                  value={quiet.from}
                  onChange={(e) => setQuiet((q) => ({ ...q, from: e.target.value }))}
                  className="bg-secondary/70 text-foreground rounded-full px-3 py-1.5 focus:outline-none"
                />
                <span>to</span>
                <input
                  type="time"
                  value={quiet.to}
                  onChange={(e) => setQuiet((q) => ({ ...q, to: e.target.value }))}
                  className="bg-secondary/70 text-foreground rounded-full px-3 py-1.5 focus:outline-none"
                />
              </div>
            )}
          </div>
        </section>

        <section className="mt-7 px-5 pb-4">
          <button
            onClick={() => {
              setPrayers(defaultPrayers);
              setDaily(defaultDaily);
              setCadence("gentle");
              setTone("noor-chime");
              setQuiet({ from: "22:00", to: "05:00", enabled: true });
            }}
            className="text-muted-foreground w-full rounded-full py-3 text-xs font-medium"
          >
            Reset to gentle defaults
          </button>
        </section>
      </div>
    </MobileShell>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className={`relative h-6 w-11 rounded-full transition-all ${
        on ? "bg-emerald-gradient shadow-glow" : "bg-secondary"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
