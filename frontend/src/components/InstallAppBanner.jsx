import React, { useEffect, useState, useCallback } from "react";
import { Download, Sparkles, X, Smartphone, Share2 } from "lucide-react";

/**
 * Cinematic "Install Tasbih.ai" banner.
 *
 * Behaviour:
 * - Android (Chrome / Edge / Brave): captures the `beforeinstallprompt` event,
 *   suppresses the browser mini-infobar, and exposes our own beautiful prompt.
 * - iOS (Safari): no install event, but standalone-mode is supported. Shows a
 *   gentle "Add to Home Screen" hint with the share icon (only ONCE per device).
 * - Already-installed (display-mode: standalone): renders nothing.
 * - User dismisses → soft-snooze for 7 days via localStorage.
 *
 * Two surfaces:
 * 1) Floating bottom banner (auto-pops 4s after first session in a browser tab)
 * 2) An inline `<InstallAppButton />` that anyone can drop into a page.
 */

const SNOOZE_KEY = "tasbih.install.snoozedUntil";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator?.standalone === true
  );
}

function isIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
}

function isSnoozed() {
  try {
    const v = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return v && Date.now() < v;
  } catch (e) { return false; }
}

function snoozeNow() {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch (e) {}
}

// Module-level singleton for the deferred prompt — set once when the browser fires
// `beforeinstallprompt` and read by both surfaces (banner + inline button).
const promptState = {
  event: null,
  listeners: new Set(),
};

function setEvent(ev) {
  promptState.event = ev;
  promptState.listeners.forEach((fn) => fn(ev));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    setEvent(e);
  });
  window.addEventListener("appinstalled", () => {
    setEvent(null);
    try { localStorage.setItem("tasbih.install.installed", "1"); } catch (e) {}
  });
}

