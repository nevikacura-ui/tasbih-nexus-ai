import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Sparkles, Heart, Languages, ListFilter, X } from "lucide-react";
import { api } from "../lib/api";

// Cinematic palette per rakaat — mosque-silhouette inspired gradients.
const RAKAAT_THEMES = {
  1: { from: "#0a2820", via: "#0F3D36", to: "#1f5448", accent: "#E8C36A", label: "Rakaat I · Fatiha & Salawat" },
  2: { from: "#1a2d3a", via: "#1f4a52", to: "#2d6b66", accent: "#F4D88A", label: "Rakaat II · Peace & Reliance" },
  3: { from: "#2b1b3a", via: "#3d2a55", to: "#4c3a6e", accent: "#E8C36A", label: "Rakaat III · Tawhid & Wilayah" },
  4: { from: "#3a1f1f", via: "#5a2e2e", to: "#6e4242", accent: "#F4D88A", label: "Rakaat IV · The Covenant" },
  5: { from: "#1c2f1c", via: "#2f4a2f", to: "#3d6e3d", accent: "#E8C36A", label: "Rakaat V · Trust in Time" },
  6: { from: "#0e2840", via: "#1a4565", to: "#2d6688", accent: "#F4D88A", label: "Rakaat VI · Ikhlas & Didar" },
};

// SVG mosque silhouette — soft, abstract, drawn once and reused.
const MosqueSilhouette = ({ color = "rgba(232,195,106,0.18)" }) => (
  <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-1/2 w-full pointer-events-none">
    <defs>
      <linearGradient id="mosqueFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0" />
        <stop offset="100%" stopColor={color} stopOpacity="1" />
      </linearGradient>
    </defs>
    {/* Side minarets */}
    <path d="M30,200 L30,80 Q35,72 35,68 Q35,60 30,55 Q25,60 25,68 Q25,72 30,80 Z M30,80 L36,80 L36,200 Z" fill="url(#mosqueFade)" />
    <path d="M370,200 L370,80 Q375,72 375,68 Q375,60 370,55 Q365,60 365,68 Q365,72 370,80 Z M364,80 L376,80 L376,200 Z" fill="url(#mosqueFade)" />
    {/* Central dome + arch */}
    <path d="M120,200 L120,140 Q120,90 200,80 Q280,90 280,140 L280,200 Z" fill="url(#mosqueFade)" />
    <circle cx="200" cy="80" r="6" fill={color} opacity="0.6" />
    {/* Side wings */}
    <path d="M60,200 L60,150 L110,150 L110,200 Z M290,200 L290,150 L340,150 L340,200 Z" fill="url(#mosqueFade)" />
  </svg>
);

// Soft radial light rays
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

