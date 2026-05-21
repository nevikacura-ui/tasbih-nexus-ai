import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setStoredToken } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [err, setErr] = useState(null);
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || "";
    const sid = new URLSearchParams(hash.replace(/^#/, "")).get("session_id");
    const pending = sessionStorage.getItem("pending_invite_token") || null;

    (async () => {
      try {
        const r = await api.post("/auth/session", { session_id: sid, pending_token: pending });
        if (r.data.session_token) setStoredToken(r.data.session_token);
        sessionStorage.removeItem("pending_invite_token");
        setUser(r.data.user);
        window.history.replaceState({}, "", window.location.pathname);
        const isNew = !!pending;
        navigate(isNew ? "/onboarding" : "/", { replace: true });
      } catch (e) {
        setErr(e?.response?.data?.detail || "Sign-in could not be completed.");
      }
    })();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col items-center justify-center px-6">
      <div className="h-14 w-14 rounded-full bg-gold-gradient animate-breathe shadow-glow noor-ring" />
      <p className="mt-6 text-sm text-deep/70">Welcoming you in…</p>
      {err && (
        <div data-testid="auth-error" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700">
          {err}
          <button className="mt-2 block text-deep underline" onClick={() => navigate("/login", { replace: true })}>
            Back to sign-in
          </button>
        </div>
      )}
    </div>
  );
}
