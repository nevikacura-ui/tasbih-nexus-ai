import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { MobileShell } from "@/components/MobileShell";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ShieldCheck, Flag, ArrowLeft, CheckCircle2 } from "lucide-react";

const TARGETS = ["post", "comment", "user", "message", "community", "event"] as const;
const REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "spam", label: "Spam or scam" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "self_harm", label: "Self-harm or violence" },
  { value: "misinformation", label: "Misinformation" },
  { value: "impersonation", label: "Impersonation" },
  { value: "privacy", label: "Privacy violation" },
  { value: "other", label: "Something else" },
] as const;

const searchSchema = z.object({
  type: z.enum(TARGETS).catch("user"),
  id: z.string().catch(""),
});

export const Route = createFileRoute("/report")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Report — Tasbih.ai" },
      { name: "description", content: "Confidentially report content or behavior to Tasbih.ai moderators." },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { type, id } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [reason, setReason] = useState<typeof REASONS[number]["value"]>("harassment");
  const [details, setDetails] = useState("");
  const [targetId, setTargetId] = useState(id);
  const [targetType, setTargetType] = useState<typeof TARGETS[number]>(type);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && !user) {
    return (
      <MobileShell>
        <div className="relative px-5 pt-10">
          <NoorBackdrop />
          <h1 className="font-display text-2xl text-foreground">Sign in to report</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reports are confidential. Sign in so our moderators can follow up safely.
          </p>
          <Link
            to="/login"
            search={{ redirect: "/report" }}
            className="bg-emerald-gradient text-primary-foreground shadow-elegant mt-6 inline-flex rounded-full px-5 py-2.5 text-sm font-medium"
          >
            Sign in
          </Link>
        </div>
      </MobileShell>
    );
  }

  const submit = async () => {
    setError(null);
    if (!targetId.trim()) {
      setError("Please add what or who this is about.");
      return;
    }
    if (details.length > 1000) {
      setError("Details must be under 1000 characters.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user!.id,
      target_type: targetType,
      target_id: targetId.trim().slice(0, 255),
      reason,
      details: details.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <MobileShell>
        <div className="relative flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
          <NoorBackdrop />
          <div className="bg-emerald-gradient shadow-glow flex h-16 w-16 items-center justify-center rounded-full">
            <CheckCircle2 className="h-7 w-7 text-accent" />
          </div>
          <h1 className="mt-5 font-display text-2xl text-foreground">Report received</h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Jazak'Allah khair. A moderator will review this privately. We never share who
            reported what.
          </p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="bg-emerald-gradient text-primary-foreground shadow-elegant mt-6 rounded-full px-5 py-2.5 text-sm font-medium"
          >
            Back to home
          </button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="relative">
        <NoorBackdrop />
        <header className="flex items-center gap-3 px-5 pt-8">
          <button
            onClick={() => window.history.back()}
            className="glass flex h-9 w-9 items-center justify-center rounded-full shadow-soft"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Safety</p>
            <h1 className="font-display text-xl text-foreground">Report</h1>
          </div>
        </header>

        <section className="mt-5 px-5">
          <div className="glass flex items-start gap-3 rounded-2xl p-4 shadow-soft">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Your report is confidential. Moderators review every submission and decide
              the next step quietly.{" "}
              <Link to="/guidelines" className="text-primary underline">
                Community Guidelines
              </Link>
            </p>
          </div>
        </section>

        <section className="mt-5 space-y-4 px-5 pb-8">
          <Field label="What are you reporting?">
            <div className="flex flex-wrap gap-2">
              {TARGETS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTargetType(t)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    targetType === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Who or what (name, username, or link)">
            <input
              value={targetId}
              maxLength={255}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="@username or post title"
              className="glass w-full rounded-2xl px-4 py-3 text-sm text-foreground shadow-soft outline-none placeholder:text-muted-foreground"
            />
          </Field>

          <Field label="Reason">
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-soft transition-colors ${
                    reason === r.value ? "ring-1 ring-primary" : ""
                  }`}
                >
                  <input
                    type="radio"
                    className="accent-primary"
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                  />
                  <span className="text-foreground">{r.label}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Details (optional)">
            <textarea
              value={details}
              maxLength={1000}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder="Anything that helps moderators understand. No need to share your identity here."
              className="glass w-full rounded-2xl px-4 py-3 text-sm text-foreground shadow-soft outline-none placeholder:text-muted-foreground"
            />
            <p className="mt-1 text-right text-[10px] text-muted-foreground">
              {details.length}/1000
            </p>
          </Field>

          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={submitting}
            className="bg-emerald-gradient text-primary-foreground shadow-elegant flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <Flag className="h-4 w-4" />
            {submitting ? "Submitting…" : "Submit confidentially"}
          </button>
        </section>
      </div>
    </MobileShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
