import { createFileRoute, Link } from "@tanstack/react-router";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/reflect")({
  head: () => ({
    meta: [
      { title: "Noor Reflection — Tasbih.ai" },
      { name: "description", content: "Your calm AI spiritual companion. Reflect, journal, and seek Noor." },
    ],
  }),
  component: ReflectPage,
});

type Msg = { from: "noor" | "me"; text: string };

function ReflectPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { from: "noor", text: "As-salāmu ʿalaykum, Amir. Take a slow breath. What is sitting on your heart this evening?" },
  ]);

  const send = () => {
    const t = input.trim();
    if (!t) return;
    setMessages((m) => [
      ...m,
      { from: "me", text: t },
      {
        from: "noor",
        text: "Thank you for sharing that. In Surah Ash-Sharh, Allah reminds us: with hardship comes ease. Can you name one small mercy you noticed today, even a quiet one?",
      },
    ]);
    setInput("");
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
      <NoorBackdrop />

      <header className="flex items-center gap-3 px-5 pt-8">
        <Link to="/" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">AI Companion</p>
          <h1 className="font-display text-xl text-foreground">Noor</h1>
        </div>
        <span className="bg-secondary text-secondary-foreground ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium">
          <Sparkles className="h-3 w-3" /> calm mode
        </span>
      </header>

      <section className="flex-1 space-y-4 px-5 pb-32 pt-6">
        {messages.map((m, i) => (
          <div key={i} className={`animate-float-up flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            {m.from === "noor" && <div className="bg-gold-gradient noor-ring mr-2 mt-1 h-7 w-7 shrink-0 rounded-full" />}
            <div
              className={`shadow-soft max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.from === "me"
                  ? "bg-emerald-gradient text-primary-foreground rounded-br-md"
                  : "glass text-foreground rounded-bl-md"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => setInput(p)}
              className="glass shadow-soft rounded-full px-3 py-1.5 text-[11px] text-foreground/80"
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      <div className="from-background via-background/95 fixed bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 bg-gradient-to-t to-transparent px-5 pb-6 pt-3">
        <div className="glass shadow-elegant flex items-end gap-2 rounded-3xl p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            placeholder="Share a thought with Noor…"
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={send}
            className="bg-emerald-gradient text-primary-foreground shadow-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

const prompts = ["I feel anxious", "Help me reflect", "Suggest a du'ā"];
