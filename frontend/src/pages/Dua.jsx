import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Sparkles, Heart, Languages, ListFilter, X, Home, Check, Play, Pause, Repeat } from "lucide-react";
import { api } from "../lib/api";

const API_BASE = process.env.REACT_APP_BACKEND_URL;

// Cinematic palette per rakaat — mosque-silhouette inspired gradients.
const RAKAAT_THEMES = {
  1: { from: "#0a2820", via: "#0F3D36", to: "#1f5448", accent: "#E8C36A", label: "Rakaat I · Fatiha & Salawat" },
  2: { from: "#1a2d3a", via: "#1f4a52", to: "#2d6b66", accent: "#F4D88A", label: "Rakaat II · Peace & Reliance" },
  3: { from: "#2b1b3a", via: "#3d2a55", to: "#4c3a6e", accent: "#E8C36A", label: "Rakaat III · Tawhid & Wilayah" },
  4: { from: "#3a1f1f", via: "#5a2e2e", to: "#6e4242", accent: "#F4D88A", label: "Rakaat IV · The Covenant" },
  5: { from: "#1c2f1c", via: "#2f4a2f", to: "#3d6e3d", accent: "#E8C36A", label: "Rakaat V · Trust in Time" },
  6: { from: "#0e2840", via: "#1a4565", to: "#2d6688", accent: "#F4D88A", label: "Rakaat VI · Ikhlas & Didar" },
};

const MosqueSilhouette = ({ color = "rgba(232,195,106,0.18)" }) => (
  <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-1/3 w-full pointer-events-none">
    <defs>
      <linearGradient id="mosqueFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0" />
        <stop offset="100%" stopColor={color} stopOpacity="1" />
      </linearGradient>
    </defs>
    <path d="M30,200 L30,80 Q35,72 35,68 Q35,60 30,55 Q25,60 25,68 Q25,72 30,80 Z M30,80 L36,80 L36,200 Z" fill="url(#mosqueFade)" />
    <path d="M370,200 L370,80 Q375,72 375,68 Q375,60 370,55 Q365,60 365,68 Q365,72 370,80 Z M364,80 L376,80 L376,200 Z" fill="url(#mosqueFade)" />
    <path d="M120,200 L120,140 Q120,90 200,80 Q280,90 280,140 L280,200 Z" fill="url(#mosqueFade)" />
    <circle cx="200" cy="80" r="6" fill={color} opacity="0.6" />
    <path d="M60,200 L60,150 L110,150 L110,200 Z M290,200 L290,150 L340,150 L340,200 Z" fill="url(#mosqueFade)" />
  </svg>
);

const LightRays = ({ accent }) => (
  <div
    className="pointer-events-none absolute inset-0"
    style={{
      background: `radial-gradient(ellipse at 50% 28%, ${accent}22 0%, transparent 55%), radial-gradient(circle at 80% 10%, ${accent}18 0%, transparent 40%)`,
    }}
  />
);

const GrainTexture = () => (
  <div
    className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
    }}
  />
);

