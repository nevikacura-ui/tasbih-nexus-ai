import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Sparkles, Calendar } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

export default function YearMosaicPage() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => { (async () => {
    try { const r = await api.get("/noor/year-mosaic"); setData(r.data); } catch (e) {}
  })(); }, []);

  const selected = open !== null && data ? data.tiles.find((t) => t.week === open) : null;

  return (
    <MobileShell>
      <div className="relative" data-testid="mosaic-page">
        <NoorBackdrop />
        <header className="flex items-center gap-3 px-5 pt-9">
          <Link to="/noor/digest" data-testid="mosaic-back" className="glass flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
            <ChevronLeft className="h-4 w-4 text-deep" />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-gold">52 quiet Sundays</p>
            <h1 className="font-display text-2xl text-deep">Year in Noor</h1>
          </div>
        </header>

        {data && (
          <section className="mt-5 px-5">
            <div className="glass rounded-2xl p-4 shadow-soft" data-testid="mosaic-summary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-3xl text-deep">{data.lit_count}<span className="text-deep/35 text-lg">/52</span></p>
                  <p className="text-[11px] text-deep/55">Sunday reflections saved · {data.year}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">This week</p>
                  <p className="font-display text-base text-deep">W{data.current_week}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-5 px-5">
          {!data && <p className="text-xs text-deep/55">Loading your year…</p>}
          {data && (
            <div className="grid grid-cols-13 gap-1.5" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }} data-testid="mosaic-grid">
              {data.tiles.map((t) => {
                const isCurrent = t.week === data.current_week;
                return (
                  <button
                    key={t.week}
                    data-testid={`mosaic-tile-${t.week}`}
                    disabled={!t.lit}
                    onClick={() => t.lit && setOpen(t.week)}
                    aria-label={`Week ${t.week}${t.lit ? ` — ${t.date}` : ""}`}
                    className={`relative aspect-square rounded-md transition tap-scale ${
                      t.lit
                        ? "bg-emerald-gradient shadow-glow ring-1 ring-gold/40"
                        : "bg-deep/8"
                    } ${isCurrent ? "ring-2 ring-gold" : ""}`}
                  />
                );
              })}
            </div>
          )}
          <div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-deep/55">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-deep/8"></span> empty
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="bg-emerald-gradient h-2 w-2 rounded-sm shadow-glow"></span> saved
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-gold"></span> this week
            </span>
          </div>
        </section>

        <section className="mt-7 px-5 pb-10">
          <Link to="/noor/digest" data-testid="mosaic-cta" className="bg-emerald-gradient text-ivory shadow-elegant block rounded-full py-3.5 text-center text-sm font-medium tap-scale">
            <Sparkles className="mr-2 inline h-4 w-4" />
            Save this week's reflection
          </Link>
          <p className="mt-3 px-2 text-center text-[10px] leading-relaxed text-deep/45">
            A private mosaic of your Sunday reflections. Never shared, never compared. Just yours.
          </p>
        </section>

        {selected && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-deep/30 backdrop-blur-sm" data-testid="mosaic-modal" onClick={() => setOpen(null)}>
            <div className="glass w-full max-w-[480px] rounded-t-[28px] p-5 shadow-elegant" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-deep/15" />
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gold">
                <Calendar className="h-3 w-3" /> Week {selected.week} · {selected.date}
              </div>
              <h2 className="mt-1 font-display text-xl text-deep">{selected.title}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-deep/85">{selected.body}</p>
              <button onClick={() => setOpen(null)} className="mt-5 w-full rounded-full bg-sand py-3 text-sm font-medium text-deep tap-scale">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
