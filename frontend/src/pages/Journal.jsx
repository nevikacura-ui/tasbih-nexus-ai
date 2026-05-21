import React, { useEffect, useState } from "react";
import { BookOpen, Plus, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const MOODS = ["calm", "seeking", "grateful", "heavy", "hopeful"];

export default function JournalPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [mood, setMood] = useState("calm");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const r = await api.get("/journal"); setItems(r.data.entries || []); } catch (e) {}
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api.post("/journal", { title, body, mood, tags: [] });
      setBody(""); setTitle(""); setMood("calm"); setOpen(false);
      await load();
    } finally { setBusy(false); }
  };

  return (
    <MobileShell>
      <div className="relative" data-testid="journal-page">
        <NoorBackdrop />
        <header className="flex items-center justify-between px-5 pt-9">
          <div className="flex items-center gap-3">
            <Link to="/" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
              <ArrowLeft className="h-4 w-4 text-deep" />
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Reflect</p>
              <h1 className="font-display text-2xl text-deep">Journal</h1>
            </div>
          </div>
          <button
            data-testid="journal-new"
            onClick={() => setOpen(true)}
            className="bg-emerald-gradient text-ivory shadow-glow flex h-10 w-10 items-center justify-center rounded-full tap-scale"
          >
            <Plus className="h-4 w-4" />
          </button>
        </header>

        <section className="mt-6 px-5">
          {items.length === 0 ? (
            <div className="glass rounded-3xl p-6 text-center shadow-soft" data-testid="journal-empty">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-gradient">
                <BookOpen className="h-5 w-5 text-deep" />
              </div>
              <p className="font-display text-lg text-deep">Your quiet diary</p>
              <p className="mx-auto mt-1 max-w-[260px] text-sm text-deep/60">
                Whisper a sentence, a gratitude, an honest line. Noor will never read what you don't share.
              </p>
              <button
                onClick={() => setOpen(true)}
                className="bg-emerald-gradient text-ivory shadow-elegant mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium tap-scale"
              >
                Write your first entry
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((j) => (
                <article key={j.entry_id} className="glass rounded-2xl p-4 shadow-soft" data-testid={`journal-entry-${j.entry_id}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">
                      {new Date(j.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    {j.mood && <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] text-deep">{j.mood}</span>}
                  </div>
                  {j.title && <p className="mt-2 font-display text-lg text-deep">{j.title}</p>}
                  <p className="mt-1 text-sm leading-relaxed text-deep/85">{j.body}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        {open && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-deep/30 backdrop-blur-sm" data-testid="journal-modal">
            <div className="glass w-full max-w-[480px] rounded-t-[28px] p-5 shadow-elegant">
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-deep/15" />
              <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">New entry</p>
              <h2 className="mt-1 font-display text-xl text-deep">A quiet line for tonight</h2>

              <input
                data-testid="journal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional title"
                className="mt-4 w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm outline-none focus:border-gold"
              />
              <textarea
                data-testid="journal-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder="What is sitting on your heart tonight?"
                className="mt-2 w-full resize-none rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm outline-none focus:border-gold"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    data-testid={`journal-mood-${m}`}
                    onClick={() => setMood(m)}
                    className={`rounded-full px-3 py-1.5 text-[11px] tap-scale ${mood === m ? "bg-emerald-gradient text-ivory" : "bg-sand text-deep"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  data-testid="journal-cancel"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-full bg-sand py-3 text-sm font-medium text-deep tap-scale"
                >
                  Cancel
                </button>
                <button
                  data-testid="journal-save"
                  onClick={save}
                  disabled={busy || !body.trim()}
                  className="bg-emerald-gradient text-ivory shadow-elegant flex-1 rounded-full py-3 text-sm font-medium tap-scale disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save quietly"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
