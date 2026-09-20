import Image from "next/image";
import Link from "next/link";
import { Check, FileUp, ListChecks, Search, ShieldCheck } from "lucide-react";

import { LandingActions } from "@/components/landing-actions";
import { LandingHero } from "@/components/landing-hero";
import { ResuLensLogo } from "@/components/resulens-logo";
import "./landing.css";

const workflow = [
  {
    icon: FileUp,
    title: "Bring your resume",
    description:
      "Upload your PDF securely. ResuLens reads your skills, experience, and career history.",
  },
  {
    icon: ListChecks,
    title: "Make it your profile",
    description:
      "Check the extracted facts, correct anything missing, and tell us what you want next.",
  },
  {
    icon: Search,
    title: "Find your next opportunity",
    description:
      "Explore ranked roles. See the fit, understand the gaps, and save the ones worth a closer look.",
  },
] as const;

const questions = [
  {
    question: "Do I need to rewrite my resume?",
    answer:
      "No. Start with the PDF you already have. ResuLens extracts a structured profile for you to review and correct before matching.",
  },
  {
    question: "What does a match score mean?",
    answer:
      "It is a ranking of how well a role aligns with your approved profile and preferences. It is not an ATS score, a hiring probability, or an employer decision.",
  },
  {
    question: "Does ResuLens apply to jobs for me?",
    answer:
      "No. You decide which opportunities to pursue. Job listings link to their original source, where you can read the full posting and apply.",
  },
  {
    question: "Can I remove my data?",
    answer:
      "Yes. You can choose how long the original PDF is retained, delete individual resumes, or remove your account and its associated profile and matching data from Settings.",
  },
] as const;

export default function HomePage() {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return (
    <div className="landing-shell">
      <LandingHero clerkConfigured={clerkConfigured} />
      <div className="landing-assurance" aria-label="Your resume stays in your control">
        <span>
          <ShieldCheck size={18} aria-hidden="true" /> Private resume upload
        </span>
        <span>
          <Check size={17} aria-hidden="true" /> You approve the profile
        </span>
        <span>
          <Check size={17} aria-hidden="true" /> Every match has a reason
        </span>
      </div>

      <section className="landing-workflow" aria-labelledby="workflow-title">
        <div className="landing-heading">
          <h2 id="workflow-title">Your next move starts with what you know.</h2>
          <p>Less time repeating your experience. More time considering the right opportunities.</p>
        </div>
        <ol className="landing-steps">
          {workflow.map(({ icon: Icon, title, description }) => (
            <li key={title}>
              <span className="step-icon">
                <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-evidence" aria-labelledby="evidence-title">
        <div className="evidence-copy">
          <p className="section-caption">Understand the fit</p>
          <h2 id="evidence-title">A reason to look closer.</h2>
          <p>
            A job title tells only part of the story. See how the role connects to your experience
            before you invest your time.
          </p>
          <dl className="landing-reasons">
            <div>
              <dt>What lines up</dt>
              <dd>Skills and experience grounded in the profile you approved.</dd>
            </div>
            <div>
              <dt>What needs a look</dt>
              <dd>Missing requirements and unknown details, clearly separated.</dd>
            </div>
            <div>
              <dt>What matters to you</dt>
              <dd>Your location, workplace, and eligibility preferences come first.</dd>
            </div>
          </dl>
          <Link href="/dashboard/matches" className="landing-text-link">
            Explore your matches
          </Link>
        </div>
        <figure className="evidence-visual">
          <Image
            src="/images/landing/evidence-alignment-v2.png"
            alt="Abstract resume evidence aligned with a job brief"
            width={1672}
            height={941}
            sizes="(max-width: 767px) 100vw, 55vw"
          />
          <figcaption>Your experience, connected to the requirements.</figcaption>
        </figure>
      </section>

      <section className="landing-privacy" aria-labelledby="privacy-title">
        <div className="privacy-copy">
          <ShieldCheck size={26} strokeWidth={1.5} aria-hidden="true" />
          <h2 id="privacy-title">Your resume. Your say.</h2>
          <p>
            Your career history is personal. Review what gets extracted, choose how long your PDF
            stays, and delete your data when you’re ready.
          </p>
          <Link href="/dashboard/settings" className="landing-text-link">
            Manage your privacy
          </Link>
        </div>
        <Image
          className="privacy-visual"
          src="/images/landing/private-resume-v2.png"
          alt="A resume held inside a matte black archival sleeve"
          width={1254}
          height={1254}
          sizes="(max-width: 767px) 70vw, 28vw"
        />
      </section>

      <section className="landing-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">A few things worth knowing.</h2>
        <div>
          {questions.map(({ question, answer }) => (
            <details key={question}>
              <summary>
                {question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="landing-close" aria-labelledby="start-title">
        <h2 id="start-title">Put your experience to work.</h2>
        <p>Your next opportunity could start with the resume you already have.</p>
        {clerkConfigured ? (
          <LandingActions mode="privacy" />
        ) : (
          <Link href="/sign-up" className="button-primary">
            Start With Your Resume
          </Link>
        )}
      </section>

      <footer className="landing-footer">
        <Link href="/" className="site-brand" aria-label="ResuLens home">
          <ResuLensLogo />
          <span>ResuLens</span>
        </Link>
        <p>A more considered job search.</p>
        <nav aria-label="Footer navigation">
          <Link href="/dashboard">Workspace</Link>
          <Link href="/dashboard/jobs">Browse jobs</Link>
          <Link href="/dashboard/settings">Settings</Link>
        </nav>
      </footer>
    </div>
  );
}
