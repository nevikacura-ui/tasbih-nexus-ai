import { Link, useLocation } from "@tanstack/react-router";
import { Home, Sparkles, Users, Calendar, User } from "lucide-react";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/spiritual", label: "Spiritual", icon: Sparkles },
  { to: "/communities", label: "Circles", icon: Users },
  { to: "/events", label: "Events", icon: Calendar },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function MobileShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
      <main className="flex-1 pb-28">{children}</main>
      <nav className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2">
        <div className="glass shadow-elegant rounded-full px-2 py-2">
          <ul className="flex items-center justify-between">
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <li key={to} className="flex-1">
                  <Link
                    to={to}
                    className="flex flex-col items-center gap-0.5 rounded-full px-2 py-1.5 transition-all"
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                        active
                          ? "bg-emerald-gradient text-primary-foreground shadow-glow"
                          : "text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                    </span>
                    <span
                      className={`text-[10px] font-medium transition-colors ${
                        active ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </div>
  );
}
