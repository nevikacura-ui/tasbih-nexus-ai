import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

/**
 * Polls user's reminders and surfaces a soft glassmorphism toast when a
 * reminder time has just arrived (within the last 60s) and hasn't been
 * shown today already. Pure in-app; no system notifications.
 */
export default function ReminderToaster() {
  const { user } = useAuth();
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (!user) return;
    let stopped = false;

    const tick = async () => {
      try {
        const r = await api.get("/reminders");
        const reminders = (r.data.reminders || []).filter((x) => x.enabled);
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const cur = `${hh}:${mm}`;
        const todayKey = `tasbih_rem_${now.toISOString().slice(0, 10)}`;
        const shown = JSON.parse(sessionStorage.getItem(todayKey) || "{}");
        for (const it of reminders) {
          if (it.time === cur && !shown[it.reminder_id]) {
            shown[it.reminder_id] = Date.now();
            sessionStorage.setItem(todayKey, JSON.stringify(shown));
            setCurrent(it);
            setTimeout(() => setCurrent((c) => (c && c.reminder_id === it.reminder_id ? null : c)), 12000);
            break;
          }
        }
      } catch (e) {}
      if (!stopped) setTimeout(tick, 25000);
    };
    tick();
    return () => { stopped = true; };
  }, [user]);

  if (!current) return null;

  return (
    <div className="fixed left-1/2 top-3 z-[80] w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 animate-float-up" data-testid="reminder-toast">
      <div className="glass shadow-elegant flex items-center gap-3 rounded-3xl p-3 pl-4">
        <div className="bg-gold-gradient flex h-10 w-10 items-center justify-center rounded-full shadow-glow">
          <Bell className="h-4 w-4 text-deep" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">Soft nudge · {current.time}</p>
          <p className="text-sm font-medium text-deep">{current.label}</p>
        </div>
        <Link
          to={current.kind === "journal" ? "/journal" : current.kind === "dhikr" ? "/tasbih" : "/"}
          onClick={() => setCurrent(null)}
          className="rounded-full bg-emerald-gradient px-3 py-1.5 text-[11px] font-semibold text-ivory tap-scale"
        >
          Open
        </Link>
        <button
          onClick={() => setCurrent(null)}
          aria-label="Dismiss"
          className="ml-1 text-deep/55 tap-scale"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
