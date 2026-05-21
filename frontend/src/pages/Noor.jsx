import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Send, Sparkles, Globe } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const PROMPTS = ["I feel anxious", "Help me reflect", "Suggest a duʿā", "Gratitude prompt"];

const LANGS = [
  { id: "en", label: "EN", name: "English" },
  { id: "ur", label: "اردو", name: "Urdu" },
  { id: "ar", label: "العربية", name: "Arabic" },
  { id: "fr", label: "FR", name: "French" },
  { id: "gu", label: "ગુ", name: "Gujarati" },
];

export default function NoorPage() {
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState(() => {
    try { return localStorage.getItem("noor_lang") || "en"; } catch (_) { return "en"; }
  });
  const [showLang, setShowLang] = useState(false);
  const [messages, setMessages] = useState([
    { role: "noor", text: "As-salāmu ʿalaykum. Take a slow breath with me. What is sitting on your heart this evening?" },
  ]);
  const scrollRef = useRef(null);

  useEffect(() => { try { localStorage.setItem("noor_lang", language); } catch (_) {} }, [language]);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const send = async (textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const r = await api.post("/noor/chat", { message: text, session_id: sessionId });
      setSessionId(r.data.session_id);
      // Stream the reply word-by-word for a calm typing effect
      const full = r.data.reply || "";
      const idx = await new Promise((resolve) => {
        setMessages((m) => {
          const next = [...m, { role: "noor", text: "" }];
          resolve(next.length - 1);
          return next;
        });
      });
      const words = full.split(/(\s+)/); // keep whitespace tokens
      let acc = "";
      for (const w of words) {
        acc += w;
        await new Promise((r) => setTimeout(r, 28));
        // eslint-disable-next-line no-loop-func
        setMessages((m) => {
          const copy = [...m];
          if (copy[idx]) copy[idx] = { role: "noor", text: acc };
          return copy;
        });
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "noor", text: "Noor is resting for a moment. Please try once more." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col" data-testid="noor-page">
      <NoorBackdrop />

      <header className="flex items-center gap-3 px-5 pt-9">
        <Link to="/" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
          <ArrowLeft className="h-4 w-4 text-deep" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">AI Companion</p>
          <h1 className="font-display text-xl text-deep">Noor</h1>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-[10px] font-medium text-deep">
          <Sparkles className="h-3 w-3" /> calm mode
        </span>
        <button
          onClick={() => setShowLang((s) => !s)}
          data-testid="lang-picker"
          className="glass shadow-soft inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-deep tap-scale"
        >
          <Globe className="h-3 w-3" /> {LANGS.find((l) => l.id === language)?.label || "EN"}
        </button>
      </header>

      {showLang && (
        <div className="mx-5 mt-2 grid grid-cols-5 gap-2" data-testid="lang-options">
          {LANGS.map((l) => (
            <button
              key={l.id}
              data-testid={`lang-${l.id}`}
              onClick={() => { setLanguage(l.id); setShowLang(false); }}
              className={`rounded-2xl py-2 text-[11px] font-medium tap-scale ${
                language === l.id ? "bg-emerald-gradient text-ivory" : "glass text-deep shadow-soft"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      <p className="px-5 pt-2 text-[10px] text-deep/45">
        Reflective companion, not a religious authority. Noor will not give fatwas or theological rulings.
      </p>

      <section className="flex-1 space-y-4 px-5 pb-44 pt-6" data-testid="noor-thread">
        {messages.map((m, i) => (
          <div key={i} className={`animate-float-up flex ${m.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`msg-${m.role}-${i}`}>
            {m.role === "noor" && (
              <div className="bg-gold-gradient noor-ring mr-2 mt-1 h-7 w-7 shrink-0 rounded-full animate-noor-pulse" />
            )}
            <div
              className={`shadow-soft max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-emerald-gradient text-ivory rounded-br-md"
                  : "glass text-deep rounded-bl-md"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-deep/55" data-testid="noor-typing">
            <div className="bg-gold-gradient noor-ring h-7 w-7 rounded-full animate-noor-pulse" />
            <span className="glass rounded-2xl px-4 py-3 text-sm">Noor is reflecting…</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              data-testid={`prompt-${p.toLowerCase().replace(/\s+/g, "-")}`}
              className="glass shadow-soft tap-scale rounded-full px-3 py-1.5 text-[11px] text-deep/80"
            >
              {p}
            </button>
          ))}
        </div>
        <div ref={scrollRef} />
      </section>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 bg-gradient-to-t from-ivory via-ivory/95 to-transparent px-5 pb-6 pt-3">
        <div className="glass shadow-elegant flex items-end gap-2 rounded-3xl p-2">
          <textarea
            data-testid="noor-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Share a thought with Noor…"
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-deep outline-none placeholder:text-deep/40"
          />
          <button
            data-testid="noor-send"
            onClick={() => send()}
            disabled={busy}
            className="bg-emerald-gradient text-ivory shadow-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
