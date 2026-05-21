import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Sparkles, Users, Calendar, User } from "lucide-react";

const NAV = [
  { to: "/", label: "Home", icon: Home, test: "nav-home" },
  { to: "/noor", label: "Noor", icon: Sparkles, test: "nav-noor" },
  { to: "/circles", label: "Circles", icon: Users, test: "nav-circles" },
  { to: "/events", label: "Events", icon: Calendar, test: "nav-events" },
  { to: "/profile", label: "Profile", icon: User, test: "nav-profile" },
];

export default function MobileShell({ children }) {
  const { pathname } = useLocation();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col" data-testid="mobile-shell">
      <main className="flex-1 pb-28">{children}</main>
      <nav className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2" data-testid="bottom-nav">
        <div className="glass rounded-full px-2 py-2 shadow-elegant">
          <ul className="flex items-center justify-between">
            {NAV.map(({ to, label, icon: Icon, test }) => {
              const active = pathname === to || (to !== "/" && pathname.startsWith(to));
              return (
                <li key={to} className="flex-1">
                  <NavLink
                    to={to}
                    data-testid={test}
                    className="flex flex-col items-center gap-0.5 rounded-full px-2 py-1.5"
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                        active
                          ? "bg-emerald-gradient text-ivory shadow-glow"
                          : "text-deep/55"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                    </span>
                    <span className={`text-[10px] font-medium ${active ? "text-deep" : "text-deep/55"}`}>
                      {label}
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </div>
  );
}
