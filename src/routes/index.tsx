import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import noorHero from "@/assets/noor-hero.jpg";
import {
  Sparkles,
  BookOpen,
  Heart,
  ArrowRight,
  Flame,
  Calendar,
  Users,
  HandHeart,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tasbih.ai — Remember. Reflect. Seek Noor." },
      { name: "description", content: "Your daily Noor — reflections, tasbih, community and AI spiritual companion." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <MobileShell>
      <div className="relative">
        <NoorBackdrop />

        <header className="px-5 pb-2 pt-8 animate-float-up">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">As-salāmu ʿalaykum</p>
          <h1 className="mt-1 text-2xl font-medium text-foreground">
            Welcome back, <span className="text-gold-gradient">Amir</span>
          </h1>
        </header>

        <section className="px-5 pt-5">
          <div className="relative overflow-hidden rounded-3xl shadow-elegant">
            <div className="bg-emerald-gradient absolute inset-0" />
            <img
              src={noorHero}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-screen"
              width={1024}
              height={1024}
            />
            <div className="relative p-6 text-primary-foreground">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Noor of the Day
              </div>
              <p className="mt-4 font-display text-[19px] leading-snug">
                “And He found you lost and guided you. And He found you in need and made you self-sufficient.”
              </p>
              <p className="mt-2 text-xs text-primary-foreground/70">Surah Ad-Duha · 93:7–8</p>

              <div className="glass-dark mt-5 rounded-2xl p-3.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-accent">AI Reflection</p>
                <p className="mt-1.5 text-sm text-primary-foreground/90">
                  Wherever you are today, you are guided — even the quiet moments are part of the path.
                </p>
                <Link
                  to="/reflect"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-all hover:gap-2"
                >
                  Reflect with Noor <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 px-5">
          <div className="grid grid-cols-3 gap-3">
            <RitualCard icon={Sparkles} label="Tasbih" value="312" to="/spiritual" />
            <RitualCard icon={Flame} label="Streak" value="14d" to="/spiritual" />
            <RitualCard icon={BookOpen} label="Journal" value="New" to="/reflect" />
          </div>
        </section>

        <section className="mt-5 px-5">
          <Link to="/reminders" className="glass block rounded-3xl p-5 shadow-soft transition-transform active:scale-[0.99]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Next Prayer</p>
                <p className="mt-1 font-display text-xl text-foreground">Maghrib</p>
                <p className="text-xs text-muted-foreground">in 2h 14m · 5:42 PM</p>
                <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                  Customize reminders <ArrowRight className="h-3 w-3" />
                </p>
              </div>
              <div className="relative h-16 w-16">
                <div className="noor-ring animate-breathe absolute inset-0 rounded-full" />
                <div className="bg-gold-gradient absolute inset-2 rounded-full opacity-90" />
              </div>
            </div>
          </Link>
        </section>

        <section className="mt-7 px-5">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-lg text-foreground">Your Circles</h2>
            <Link to="/communities" className="text-xs font-medium text-primary">See all</Link>
          </div>
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {circles.map((c) => (
              <div key={c.name} className="glass min-w-[200px] rounded-2xl p-4 shadow-soft">
                <div className="bg-emerald-gradient mb-3 flex h-10 w-10 items-center justify-center rounded-full">
                  <Users className="h-5 w-5 text-accent" />
                </div>
                <p className="text-sm font-medium text-foreground">{c.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.members} members · {c.city}</p>
                <p className="mt-3 line-clamp-2 text-xs text-primary">{c.update}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 px-5">
          <FeatureTile to="/events" icon={Calendar} title="Events" subtitle="Youth night · Sat" tint="emerald" />
          <FeatureTile to="/communities" icon={HandHeart} title="Volunteer" subtitle="3 drives nearby" tint="gold" />
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-lg text-foreground">Noor Reflections</h2>
          <div className="space-y-3">
            {reflections.map((r) => (
              <article key={r.author} className="glass rounded-2xl p-4 shadow-soft">
                <div className="flex items-center gap-2.5">
                  <div className="bg-gold-gradient text-deep flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold">
                    {r.author[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.author}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.circle}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-foreground/85">{r.text}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {r.likes}</span>
                  <span>{r.time}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </MobileShell>
  );
}

function RitualCard({
  icon: Icon, label, value, to,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; to: string }) {
  return (
    <Link to={to} className="glass flex flex-col items-start gap-2 rounded-2xl p-3.5 shadow-soft transition-transform active:scale-95">
      <span className="bg-emerald-gradient flex h-8 w-8 items-center justify-center rounded-full">
        <Icon className="h-4 w-4 text-accent" />
      </span>
      <div>
        <p className="font-display text-base text-foreground">{value}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
    </Link>
  );
}

function FeatureTile({
  to, icon: Icon, title, subtitle, tint,
}: { to: string; icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string; tint: "emerald" | "gold" }) {
  return (
    <Link
      to={to}
      className={`relative overflow-hidden rounded-2xl p-4 shadow-soft transition-transform active:scale-95 ${
        tint === "emerald" ? "bg-emerald-gradient text-primary-foreground" : "bg-gold-gradient text-deep"
      }`}
    >
      <Icon className="h-5 w-5 opacity-90" />
      <p className="mt-6 font-display text-lg">{title}</p>
      <p className="text-xs opacity-80">{subtitle}</p>
    </Link>
  );
}

const circles = [
  { name: "Toronto Youth", city: "Toronto", members: "412", update: "Sunday halqa: Surah Yusuf reflections" },
  { name: "Noor Reflections", city: "Global", members: "1.2k", update: "Weekly prompt: gratitude in stillness" },
  { name: "Mumbai Volunteers", city: "Mumbai", members: "287", update: "Iftar drive sign-ups open" },
];

const reflections = [
  { author: "Layla", circle: "Noor Circle · London", text: "Sat with the dawn today. The silence felt like a quiet answer to a prayer I hadn't said out loud yet.", likes: 42, time: "2h" },
  { author: "Imran", circle: "Students · Karachi", text: "Started writing one ayah a day in my journal. Small ritual, big shift in how I notice my hours.", likes: 28, time: "5h" },
];
