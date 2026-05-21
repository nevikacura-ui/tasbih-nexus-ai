import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users, MapPin, Plus, MessageCircle, X } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const FILTERS = ["All", "Spiritual", "ECDC", "Empowerment", "Social Work", "Health", "Education"];

const FILTER_TO_CATEGORY = {
  "All": null,
  "Spiritual": "spiritual",
  "ECDC": "ecdc",
  "Empowerment": "empowerment",
  "Social Work": "social_work",
  "Health": "health",
  "Education": "education",
};

export default function CommunitiesPage() {
  const [comms, setComms] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [country, setCountry] = useState("All");
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    try {
      const [a, b] = await Promise.all([api.get("/communities"), api.get("/memberships")]);
      setComms(a.data.communities || []);
      setMemberships(b.data.memberships || []);
    } catch (e) {}
  };
  useEffect(() => { load(); }, []);
  const isMember = (id) => memberships.some((m) => m.community_id === id);

  const join = async (id) => {
    try { await api.post(`/communities/${id}/join`); await load(); } catch (e) {}
  };

  const filtered = comms.filter((c) => {
    const matchesQ = !q || (c.name + c.city + (c.country || "") + c.description).toLowerCase().includes(q.toLowerCase());
    const targetCat = FILTER_TO_CATEGORY[filter];
    const matchesF = !targetCat || c.category === targetCat || c.kind === targetCat;
    const matchesCountry = country === "All" || (c.country || "Global") === country;
    return matchesQ && matchesF && matchesCountry;
  });

  const countries = ["All", ...Array.from(new Set(comms.map((c) => c.country || "Global"))).sort()];

  return (
    <MobileShell>
      <div className="relative" data-testid="circles-page">
        <NoorBackdrop />
        <header className="px-5 pt-9">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Belong</p>
              <h1 className="mt-1 font-display text-2xl text-deep">Communities</h1>
            </div>
            <button onClick={() => setCreateOpen(true)} data-testid="create-circle-btn" className="bg-emerald-gradient text-ivory shadow-glow flex h-10 w-10 items-center justify-center rounded-full tap-scale" aria-label="Create circle">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="glass mt-4 flex items-center gap-2 rounded-full px-4 py-2.5 shadow-soft">
            <Search className="h-4 w-4 text-deep/55" />
            <input
              data-testid="circles-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search circles, cities, interests"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-deep/45"
            />
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                data-testid={`filter-${f.toLowerCase()}`}
                onClick={() => setFilter(f)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium tap-scale ${
                  filter === f ? "bg-emerald-gradient text-ivory" : "bg-sand text-deep"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1" data-testid="country-filter">
            {countries.map((c) => (
              <button
                key={c}
                data-testid={`country-${c}`}
                onClick={() => setCountry(c)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] tap-scale ${
                  country === c ? "border-deep bg-deep text-ivory" : "border-deep/15 bg-white/60 text-deep/75"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </header>

        <section className="mt-6 px-5">
          <h2 className="mb-3 font-display text-base text-deep">Featured circles</h2>
          <div className="space-y-3">
            {filtered.map((c) => (
              <div key={c.community_id} className="glass flex items-center gap-4 rounded-2xl p-4 shadow-soft" data-testid={`circle-${c.community_id}`}>
                <div className="bg-emerald-gradient noor-ring flex h-14 w-14 items-center justify-center rounded-2xl">
                  <Users className="h-6 w-6 text-gold" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-deep">{c.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-deep/55">
                    <MapPin className="h-3 w-3" /> {c.city} · {c.members} members
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-deep/70">{c.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => !isMember(c.community_id) && join(c.community_id)}
                    data-testid={`join-${c.community_id}`}
                    disabled={isMember(c.community_id)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold tap-scale ${
                      isMember(c.community_id)
                        ? "bg-deep/10 text-deep"
                        : "bg-gold-gradient text-deep"
                    }`}
                  >
                    {isMember(c.community_id) ? "Joined" : "Join"}
                  </button>
                  <Link
                    to={`/circles/${c.community_id}/chat`}
                    data-testid={`chat-${c.community_id}`}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-gradient px-3 py-1.5 text-[10px] font-semibold text-ivory tap-scale"
                  >
                    <MessageCircle className="h-3 w-3" /> Chat
                  </Link>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-xs text-deep/55">No circles match that search.</p>
            )}
          </div>
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-base text-deep">Mentorship</h2>
          <div className="glass rounded-2xl p-4 shadow-soft text-center">
            <p className="text-sm text-deep">Browse Tasbih.ai mentors — share what you know, find someone walking the path you've walked.</p>
            <Link to="/mentors" data-testid="goto-mentors" className="bg-emerald-gradient text-ivory shadow-elegant mt-3 inline-block rounded-full px-5 py-2 text-xs font-semibold tap-scale">
              Open mentorship
            </Link>
          </div>
        </section>

        {createOpen && <CreateCircleModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />}
      </div>
    </MobileShell>
  );
}

function CreateCircleModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try { const r = await api.get("/communities/categories"); setCategories(r.data.categories || []); } catch (e) {}
    })();
  }, []);

  const save = async () => {
    if (!name.trim() || name.trim().length < 3) { setErr("Give your circle a calm, clear name (3+ chars)."); return; }
    setBusy(true); setErr(null);
    try {
      await api.post("/communities", {
        name: name.trim(),
        category,
        country: country.trim() || "Global",
        city: city.trim() || "Global",
        description: description.trim(),
      });
      onCreated();
    } catch (e) { setErr(e?.response?.data?.detail || "Could not create."); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-deep/30 backdrop-blur-sm" data-testid="create-circle-modal" onClick={onClose}>
      <div className="glass w-full max-w-[480px] rounded-t-[28px] p-5 shadow-elegant" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-deep/15" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Create</p>
            <h2 className="font-display text-xl text-deep">A new circle</h2>
          </div>
          <button onClick={onClose} className="text-deep/55" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-xs text-deep/60">Circles are warm rooms for ongoing conversation. Pick a calm name.</p>

        <div className="mt-4 space-y-3">
          <input data-testid="cc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Circle name (e.g. Calgary Health & Wellbeing)" className="w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm outline-none focus:border-gold" />
          <select data-testid="cc-category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm outline-none focus:border-gold">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input data-testid="cc-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm outline-none focus:border-gold" />
            <input data-testid="cc-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm outline-none focus:border-gold" />
          </div>
          <textarea data-testid="cc-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What is this circle for? Who is welcome?" className="w-full resize-none rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm outline-none focus:border-gold" />
        </div>
        {err && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
        <button data-testid="cc-save" onClick={save} disabled={busy} className="bg-emerald-gradient text-ivory shadow-elegant mt-4 w-full rounded-full py-3 text-sm font-medium tap-scale disabled:opacity-50">
          {busy ? "Creating…" : "Create circle"}
        </button>
      </div>
    </div>
  );
}
