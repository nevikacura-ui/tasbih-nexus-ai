// Shared prayer-times utility.
//
// Strategy (graceful fallback chain):
//   1. If we have cached lat/lng in localStorage → compute today's real times
//      with the `adhan` library (no network, fully client-side, BSD-2 licensed).
//   2. Otherwise → fall back to a friendly default 5-prayer schedule that
//      matches the backend reminder seed.
//
// The defaults match `/app/backend/server.py` so the experience is consistent
// for users who haven't shared their location yet.
import {
  Coordinates,
  CalculationMethod,
  PrayerTimes,
  Madhab,
} from "adhan";
import { api } from "./api";

const LS_LOC_KEY = "tasbih_user_location"; // { lat, lng, label?, savedAt }

export const DEFAULT_PRAYERS = [
  { key: "fajr",    label: "Fajr",    time: "05:30", note: "the first light" },
  { key: "dhuhr",   label: "Dhuhr",   time: "13:00", note: "the noonday pause" },
  { key: "asr",     label: "Asr",     time: "16:30", note: "the afternoon calm" },
  { key: "maghrib", label: "Maghrib", time: "18:45", note: "the sunset reflection" },
  { key: "isha",    label: "Isha",    time: "20:30", note: "the evening rest" },
];

const NOTES = {
  fajr: "the first light",
  dhuhr: "the noonday pause",
  asr: "the afternoon calm",
  maghrib: "the sunset reflection",
  isha: "the evening rest",
};

function readCachedLocation() {
  try {
    const raw = localStorage.getItem(LS_LOC_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (typeof obj?.lat === "number" && typeof obj?.lng === "number") return obj;
    return null;
  } catch (_) { return null; }
}

export function saveLocation({ lat, lng, label }) {
  try {
    localStorage.setItem(LS_LOC_KEY, JSON.stringify({
      lat, lng, label: label || null, savedAt: new Date().toISOString(),
    }));
  } catch (_) { /* storage disabled — that's fine */ }
}

export function getCachedLocation() {
  return readCachedLocation();
}

export function clearLocation() {
  try { localStorage.removeItem(LS_LOC_KEY); } catch (_) {}
}

/** Ask the browser for geolocation. Resolves to {lat, lng} or null. */
export function requestGeolocation(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    navigator.geolocation.getCurrentPosition(
      (pos) => finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => finish(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 24 * 60 * 60 * 1000 },
    );
  });
}

/** Look up the nearest seeded jamatkhana to label the user's city. */
export async function fetchNearestCity(lat, lng) {
  try {
    const r = await api.get(`/jamatkhanas/nearby?lat=${lat}&lng=${lng}&limit=1`);
    const top = (r.data?.nearby || [])[0];
    if (top?.city) return { city: top.city, country: top.country, distance_km: top.distance_km };
  } catch (_) { /* ignore — labels are nice-to-have */ }
  return null;
}

function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
function fmtHM(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

/** Compute today's 5 prayer times for given coords using the Karachi method
 *  (good default for South Asia + East Africa, where most of our Jamati cities are).
 *  Returns an array shaped like DEFAULT_PRAYERS but with real local HH:MM times. */
export function computePrayerTimesForLocation(lat, lng, when = new Date()) {
  const coords = new Coordinates(lat, lng);
  const params = CalculationMethod.Karachi();
  params.madhab = Madhab.Hanafi; // Asr later in the day — common Ismaili preference
  const pt = new PrayerTimes(coords, when, params);
  return [
    { key: "fajr",    label: "Fajr",    time: fmtHM(pt.fajr),    note: NOTES.fajr,    at: new Date(pt.fajr) },
    { key: "dhuhr",   label: "Dhuhr",   time: fmtHM(pt.dhuhr),   note: NOTES.dhuhr,   at: new Date(pt.dhuhr) },
    { key: "asr",     label: "Asr",     time: fmtHM(pt.asr),     note: NOTES.asr,     at: new Date(pt.asr) },
    { key: "maghrib", label: "Maghrib", time: fmtHM(pt.maghrib), note: NOTES.maghrib, at: new Date(pt.maghrib) },
    { key: "isha",    label: "Isha",    time: fmtHM(pt.isha),    note: NOTES.isha,    at: new Date(pt.isha) },
  ];
}

function attachAtToDefaults(when = new Date()) {
  const today = new Date(when);
  today.setSeconds(0, 0);
  return DEFAULT_PRAYERS.map((p) => {
    const [h, m] = p.time.split(":").map(Number);
    const at = new Date(today);
    at.setHours(h, m, 0, 0);
    return { ...p, at };
  });
}

/** Build the 5 prayer entries for today, honouring the cached location when present. */
export function getPrayersForToday(when = new Date()) {
  const loc = readCachedLocation();
  if (loc?.lat != null && loc?.lng != null) {
    try {
      return computePrayerTimesForLocation(loc.lat, loc.lng, when);
    } catch (_) { /* fall through to defaults if adhan ever throws */ }
  }
  return attachAtToDefaults(when);
}

/** Back-compat alias — kept stable so older callers keep working. */
export const PRAYERS = DEFAULT_PRAYERS;

/** Next prayer (today or tomorrow's Fajr) — uses real or default schedule. */
export function nextPrayer(now = new Date()) {
  const list = getPrayersForToday(now);
  for (const p of list) {
    if (p.at > now) return { ...p, isTomorrow: false };
  }
  // After Isha → tomorrow's Fajr (recompute for the next day, not just defaults)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowList = getPrayersForToday(tomorrow);
  const fajr = tomorrowList[0];
  return { ...fajr, isTomorrow: true };
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
