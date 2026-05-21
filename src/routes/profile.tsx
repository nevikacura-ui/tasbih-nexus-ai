import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { Settings, Award, BookOpen, HandHeart, Users, Sparkles, Bell, ChevronRight } from "lucide-react";

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
  return (
    <MobileShell>
      <div className="relative">
        <NoorBackdrop />
        <header className="flex items-start justify-between px-5 pt-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Profile</p>
            <h1 className="mt-1 font-display text-2xl text-foreground">Amir Karimov</h1>
          </div>
          <Link to="/reminders" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full">
            <Settings className="h-4 w-4 text-foreground" />
          </Link>
        </header>

        <section className="mt-5 px-5">
          <div className="glass shadow-elegant rounded-3xl p-5">
            <div className="flex items-center gap-4">
              <div className="bg-gold-gradient noor-ring text-deep flex h-16 w-16 items-center justify-center rounded-full font-display text-2xl">
                A
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Toronto · Joined 2024</p>
                <p className="text-xs text-muted-foreground">Member · Mentor · Volunteer</p>
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