function DuaHalf({ item, accent, onTapArabic, onPlay, isPlaying, isLoading }) {
  return (
    <div
      data-testid={`dua-half-${item.id}`}
      className="group relative flex flex-1 flex-col justify-center"
    >
      <button
        type="button"
        onClick={() => onTapArabic(item)}
        className="flex flex-1 flex-col justify-center text-left transition-all tap-scale"
      >
        <p
          className="text-[10px] uppercase tracking-[0.22em]"
          style={{ color: accent }}
        >
          {item.title}
        </p>
        <h2
          className="mt-2 font-display leading-[1.15] text-ivory"
          style={{
            fontSize: "clamp(22px, 5.6vw, 32px)",
            textShadow: "0 2px 24px rgba(0,0,0,0.4)",
            letterSpacing: "-0.005em",
          }}
          data-testid={`dua-translit-${item.id}`}
        >
          {item.transliteration}
        </h2>
        <div
          className="mt-3 h-px w-10"
          style={{ background: `linear-gradient(90deg, ${accent} 0%, transparent 100%)` }}
        />
        <p
          className="mt-3 text-[13px] leading-relaxed text-ivory/80"
          style={{ textShadow: "0 1px 12px rgba(0,0,0,0.3)" }}
          data-testid={`dua-english-${item.id}`}
        >
          {item.english}
        </p>
      </button>

      {/* Inline play + Arabic hint row */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlay(item); }}
          data-testid={`dua-play-${item.id}`}
          aria-label={isPlaying ? "Pause recitation" : "Play Arabic recitation"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all tap-scale"
          style={{
            background: isPlaying ? accent : "rgba(255,255,255,0.08)",
            border: `1px solid ${isPlaying ? accent : "rgba(255,255,255,0.18)"}`,
            color: isPlaying ? "#0F3D36" : "#F7F3EC",
          }}
        >
          {isLoading ? (
            <span
              className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
          ) : isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 translate-x-[1px]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onTapArabic(item)}
          className="inline-flex items-center gap-1.5 text-[10px] text-ivory/55 tap-scale"
        >
          <Languages className="h-3 w-3" />
          Tap for Arabic
        </button>
      </div>
    </div>
  );
}

function MidInsert({ insert, accent }) {
  if (!insert || insert.kind !== "verse") return null;
  return (
    <div
      className="my-4 rounded-2xl border bg-black/20 px-4 py-3 text-center backdrop-blur-sm"
      style={{ borderColor: `${accent}40` }}
      data-testid="dua-mid-verse"
    >
      <p
        className="text-[9px] uppercase tracking-[0.28em]"
        style={{ color: accent }}
      >
        {insert.title}
      </p>
      <p
        className="mt-1.5 font-display italic leading-snug text-ivory"
        style={{ fontSize: "clamp(15px, 4vw, 18px)" }}
      >
        {insert.transliteration}
      </p>
      <p className="mt-1 text-[11px] text-ivory/65 leading-snug">
        {insert.english}
      </p>
    </div>
  );
}

