import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users, MapPin, Plus, MessageCircle } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const FILTERS = ["All", "Youth", "Volunteers", "Mentorship", "Reflection", "Family"];

export default function CommunitiesPage() {
  const [comms, setComms] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");

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
    const matchesQ = !q || (c.name + c.city + c.description).toLowerCase().includes(q.toLowerCase());
    const matchesF =
      filter === "All" ||
      (filter === "Youth" && c.kind === "youth") ||
      (filter === "Volunteers" && c.kind === "volunteers") ||
      (filter === "Mentorship" && c.kind === "mentorship") ||
      (filter === "Reflection" && c.kind === "reflection") ||
      (filter === "Family" && c.kind === "family");
    return matchesQ && matchesF;
  });

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
            <button className="bg-emerald-gradient text-ivory shadow-glow flex h-10 w-10 items-center justify-center rounded-full tap-scale" aria-label="Create">
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
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: "Dr. Sana", role: "Pediatrician", tag: "Open to mentees" },
              { name: "Hamza", role: "Founder, SaaS", tag: "2 spots" },
              { name: "Ayesha", role: "Designer", tag: "Open" },
              { name: "Yusuf", role: "Educator", tag: "Open" },
            ].map((m) => (
              <div key={m.name} className="glass rounded-2xl p-4 shadow-soft">
                <div className="bg-gold-gradient text-deep mb-3 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold">
                  {m.name[0]}
                </div>
                <p className="text-sm font-medium text-deep">{m.name}</p>
                <p className="text-[11px] text-deep/55">{m.role}</p>
                <p className="mt-2 text-[11px] text-deep/75">{m.tag}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </MobileShell>
  );
}
