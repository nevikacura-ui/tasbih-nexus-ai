import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell, Sparkles, GraduationCap, ShieldCheck, Crown, Flag } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const ICONS = {
  mentorship_request: GraduationCap,
  mentorship_accepted: GraduationCap,
  mentorship_declined: GraduationCap,
  mod_action: ShieldCheck,
  report_resolved: Flag,
  khidmah_milestone: Crown,
  default: Sparkles,
};

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    try {
      const r = await api.get("/notifications");
      setItems(r.data.notifications || []);
      setUnread(r.data.unread || 0);
    } catch (e) {}
  };
  useEffect(() => {
    load();
    // Mark read shortly after viewing
    const t = setTimeout(async () => {
      try { await api.post("/notifications/mark-read"); setUnread(0); } catch (e) {}
    }, 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[480px]" data-testid="notifications-page">
      <NoorBackdrop />
      <header className="flex items-center gap-3 px-5 pt-9">
        <Link to="/profile" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
          <ArrowLeft className="h-4 w-4 text-deep" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Quiet history</p>
          <h1 className="font-display text-2xl text-deep">Notifications</h1>
        </div>
        {unread > 0 && (
          <span className="ml-auto rounded-full bg-emerald-gradient px-2 py-0.5 text-[10px] font-semibold text-ivory" data-testid="unread-badge">
            {unread}
          </span>
        )}
      </header>

      <section className="mt-5 space-y-2.5 px-5 pb-10">
        {items.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-center shadow-soft">
            <Bell className="mx-auto h-5 w-5 text-deep/60" />
            <p className="mt-2 text-sm text-deep/70">A quiet inbox. We'll let you know softly when something arrives.</p>
          </div>
        ) : items.map((n) => {
          const Icon = ICONS[n.kind] || ICONS.default;
          const Wrapper = n.link ? Link : "div";
          const props = n.link ? { to: n.link } : {};
          return (
            <Wrapper key={n.notification_id} {...props} className={`glass flex items-start gap-3 rounded-2xl p-4 shadow-soft ${n.link ? "tap-scale" : ""}`} data-testid={`notification-${n.notification_id}`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${n.read ? "bg-sand" : "bg-gold-gradient shadow-glow"}`}>
                <Icon className="h-4 w-4 text-deep" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-deep">{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs leading-relaxed text-deep/70">{n.body}</p>}
                <p className="mt-1 text-[10px] uppercase tracking-wider text-deep/45">
                  {new Date(n.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            </Wrapper>
          );
        })}
      </section>
    </div>
  );
}
