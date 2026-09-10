"use client";

import Link from "next/link";
import { useState } from "react";

export function OnboardingPanel({ hasResume }: { hasResume: boolean }) {
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!visible) return null;

  async function finish() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ onboardingComplete: true }),
      });
      if (!response.ok) throw new Error("save failed");
      setVisible(false);
    } catch {
      setMessage("The guide could not be dismissed. Try again.");
      setBusy(false);
    }
  }

  return (
    <section className="onboarding-panel" aria-labelledby="onboarding-title">
      <div>
        <p className="eyebrow">Start here</p>
        <h2 id="onboarding-title">Your first useful match in three checks.</h2>
      </div>
      <ol className="onboarding-steps">
        <li className={hasResume ? "is-complete" : ""}>
          <span aria-hidden="true">01</span>
          <div>
            <strong>Upload a private PDF</strong>
            <small>5 MB and five pages maximum.</small>
          </div>
        </li>
        <li>
          <span aria-hidden="true">02</span>
          <div>
            <strong>Review every extracted fact</strong>
            <small>You approve what matching can use.</small>
          </div>
        </li>
        <li>
          <span aria-hidden="true">03</span>
          <div>
            <strong>Generate explainable matches</strong>
            <small>Hard constraints apply before ranking.</small>
          </div>
        </li>
      </ol>
      <div className="onboarding-actions">
        <Link className="button-secondary" href="/dashboard/settings">
          Set privacy preference
        </Link>
        <button className="text-button" type="button" disabled={busy} onClick={() => void finish()}>
          {busy ? "Saving…" : "Dismiss Guide"}
        </button>
      </div>
      {message ? (
        <p className="form-error" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
