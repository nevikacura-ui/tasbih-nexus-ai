import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Heart, Sparkles, Moon, Sun, Check, ChevronRight, Globe2 } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

export default function QuranPage() {
  const [tab, setTab] = useState("read");

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[480px]" data-testid="quran-page">
      <NoorBackdrop />
      <header className="flex items-center gap-3 px-5 pt-9">
        <Link to="/" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
          <ArrowLeft className="h-4 w-4 text-deep" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Authentic</p>
          <h1 className="font-display text-2xl text-deep">Qurʾan</h1>
        </div>
      </header>

      <div className="mt-4 px-5">
        <div className="glass inline-flex rounded-full p-1 shadow-soft">
          <button data-testid="quran-tab-read" onClick={() => setTab("read")} className={`rounded-full px-4 py-1.5 text-xs font-medium tap-scale ${tab === "read" ? "bg-emerald-gradient text-ivory" : "text-deep/65"}`}>
            Read
          </button>
          <button data-testid="quran-tab-reflections" onClick={() => setTab("reflections")} className={`rounded-full px-4 py-1.5 text-xs font-medium tap-scale ${tab === "reflections" ? "bg-emerald-gradient text-ivory" : "text-deep/65"}`}>
            Reflections
          </button>
        </div>
      </div>

      {tab === "read" ? <ReadTab /> : <ReflectionsTab />}
    </div>
  );
}

function ReadTab() {
  const [surahs, setSurahs] = useState([]);
  const [openNum, setOpenNum] = useState(null);

  useEffect(() => { (async () => {
    try { const r = await api.get("/quran/surahs"); setSurahs(r.data.surahs || []); } catch (e) {}
  })(); }, []);

  if (openNum) return <SurahReader number={openNum} onBack={() => setOpenNum(null)} />;

  return (
    <>
      <p className="px-5 pt-3 text-[10px] text-deep/45">
        Uthmani Arabic with authentic translations (Sahih International, Asad, Jalandhry, Hamidullah…). Source: alquran.cloud.
      </p>
      <section className="mt-3 space-y-2 px-5 pb-10">
        {surahs.length === 0 && <p className="px-2 text-xs text-deep/55">Loading the 114 surahs…</p>}
        {surahs.map((s) => (
          <button
            key={s.number}
            data-testid={`surah-${s.number}`}
            onClick={() => setOpenNum(s.number)}
            className="glass tap-scale flex w-full items-center gap-3 rounded-2xl p-3.5 text-left shadow-soft"
          >
            <div className="bg-gold-gradient flex h-9 w-9 items-center justify-center rounded-full font-display text-xs text-deep">
              {s.number}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-deep">{s.english_name}</p>
                <p className="font-display text-base text-deep" style={{ fontFamily: "Fraunces, serif" }} dir="rtl">{s.name}</p>
              </div>
              <p className="text-[10px] text-deep/55">{s.english_translation} · {s.revelation_type} · {s.ayah_count} ayāt</p>
            </div>
            <ChevronRight className="h-4 w-4 text-deep/45" />
          </button>
        ))}
      </section>
    </>
  );
}

const LANG_FALLBACK = [
  { id: "en", label: "English (Sahih International)" },
  { id: "en2", label: "English (Muhammad Asad)" },
  { id: "ur", label: "اردو (Urdu)" },
  { id: "fr", label: "Français" },
  { id: "tr", label: "Türkçe" },
  { id: "id", label: "Bahasa Indonesia" },
  { id: "ru", label: "Русский" },
  { id: "es", label: "Español" },
  { id: "de", label: "Deutsch" },
];

function SurahReader({ number, onBack }) {
  const [surah, setSurah] = useState(null);
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("tasbih_quran_lang") || "en"; } catch { return "en"; }
  });
  const [loading, setLoading] = useState(true);
  const [langs, setLangs] = useState(LANG_FALLBACK);

  useEffect(() => {
    try { localStorage.setItem("tasbih_quran_lang", lang); } catch (_) {}
    setLoading(true);
    (async () => {
      try {
        const r = await api.get(`/quran/surah/${number}`, { params: { lang } });
        setSurah(r.data);
      } catch (e) { setSurah(null); }
      finally { setLoading(false); }
    })();
  }, [number, lang]);

  useEffect(() => { (async () => {
    try { const r = await api.get("/quran/languages"); if (r.data.languages?.length) setLangs(r.data.languages); } catch (_) {}
  })(); }, []);

  return (
    <div className="px-5 pb-12 pt-3">
      <button onClick={onBack} data-testid="surah-back" className="glass inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] text-deep shadow-soft">
        <ArrowLeft className="h-3 w-3" /> All surahs
      </button>

      {loading && <p className="mt-6 text-center text-xs text-deep/55">Loading surah…</p>}

      {surah && (
        <>
          <header className="mt-4 text-center">
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Surah {surah.number} · {surah.revelation_type}</p>
            <h2 className="mt-1 font-display text-2xl text-deep" dir="rtl" style={{ fontFamily: "Fraunces, serif" }}>{surah.name}</h2>
            <p className="text-sm text-deep/70">{surah.english_name} — {surah.english_translation}</p>
          </header>

          <div className="mt-4 flex items-center gap-2">
            <div className="glass flex flex-1 items-center gap-2 rounded-full px-3 py-2 shadow-soft">
              <Globe2 className="h-3.5 w-3.5 text-deep/55" />
              <select
                data-testid="surah-lang"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="flex-1 bg-transparent text-xs text-deep outline-none"
              >
                {langs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <Link to="/noor" data-testid="surah-noor" className="bg-emerald-gradient text-ivory rounded-full px-3 py-2 text-[11px] shadow-soft">
              Reflect with Noor
            </Link>
          </div>

          {surah.translator && (
            <p className="mt-2 px-2 text-center text-[10px] text-deep/45">Translation: {surah.translator}</p>
          )}

          <section className="mt-5 space-y-3">
            {surah.number !== 1 && surah.number !== 9 && surah.ayahs?.length > 0 && (
              <p className="text-center text-base text-deep/85" dir="rtl" style={{ fontFamily: "Fraunces, serif" }}>
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </p>
            )}
            {surah.ayahs.map((a) => (
              <article key={a.number} data-testid={`ayah-${surah.number}-${a.number}`} className="glass rounded-2xl p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="bg-gold-gradient text-deep flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold">{a.number}</span>
                  {a.sajda && <span className="rounded-full bg-sand/60 px-2 py-0.5 text-[9px] uppercase tracking-wider text-deep/65">Sajda</span>}
                </div>
                <p dir="rtl" className="mt-3 text-right text-xl leading-loose text-deep" style={{ fontFamily: "Fraunces, serif" }}>
                  {a.ar}
                </p>
                {a.tr && <p className="mt-3 text-sm leading-relaxed text-deep/80">{a.tr}</p>}
              </article>
            ))}
          </section>

          <p className="mt-6 px-3 text-center text-[10px] leading-relaxed text-deep/45">
            Translations are scholarly works by named translators and reflect their interpretation. Tasbih.ai is not a religious authority — please consult a learned guide for rulings.
          </p>
        </>
      )}
    </div>
  );
}

function ReflectionsTab() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    (async () => {
      try { const r = await api.get("/quran/reflections"); setItems(r.data.reflections || []); } catch (e) {}
    })();
  }, []);

  const selected = items.find((i) => i.id === open);

  return (
    <>
      <p className="px-5 pt-3 text-[10px] text-deep/45">
        Reflective summaries — not rulings or tafsir. Read with your own heart.
      </p>
      <section className="mt-3 space-y-3 px-5 pb-10">
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
    </>
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
