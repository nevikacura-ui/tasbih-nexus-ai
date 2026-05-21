import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Building2, Trash2, BadgeCheck } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

const CATS = [
  { id: "spiritual", label: "Spiritual" },
  { id: "ecdc", label: "Family & ECDC" },
  { id: "empowerment", label: "Youth Empowerment" },
  { id: "social_work", label: "Social Work" },
  { id: "health", label: "Health & Wellbeing" },
  { id: "education", label: "Education" },
  { id: "other", label: "Other" },
];

export default function OrgProfilePage() {
  const navigate = useNavigate();
  const [role, setRole] = useState("member");
  const [form, setForm] = useState({
    name: "", tagline: "", description: "", category: "other",
    country: "", city: "", website: "", logo_url: "",
  });
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { (async () => {
    try {
      const r = await api.get("/orgs/me");
      setRole(r.data.role || "member");
      if (r.data.org_profile) {
        setForm({
          name: r.data.org_profile.name || "",
          tagline: r.data.org_profile.tagline || "",
          description: r.data.org_profile.description || "",
          category: r.data.org_profile.category || "other",
          country: r.data.org_profile.country || "",
          city: r.data.org_profile.city || "",
          website: r.data.org_profile.website || "",
          logo_url: r.data.org_profile.logo_url || "",
        });
        setVerified(Boolean(r.data.org_profile.verified));
      }
    } catch (e) {}
  })(); }, []);

  const save = async () => {
    if (form.name.trim().length < 3) { setMsg("Please enter a name (≥3 characters)."); return; }
    setSaving(true); setMsg("");
    try {
      await api.post("/orgs/me", form);
      setRole("org");
      setMsg("Saved · your organisation is live in the directory.");
      setTimeout(() => navigate("/orgs"), 800);
    } catch (e) {
      setMsg(e?.response?.data?.detail || "Could not save. Try again.");
    } finally { setSaving(false); }
  };

  const retire = async () => {
    if (!window.confirm("Retire your organisation profile? Your account will return to a regular member.")) return;
    await api.delete("/orgs/me");
    setRole("member"); setMsg("Profile retired."); setVerified(false);
  };

  return (
    <MobileShell>
      <div className="relative" data-testid="org-profile-page">
        <NoorBackdrop />
        <header className="flex items-center gap-3 px-5 pt-9">
          <Link to="/orgs" data-testid="orgme-back" className="glass flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
            <ChevronLeft className="h-4 w-4 text-deep" />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Organisation</p>
            <h1 className="font-display text-2xl text-deep">{role === "org" ? "Edit your organisation" : "Become an organisation"}</h1>
          </div>
          {verified && <BadgeCheck className="h-5 w-5 text-gold" />}
        </header>

        <section className="mt-4 px-5">
          <div className="glass rounded-2xl p-4 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="bg-gold-gradient flex h-9 w-9 items-center justify-center rounded-full">
                <Building2 className="h-4 w-4 text-deep" />
              </div>
              <p className="text-[11px] leading-relaxed text-deep/65">
                Organisations create <strong>official circles</strong>, post under their org name,
                and appear in the public directory. Verification is added manually by Tasbih.ai
                stewards once your details check out.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 space-y-3 px-5 pb-8">
          <Field label="Organisation name *" testid="org-name">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder="e.g. Aga Khan Youth Society" />
          </Field>
          <Field label="Tagline (max 140)">
            <input value={form.tagline} maxLength={140} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className={input} placeholder="One line about your work" />
          </Field>
          <Field label="Description">
            <textarea value={form.description} maxLength={1500} rows={4} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input + " resize-none"} placeholder="What you do, who you serve, where you operate." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Country">
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={input} placeholder="Canada" />
            </Field>
            <Field label="City">
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={input} placeholder="Toronto" />
            </Field>
          </div>
          <Field label="Category">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={input + " bg-white/60"}>
              {CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Website">
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={input} placeholder="https://yourorg.org" />
          </Field>
          <Field label="Logo URL (optional)">
            <input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} className={input} placeholder="https://…/logo.png" />
          </Field>

          {msg && <p className="text-center text-[11px] text-deep/65">{msg}</p>}

          <button
            data-testid="org-save"
            onClick={save}
            disabled={saving}
            className="bg-emerald-gradient text-ivory shadow-elegant flex w-full items-center justify-center rounded-full py-3 text-sm font-medium tap-scale disabled:opacity-50"
          >
            {saving ? "Saving…" : role === "org" ? "Save changes" : "Become an organisation"}
          </button>

          {role === "org" && (
            <button
              data-testid="org-retire"
              onClick={retire}
              className="glass flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-xs text-deep/65 shadow-soft"
            >
              <Trash2 className="h-3.5 w-3.5" /> Retire profile
            </button>
          )}
        </section>
      </div>
    </MobileShell>
  );
}

const input = "w-full rounded-2xl border border-deep/10 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold";

function Field({ label, children, testid }) {
  return (
    <label data-testid={testid} className="block">
      <span className="text-[10px] uppercase tracking-[0.18em] text-deep/45">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
