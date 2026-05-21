import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, BadgeCheck, Building2, Search, Plus, Globe, MapPin } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const CATS = [
  { id: "", label: "All" },
  { id: "spiritual", label: "Spiritual" },
  { id: "ecdc", label: "ECDC" },
  { id: "empowerment", label: "Empowerment" },
  { id: "social_work", label: "Social Work" },
  { id: "health", label: "Health" },
  { id: "education", label: "Education" },
];

export default function OrgsPage() {
  const [orgs, setOrgs] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (cat) params.category = cat;
      const r = await api.get("/orgs", { params });
      setOrgs(r.data.orgs || []);
    } catch (e) {} finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cat]);

  return (
    <MobileShell>
      <div className="relative" data-testid="orgs-page">
        <NoorBackdrop />
        <header className="flex items-center gap-3 px-5 pt-9">
          <Link to="/profile" data-testid="orgs-back" className="glass flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
            <ChevronLeft className="h-4 w-4 text-deep" />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Directory</p>
            <h1 className="font-display text-2xl text-deep">Organisations</h1>
          </div>
          <Link to="/orgs/me" data-testid="orgs-become" className="bg-emerald-gradient text-ivory flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] shadow-soft">
            <Plus className="h-3 w-3" /> Become
          </Link>
        </header>

        <section className="mt-5 px-5">
          <Link to="/stewards" data-testid="orgs-stewards-cta" className="glass tap-scale flex items-center gap-3 rounded-2xl p-3 shadow-soft">
            <div className="bg-gold-gradient flex h-9 w-9 items-center justify-center rounded-full">
              <BadgeCheck className="h-4 w-4 text-deep" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-deep">Verified stewards</p>
              <p className="text-[11px] text-deep/55">Organisations vouched for by Tasbih.ai</p>
            </div>
            <ChevronLeft className="h-4 w-4 rotate-180 text-deep/45" />
          </Link>
        </section>

        <section className="mt-5 px-5">
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2.5 shadow-soft">
            <Search className="h-4 w-4 text-deep/50" />
            <input
              data-testid="orgs-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Search organisations…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-deep/40"
            />
          </div>
          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto no-scrollbar px-5 pb-1">
            {CATS.map(c => (
              <button
                key={c.id || "all"}
                data-testid={`orgs-cat-${c.id || "all"}`}
                onClick={() => setCat(c.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] tap-scale transition ${
                  cat === c.id ? "bg-emerald-gradient text-ivory shadow-soft" : "glass text-deep"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 space-y-3 px-5 pb-8">
          {loading && <p className="px-2 text-xs text-deep/55">Loading…</p>}
          {!loading && orgs.length === 0 && (
            <div className="glass rounded-2xl p-5 text-center shadow-soft">
              <Building2 className="mx-auto h-7 w-7 text-gold" />
              <p className="mt-2 text-sm text-deep">No organisations yet</p>
              <p className="mt-1 text-[11px] text-deep/55">Be the first — create your organisation profile.</p>
              <Link to="/orgs/me" data-testid="orgs-empty-cta" className="bg-emerald-gradient text-ivory mt-3 inline-flex rounded-full px-4 py-2 text-xs">
                Become an organisation
              </Link>
            </div>
          )}
          {orgs.map((o) => (
            <div key={o.org_id} data-testid={`org-card-${o.org_id}`} className="glass rounded-2xl p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="bg-gold-gradient flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
                  {o.logo_url ? <img src={o.logo_url} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5 text-deep" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium text-deep">{o.name}</p>
                    {o.verified && <BadgeCheck className="h-3.5 w-3.5 text-gold" />}
                  </div>
                  {o.tagline && <p className="text-[11px] text-deep/65">{o.tagline}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-deep/55">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{o.city}{o.country !== "Global" ? `, ${o.country}` : ""}</span>
                    <span className="rounded-full bg-sand/60 px-2 py-0.5 capitalize">{o.category.replace("_", " ")}</span>
                    {o.website && <a href={o.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gold"><Globe className="h-3 w-3" />Website</a>}
                  </div>
                </div>
              </div>
              {o.description && <p className="mt-3 text-xs leading-relaxed text-deep/70 line-clamp-3">{o.description}</p>}
            </div>
          ))}
        </section>
      </div>
    </MobileShell>
  );
}
