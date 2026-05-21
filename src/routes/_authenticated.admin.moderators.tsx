import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Lock, ShieldCheck, ShieldPlus, ShieldMinus, Search, Crown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/moderators")({
  head: () => ({
    meta: [
      { title: "Moderator management — Tasbih.ai" },
      { name: "description", content: "Admin tools to promote or demote community moderators." },
    ],
  }),
  component: AdminModeratorsPage,
});

type Profile = {
  id: string;
  display_name: string | null;
  city: string | null;
  avatar_url: string | null;
  status: "explorer" | "member";
};

type RoleRow = { user_id: string; role: "admin" | "moderator" | "member" };

function AdminModeratorsPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      setIsAdmin((data ?? []).some((r) => r.role === "admin"));
    })();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, city, avatar_url, status")
        .order("display_name", { ascending: true })
        .limit(500),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setProfiles((p ?? []) as Profile[]);
    setRoles((r ?? []) as RoleRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const roleMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const row of roles) {
      if (!m.has(row.user_id)) m.set(row.user_id, new Set());
      m.get(row.user_id)!.add(row.role);
    }
    return m;
  }, [roles]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return profiles;
    return profiles.filter(
      (p) =>
        (p.display_name ?? "").toLowerCase().includes(term) ||
        (p.city ?? "").toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term),
    );
  }, [profiles, q]);

  const promote = async (uid: string) => {
    setBusyId(uid);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: uid, role: "moderator" });
    if (error) toast.error(error.message);
    else {
      toast.success("Promoted to moderator");
      setRoles((prev) => [...prev, { user_id: uid, role: "moderator" }]);
    }
    setBusyId(null);
  };

  const demote = async (uid: string) => {
    setBusyId(uid);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", uid)
      .eq("role", "moderator");
    if (error) toast.error(error.message);
    else {
      toast.success("Moderator role removed");
      setRoles((prev) => prev.filter((r) => !(r.user_id === uid && r.role === "moderator")));
    }
    setBusyId(null);
  };

  if (isAdmin === null) {
    return (
      <MobileShell>
        <div className="px-5 pt-10 text-sm text-muted-foreground">Checking access…</div>
      </MobileShell>
    );
  }

  if (!isAdmin) {
    return (
      <MobileShell>
        <div className="relative flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
          <NoorBackdrop />
          <div className="bg-secondary/60 flex h-16 w-16 items-center justify-center rounded-full">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="mt-5 font-display text-2xl text-foreground">Admins only</h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            This space manages moderator roles and is restricted to admins.
          </p>
          <Link to="/profile" className="mt-6 text-sm font-medium text-primary underline">
            Back to profile
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
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Admin</p>
          <h1 className="mt-1 font-display text-2xl text-foreground">Moderator management</h1>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Promote trusted members or
            revoke moderator access. Changes are logged by the database.
          </p>

          <div className="glass mt-4 flex items-center gap-2 rounded-full px-3.5 py-2 shadow-soft">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, city, or id"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </header>

        <section className="mt-5 space-y-2 px-5 pb-6">
          {loading && <p className="text-xs text-muted-foreground">Loading members…</p>}
          {!loading && filtered.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center shadow-soft">
              <p className="text-sm text-foreground">No members found.</p>
            </div>
          )}
          {filtered.map((p) => {
            const userRoles = roleMap.get(p.id) ?? new Set<string>();
            const isMod = userRoles.has("moderator");
            const isUserAdmin = userRoles.has("admin");
            const isSelf = p.id === user?.id;
            const initial = (p.display_name ?? "?").charAt(0).toUpperCase();
            return (
              <article
                key={p.id}
                className="glass flex items-center gap-3 rounded-2xl p-3.5 shadow-soft"
              >
                <div className="bg-gold-gradient text-deep flex h-10 w-10 items-center justify-center rounded-full font-display text-base">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.display_name ?? "Unnamed"}
                    {isSelf && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>
                    )}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] capitalize text-muted-foreground">
                      {p.status}
                    </span>
                    {p.city && (
                      <span className="text-[10px] text-muted-foreground">· {p.city}</span>
                    )}
                    {isUserAdmin && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                        <Crown className="h-2.5 w-2.5" /> Admin
                      </span>
                    )}
                    {isMod && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                        <ShieldCheck className="h-2.5 w-2.5" /> Moderator
                      </span>
                    )}
                  </div>
                </div>
                {isMod ? (
                  <button
                    onClick={() => demote(p.id)}
                    disabled={busyId === p.id || isUserAdmin}
                    className="bg-secondary text-secondary-foreground flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <ShieldMinus className="h-3 w-3" /> Demote
                  </button>
                ) : (
                  <button
                    onClick={() => promote(p.id)}
                    disabled={busyId === p.id}
                    className="bg-emerald-gradient text-primary-foreground flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <ShieldPlus className="h-3 w-3" /> Promote
                  </button>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </MobileShell>
  );
}
