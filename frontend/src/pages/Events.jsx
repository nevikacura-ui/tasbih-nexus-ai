import React, { useEffect, useState } from "react";
import { Calendar, MapPin, Clock } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const load = async () => { try { const r = await api.get("/events"); setEvents(r.data.events || []); } catch (e) {} };
  useEffect(() => { load(); }, []);

  const rsvp = async (id) => { try { await api.post(`/events/${id}/rsvp`); alert("RSVP confirmed — see you there."); } catch (e) {} };

  const featured = events.find((e) => e.featured) || events[0];
  const rest = events.filter((e) => !featured || e.event_id !== featured.event_id);

  const fmtDay = (iso) => {
    const d = new Date(iso); return { m: d.toLocaleString(undefined, { month: "short" }).toUpperCase(), day: d.getDate(),
      long: d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric" }) };
  };

  return (
    <MobileShell>
      <div className="relative" data-testid="events-page">
        <NoorBackdrop />
        <header className="px-5 pt-9">
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Gather</p>
          <h1 className="mt-1 font-display text-2xl text-deep">Events</h1>
        </header>

        {featured && (
          <section className="mt-6 px-5">
            <div className="bg-emerald-gradient noor-ring text-ivory shadow-elegant relative overflow-hidden rounded-3xl p-6" data-testid={`featured-event-${featured.event_id}`}>
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/30 blur-3xl" />
              <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Featured</p>
              <h2 className="mt-2 font-display text-2xl leading-tight">{featured.title}</h2>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ivory/80">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmtDay(featured.date).long}</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {featured.time}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {featured.where}</span>
              </div>
              <button
                onClick={() => rsvp(featured.event_id)}
                data-testid={`rsvp-${featured.event_id}`}
                className="bg-gold-gradient text-deep mt-5 rounded-full px-5 py-2 text-xs font-semibold tap-scale"
              >
                RSVP
              </button>
            </div>
          </section>
        )}

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-base text-deep">Coming up</h2>
          <div className="space-y-3">
            {rest.map((e) => {
              const d = fmtDay(e.date);
              return (
                <article key={e.event_id} className="glass flex gap-4 rounded-2xl p-4 shadow-soft" data-testid={`event-${e.event_id}`}>
                  <div className="bg-sand text-deep flex h-14 w-14 flex-col items-center justify-center rounded-2xl">
                    <span className="text-[10px] uppercase tracking-wider">{d.m}</span>
                    <span className="font-display text-lg leading-none">{d.day}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-deep">{e.title}</p>
                    <p className="mt-0.5 text-xs text-deep/55">{e.where} · {e.time}</p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-deep/75">
                      <span>{e.tag}</span>
                      <span className="text-deep/50">· {e.going} going</span>
                    </div>
                  </div>
                  <button
                    onClick={() => rsvp(e.event_id)}
                    data-testid={`rsvp-${e.event_id}`}
                    className="self-start rounded-full bg-emerald-gradient px-3 py-1.5 text-[11px] font-semibold text-ivory tap-scale"
                  >
                    RSVP
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-7 px-5 pb-4">
          <h2 className="mb-3 font-display text-base text-deep">Volunteer drives</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { title: "Iftar prep team", where: "Local Jamatkhana", slots: 6 },
              { title: "Tutor ECDC kids", where: "Weekly · Sat", slots: 3 },
            ].map((d) => (
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
