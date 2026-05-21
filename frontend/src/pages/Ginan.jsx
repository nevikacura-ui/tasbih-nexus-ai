import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Sparkles, Search } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const THEMES = [
  { id: "", label: "All" },
  { id: "remembrance", label: "Remembrance" },
  { id: "love", label: "Love" },
  { id: "light", label: "Light" },
  { id: "journey", label: "Journey" },
  { id: "surrender", label: "Surrender" },
  { id: "service", label: "Service" },
];

export default function GinanPage() {
  const [items, setItems] = useState([]);
  const [credit, setCredit] = useState("");
  const [theme, setTheme] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    setLoading(true);
    try {
      const params = {};
      if (theme) params.theme = theme;
      if (q) params.q = q;
      const r = await api.get("/ginan", { params });
      setItems(r.data.ginan || []); setCredit(r.data.credit || "");
    } catch (e) {} finally { setLoading(false); }
  })(); }, [theme, q]);

  const selected = open ? items.find((g) => g.id === open) : null;

  return (
    <MobileShell>
      <div className="relative" data-testid="ginan-page">
        <NoorBackdrop />
        <header className="flex items-center gap-3 px-5 pt-9">
          <Link to="/profile" data-testid="ginan-back" className="glass flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
            <ChevronLeft className="h-4 w-4 text-deep" />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Devotional poetry</p>
            <h1 className="font-display text-2xl text-deep">Ginan</h1>
          </div>
        </header>

        <section className="mt-4 px-5">
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2.5 shadow-soft">
            <Search className="h-4 w-4 text-deep/50" />
            <input
              data-testid="ginan-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ginans, pirs, themes…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-deep/40"
            />
          </div>
          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto no-scrollbar px-5 pb-1">
            {THEMES.map((t) => (
              <button
                key={t.id || "all"}
                data-testid={`ginan-theme-${t.id || "all"}`}
                onClick={() => setTheme(t.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] tap-scale ${
                  theme === t.id ? "bg-emerald-gradient text-ivory shadow-soft" : "glass text-deep"
                }`}
              >{t.label}</button>
            ))}
          </div>
        </section>

        <section className="mt-5 space-y-3 px-5 pb-10">
          {loading && <p className="text-xs text-deep/55">Loading…</p>}
          {!loading && items.length === 0 && <p className="text-xs text-deep/55">No ginans match. Try a different theme.</p>}
          {items.map((g) => (
            <article
              key={g.id}
              data-testid={`ginan-card-${g.id}`}
              onClick={() => setOpen(g.id)}
              className="glass tap-scale cursor-pointer rounded-2xl p-4 shadow-soft"
            >
              <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{g.pir}</p>
              <p className="mt-1 font-display text-lg text-deep">{g.title}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-deep/70">{g.english}</p>
              <span className="mt-2 inline-block rounded-full bg-sand/60 px-2 py-0.5 text-[10px] capitalize text-deep/60">{g.theme}</span>
            </article>
          ))}
          {credit && (
            <p className="mt-6 px-2 text-center text-[10px] leading-relaxed text-deep/45" data-testid="ginan-credit">
              {credit}
              <br />Reflective summaries, not authoritative translations.
            </p>
          )}
        </section>

        {selected && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-deep/30 backdrop-blur-sm" data-testid="ginan-modal" onClick={() => setOpen(null)}>
            <div className="glass max-h-[88vh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] p-5 shadow-elegant" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-deep/15" />
              <p className="text-[10px] uppercase tracking-[0.22em] text-gold">{selected.pir}</p>
              <h2 className="mt-1 font-display text-2xl text-deep">{selected.title}</h2>

              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">Gujarati</p>
                <p className="mt-1 whitespace-pre-line text-xl leading-loose text-deep" style={{ fontFamily: "Fraunces, serif" }} dir="auto">
                  {selected.gujarati}
                </p>
              </div>

              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">Transliteration</p>
                <p className="mt-1 whitespace-pre-line text-sm italic leading-relaxed text-deep/80">
                  {selected.transliteration}
                </p>
              </div>

              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">A gentle meaning</p>
                <p className="mt-1 text-sm leading-relaxed text-deep/85">{selected.english}</p>
              </div>

              <div className="mt-5 flex gap-2">
                <button onClick={() => setOpen(null)} className="flex-1 rounded-full bg-sand py-3 text-sm font-medium text-deep tap-scale">
                  Close
                </button>
                <Link to="/noor" data-testid="ginan-noor" onClick={() => setOpen(null)} className="bg-emerald-gradient text-ivory shadow-elegant flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-medium tap-scale">
                  <Sparkles className="h-4 w-4" /> Reflect with Noor
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
