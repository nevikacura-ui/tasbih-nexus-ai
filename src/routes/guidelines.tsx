import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { NoorBackdrop } from "@/components/NoorBackdrop";
import { ShieldCheck, Heart, MessageSquareWarning, Flag, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/guidelines")({
  head: () => ({
    meta: [
      { title: "Community Guidelines — Tasbih.ai" },
      { name: "description", content: "How we keep Tasbih.ai a calm, safe, and respectful spiritual community." },
    ],
  }),
  component: GuidelinesPage,
});

const pillars = [
  {
    icon: Heart,
    title: "Lead with Adab",
    body: "Speak with the courtesy you would in a majlis. No insults, slurs, or contempt — even in disagreement.",
  },
  {
    icon: ShieldCheck,
    title: "Protect each other",
    body: "No harassment, hate, doxxing, or content that endangers anyone's safety, dignity, or privacy.",
  },
  {
    icon: MessageSquareWarning,
    title: "Be truthful",
    body: "No impersonation, deceptive claims, spam, or misuse of mentorship and referral trust.",
  },
];

const notAllowed = [
  "Harassment, threats, or targeted abuse",
  "Hate speech against any people, faith, or community",
  "Sexual content, exploitation, or content harmful to minors",
  "Self-harm encouragement or graphic violence",
  "Misinformation about Islam, health, or current events",
  "Spam, scams, MLM, or unwanted commercial messages",
  "Impersonation of mentors, scholars, or other members",
  "Sharing private information without clear consent",
];

function GuidelinesPage() {
  return (
    <MobileShell>
      <div className="relative">
        <NoorBackdrop />
        <header className="px-5 pt-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Safety</p>
          <h1 className="mt-1 font-display text-2xl text-foreground">Community Guidelines</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Tasbih.ai is a trust-based circle. These guidelines help us stay calm,
            respectful, and spiritually safe for everyone — youth, families, and mentors.
          </p>
        </header>

        <section className="mt-6 space-y-3 px-5">
          {pillars.map((p) => (
            <div key={p.title} className="glass flex items-start gap-3 rounded-2xl p-4 shadow-soft">
              <div className="bg-emerald-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                <p.icon className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{p.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-base text-foreground">What's not allowed</h2>
          <div className="glass rounded-2xl p-4 shadow-soft">
            <ul className="space-y-2">
              {notAllowed.map((x) => (
                <li key={x} className="flex gap-2 text-xs leading-relaxed text-foreground/85">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-7 px-5">
          <h2 className="mb-3 font-display text-base text-foreground">How moderation works</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Trained moderators review every report privately. Outcomes can include a quiet
            warning, hiding content, removing it, or — in severe cases — ending someone's
            access. We never share who reported what.
          </p>
        </section>

        <section className="mt-7 px-5 pb-4">
          <Link
            to="/report"
            search={{ type: "user", id: "" }}
            className="glass flex items-center gap-3 rounded-2xl p-4 shadow-soft transition-transform active:scale-[0.98]"
          >
            <div className="bg-gold-gradient flex h-10 w-10 items-center justify-center rounded-full">
              <Flag className="h-4 w-4 text-deep" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Report something</p>
              <p className="text-[11px] text-muted-foreground">Confidential. Reviewed by moderators.</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </section>
      </div>
    </MobileShell>
  );
}
