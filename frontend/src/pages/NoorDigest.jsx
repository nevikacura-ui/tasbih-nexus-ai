import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Sparkles, Flame, BookOpen, Crown, Calendar, BookmarkPlus, Check } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

export default function NoorDigestPage() {
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => {
    try { const r = await api.get("/noor/digest"); setDigest(r.data); }
    catch (e) { setErr(e?.response?.data?.detail || "Could not load your digest."); }
    finally { setLoading(false); }
  })(); }, []);

  const saveToJournal = async () => {
    if (!digest?.text) return;
    setSaving(true);
    try {
      const week = digest.window_start?.slice(0, 10) || "";
      await api.post("/journal", {
        title: `Noor Digest · week of ${week}`,
        body: digest.text,
        mood: "reflective",
        tags: ["noor-digest", ...(digest.themes || [])],
      });
      setSaved(true);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not save.");
    } finally { setSaving(false); }
  };

  const stats = digest?.stats || {};
  return (
    <MobileShell>
      <div className="relative" data-testid="digest-page">
        <NoorBackdrop />
        <header className="flex items-center gap-3 px-5 pt-9">
          <Link to="/" data-testid="digest-back" className="glass flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
            <ChevronLeft className="h-4 w-4 text-deep" />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Sunday reflection</p>
            <h1 className="font-display text-2xl text-deep">Noor Digest</h1>
          </div>
        </header>

        <section className="mt-6 px-5">
          {loading && <p className="text-xs text-deep/55">Gathering your week gently…</p>}
          {err && <div className="glass rounded-2xl p-4 text-xs text-deep/65 shadow-soft">{err}</div>}
          {digest && (
            <div className="glass shadow-elegant rounded-3xl p-6">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-deep/45">
                <Calendar className="h-3 w-3" />
                <span>Week of {digest.window_start?.slice(0, 10)}</span>
              </div>
              <p className="mt-4 whitespace-pre-line font-display text-lg leading-relaxed text-deep" data-testid="digest-text">
                {digest.text}
              </p>
              {(digest.themes || []).length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {digest.themes.map((t) => (
                    <span key={t} className="rounded-full bg-sand/60 px-3 py-1 text-[10px] uppercase tracking-wider text-deep/60">{t}</span>
                  ))}
                </div>
              )}
              <button
                data-testid="digest-save-to-journal"
                onClick={saveToJournal}
                disabled={saved || saving}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-xs font-medium tap-scale transition ${
                  saved ? "bg-emerald-gradient text-gold" : "bg-gold-gradient text-deep shadow-soft"
                } disabled:opacity-70`}
              >
                {saved ? (<><Check className="h-3.5 w-3.5" /> Saved to your journal</>)
                  : saving ? "Saving…"
                  : (<><BookmarkPlus className="h-3.5 w-3.5" /> Save to journal</>)}
              </button>
              <p className="mt-2 px-1 text-center text-[10px] text-deep/45">
                Keep your Sunday reflections in one quiet place — your private yearly mosaic.
              </p>
            </div>
          )}
        </section>

        {digest && (
          <section className="mt-5 px-5 pb-10">
            <h2 className="mb-3 font-display text-base text-deep">Your week, gently</h2>
            <div className="grid grid-cols-2 gap-3">
              <Tile icon={Flame} label="Dhikr" value={`${stats.dhikr_count ?? 0}`} sub={`across ${stats.dhikr_days ?? 0} day(s)`} />
              <Tile icon={Sparkles} label="Streak" value={`${stats.streak ?? 0}d`} sub="current" />
              <Tile icon={BookOpen} label="Journal" value={`${stats.journal_entries ?? 0}`} sub="entries" />
              <Tile icon={Crown} label="Khidmah" value={`${stats.khidmah_points ?? 0}`} sub="this month" />
            </div>
            <p className="mt-4 px-2 text-[10px] leading-relaxed text-deep/45">
              Noor Digest is a private reflective summary — never a ruling, never advice. It only draws from what you've already shared with Tasbih.ai.
            </p>
          </section>
        )}
      </div>
    </MobileShell>
  );
}

function Tile({ icon: Icon, label, value, sub }) {
  return (
    <div className="glass rounded-2xl p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <div className="bg-emerald-gradient flex h-7 w-7 items-center justify-center rounded-full">
          <Icon className="h-3.5 w-3.5 text-gold" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">{label}</p>
      </div>
      <p className="mt-2 font-display text-2xl text-deep">{value}</p>
      <p className="text-[10px] text-deep/55">{sub}</p>
    </div>
  );
}
