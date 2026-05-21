import React from "react";

export function NoorBackdrop({ className = "" }) {
  return (
    <div className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}>
      {/* Soft Noor halo */}
      <div className="absolute -top-40 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-noor blur-2xl" />
      {/* Geometric texture */}
      <div className="absolute inset-0 geo-overlay" />
      {/* Drifting light particles */}
      <span className="particle absolute top-24 left-10 h-1.5 w-1.5 rounded-full bg-gold/70 shadow-glow" style={{ animationDelay: "0s" }} />
      <span className="particle absolute top-40 right-12 h-1 w-1 rounded-full bg-gold/60" style={{ animationDelay: "1.6s" }} />
      <span className="particle absolute top-72 left-1/3 h-1.5 w-1.5 rounded-full bg-gold/50" style={{ animationDelay: "3s" }} />
      <span className="particle absolute top-[420px] right-1/4 h-1 w-1 rounded-full bg-gold/60" style={{ animationDelay: "4.2s" }} />
    </div>
  );
}