function useInstallPrompt() {
  const [evt, setEvt] = useState(promptState.event);
  useEffect(() => {
    const onChange = (e) => setEvt(e);
    promptState.listeners.add(onChange);
    return () => { promptState.listeners.delete(onChange); };
  }, []);

  const trigger = useCallback(async () => {
    const e = promptState.event;
    if (!e) return { outcome: "unavailable" };
    try {
      e.prompt();
      const choice = await e.userChoice;
      setEvent(null);
      return choice; // { outcome: 'accepted'|'dismissed' }
    } catch (err) { return { outcome: "error" }; }
  }, []);

  return { evt, trigger };
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Inline button — drop anywhere (e.g. above the Home credit footer)       */
/* ──────────────────────────────────────────────────────────────────────── */
export function InstallAppButton({ className = "", testId = "install-app-btn" }) {
  const { evt, trigger } = useInstallPrompt();
  const [ios] = useState(() => isIos());
  const [standalone] = useState(() => isStandalone());
  const [iosHintOpen, setIosHintOpen] = useState(false);

  if (standalone) return null;
  if (!evt && !ios) return null; // not installable on this browser

  const onClick = async () => {
    if (ios) { setIosHintOpen(true); return; }
    const r = await trigger();
    if (r.outcome === "accepted") {
      try { localStorage.setItem("tasbih.install.installed", "1"); } catch (e) {}
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        aria-label="Install Tasbih.ai as an app"
        className={`group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-gold/40 bg-deep/95 px-4 py-2 text-[12px] font-medium text-ivory shadow-soft tap-scale ${className}`}
      >
        {/* shimmer */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-12 w-12 bg-gradient-to-r from-transparent via-gold/35 to-transparent transition-transform duration-1000 group-hover:translate-x-[260%]"
        />
        <Download className="h-3.5 w-3.5 text-gold" />
        Install app
      </button>
      {iosHintOpen && <IosShareHint onClose={() => setIosHintOpen(false)} />}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Floating banner — auto-shows once the install event arrives             */
/* ──────────────────────────────────────────────────────────────────────── */
export default function InstallAppBanner() {
  const { evt, trigger } = useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [ios] = useState(() => isIos());
  const [standalone] = useState(() => isStandalone());
  const [iosHintOpen, setIosHintOpen] = useState(false);

  // Decide when to surface
  useEffect(() => {
    if (standalone) return;
    if (isSnoozed()) return;
    try { if (localStorage.getItem("tasbih.install.installed") === "1") return; } catch (e) {}

    // Android: show 4s after prompt event arrives. iOS: show 8s after page load.
    if (evt) {
      const t = setTimeout(() => setVisible(true), 4000);
      return () => clearTimeout(t);
    }
    if (ios) {
      const t = setTimeout(() => setVisible(true), 8000);
      return () => clearTimeout(t);
    }
  }, [evt, ios, standalone]);

  if (standalone) return null;
  if (!visible && !iosHintOpen) return null;

  const onInstall = async () => {
    if (ios) { setIosHintOpen(true); return; }
    const r = await trigger();
    if (r.outcome === "accepted") {
      try { localStorage.setItem("tasbih.install.installed", "1"); } catch (e) {}
      closeBanner();
    } else if (r.outcome === "dismissed") {
      snoozeNow();
      closeBanner();
    }
  };

  const closeBanner = () => {
    setClosing(true);
    setTimeout(() => setVisible(false), 280);
  };

  const onDismiss = () => { snoozeNow(); closeBanner(); };

  return (
    <>
      {visible && (
        <div
          className={`fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))] ${closing ? "animate-banner-out" : "animate-banner-in"}`}
          data-testid="install-app-banner"
          role="dialog"
          aria-live="polite"
          aria-label="Install Tasbih.ai"
        >
          <div
            className="relative w-full max-w-[460px] overflow-hidden rounded-3xl border border-gold/40 shadow-2xl"
            style={{
              background:
                "linear-gradient(160deg, rgba(15,61,54,0.97) 0%, rgba(18,63,57,0.97) 50%, rgba(10,40,32,0.97) 100%)",
              backdropFilter: "blur(18px)",
              boxShadow:
                "0 24px 60px rgba(0,0,0,0.55), 0 0 32px rgba(232,195,106,0.25), inset 0 1px 0 rgba(232,195,106,0.18)",
            }}
          >
            {/* Soft halo behind icon */}
            <div
              className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full opacity-50"
              style={{ background: "radial-gradient(circle at center, rgba(232,195,106,0.55) 0%, transparent 65%)" }}
              aria-hidden="true"
            />
            {/* Drifting gold particles */}
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className="pointer-events-none absolute h-1 w-1 rounded-full bg-gold/70 animate-drift-particle"
                style={{
                  top: `${20 + i * 18}%`,
                  left: `${10 + i * 22}%`,
                  animationDelay: `${i * 0.7}s`,
                  boxShadow: "0 0 8px rgba(232,195,106,0.9)",
                }}
              />
            ))}

            <div className="relative flex items-start gap-3 p-5">
              {/* Icon tile */}
              <div
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, #F4D88A 0%, #E8C36A 60%, #C9A46A 100%)",
                  boxShadow: "0 8px 18px rgba(232,195,106,0.45), inset 0 1px 0 rgba(255,255,255,0.4)",
                }}
              >
                <Smartphone className="h-7 w-7 text-deep" strokeWidth={2.2} />
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-deep text-gold"
                  style={{ boxShadow: "0 0 0 2px #F4D88A" }}
                >
                  <Download className="h-3 w-3" />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-gold" />
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gold">
                    Tasbih.ai · install
                  </p>
                </div>
                <p className="mt-1 font-display text-[17px] leading-snug text-ivory">
                  Keep Noor on your home screen
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-ivory/70">
                  {ios
                    ? "Tap Share, then Add to Home Screen for a calmer, full-screen experience."
                    : "One quiet tap. Opens like a real app — no browser bar, instant launch, offline ready."}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onInstall}
                    data-testid="install-app-cta"
                    className="group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold text-deep shadow-md tap-scale"
                    style={{
                      background: "linear-gradient(135deg, #F4D88A 0%, #E8C36A 100%)",
                      boxShadow: "0 6px 16px rgba(232,195,106,0.45)",
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {ios ? "Show how" : "Install now"}
                  </button>
                  <button
                    type="button"
                    onClick={onDismiss}
                    data-testid="install-app-snooze"
                    className="rounded-full border border-ivory/15 px-3 py-2 text-[11px] text-ivory/70 backdrop-blur-sm hover:bg-ivory/5 tap-scale"
                  >
                    Not now
                  </button>
                </div>
              </div>

              {/* Close (X) */}
              <button
                type="button"
                onClick={onDismiss}
                data-testid="install-app-close"
                aria-label="Dismiss install prompt"
                className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ivory/55 hover:bg-ivory/8 hover:text-ivory tap-scale"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Bottom gold seam */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(232,195,106,0.6) 50%, transparent 100%)",
              }}
            />
          </div>
        </div>
      )}

      {iosHintOpen && <IosShareHint onClose={() => { setIosHintOpen(false); closeBanner(); }} />}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  iOS hint modal — Safari doesn't expose beforeinstallprompt              */
/* ──────────────────────────────────────────────────────────────────────── */
function IosShareHint({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 backdrop-blur-sm px-5 pb-[max(20px,env(safe-area-inset-bottom))]"
      data-testid="install-app-ios-hint"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] overflow-hidden rounded-3xl border border-gold/40 shadow-2xl"
        style={{
          background: "linear-gradient(160deg, #0F3D36 0%, #123F39 50%, #0a2820 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center text-ivory">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-gradient text-deep shadow-md">
            <Share2 className="h-5 w-5" />
          </div>
          <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-gold">
            Add to home screen
          </p>
          <h3 className="mt-1 font-display text-xl leading-snug">
            Two taps to install
          </h3>
          <ol className="mt-4 space-y-2.5 text-left text-[13px] leading-relaxed text-ivory/85">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-deep">1</span>
              <span>Tap the <Share2 className="inline h-3.5 w-3.5 align-text-bottom" /> <strong>Share</strong> button below in Safari.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-deep">2</span>
              <span>Choose <strong>“Add to Home Screen”</strong>.</span>
            </li>
          </ol>
          <button
            type="button"
            onClick={onClose}
            data-testid="install-app-ios-close"
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-gold-gradient px-5 py-3 text-sm font-semibold text-deep shadow-md tap-scale"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
