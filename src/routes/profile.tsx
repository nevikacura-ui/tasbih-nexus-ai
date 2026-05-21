import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import {
  Settings, Award, BookOpen, HandHeart, Users, Sparkles, Bell, ChevronRight,
  LogIn, LogOut, ShieldCheck, Flag, Crown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Tasbih.ai" },
      { name: "description", content: "Your spiritual journey, communities, reflections, and mentorship roles." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Friend";
  const initial = displayName.charAt(0).toUpperCase();
  const isMember = profile?.status === "member";

  return (
    <MobileShell>
      <div className="relative">
        <NoorBackdrop />
        <header className="flex items-start justify-between px-5 pt-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Profile</p>
            <h1 className="mt-1 font-display text-2xl text-foreground">{displayName}</h1>
          </div>
          <Link to="/reminders" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full">
            <Settings className="h-4 w-4 text-foreground" />
          </Link>
        </header>

        <section className="mt-5 px-5">
          <div className="glass shadow-elegant rounded-3xl p-5">
            <div className="flex items-center gap-4">
              <div className="bg-gold-gradient noor-ring text-deep flex h-16 w-16 items-center justify-center rounded-full font-display text-2xl">
                {initial}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {profile?.city || (user ? "Add your city" : "Explore mode")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user
                    ? isMember
                      ? "Member · Community access unlocked"
                      : `Explorer · ${profile?.referrals_received ?? 0}/2 referrals`
                    : "Sign in to begin your journey"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <Metric value="14" label="Streak" />
              <Metric value="312" label="Reflections" />
              <Metric value="9" label="Drives" />
            </div>
          </div>
        </section>

        <section className="mt-6 px-5">
          <h2 className="mb-3 font-display text-base text-foreground">Badges</h2>
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {badges.map((b) => (
              <div key={b.label} className="glass min-w-[110px] rounded-2xl p-3 text-center shadow-soft">
                <div className="bg-gold-gradient mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                  <b.icon className="h-5 w-5 text-deep" />
                </div>
                <p className="mt-2 text-[11px] font-medium text-foreground">{b.label}</p>
                <p className="text-[10px] text-muted-foreground">{b.sub}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 space-y-2 px-5">
          <RowLink to="/reminders" icon={Bell} title="Reminders & Noor Nudges" sub="Customize prayers, daily nudges, quiet hours" />
          <RowLink to="/guidelines" icon={ShieldCheck} title="Community Guidelines" sub="How we keep this circle calm and safe" />
          <RowLink to="/report" search={{ type: "user" as const, id: "" }} icon={Flag} title="Report something" sub="Confidential · reviewed by moderators" />
          {user && (
            <RowLink to="/reports" icon={Clock} title="My reports" sub="Track status: received, reviewing, actioned" />
          )}
          {user && (
            <>
              <RowLink to="/moderation" icon={ShieldCheck} title="Moderation queue" sub="For moderators and admins" />
              <RowLink to="/admin/moderators" icon={Crown} title="Manage moderators" sub="Admins only · promote or demote" />
            </>
          )}
        </section>

        <section className="mt-6 px-5">
          <h2 className="mb-3 font-display text-base text-foreground">Communities</h2>
          <div className="space-y-2.5">
            {memberships.map((m) => (
              <div key={m.name} className="glass flex items-center gap-3 rounded-2xl p-3.5 shadow-soft">
                <div className="bg-emerald-gradient flex h-9 w-9 items-center justify-center rounded-full">
                  <Users className="h-4 w-4 text-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">{m.role}</p>
                </div>
                <span className="text-[11px] text-primary">Active</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 px-5 pb-6">
          {loading ? null : user ? (
            <button
              onClick={handleSignOut}
              className="glass flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-foreground shadow-soft transition-transform active:scale-[0.98]"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          ) : (
            <Link
              to="/login"
              className="bg-emerald-gradient text-primary-foreground shadow-elegant flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium transition-transform active:scale-[0.98]"
            >
              <LogIn className="h-4 w-4" /> Sign in with Google
            </Link>
          )}
        </section>
      </div>
    </MobileShell>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-secondary/60 rounded-2xl p-3">
      <p className="font-display text-xl text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

type RowLinkProps = {
  to: string;
  icon: typeof Bell;
  title: string;
  sub: string;
  search?: Record<string, unknown>;
};

function RowLink({ to, icon: Icon, title, sub, search }: RowLinkProps) {
  return (
    <Link
      to={to as any}
      search={search as any}
      className="glass flex items-center gap-3 rounded-2xl p-4 shadow-soft transition-transform active:scale-[0.98]"
    >
      <div className="bg-gold-gradient flex h-10 w-10 items-center justify-center rounded-full">
        <Icon className="h-4 w-4 text-deep" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

const badges = [
  { icon: Sparkles, label: "Noor Seeker", sub: "30-day reflect" },
  { icon: BookOpen, label: "Journalist", sub: "100 entries" },
  { icon: HandHeart, label: "Giver", sub: "9 drives" },
  { icon: Award, label: "Mentor", sub: "Verified" },
];
const memberships = [
  { name: "Toronto Youth Circle", role: "Member" },
  { name: "Noor Reflection Group", role: "Moderator" },
  { name: "Founders & Creators", role: "Mentor" },
];
