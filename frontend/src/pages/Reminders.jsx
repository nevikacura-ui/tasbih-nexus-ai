import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Trash2, Plus, Sun } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const KINDS = [
  { id: "prayer", label: "Prayer" },
  { id: "dhikr", label: "Dhikr" },
  { id: "journal", label: "Journal" },
  { id: "custom", label: "Custom" },
];

export default function RemindersPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("08:00");
  const [kind, setKind] = useState("prayer");

  const load = async () => {
    try { const r = await api.get("/reminders"); setItems(r.data.reminders || []); } catch (e) {}
  };
  useEffect(() => { load(); }, []);

  const toggle = async (it) => {
    await api.patch(`/reminders/${it.reminder_id}`, { ...it, enabled: !it.enabled });
    load();
  };

  const remove = async (it) => {
    await api.delete(`/reminders/${it.reminder_id}`);
    load();
  };

  const save = async () => {
    if (!label.trim()) return;
    await api.post("/reminders", { label: label.trim(), time, kind, enabled: true });
    setOpen(false); setLabel(""); setTime("08:00"); setKind("prayer");
    load();
  };

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[480px]" data-testid="reminders-page">
      <NoorBackdrop />
      <header className="flex items-center justify-between px-5 pt-9">
        <div className="flex items-center gap-3">
          <Link to="/profile" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
            <ArrowLeft className="h-4 w-4 text-deep" />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Soft nudges</p>
            <h1 className="font-display text-2xl text-deep">Reminders</h1>
          </div>
        </div>
        <button
          data-testid="add-reminder"
          onClick={() => setOpen(true)}
          className="bg-emerald-gradient text-ivory shadow-glow flex h-10 w-10 items-center justify-center rounded-full tap-scale"
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      <p className="px-5 pt-3 text-[10px] text-deep/45">
        Gentle in-app nudges only — never push notifications. They appear softly while the app is open.
      </p>

      <section className="mt-5 space-y-2 px-5 pb-10">
        {items.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center shadow-soft">
            <Bell className="mx-auto h-5 w-5 text-deep/55" />
            <p className="mt-2 text-sm text-deep/70">No reminders yet.</p>
          </div>
        )}
        {items.map((it) => (
          <div key={it.reminder_id} className="glass flex items-center gap-3 rounded-2xl p-4 shadow-soft" data-testid={`reminder-${it.reminder_id}`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${it.enabled ? "bg-emerald-gradient" : "bg-sand"}`}>
              {it.enabled ? <Bell className="h-4 w-4 text-gold" /> : <BellOff className="h-4 w-4 text-deep/60" />}
            </div>
            <div className="flex-1">
              <p className="font-display text-base text-deep">{it.label}</p>
              <p className="text-[11px] text-deep/55">{it.time} · {it.kind}</p>
            </div>
            <button onClick={() => toggle(it)} className="rounded-full bg-sand px-3 py-1 text-[10px] font-medium text-deep tap-scale">
              {it.enabled ? "On" : "Off"}
            </button>
            <button onClick={() => remove(it)} aria-label="Delete" className="text-deep/40 tap-scale">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </section>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-deep/30 backdrop-blur-sm" data-testid="reminder-modal">
          <div className="glass w-full max-w-[480px] rounded-t-[28px] p-5 shadow-elegant">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-deep/15" />
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">New reminder</p>
            <input
              data-testid="rem-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Maghrib, Evening journal)"
              className="mt-3 w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm outline-none focus:border-gold"
            />
            <div className="mt-3 flex items-center gap-3">
              <Sun className="h-4 w-4 text-deep/60" />
              <input
                data-testid="rem-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="flex-1 rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm outline-none focus:border-gold"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setKind(k.id)}
                  data-testid={`rem-kind-${k.id}`}
                  className={`rounded-full px-3 py-1.5 text-[11px] tap-scale ${kind === k.id ? "bg-emerald-gradient text-ivory" : "bg-sand text-deep"}`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-full bg-sand py-3 text-sm font-medium text-deep tap-scale">Cancel</button>
              <button onClick={save} data-testid="rem-save" disabled={!label.trim()} className="bg-emerald-gradient text-ivory shadow-elegant flex-1 rounded-full py-3 text-sm font-medium tap-scale disabled:opacity-50">
                Save reminder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
