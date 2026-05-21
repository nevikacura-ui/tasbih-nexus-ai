import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";

export default function PrivacyPage() {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[480px]" data-testid="privacy-page">
      <NoorBackdrop />
      <header className="flex items-center gap-3 px-5 pt-9">
        <Link to="/profile" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
          <ArrowLeft className="h-4 w-4 text-deep" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Last updated · Feb 2026</p>
          <h1 className="font-display text-2xl text-deep">Privacy Policy</h1>
        </div>
      </header>

      <article className="prose mt-6 space-y-5 px-5 pb-10 text-sm leading-relaxed text-deep/85">
        <section>
          <h2 className="font-display text-lg text-deep">A short, plain-English version first</h2>
          <p>
            Tasbih.ai is a quiet companion for reflection. We collect only what's needed to make the app work — your name, email, phone (used for the WhatsApp OTP), city, and the things you actively log (tasbih, journal, mood, circles you join). We do not sell your data. We do not run advertising. We do not share what you write with other members beyond what you choose to share.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">What we collect</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Account basics:</strong> name, email, phone (for OTP and login), country/city, your two invitation codes.</li>
            <li><strong>Self-logged data:</strong> tasbih counts, journal entries, mood, mentorship preferences, khidmah hours.</li>
            <li><strong>Conversations:</strong> messages you post in community circles (visible to other circle members), private Noor AI conversations (visible only to you).</li>
            <li><strong>Device data:</strong> IP address (rotated, used only for abuse prevention), browser/OS type. No advertising identifiers.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">Who sees what</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Only you:</strong> journal entries, Noor AI conversations, Noor Digest, mood, tasbih, city geocoding.</li>
            <li><strong>Other circle members:</strong> messages you post in a circle, your name + first-letter avatar.</li>
            <li><strong>Tasbih.ai stewards (admins):</strong> reported messages, organisation verification requests.</li>
            <li><strong>Never anyone:</strong> your phone number is never shown publicly. Your email is never shown to other members.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">Third parties we send data to (and why)</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>MSG91</strong> — your phone number, to send the WhatsApp OTP at sign-up only.</li>
            <li><strong>Resend</strong> — recipient email + two codes, when you send an invite email.</li>
            <li><strong>Anthropic / OpenAI</strong> (via Emergent LLM) — the prompt you send to Noor AI. We do not include your name or contact info.</li>
            <li><strong>Google Geocoding</strong> — your city free-text (when you set it), to convert to lat/lng. No personal data.</li>
            <li><strong>OpenStreetMap / Leaflet</strong> — map tiles, no personal data sent.</li>
            <li><strong>alquran.cloud</strong> — Quran text fetches; no personal data sent.</li>
          </ul>
          <p className="mt-2 text-[12px] text-deep/65">No advertising networks. No analytics that build user profiles.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">Your rights</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Delete your account</strong> — email <a href="mailto:hello@tasbih.ai" className="text-gold">hello@tasbih.ai</a> with the subject "Delete my account". We erase your records within 14 days.</li>
            <li><strong>Export your data</strong> — same email, subject "Export my data". We send a JSON file within 14 days.</li>
            <li><strong>Correct your data</strong> — most fields are editable in-app (Profile · Onboarding · Sangat).</li>
            <li><strong>Stop emails</strong> — Resend respects unsubscribe headers. Or simply email us.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">Children</h2>
          <p>Tasbih.ai is built for adolescents and adults (13+). We do not knowingly collect data from children under 13. If you believe a younger child has signed up, please email us.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">A gentle note on Noor AI</h2>
          <p>Noor is an AI companion, not a religious authority. It is instructed never to issue rulings (fatwas), engage in sectarian debate, or replace a learned guide. Please always consult a trusted teacher or family elder for matters of faith.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">Changes to this policy</h2>
          <p>If we make material changes, we will notify you in-app and via email at least 14 days before they take effect.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">Contact</h2>
          <p>Questions? Please email <a href="mailto:hello@tasbih.ai" className="text-gold">hello@tasbih.ai</a>.</p>
        </section>

        <p className="pt-2 text-center text-[10px] uppercase tracking-[0.18em] text-deep/40">
          Independent · community-driven · non-authoritative
        </p>
      </article>
    </div>
  );
}
