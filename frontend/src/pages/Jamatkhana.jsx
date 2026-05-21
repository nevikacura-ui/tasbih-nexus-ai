import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Compass, Search, ExternalLink } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

export default function JamatkhanaPage() {
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState("");
  const [cities, setCities] = useState([]);
  const [city, setCity] = useState("");
  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");
  const [locating, setLocating] = useState(false);
  const [nearby, setNearby] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try { const r = await api.get("/jamatkhanas/countries"); setCountries(r.data.countries || []); } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    if (!country) { setCities([]); setCity(""); return; }
    (async () => {
      try {
        const r = await api.get("/jamatkhanas/cities", { params: { country } });
        setCities(r.data.cities || []);
      } catch (e) {}
    })();
  }, [country]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const params = {};
        if (country) params.country = country;
        if (city) params.city = city;
        if (q) params.q = q;
        // Retry once if axios fires before guest auth lands
        let r;
        try { r = await api.get("/jamatkhanas", { params }); }
        catch { await new Promise(res => setTimeout(res, 600)); r = await api.get("/jamatkhanas", { params }); }
        if (alive) setItems(r.data.jamatkhanas || []);
      } catch (e) { /* keep previous list */ }
    })();
    return () => { alive = false; };
  }, [country, city, q]);

  const findNearMe = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await api.get("/jamatkhanas/nearby", { params: { lat: pos.coords.latitude, lng: pos.coords.longitude, limit: 5 } });
          setNearby(r.data.nearby || []);
        } catch (e) { setError("Couldn't fetch nearby jamatkhanas."); }
        finally { setLocating(false); }
      },
      (err) => {
        setLocating(false);
        setError(err.code === 1 ? "Location permission was denied. You can still browse by country or search below." : "Couldn't read your location. Try search below.");
      },
      { timeout: 10000 }
    );
  };

  const mapsLink = (j) => `https://maps.google.com/?q=${encodeURIComponent((j.name + " " + (j.address || j.city) + " " + j.country))}`;

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[480px]" data-testid="jamatkhana-page">
      <NoorBackdrop />
      <header className="flex items-center gap-3 px-5 pt-9">
        <Link to="/profile" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
          <ArrowLeft className="h-4 w-4 text-deep" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Find your</p>
          <h1 className="font-display text-2xl text-deep">Jamatkhana</h1>
        </div>
      </header>

      <section className="mt-5 px-5">
        <button
          data-testid="locate-me"
          onClick={findNearMe}
          disabled={locating}
          className="bg-emerald-gradient text-ivory shadow-elegant flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium tap-scale disabled:opacity-60"
        >
          <Compass className="h-4 w-4" /> {locating ? "Finding you…" : "Use my current location"}
        </button>
        {error && <p data-testid="locate-error" className="mt-2 text-[11px] text-deep/60">{error}</p>}
      </section>

      {nearby && (
        <section className="mt-5 px-5">
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-deep/45">Nearest to you</p>
          <div className="space-y-2.5">
            {nearby.map((j) => <JKCard key={j.jk_id} j={j} mapsLink={mapsLink} highlight />)}
          </div>
        </section>
      )}

      <section className="mt-6 px-5">
        <div className="glass flex items-center gap-2 rounded-full px-4 py-2.5 shadow-soft">
          <Search className="h-4 w-4 text-deep/55" />
          <input
            data-testid="jk-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search jamatkhana, city, country"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-deep/45"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <select
            data-testid="jk-country"
            value={country}
            onChange={(e) => { setCountry(e.target.value); setCity(""); }}
            className="flex-1 rounded-full border border-deep/15 bg-white/60 px-3 py-2 text-xs text-deep outline-none"
          >
            <option value="">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            data-testid="jk-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="flex-1 rounded-full border border-deep/15 bg-white/60 px-3 py-2 text-xs text-deep outline-none"
            disabled={!country}
          >
            <option value="">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </section>

      <section className="mt-5 space-y-2.5 px-5 pb-10">
        {items === null ? (
          <p className="text-center text-[11px] text-deep/55">Loading jamatkhanas…</p>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.18em] text-deep/45">
              {items.length} jamatkhana{items.length === 1 ? "" : "s"}
            </p>
            {items.length === 0 && (
              <div className="glass rounded-2xl p-5 text-center text-xs text-deep/55 shadow-soft">
                No jamatkhanas match these filters yet. Try clearing the search.
              </div>
            )}
            {items.map((j) => <JKCard key={j.jk_id} j={j} mapsLink={mapsLink} />)}
          </>
        )}
      </section>
    </div>
  );
}

function JKCard({ j, mapsLink, highlight = false }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-4 shadow-soft ${highlight ? "bg-emerald-gradient text-ivory" : "glass text-deep"}`} data-testid={`jk-${j.jk_id}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${highlight ? "bg-ivory/15" : "bg-gold-gradient"}`}>
        <MapPin className={`h-4 w-4 ${highlight ? "text-gold" : "text-deep"}`} />
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${highlight ? "text-ivory" : "text-deep"}`}>{j.name}</p>
        <p className={`text-[11px] ${highlight ? "text-ivory/75" : "text-deep/55"}`}>
          {j.city} · {j.country}{j.distance_km != null ? ` · ${j.distance_km} km` : ""}
        </p>
        {j.address && <p className={`mt-0.5 text-[10px] ${highlight ? "text-ivory/55" : "text-deep/45"}`}>{j.address}</p>}
      </div>
      <a href={mapsLink(j)} target="_blank" rel="noreferrer" aria-label="Open in Maps" className={`tap-scale ${highlight ? "text-ivory" : "text-deep/55"}`}>
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
