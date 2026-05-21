import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { Calendar, MapPin, Clock } from "lucide-react";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — Tasbih.ai" },
      { name: "description", content: "Discover spiritual gatherings, youth meetups, and volunteering drives near you." },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  return (
    <MobileShell>
      <div className="relative">
        <NoorBackdrop />
        <header className="px-5 pt-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Gather</p>
          <h1 className="mt-1 font-display text-2xl text-foreground">Events</h1>
        </header>

        <section className="mt-6 px-5">
          <div className="bg-emerald-gradient noor-ring text-primary-foreground shadow-elegant relative overflow-hidden rounded-3xl p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-accent">Featured</p>
            <h2 className="mt-2 font-display text-2xl leading-tight">Noor Night · Reflections under the stars</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-primary-foreground/80">
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Sat, May 24</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> 8:00 PM</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Toronto Islamic Centre</span>
            </div>
            <button className="bg-gold-gradient text-deep mt-5 rounded-full px-5 py-2 text-xs font-semibold">RSVP</button>
          </div>
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-base text-foreground">This week</h2>
          <div className="space-y-3">
            {events.map((e) => (
              <article key={e.title} className="glass flex gap-4 rounded-2xl p-4 shadow-soft">
                <div className="bg-sand text-deep flex h-14 w-14 flex-col items-center justify-center rounded-2xl">
                  <span className="text-[10px] uppercase tracking-wider">{e.month}</span>
                  <span className="font-display text-lg leading-none">{e.day}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{e.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{e.where}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-primary">
                    <span>{e.tag}</span>
                    <span className="text-muted-foreground">· {e.going} going</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-base text-foreground">Volunteer drives</h2>
          <div className="grid grid-cols-2 gap-3">
            {drives.map((d) => (
              <div key={d.title} className="bg-gold-gradient text-deep rounded-2xl p-4 shadow-soft">
                <p className="font-display text-base leading-tight">{d.title}</p>
                <p className="mt-1 text-[11px] opacity-80">{d.where}</p>
                <p className="mt-3 text-[11px] font-semibold">{d.slots} spots left</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </MobileShell>
  );
}

const events = [
  { month: "May", day: "22", title: "Youth halqa: Surah Al-Kahf", where: "Mississauga · 7:00 PM", tag: "Spiritual", going: 38 },
  { month: "May", day: "25", title: "Blood donation drive", where: "Downtown Community Hall", tag: "Volunteer", going: 122 },
  { month: "May", day: "28", title: "Founders circle dinner", where: "Online + Toronto", tag: "Network", going: 24 },
];
const drives = [
  { title: "Iftar prep team", where: "Local masjid", slots: 6 },
  { title: "Tutor ECDC kids", where: "Weekly · Sat", slots: 3 },
];
