// Shared default 5-prayer schedule (matches backend seed in /app/backend/server.py).
// Times are LOCAL (device timezone). Future: per-city lookup via /api/jamatkhanas.
export const PRAYERS = [
  { key: "fajr",    label: "Fajr",    time: "05:30", note: "the first light" },
  { key: "dhuhr",   label: "Dhuhr",   time: "13:00", note: "the noonday pause" },
  { key: "asr",     label: "Asr",     time: "16:30", note: "the afternoon calm" },
  { key: "maghrib", label: "Maghrib", time: "18:45", note: "the sunset reflection" },
  { key: "isha",    label: "Isha",    time: "20:30", note: "the evening rest" },
];

export function nextPrayer(now = new Date()) {
  const today = new Date(now);
  today.setSeconds(0, 0);
  for (const p of PRAYERS) {
    const [h, m] = p.time.split(":").map(Number);
    const t = new Date(today);
    t.setHours(h, m, 0, 0);
    if (t > now) return { ...p, at: t, isTomorrow: false };
  }
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [h, m] = PRAYERS[0].time.split(":").map(Number);
  tomorrow.setHours(h, m, 0, 0);
  return { ...PRAYERS[0], at: tomorrow, isTomorrow: true };
}

export function formatGap(target, now = new Date()) {
  let ms = target - now;
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0 && m === 0) return "now";
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
