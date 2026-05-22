import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Sparkles, Heart, Languages, ListFilter, X, Home, Check, Play, Pause, Repeat, Bookmark, Share2, BookOpenText, PenLine } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ShareTasbihButton } from "../components/ShareTasbihButton";

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

function DuaHalf({ item, accent, onTapArabic, onPlay, isPlaying, isLoading, progress, isBookmarked, onToggleBookmark, onShare }) {
  const showProgress = isPlaying || (progress && progress > 0 && progress < 1);
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

        {/* Bookmark + Share — auto-pushed to the right */}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleBookmark && onToggleBookmark(item); }}
            data-testid={`dua-bookmark-${item.id}`}
            aria-pressed={!!isBookmarked}
            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this verse"}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-all tap-scale"
            style={{
              background: isBookmarked ? `${accent}33` : "rgba(255,255,255,0.06)",
              border: `1px solid ${isBookmarked ? accent : "rgba(255,255,255,0.14)"}`,
              color: isBookmarked ? accent : "rgba(247,243,236,0.7)",
              boxShadow: isBookmarked ? `0 0 14px ${accent}55` : "none",
            }}
          >
            <Bookmark className="h-3.5 w-3.5" fill={isBookmarked ? accent : "none"} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onShare && onShare(item); }}
            data-testid={`dua-share-${item.id}`}
            aria-label="Share this verse"
            className="flex h-8 w-8 items-center justify-center rounded-full transition-all tap-scale"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "rgba(247,243,236,0.7)",
            }}
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Soft progress bar — appears under the card while the verse plays */}
      <div
        className={`mt-3 h-[2px] w-full overflow-hidden rounded-full bg-ivory/8 transition-opacity duration-300 ${
          showProgress ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden={!showProgress}
        data-testid={`dua-progress-${item.id}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-linear"
          style={{
            width: `${Math.max(0, Math.min(1, progress || 0)) * 100}%`,
            background: `linear-gradient(90deg, ${accent}88 0%, ${accent} 100%)`,
            boxShadow: `0 0 12px ${accent}99`,
          }}
        />
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

function ImamListInterlude({ data, index, total, rakaat, autoAdvance, onComplete, voice, autoPlayActive, masterDrivenName }) {
  const theme = RAKAAT_THEMES[rakaat] || RAKAAT_THEMES[6];
  const [recited, setRecited] = useState(() => new Set());
  const [playingIdx, setPlayingIdx] = useState(null); // index of name being recited (local mode only)
  const audioRef = useRef(null);
  const cancelRef = useRef(false);
  if (!audioRef.current && typeof window !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
  }

  // When master MP3 is driving playback, derive the active index from masterDrivenName
  const masterIdx = useMemo(() => {
    if (!masterDrivenName || !data.names) return -1;
    return data.names.findIndex((n) => n === masterDrivenName);
  }, [masterDrivenName, data.names]);
  const activeIdx = autoPlayActive ? masterIdx : playingIdx;

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

  // React to parent's master Play All — when master is active, DO NOT spawn a
  // second local <audio> stream (the master MP3 already contains all 50 names —
  // running both would overlay two voices reciting "Mawlana Aly" simultaneously,
  // which the user hears as a ghost/background voice). Only stop any in-flight
  // local recitation if it was running.
  useEffect(() => {
    if (autoPlayActive) {
      if (playingIdx !== null) stopRecite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayActive]);

  // When master is driving the audio, mirror the active-name index into the
  // `recited` set so users see verses tick off visually as they're heard.
  useEffect(() => {
    if (!autoPlayActive || masterIdx < 0) return;
    setRecited((prev) => {
      if (prev.has(masterIdx)) return prev;
      const next = new Set(prev);
      next.add(masterIdx);
      return next;
    });
    // Auto-scroll the active name into view
    const node = document.querySelector(`[data-testid="dua-imam-tick-${masterIdx + 1}"]`);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [autoPlayActive, masterIdx]);

  const isReciting = playingIdx !== null;
  const masterInCharge = !!autoPlayActive;

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
              disabled={masterInCharge}
              data-testid="dua-interlude-recite-all"
              aria-label={isReciting ? "Stop recitation" : "Recite all 50 names"}
              title={masterInCharge ? "Master Play All is reciting — pause it to use this" : ""}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] transition-all tap-scale disabled:opacity-40 disabled:cursor-not-allowed"
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
            const isActive = activeIdx === i;
            return (
              <li key={`${n}-${i}`} className="relative">
                {/* 0.5 s gold pulse that re-runs each time this row becomes active */}
                {isActive && (
                  <span
                    key={`pulse-${activeIdx}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{
                      animation: "imam-name-pulse 700ms ease-out 1",
                      boxShadow: `0 0 28px ${theme.accent}, 0 0 12px ${theme.accent}aa inset`,
                      background: `radial-gradient(ellipse at center, ${theme.accent}33 0%, transparent 70%)`,
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  data-testid={`dua-imam-tick-${i + 1}`}
                  className={`relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all tap-scale ${
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

function DuaPairCard({ pair, index, total, onTapArabic, onPlay, playingId, loadingId, audioProgress, bookmarkIds, onToggleBookmark, onShare }) {
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
            progress={playingId === a.id ? audioProgress : 0}
            isBookmarked={bookmarkIds && bookmarkIds.has(a.id)}
            onToggleBookmark={onToggleBookmark}
            onShare={onShare}
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
              progress={playingId === b.id ? audioProgress : 0}
              isBookmarked={bookmarkIds && bookmarkIds.has(b.id)}
              onToggleBookmark={onToggleBookmark}
              onShare={onShare}
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
  return <DuaPageInner />;
}

function DuaCompletionModal({ isGuest, onClose }) {
  const [reflection, setReflection] = useState("");
  const [mood, setMood] = useState(null); // "peaceful" | "moved" | "grateful" | "still"
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  const moodOptions = [
    { id: "peaceful", label: "Peaceful" },
    { id: "moved", label: "Moved" },
    { id: "grateful", label: "Grateful" },
    { id: "still", label: "Still" },
  ];

  const onSave = async () => {
    if (!reflection.trim() && !mood) return;
    setSaving(true);
    setErr(null);
    try {
      await api.post("/journal", {
        title: "After the Holy Du'a",
        body: reflection.trim() || `Mood after Du'a: ${mood}`,
        mood_after: mood || undefined,
        tags: ["holy_dua", "after_dua"],
      });
      setSaved(true);
      setTimeout(() => onClose(), 1400);
    } catch (e) {
      setErr("Your reflection couldn't be saved right now. Please try once more.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md px-5 animate-float-up"
      data-testid="dua-completion-modal"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[440px] overflow-hidden rounded-[28px] border border-[#E8C36A]/40 shadow-2xl"
        style={{
          background: "linear-gradient(165deg, #0a2820 0%, #0F3D36 45%, #1f5448 100%)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 40px rgba(232,195,106,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Halo behind the seal */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-44 w-44 -translate-x-1/2 -translate-y-1/3 rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, rgba(232,195,106,0.45) 0%, transparent 65%)" }}
          aria-hidden="true"
        />
        {/* Drifting gold dust particles */}
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className="pointer-events-none absolute h-1 w-1 rounded-full bg-[#E8C36A]/70 animate-drift-particle"
            style={{
              top: `${12 + i * 17}%`,
              left: `${8 + i * 19}%`,
              animationDelay: `${i * 0.6}s`,
              boxShadow: "0 0 10px rgba(232,195,106,0.9)",
            }}
          />
        ))}
        <MosqueSilhouette color="rgba(232,195,106,0.16)" />

        <div className="relative px-7 pt-12 pb-6 text-center text-ivory">
          {/* Gold seal */}
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{
              background: "linear-gradient(135deg, #F4D88A 0%, #E8C36A 60%, #C9A46A 100%)",
              boxShadow: "0 12px 28px rgba(232,195,106,0.55), inset 0 1px 0 rgba(255,255,255,0.45)",
            }}
          >
            <Sparkles className="h-7 w-7 text-deep" strokeWidth={2.2} />
          </div>

          <p className="mt-5 text-[10px] uppercase tracking-[0.32em] text-[#E8C36A]">
            Yā ʿAlī madad · Your Du'a is complete
          </p>
          <h2
            className="mt-3 font-display italic leading-[1.18]"
            style={{ fontSize: "clamp(22px, 6vw, 28px)" }}
            data-testid="dua-completion-title"
          >
            Carry the noor with you.
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-ivory/75">
            Take a soft breath. What stayed with you most? A line, a name, a feeling — write a small note for your Sangat.
          </p>

          {!isGuest && !saved && (
            <div className="mt-5 text-left">
              {/* Mood pills */}
              <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-ivory/45">
                A word for how you feel
              </p>
              <div className="flex flex-wrap gap-1.5">
                {moodOptions.map((m) => {
                  const on = mood === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMood(on ? null : m.id)}
                      data-testid={`dua-completion-mood-${m.id}`}
                      className="rounded-full px-3 py-1.5 text-[11px] tap-scale transition-all"
                      style={{
                        background: on ? "#E8C36A" : "rgba(255,255,255,0.06)",
                        color: on ? "#0F3D36" : "rgba(247,243,236,0.78)",
                        border: `1px solid ${on ? "#F4D88A" : "rgba(255,255,255,0.14)"}`,
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {/* Reflection textarea */}
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value.slice(0, 280))}
                placeholder="One line, one breath, one prayer…"
                rows={3}
                data-testid="dua-completion-reflection"
                className="mt-4 w-full rounded-2xl border border-ivory/15 bg-black/30 px-4 py-3 text-[13px] leading-relaxed text-ivory placeholder:text-ivory/35 outline-none focus:border-[#E8C36A]/55"
                style={{ resize: "none" }}
              />
              <div className="mt-1 text-right text-[10px] text-ivory/35">{reflection.length}/280</div>

              {err && (
                <p className="mt-2 rounded-xl bg-red-900/30 px-3 py-2 text-[11px] text-red-300/90">{err}</p>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  data-testid="dua-completion-later"
                  className="rounded-full border border-ivory/15 px-4 py-3 text-[12px] text-ivory/75 backdrop-blur-md tap-scale"
                >
                  Maybe later
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving || (!reflection.trim() && !mood)}
                  data-testid="dua-completion-save"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-3 text-[12px] font-semibold text-deep tap-scale disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #F4D88A 0%, #E8C36A 100%)" }}
                >
                  <PenLine className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Add to Sangat"}
                </button>
              </div>
            </div>
          )}

          {!isGuest && saved && (
            <div
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#E8C36A]/15 px-4 py-2.5 text-[12px] text-[#E8C36A]"
              data-testid="dua-completion-saved"
            >
              <Check className="h-4 w-4" />
              Saved to your Sangat
            </div>
          )}

          {isGuest && (
            <div className="mt-5">
              <Link
                to="/login"
                data-testid="dua-completion-signin"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[12px] font-semibold text-deep tap-scale"
                style={{ background: "linear-gradient(135deg, #F4D88A 0%, #E8C36A 100%)" }}
                onClick={onClose}
              >
                <BookOpenText className="h-4 w-4" />
                Sign in to save this moment
              </Link>
              <button
                type="button"
                onClick={onClose}
                data-testid="dua-completion-close-guest"
                className="mt-3 block w-full text-center text-[11px] text-ivory/45 tap-scale"
              >
                Continue without saving
              </button>
            </div>
          )}

          {/* Calm "Share Tasbih" affordance — appears for both guests and members
              after the main CTA. Premium pre-filled WhatsApp message + OG preview. */}
          <div className="mt-4 flex justify-center">
            <ShareTasbihButton
              testId="dua-completion-share-tasbih"
              label="Share Tasbih with a friend"
              variant="ghost"
              className="text-[11px] py-1.5 px-3"
            />
          </div>
        </div>

        {/* Bottom gold seam */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent 0%, rgba(232,195,106,0.55) 50%, transparent 100%)" }}
        />
      </div>
    </div>
  );
}

function ShareCardModal({ item, theme, onClose }) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const text = `${item.transliteration}\n— ${item.english}\n\nFrom the Holy Du'a · Tasbih.ai`;
  const url = (typeof window !== "undefined" ? window.location.origin : "") + "/dua";

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) { /* ignore */ }
  };

  const onNativeShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      onCopy();
      return;
    }
    setSharing(true);
    try {
      await navigator.share({ title: `${item.title} · Holy Du'a`, text, url });
    } catch (e) { /* user cancelled */ }
    finally { setSharing(false); }
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/75 backdrop-blur-md px-5"
      onClick={onClose}
      data-testid="dua-share-modal"
    >
      <div
        className="w-full max-w-[420px] rounded-3xl border p-1 shadow-2xl"
        style={{ borderColor: `${theme.accent}55` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Beautiful share preview card */}
        <div
          className="relative overflow-hidden rounded-[22px] p-7 text-center text-ivory"
          style={{
            background: `linear-gradient(180deg, ${theme.from} 0%, ${theme.via} 60%, ${theme.to} 100%)`,
          }}
          data-testid="dua-share-preview"
        >
          <LightRays accent={theme.accent} />
          <MosqueSilhouette color={`${theme.accent}33`} />
          <GrainTexture />

          <div className="relative z-10">
            <p
              className="text-[10px] uppercase tracking-[0.32em]"
              style={{ color: theme.accent }}
            >
              {item.title}
            </p>
            {item.arabic && (
              <p
                dir="rtl"
                className="mt-5 leading-[1.85]"
                style={{
                  fontFamily: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif",
                  fontSize: "clamp(22px, 5.6vw, 30px)",
                  color: "#F4D88A",
                }}
              >
                {item.arabic}
              </p>
            )}
            <div className="mt-4 mx-auto h-px w-10" style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }} />
            <h3
              className="mt-4 font-display italic leading-[1.25]"
              style={{ fontSize: "clamp(18px, 5vw, 24px)" }}
            >
              {item.transliteration}
            </h3>
            <p className="mt-3 text-[13px] leading-relaxed text-ivory/80">
              {item.english}
            </p>
            <p className="mt-6 text-[9px] uppercase tracking-[0.32em] text-ivory/45">
              Holy Du'a · Tasbih.ai
            </p>
          </div>
        </div>

        {/* Action row */}
        <div className="mt-2 grid grid-cols-2 gap-2 px-3 pb-3 pt-2">
          <button
            type="button"
            onClick={onCopy}
            data-testid="dua-share-copy"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-ivory/15 bg-black/55 px-4 py-3 text-[12px] font-medium text-ivory tap-scale"
          >
            {copied ? <Check className="h-4 w-4" /> : <Languages className="h-4 w-4" />}
            {copied ? "Copied" : "Copy text"}
          </button>
          <button
            type="button"
            onClick={onNativeShare}
            disabled={sharing}
            data-testid="dua-share-native"
            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-[12px] font-semibold text-deep tap-scale disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #F4D88A 0%, #E8C36A 100%)" }}
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          data-testid="dua-share-close"
          className="mb-2 mx-auto block w-fit px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-ivory/55 tap-scale"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function DuaPageInner() {
  const [items, setItems] = useState([]);
  const [credit, setCredit] = useState("");
  const [loading, setLoading] = useState(true);
  const [arabicOpen, setArabicOpen] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentRakaat, setCurrentRakaat] = useState(1);
  const [playingId, setPlayingId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [audioProgress, setAudioProgress] = useState(0); // 0..1
  const [autoAdvance, setAutoAdvance] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("dua.autoAdvance");
    return stored === null ? true : stored === "true"; // DEFAULT: Auto
  });
  useEffect(() => {
    try { localStorage.setItem("dua.autoAdvance", String(autoAdvance)); } catch (e) { /* ignore */ }
  }, [autoAdvance]);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false); // master "Play All" active?
  const [ambientMode, setAmbientMode] = useState(true); // dim everything when Play All is on
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const isAutoPlayingRef = useRef(false);
  useEffect(() => { isAutoPlayingRef.current = isAutoPlaying; }, [isAutoPlaying]);
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

  // slidesRef holds the latest slides array for callbacks that close over an older render.
  // We declare it before any callbacks reference it; it is hydrated by an effect below
  // after `slides` is computed.
  const slidesRef = useRef([]);

  // ── Resume "Pick up where you left off" ────────────────────────
  const [resumeInfo, setResumeInfo] = useState(null); // { position_ms, voice, duration_ms }
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const pendingSeekMsRef = useRef(null); // set when user taps the Resume pill; applied on onplaying

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/dua/progress");
        const pos = Number(r.data?.position_ms || 0);
        if (pos > 20000) { // only show resume if >20s in
          setResumeInfo({ position_ms: pos, voice: r.data.voice || "male", duration_ms: r.data.duration_ms || 0 });
        }
      } catch (e) { /* not logged-in or no row yet */ }
    })();
  }, []);

  // ── Bookmarks ──────────────────────────────────────────────────
  const [bookmarkIds, setBookmarkIds] = useState(() => new Set());
  const [shareCard, setShareCard] = useState(null); // dua object being shared

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/dua/bookmarks");
        setBookmarkIds(new Set(r.data.ids || []));
      } catch (e) { /* guest or not logged in */ }
    })();
  }, []);

  const toggleBookmark = useCallback(async (dua) => {
    const isOn = bookmarkIds.has(dua.id);
    // Optimistic UI
    setBookmarkIds((prev) => {
      const next = new Set(prev);
      if (isOn) next.delete(dua.id);
      else next.add(dua.id);
      return next;
    });
    try {
      if (isOn) await api.delete(`/dua/bookmarks/${dua.id}`);
      else await api.post("/dua/bookmarks", { dua_id: dua.id });
    } catch (e) {
      // Roll back on failure
      setBookmarkIds((prev) => {
        const next = new Set(prev);
        if (isOn) next.add(dua.id);
        else next.delete(dua.id);
        return next;
      });
    }
  }, [bookmarkIds]);

  // ── Audio playback ─────────────────────────────────────────────
  const [fullTimeline, setFullTimeline] = useState(null); // [{id, kind, slide_idx, start_ms, end_ms, ...}]
  const [fullSegIdx, setFullSegIdx] = useState(-1);
  const wakeLockRef = useRef(null);

  // ── Du'a completion overlay ────────────────────────────────────
  // Fires ONLY on natural audio end (not when user pauses) — celebrates the
  // moment and invites a one-tap Sangat reflection.
  const [completionOpen, setCompletionOpen] = useState(false);
  const { user } = useAuth() || {};
  const isGuest = !user || user.status !== "member";

  // Dev-only smoke hook so screenshot/test agents can render the modal without
  // waiting for a full 5-minute audio playthrough. Safe in production — only
  // attached when ?testdua=1 is in the URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("testdua")) return;
    window.__tasbihTriggerCompletion = () => setCompletionOpen(true);
    return () => { try { delete window.__tasbihTriggerCompletion; } catch (e) {} };
  }, []);

  // Acquire / release screen wake lock so the phone doesn't sleep during recitation
  const acquireWakeLock = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener?.("release", () => { wakeLockRef.current = null; });
      }
    } catch (e) { /* user denied / unsupported */ }
  }, []);
  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) { await wakeLockRef.current.release(); wakeLockRef.current = null; }
    } catch (e) { /* ignore */ }
  }, []);
  // Re-acquire on visibility return (wake lock auto-releases on tab hide)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && isAutoPlayingRef.current && !wakeLockRef.current) {
        acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [acquireWakeLock]);

  const stopAudio = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      try { el.pause(); el.currentTime = 0; } catch (e) { /* ignore */ }
    }
    setPlayingId(null);
    setLoadingId(null);
    setAudioProgress(0);
    setFullSegIdx(-1);
    releaseWakeLock();
  }, [releaseWakeLock]);

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
    setAudioProgress(0);
    const url = `${API_BASE}/api/dua/${dua.id}/audio?voice=${voice}`;
    el.src = url;
    el.onended = () => {
      setPlayingId(null);
      setAudioProgress(1);
      const chain = isAutoPlayingRef.current || autoAdvanceRef.current;
      if (!chain) return;
      // If this verse is the TOP of a pair, play the bottom verse next on the same card.
      const slide = slidesRef.current.find(
        (s) => s.kind === "pair" && (s.items[0]?.id === dua.id || s.items[1]?.id === dua.id)
      );
      const isTopOfPair = slide && slide.items[0]?.id === dua.id && slide.items[1];
      if (isTopOfPair) {
        setTimeout(() => playDua(slide.items[1]), 600);
      } else {
        setTimeout(() => scrollToNext(), 900);
      }
    };
    el.onerror = () => { setPlayingId(null); setLoadingId(null); setAudioProgress(0); };
    el.onplaying = () => { setLoadingId(null); setPlayingId(dua.id); };
    el.ontimeupdate = () => {
      if (el.duration && isFinite(el.duration) && el.duration > 0) {
        setAudioProgress(Math.min(1, el.currentTime / el.duration));
      }
    };
    el.play().catch((e) => { setLoadingId(null); setPlayingId(null); setAudioProgress(0); console.warn("audio play failed", e); });
  }, [playingId, stopAudio, scrollToNext, voice]);

  // Master Play All: per-slide auto-trigger is intentionally disabled here.
  // The single-MP3 mode (built in `toggleAutoPlay`) handles all slide chaining
  // by listening to the audio's timeupdate event and scrolling cards in sync
  // with the precomputed timeline.

  // Reset timeline cache when voice changes (different MP3, different timestamps)
  useEffect(() => { setFullTimeline(null); }, [voice]);

  // Toggle master Play All — streams the entire Du'a as ONE MP3 (with repeats baked in)
  const toggleAutoPlay = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    if (isAutoPlaying) {
      try { el.pause(); } catch (e) { /* ignore */ }
      setIsAutoPlaying(false);
      setPlayingId(null);
      setLoadingId(null);
      setAudioProgress(0);
      setFullSegIdx(-1);
      releaseWakeLock();
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        try { navigator.mediaSession.playbackState = "paused"; } catch (e) { /* ignore */ }
      }
      return;
    }
    // Start the single-MP3 stream
    setIsAutoPlaying(true);
    setLoadingId("__full__");
    try {
      let tl = fullTimeline;
      if (!tl || tl.length === 0) {
        const r = await fetch(`${API_BASE}/api/full-dua/timeline?voice=${voice}`);
        const j = await r.json();
        tl = j.segments || [];
        setFullTimeline(tl);
      }
      el.pause();
      el.src = `${API_BASE}/api/full-dua/audio?voice=${voice}`;
      el.onended = () => {
        setIsAutoPlaying(false);
        setPlayingId(null);
        setLoadingId(null);
        setAudioProgress(0);
        setFullSegIdx(-1);
        releaseWakeLock();
        // Clear the saved resume position — the user has finished, so the
        // "Pick up where you left off" pill should not reappear next time.
        api.post("/dua/progress", { voice, position_ms: 0, duration_ms: 0 }).catch(() => {});
        // Celebrate the moment with a calm completion card (after a half-second
        // breath so the last verse can settle).
        setTimeout(() => setCompletionOpen(true), 600);
      };
      el.onerror = () => {
        setIsAutoPlaying(false);
        setPlayingId(null);
        setLoadingId(null);
        releaseWakeLock();
      };
      el.onplaying = () => {
        setLoadingId(null);
        // Apply pending resume seek if any (set when the user taps the Resume pill)
        if (pendingSeekMsRef.current !== null && el.duration && isFinite(el.duration)) {
          try { el.currentTime = Math.max(0, Math.min(el.duration - 1, pendingSeekMsRef.current / 1000)); }
          catch (e) { /* ignore */ }
          pendingSeekMsRef.current = null;
          setResumeInfo(null);
        }
      };
      let lastSaveAt = 0;
      el.ontimeupdate = () => {
        if (!el.duration || !isFinite(el.duration)) return;
        setAudioProgress(Math.min(1, el.currentTime / el.duration));
        // Throttle resume-save to once every 5s
        const nowMs = Date.now();
        if (nowMs - lastSaveAt > 5000 && el.currentTime > 1) {
          lastSaveAt = nowMs;
          api.post("/dua/progress", {
            voice,
            position_ms: Math.round(el.currentTime * 1000),
            duration_ms: Math.round(el.duration * 1000),
          }).catch(() => { /* silent — guest may 401 */ });
        }
        const cur_ms = el.currentTime * 1000;
        const segs = tl;
        let lo = 0, hi = segs.length - 1, hit = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const s = segs[mid];
          if (cur_ms < s.start_ms) hi = mid - 1;
          else if (cur_ms >= s.end_ms) lo = mid + 1;
          else { hit = mid; break; }
        }
        if (hit < 0) return;
        setFullSegIdx((prev) => (prev === hit ? prev : hit));
        const seg = segs[hit];
        if (seg.kind === "verse") {
          setPlayingId((prev) => (prev === seg.id ? prev : seg.id));
        } else if (seg.kind === "mid") {
          // Mid-insert audio is part of its parent pair card. Highlight the
          // PARENT verse (strip "_mid" suffix) so the user sees continuity
          // rather than a blank "playing" indicator.
          const parentId = seg.id.replace(/_mid$/, "");
          setPlayingId((prev) => (prev === parentId ? prev : parentId));
        } else {
          setPlayingId(null);
        }
        if (typeof seg.slide_idx === "number") {
          setCurrentSlideIdx((prev) => {
            if (prev !== seg.slide_idx) {
              const sc = scrollerRef.current;
              if (sc) {
                const node = sc.querySelector(`[data-slide-idx="${seg.slide_idx}"]`);
                if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
              }
              return seg.slide_idx;
            }
            return prev;
          });
        }
      };
      await el.play();
      // Acquire wake lock once playback has actually started
      acquireWakeLock();
      // Media session metadata for lock-screen
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        try {
          navigator.mediaSession.metadata = new window.MediaMetadata({
            title: "Holy Du'a",
            artist: voice === "female" ? "Tasbih.ai · Female reciter" : "Tasbih.ai · Chaouki",
            album: "Six Rakaats · Ismaili Du'a",
          });
          navigator.mediaSession.playbackState = "playing";
          navigator.mediaSession.setActionHandler("pause", () => { toggleAutoPlay(); });
          navigator.mediaSession.setActionHandler("play", () => { toggleAutoPlay(); });
          navigator.mediaSession.setActionHandler("stop", () => { toggleAutoPlay(); });
        } catch (e) { /* unsupported */ }
      }
    } catch (e) {
      console.warn("full Du'a play failed", e);
      setIsAutoPlaying(false);
      setLoadingId(null);
      releaseWakeLock();
    }
  }, [isAutoPlaying, voice, fullTimeline, acquireWakeLock, releaseWakeLock]);

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

  // Track current rakaat and slide as user scrolls
  useEffect(() => { slidesRef.current = slides; }, [slides]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || slides.length === 0) return;
    const cards = el.querySelectorAll("[data-rakaat]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const rk = Number(e.target.getAttribute("data-rakaat"));
            const sIdx = Number(e.target.getAttribute("data-slide-idx"));
            if (rk && rk !== currentRakaat) setCurrentRakaat(rk);
            if (!Number.isNaN(sIdx)) setCurrentSlideIdx(sIdx);
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

  // Currently-playing segment + verse (for the "Sit with Du'a" ambient overlay)
  const currentSeg = fullSegIdx >= 0 && fullTimeline ? fullTimeline[fullSegIdx] : null;
  const currentVerse = useMemo(() => {
    if (!currentSeg) return null;
    if (currentSeg.kind === "verse") return items.find((d) => d.id === currentSeg.id) || null;
    if (currentSeg.kind === "name") return { isImamName: true, name: currentSeg.id.replace(/^imam:/, "") };
    if (currentSeg.kind === "mid") {
      // Mid-insert lives as a sub-property on the parent verse. Reconstruct a
      // verse-shaped object so the ambient overlay can render its Arabic +
      // transliteration cleanly during playback.
      const parentId = currentSeg.id.replace(/_mid$/, "");
      const parent = items.find((d) => d.id === parentId);
      const mi = parent?.mid_insert;
      if (!mi) return parent || null;
      return {
        id: currentSeg.id,
        title: mi.title || parent?.title,
        transliteration: mi.transliteration,
        arabic: mi.arabic,
        english: mi.english,
        rakaat: parent?.rakaat,
        isMidInsert: true,
      };
    }
    return null;
  }, [currentSeg, items]);
  const fmtTime = (ms) => {
    const total = Math.max(0, Math.floor((ms || 0) / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };
  const fullDurationMs = fullTimeline && fullTimeline.length ? fullTimeline[fullTimeline.length - 1].end_ms : 0;
  const fullCurrentMs = currentSeg ? Math.round(audioProgress * fullDurationMs) : 0;

  // Rakaat chapter markers along the scrubber. For each rakaat (1..6), find the
  // FIRST segment that maps to that rakaat's opening slide.
  const rakaatMarkers = useMemo(() => {
    if (!fullTimeline || !fullTimeline.length || !fullDurationMs || !slides.length) return [];
    const out = [];
    const seenRakaats = new Set();
    for (let i = 0; i < fullTimeline.length; i++) {
      const seg = fullTimeline[i];
      const slide = slides[seg.slide_idx];
      const r = slide?.rakaat;
      if (r && !seenRakaats.has(r)) {
        seenRakaats.add(r);
        out.push({ rakaat: r, ratio: seg.start_ms / fullDurationMs, start_ms: seg.start_ms });
      }
    }
    return out.sort((a, b) => a.rakaat - b.rakaat);
  }, [fullTimeline, fullDurationMs, slides]);

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
              onClick={() => {
                if (voice !== "male") {
                  stopAudio();
                  setIsAutoPlaying(false);
                  setVoice("male");
                }
              }}
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
              onClick={() => {
                if (voice !== "female") {
                  stopAudio();
                  setIsAutoPlaying(false);
                  setVoice("female");
                }
              }}
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
            onClick={toggleAutoPlay}
            data-testid="dua-play-all"
            aria-pressed={isAutoPlaying}
            aria-label={isAutoPlaying ? "Pause the complete Du'a" : "Play the complete Du'a from the start"}
            title={isAutoPlaying ? "Pause" : "Play the complete Du'a"}
            className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-[10px] uppercase tracking-[0.22em] backdrop-blur-md transition-all tap-scale"
            style={{
              background: isAutoPlaying ? activeTheme.accent : `${activeTheme.accent}22`,
              borderColor: activeTheme.accent,
              color: isAutoPlaying ? "#0F3D36" : activeTheme.accent,
              fontWeight: 600,
              boxShadow: isAutoPlaying ? `0 0 22px ${activeTheme.accent}66` : "none",
            }}
          >
            {isAutoPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isAutoPlaying ? "Pause" : "Play all"}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !autoAdvance;
              setAutoAdvance(next);
              if (!next && isAutoPlaying) {
                setIsAutoPlaying(false);
                stopAudio();
              }
            }}
            data-testid="dua-auto-advance"
            aria-pressed={autoAdvance}
            aria-label={autoAdvance ? "Continuous flow on — verses flow into each other" : "Single mode — one verse at a time"}
            title={autoAdvance ? "Flow on — each verse flows into the next" : "Single — one verse at a time"}
            className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-[10px] uppercase tracking-[0.22em] backdrop-blur-md transition-all tap-scale"
            style={{
              background: autoAdvance ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.25)",
              borderColor: autoAdvance ? `${activeTheme.accent}77` : "rgba(247,243,236,0.18)",
              color: autoAdvance ? activeTheme.accent : "rgba(247,243,236,0.6)",
            }}
          >
            <Repeat className="h-3.5 w-3.5" />
            {autoAdvance ? "Flow" : "Single"}
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
                data-slide-idx={idx}
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
                    audioProgress={audioProgress}
                    bookmarkIds={bookmarkIds}
                    onToggleBookmark={toggleBookmark}
                    onShare={setShareCard}
                  />
                ) : (
                  <ImamListInterlude
                    data={slide.data}
                    index={idx}
                    total={slides.length}
                    rakaat={slide.rakaat}
                    autoAdvance={autoAdvance}
                    voice={voice}
                    autoPlayActive={isAutoPlaying && currentSlideIdx === idx}
                    masterDrivenName={
                      isAutoPlaying && currentSeg && currentSeg.kind === "name"
                        ? currentSeg.id.replace(/^imam:/, "")
                        : null
                    }
                    onComplete={() => {
                      if (isAutoPlayingRef.current || autoAdvanceRef.current) {
                        setTimeout(scrollToNext, 900);
                      }
                    }}
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

      {/* Resume "Pick up where you left off" pill — bottom-left, calm gold glass */}
      {!loading && slides.length > 0 && resumeInfo && !resumeDismissed && !isAutoPlaying && (
        <div
          className="fixed bottom-7 left-5 z-40 flex items-center gap-2 max-w-[calc(100%-110px)]"
          data-testid="dua-resume-pill"
        >
          <button
            type="button"
            onClick={() => {
              // Switch voice if saved voice differs, then begin playback at saved pos
              if (resumeInfo.voice && resumeInfo.voice !== voice) {
                setVoice(resumeInfo.voice);
              }
              pendingSeekMsRef.current = resumeInfo.position_ms;
              setResumeDismissed(true);
              // small delay so the voice swap settles in localStorage / state
              setTimeout(() => { toggleAutoPlay(); }, 50);
            }}
            data-testid="dua-resume-play"
            className="group flex items-center gap-2 rounded-full border bg-black/60 px-4 py-2.5 text-left text-[11px] text-ivory backdrop-blur-md shadow-2xl tap-scale"
            style={{ borderColor: "rgba(232,195,106,0.55)", boxShadow: "0 8px 28px rgba(0,0,0,0.45), 0 0 18px rgba(232,195,106,0.25)" }}
            aria-label={`Resume Du'a from ${Math.floor(resumeInfo.position_ms / 60000)} minutes`}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg, #F4D88A 0%, #E8C36A 100%)", color: "#0F3D36" }}
            >
              <Play className="h-3.5 w-3.5 translate-x-[1px]" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[9px] uppercase tracking-[0.22em] text-[#E8C36A]">Pick up where you left off</span>
              <span className="mt-0.5 text-[11px] text-ivory/85">
                Resume from {Math.floor(resumeInfo.position_ms / 60000)}:{String(Math.floor((resumeInfo.position_ms % 60000) / 1000)).padStart(2, "0")}
                {resumeInfo.voice === "female" ? " · F" : " · M"}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setResumeDismissed(true)}
            data-testid="dua-resume-dismiss"
            aria-label="Dismiss resume"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ivory/15 bg-black/45 text-ivory/65 backdrop-blur-md tap-scale"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
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

      {/* Share card modal — preview + native share / clipboard */}
      {shareCard && (
        <ShareCardModal
          item={shareCard}
          theme={RAKAAT_THEMES[shareCard.rakaat] || RAKAAT_THEMES[1]}
          onClose={() => setShareCard(null)}
        />
      )}

      {/* Completion overlay — fires only when the audio finishes naturally. */}
      {completionOpen && (
        <DuaCompletionModal
          isGuest={isGuest}
          onClose={() => setCompletionOpen(false)}
        />
      )}

      {/* ── Sit with Du'a — premium ambient mode ─────────────────── */}
      {isAutoPlaying && ambientMode && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden"
          data-testid="dua-ambient-overlay"
          style={{
            background:
              "radial-gradient(ellipse at 50% 35%, #102d28 0%, #051512 55%, #020807 100%)",
          }}
        >
          {/* Cinematic jamatkhana silhouette (mobile-tuned, 800x420) */}
          <svg
            viewBox="0 0 800 420"
            preserveAspectRatio="xMidYMax slice"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[64%] w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="jkFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(232,195,106,0.0)" />
                <stop offset="55%" stopColor="rgba(232,195,106,0.22)" />
                <stop offset="100%" stopColor="rgba(232,195,106,0.42)" />
              </linearGradient>
              <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(244,216,138,0.95)" />
                <stop offset="50%" stopColor="rgba(244,216,138,0.22)" />
                <stop offset="100%" stopColor="rgba(244,216,138,0)" />
              </radialGradient>
              <radialGradient id="haze" cx="50%" cy="100%" r="50%">
                <stop offset="0%" stopColor="rgba(232,195,106,0.18)" />
                <stop offset="100%" stopColor="rgba(232,195,106,0)" />
              </radialGradient>
            </defs>

            {/* Ground haze */}
            <ellipse cx="400" cy="420" rx="450" ry="60" fill="url(#haze)" />

            {/* Moon — breathing pulse */}
            <circle cx="640" cy="80" r="50" fill="url(#moonGlow)">
              <animate attributeName="r" values="48;58;48" dur="6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;1;0.9" dur="6s" repeatCount="indefinite" />
            </circle>
            <circle cx="640" cy="80" r="18" fill="#F4D88A" opacity="0.92" />

            {/* Stars — subtle twinkles */}
            {[
              [60, 50, 1.4], [180, 100, 1.0], [280, 35, 1.6], [420, 70, 1.2],
              [520, 130, 1.4], [120, 170, 1.0], [340, 165, 1.5], [70, 220, 1.2],
              [720, 140, 1.0], [40, 290, 1.4], [240, 260, 1.0], [780, 60, 1.2],
            ].map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill="#F4D88A">
                <animate attributeName="opacity" values="0.3;0.85;0.3" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" begin={`${i * 0.4}s`} />
              </circle>
            ))}

            {/* Outer left minaret (tall, slim) */}
            <path d="M40,420 L40,200 Q44,188 44,180 Q44,168 40,162 Q36,168 36,180 Q36,188 40,200 Z M35,200 L45,200 L45,420 Z" fill="url(#jkFade)" />
            <circle cx="40" cy="158" r="3" fill="#E8C36A" opacity="0.95" />
            <path d="M36,148 Q40,140 44,148" stroke="#E8C36A" strokeWidth="1.2" fill="none" opacity="0.85" />

            {/* Outer right minaret */}
            <path d="M760,420 L760,200 Q764,188 764,180 Q764,168 760,162 Q756,168 756,180 Q756,188 760,200 Z M755,200 L765,200 L765,420 Z" fill="url(#jkFade)" />
            <circle cx="760" cy="158" r="3" fill="#E8C36A" opacity="0.95" />
            <path d="M756,148 Q760,140 764,148" stroke="#E8C36A" strokeWidth="1.2" fill="none" opacity="0.85" />

            {/* Side wing buildings */}
            <path d="M80,420 L80,300 L190,300 L190,420 Z" fill="url(#jkFade)" />
            <path d="M610,420 L610,300 L720,300 L720,420 Z" fill="url(#jkFade)" />
            {/* Wing arched windows */}
            <path d="M105,420 L105,360 Q105,340 115,340 Q125,340 125,360 L125,420 Z" fill="rgba(232,195,106,0.08)" />
            <path d="M155,420 L155,360 Q155,340 165,340 Q175,340 175,360 L175,420 Z" fill="rgba(232,195,106,0.08)" />
            <path d="M625,420 L625,360 Q625,340 635,340 Q645,340 645,360 L645,420 Z" fill="rgba(232,195,106,0.08)" />
            <path d="M675,420 L675,360 Q675,340 685,340 Q695,340 695,360 L695,420 Z" fill="rgba(232,195,106,0.08)" />

            {/* Inner minarets */}
            <path d="M215,420 L215,240 Q219,230 219,224 Q219,214 215,210 Q211,214 211,224 Q211,230 215,240 Z M210,240 L220,240 L220,420 Z" fill="url(#jkFade)" />
            <path d="M585,420 L585,240 Q589,230 589,224 Q589,214 585,210 Q581,214 581,224 Q581,230 585,240 Z M580,240 L590,240 L590,420 Z" fill="url(#jkFade)" />

            {/* Central prayer hall + main dome — onion shape */}
            <path d="M250,420 L250,290 Q250,170 400,158 Q550,170 550,290 L550,420 Z" fill="url(#jkFade)" />
            {/* Onion dome refinement */}
            <path d="M340,200 Q340,140 400,134 Q460,140 460,200" fill="rgba(232,195,106,0.28)" />
            {/* Crescent finial */}
            <line x1="400" y1="134" x2="400" y2="118" stroke="#E8C36A" strokeWidth="1.8" opacity="0.95" />
            <path d="M392,108 Q397,98 405,104 Q400,116 392,108 Z" fill="#E8C36A" opacity="0.95" />

            {/* Central arched entrance */}
            <path d="M370,420 L370,330 Q370,300 400,300 Q430,300 430,330 L430,420 Z" fill="rgba(15,30,28,0.6)" />
            <path d="M376,420 L376,332 Q376,306 400,306 Q424,306 424,332 L424,420 Z" fill="rgba(232,195,106,0.14)" />

            {/* Flanking sub-domes */}
            <path d="M280,420 L280,330 Q280,290 310,288 Q340,290 340,330 L340,420 Z" fill="url(#jkFade)" />
            <path d="M460,420 L460,330 Q460,290 490,288 Q520,290 520,330 L520,420 Z" fill="url(#jkFade)" />
            <circle cx="310" cy="282" r="1.8" fill="#E8C36A" opacity="0.85" />
            <circle cx="490" cy="282" r="1.8" fill="#E8C36A" opacity="0.85" />
          </svg>

          {/* Gentle grain */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
            }}
          />

          {/* Top status row */}
          <div className="absolute inset-x-0 top-0 z-10 mx-auto flex w-full max-w-[480px] items-center justify-between px-6 pt-7">
            <button
              type="button"
              onClick={() => setAmbientMode(false)}
              data-testid="dua-ambient-show-cards"
              aria-label="Show verse cards"
              className="flex h-10 items-center gap-1.5 rounded-full border border-ivory/15 bg-black/30 px-3 text-[10px] uppercase tracking-[0.22em] text-ivory/70 backdrop-blur-md tap-scale"
            >
              <ListFilter className="h-3.5 w-3.5" />
              Cards
            </button>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full border border-[#E8C36A]/40 bg-black/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-[#E8C36A] backdrop-blur-md"
              >
                Rakaat {["", "I", "II", "III", "IV", "V", "VI"][currentRakaat]}
              </span>
              {fullSegIdx >= 0 && fullTimeline && (
                <span
                  className="rounded-full bg-black/30 px-3 py-1.5 text-[10px] tracking-widest text-ivory/55 backdrop-blur-md"
                  data-testid="dua-ambient-seg-counter"
                >
                  {String(fullSegIdx + 1).padStart(2, "0")}<span className="text-ivory/35">/{fullTimeline.length}</span>
                </span>
              )}
            </div>
          </div>

          {/* Centre — current verse (larger, more breathing room) */}
          <div className="relative z-10 mx-auto flex w-full max-w-[440px] flex-col items-center px-7 text-center text-ivory">
            {currentVerse?.isImamName ? (
              <>
                <p className="text-[10px] uppercase tracking-[0.32em] text-[#E8C36A]">
                  Tasbih · Light upon Light
                </p>
                <div className="mt-4 h-px w-10 bg-gradient-to-r from-transparent via-[#E8C36A] to-transparent" />
                <h2
                  className="mt-5 font-display leading-[1.15]"
                  style={{
                    fontSize: "clamp(28px, 7.2vw, 42px)",
                    color: "#F4D88A",
                    textShadow: "0 2px 32px rgba(232,195,106,0.45)",
                    letterSpacing: "-0.005em",
                  }}
                  data-testid="dua-ambient-title"
                >
                  {currentVerse.name}
                </h2>
                <p className="mt-6 text-[12px] uppercase tracking-[0.28em] text-ivory/45">
                  Whisper the name softly
                </p>
              </>
            ) : currentVerse ? (
              <>
                <p
                  className="text-[10px] uppercase tracking-[0.32em] text-[#E8C36A]"
                  data-testid="dua-ambient-title"
                >
                  {currentVerse.title}
                </p>
                <div className="mt-4 h-px w-10 bg-gradient-to-r from-transparent via-[#E8C36A] to-transparent" />
                {currentVerse.arabic && (
                  <p
                    dir="rtl"
                    className="mt-5 leading-[1.85]"
                    style={{
                      fontFamily: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif",
                      fontSize: "clamp(22px, 5.8vw, 30px)",
                      color: "#F4D88A",
                      textShadow: "0 2px 24px rgba(232,195,106,0.4)",
                    }}
                    data-testid="dua-ambient-arabic"
                  >
                    {currentVerse.arabic}
                  </p>
                )}
                <h2
                  className="mt-4 font-display italic leading-[1.2]"
                  style={{
                    fontSize: "clamp(20px, 5.4vw, 28px)",
                    textShadow: "0 2px 28px rgba(0,0,0,0.6)",
                  }}
                >
                  {currentVerse.transliteration}
                </h2>
                <p
                  className="mt-4 text-[13px] leading-relaxed text-ivory/75"
                  style={{ textShadow: "0 1px 16px rgba(0,0,0,0.45)" }}
                  data-testid="dua-ambient-english"
                >
                  {currentVerse.english}
                </p>
              </>
            ) : (
              <p className="text-xs uppercase tracking-[0.3em] text-ivory/45">Listening…</p>
            )}
          </div>

          {/* Bottom controls */}
          <div className="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-[480px] px-7 pb-10">
            {/* Premium scrubbable progress bar */}
            <div className="flex items-center gap-3 text-[10px] tracking-[0.18em] text-ivory/55">
              <span data-testid="dua-ambient-time-current">{fmtTime(fullCurrentMs)}</span>
              <div
                role="slider"
                tabIndex={0}
                aria-label="Seek through the Du'a"
                aria-valuemin={0}
                aria-valuemax={Math.floor(fullDurationMs / 1000)}
                aria-valuenow={Math.floor(fullCurrentMs / 1000)}
                data-testid="dua-ambient-seekbar"
                onClick={(e) => {
                  const el = audioRef.current;
                  if (!el || !el.duration || !isFinite(el.duration)) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  el.currentTime = ratio * el.duration;
                }}
                onTouchEnd={(e) => {
                  const el = audioRef.current;
                  if (!el || !el.duration || !isFinite(el.duration)) return;
                  const t = e.changedTouches[0];
                  if (!t) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (t.clientX - rect.left) / rect.width));
                  el.currentTime = ratio * el.duration;
                }}
                onKeyDown={(e) => {
                  const el = audioRef.current;
                  if (!el || !el.duration) return;
                  if (e.key === "ArrowRight") { el.currentTime = Math.min(el.duration, el.currentTime + 5); }
                  if (e.key === "ArrowLeft")  { el.currentTime = Math.max(0, el.currentTime - 5); }
                  if (e.key === "Home")        { el.currentTime = 0; }
                  if (e.key === "End")         { el.currentTime = el.duration; }
                }}
                className="relative h-10 flex-1 cursor-pointer touch-none"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {/* Track */}
                <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-ivory/10">
                  <div
                    className="h-full rounded-full transition-[width] duration-150 ease-linear"
                    style={{
                      width: `${Math.max(0, Math.min(1, audioProgress)) * 100}%`,
                      background: "linear-gradient(90deg, #E8C36A 0%, #F4D88A 100%)",
                      boxShadow: "0 0 22px rgba(232,195,106,0.75)",
                    }}
                  />
                </div>
                {/* Rakaat chapter markers (tiny golden ticks above the bar) */}
                {rakaatMarkers.map((mark) => {
                  const reached = audioProgress * fullDurationMs >= mark.start_ms;
                  return (
                    <button
                      key={mark.rakaat}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const el = audioRef.current;
                        if (!el || !el.duration) return;
                        el.currentTime = mark.start_ms / 1000;
                      }}
                      data-testid={`dua-ambient-marker-${mark.rakaat}`}
                      aria-label={`Jump to Rakaat ${["", "I", "II", "III", "IV", "V", "VI"][mark.rakaat]}`}
                      className="absolute top-1/2 flex h-6 -translate-y-1/2 -translate-x-1/2 flex-col items-center justify-center tap-scale"
                      style={{ left: `${mark.ratio * 100}%` }}
                    >
                      <span
                        className="h-3 w-[2px] rounded-full transition-all"
                        style={{
                          background: reached ? "#F4D88A" : "rgba(232,195,106,0.45)",
                          boxShadow: reached ? "0 0 10px rgba(244,216,138,0.75)" : "none",
                        }}
                        aria-hidden="true"
                      />
                      <span
                        className="absolute -bottom-3 text-[8px] tracking-[0.18em] transition-colors"
                        style={{ color: reached ? "#F4D88A" : "rgba(247,243,236,0.32)" }}
                      >
                        {["", "I", "II", "III", "IV", "V", "VI"][mark.rakaat]}
                      </span>
                    </button>
                  );
                })}
                {/* Thumb */}
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F4D88A] shadow-[0_0_16px_#F4D88A] transition-[left] duration-150 ease-linear"
                  style={{ left: `${Math.max(0, Math.min(1, audioProgress)) * 100}%` }}
                  aria-hidden="true"
                />
              </div>
              <span data-testid="dua-ambient-time-total">{fmtTime(fullDurationMs)}</span>
            </div>

            {/* Pause button — large, soft glow */}
            <div className="mt-7 flex items-center justify-center">
              <button
                type="button"
                onClick={toggleAutoPlay}
                data-testid="dua-ambient-pause"
                aria-label="Pause"
                className="relative flex h-16 w-16 items-center justify-center rounded-full text-deep tap-scale"
                style={{
                  background: "linear-gradient(135deg, #F4D88A 0%, #E8C36A 100%)",
                  boxShadow:
                    "0 0 48px rgba(232,195,106,0.7), 0 8px 24px rgba(0,0,0,0.6)",
                }}
              >
                <span
                  className="absolute inset-0 animate-ping rounded-full opacity-30"
                  style={{ background: "rgba(244,216,138,0.5)" }}
                />
                <Pause className="relative h-6 w-6" />
              </button>
            </div>
            <p className="mt-5 text-center text-[10px] uppercase tracking-[0.32em] text-ivory/45">
              Sit · Listen · Breathe
            </p>
            <p className="mt-1 text-center text-[10px] italic text-ivory/30">
              Your screen will stay awake
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
