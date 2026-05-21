import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, MapPin, Users, GraduationCap, Flame, Crown, Building2, Sparkles } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default leaflet marker (CRA + bundlers strip the asset paths)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const goldIcon = L.divIcon({
  className: "",
  html: `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:radial-gradient(circle at 30% 30%, #E8C887, #C9A46A);box-shadow:0 0 0 4px rgba(201,164,106,0.25), 0 8px 18px rgba(15,61,54,0.35);color:#0F3D36;font-weight:700;font-size:12px;">⊛</span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const homeIcon = L.divIcon({
  className: "",
  html: `<span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:linear-gradient(135deg,#0F3D36,#123F39);box-shadow:0 0 0 5px rgba(201,164,106,0.45), 0 10px 22px rgba(15,61,54,0.45);color:#C9A46A;font-weight:700;font-size:13px;">★</span>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

export default function SangatPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try { const r = await api.get("/profile/sangat"); setData(r.data); }
    catch (e) { /* swallow — guard rendering below */ }
    finally { setLoading(false); }
  })(); }, []);

  const homeCity = data?.home_city;
  const homeJk = data?.home_jamatkhana;
  const cityJks = data?.city_jamatkhanas || [];

  // Decide map centre
  const centre = homeCity ? [homeCity.lat, homeCity.lng]
    : homeJk ? [homeJk.lat, homeJk.lng]
    : cityJks[0] ? [cityJks[0].lat, cityJks[0].lng]
    : [25, 30];
  const zoom = (homeCity || homeJk || cityJks.length) ? 4 : 2;

  return (
    <MobileShell>
      <div className="relative" data-testid="sangat-page">
        <NoorBackdrop />

        <header className="flex items-center gap-3 px-5 pt-9">
          <Link to="/profile" data-testid="sangat-back" className="glass flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
            <ChevronLeft className="h-4 w-4 text-deep" />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">My Sangat</p>
            <h1 className="font-display text-2xl text-deep">Your spiritual passport</h1>
          </div>
        </header>

        <section className="mt-5 px-5">
          <div className="glass overflow-hidden rounded-3xl shadow-elegant" style={{ height: 320 }}>
            <MapContainer center={centre} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {homeCity && (
                <Marker position={[homeCity.lat, homeCity.lng]}>
                  <Popup><strong>Home</strong><br/>{homeCity.name}{homeCity.country ? `, ${homeCity.country}` : ""}</Popup>
                </Marker>
              )}
              {homeJk && homeJk.lat && (
                <Marker position={[homeJk.lat, homeJk.lng]} icon={homeIcon}>
                  <Popup><strong>{homeJk.name}</strong><br/>{homeJk.city}, {homeJk.country}</Popup>
                </Marker>
              )}
              {cityJks.map((j) => (
                j.lat ? (
                  <Marker key={j.jk_id} position={[j.lat, j.lng]} icon={goldIcon}>
                    <Popup><strong>{j.name}</strong><br/>{j.city}, {j.country}</Popup>
                  </Marker>
                ) : null
              ))}
              {homeCity && (
                <CircleMarker
                  center={[homeCity.lat, homeCity.lng]}
                  radius={26}
                  pathOptions={{ color: "#C9A46A", weight: 1, opacity: 0.35, fillColor: "#C9A46A", fillOpacity: 0.08 }}
                />
              )}
            </MapContainer>
          </div>
          <p className="mt-2 px-2 text-[10px] text-deep/45">
            A gentle map of the places carrying your reflection — circles you've joined, your home, and nearby jamatkhanas.
          </p>
        </section>

        <section className="mt-6 px-5">
          <div className="grid grid-cols-2 gap-3">
            <StatTile icon={Flame} label="Tasbih streak" value={`${data?.tasbih_streak ?? 0}d`} sub={`${data?.tasbih_total ?? 0} total`} />
            <StatTile icon={Crown} label="Khidmah" value={`${data?.khidmah_points ?? 0}`} sub={data?.month || "this month"} />
            <StatTile icon={Users} label="Circles" value={`${(data?.memberships || []).length}`} sub="joined" />
            <StatTile icon={GraduationCap} label="Mentors" value={`${(data?.mentors || []).length}`} sub={`${data?.mentee_count ?? 0} mentees`} />
          </div>
        </section>

        {(data?.memberships || []).length > 0 && (
          <section className="mt-6 px-5">
            <h2 className="mb-3 font-display text-base text-deep">Cities of your circles</h2>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set((data?.memberships || []).map(m => `${m.community?.city || "Global"}|${m.community?.country || "Global"}`))).map((k) => {
                const [city, country] = k.split("|");
                return (
                  <span key={k} className="glass rounded-full px-3 py-1.5 text-[11px] text-deep shadow-soft">
                    <MapPin className="mr-1 inline h-3 w-3 text-gold" />{city}{country !== "Global" ? `, ${country}` : ""}
                  </span>
                );
              })}
            </div>
          </section>
        )}

        {(data?.mentors || []).length > 0 && (
          <section className="mt-6 px-5">
            <h2 className="mb-3 font-display text-base text-deep">Mentor connections</h2>
            <div className="space-y-2.5">
              {data.mentors.map((m, i) => (
                <div key={m.user_id || i} className="glass flex items-center gap-3 rounded-2xl p-3.5 shadow-soft">
                  <div className="bg-gold-gradient flex h-9 w-9 items-center justify-center rounded-full">
                    <GraduationCap className="h-4 w-4 text-deep" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-deep">{m.name || "Mentor"}</p>
                    <p className="text-[11px] text-deep/55">{m.headline || m.city || ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 px-5 pb-8">
          {!homeCity && !loading && (
            <div className="glass rounded-2xl p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="bg-gold-gradient flex h-9 w-9 items-center justify-center rounded-full">
                  <Building2 className="h-4 w-4 text-deep" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-deep">Set your home city</p>
                  <p className="text-[11px] text-deep/55">Open the Jamatkhana finder to set a home, or update your city in onboarding.</p>
                  <Link to="/jamatkhana" data-testid="sangat-set-home" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-gold">
                    <Sparkles className="h-3 w-3" /> Find your jamatkhana
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </MobileShell>
  );
}

function StatTile({ icon: Icon, label, value, sub }) {
  return (
    <div className="glass rounded-2xl p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <div className="bg-emerald-gradient flex h-7 w-7 items-center justify-center rounded-full">
          <Icon className="h-3.5 w-3.5 text-gold" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">{label}</p>
      </div>
      <p className="mt-2 font-display text-2xl text-deep">{value}</p>
      <p className="text-[10px] text-deep/55">{sub}</p>
    </div>
  );
}
