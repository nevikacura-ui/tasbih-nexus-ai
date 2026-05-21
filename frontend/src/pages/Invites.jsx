import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Plus, UserPlus, Sparkles } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

export default function InvitesPage() {
  const [codes, setCodes] = useState([]);
  const [available, setAvailable] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const load = async () => {
    try { const r = await api.get("/invites/mine"); setCodes(r.data.codes || []); setAvailable(r.data.available || 0); }
    catch (e) {}
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      const r = await api.post("/invites/create");
      setToast(`New code: ${r.data.code}`);
      await load();
    } catch (e) {
      setToast(e?.response?.data?.detail || "Could not create code");
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 2500);
    }
  };

  const copy = async (code) => {
    try { await navigator.clipboard.writeText(code); setToast(`Copied ${code}`); setTimeout(() => setToast(null), 1800); } catch (e) {}
  };

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[480px]" data-testid="invites-page">
      <NoorBackdrop />
      <header className="flex items-center gap-3 px-5 pt-9">
        <Link to="/profile" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
          <ArrowLeft className="h-4 w-4 text-deep" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Welcome friends</p>
          <h1 className="font-display text-2xl text-deep">Invitations</h1>
        </div>
      </header>

      <section className="mt-6 px-5">
        <div className="glass rounded-3xl p-5 shadow-elegant">
          <div className="flex items-center gap-3">
            <div className="bg-gold-gradient flex h-12 w-12 items-center justify-center rounded-full shadow-glow">
              <UserPlus className="h-5 w-5 text-deep" />
            </div>
            <div className="flex-1">
              <p className="font-display text-lg text-deep">{available} invitations left</p>
              <p className="text-xs text-deep/60">Each new member needs two codes — gift wisely.</p>
            </div>
          </div>
          <button
            onClick={create}
            disabled={busy || available <= 0}
            data-testid="create-invite-btn"
            className="bg-emerald-gradient text-ivory shadow-elegant mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium tap-scale disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {busy ? "Creating…" : "Generate invitation code"}
          </button>
        </div>
      </section>

      <section className="mt-6 px-5 pb-10">
        <h2 className="mb-3 font-display text-base text-deep">Your codes</h2>
        {codes.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-center shadow-soft">
            <Sparkles className="mx-auto h-5 w-5 text-deep/55" />
            <p className="mt-2 text-sm text-deep/65">No codes yet. Create one to invite a friend.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {codes.map((c) => (
              <div key={c.code} className="glass flex items-center justify-between rounded-2xl p-4 shadow-soft" data-testid={`invite-${c.code}`}>
                <div>
                  <p className="font-display text-base text-deep">{c.code}</p>
                  <p className="text-[11px] text-deep/55">{c.used_by ? "Used" : "Available"}</p>
                </div>
                {!c.used_by && (
                  <button
                    data-testid={`copy-${c.code}`}
                    onClick={() => copy(c.code)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-[11px] font-medium text-deep tap-scale"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-deep px-4 py-2 text-xs text-ivory shadow-elegant" data-testid="invites-toast">
          {toast}
        </div>
      )}
    </div>
  );
}
