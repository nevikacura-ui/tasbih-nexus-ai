import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Sparkles, BookOpen, HandHeart, Award, Bell, ChevronRight, ShieldCheck, UserPlus, Flame, Users } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [tasbih, setTasbih] = useState({ today: 0, streak: 0, total: 0 });
  const [memberships, setMemberships] = useState([]);
  const [journalCount, setJournalCount] = useState(0);

  useEffect(() => { (async () => {
    try {
      const [t, m, j] = await Promise.all([api.get("/tasbih/state"), api.get("/memberships"), api.get("/journal")]);
      setTasbih(t.data); setMemberships(m.data.memberships || []); setJournalCount((j.data.entries || []).length);
    } catch (e) {}
  })(); }, []);

  const handleLogout = async () => { await logout(); window.location.href = "/login"; };
  const name = user?.name || "Friend";
  const initial = name.charAt(0).toUpperCase();

  return (
    <MobileShell>
      <div className="relative" data-testid="profile-page">
        <NoorBackdrop />
        <header className="flex items-start justify-between px-5 pt-9">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Profile</p>
            <h1 className="mt-1 font-display text-2xl text-deep" data-testid="profile-name">{name}</h1>
          </div>
        </header>

        <section className="mt-5 px-5">
          <div className="glass shadow-elegant rounded-3xl p-5" data-testid="profile-card">
            <div className="flex items-center gap-4">
              <div className="bg-gold-gradient noor-ring text-deep flex h-16 w-16 items-center justify-center rounded-full font-display text-2xl">
                {initial}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-deep">{user?.city || "Add your city"}</p>
                <p className="text-xs text-deep/55">
                  {user?.status === "member" ? "Member · access unlocked" : "Explorer"}
                  {user?.invites_available !== undefined && ` · ${user.invites_available} invites left`}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <Metric value={String(tasbih.streak ?? 0)} label="Streak" />
              <Metric value={String(tasbih.total ?? 0)} label="Dhikr" />
              <Metric value={String(journalCount)} label="Entries" />
            </div>
          </div>
        </section>

        <section className="mt-6 px-5">
          <h2 className="mb-3 font-display text-base text-deep">Badges</h2>
          <div className="-mx-5 flex gap-3 overflow-x-auto no-scrollbar px-5 pb-1">
            {[
              { icon: Sparkles, label: "Noor Seeker", sub: tasbih.streak >= 7 ? "Unlocked" : "Reflect 7d" },
              { icon: BookOpen, label: "Journalist", sub: journalCount >= 1 ? "Unlocked" : "First entry" },
              { icon: HandHeart, label: "Giver", sub: "Coming soon" },
              { icon: Award, label: "Mentor", sub: "Coming soon" },
            ].map((b) => (
              <div key={b.label} className="glass min-w-[112px] rounded-2xl p-3 text-center shadow-soft">
                <div className="bg-gold-gradient mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                  <b.icon className="h-5 w-5 text-deep" />
                </div>
                <p className="mt-2 text-[11px] font-medium text-deep">{b.label}</p>
                <p className="text-[10px] text-deep/55">{b.sub}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 space-y-2 px-5">
          <RowLink to="/invites" icon={UserPlus} title="Invitations" sub="Welcome friends with grace" test="row-invites" />
          <RowLink to="/journal" icon={BookOpen} title="My journal" sub={`${journalCount} private entries`} test="row-journal" />
          <RowLink to="/tasbih" icon={Flame} title="Dhikr & streaks" sub={`${tasbih.streak ?? 0}-day streak`} test="row-tasbih" />
          <RowLink to="/reminders" icon={Bell} title="Reminders & Noor Nudges" sub="Soft in-app cues for prayer, dhikr & journaling" test="row-reminders" />
          <Row icon={ShieldCheck} title="Community Guidelines" sub="Calm, respectful, non-authoritative" />
        </section>

        {memberships.length > 0 && (
          <section className="mt-6 px-5">
            <h2 className="mb-3 font-display text-base text-deep">Communities</h2>
            <div className="space-y-2.5">
              {memberships.map((m) => (
                <div key={m.community_id} className="glass flex items-center gap-3 rounded-2xl p-3.5 shadow-soft">
                  <div className="bg-emerald-gradient flex h-9 w-9 items-center justify-center rounded-full">
                    <Users className="h-4 w-4 text-gold" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-deep">{m.community?.name}</p>
                    <p className="text-[11px] text-deep/55">{m.role}</p>
                  </div>
                  <span className="text-[11px] text-deep/75">Active</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 px-5 pb-6">
          <p className="mb-3 px-2 text-[10px] leading-relaxed text-deep/45">
            Tasbih.ai is an independent community platform — not a religious authority, fatwa platform, or institutional representative.
          </p>
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            className="glass flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-deep shadow-soft tap-scale"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </section>
      </div>
    </MobileShell>
  );
}

function Metric({ value, label }) {
  return (
    <div className="rounded-2xl bg-sand/60 p-3">
      <p className="font-display text-xl text-deep">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-deep/55">{label}</p>
    </div>
  );
}

function RowLink({ to, icon: Icon, title, sub, test }) {
  return (
    <Link to={to} data-testid={test} className="glass tap-scale flex items-center gap-3 rounded-2xl p-4 shadow-soft">
      <div className="bg-gold-gradient flex h-10 w-10 items-center justify-center rounded-full">
        <Icon className="h-4 w-4 text-deep" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-deep">{title}</p>
        <p className="text-[11px] text-deep/55">{sub}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-deep/45" />
    </Link>
  );
}

function Row({ icon: Icon, title, sub }) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-4 shadow-soft">
      <div className="bg-gold-gradient flex h-10 w-10 items-center justify-center rounded-full">
        <Icon className="h-4 w-4 text-deep" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-deep">{title}</p>
        <p className="text-[11px] text-deep/55">{sub}</p>
      </div>
    </div>
  );
}
