import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Plus, UserPlus, Sparkles, Mail, Send, Check } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

export default function InvitesPage() {
  const [codes, setCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  // Share-sheet state
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  const [coSign, setCoSign] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null); // { codes:[...], email:'...' }

  const load = async () => {
    try { const r = await api.get("/invites/mine"); setCodes(r.data.codes || []); } catch (e) {}
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

  const sendEmail = async (e) => {
    e?.preventDefault?.();
    if (!toEmail.includes("@")) { setToast("Please enter a valid email."); setTimeout(() => setToast(null), 2000); return; }
    setSending(true); setSent(null);
    try {
      const r = await api.post("/invites/send-email", {
        to_email: toEmail.trim(),
        to_name: toName.trim() || undefined,
        second_inviter_name: coSign.trim() || undefined,
      });
      setSent({ email: r.data.to, codes: r.data.codes });
      setToEmail(""); setToName(""); setCoSign("");
      await load();
    } catch (e) {
      setToast(e?.response?.data?.detail || "Could not send the email.");
      setTimeout(() => setToast(null), 3000);
    } finally { setSending(false); }
  };

  const available = codes.filter((c) => !c.used_by).length;

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[480px]" data-testid="invites-page">
      <NoorBackdrop />
      <header className="flex items-center gap-3 px-5 pt-9">
        <Link to="/profile" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
          <ArrowLeft className="h-4 w-4 text-deep" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Welcome a friend</p>
          <h1 className="font-display text-2xl text-deep">Invitations</h1>
        </div>
      </header>

      {/* Invite via email — share-sheet */}
      <section className="mt-6 px-5">
        <form onSubmit={sendEmail} className="glass rounded-3xl p-5 shadow-elegant space-y-3" data-testid="invite-email-form">
          <div className="flex items-center gap-3">
            <div className="bg-gold-gradient flex h-11 w-11 items-center justify-center rounded-full shadow-glow">
              <Mail className="h-4 w-4 text-deep" />
            </div>
            <div className="flex-1">
              <p className="font-display text-lg text-deep">Invite a friend by email</p>
              <p className="text-[11px] text-deep/60">We'll send a calm note with two fresh codes.</p>
            </div>
          </div>

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-deep/45">Friend's email *</span>
            <input
              data-testid="invite-to-email"
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="them@example.com"
              autoComplete="off"
              className="mt-1 w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.18em] text-deep/45">Their name</span>
              <input
                data-testid="invite-to-name"
                value={toName}
                onChange={(e) => setToName(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded-2xl border border-deep/10 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-gold"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.18em] text-deep/45">Co-signed by</span>
              <input
                data-testid="invite-cosign"
                value={coSign}
                onChange={(e) => setCoSign(e.target.value)}
                placeholder="e.g. Sara"
                className="mt-1 w-full rounded-2xl border border-deep/10 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-gold"
              />
            </label>
          </div>

          {sent && (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-[11px] text-emerald-900" data-testid="invite-sent">
              <p className="flex items-center gap-1.5"><Check className="h-3 w-3" /> Sent to <strong>{sent.email}</strong></p>
              <p className="mt-1 text-emerald-800/80">Codes <strong>{sent.codes[0]}</strong> + <strong>{sent.codes[1]}</strong> are tied to this email and remain unused until they register.</p>
            </div>
          )}

          <button
            data-testid="invite-send-email-btn"
            type="submit"
            disabled={sending || !toEmail.includes("@")}
            className="bg-emerald-gradient text-ivory shadow-elegant mt-1 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium tap-scale disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? "Sending…" : "Send invitation email"}
          </button>
        </form>
      </section>

      {/* Generate raw codes — power-user fallback */}
      <section className="mt-5 px-5">
        <div className="glass rounded-2xl p-4 shadow-soft" data-testid="generate-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-deep">Or generate a raw code</p>
              <p className="text-[11px] text-deep/55">{available} unused · unlimited</p>
            </div>
            <button
              onClick={create}
              disabled={busy}
              data-testid="create-invite-btn"
              className="bg-emerald-gradient text-ivory shadow-soft flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-medium tap-scale disabled:opacity-50"
            >
              <Plus className="h-3 w-3" /> {busy ? "Creating…" : "Generate"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 px-5 pb-10">
        <h2 className="mb-3 font-display text-base text-deep">Your codes</h2>
        {codes.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-center shadow-soft">
            <Sparkles className="mx-auto h-5 w-5 text-deep/55" />
            <p className="mt-2 text-sm text-deep/65">No codes yet. Invite a friend or generate one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {codes.map((c) => (
              <div key={c.code} className="glass flex items-center justify-between rounded-2xl p-4 shadow-soft" data-testid={`invite-${c.code}`}>
                <div>
                  <p className="font-display text-base text-deep tracking-[0.18em]">{c.code}</p>
                  <p className="text-[11px] text-deep/55">
                    {c.used_by ? "Used" : c.shared_with_email ? `Sent to ${c.shared_with_email}` : "Available"}
                  </p>
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
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-deep px-4 py-2 text-xs text-ivory shadow-elegant" data-testid="invites-toast">
          {toast}
        </div>
      )}
    </div>
  );
}
