import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ShieldCheck, BadgeCheck, Building2, Globe, MapPin, ShieldAlert } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => { (async () => {
    try {
      const r = await api.get("/admin/me");
      setIsAdmin(Boolean(r.data.is_admin));
      if (r.data.is_admin) {
        const r2 = await api.get("/admin/orgs");
        setOrgs(r2.data.orgs || []);
      }
    } catch (e) { setIsAdmin(false); }
  })(); }, []);

  const toggleVerify = async (org, next) => {
    setBusy(org.org_id);
    try {
      await api.post(`/admin/orgs/${org.org_id}/verify`, { verified: next });
      setOrgs((arr) => arr.map((o) => o.org_id === org.org_id ? { ...o, verified: next } : o));
      setToast(next ? `${org.name} verified ✓` : `${org.name} unverified`);
    } catch (e) {
      setToast(e?.response?.data?.detail || "Could not update");
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 2200);
    }
  };

  if (isAdmin === null) {
    return <MobileShell><div className="px-5 pt-12 text-xs text-deep/55">Checking access…</div></MobileShell>;
  }
  if (!isAdmin) {
    return (
      <MobileShell>
        <div className="relative px-5 pt-12" data-testid="admin-denied">
          <NoorBackdrop />
          <div className="glass rounded-3xl p-6 text-center shadow-elegant">
            <ShieldAlert className="mx-auto h-7 w-7 text-deep" />
            <p className="mt-2 font-display text-base text-deep">Admins only</p>
            <p className="mt-1 text-[11px] text-deep/55">This page is for Tasbih.ai stewards.</p>
            <Link to="/profile" className="bg-emerald-gradient text-ivory mt-5 inline-block rounded-full px-5 py-2.5 text-xs">Back to profile</Link>
          </div>
        </div>
      </MobileShell>
    );
  }

  const pending = orgs.filter((o) => !o.verified);
  const verified = orgs.filter((o) => o.verified);

  return (
    <MobileShell>
      <div className="relative" data-testid="admin-page">
        <NoorBackdrop />
        <header className="flex items-center gap-3 px-5 pt-9">
          <Link to="/profile" data-testid="admin-back" className="glass flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
            <ChevronLeft className="h-4 w-4 text-deep" />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Stewardship</p>
            <h1 className="font-display text-2xl text-deep">Admin</h1>
          </div>
          <ShieldCheck className="h-5 w-5 text-gold" />
        </header>

        <section className="mt-5 px-5">
          <div className="glass rounded-2xl p-4 shadow-soft">
            <p className="text-[11px] text-deep/60">
              Verify organisations only after a quiet human check. Verification cascades — the badge appears on the org's circles and posts everywhere in the app.
            </p>
          </div>
        </section>

        <section className="mt-6 px-5">
          <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-deep/45">Pending · {pending.length}</p>
          <div className="space-y-2.5">
            {pending.length === 0 && (
              <div className="glass rounded-2xl p-4 text-center text-xs text-deep/55 shadow-soft">
                No pending organisations. Quiet.
              </div>
            )}
            {pending.map((o) => (
              <OrgRow key={o.org_id} o={o} busy={busy === o.org_id} onToggle={() => toggleVerify(o, true)} action="Verify" />
            ))}
          </div>
        </section>

        {verified.length > 0 && (
          <section className="mt-6 px-5 pb-10">
            <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-deep/45">Verified · {verified.length}</p>
            <div className="space-y-2.5">
              {verified.map((o) => (
                <OrgRow key={o.org_id} o={o} busy={busy === o.org_id} onToggle={() => toggleVerify(o, false)} action="Unverify" verified />
              ))}
            </div>
          </section>
        )}

        {toast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-deep px-4 py-2 text-xs text-ivory shadow-elegant" data-testid="admin-toast">
            {toast}
          </div>
        )}
      </div>
    </MobileShell>
  );
}

function OrgRow({ o, busy, onToggle, action, verified }) {
  return (
    <div className="glass rounded-2xl p-4 shadow-soft" data-testid={`admin-org-${o.org_id}`}>
      <div className="flex items-start gap-3">
        <div className="bg-gold-gradient flex h-11 w-11 items-center justify-center rounded-2xl">
          <Building2 className="h-4 w-4 text-deep" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium text-deep truncate">{o.name}</p>
            {verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-gold" />}
          </div>
          {o.tagline && <p className="text-[11px] text-deep/65 truncate">{o.tagline}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-deep/55">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{o.city}{o.country !== "Global" ? `, ${o.country}` : ""}</span>
            <span className="rounded-full bg-sand/60 px-2 py-0.5 capitalize">{(o.category || "other").replace("_", " ")}</span>
            {o.website && <a href={o.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gold"><Globe className="h-3 w-3" />Website</a>}
          </div>
          <p className="mt-1.5 text-[10px] text-deep/45">owner · {o.owner_email}</p>
        </div>
      </div>
      <button
        data-testid={`admin-toggle-${o.org_id}`}
        onClick={onToggle}
        disabled={busy}
        className={`mt-3 w-full rounded-full py-2 text-[11px] font-medium tap-scale disabled:opacity-50 ${
          verified ? "glass text-deep shadow-soft" : "bg-emerald-gradient text-ivory shadow-soft"
        }`}
      >
        {busy ? "Saving…" : action}
      </button>
    </div>
  );
}
