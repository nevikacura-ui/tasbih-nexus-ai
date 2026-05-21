import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ChevronLeft as Prev, Calendar as CalIcon, Moon, Sparkles, Heart, Star } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const KIND_META = {
  imamat: { color: "bg-gold-gradient text-deep", icon: Star, label: "Imamat" },
  festival: { color: "bg-emerald-gradient text-gold", icon: Sparkles, label: "Festival" },
  remembrance: { color: "bg-deep text-gold", icon: Heart, label: "Remembrance" },
  fasting: { color: "bg-emerald-gradient text-gold", icon: Moon, label: "Fasting" },
  chandraat: { color: "bg-sand text-deep", icon: Moon, label: "Chandraat" },
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState(null);
  const [todayInfo, setTodayInfo] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => { (async () => {
    try { const r = await api.get("/calendar/today"); setTodayInfo(r.data); } catch (_) {}
  })(); }, []);

  useEffect(() => { (async () => {
    setData(null);
    try { const r = await api.get("/calendar/month", { params: { year, month } }); setData(r.data); } catch (_) {}
  })(); }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map = {};
    (data?.events || []).forEach((e) => {
      (map[e.date] = map[e.date] || []).push(e);
    });
    return map;
  }, [data]);

  const goto = (delta) => {
    let nm = month + delta;
    let ny = year;
    if (nm < 1) { nm = 12; ny -= 1; }
    if (nm > 12) { nm = 1; ny += 1; }
    setYear(ny); setMonth(nm); setSelectedDate(null);
  };

  // Build the visible 6-row grid (starting from Sunday)
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);
  const startDow = firstOfMonth.getDay(); // 0 = Sun
  const totalDays = lastOfMonth.getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isoFor = (d) => `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  return (
    <MobileShell>
      <div className="relative" data-testid="calendar-page">
        <NoorBackdrop />

        <header className="flex items-center gap-3 px-5 pt-9">
          <Link to="/" data-testid="cal-back" className="glass flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
            <ChevronLeft className="h-4 w-4 text-deep" />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Ismaili</p>
            <h1 className="font-display text-2xl text-deep">Calendar</h1>
          </div>
        </header>

        {todayInfo?.hijri && (
          <section className="mt-4 px-5">
            <div className="glass rounded-2xl p-4 shadow-soft" data-testid="cal-today-hijri">
              <p className="text-[10px] uppercase tracking-[0.22em] text-gold">Today</p>
              <p className="mt-1 text-sm text-deep">
                <strong className="font-display text-base text-deep">{todayInfo.hijri.day} {todayInfo.hijri.month_name} {todayInfo.hijri.year} AH</strong> · {todayInfo.hijri.day_name}
              </p>
              {todayInfo.upcoming?.length > 0 && (
                <p className="mt-1 text-[11px] text-deep/60">Next up: <strong className="text-deep">{todayInfo.upcoming[0].title}</strong> on {todayInfo.upcoming[0].date}</p>
              )}
            </div>
          </section>
        )}

        <section className="mt-4 px-5">
          <div className="glass flex items-center justify-between rounded-2xl p-3 shadow-soft">
            <button onClick={() => goto(-1)} data-testid="cal-prev" className="tap-scale rounded-full p-2"><Prev className="h-4 w-4 text-deep" /></button>
            <div className="text-center">
              <p className="font-display text-lg text-deep">{MONTH_NAMES[month - 1]} {year}</p>
              {data?.hijri_first && (
                <p className="text-[10px] text-deep/55">
                  {data.hijri_first.month_name} {data.hijri_first.year}{data.hijri_last && data.hijri_last.month !== data.hijri_first.month ? ` – ${data.hijri_last.month_name} ${data.hijri_last.year}` : ""} AH
                </p>
              )}
            </div>
            <button onClick={() => goto(1)} data-testid="cal-next" className="tap-scale rounded-full p-2"><ChevronRight className="h-4 w-4 text-deep" /></button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-deep/45">
            {["S","M","T","W","T","F","S"].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} className="h-12" />;
              const iso = isoFor(d);
              const evs = eventsByDate[iso] || [];
              const isToday = iso === todayIso;
              const isSelected = iso === selectedDate;
              const hasEvent = evs.length > 0;
              const dot = evs[0] ? KIND_META[evs[0].kind] : null;
              return (
                <button
                  key={i}
                  data-testid={`cal-day-${d}`}
                  onClick={() => setSelectedDate(iso)}
                  className={`relative flex h-12 flex-col items-center justify-center rounded-xl text-xs tap-scale transition ${
                    isSelected ? "bg-emerald-gradient text-ivory shadow-glow" :
                    isToday ? "bg-gold-gradient text-deep shadow-soft" :
                    hasEvent ? "glass text-deep shadow-soft" : "text-deep/65"
                  }`}
                >
                  <span className="font-display text-sm">{d}</span>
                  {hasEvent && (
                    <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-gold" : (dot?.color?.includes("emerald") ? "bg-emerald-700" : "bg-gold")}`} />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {selectedDate && selectedEvents.length > 0 && (
          <section className="mt-5 space-y-3 px-5 pb-3" data-testid="cal-selected-events">
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">{selectedDate}</p>
            {selectedEvents.map((e) => <EventCard key={e.id + e.date} e={e} />)}
          </section>
        )}

        <section className="mt-6 px-5 pb-10">
          <h2 className="mb-3 font-display text-base text-deep">All events this month</h2>
          {(!data || data.events.length === 0) && (
            <p className="glass rounded-2xl p-4 text-center text-xs text-deep/55 shadow-soft">
              A quiet month on the calendar. Use it for gentle reflection.
            </p>
          )}
          <div className="space-y-2.5">
            {(data?.events || []).map((e) => <EventCard key={e.id + e.date} e={e} />)}
          </div>
          <p className="mt-5 px-2 text-[10px] leading-relaxed text-deep/45 text-center">
            Tasbih.ai's calendar is a reflective companion — not an institutional calendar. Hijri dates are calculated and may differ by a day from local moon-sighting in your jamat.
          </p>
        </section>
      </div>
    </MobileShell>
  );
}

function EventCard({ e }) {
  const meta = KIND_META[e.kind] || KIND_META.festival;
  const Icon = meta.icon;
  return (
    <article className="glass rounded-2xl p-4 shadow-soft" data-testid={`cal-event-${e.id}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${meta.color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-deep">{e.title}</p>
            <p className="text-[10px] text-deep/55">{e.date}</p>
          </div>
          {e.subtitle && <p className="text-[11px] text-deep/60">{e.subtitle}</p>}
          {e.hijri && (
            <p className="mt-0.5 text-[10px] text-deep/45">{e.hijri.day} {e.hijri.month_name} {e.hijri.year} AH</p>
          )}
          {e.reflection && <p className="mt-2 text-xs leading-relaxed text-deep/70">{e.reflection}</p>}
          <Link to="/noor" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-gold tap-scale">
            <Sparkles className="h-3 w-3" /> Reflect with Noor
          </Link>
        </div>
      </div>
    </article>
  );
}
