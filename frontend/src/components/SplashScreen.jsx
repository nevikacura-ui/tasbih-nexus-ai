import React, { useEffect, useState } from "react";

/**
 * SplashScreen — cinematic intro shown once per browser tab session.
 * Renders the brand splash, then fades into the app after ~1.6s.
 */
export default function SplashScreen() {
  const [hide, setHide] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => {
      try { sessionStorage.setItem("tasbih_splash_shown", "1"); } catch {}
      setHide(true);
    }, 1100);
    const t2 = setTimeout(() => setGone(true), 1700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (gone) return null;

  return (
    <div
      data-testid="splash-screen"
      className={`fixed inset-0 z-[100] transition-opacity duration-700 ease-out ${hide ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      style={{
        backgroundImage: "url(/splash.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      aria-hidden="true"
    >
      {/* Soft ivory wash for legibility on any cropping */}
      <div className="absolute inset-0 bg-gradient-to-b from-ivory/0 via-ivory/0 to-ivory/40" />
      {/* Breathing gold halo behind logo, subtle */}
      <div className="pointer-events-none absolute left-1/2 top-[42%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-noor blur-3xl animate-breathe" />
    </div>
  );
}
