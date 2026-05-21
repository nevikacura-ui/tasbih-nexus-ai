import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/invite/$code")({
  head: () => ({
    meta: [
      { title: "You're invited — Tasbih.ai" },
      { name: "description", content: "Accept your invitation to join Tasbih.ai." },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { code } = Route.useParams();
  const { user, loading, refreshProfile } = useAuth();
  const [state, setState] = useState<"idle" | "redeeming" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (loading || !user) return;
    if (state !== "idle") return;
    setState("redeeming");
    (async () => {
      const { data, error } = await supabase.rpc("redeem_referral", { _code: code.toUpperCase() });
      if (error) {
        setState("error");
        setMsg(error.message);
        return;
      }
      const res = data as { ok: boolean; error?: string; unlocked?: boolean };
      if (!res.ok) {
        const map: Record<string, string> = {
          invalid_code: "This invite code isn't valid.",
          self_referral: "You can't redeem your own invite.",
          already_redeemed: "This invite has already been used.",
          duplicate_inviter: "You've already used a code from this member.",
        };
        setMsg(map[res.error ?? ""] ?? "Could not redeem invite.");
        setState("error");
        return;
      }
      await refreshProfile();
      setMsg(res.unlocked ? "Welcome to the circle." : "Invite accepted.");
      setState("done");
    })();
  }, [loading, user, code, state, refreshProfile]);

  if (!loading && !user) {
    return <Navigate to="/login" search={{ redirect: `/invite/${code}` }} />;
  }

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
      <NoorBackdrop />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="bg-emerald-gradient shadow-glow noor-ring animate-breathe flex h-16 w-16 items-center justify-center rounded-full">
          <Sparkles className="h-6 w-6 text-accent" />
        </div>
        <p className="mt-6 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Invite</p>
        <p className="mt-2 font-mono text-2xl tracking-[0.4em] text-foreground">{code.toUpperCase()}</p>
        <p className="mt-6 text-sm text-muted-foreground">
          {state === "redeeming" && "Verifying your invite…"}
          {state === "done" && msg}
          {state === "error" && msg}
        </p>
        <a
          href="/join"
          className="bg-emerald-gradient text-primary-foreground shadow-elegant mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
        >
          Continue
        </a>
      </div>
    </div>
  );
}
