import Link from "next/link";

const workflow = [
  {
    step: "Upload",
    title: "Start with the resume you have",
    description: "A private PDF becomes a structured profile—not another form to fill out.",
  },
  {
    step: "Review",
    title: "Keep the facts in your hands",
    description: "Correct the read and approve the exact profile used for matching.",
  },
  {
    step: "Match",
    title: "See the evidence, not a mystery score",
    description: "Hard constraints come first. Every strong result shows why it earned its place.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="landing-shell">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="hero-copy">
          <p className="signal-label">
            <span className="signal-dot" aria-hidden="true" />
            Resume-to-job intelligence
          </p>
          <h1 id="landing-title">Your experience already knows where it belongs.</h1>
          <p className="hero-lede">
            ResuLens reads your resume, lets you correct the profile, and ranks relevant work with
            reasons you can inspect.
          </p>
          <div className="hero-actions">
            <Link href="/sign-up" className="button-primary">
              Start With Your Resume
            </Link>
            <Link href="/sign-in" className="button-secondary">
              Sign In
            </Link>
          </div>
          <p className="trust-line">Private upload · Review before matching · Delete any time</p>
        </div>

        <div className="lens-field" aria-label="Example resume analysis and job match">
          <div className="lens-grid" aria-hidden="true" />
          <div className="lens-toolbar">
            <span>Analysis 01</span>
            <span className="lens-live">
              <i />
              Ready
            </span>
          </div>
          <div className="lens-content">
            <article className="resume-sheet">
              <div className="resume-sheet-head">
                <span className="resume-avatar">SK</span>
                <div>
                  <strong>Software Engineer</strong>
                  <span>Product systems · 5 years</span>
                </div>
              </div>
              <div className="resume-evidence">
                <span className="evidence-line evidence-line-long" />
                <span className="evidence-line" />
                <span className="evidence-line evidence-line-short" />
                <em>TypeScript</em>
                <em>Product delivery</em>
              </div>
              <p>Evidence found on pages 1–2</p>
            </article>

            <div className="match-arrow" aria-hidden="true">
              →
            </div>

            <article className="match-sheet">
              <div className="match-score">
                <strong>87</strong>
                <span>ResuLens match score</span>
              </div>
              <div>
                <p>Product Software Engineer</p>
                <span>Remote · India</span>
              </div>
              <ul>
                <li>
                  <span>Semantic fit</span>
                  <strong>92%</strong>
                </li>
                <li>
                  <span>Skills</span>
                  <strong>86%</strong>
                </li>
                <li>
                  <span>Role &amp; level</span>
                  <strong>82%</strong>
                </li>
              </ul>
            </article>
          </div>
          <p className="lens-caption">One approved profile. Ranked work with a traceable reason.</p>
        </div>
      </section>

      <section className="workflow-band" aria-labelledby="workflow-title">
        <div className="section-heading">
          <h2 id="workflow-title">A shorter path from PDF to shortlist.</h2>
          <p>The system does the parsing. You keep the judgment.</p>
        </div>
        <div className="workflow-grid">
          {workflow.map((item) => (
            <article key={item.step} className="workflow-item">
              <span>{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="privacy-band" aria-labelledby="privacy-title">
        <div>
          <p className="signal-label">Designed around applicant privacy</p>
          <h2 id="privacy-title">Your profile stays reviewable. Your score stays explainable.</h2>
        </div>
        <Link href="/sign-up" className="button-primary">
          Create Your Private Workspace
        </Link>
      </section>
    </div>
  );
}
