import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ShieldCheck, Key, ArrowRight, Mail, Phone, MessageCircle, KeyRound } from "lucide-react";
import { api, setStoredToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import { NoorBackdrop } from "../components/NoorBackdrop";

// Invite-only gate ON: requires 2 codes from 2 DIFFERENT inviters
// (founder codes are exempt from the same-issuer check).
const INVITE_GATE_ENABLED = true;

const COUNTRY_CODES = [
  { code: "+1", label: "🇨🇦/🇺🇸 +1" },
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+92", label: "🇵🇰 +92" },
  { code: "+254", label: "🇰🇪 +254" },
  { code: "+255", label: "🇹🇿 +255" },
  { code: "+33", label: "🇫🇷 +33" },
  { code: "+351", label: "🇵🇹 +351" },
  { code: "+49", label: "🇩🇪 +49" },
  { code: "+61", label: "🇦🇺 +61" },
  { code: "+65", label: "🇸🇬 +65" },
  { code: "+992", label: "🇹🇯 +992" },
  { code: "+93", label: "🇦🇫 +93" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, setUser } = useAuth();
  // Pre-fill codes from email deep-link: /login?c1=ABC&c2=DEF
  const initialCodes = (() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      return { c1: (sp.get("c1") || "").toUpperCase().slice(0, 12), c2: (sp.get("c2") || "").toUpperCase().slice(0, 12) };
    } catch { return { c1: "", c2: "" }; }
  })();
  // steps: invite → register → otp → google (legacy)
  const [step, setStep] = useState(INVITE_GATE_ENABLED ? "invite" : "register");
  const [code1, setCode1] = useState(initialCodes.c1);
  const [code2, setCode2] = useState(initialCodes.c2);
  const [pendingToken, setPendingToken] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("+91");
  const [phone, setPhone] = useState(""); // NEVER pre-filled
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);
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
      const r = await api.post("/invite/verify", {
        code1: code1.trim().toUpperCase(),
        code2: code2.trim().toUpperCase(),
      });
      setPendingToken(r.data.pending_token);
      sessionStorage.setItem("pending_invite_token", r.data.pending_token);
      setStep("register");
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Could not verify codes.");
    } finally { setBusy(false); }
  };

  const sendOtp = async (e) => {
    e?.preventDefault?.();
    setErr(null); setInfo(null);
    const e164 = `${country}${(phone || "").replace(/\D/g, "")}`;
    if (!email.includes("@")) { setErr("Please enter a valid email."); return; }
    if (e164.replace(/\D/g, "").length < 8) { setErr("Please enter a valid phone number."); return; }
    setBusy(true);
    try {
      await api.post("/auth/otp/send", { pending_token: pendingToken || sessionStorage.getItem("pending_invite_token"), email, phone: e164 });
      setInfo("A 6-digit code was sent via WhatsApp. Check your messages.");
      setStep("otp");
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Could not send the code.");
    } finally { setBusy(false); }
  };

  const verifyOtp = async (e) => {
    e?.preventDefault?.();
    setErr(null);
    const e164 = `${country}${(phone || "").replace(/\D/g, "")}`;
    if ((otp || "").trim().length < 4) { setErr("Please enter the code from WhatsApp."); return; }
    setBusy(true);
    try {
      const r = await api.post("/auth/otp/verify", {
        pending_token: pendingToken || sessionStorage.getItem("pending_invite_token"),
        email, phone: e164, otp: otp.trim(), name: name.trim() || undefined,
      });
      if (r.data.session_token) setStoredToken(r.data.session_token);
      setUser(r.data.user);
      sessionStorage.removeItem("pending_invite_token");
      navigate("/", { replace: true });
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "That code didn't work. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col" data-testid="login-page">
      <NoorBackdrop />
      <div className="flex flex-1 flex-col justify-between px-6 py-8">
        <header className="animate-float-up pt-4 text-center">
          <img src="/logo-wordmark.png" alt="Tasbih.ai" className="mx-auto h-32 w-auto select-none" data-testid="brand-logo" />
          <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-deep/55">
            Yā ʿAlī Madad
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-deep/45">
            Remember · Reflect · Seek Noor
          </p>
          <p className="mx-auto mt-5 max-w-[320px] text-sm leading-relaxed text-deep/65">
            A calm companion for reflection, dhikr and meaningful community.
            Tasbih.ai is an independent platform — not a religious authority.
          </p>
        </header>

        <section className="space-y-3 pb-6">
          {step === "invite" && (
            <form onSubmit={verifyCodes} className="space-y-3" data-testid="invite-form">
              <div className="glass shadow-soft rounded-3xl p-5">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-deep" />
                  <p className="font-display text-base text-deep">Invitation-only</p>
                </div>
                <p className="mt-1 text-xs text-deep/60">
                  Tasbih.ai grows through trust. Enter two invitation codes from
                  <strong> two different members</strong> of the community.
                </p>
                <input
                  data-testid="invite-code-1"
                  value={code1}
                  onChange={(e) => setCode1(e.target.value.toUpperCase())}
                  placeholder="First invitation code"
                  maxLength={12}
                  className="mt-4 w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm tracking-[0.18em] outline-none placeholder:text-deep/35 focus:border-gold"
                />
                <input
                  data-testid="invite-code-2"
                  value={code2}
                  onChange={(e) => setCode2(e.target.value.toUpperCase())}
                  placeholder="Second invitation code"
                  maxLength={12}
                  className="mt-2.5 w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm tracking-[0.18em] outline-none placeholder:text-deep/35 focus:border-gold"
                />
              </div>

              {err && <ErrorBox testid="invite-error">{err}</ErrorBox>}

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

          {step === "register" && (
            <form onSubmit={sendOtp} className="space-y-3" data-testid="register-form">
              <div className="glass shadow-soft rounded-3xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-deep" />
                  <p className="font-display text-base text-deep">Almost there</p>
                </div>
                <p className="text-xs text-deep/60">
                  Codes verified. Register with your email and WhatsApp number — we'll send a one-time code.
                </p>

                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-deep/45">Your name</span>
                  <input
                    data-testid="reg-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="How should we greet you?"
                    className="mt-1 w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm outline-none focus:border-gold"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-deep/45 flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </span>
                  <input
                    data-testid="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="mt-1 w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm outline-none focus:border-gold"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-deep/45 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> WhatsApp number
                  </span>
                  <div className="mt-1 flex gap-2">
                    <select
                      data-testid="reg-country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-28 rounded-2xl border border-deep/10 bg-white/60 px-3 py-3 text-sm outline-none focus:border-gold"
                    >
                      {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                    <input
                      data-testid="reg-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                      placeholder=""
                      inputMode="tel"
                      autoComplete="off"
                      className="flex-1 rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-sm outline-none focus:border-gold"
                    />
                  </div>
                </label>
              </div>

              {err && <ErrorBox testid="reg-error">{err}</ErrorBox>}
              {info && <InfoBox>{info}</InfoBox>}

              <button
                data-testid="send-otp-btn"
                type="submit"
                disabled={busy}
                className="bg-emerald-gradient text-ivory shadow-elegant flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium tap-scale disabled:opacity-60"
              >
                <MessageCircle className="h-4 w-4" />
                {busy ? "Sending code…" : "Send WhatsApp code"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verifyOtp} className="space-y-3" data-testid="otp-form">
              <div className="glass shadow-soft rounded-3xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-deep" />
                  <p className="font-display text-base text-deep">Verify your WhatsApp</p>
                </div>
                <p className="text-xs text-deep/60">
                  We sent a 6-digit code to <strong>{country} {phone}</strong>. Type it below to finish — you'll stay signed in for 90 days.
                </p>
                <input
                  data-testid="otp-input"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-3 text-center text-2xl font-display tracking-[0.5em] outline-none focus:border-gold"
                />
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setStep("register"); setOtp(""); setErr(null); }}
                  data-testid="otp-edit"
                  className="block w-full text-center text-[11px] text-deep/55 tap-scale"
                >
                  ← Use a different number or email
                </button>
              </div>

              {err && <ErrorBox testid="otp-error">{err}</ErrorBox>}

              <button
                data-testid="verify-otp-btn"
                type="submit"
                disabled={busy || otp.length < 4}
                className="bg-emerald-gradient text-ivory shadow-elegant flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium tap-scale disabled:opacity-60"
              >
                {busy ? "Verifying…" : "Verify & enter"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          <p className="pt-2 text-center text-[10px] uppercase tracking-[0.18em] text-deep/40">
            Independent · community-driven · non-authoritative
          </p>
          <div className="flex items-center justify-center gap-3 text-[10px] text-deep/45">
            <a href="/privacy" data-testid="login-privacy">Privacy</a>
            <span className="text-deep/15">·</span>
            <a href="/terms" data-testid="login-terms">Terms</a>
          </div>
          <p className="px-2 text-center text-[10px] leading-relaxed text-deep/35" data-testid="login-credit">
            Curated with care by Naushad &amp; Shabnam Patel · Andheri Jamatkhana · Mumbai
          </p>
        </section>
      </div>
    </div>
  );
}

function ErrorBox({ children, testid }) {
  return <div data-testid={testid} className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{children}</div>;
}
function InfoBox({ children }) {
  return <div className="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800">{children}</div>;
}
