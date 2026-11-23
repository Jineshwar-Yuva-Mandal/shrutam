import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, BookOpen, CalendarDays, ClipboardCheck, UsersRound } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Shrutam | Paathshala, connected",
  description: "A shared online home for paathshala learning, classes, attendance, and community.",
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/spaces");
  }

  return <main className="landing-page" id="top">
    <header className="landing-header">
      <div className="landing-header-inner">
        <Link href="/" className="landing-brand" aria-label="Shrutam home"><BrandLogo variant="complete" className="landing-brand-logo" priority /></Link>
        <div className="landing-header-actions">
          <Link className="landing-button landing-button-small" href="/signup">Get started <ArrowRight size={15} /></Link>
        </div>
      </div>
    </header>

    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-inner">
        <div className="landing-hero-copy">
          <p className="landing-kicker">A JYM-Digital initiative · Rajajinagar</p>
          <h1 id="landing-title">Shrutam</h1>
          <p className="landing-hero-heading">A shared home for paathshala learning.</p>
          <p className="landing-hero-description">Bring students, teachers, classes, courses, and attendance together in one welcoming space, shaped around the way our community learns.</p>
          <div className="landing-hero-actions">
            <Link className="landing-button" href="/signup">Join your paathshala <ArrowRight size={16} /></Link>
            <a className="landing-text-link" href="#platform">Explore Shrutam <ArrowDown size={15} /></a>
          </div>
        </div>

        <div className="landing-hero-panel" aria-label="Learning in community">
          <div className="landing-panel-top"><span>JINESHWAR YUVA MANDAL</span><span>01 — 03</span></div>
          <p className="landing-panel-label">Learning in community</p>
          <p className="landing-panel-statement">Dharma.<br />Seva.<br /><span>Learning.</span></p>
          <div className="landing-panel-bottom"><span>Preserving values</span><span>Connecting communities</span></div>
        </div>
      </div>
    </section>

    <section className="landing-platform" id="platform" aria-labelledby="platform-title">
      <div className="landing-section-heading">
        <p className="landing-kicker">Made for paathshalas</p>
        <h2 id="platform-title">The work of learning,<br />all in one place.</h2>
        <p>Less time finding information. More time learning, teaching, and showing up for one another.</p>
      </div>
      <div className="landing-features">
        <article className="landing-feature">
          <span className="landing-feature-number">01</span>
          <BookOpen size={22} strokeWidth={1.6} />
          <h3>Learn together</h3>
          <p>See your paathshala classes, schedules, and course paths in one clear view.</p>
        </article>
        <article className="landing-feature">
          <span className="landing-feature-number">02</span>
          <ClipboardCheck size={22} strokeWidth={1.6} />
          <h3>Keep a steady rhythm</h3>
          <p>Teachers can manage student access, class rosters, and attendance history.</p>
        </article>
        <article className="landing-feature">
          <span className="landing-feature-number">03</span>
          <CalendarDays size={22} strokeWidth={1.6} />
          <h3>Stay connected</h3>
          <p>Keep community events and paathshala updates close to the learning they support.</p>
        </article>
      </div>
    </section>

    <section className="landing-community" id="community" aria-labelledby="community-title">
      <div className="landing-community-inner">
        <div>
          <p className="landing-kicker">Rooted in Jineshwar Yuva Mandal</p>
          <h2 id="community-title">Tradition carried forward.<br />Community brought closer.</h2>
        </div>
        <div className="landing-community-copy">
          <p>Jineshwar Yuva Mandal is the youth wing of Shri Vardhaman Sthanakwasi Jain Shravak Sangh, Rajajinagar. Its spirit of learning, seva, and shared responsibility inspires Shrutam.</p>
          <p>Through JYM-Digital, everyday paathshala coordination is moving online, while the heart of it stays human: students learning, teachers guiding, and a community growing together.</p>
        </div>
      </div>
      <div className="landing-motto"><span>Jaha seva, waha samarpan.</span><span>Where there is seva, there is dedication.</span><UsersRound size={20} /></div>
    </section>

    <section className="landing-cta" aria-labelledby="landing-cta-title">
      <div>
        <p className="landing-kicker">Your paathshala is here</p>
        <h2 id="landing-cta-title">Learning grows when we do it together.</h2>
      </div>
      <div className="landing-cta-actions">
        <Link className="landing-button" href="/signup">Create your account <ArrowRight size={16} /></Link>
        <Link className="landing-text-link" href="/login">Already have an account? Sign in</Link>
      </div>
    </section>

    <footer className="landing-footer">
      <Link href="/" className="landing-footer-brand" aria-label="Shrutam home"><BrandLogo variant="complete" className="landing-footer-logo" /></Link>
      <p>By JYM-Digital · Jineshwar Yuva Mandal, Rajajinagar</p>
    </footer>
  </main>;
}