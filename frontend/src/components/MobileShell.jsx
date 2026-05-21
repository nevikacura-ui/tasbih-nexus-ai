import React, { useEffect, useRef, useState } from "react";
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
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY || 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const delta = y - lastY.current;
        // Hide on down-scroll past 40px, reveal on up-scroll, always reveal near top
        if (y < 40) setHidden(false);
        else if (delta > 6) setHidden(true);
        else if (delta < -6) setHidden(false);
        lastY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Reveal nav on route change
  useEffect(() => { setHidden(false); }, [pathname]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-ivory" data-testid="mobile-shell">
      <main className="flex-1 pb-24">{children}</main>
      <nav
        data-testid="bottom-nav"
        className={`fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 transition-transform duration-300 ease-out ${
          hidden ? "translate-y-full" : "translate-y-0"
        }`}
        aria-hidden={hidden}
      >
        <div className="border-t border-deep/10 bg-ivory/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
          <ul className="flex items-stretch">
            {NAV.map(({ to, label, icon: Icon, test }) => {
              const active = pathname === to || (to !== "/" && pathname.startsWith(to));
              return (
                <li key={to} className="flex-1">
                  <NavLink
                    to={to}
                    data-testid={test}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 tap-scale"
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
                    <span className={`text-[10px] font-medium leading-none ${active ? "text-deep" : "text-deep/55"}`}>
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
