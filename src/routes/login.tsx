import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: (s.redirect as string) || "/",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Tasbih.ai" },
      { name: "description", content: "Sign in to Tasbih.ai with Google. Trust-based community access." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading } = useAuth();
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: redirect || "/" });
    }
  }, [user, loading, navigate, redirect]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(result.error.message || "Sign-in failed. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: redirect || "/" });
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
      <NoorBackdrop />
      <div className="flex flex-1 flex-col justify-between px-6 py-10">
        <header className="animate-float-up pt-6">
          <div className="bg-emerald-gradient shadow-glow flex h-12 w-12 items-center justify-center rounded-2xl">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <h1 className="mt-6 font-display text-3xl text-foreground">
            Welcome to <span className="text-gold-gradient">Tasbih.ai</span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A calm, trust-based community for spiritual growth. Sign in to begin in
            explore mode — unlock the full circle when two trusted members refer you.
          </p>
        </header>

        <section className="space-y-3 pb-6">
          <div className="glass shadow-soft flex items-start gap-3 rounded-2xl p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              We never post on your behalf. Your account is used only for sign-in and
              keeping your spiritual journey in sync across devices.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <button
            disabled={busy || loading}
            onClick={signIn}
            className="bg-emerald-gradient text-primary-foreground shadow-elegant flex w-full items-center justify-center gap-3 rounded-full py-3.5 text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <GoogleIcon />
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>

          <Link
            to="/"
            className="text-muted-foreground flex items-center justify-center gap-1 py-2 text-xs font-medium"
          >
            Explore first <ArrowRight className="h-3 w-3" />
          </Link>
        </section>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.2-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5 0 9.6-1.9 13-5l-6-5.1c-2 1.4-4.4 2.2-7 2.2-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6 5.1c-.4.4 6.7-4.9 6.7-14.5 0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