function ImamListInterlude({ data, index, total, rakaat, autoAdvance, onComplete, voice }) {
  const theme = RAKAAT_THEMES[rakaat] || RAKAAT_THEMES[6];
  const [recited, setRecited] = useState(() => new Set());
  const [playingIdx, setPlayingIdx] = useState(null); // index of name being recited
  const audioRef = useRef(null);
  const cancelRef = useRef(false);
  if (!audioRef.current && typeof window !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
  }

  const toggle = (i) => {
    setRecited((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };
  const reset = () => setRecited(new Set());

  const total_names = data.names?.length || 0;
  const done = recited.size;

  const stopRecite = useCallback(() => {
    cancelRef.current = true;
    const el = audioRef.current;
    if (el) { try { el.pause(); el.currentTime = 0; } catch (e) { /* ignore */ } }
    setPlayingIdx(null);
  }, []);

  // Play a name and wait for it to finish (returns a promise)
  const playOne = (name) => {
    return new Promise((resolve) => {
      const el = audioRef.current;
      if (!el) { resolve(); return; }
      el.onended = () => resolve();
      el.onerror = () => resolve();
      el.src = `${API_BASE}/api/tasbih-name/audio?name=${encodeURIComponent(name)}&voice=${voice || "male"}`;
      el.play().catch(() => resolve());
    });
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const reciteAll = async () => {
    if (playingIdx !== null) { stopRecite(); return; }
    cancelRef.current = false;
    for (let i = 0; i < total_names; i++) {
      if (cancelRef.current) break;
      setPlayingIdx(i);
      // Scroll the name into view inside the list
      const node = document.querySelector(`[data-testid="dua-imam-tick-${i + 1}"]`);
      if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
      await playOne(data.names[i]);
      if (cancelRef.current) break;
      setRecited((prev) => {
        const next = new Set(prev);
        next.add(i);
        return next;
      });
      await sleep(400); // gentle pause between names
    }
    setPlayingIdx(null);
    if (!cancelRef.current && autoAdvance && typeof onComplete === "function") {
      setTimeout(() => onComplete(), 700);
    }
  };

  useEffect(() => {
    return () => {
      cancelRef.current = true;
      const el = audioRef.current;
      if (el) { try { el.pause(); } catch (e) { /* ignore */ } }
    };
  }, []);

  const isReciting = playingIdx !== null;

  return (
    <section
      data-testid="dua-interlude-imam-list"
      className="relative flex h-[100svh] w-full snap-start snap-always flex-col overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${theme.from} 0%, ${theme.via} 45%, ${theme.to} 100%)`,
      }}
    >
      <LightRays accent={theme.accent} />
      <MosqueSilhouette color={`${theme.accent}33`} />
      <GrainTexture />

      <div className="relative z-10 flex h-full w-full flex-col px-6 pt-24 pb-10">
        {/* Header */}
        <div className="px-1">
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em]"
            style={{ background: `${theme.accent}22`, color: theme.accent, border: `1px solid ${theme.accent}44` }}
          >
            <Sparkles className="h-3 w-3" />
            Tasbih · Interlude
          </span>
          <h2
            className="mt-3 font-display leading-tight text-ivory"
            style={{ fontSize: "clamp(22px, 5.6vw, 28px)" }}
            data-testid="dua-interlude-title"
          >
            {data.title}
          </h2>
          <p className="mt-1 text-[12px] text-ivory/70 leading-snug">
            {data.subtitle}
          </p>
        </div>

        {/* Progress */}
        <div className="mt-4 flex items-center justify-between px-1">
          <p className="text-[11px]" style={{ color: theme.accent }}>
            <span data-testid="dua-interlude-progress">{done}</span> / {total_names} recited
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reciteAll}
              data-testid="dua-interlude-recite-all"
              aria-label={isReciting ? "Stop recitation" : "Recite all 50 names"}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] transition-all tap-scale"
              style={{
                background: isReciting ? theme.accent : `${theme.accent}22`,
                color: isReciting ? "#0F3D36" : theme.accent,
                border: `1px solid ${theme.accent}55`,
              }}
            >
              {isReciting ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {isReciting ? "Stop" : "Recite all"}
            </button>
            {done > 0 && (
              <button
                type="button"
                onClick={reset}
                data-testid="dua-interlude-reset"
                className="text-[10px] uppercase tracking-[0.22em] text-ivory/60 underline-offset-2 hover:underline tap-scale"
              >
                Reset
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 h-px w-full bg-ivory/10 px-1">
          <div
            className="h-px transition-all duration-300"
            style={{ width: `${(done / total_names) * 100}%`, background: theme.accent }}
          />
        </div>

        {/* Scrollable name list with tap-to-count */}
        <ol
          className="mt-3 flex-1 overflow-y-auto pr-1 space-y-1"
          data-testid="dua-interlude-names"
          onTouchStart={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {(data.names || []).map((n, i) => {
            const isLast = i === total_names - 1;
            const ticked = recited.has(i);
            const isActive = playingIdx === i;
            return (
              <li key={`${n}-${i}`}>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  data-testid={`dua-imam-tick-${i + 1}`}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all tap-scale ${
                    isActive ? "scale-[1.02]" : ""
                  } ${isLast || isActive ? "border" : ""}`}
                  style={
                    isActive
                      ? {
                          background: `linear-gradient(135deg, ${theme.accent}33 0%, ${theme.accent}1a 100%)`,
                          borderColor: theme.accent,
                          boxShadow: `0 0 24px ${theme.accent}55`,
                        }
                      : isLast
                      ? {
                          background: "linear-gradient(135deg, rgba(232,195,106,0.16) 0%, rgba(244,216,138,0.06) 100%)",
                          borderColor: "rgba(232,195,106,0.45)",
                        }
                      : undefined
                  }
                >
                  <span
                    className="w-7 shrink-0 text-right text-[10px] tracking-widest"
                    style={{ color: isActive || isLast ? "#F4D88A" : "rgba(247,243,236,0.4)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`flex-1 leading-snug ${
                      isLast || isActive ? "font-display text-[14px]" : "text-[13px]"
                    } ${ticked && !isActive ? "line-through opacity-50" : ""}`}
                    style={{ color: isActive ? "#F7F3EC" : isLast ? "#F4D88A" : "rgba(247,243,236,0.92)" }}
                  >
                    {n}
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                      ticked ? "" : "border-ivory/30"
                    }`}
                    style={
                      ticked
                        ? { background: theme.accent, borderColor: theme.accent }
                        : isActive
                        ? { background: "transparent", borderColor: theme.accent }
                        : { background: "transparent" }
                    }
                    aria-hidden="true"
                  >
                    {ticked && <Check className="h-3 w-3 text-deep" strokeWidth={3} />}
                    {!ticked && isActive && (
                      <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: theme.accent }} />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between text-ivory/55">
          <span className="text-[10px] italic">{data.english}</span>
          <span
            className="rounded-full bg-ivory/10 px-3 py-1 text-[10px] tracking-widest backdrop-blur-md"
          >
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
      </div>
    </section>
  );
}

function DuaPairCard({ pair, index, total, onTapArabic, onPlay, playingId, loadingId }) {
  const theme = RAKAAT_THEMES[pair[0].rakaat] || RAKAAT_THEMES[1];
  const [a, b] = pair;
  const insert = a.mid_insert && a.mid_insert.kind === "verse" ? a.mid_insert : null;

  return (
    <section
      data-testid={`dua-card-${a.id}`}
      className="relative flex h-[100svh] w-full snap-start snap-always flex-col overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${theme.from} 0%, ${theme.via} 45%, ${theme.to} 100%)`,
      }}
    >
      <LightRays accent={theme.accent} />
      <MosqueSilhouette color={`${theme.accent}33`} />
      <GrainTexture />

      <div className="relative z-10 flex h-full w-full flex-col px-7 pt-24 pb-10">
        {/* Rakaat tag */}
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em]"
          style={{ background: `${theme.accent}22`, color: theme.accent, border: `1px solid ${theme.accent}44` }}
          data-testid={`dua-rakaat-tag-${a.id}`}
        >
          <Sparkles className="h-3 w-3" />
          {theme.label}
        </span>

        {/* Pair body */}
        <div className="mt-6 flex flex-1 flex-col">
          <DuaHalf
            item={a}
            accent={theme.accent}
            onTapArabic={onTapArabic}
            onPlay={onPlay}
            isPlaying={playingId === a.id}
            isLoading={loadingId === a.id}
          />

          {/* Mid insert (between the two duas) */}
          {insert ? (
            <MidInsert insert={insert} accent={theme.accent} />
          ) : (
            b && (
              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <div
                  className="h-px flex-1"
                  style={{ background: `linear-gradient(90deg, transparent 0%, ${theme.accent}55 50%, transparent 100%)` }}
                />
                <Sparkles className="h-3 w-3" style={{ color: theme.accent }} />
                <div
                  className="h-px flex-1"
                  style={{ background: `linear-gradient(90deg, transparent 0%, ${theme.accent}55 50%, transparent 100%)` }}
                />
              </div>
            )
          )}

          {b && (
            <DuaHalf
              item={b}
              accent={theme.accent}
              onTapArabic={onTapArabic}
              onPlay={onPlay}
              isPlaying={playingId === b.id}
              isLoading={loadingId === b.id}
            />
          )}
        </div>

        {/* Footer counter */}
        <div className="mt-4 flex items-center justify-between text-ivory/55">
          <span className="inline-flex items-center gap-1.5 text-[10px]">
            <Languages className="h-3 w-3" />
            Tap a verse for Arabic
          </span>
          <span
            className="rounded-full bg-ivory/10 px-3 py-1 text-[10px] tracking-widest backdrop-blur-md"
            data-testid={`dua-counter-${a.id}`}
          >
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
      </div>
    </section>
  );
}

export default function DuaPage() {
  const [items, setItems] = useState([]);
  const [credit, setCredit] = useState("");
  const [loading, setLoading] = useState(true);
  const [arabicOpen, setArabicOpen] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentRakaat, setCurrentRakaat] = useState(1);
  const [playingId, setPlayingId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [voice, setVoice] = useState(() => {
    if (typeof window === "undefined") return "male";
    return localStorage.getItem("dua.voice") || "male";
  });
  useEffect(() => {
    try { localStorage.setItem("dua.voice", voice); } catch (e) { /* ignore */ }
  }, [voice]);
  const scrollerRef = useRef(null);
  const audioRef = useRef(null);
  const autoAdvanceRef = useRef(false);
  // Lazy-create the single shared <audio> element
  if (!audioRef.current && typeof window !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
  }
  useEffect(() => { autoAdvanceRef.current = autoAdvance; }, [autoAdvance]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get("/dua");
        const list = r.data.dua || [];
        list.sort((a, b) => (a.rakaat - b.rakaat) || (a.order - b.order));
        setItems(list);
        setCredit(r.data.credit || "");
      } catch (e) {
        // no-op
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Audio playback ─────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      try { el.pause(); el.currentTime = 0; } catch (e) { /* ignore */ }
    }
    setPlayingId(null);
    setLoadingId(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const el = audioRef.current;
      if (el) { try { el.pause(); } catch (e) { /* ignore */ } }
    };
  }, []);

  const scrollToNext = useCallback(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    sc.scrollBy({ top: sc.clientHeight, behavior: "smooth" });
  }, []);

  const playDua = useCallback((dua) => {
    const el = audioRef.current;
    if (!el) return;
    // Toggle off if already playing same verse
    if (playingId === dua.id) { stopAudio(); return; }
    el.pause();
    setLoadingId(dua.id);
    setPlayingId(null);
    const url = `${API_BASE}/api/dua/${dua.id}/audio?voice=${voice}`;
    el.src = url;
    el.onended = () => {
      setPlayingId(null);
      if (autoAdvanceRef.current) {
        // gentle pause, then auto-scroll to next
        setTimeout(() => { scrollToNext(); }, 900);
      }
    };
    el.onerror = () => { setPlayingId(null); setLoadingId(null); };
    el.onplaying = () => { setLoadingId(null); setPlayingId(dua.id); };
    el.play().catch((e) => { setLoadingId(null); setPlayingId(null); console.warn("audio play failed", e); });
  }, [playingId, stopAudio, scrollToNext, voice]);

  // Build slides: pairs of duas, plus dedicated interlude slides where requested.
  // A dua with `interlude_after` becomes a solo card and the interlude follows it.
  const slides = useMemo(() => {
    const byRakaat = new Map();
    items.forEach((d) => {
      const r = d.rakaat || 1;
      if (!byRakaat.has(r)) byRakaat.set(r, []);
      byRakaat.get(r).push(d);
    });
    const out = [];
    Array.from(byRakaat.keys())
      .sort((a, b) => a - b)
      .forEach((r) => {
        const list = byRakaat.get(r);
        let i = 0;
        while (i < list.length) {
          const a = list[i];
          if (a.interlude_after) {
            // Solo card, then interlude
            out.push({ kind: "pair", rakaat: r, items: [a, null], anchorId: a.id });
            out.push({ kind: "interlude", rakaat: r, data: a.interlude_after, anchorId: `${a.id}_after` });
            i += 1;
          } else {
            const b = list[i + 1] || null;
            out.push({ kind: "pair", rakaat: r, items: [a, b], anchorId: a.id });
            i += 2;
          }
        }
      });
    return out;
  }, [items]);

  // Track current rakaat as user scrolls
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || slides.length === 0) return;
    const cards = el.querySelectorAll("[data-rakaat]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const rk = Number(e.target.getAttribute("data-rakaat"));
            if (rk && rk !== currentRakaat) setCurrentRakaat(rk);
          }
        });
      },
      { root: el, threshold: 0.6 }
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [slides, currentRakaat]);

  const rakaatGroups = useMemo(() => {
    const map = new Map();
    slides.forEach((s) => {
      const r = s.rakaat;
      if (!map.has(r)) map.set(r, { rakaat: r, count: 0 });
      if (s.kind === "pair") map.get(r).count += s.items[1] ? 2 : 1;
    });
    return Array.from(map.values()).sort((a, b) => a.rakaat - b.rakaat);
  }, [slides]);

  const jumpToRakaat = (rakaat) => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = el.querySelector(`[data-rakaat-anchor="${rakaat}"]`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    setFilterOpen(false);
  };

  const activeTheme = RAKAAT_THEMES[currentRakaat] || RAKAAT_THEMES[1];

  return (
    <div className="relative mx-auto w-full max-w-[480px] bg-black" data-testid="dua-page">
      {/* Fixed overlay header */}
      <header className="pointer-events-none fixed top-0 left-1/2 z-40 flex w-full max-w-[480px] -translate-x-1/2 items-center justify-between px-5 pt-7">
        <Link
          to="/"
          data-testid="dua-back"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-ivory/20 bg-black/35 text-ivory backdrop-blur-md tap-scale"
          aria-label="Home"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Voice picker */}
          <div
            className="flex h-9 items-center overflow-hidden rounded-full border backdrop-blur-md"
            style={{ background: "rgba(0,0,0,0.35)", borderColor: `${activeTheme.accent}44` }}
            data-testid="dua-voice-picker"
            role="group"
            aria-label="Reciter voice"
          >
            <button
              type="button"
              onClick={() => { if (voice !== "male") { stopAudio(); setVoice("male"); } }}
              data-testid="dua-voice-male"
              aria-pressed={voice === "male"}
              className="flex h-full items-center px-3 text-[10px] uppercase tracking-[0.18em] tap-scale"
              style={{
                background: voice === "male" ? activeTheme.accent : "transparent",
                color: voice === "male" ? "#0F3D36" : "rgba(247,243,236,0.7)",
                fontWeight: voice === "male" ? 600 : 400,
              }}
            >
              M
            </button>
            <span className="h-5 w-px" style={{ background: `${activeTheme.accent}33` }} aria-hidden="true" />
            <button
              type="button"
              onClick={() => { if (voice !== "female") { stopAudio(); setVoice("female"); } }}
              data-testid="dua-voice-female"
              aria-pressed={voice === "female"}
              className="flex h-full items-center px-3 text-[10px] uppercase tracking-[0.18em] tap-scale"
              style={{
                background: voice === "female" ? activeTheme.accent : "transparent",
                color: voice === "female" ? "#0F3D36" : "rgba(247,243,236,0.7)",
                fontWeight: voice === "female" ? 600 : 400,
              }}
            >
              F
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !autoAdvance;
              setAutoAdvance(next);
              if (!next) stopAudio();
            }}
            data-testid="dua-auto-advance"
            aria-pressed={autoAdvance}
            aria-label={autoAdvance ? "Disable auto-advance" : "Enable auto-advance"}
            className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-[10px] uppercase tracking-[0.22em] backdrop-blur-md transition-all tap-scale"
            style={{
              background: autoAdvance ? activeTheme.accent : "rgba(0,0,0,0.35)",
              borderColor: autoAdvance ? activeTheme.accent : `${activeTheme.accent}44`,
              color: autoAdvance ? "#0F3D36" : "rgba(247,243,236,0.85)",
            }}
          >
            <Repeat className="h-3.5 w-3.5" />
            {autoAdvance ? "Auto" : "Manual"}
          </button>
          <div
            className="rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] backdrop-blur-md"
            style={{ background: "rgba(0,0,0,0.35)", borderColor: `${activeTheme.accent}55`, color: activeTheme.accent }}
            data-testid="dua-current-rakaat"
          >
            {["", "I", "II", "III", "IV", "V", "VI"][currentRakaat]}
          </div>
        </div>
      </header>

      {/* Loading */}
      {loading && (
        <div className="flex h-[100svh] items-center justify-center bg-gradient-to-b from-[#0a2820] to-[#0F3D36] text-ivory" data-testid="dua-loading">
          <p className="text-xs uppercase tracking-[0.3em] text-ivory/60">Loading the Du'a…</p>
        </div>
      )}

      {/* Snap scroller */}
      {!loading && slides.length > 0 && (
        <div
          ref={scrollerRef}
          className="h-[100svh] w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
          style={{ scrollBehavior: "smooth" }}
          data-testid="dua-scroller"
        >
          {slides.map((slide, idx) => {
            const isFirstOfRakaat = idx === 0 || slides[idx - 1].rakaat !== slide.rakaat;
            const anchorProps = isFirstOfRakaat ? { "data-rakaat-anchor": slide.rakaat } : {};
            return (
              <div
                key={slide.anchorId}
                data-rakaat={slide.rakaat}
                {...anchorProps}
              >
                {slide.kind === "pair" ? (
                  <DuaPairCard
                    pair={slide.items}
                    index={idx}
                    total={slides.length}
                    onTapArabic={setArabicOpen}
                    onPlay={playDua}
                    playingId={playingId}
                    loadingId={loadingId}
                  />
                ) : (
                  <ImamListInterlude
                    data={slide.data}
                    index={idx}
                    total={slides.length}
                    rakaat={slide.rakaat}
                    autoAdvance={autoAdvance}
                    voice={voice}
                    onComplete={() => { if (autoAdvanceRef.current) setTimeout(scrollToNext, 900); }}
                  />
                )}
              </div>
            );
          })}

          {/* Credit footer card */}
          <section
            className="relative flex h-[100svh] w-full snap-start snap-always items-center justify-center overflow-hidden bg-gradient-to-b from-[#0a2820] via-[#0F3D36] to-[#0a2820] px-7 text-center text-ivory"
            data-testid="dua-credit-card"
          >
            <LightRays accent="#E8C36A" />
            <GrainTexture />
            <div className="relative z-10 max-w-sm">
              <Heart className="mx-auto h-6 w-6 text-[#E8C36A]" />
              <p className="mt-5 font-display text-2xl leading-snug">
                You have walked through the Holy Du'a.
              </p>
              <p className="mt-3 text-sm text-ivory/70 leading-relaxed">
                Let it settle. Whatever you carried in, set it down. The Du'a
                will be here tomorrow, gently, again.
              </p>
              <div className="mt-6 h-px w-12 mx-auto bg-gradient-to-r from-transparent via-[#E8C36A] to-transparent" />
              <p className="mt-6 text-[10px] uppercase tracking-[0.22em] text-ivory/55 leading-relaxed" data-testid="dua-credit">
                {credit || "Curated by Naushad & Shabnam Patel · Andheri Jamatkhana · Mumbai · India"}
              </p>
              <p className="mt-2 text-[10px] text-ivory/45">
                Personal, reflective renderings — not rulings.
              </p>
              <div className="mt-7 flex gap-2 justify-center">
                <Link
                  to="/"
                  data-testid="dua-credit-home"
                  className="inline-flex items-center gap-2 rounded-full border border-ivory/20 bg-ivory/10 px-5 py-3 text-sm font-medium text-ivory tap-scale"
                >
                  <Home className="h-4 w-4" />
                  Home
                </Link>
                <Link
                  to="/noor"
                  data-testid="dua-credit-noor"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-deep tap-scale"
                  style={{ background: "linear-gradient(135deg, #F4D88A 0%, #E8C36A 100%)" }}
                >
                  <Sparkles className="h-4 w-4" />
                  Sit with Noor
                </Link>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Floating filter */}
      {!loading && slides.length > 0 && (
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          data-testid="dua-filter-toggle"
          className="fixed bottom-7 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full text-deep shadow-2xl tap-scale"
          style={{ background: "linear-gradient(135deg, #F4D88A 0%, #E8C36A 100%)" }}
          aria-label="Jump to a rakaat"
        >
          <ListFilter className="h-5 w-5" />
        </button>
      )}

      {/* Filter sheet */}
      {filterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm"
          onClick={() => setFilterOpen(false)}
          data-testid="dua-filter-sheet"
        >
          <div
            className="w-full max-w-[480px] rounded-t-[28px] bg-[#0F3D36] p-6 text-ivory shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-ivory/20" />
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg">Jump to a Rakaat</h3>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                data-testid="dua-filter-close"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ivory/10 tap-scale"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-ivory/60">
              The Holy Du'a is recited in six gentle rakaats.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {rakaatGroups.map((g) => {
                const theme = RAKAAT_THEMES[g.rakaat] || RAKAAT_THEMES[1];
                const active = currentRakaat === g.rakaat;
                return (
                  <button
                    key={g.rakaat}
                    onClick={() => jumpToRakaat(g.rakaat)}
                    data-testid={`dua-filter-rakaat-${g.rakaat}`}
                    className={`relative overflow-hidden rounded-2xl border p-4 text-left tap-scale ${
                      active ? "border-[#E8C36A]" : "border-ivory/15"
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.via} 100%)`,
                    }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-[0.22em]"
                      style={{ color: theme.accent }}
                    >
                      Rakaat {["", "I", "II", "III", "IV", "V", "VI"][g.rakaat]}
                    </span>
                    <p className="mt-1.5 font-display text-base leading-tight text-ivory">
                      {theme.label.split("· ")[1] || theme.label}
                    </p>
                    <p className="mt-2 text-[10px] text-ivory/55">
                      {g.count} verses
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Arabic modal */}
      {arabicOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-6"
          onClick={() => setArabicOpen(null)}
          data-testid="dua-arabic-modal"
        >
          <div
            className="w-full max-w-[420px] rounded-3xl border border-ivory/15 p-8 text-center text-ivory shadow-2xl"
            style={{
              background:
                "linear-gradient(160deg, rgba(15,61,54,0.95) 0%, rgba(10,40,32,0.95) 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{ color: RAKAAT_THEMES[arabicOpen.rakaat]?.accent }}
            >
              {arabicOpen.title}
            </p>
            <p
              dir="rtl"
              className="mt-6 text-right leading-[1.9] text-ivory"
              style={{
                fontFamily: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif",
                fontSize: "clamp(26px, 6.5vw, 36px)",
              }}
              data-testid="dua-arabic-text"
            >
              {arabicOpen.arabic || "—"}
            </p>
            <div className="mt-6 h-px w-12 mx-auto bg-gradient-to-r from-transparent via-[#E8C36A] to-transparent" />
            <p className="mt-5 text-sm italic text-ivory/75">
              {arabicOpen.transliteration}
            </p>
            <button
              type="button"
              onClick={() => setArabicOpen(null)}
              data-testid="dua-arabic-close"
              className="mt-7 inline-flex w-full items-center justify-center rounded-full border border-ivory/20 bg-ivory/10 px-5 py-3 text-sm font-medium text-ivory tap-scale"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