function DuaCard({ item, index, total, onTapArabic }) {
  const theme = RAKAAT_THEMES[item.rakaat] || RAKAAT_THEMES[1];
  return (
    <section
      data-testid={`dua-card-${item.id}`}
      className="relative flex h-[100svh] w-full snap-start snap-always items-center justify-center overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${theme.from} 0%, ${theme.via} 45%, ${theme.to} 100%)`,
      }}
    >
      <LightRays accent={theme.accent} />
      <MosqueSilhouette color={`${theme.accent}33`} />
      <GrainTexture />

      {/* Card content (transliteration top, english below) */}
      <div className="relative z-10 flex h-full w-full flex-col px-7 pt-24 pb-32 text-ivory">
        {/* Top label */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em]"
            style={{ background: `${theme.accent}22`, color: theme.accent, border: `1px solid ${theme.accent}44` }}
            data-testid={`dua-rakaat-tag-${item.id}`}
          >
            <Sparkles className="h-3 w-3" />
            {theme.label}
          </span>
        </div>

        {/* Title — small accent */}
        <p
          className="mt-7 font-display text-[13px] tracking-[0.18em] uppercase"
          style={{ color: theme.accent }}
        >
          {item.title}
        </p>

        {/* TRANSLITERATION — large, primary */}
        <h2
          className="mt-3 font-display leading-[1.18] text-ivory"
          style={{
            fontSize: "clamp(28px, 7.6vw, 44px)",
            textShadow: "0 2px 30px rgba(0,0,0,0.35)",
            letterSpacing: "-0.01em",
          }}
          data-testid={`dua-translit-${item.id}`}
        >
          {item.transliteration}
        </h2>

        {/* Divider hairline */}
        <div
          className="my-6 h-px w-12"
          style={{ background: `linear-gradient(90deg, ${theme.accent} 0%, transparent 100%)` }}
        />

        {/* English — below */}
        <p
          className="text-[15px] leading-relaxed text-ivory/85"
          style={{ textShadow: "0 1px 16px rgba(0,0,0,0.3)" }}
          data-testid={`dua-english-${item.id}`}
        >
          {item.english}
        </p>

        {/* Push the bottom action to footer */}
        <div className="mt-auto flex items-center justify-between pt-6">
          <button
            type="button"
            onClick={() => onTapArabic(item)}
            data-testid={`dua-arabic-btn-${item.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-ivory/25 bg-ivory/10 px-4 py-2 text-[12px] font-medium text-ivory backdrop-blur-md transition-all hover:bg-ivory/20 tap-scale"
          >
            <Languages className="h-3.5 w-3.5" />
            Tap for Arabic
          </button>

          <span
            className="rounded-full bg-ivory/10 px-3 py-1 text-[10px] tracking-widest text-ivory/65 backdrop-blur-md"
            data-testid={`dua-counter-${item.id}`}
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
  const scrollerRef = useRef(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get("/dua");
        const list = r.data.dua || [];
        // Sort by rakaat, then order, just in case
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

  // Track current rakaat as user scrolls
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || items.length === 0) return;
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
  }, [items, currentRakaat]);

  const rakaatGroups = useMemo(() => {
    const map = new Map();
    items.forEach((d, idx) => {
      const r = d.rakaat || 1;
      if (!map.has(r)) map.set(r, { rakaat: r, firstIndex: idx, count: 0 });
      map.get(r).count += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.rakaat - b.rakaat);
  }, [items]);

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
          to="/profile"
          data-testid="dua-back"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-ivory/20 bg-black/35 text-ivory backdrop-blur-md tap-scale"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="pointer-events-auto flex items-center gap-2">
          <div
            className="rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] backdrop-blur-md"
            style={{ background: "rgba(0,0,0,0.35)", borderColor: `${activeTheme.accent}55`, color: activeTheme.accent }}
            data-testid="dua-current-rakaat"
          >
            Rakaat {["", "I", "II", "III", "IV", "V", "VI"][currentRakaat]}
          </div>
        </div>
      </header>

      {/* Loading state */}
      {loading && (
        <div className="flex h-[100svh] items-center justify-center bg-gradient-to-b from-[#0a2820] to-[#0F3D36] text-ivory" data-testid="dua-loading">
          <p className="text-xs uppercase tracking-[0.3em] text-ivory/60">Loading the Du'a…</p>
        </div>
      )}

      {/* Snap scroller */}
      {!loading && items.length > 0 && (
        <div
          ref={scrollerRef}
          className="h-[100svh] w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
          style={{ scrollBehavior: "smooth" }}
          data-testid="dua-scroller"
        >
          {items.map((item, idx) => {
            const isFirstOfRakaat =
              idx === 0 || items[idx - 1].rakaat !== item.rakaat;
            return (
              <div
                key={item.id}
                data-rakaat={item.rakaat}
                {...(isFirstOfRakaat ? { "data-rakaat-anchor": item.rakaat } : {})}
              >
                <DuaCard
                  item={item}
                  index={idx}
                  total={items.length}
                  onTapArabic={setArabicOpen}
                />
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
              <Link
                to="/noor"
                data-testid="dua-credit-noor"
                className="mt-7 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-deep tap-scale"
                style={{ background: "linear-gradient(135deg, #F4D88A 0%, #E8C36A 100%)" }}
              >
                <Sparkles className="h-4 w-4" />
                Sit with Noor
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* Floating filter (bottom-right) */}
      {!loading && items.length > 0 && (
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

      {/* Filter / Rakaat jump sheet */}
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

      {/* Arabic tap-to-expand modal */}
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
                fontSize: "clamp(28px, 7vw, 38px)",
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
