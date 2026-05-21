import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Send, Users, MapPin, Sparkles, MessageSquare, Heart, Flag } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function CommunityChatPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [comm, setComm] = useState(null);
  const [joined, setJoined] = useState(false);
  const [tab, setTab] = useState("chat"); // chat | feed
  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col" data-testid="community-page">
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

      <CommunityHeader id={id} setComm={setComm} setJoined={setJoined} comm={comm} />

      <div className="mt-3 flex gap-2 px-5">
        <TabBtn active={tab === "chat"} onClick={() => setTab("chat")} icon={MessageSquare} label="Live chat" test="tab-chat" />
        <TabBtn active={tab === "feed"} onClick={() => setTab("feed")} icon={Sparkles} label="Feed" test="tab-feed" />
      </div>

      {tab === "chat" ? (
        <ChatView id={id} joined={joined} setJoined={setJoined} user={user} />
      ) : (
        <FeedView id={id} joined={joined} user={user} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label, test }) {
  return (
    <button
      onClick={onClick}
      data-testid={test}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium tap-scale ${
        active ? "bg-emerald-gradient text-ivory shadow-glow" : "glass text-deep shadow-soft"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function CommunityHeader({ id, setComm, setJoined, comm }) {
  useEffect(() => {
    (async () => {
      try {
        const [a, b] = await Promise.all([api.get("/communities"), api.get("/memberships")]);
        const c = (a.data.communities || []).find((x) => x.community_id === id);
        setComm(c);
        setJoined((b.data.memberships || []).some((m) => m.community_id === id));
      } catch (e) {}
    })();
  }, [id, setComm, setJoined]);

  if (!comm) return null;
  return (
    <div className="px-5 pt-2 text-[11px] text-deep/55 flex items-center gap-2">
      <MapPin className="h-3 w-3" /> {comm.city} · {comm.members} members
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket chat with typing indicators
// ─────────────────────────────────────────────────────────────────────────────
function ChatView({ id, joined, setJoined, user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingNames, setTypingNames] = useState([]); // [{user_id, name, ts}]
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Fetch initial history
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/communities/${id}/messages`);
        setMessages(r.data.messages || []);
      } catch (e) {}
    })();
  }, [id]);

  // Open WebSocket — get a session token first to pass in query string
  useEffect(() => {
    let aborted = false;
    let ws;
    (async () => {
      try {
        const t = await api.get("/auth/token");
        if (aborted) return;
        const wsUrl = BACKEND_URL.replace(/^http/, "ws") + `/api/ws/community/${id}?token=${encodeURIComponent(t.data.token)}`;
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        ws.onerror = () => setConnected(false);
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.type === "message") {
              setMessages((m) => [...m, data]);
            } else if (data.type === "typing") {
              setTypingNames((arr) => {
                const next = arr.filter((x) => x.user_id !== data.user_id);
                next.push({ user_id: data.user_id, name: data.name, ts: Date.now() });
                return next;
              });
            }
          } catch (e) {}
        };
      } catch (e) {}
    })();
    return () => { aborted = true; try { ws?.close(); } catch {} };
  }, [id]);

  // Sweep stale typing indicators every 1s (4s expiry)
  useEffect(() => {
    const t = setInterval(() => {
      setTypingNames((arr) => arr.filter((x) => Date.now() - x.ts < 4000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typingNames]);

  const sendTyping = () => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: "typing" }));
    }
  };

  const onChange = (e) => {
    setText(e.target.value);
    if (!typingTimerRef.current) {
      sendTyping();
      typingTimerRef.current = setTimeout(() => { typingTimerRef.current = null; }, 2500);
    }
  };

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    if (!joined) {
      try { await api.post(`/communities/${id}/join`); setJoined(true); } catch (e) {}
    }
    setText("");
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: "message", text: t }));
    } else {
      // Fallback to REST if socket isn't connected
      try {
        const r = await api.post(`/communities/${id}/messages`, { text: t });
        setMessages((m) => [...m, r.data]);
      } catch (e) {}
    }
  };

  const [noorBusy, setNoorBusy] = useState(false);
  const [noorMsg, setNoorMsg] = useState("");
  const invokeNoor = async () => {
    if (noorBusy) return;
    if (!joined) { try { await api.post(`/communities/${id}/join`); setJoined(true); } catch (e) {} }
    setNoorBusy(true); setNoorMsg("");
    try {
      const r = await api.post(`/communities/${id}/noor-moment`);
      // If WS is connected, the broadcast will arrive — otherwise inject locally
      if (wsRef.current?.readyState !== 1) {
        setMessages((m) => [...m, r.data]);
      }
    } catch (e) {
      setNoorMsg(e?.response?.data?.detail || "Noor couldn't join right now.");
      setTimeout(() => setNoorMsg(""), 4000);
    } finally { setNoorBusy(false); }
  };

  const visibleTyping = typingNames.filter((x) => x.user_id !== user?.user_id);

  return (
    <>
      <p className="px-5 pt-2 text-[10px] text-deep/45">
        Be kind. This is a calm, non-authoritative space — no fatwas, no debates. {connected && <span className="text-emerald-700">· live</span>}
      </p>

      <section className="flex-1 space-y-3 px-5 pb-44 pt-5" data-testid="chat-thread">
        {messages.length === 0 && (
          <div className="glass rounded-2xl p-5 text-center shadow-soft">
            <Sparkles className="mx-auto h-5 w-5 text-deep/55" />
            <p className="mt-2 text-sm text-deep/70">No messages yet — be the first to share a quiet thought.</p>
          </div>
        )}
        {messages.map((m) => <MessageBubble key={m.message_id} m={m} user={user} />)}

        {visibleTyping.length > 0 && (
          <div className="flex items-center gap-2 text-deep/55" data-testid="typing-indicator">
            <div className="bg-gold-gradient h-7 w-7 rounded-full animate-noor-pulse" />
            <span className="glass rounded-2xl px-3 py-2 text-[11px]">
              {visibleTyping[0].name}{visibleTyping.length > 1 ? ` and ${visibleTyping.length - 1} other` : ""} is typing…
            </span>
          </div>
        )}
        <div ref={scrollRef} />
      </section>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 bg-gradient-to-t from-ivory via-ivory/95 to-transparent px-5 pb-6 pt-3">
        {noorMsg && <p data-testid="noor-moment-msg" className="mb-2 px-2 text-center text-[10px] text-deep/60">{noorMsg}</p>}
        <div className="glass shadow-elegant flex items-end gap-2 rounded-3xl p-2">
          <button
            data-testid="noor-moment-btn"
            onClick={invokeNoor}
            disabled={noorBusy}
            className="bg-gold-gradient text-deep shadow-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-full tap-scale disabled:opacity-50"
            aria-label="Invite Noor"
            title="Invite Noor to share a calm reflection (once per minute)"
          >
            <Sparkles className={`h-4 w-4 ${noorBusy ? "animate-pulse" : ""}`} />
          </button>
          <textarea
            data-testid="chat-input"
            value={text}
            onChange={onChange}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder={joined ? "Share a thought…" : "Type to join & send your first message"}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-deep outline-none placeholder:text-deep/40"
          />
          <button
            data-testid="chat-send"
            onClick={send}
            disabled={!text.trim()}
            className="bg-emerald-gradient text-ivory shadow-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

function MessageBubble({ m, user }) {
  const mine = m.user_id === user?.user_id;
  const isNoor = m.kind === "noor_moment" || m.user_id === "noor";
  const [reported, setReported] = useState(false);
  const report = async () => {
    const reason = window.prompt("Briefly, what's wrong? (e.g., spam, harassment, off-topic)") || "";
    if (!reason.trim()) return;
    try { await api.post("/reports", { target_type: "message", target_id: m.message_id, reason }); setReported(true); } catch (e) {}
  };

  if (isNoor) {
    return (
      <div className="flex justify-center" data-testid={`noor-moment-${m.message_id}`}>
        <div className="relative w-full max-w-[92%] overflow-hidden rounded-3xl bg-emerald-gradient p-4 text-ivory shadow-elegant">
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gold/30 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gold">
              <Sparkles className="h-3 w-3" /> Noor Moment{m.invoked_by_name ? ` · invited by ${m.invoked_by_name}` : ""}
            </div>
            <p className="mt-2 font-display text-sm leading-relaxed text-ivory/95">{m.text}</p>
            <p className="mt-2 text-[10px] text-ivory/55">
              {m.created_at ? new Date(m.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : ""} · a calm pause for the circle
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${m.message_id}`}>
      {!mine && (
        <div className="bg-gold-gradient text-deep mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
          {m.author_name?.[0] || "·"}
        </div>
      )}
      <div className={`relative max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-soft ${
        mine ? "bg-emerald-gradient text-ivory rounded-br-md" : "glass text-deep rounded-bl-md"
      }`}>
        {!mine && <p className="mb-0.5 text-[10px] font-medium text-deep/60">{m.author_name}</p>}
        <p className={m.removed ? "italic opacity-60" : ""}>{m.text}</p>
        <p className={`mt-1 text-[10px] ${mine ? "text-ivory/55" : "text-deep/45"}`}>
          {m.created_at ? new Date(m.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : ""}
        </p>
        {!mine && !m.removed && (
          <button
            onClick={report}
            data-testid={`report-${m.message_id}`}
            disabled={reported}
            className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-ivory text-deep/50 shadow-soft group-hover:flex disabled:text-emerald-700"
            aria-label="Report"
          >
            <Flag className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Feed — posts + comments + reactions
// ─────────────────────────────────────────────────────────────────────────────
function FeedView({ id, joined, user }) {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [asOrg, setAsOrg] = useState(false);
  const [orgName, setOrgName] = useState("");

  const load = async () => {
    try { const r = await api.get(`/communities/${id}/posts`); setPosts(r.data.posts || []); } catch (e) {}
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => { (async () => {
    try { const r = await api.get("/orgs/me"); if (r.data.role === "org") setOrgName(r.data.org_profile?.name || ""); }
    catch (_) {}
  })(); }, []);

  const post = async () => {
    const t = text.trim();
    if (!t) return;
    if (!joined) { try { await api.post(`/communities/${id}/join`); } catch (e) {} }
    setBusy(true);
    try {
      const r = await api.post(`/communities/${id}/posts`, { text: t, as_org: asOrg });
      setPosts((p) => [r.data, ...p]);
      setText("");
    } finally { setBusy(false); }
  };

  return (
    <section className="flex-1 space-y-3 px-5 pb-44 pt-5" data-testid="feed-thread">
      <div className="glass rounded-3xl p-4 shadow-soft" data-testid="post-composer">
        <textarea
          data-testid="post-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Share a thought, a verse, a quiet question…"
          className="w-full resize-none rounded-2xl border border-deep/10 bg-white/60 px-3 py-2 text-sm text-deep outline-none focus:border-gold placeholder:text-deep/40"
        />
        <div className="mt-2 flex items-center justify-between">
          {orgName ? (
            <label data-testid="post-as-org" className="flex items-center gap-1.5 text-[11px] text-deep/65">
              <input type="checkbox" checked={asOrg} onChange={(e) => setAsOrg(e.target.checked)} className="accent-gold" />
              Post as <strong className="text-deep">{orgName}</strong>
            </label>
          ) : <span />}
          <button
            data-testid="post-submit"
            onClick={post}
            disabled={busy || !text.trim()}
            className="bg-emerald-gradient text-ivory shadow-elegant rounded-full px-4 py-2 text-xs font-semibold tap-scale disabled:opacity-50"
          >
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      {posts.length === 0 && (
        <div className="glass rounded-2xl p-5 text-center shadow-soft">
          <Sparkles className="mx-auto h-5 w-5 text-deep/55" />
          <p className="mt-2 text-sm text-deep/70">No posts yet — share the first reflection.</p>
        </div>
      )}
      {posts.map((p) => <PostCard key={p.post_id} p={p} user={user} refresh={load} />)}
    </section>
  );
}

function PostCard({ p, user, refresh }) {
  const [liked, setLiked] = useState(p.liked_by_me);
  const [likes, setLikes] = useState(p.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(null);
  const [cText, setCText] = useState("");
  const [reported, setReported] = useState(false);

  const toggleLike = async () => {
    try {
      const r = await api.post(`/posts/${p.post_id}/like`);
      setLiked(r.data.liked); setLikes(r.data.likes);
    } catch (e) {}
  };

  const loadComments = async () => {
    setShowComments(true);
    try { const r = await api.get(`/posts/${p.post_id}/comments`); setComments(r.data.comments || []); } catch (e) {}
  };

  const addComment = async () => {
    const t = cText.trim();
    if (!t) return;
    try {
      const r = await api.post(`/posts/${p.post_id}/comments`, { text: t });
      setComments((c) => [...(c || []), r.data]); setCText("");
    } catch (e) {}
  };

  const report = async () => {
    const reason = window.prompt("Briefly, what's wrong?") || "";
    if (!reason.trim()) return;
    try { await api.post("/reports", { target_type: "post", target_id: p.post_id, reason }); setReported(true); } catch (e) {}
  };

  return (
    <article className="glass rounded-2xl p-4 shadow-soft" data-testid={`post-${p.post_id}`}>
      <div className="flex items-start gap-3">
        <div className="bg-gold-gradient text-deep flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold">
          {p.author_name?.[0] || "·"}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-deep">{p.author_name}</p>
              {p.author_kind === "org" && (
                <span className="bg-emerald-gradient text-gold rounded-full px-1.5 py-0.5 text-[8px] uppercase tracking-wider">Org{p.verified ? " · ✓" : ""}</span>
              )}
            </div>
            <p className="text-[10px] text-deep/45">
              {p.created_at ? new Date(p.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : ""}
            </p>
          </div>
          <p className={`mt-1 text-sm leading-relaxed text-deep/85 ${p.removed ? "italic opacity-60" : ""}`}>{p.text}</p>
          <div className="mt-3 flex items-center gap-4 text-xs text-deep/60">
            <button onClick={toggleLike} data-testid={`like-${p.post_id}`} className="inline-flex items-center gap-1 tap-scale">
              <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current text-rose-600" : ""}`} /> {likes}
            </button>
            <button onClick={loadComments} data-testid={`comments-${p.post_id}`} className="inline-flex items-center gap-1 tap-scale">
              <MessageSquare className="h-3.5 w-3.5" /> {p.comments ?? 0}
            </button>
            {p.user_id !== user?.user_id && (
              <button onClick={report} disabled={reported} data-testid={`report-post-${p.post_id}`} className="ml-auto inline-flex items-center gap-1 text-deep/40 tap-scale disabled:text-emerald-700">
                <Flag className="h-3.5 w-3.5" />{reported ? "Reported" : ""}
              </button>
            )}
          </div>

          {showComments && (
            <div className="mt-4 space-y-2.5 border-t border-deep/10 pt-3" data-testid={`comments-list-${p.post_id}`}>
              {(comments || []).map((c) => (
                <div key={c.comment_id} className="flex gap-2.5">
                  <div className="bg-emerald-gradient text-gold flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                    {c.author_name?.[0] || "·"}
                  </div>
                  <div className="flex-1 rounded-2xl bg-white/60 px-3 py-2">
                    <p className="text-[11px] font-medium text-deep">{c.author_name}</p>
                    <p className={`text-xs text-deep/85 ${c.removed ? "italic opacity-60" : ""}`}>{c.text}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input
                  data-testid={`comment-input-${p.post_id}`}
                  value={cText}
                  onChange={(e) => setCText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComment(); } }}
                  placeholder="Add a kind comment…"
                  className="flex-1 rounded-full border border-deep/10 bg-white/70 px-3 py-1.5 text-xs outline-none focus:border-gold"
                />
                <button onClick={addComment} disabled={!cText.trim()} className="bg-emerald-gradient text-ivory rounded-full px-3 py-1.5 text-[11px] font-semibold tap-scale disabled:opacity-50">
                  Reply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
