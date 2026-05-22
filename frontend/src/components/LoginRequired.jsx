import React from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { NoorBackdrop } from "./NoorBackdrop";

/**
 * A gentle, full-bleed "sign in to unlock" CTA shown to guests when they
 * try to access a member-only feature (Circles, Profile sub-pages, etc).
 *
 * Free pages (Home, Noor, Dua, Jamatkhana) NEVER render this — they are
 * always open to anyone.
 */
export default function LoginRequired({
  title = "Sign in to continue",
  feature = "this feature",
  description,
  testId = "login-required",
}) {
  return (
    <div className="relative min-h-[100svh] bg-ivory text-deep" data-testid={testId}>
      <NoorBackdrop />
      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[480px] flex-col items-center justify-center px-7 py-16 text-center">
        <div
          className="mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-[#0F3D36]/15 bg-ivory shadow-elegant"
          aria-hidden="true"
        >
          <Lock className="h-6 w-6 text-[#0F3D36]" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#0F3D36]/55">
          Member space
        </p>
        <h1
          className="mt-3 font-display leading-tight text-[#0F3D36]"
          style={{ fontSize: "clamp(28px, 7vw, 38px)" }}
        >
          {title}
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-deep/70">
          {description || (
            <>
              Tasbih is open and warm for everyone — Home, Noor AI, the Dua, and
              the Jamatkhana finder are free to use. To join {feature}, sign in
              with your invitation codes.
            </>
          )}
        </p>

        <Link
          to="/login"
          data-testid={`${testId}-cta`}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-gradient px-6 py-3.5 text-sm font-medium text-ivory shadow-glow tap-scale"
        >
          <Sparkles className="h-4 w-4" />
          Sign in
          <ArrowRight className="h-4 w-4" />
        </Link>

        <div className="mt-10 grid w-full grid-cols-2 gap-2.5">
          <Link
            to="/dua"
            data-testid="login-required-explore-dua"
            className="rounded-2xl border border-[#0F3D36]/10 bg-ivory/70 px-4 py-3 text-left tap-scale"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#0F3D36]/55">Open</p>
            <p className="mt-1 font-display text-base text-[#0F3D36]">Holy Du'a</p>
          </Link>
          <Link
            to="/noor"
            data-testid="login-required-explore-noor"
            className="rounded-2xl border border-[#0F3D36]/10 bg-ivory/70 px-4 py-3 text-left tap-scale"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#0F3D36]/55">Open</p>
            <p className="mt-1 font-display text-base text-[#0F3D36]">Noor AI</p>
          </Link>
          <Link
            to="/jamatkhana"
            data-testid="login-required-explore-jk"
            className="rounded-2xl border border-[#0F3D36]/10 bg-ivory/70 px-4 py-3 text-left tap-scale"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#0F3D36]/55">Open</p>
            <p className="mt-1 font-display text-base text-[#0F3D36]">Jamatkhana</p>
          </Link>
          <Link
            to="/"
            data-testid="login-required-explore-home"
            className="rounded-2xl border border-[#0F3D36]/10 bg-ivory/70 px-4 py-3 text-left tap-scale"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#0F3D36]/55">Open</p>
            <p className="mt-1 font-display text-base text-[#0F3D36]">Home</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
