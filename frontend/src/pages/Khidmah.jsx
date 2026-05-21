import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, HandHeart, Crown, Sparkles, Heart, MessageSquare, GraduationCap, Users } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const REASON_LABEL = {
  volunteer_rsvp: { label: "Volunteer RSVPs", icon: HandHeart },
  post_with_likes: { label: "Loved posts", icon: Heart },
  kind_comment: { label: "Kind comments", icon: MessageSquare },
  mentorship_accepted_mentor: { label: "Mentorship offered", icon: GraduationCap },
  mentorship_accepted_mentee: { label: "Mentorship received", icon: Users },
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function KhidmahPage() {
  const [data, setData] = useState(null);
  const [year, setYear] = useState(null);
  const [month, setMonth] = useState(null);

  const load = async (y, m) => {
    try {
      const params = {};
      if (y) params.year = y;
      if (m) params.month = m;
      const r = await api.get("/khidmah/leaderboard", { params });
      setData(r.data);
    } catch (e) {}
  };
  useEffect(() => { load(year, month); }, [year, month]);

  const goPrev = () => {
    const d = new Date(data.year, data.month - 1, 1);
    d.setMonth(d.getMonth() - 1);
    setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
  };
  const goNext = () => {
    const d = new Date(data.year, data.month - 1, 1);
    d.setMonth(d.getMonth() + 1);
    setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
  };

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[480px]" data-testid="khidmah-page">
      <NoorBackdrop />
      <header className="flex items-center gap-3 px-5 pt-9">
        <Link to="/profile" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
          <ArrowLeft className="h-4 w-4 text-deep" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Service · Khidmah</p>
          <h1 className="font-display text-2xl text-deep">Leaderboard</h1>
        </div>
      </header>

      <p className="px-5 pt-3 text-[11px] leading-relaxed text-deep/55">
        Soft recognition — not vanity metrics. Points come from showing up: volunteering, kind comments, mentorship moments. No likes-of-likes, no follower counts.
      </p>

      {data && (
        <>
          <div className="mt-4 flex items-center justify-between px-5">
            <button onClick={goPrev} className="rounded-full bg-sand px-3 py-1.5 text-xs font-medium text-deep tap-scale">← Prev</button>
            <p className="font-display text-base text-deep">{MONTH_NAMES[(data.month - 1)] } {data.year}</p>
            <button onClick={goNext} className="rounded-full bg-sand px-3 py-1.5 text-xs font-medium text-deep tap-scale">Next →</button>
          </div>

          <section className="mt-5 px-5">
            <div className="bg-emerald-gradient noor-ring relative overflow-hidden rounded-3xl p-5 text-ivory shadow-elegant" data-testid="khidmah-me-card">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/30 blur-3xl" />
              <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Your khidmah</p>
              <div className="mt-2 flex items-end gap-3">
                <p className="font-display text-4xl leading-none">{data.you.points}</p>
                <p className="mb-1 text-xs text-ivory/75">points · {data.you.rank ? `#${data.you.rank}` : "not ranked yet"}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(data.you.breakdown || {}).length === 0 ? (
                  <p className="text-[11px] text-ivory/75">A quiet month — try one small act this week.</p>
                ) : Object.entries(data.you.breakdown).map(([k, v]) => {
                  const Cfg = REASON_LABEL[k] || { label: k, icon: Sparkles };
                  return (
                    <span key={k} className="inline-flex items-center gap-1 rounded-full bg-ivory/15 px-2 py-0.5 text-[10px] text-ivory">
                      <Cfg.icon className="h-3 w-3" /> {Cfg.label} · +{v}
                    </span>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="mt-6 px-5 pb-10">
            <h2 className="mb-3 font-display text-base text-deep">Quiet leaders this month</h2>
            {data.leaders.length === 0 ? (
              <div className="glass rounded-2xl p-5 text-center shadow-soft">
                <HandHeart className="mx-auto h-5 w-5 text-deep/60" />
                <p className="mt-2 text-sm text-deep/65">A quiet month. Yours to begin.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.leaders.map((l) => (
                  <div key={l.user_id} className="glass flex items-center gap-3 rounded-2xl p-3.5 shadow-soft" data-testid={`leader-${l.user_id}`}>
                    <RankBadge rank={l.rank} />
                    <div className="bg-gold-gradient text-deep flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold">
                      {(l.name || "?")[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-deep">{l.name}</p>
                      <p className="text-[11px] text-deep/55">{Object.keys(l.breakdown).length} kind moments this month</p>
                    </div>
                    <p className="font-display text-lg text-deep">{l.points}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="px-5 pb-10">
            <div className="glass rounded-2xl p-4 shadow-soft">
              <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">How khidmah is earned</p>
              <ul className="mt-2 space-y-1 text-xs text-deep/75">
                {Object.entries(data.rules).map(([k, v]) => {
                  const Cfg = REASON_LABEL[k] || { label: k, icon: Sparkles };
                  return (
                    <li key={k} className="flex items-center gap-2">
                      <Cfg.icon className="h-3.5 w-3.5 text-deep" />
                      {Cfg.label} <span className="ml-auto font-semibold text-deep">+{v}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[10px] text-deep/45">
                Not for showing off — just a gentle mirror of where care lives in this community.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function RankBadge({ rank }) {
  if (rank === 1) return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-gradient shadow-glow" data-testid="rank-1">
      <Crown className="h-4 w-4 text-deep" />
    </div>
  );
  if (rank <= 3) return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sand text-deep font-display text-sm">
      {rank}
    </div>
  );
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/60 text-deep/65 font-display text-sm">
      {rank}
    </div>
  );
}
