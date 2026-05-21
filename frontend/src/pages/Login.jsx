import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ShieldCheck, Key, ArrowRight } from "lucide-react";
import { api, setStoredToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import { NoorBackdrop } from "../components/NoorBackdrop";

// TEMP: invite-only gate is hidden by default; flip this to true to require codes again.
const INVITE_GATE_ENABLED = false;

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, setUser } = useAuth();
  const [step, setStep] = useState(INVITE_GATE_ENABLED ? "invite" : "entry");
  const [code1, setCode1] = useState("");
  const [code2, setCode2] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  const verifyCodes = async (e) => {
    e?.preventDefault?.();
    setErr(null);
    if (!code1.trim() || !code2.trim()) {
      setErr("Please enter both invitation codes.");
      return;
    }
    setBusy(true);
    try {
      const r = await api.post("/invite/verify", { code1, code2 });
      sessionStorage.setItem("pending_invite_token", r.data.pending_token);
      setStep("google");
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Could not verify codes.");
    } finally {
      setBusy(false);
    }
  };

  const startGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href =
      "https://auth.emergentagent.com/?redirect=" + encodeURIComponent(redirectUrl);
  };

  const continueAsGuest = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post("/auth/guest");
      if (r.data.session_token) setStoredToken(r.data.session_token);
      setUser(r.data.user);
      navigate("/", { replace: true });
    } catch (e2) {
      console.error("Guest signin failed", e2);
      setErr(e2?.message || "Could not start guest session.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
      <NoorBackdrop />
      <div className="flex flex-1 flex-col justify-between px-6 py-10">
        <header className="animate-float-up pt-6">
          <img src="/logo-wordmark.png" alt="Tasbih.ai" className="h-16 w-auto select-none" data-testid="brand-logo" />
          <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-deep/55">
            Remember · Reflect · Seek Noor
          </p>
          <p className="mt-5 text-sm leading-relaxed text-deep/65">
            A calm companion for reflection, dhikr and meaningful community.
            Tasbih.ai is an independent platform — not a religious authority.
          </p>
        </header>

        <section className="space-y-3 pb-6">
          {INVITE_GATE_ENABLED && step === "invite" && (
            <form onSubmit={verifyCodes} className="space-y-3" data-testid="invite-form">
              <div className="glass shadow-soft rounded-3xl p-5">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-deep" />
                  <p className="font-display text-base text-deep">Invitation-only</p>
                </div>
                <p className="mt-1 text-xs text-deep/60">
                  Tasbih.ai grows through trust. Enter two invitation codes shared by members of the community.
                </p>
                <input
                  data-testid="invite-code-1"
                  value={code1}
                  onChange={(e) => setCode1(e.target.value.toUpperCase())}
                  placeholder="First invitation code"
                  className="mt-4 w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm tracking-wider outline-none placeholder:text-deep/35 focus:border-gold"
                />
                <input
                  data-testid="invite-code-2"
                  value={code2}
                  onChange={(e) => setCode2(e.target.value.toUpperCase())}
                  placeholder="Second invitation code"
                  className="mt-2.5 w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm tracking-wider outline-none placeholder:text-deep/35 focus:border-gold"
                />
              </div>

              {err && (
                <div data-testid="invite-error" className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
                  {err}
                </div>
              )}

              <button
                data-testid="verify-invite-btn"
                type="submit"
                disabled={busy}
                className="bg-emerald-gradient text-ivory shadow-elegant flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium tap-scale disabled:opacity-60"
              >
                {busy ? "Verifying…" : "Verify invitation codes"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {(step === "google" || (!INVITE_GATE_ENABLED && step === "entry")) && (
            <div className="space-y-3" data-testid="entry-step">
              <div className="glass shadow-soft flex items-start gap-3 rounded-2xl p-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-deep" />
                <p className="text-xs leading-relaxed text-deep/65">
                  Step into a quiet, trust-based space. Sign in with Google to save your reflections,
                  or continue as a guest to explore first.
                </p>
              </div>

              {err && (
                <div data-testid="login-error" className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
                  {err}
                </div>
              )}

              <button
                data-testid="google-signin-btn"
                onClick={startGoogle}
                className="bg-emerald-gradient text-ivory shadow-elegant flex w-full items-center justify-center gap-3 rounded-full py-3.5 text-sm font-medium tap-scale"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <button
                data-testid="skip-login-btn"
                onClick={continueAsGuest}
                disabled={busy}
                className="glass flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium text-deep shadow-soft tap-scale disabled:opacity-60"
              >
                {busy ? "Opening…" : "Skip — continue as guest"}
                <ArrowRight className="h-4 w-4" />
              </button>

              {INVITE_GATE_ENABLED && (
                <button
                  data-testid="back-to-invite"
                  onClick={() => setStep("invite")}
                  className="block w-full text-center text-xs text-deep/55"
                >
                  ← Use different invitation codes
                </button>
              )}
            </div>
          )}

          <p className="pt-2 text-center text-[10px] uppercase tracking-[0.18em] text-deep/40">
            Independent · community-driven · non-authoritative
          </p>
        </section>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.2-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 43.5c5 0 9.6-1.9 13-5l-6-5.1c-2 1.4-4.4 2.2-7 2.2-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39 16.2 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6 5.1c-.4.4 6.7-4.9 6.7-14.5 0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
