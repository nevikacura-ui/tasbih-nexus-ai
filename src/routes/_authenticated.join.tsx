import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Check, Copy, ShieldCheck, Sparkles, Users, ArrowRight, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/join")({
  head: () => ({
    meta: [
      { title: "Join the Circle — Tasbih.ai" },
      { name: "description", content: "Redeem invite codes from trusted members to unlock full access to Tasbih.ai." },
    ],
  }),
  component: JoinPage,
});

type ReferralRow = {
  id: string;
  code: string;
  invitee_id: string | null;
  redeemed_at: string | null;
  inviter_id: string;
};

function JoinPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [myCode, setMyCode] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<ReferralRow[]>([]); // codes I redeemed
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: own }, { data: incoming }] = await Promise.all([
      supabase
        .from("referrals")
        .select("id, code, invitee_id, redeemed_at, inviter_id")
        .eq("inviter_id", user.id)
        .is("invitee_id", null)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("referrals")
        .select("id, code, invitee_id, redeemed_at, inviter_id")
        .eq("invitee_id", user.id),
    ]);
    setMyCode(own?.[0]?.code ?? null);
    setRedemptions(incoming ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const isMember = profile?.status === "member";
  const received = profile?.referrals_received ?? redemptions.length;
  const remaining = Math.max(0, 2 - received);

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("redeem_referral", {
      _code: code.trim().toUpperCase(),
    });
    setSubmitting(false);
    if (error) {
      setMessage({ type: "err", text: error.message });
      return;
    }
    const res = data as { ok: boolean; error?: string; count?: number; unlocked?: boolean };
    if (!res.ok) {
      const map: Record<string, string> = {
        invalid_code: "We couldn't find that invite code.",
        self_referral: "You can't redeem your own invite code.",
        already_redeemed: "That code has already been used.",
        duplicate_inviter: "You've already used a code from this member.",
        not_authenticated: "Please sign in first.",
      };
      setMessage({ type: "err", text: map[res.error ?? ""] ?? "Could not redeem code." });
      return;
    }
    setCode("");
    setMessage({
      type: "ok",
      text: res.unlocked
        ? "Welcome to the circle — full access unlocked."
        : `Accepted. ${Math.max(0, 2 - (res.count ?? 0))} more to unlock.`,
    });
    await refreshProfile();
    await load();
  };

  const copy = async () => {
    if (!myCode) return;
    const link = `${window.location.origin}/invite/${myCode}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <MobileShell>
      <div className="relative">
        <NoorBackdrop />

        <header className="px-5 pt-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trust-based joining</p>
          <h1 className="mt-1 font-display text-2xl text-foreground">Join the Circle</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Tasbih.ai grows through trust. Two invites from existing members unlock full access.
          </p>
        </header>

        <section className="mt-5 px-5">
          <div className="bg-emerald-gradient text-primary-foreground shadow-elegant relative overflow-hidden rounded-3xl p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-accent">
              {isMember ? <Sparkles className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {isMember ? "Member" : "Explorer mode"}
            </div>
            <p className="mt-3 font-display text-[19px] leading-snug">
              {isMember
                ? "You're a full member — invite others to grow the circle."
                : `${received} of 2 referrals accepted`}
            </p>
            <div className="mt-3 flex gap-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    received > i ? "bg-accent" : "bg-primary-foreground/20"
                  }`}
                />
              ))}
            </div>
            {!isMember && (
              <p className="mt-3 text-xs text-primary-foreground/80">
                {remaining === 0
                  ? "Refresh to unlock."
                  : `${remaining} more invite${remaining > 1 ? "s" : ""} to unlock full access.`}
              </p>
            )}
          </div>
        </section>

        {!isMember && (
          <section className="mt-6 px-5">
            <h2 className="mb-3 font-display text-lg text-foreground">Redeem an invite code</h2>
            <form onSubmit={redeem} className="glass space-y-3 rounded-2xl p-4 shadow-soft">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. NOOR2K8X"
                maxLength={16}
                autoCapitalize="characters"
                className="bg-secondary/70 text-foreground placeholder:text-muted-foreground w-full rounded-xl px-4 py-3 font-mono text-sm tracking-widest focus:outline-none"
              />
              {message && (
                <p className={`text-xs ${message.type === "ok" ? "text-primary" : "text-destructive"}`}>
                  {message.text}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || code.length < 4}
                className="bg-emerald-gradient text-primary-foreground shadow-glow flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium disabled:opacity-60"
              >
                {submitting ? "Verifying…" : "Redeem invite"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          </section>
        )}

        {isMember && myCode && (
          <section className="mt-6 px-5">
            <h2 className="mb-3 font-display text-lg text-foreground">Your invite code</h2>
            <div className="glass shadow-soft rounded-2xl p-5">
              <p className="font-display text-3xl tracking-[0.4em] text-foreground">{myCode}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Share this code with someone you trust. They'll need one more to unlock full access.
              </p>
              <button
                onClick={copy}
                className="bg-gold-gradient text-deep mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied link" : "Copy invite link"}
              </button>
            </div>
          </section>
        )}

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-lg text-foreground">How it works</h2>
          <div className="space-y-2.5">
            {steps.map((s, i) => (
              <div key={s.title} className="glass flex items-start gap-3 rounded-2xl p-4 shadow-soft">
                <div className="bg-gold-gradient text-deep flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="glass mt-3 flex items-start gap-3 rounded-2xl p-4 shadow-soft">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              The people who invite you are responsible for community quality. Invite mindfully.
            </p>
          </div>
        </section>

        <section className="mt-6 px-5">
          <Link
            to="/communities"
            className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium"
          >
            Meanwhile, explore communities <ArrowRight className="h-3 w-3" />
          </Link>
        </section>
      </div>
    </MobileShell>
  );
}

const steps = [
  { title: "Download & explore", sub: "Tasbih, reflections, and previews are open to everyone." },
  { title: "Get 2 referrals", sub: "Receive invite codes from two existing trusted members." },
  { title: "Join & connect", sub: "Unlock communities, events, and full participation." },
];
