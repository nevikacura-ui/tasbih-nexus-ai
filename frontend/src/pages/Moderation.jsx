import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Flag, Shield, Trash2, Check, X } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function ModerationPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState("open");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const r = await api.get("/reports", { params: { status } });
      setReports(r.data.reports || []);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not load reports.");
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const resolve = async (rep, action) => {
    setBusy(rep.report_id);
    try { await api.post(`/reports/${rep.report_id}/resolve`, null, { params: { action } }); await load(); }
    finally { setBusy(null); }
  };

  const isMod = user && (user.status === "moderator" || user.status === "admin" || user.email?.toLowerCase() === "admin@tasbih.ai");

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[480px]" data-testid="moderation-page">
      <NoorBackdrop />
      <header className="flex items-center gap-3 px-5 pt-9">
        <Link to="/profile" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
          <ArrowLeft className="h-4 w-4 text-deep" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Care</p>
          <h1 className="font-display text-2xl text-deep">Moderation</h1>
        </div>
      </header>

      {!isMod ? (
        <div className="m-5 glass rounded-3xl p-6 text-center shadow-soft" data-testid="mod-denied">
          <Shield className="mx-auto h-6 w-6 text-deep/60" />
          <p className="mt-3 font-display text-lg text-deep">Moderators only</p>
          <p className="mt-1 text-sm text-deep/60">
            This space is reserved for community moderators. If you've been asked to help, ask an admin to promote your account.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-2 px-5">
            {["open", "resolved", "all"].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                data-testid={`status-${s}`}
                className={`flex-1 rounded-full px-3 py-2 text-xs font-medium tap-scale ${
                  status === s ? "bg-emerald-gradient text-ivory" : "bg-sand text-deep"
                }`}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {error && <p className="mx-5 mt-3 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}

          <section className="mt-4 space-y-3 px-5 pb-10">
            {reports.length === 0 && (
              <div className="glass rounded-2xl p-6 text-center shadow-soft">
                <Check className="mx-auto h-5 w-5 text-deep/60" />
                <p className="mt-2 text-sm text-deep/70">No reports in this queue. A quiet space.</p>
              </div>
            )}
            {reports.map((r) => (
              <article key={r.report_id} className="glass rounded-2xl p-4 shadow-soft" data-testid={`report-${r.report_id}`}>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-deep/45">
                  <Flag className="h-3 w-3" /> {r.target_type} · {r.status}
                  <span className="ml-auto">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 font-display text-sm text-deep">"{r.reason}"</p>
                <p className="text-[11px] text-deep/55">Reported by {r.reporter_name}</p>
                {r.target && (
                  <div className="mt-3 rounded-2xl bg-white/60 p-3 text-xs text-deep/80">
                    <p className="mb-1 text-[10px] font-medium text-deep/55">{r.target.author_name || "(unknown)"}</p>
                    <p>{r.target.text}</p>
                  </div>
                )}
                {r.status === "open" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => resolve(r, "dismiss")}
                      disabled={busy === r.report_id}
                      data-testid={`dismiss-${r.report_id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-sand py-2 text-xs font-medium text-deep tap-scale disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Dismiss
                    </button>
                    <button
                      onClick={() => resolve(r, "remove")}
                      disabled={busy === r.report_id}
                      data-testid={`remove-${r.report_id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-emerald-gradient py-2 text-xs font-medium text-ivory tap-scale disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove content
                    </button>
                  </div>
                )}
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
