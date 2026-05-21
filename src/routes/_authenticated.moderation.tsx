import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ShieldCheck, AlertTriangle, EyeOff, Trash2, Ban, MessageCircle, Check, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/moderation")({
  head: () => ({
    meta: [
      { title: "Moderation — Tasbih.ai" },
      { name: "description", content: "Moderator dashboard for reviewing reports and recording actions." },
    ],
  }),
  component: ModerationPage,
});

type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
};

const ACTIONS = [
  { value: "warn", label: "Warn", icon: MessageCircle },
  { value: "hide", label: "Hide", icon: EyeOff },
  { value: "remove", label: "Remove", icon: Trash2 },
  { value: "ban", label: "Ban", icon: Ban },
  { value: "dismiss", label: "Dismiss", icon: Check },
] as const;

function ModerationPage() {
  const { user } = useAuth();
  const [isMod, setIsMod] = useState<boolean | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [filter, setFilter] = useState<"open" | "reviewing" | "resolved" | "dismissed" | "all">("open");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (data ?? []).map((r) => r.role);
      setIsMod(roles.includes("moderator") || roles.includes("admin"));
    })();
  }, [user]);

  useEffect(() => {
    if (!isMod) return;
    (async () => {
      setLoading(true);
      let q = supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data } = await q;
      setReports((data ?? []) as ReportRow[]);
      setLoading(false);
    })();
  }, [isMod, filter]);

  if (isMod === false) {
    return (
      <MobileShell>
        <div className="relative flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
          <NoorBackdrop />
          <div className="bg-secondary/60 flex h-16 w-16 items-center justify-center rounded-full">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="mt-5 font-display text-2xl text-foreground">Moderators only</h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            This space is reserved for trained community moderators.
          </p>
          <Link
            to="/guidelines"
            className="mt-6 text-sm font-medium text-primary underline"
          >
            Read community guidelines
          </Link>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="relative">
        <NoorBackdrop />
        <header className="px-5 pt-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trust & safety</p>
          <h1 className="mt-1 font-display text-2xl text-foreground">Moderation</h1>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Confidential. Reporter
            identities are never shown to the reported party.
          </p>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(["open", "reviewing", "resolved", "dismissed", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium capitalize ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </header>

        <section className="mt-5 space-y-3 px-5 pb-6">
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!loading && reports.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center shadow-soft">
              <p className="text-sm text-foreground">Nothing in this queue.</p>
              <p className="mt-1 text-xs text-muted-foreground">All quiet, alhamdulillah.</p>
            </div>
          )}
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              moderatorId={user!.id}
              onChange={(next) =>
                setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...next } : x)))
              }
            />
          ))}
        </section>
      </div>
    </MobileShell>
  );
}

function ReportCard({
  report,
  moderatorId,
  onChange,
}: {
  report: ReportRow;
  moderatorId: string;
  onChange: (next: Partial<ReportRow>) => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (action: typeof ACTIONS[number]["value"]) => {
    setBusy(true);
    const newStatus: ReportRow["status"] =
      action === "dismiss" ? "dismissed" : action === "warn" ? "reviewing" : "resolved";

    await supabase.from("moderator_actions").insert({
      report_id: report.id,
      moderator_id: moderatorId,
      action,
      notes: notes.trim() || null,
    });
    await supabase.from("reports").update({ status: newStatus }).eq("id", report.id);
    onChange({ status: newStatus });
    setBusy(false);
    setNotes("");
  };

  return (
    <article className="glass rounded-2xl p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
            <AlertTriangle className="h-3.5 w-3.5" /> {report.reason.replace("_", " ")}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            <span className="capitalize">{report.target_type}</span> · {report.target_id}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {new Date(report.created_at).toLocaleString()}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize ${
            report.status === "open"
              ? "bg-primary/15 text-primary"
              : report.status === "reviewing"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-secondary text-secondary-foreground"
          }`}
        >
          {report.status}
        </span>
      </div>

      {report.details && (
        <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed text-foreground/85">
          {report.details}
        </p>
      )}

      {report.status !== "resolved" && report.status !== "dismissed" && (
        <>
          <textarea
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Internal notes (optional)"
            className="bg-background/40 mt-3 w-full rounded-xl border border-border/40 px-3 py-2 text-xs outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {ACTIONS.map((a) => (
              <button
                key={a.value}
                onClick={() => act(a.value)}
                disabled={busy}
                className="bg-secondary text-secondary-foreground flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium transition-transform active:scale-95 disabled:opacity-60"
              >
                <a.icon className="h-3.5 w-3.5" />
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </article>
  );
}
