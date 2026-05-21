import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, MapPin, Sparkles, Send, Check, Hourglass, X } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const SKILLS = ["all", "medicine", "startup", "design", "education", "career", "product"];

export default function MentorsPage() {
  const { user } = useAuth();
  const [mentors, setMentors] = useState([]);
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("all");
  const [open, setOpen] = useState(null);
  const [requests, setRequests] = useState({ sent: [], received: [] });
  const [tab, setTab] = useState("browse"); // browse | requests

  const load = async () => {
    try {
      const params = skill !== "all" ? { skill } : {};
      const [a, b] = await Promise.all([
        api.get("/mentors", { params }),
        api.get("/mentorship/requests"),
      ]);
      setMentors(a.data.mentors || []);
      setRequests(b.data);
    } catch (e) {}
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [skill]);

  const filtered = mentors.filter((m) =>
    !q || (m.name + " " + m.headline + " " + (m.bio || "")).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <MobileShell>
      <div className="relative" data-testid="mentors-page">
        <NoorBackdrop />
        <header className="flex items-center gap-3 px-5 pt-9">
          <Link to="/profile" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
            <ArrowLeft className="h-4 w-4 text-deep" />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Grow together</p>
            <h1 className="font-display text-2xl text-deep">Mentorship</h1>
          </div>
        </header>

        <div className="mt-4 flex gap-2 px-5">
          <TabBtn active={tab === "browse"} onClick={() => setTab("browse")} label="Browse mentors" test="mtab-browse" />
          <TabBtn active={tab === "requests"} onClick={() => setTab("requests")} label={`Requests (${requests.sent.length + requests.received.length})`} test="mtab-requests" />
        </div>

        {tab === "browse" ? (
          <>
            <div className="mt-4 px-5">
              <div className="glass flex items-center gap-2 rounded-full px-4 py-2.5 shadow-soft">
                <Search className="h-4 w-4 text-deep/55" />
                <input
                  data-testid="mentor-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name, skill, story"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-deep/45"
                />
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {SKILLS.map((s) => (
                  <button
                    key={s}
                    data-testid={`skill-${s}`}
                    onClick={() => setSkill(s)}
                    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium tap-scale ${
                      skill === s ? "bg-emerald-gradient text-ivory" : "bg-sand text-deep"
                    }`}
                  >
                    {s[0].toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <section className="mt-5 space-y-3 px-5 pb-10">
              {filtered.length === 0 && <p className="text-center text-xs text-deep/55">No mentors match.</p>}
              {filtered.map((m) => (
                <article
                  key={m.user_id}
                  data-testid={`mentor-${m.user_id}`}
                  onClick={() => setOpen(m)}
                  className="glass tap-scale cursor-pointer rounded-2xl p-4 shadow-soft"
                >
                  <div className="flex items-start gap-3">
                    <div className="bg-gold-gradient noor-ring text-deep flex h-12 w-12 items-center justify-center rounded-2xl font-display text-base">
                      {(m.name || "?")[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-deep">{m.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-deep/55">
                        <MapPin className="h-3 w-3" /> {m.city || "Global"} · {m.open_slots} spot{m.open_slots === 1 ? "" : "s"}
                      </p>
                      <p className="mt-1.5 text-sm font-display text-deep">{m.headline}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(m.skills || []).map((s) => (
                          <span key={s} className="rounded-full bg-sand px-2 py-0.5 text-[10px] text-deep">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </>
        ) : (
          <RequestsView requests={requests} refresh={load} user={user} />
        )}

        {open && <MentorModal mentor={open} onClose={() => setOpen(null)} onSent={() => { setOpen(null); load(); }} />}
      </div>
    </MobileShell>
  );
}

function TabBtn({ active, onClick, label, test }) {
  return (
    <button
      onClick={onClick}
      data-testid={test}
      className={`flex-1 rounded-full px-3 py-2 text-xs font-medium tap-scale ${
        active ? "bg-emerald-gradient text-ivory shadow-glow" : "glass text-deep shadow-soft"
      }`}
    >
      {label}
    </button>
  );
}

function MentorModal({ mentor, onClose, onSent }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!note.trim()) { setErr("Add a short note — share why you'd love to connect."); return; }
    setBusy(true); setErr(null);
    try {
      await api.post("/mentorship/request", { mentor_id: mentor.user_id, note });
      setSent(true);
      setTimeout(onSent, 900);
    } catch (e) { setErr(e?.response?.data?.detail || "Could not send."); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-deep/30 backdrop-blur-sm" data-testid="mentor-modal" onClick={onClose}>
      <div className="glass w-full max-w-[480px] rounded-t-[28px] p-5 shadow-elegant" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-deep/15" />
        <div className="flex items-center gap-3">
          <div className="bg-gold-gradient noor-ring text-deep flex h-14 w-14 items-center justify-center rounded-2xl font-display text-lg">
            {(mentor.name || "?")[0]}
          </div>
          <div>
            <p className="font-display text-lg text-deep">{mentor.name}</p>
            <p className="text-xs text-deep/55">{mentor.headline}</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-deep/85">{mentor.bio}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(mentor.skills || []).map((s) => (
            <span key={s} className="rounded-full bg-sand px-2 py-0.5 text-[10px] text-deep">{s}</span>
          ))}
        </div>
        {!sent ? (
          <>
            <textarea
              data-testid="mentor-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="A few sentences — where are you now, what would you love guidance on?"
              className="mt-4 w-full resize-none rounded-2xl border border-deep/10 bg-white/60 px-3 py-2 text-sm text-deep outline-none focus:border-gold placeholder:text-deep/40"
            />
            {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
            <div className="mt-3 flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-full bg-sand py-3 text-sm font-medium text-deep tap-scale">Close</button>
              <button
                onClick={send}
                data-testid="send-mentor-request"
                disabled={busy}
                className="bg-emerald-gradient text-ivory shadow-elegant flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-medium tap-scale disabled:opacity-50"
              >
                {busy ? "Sending…" : <>Send request <Send className="h-3.5 w-3.5" /></>}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-2xl bg-emerald-gradient p-4 text-center text-ivory">
            <Check className="mx-auto h-5 w-5 text-gold" />
            <p className="mt-2 font-display text-base">Sent with care</p>
            <p className="text-xs text-ivory/80">You'll hear back here when the mentor responds.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestsView({ requests, refresh, user }) {
  const respond = async (r, action) => {
    try { await api.patch(`/mentorship/requests/${r.request_id}?action=${action}`); await refresh(); } catch (e) {}
  };
  return (
    <section className="mt-5 space-y-5 px-5 pb-10">
      <div>
        <h2 className="mb-2 font-display text-base text-deep">You sent</h2>
        {requests.sent.length === 0 ? (
          <p className="text-xs text-deep/55">No requests yet. Find a mentor whose story resonates.</p>
        ) : (
          <div className="space-y-2">
            {requests.sent.map((r) => (
              <div key={r.request_id} className="glass rounded-2xl p-4 shadow-soft" data-testid={`req-sent-${r.request_id}`}>
                <p className="text-sm font-medium text-deep">To: {r.mentor_name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-deep/70">"{r.note}"</p>
                <p className="mt-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-deep/55">
                  <StatusIcon s={r.status} /> {r.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h2 className="mb-2 font-display text-base text-deep">Sent to you</h2>
        {requests.received.length === 0 ? (
          <p className="text-xs text-deep/55">No incoming requests. (Become a mentor in your profile to start receiving.)</p>
        ) : (
          <div className="space-y-2">
            {requests.received.map((r) => (
              <div key={r.request_id} className="glass rounded-2xl p-4 shadow-soft" data-testid={`req-recv-${r.request_id}`}>
                <p className="text-sm font-medium text-deep">From: {r.mentee_name}</p>
                <p className="mt-1 text-xs text-deep/70">"{r.note}"</p>
                {r.status === "pending" ? (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => respond(r, "decline")} className="flex-1 rounded-full bg-sand py-2 text-xs font-medium text-deep tap-scale">Decline kindly</button>
                    <button onClick={() => respond(r, "accept")} className="bg-emerald-gradient text-ivory flex-1 rounded-full py-2 text-xs font-medium tap-scale">Accept</button>
                  </div>
                ) : (
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-deep/55">
                    <StatusIcon s={r.status} /> {r.status}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StatusIcon({ s }) {
  if (s === "accepted") return <Check className="h-3 w-3 text-emerald-700" />;
  if (s === "declined") return <X className="h-3 w-3 text-red-600" />;
  return <Hourglass className="h-3 w-3 text-deep/55" />;
}
