import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Clock, Eye, CheckCircle2, XCircle, Flag, ChevronRight, ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "My reports — Tasbih.ai" },
      { name: "description", content: "Track the status of reports you've submitted to moderators." },
    ],
  }),
  component: MyReportsPage,
});

type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

type ReportRow = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
};

type ActionRow = {
  report_id: string;
  action: "warn" | "hide" | "remove" | "ban" | "dismiss";
  created_at: string;
};

const STATUS_META: Record<ReportStatus, { label: string; icon: typeof Clock; tone: string; desc: string }> = {
  open: { label: "Received", icon: Clock, tone: "bg-primary/15 text-primary", desc: "Waiting for a moderator to review." },
  reviewing: { label: "Reviewing", icon: Eye, tone: "bg-amber-500/15 text-amber-400", desc: "A moderator is looking into it." },
  resolved: { label: "Actioned", icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-400", desc: "Moderators took action on this report." },
  dismissed: { label: "Dismissed", icon: XCircle, tone: "bg-secondary text-secondary-foreground", desc: "No action taken after review." },
};

const STEPS: ReportStatus[] = ["open", "reviewing", "resolved"];

function MyReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [actions, setActions] = useState<Record<string, ActionRow["action"]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportStatus | "all">("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("reports")
        .select("id, target_type, target_id, reason, details, status, created_at, updated_at")
        .eq("reporter_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      const rows = (data ?? []) as ReportRow[];
      setReports(rows);

      // Pull latest moderator action per report (mods-only on RLS, but we try;
      // reporters typically can't read this — graceful fallback to status only)
      if (rows.length) {
        const { data: acts } = await supabase
          .from("moderator_actions")
          .select("report_id, action, created_at")
          .in("report_id", rows.map((r) => r.id))
          .order("created_at", { ascending: false });
        const map: Record<string, ActionRow["action"]> = {};
        for (const a of (acts ?? []) as ActionRow[]) {
          if (!map[a.report_id]) map[a.report_id] = a.action;
        }
        setActions(map);
      }
      setLoading(false);
    })();
  }, [user]);

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);
  const counts = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <MobileShell>
      <div className="relative">
        <NoorBackdrop />
        <header className="px-5 pt-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trust & safety</p>
          <h1 className="mt-1 font-display text-2xl text-foreground">My reports</h1>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Track each report through
            review and outcome. Your identity stays confidential.
          </p>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(["all", "open", "reviewing", "resolved", "dismissed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium capitalize ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {f}
                {f !== "all" && counts[f] ? (
                  <span className="rounded-full bg-background/30 px-1.5 text-[10px]">
                    {counts[f]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </header>

        <section className="mt-5 space-y-3 px-5 pb-6">
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!loading && reports.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center shadow-soft">
              <Flag className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-foreground">No reports yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                If something feels off, you can let moderators know.
              </p>
              <Link
                to="/report"
                search={{ type: "user" as const, id: "" }}
                className="bg-emerald-gradient text-primary-foreground mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium"
              >
                <Flag className="h-3.5 w-3.5" /> Submit a report
              </Link>
            </div>
          )}
          {!loading && reports.length > 0 && filtered.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">
              No reports in this status.
            </p>
          )}

          {filtered.map((r) => (
            <ReportCard key={r.id} report={r} action={actions[r.id]} />
          ))}
        </section>
      </div>
    </MobileShell>
  );
}

function ReportCard({ report, action }: { report: ReportRow; action?: ActionRow["action"] }) {
  const meta = STATUS_META[report.status];
  const Icon = meta.icon;
  const currentStep =
    report.status === "dismissed" ? 1 : STEPS.indexOf(report.status);

  return (
    <article className="glass rounded-2xl p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
            <Flag className="h-3.5 w-3.5" /> {report.reason.replace(/_/g, " ")}
          </p>
          <p className="mt-1 truncate text-sm font-medium capitalize text-foreground">
            {report.target_type} report
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Filed {new Date(report.created_at).toLocaleDateString()} ·
            {" "}Updated {new Date(report.updated_at).toLocaleDateString()}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${meta.tone}`}
        >
          <Icon className="h-3 w-3" /> {meta.label}
        </span>
      </div>

      {report.details && (
        <p className="mt-3 line-clamp-2 rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed text-foreground/80">
          {report.details}
        </p>
      )}

      {/* Progress tracker */}
      {report.status !== "dismissed" ? (
        <div className="mt-4">
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => {
              const done = i <= currentStep;
              return (
                <div key={s} className="flex flex-1 items-center gap-1.5">
                  <div
                    className={`h-1.5 flex-1 rounded-full ${
                      done ? "bg-primary" : "bg-secondary"
                    }`}
                  />
                  {i < STEPS.length - 1 && (
                    <ChevronRight
                      className={`h-3 w-3 ${done ? "text-primary" : "text-muted-foreground"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            {STEPS.map((s) => (
              <span key={s} className="capitalize">{STATUS_META[s].label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-secondary/60 p-3 text-[11px] text-muted-foreground">
          {meta.desc}
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        {meta.desc}
        {action && report.status === "resolved" && (
          <>
            {" "}Action taken: <span className="capitalize text-foreground">{action}</span>.
          </>
        )}
      </p>
    </article>
  );
}
