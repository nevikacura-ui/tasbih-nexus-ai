import React, { useState } from "react";
import { Share2, Check, MessageCircle, Sparkles } from "lucide-react";

/**
 * Share Tasbih.ai with a premium pre-filled message.
 *
 * Behaviour:
 * - Mobile: uses native `navigator.share` when available (lets the OS show
 *   WhatsApp, Telegram, iMessage, etc.) so the OG image preview appears.
 * - Desktop / fallback: opens WhatsApp Web (`https://wa.me/?text=…`) in a new
 *   tab with the same premium message pre-typed.
 * - Bonus: a small "Copy" affordance on the modal copies the message + url.
 *
 * Two surfaces:
 *  - `<ShareTasbihButton />`  — pill button drop-in (Home, Profile, etc.)
 *  - `<ShareTasbihLink />`    — text-style link drop-in (footers, inline)
 */

// Production app URL (used in WhatsApp share text + OG previews). Configurable
// via REACT_APP_PUBLIC_URL in frontend/.env so the same code works in preview
// and production without hardcoding. Falls back to runtime origin if unset.
// NOTE: webpack inlines `process.env.REACT_APP_X` at build time but leaves
// `process` itself undefined in the browser, so we reference it directly.
const APP_URL =
  process.env.REACT_APP_PUBLIC_URL ||
  (typeof window !== "undefined" ? window.location.origin : "https://tasbih.ai");

// Pool of premium share messages — rotate so repeat-shares feel fresh.
function premiumMessages() {
  return [
    {
      key: "noor",
      text:
        "✨ A small gift for you.\n\n" +
        "Tasbih.ai — a calm companion for the Holy Du'a, Noor AI reflection, and your Sangat.\n\n" +
        "• Full audio recitation (Male & Female voices)\n" +
        "• 50-Imam Tasbih with gentle name-by-name flow\n" +
        "• 54 Jamatkhanas across India\n\n" +
        "Carry the noor with you →\n" +
        APP_URL,
    },
    {
      key: "reflect",
      text:
        "Yā ʿAlī madad 🌙\n\n" +
        "Found a quiet space for dhikr and reflection — thought you might love it.\n\n" +
        "Tasbih.ai is a calm, ad-free companion: the complete Holy Du'a in five minutes of audio, " +
        "Noor AI for gentle reflection, and a private journal that sits in your Sangat — for you, your circle, and the moments in between.\n\n" +
        "Remember. Reflect. Seek Noor.\n" +
        APP_URL,
    },
    {
      key: "invite",
      text:
        "I think you'll feel this one.\n\n" +
        "Tasbih.ai — a quiet, premium home for the Holy Du'a (full audio), the 50-Imam Tasbih, Noor AI, and the Sangat that holds it together.\n\n" +
        "Open it once and you'll see. 🤲🏼\n" +
        APP_URL,
    },
  ];
}

function pickMessage() {
  const arr = premiumMessages();
  // Rotate based on the day so a user sharing twice in 5 minutes sees the same
  // message, but the same person sharing tomorrow sees a different one.
  const idx = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % arr.length;
  return arr[idx];
}

function whatsappUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function shareTasbih({ onCopied } = {}) {
  const m = pickMessage();
  // Native share (mobile) → uses the OS sheet and renders the OG card.
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: "Tasbih.ai — Remember. Reflect. Seek Noor.",
        text: m.text,
        url: APP_URL,
      });
      return { outcome: "shared" };
    } catch (e) {
      // user cancelled — silently fall through to clipboard offer
      if (e && (e.name === "AbortError" || /aborted/i.test(e.message || ""))) {
        return { outcome: "cancelled" };
      }
    }
  }
  // Fallback: open WhatsApp Web (works everywhere)
  try {
    window.open(whatsappUrl(m.text), "_blank", "noopener,noreferrer");
    return { outcome: "whatsapp" };
  } catch (e) {
    // Last resort — copy to clipboard
    try {
      await navigator.clipboard.writeText(m.text);
      if (onCopied) onCopied();
      return { outcome: "copied" };
    } catch (err) {
      return { outcome: "error" };
    }
  }
}

export function ShareTasbihButton({
  className = "",
  testId = "share-tasbih-btn",
  label = "Share Tasbih",
  variant = "gold", // "gold" | "ghost"
  showIcon = true,
}) {
  const [pulse, setPulse] = useState(false);
  const onClick = async () => {
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
    await shareTasbih();
  };

  const styleByVariant = {
    gold: {
      background: "linear-gradient(135deg, #F4D88A 0%, #E8C36A 100%)",
      color: "#0F3D36",
      border: "none",
      boxShadow: "0 6px 16px rgba(232,195,106,0.4)",
    },
    ghost: {
      background: "rgba(15,61,54,0.95)",
      color: "#F4D88A",
      border: "1px solid rgba(232,195,106,0.45)",
      boxShadow: "none",
    },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-label="Share Tasbih.ai with friends and family on WhatsApp"
      className={`group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-[12px] font-medium tap-scale ${className}`}
      style={styleByVariant[variant] || styleByVariant.gold}
    >
      {/* shimmer */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-12 w-12 bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-1000 group-hover:translate-x-[260%]"
      />
      {showIcon && (
        pulse ? <Sparkles className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}

export function ShareTasbihLink({ className = "", testId = "share-tasbih-link" }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    const r = await shareTasbih({ onCopied: () => setCopied(true) });
    if (r.outcome === "copied") setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 text-[11px] tap-scale ${className}`}
    >
      {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
      {copied ? "Copied" : "Share Tasbih"}
    </button>
  );
}

export default ShareTasbihButton;
