import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Heart, Clock } from "lucide-react";
import MobileShell from "../components/MobileShell";
import { NoorBackdrop } from "../components/NoorBackdrop";
import { api } from "../lib/api";

export default function FamilyCornerPage() {
  const [stage, setStage] = useState("");
  const [data, setData] = useState({ prompts: [], stages: [], credit: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    setLoading(true);
    try {
      const params = stage ? { stage } : {};
      const r = await api.get("/family-corner", { params });
      setData(r.data || { prompts: [], stages: [], credit: "" });
    } catch (e) {} finally { setLoading(false); }
  })(); }, [stage]);

  return (
    <MobileShell>
      <div className="relative" data-testid="family-page">
        <NoorBackdrop />
        <header className="flex items-center gap-3 px-5 pt-9">
          <Link to="/profile" data-testid="family-back" className="glass flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
            <ChevronLeft className="h-4 w-4 text-deep" />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Parenting · gently</p>
            <h1 className="font-display text-2xl text-deep">Family Corner</h1>
          </div>
        </header>

        <section className="mt-4 px-5">
          <div className="glass rounded-2xl p-4 shadow-soft">
            <p className="text-[11px] leading-relaxed text-deep/65">
              Tiny, doable invitations to be present with your children. Not advice, not rules — soft prompts you can try today, and revisit when the child changes stage.
            </p>
          </div>
        </section>

        <section className="mt-4 px-5">
          <div className="-mx-5 flex gap-2 overflow-x-auto no-scrollbar px-5 pb-1">
            <button
              data-testid="family-stage-all"
              onClick={() => setStage("")}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] tap-scale ${
                stage === "" ? "bg-emerald-gradient text-ivory shadow-soft" : "glass text-deep"
              }`}
            >All stages</button>
            {(data.stages || []).map((s) => (
              <button
                key={s.id}
                data-testid={`family-stage-${s.id}`}
                onClick={() => setStage(s.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] tap-scale ${
                  stage === s.id ? "bg-emerald-gradient text-ivory shadow-soft" : "glass text-deep"
                }`}
              >{s.label}</button>
            ))}
          </div>
        </section>

        <section className="mt-5 space-y-3 px-5 pb-10">
          {loading && <p className="text-xs text-deep/55">Loading…</p>}
          {!loading && (data.prompts || []).length === 0 && <p className="text-xs text-deep/55">No prompts for this stage yet.</p>}
          {(data.prompts || []).map((p) => (
            <article key={p.id} data-testid={`family-card-${p.id}`} className="glass rounded-2xl p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="bg-gold-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <Heart className="h-4 w-4 text-deep" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{p.stage_label}</p>
                    {p.duration_min > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sand/60 px-2 py-0.5 text-[10px] text-deep/65">
                        <Clock className="h-3 w-3" /> {p.duration_min} min
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-display text-base text-deep">{p.title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-deep/75">{p.prompt}</p>
                </div>
              </div>
            </article>
          ))}
          {data.credit && (
            <p className="mt-6 px-2 text-center text-[10px] leading-relaxed text-deep/45" data-testid="family-credit">
              {data.credit}
              <br />Tasbih.ai is not a clinical authority. For health, behavioural or developmental concerns, please consult a qualified professional.
            </p>
          )}
        </section>
      </div>
    </MobileShell>
  );
}
