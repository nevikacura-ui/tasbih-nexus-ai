import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { Search, Users, MapPin, Plus } from "lucide-react";

export const Route = createFileRoute("/communities")({
  head: () => ({
    meta: [
      { title: "Communities — Tasbih.ai" },
      { name: "description", content: "Find youth circles, volunteer hubs, mentorship and reflection communities near you and globally." },
    ],
  }),
  component: CommunitiesPage,
});

function CommunitiesPage() {
  return (
    <MobileShell>
      <div className="relative">
        <NoorBackdrop />
        <header className="px-5 pt-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Belong</p>
              <h1 className="mt-1 font-display text-2xl text-foreground">Communities</h1>
            </div>
            <button className="bg-emerald-gradient text-primary-foreground shadow-glow flex h-10 w-10 items-center justify-center rounded-full">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="glass mt-4 flex items-center gap-2 rounded-full px-4 py-2.5 shadow-soft">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search circles, cities, interests"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filters.map((f, i) => (
              <button
                key={f}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </header>

        <section className="mt-6 px-5">
          <h2 className="mb-3 font-display text-base text-foreground">Featured circles</h2>
          <div className="space-y-3">
            {circles.map((c) => (
              <div key={c.name} className="glass flex items-center gap-4 rounded-2xl p-4 shadow-soft">
                <div className="bg-emerald-gradient noor-ring flex h-14 w-14 items-center justify-center rounded-2xl">
                  <Users className="h-6 w-6 text-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {c.city} · {c.members} members
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-foreground/75">{c.desc}</p>
                </div>
                <button className="bg-gold-gradient text-deep self-start rounded-full px-3 py-1.5 text-[11px] font-semibold">
                  Join
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-base text-foreground">Mentorship</h2>
          <div className="grid grid-cols-2 gap-3">
            {mentors.map((m) => (
              <div key={m.name} className="glass rounded-2xl p-4 shadow-soft">
                <div className="bg-gold-gradient text-deep mb-3 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold">
                  {m.name[0]}
                </div>
                <p className="text-sm font-medium text-foreground">{m.name}</p>
                <p className="text-[11px] text-muted-foreground">{m.role}</p>
                <p className="mt-2 text-[11px] text-primary">{m.tag}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </MobileShell>
  );
}

const filters = ["All", "Youth", "Volunteers", "Mentorship", "Reflection", "Family"];
const circles = [
  { name: "Toronto Youth Circle", city: "Toronto", members: 412, desc: "Sunday halqas, hiking, late-night chai conversations." },
  { name: "Noor Reflection Group", city: "Global", members: 1248, desc: "Weekly reflection prompts and journaling threads." },
  { name: "Mumbai Volunteers", city: "Mumbai", members: 287, desc: "Iftar drives, blood donation camps, education support." },
  { name: "Founders & Creators", city: "Global", members: 533, desc: "Quiet network of Muslim builders and storytellers." },
];
const mentors = [
  { name: "Dr. Sana", role: "Pediatrician", tag: "Open to mentees" },
  { name: "Hamza", role: "Founder, SaaS", tag: "2 spots" },
  { name: "Ayesha", role: "Designer", tag: "Open" },
  { name: "Yusuf", role: "Educator", tag: "Open" },
];
