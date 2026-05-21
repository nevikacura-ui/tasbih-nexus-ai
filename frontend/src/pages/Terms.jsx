import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { NoorBackdrop } from "../components/NoorBackdrop";

export default function TermsPage() {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[480px]" data-testid="terms-page">
      <NoorBackdrop />
      <header className="flex items-center gap-3 px-5 pt-9">
        <Link to="/profile" className="glass shadow-soft flex h-10 w-10 items-center justify-center rounded-full tap-scale">
          <ArrowLeft className="h-4 w-4 text-deep" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-deep/45">Last updated · Feb 2026</p>
          <h1 className="font-display text-2xl text-deep">Terms of Use</h1>
        </div>
      </header>

      <article className="prose mt-6 space-y-5 px-5 pb-10 text-sm leading-relaxed text-deep/85">
        <section>
          <h2 className="font-display text-lg text-deep">In short</h2>
          <p>Tasbih.ai is an invite-only, calm digital companion for reflection, dhikr and respectful community. By using the app, you agree to use it kindly. We can pause your account if you don't.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">1. Invitations</h2>
          <p>Access is by two invitation codes from two different members. Codes are personal. Don't share screenshots of codes publicly — they're meant for one person.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">2. Your conduct</h2>
          <p>By posting on Tasbih.ai you agree NOT to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Harass, threaten, or demean another member.</li>
            <li>Issue religious rulings or claim authority you do not hold.</li>
            <li>Engage in sectarian attacks or comparison.</li>
            <li>Share content that is hateful, sexual, violent, or commercial spam.</li>
            <li>Impersonate another person or an institution.</li>
            <li>Attempt to scrape, reverse-engineer or overload the service.</li>
          </ul>
          <p className="mt-2">Stewards may remove content or pause accounts that violate these rules. Severe or repeated violations may result in permanent removal.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">3. Noor AI is not religious authority</h2>
          <p>Noor is a calm AI companion. It is not a Pir, a Rais, a Mukhi-Kamadia, or any other authority. Please consult learned teachers, family elders or institutional guides for matters of faith. Tasbih.ai is an independent platform and is not affiliated with the Ismaili Imamat or any institution of the AKDN family of agencies.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">4. Organisation accounts</h2>
          <p>"Org" accounts may post under their organisation name and create official circles. The <strong>Verified ✓</strong> badge is granted manually by Tasbih.ai stewards only after a human check. We may unverify or remove orgs that misrepresent their work.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">5. Your content</h2>
          <p>You own everything you write. You grant Tasbih.ai a non-exclusive licence to display your messages to other members of circles you've joined, and to keep your journal/Noor AI conversations privately on our servers so you can return to them. We will not sell, license, or train external AI models on your private content.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">6. Service "as is"</h2>
          <p>Tasbih.ai is provided on an "as-is" basis. We do our best to keep it calm and stable, but we make no warranties of uptime or fitness for any particular purpose. To the maximum extent permitted by law, Tasbih.ai is not liable for indirect, incidental or consequential damages.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">7. Changes</h2>
          <p>If we change these terms in any material way, we will notify you in-app and via email at least 14 days beforehand. Continued use after the change means you accept the new terms.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">8. Governing law</h2>
          <p>These terms are governed by the laws applicable in the jurisdiction where Tasbih.ai is operated. Any disputes will be resolved in good faith first; if that fails, in the courts of that jurisdiction.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-deep">9. Contact</h2>
          <p>Questions, complaints, kindness? Please write to <a href="mailto:hello@tasbih.ai" className="text-gold">hello@tasbih.ai</a>.</p>
        </section>

        <p className="pt-2 text-center text-[10px] uppercase tracking-[0.18em] text-deep/40">
          Independent · community-driven · non-authoritative
        </p>
      </article>
    </div>
  );
}
