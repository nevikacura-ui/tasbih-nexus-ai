import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Sparkles, Search, Heart } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const SITUATIONS = [
  { id: "", label: "All" },
  { id: "morning", label: "Morning" },
  { id: "evening", label: "Evening" },
  { id: "anxiety", label: "Anxiety" },
  { id: "healing", label: "Healing" },
  { id: "gratitude", label: "Gratitude" },
  { id: "travel", label: "Travel" },
  { id: "parents", label: "Parents" },
];

export default function DuaPage() {
  const [items, setItems] = useState([]);
  const [credit, setCredit] = useState("");
  const [situation, setSituation] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    setLoading(true);
    try {
      const params = {};
      if (situation) params.situation = situation;
      if (q) params.q = q;
      const r = await api.get("/dua", { params });
      setItems(r.data.dua || []); setCredit(r.data.credit || "");
    } catch (e) {} finally { setLoading(false); }
  })(); }, [situation, q]);

  const selected = open ? items.find((d) => d.id === open) : null;

  return (
    <MobileShell>
      <div className="relative" data-testid="dua-page">
        <NoorBackdrop />
        <header className="flex items-center gap-3 px-5 pt-9">
          <Link to="/profile" data-testid="dua-back" className="glass flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
            <ChevronLeft className="h-4 w-4 text-deep" />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Whispered prayers</p>
            <h1 className="font-display text-2xl text-deep">Dua</h1>
          </div>
        </header>

        <section className="mt-4 px-5">
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2.5 shadow-soft">
            <Search className="h-4 w-4 text-deep/50" />
            <input
              data-testid="dua-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search duas, situations…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-deep/40"
            />
          </div>
          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto no-scrollbar px-5 pb-1">
            {SITUATIONS.map((s) => (
              <button
                key={s.id || "all"}
                data-testid={`dua-situation-${s.id || "all"}`}
                onClick={() => setSituation(s.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] tap-scale ${
                  situation === s.id ? "bg-emerald-gradient text-ivory shadow-soft" : "glass text-deep"
                }`}
              >{s.label}</button>
            ))}
          </div>
        </section>

        <section className="mt-5 space-y-3 px-5 pb-10">
          {loading && <p className="text-xs text-deep/55">Loading…</p>}
          {!loading && items.length === 0 && <p className="text-xs text-deep/55">No duas match.</p>}
          {items.map((d) => (
            <article
              key={d.id}
              data-testid={`dua-card-${d.id}`}
              onClick={() => setOpen(d.id)}
              className="glass tap-scale cursor-pointer rounded-2xl p-4 shadow-soft"
            >
              <div className="flex items-start gap-3">
                <div className="bg-gold-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <Heart className="h-4 w-4 text-deep" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">{d.situation}</p>
                  <p className="mt-1 font-display text-base text-deep">{d.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs italic text-deep/65">{d.transliteration}</p>
                </div>
              </div>
            </article>
          ))}
          {credit && (
            <p className="mt-6 px-2 text-center text-[10px] leading-relaxed text-deep/45" data-testid="dua-credit">
              {credit}
              <br />Personal reflective renderings — not rulings.
            </p>
          )}
        </section>

        {selected && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-deep/30 backdrop-blur-sm" data-testid="dua-modal" onClick={() => setOpen(null)}>
            <div className="glass max-h-[88vh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] p-5 shadow-elegant" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-deep/15" />
              <p className="text-[10px] uppercase tracking-[0.22em] text-gold">{selected.situation}</p>
              <h2 className="mt-1 font-display text-2xl text-deep">{selected.title}</h2>

              <div className="mt-5">
                <p dir="rtl" className="text-right text-2xl leading-loose text-deep" style={{ fontFamily: "Fraunces, serif" }}>
                  {selected.arabic}
                </p>
              </div>

              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">Transliteration</p>
                <p className="mt-1 text-sm italic leading-relaxed text-deep/80">{selected.transliteration}</p>
              </div>

              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">A gentle rendering</p>
                <p className="mt-1 text-sm leading-relaxed text-deep/85">{selected.english}</p>
              </div>

              <div className="mt-5 flex gap-2">
                <button onClick={() => setOpen(null)} className="flex-1 rounded-full bg-sand py-3 text-sm font-medium text-deep tap-scale">
                  Close
                </button>
                <Link to="/noor" data-testid="dua-noor" onClick={() => setOpen(null)} className="bg-emerald-gradient text-ivory shadow-elegant flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-medium tap-scale">
                  <Sparkles className="h-4 w-4" /> Sit with Noor
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
