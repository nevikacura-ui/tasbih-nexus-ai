import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Send, Users, MapPin, Sparkles } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function CommunityChatPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [comm, setComm] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const lastTs = useRef(null);
  const scrollRef = useRef(null);

  const loadAll = async () => {
    try {
      const [c, ms, mems] = await Promise.all([
        api.get("/communities").then((r) => (r.data.communities || []).find((x) => x.community_id === id)),
        api.get(`/communities/${id}/messages`),
        api.get("/memberships"),
      ]);
      setComm(c);
      const msgs = ms.data.messages || [];
      setMessages(msgs);
      lastTs.current = msgs.length ? msgs[msgs.length - 1].created_at : new Date(0).toISOString();
      setJoined((mems.data.memberships || []).some((m) => m.community_id === id));
    } catch (e) {}
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [id]);

  // Poll for new messages every 4s
  useEffect(() => {
    const t = setInterval(async () => {
      if (!lastTs.current) return;
      try {
        const r = await api.get(`/communities/${id}/messages`, { params: { since: lastTs.current } });
        const fresh = r.data.messages || [];
        if (fresh.length) {
          setMessages((m) => [...m, ...fresh]);
          lastTs.current = fresh[fresh.length - 1].created_at;
        }
      } catch (e) {}
    }, 4000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const join = async () => {
    try { await api.post(`/communities/${id}/join`); setJoined(true); } catch (e) {}
  };

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    if (!joined) { await join(); }
    setBusy(true);
    setText("");
    // Optimistic
    const optimistic = {
      message_id: `o_${Date.now()}`,
      community_id: id,
      user_id: user?.user_id,
      author_name: user?.name || "You",
      text: t,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const r = await api.post(`/communities/${id}/messages`, { text: t });
      lastTs.current = r.data.created_at;
      setMessages((m) => m.map((x) => x.message_id === optimistic.message_id ? r.data : x));
    } catch (e) {
      setMessages((m) => m.filter((x) => x.message_id !== optimistic.message_id));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col" data-testid="community-chat-page">
      <NoorBackdrop />

      <header className="flex items-center gap-3 px-5 pt-9">
        <Link to="/circles" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
          <ArrowLeft className="h-4 w-4 text-deep" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Circle</p>
          <h1 className="font-display text-xl text-deep">{comm?.name || "Loading…"}</h1>
        </div>
        <span className="bg-emerald-gradient flex h-9 w-9 items-center justify-center rounded-full">
          <Users className="h-4 w-4 text-gold" />
        </span>
      </header>

      {comm && (
        <div className="px-5 pt-2 text-[11px] text-deep/55 flex items-center gap-2">
          <MapPin className="h-3 w-3" /> {comm.city} · {comm.members} members
        </div>
      )}

      <p className="px-5 pt-2 text-[10px] text-deep/45">
        Be kind. This is a calm, non-authoritative space — no fatwas, no debates.
      </p>

      <section className="flex-1 space-y-3 px-5 pb-44 pt-5" data-testid="chat-thread">
        {messages.length === 0 && (
          <div className="glass rounded-2xl p-5 text-center shadow-soft">
            <Sparkles className="mx-auto h-5 w-5 text-deep/55" />
            <p className="mt-2 text-sm text-deep/70">No messages yet — be the first to share a quiet thought.</p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.user_id === user?.user_id;
          return (
            <div key={m.message_id} className={`flex ${mine ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${m.message_id}`}>
              {!mine && (
                <div className="bg-gold-gradient text-deep mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                  {m.author_name?.[0] || "·"}
                </div>
              )}
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-soft ${
                mine ? "bg-emerald-gradient text-ivory rounded-br-md" : "glass text-deep rounded-bl-md"
              } ${m._optimistic ? "opacity-70" : ""}`}>
                {!mine && <p className="mb-0.5 text-[10px] font-medium text-deep/60">{m.author_name}</p>}
                <p>{m.text}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-ivory/55" : "text-deep/45"}`}>
                  {new Date(m.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </section>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 bg-gradient-to-t from-ivory via-ivory/95 to-transparent px-5 pb-6 pt-3">
        <div className="glass shadow-elegant flex items-end gap-2 rounded-3xl p-2">
          <textarea
            data-testid="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder={joined ? "Share a thought…" : "Type to join & send your first message"}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-deep outline-none placeholder:text-deep/40"
          />
          <button
            data-testid="chat-send"
            onClick={send}
            disabled={busy || !text.trim()}
            className="bg-emerald-gradient text-ivory shadow-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
