import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, BadgeCheck, Building2, Globe, MapPin, ShieldCheck } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

export default function StewardsPage() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try {
      const r = await api.get("/orgs", { params: { verified_only: true } });
      setOrgs(r.data.orgs || []);
    } catch (e) {} finally { setLoading(false); }
  })(); }, []);

  return (
    <MobileShell>
      <div className="relative" data-testid="stewards-page">
        <NoorBackdrop />
        <header className="flex items-center gap-3 px-5 pt-9">
          <Link to="/orgs" data-testid="stewards-back" className="glass flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
            <ChevronLeft className="h-4 w-4 text-deep" />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-gold flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Verified by Tasbih.ai stewards
            </p>
            <h1 className="font-display text-2xl text-deep">Verified stewards</h1>
          </div>
        </header>

        <section className="mt-4 px-5">
          <div className="glass rounded-2xl p-4 shadow-soft" data-testid="stewards-intro">
            <p className="text-[11px] leading-relaxed text-deep/65">
              A quiet directory of organisations who have been gently vouched for by Tasbih.ai stewards. No leaderboard, no ranking — just trust signals for newcomers looking for places to begin.
            </p>
          </div>
        </section>

        <section className="mt-5 space-y-3 px-5 pb-10">
          {loading && <p className="px-2 text-xs text-deep/55">Loading…</p>}
          {!loading && orgs.length === 0 && (
            <div className="glass rounded-2xl p-5 text-center shadow-soft" data-testid="stewards-empty">
              <Building2 className="mx-auto h-7 w-7 text-gold" />
              <p className="mt-2 text-sm text-deep">No verified stewards yet</p>
              <p className="mt-1 text-[11px] text-deep/55">
                Organisations appear here after a quiet human check by Tasbih.ai stewards.
              </p>
              <Link to="/orgs" className="bg-emerald-gradient text-ivory mt-4 inline-flex rounded-full px-4 py-2 text-xs">
                See all organisations
              </Link>
            </div>
          )}
          {orgs.map((o) => (
            <article key={o.org_id} data-testid={`steward-${o.org_id}`} className="glass rounded-2xl p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="bg-gold-gradient flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
                  {o.logo_url ? <img src={o.logo_url} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5 text-deep" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium text-deep truncate">{o.name}</p>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-gold" />
                  </div>
                  {o.tagline && <p className="text-[11px] text-deep/65 truncate">{o.tagline}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-deep/55">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{o.city}{o.country !== "Global" ? `, ${o.country}` : ""}</span>
                    <span className="rounded-full bg-sand/60 px-2 py-0.5 capitalize">{(o.category || "other").replace("_", " ")}</span>
                    {o.website && <a href={o.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gold"><Globe className="h-3 w-3" />Website</a>}
                  </div>
                </div>
              </div>
              {o.description && <p className="mt-3 text-xs leading-relaxed text-deep/70 line-clamp-3">{o.description}</p>}
            </article>
          ))}
        </section>
      </div>
    </MobileShell>
  );
}
