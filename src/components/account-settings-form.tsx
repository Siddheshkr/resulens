"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { RawFileRetentionPolicy } from "@/lib/accounts/requests";

type Props = {
  initialPolicy: RawFileRetentionPolicy;
};

const policies: Array<{
  value: RawFileRetentionPolicy;
  title: string;
  description: string;
}> = [
  {
    value: "delete_after_approval",
    title: "Delete after approval",
    description: "Remove the original PDF as soon as your reviewed profile is approved.",
  },
  {
    value: "retain_30_days",
    title: "Keep for 30 days",
    description: "Keep the private PDF for recovery, then delete it automatically after 30 days.",
  },
];

export function AccountSettingsForm({ initialPolicy }: Props) {
  const router = useRouter();
  const [policy, setPolicy] = useState(initialPolicy);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function savePolicy(nextPolicy: RawFileRetentionPolicy) {
    const previous = policy;
    setPolicy(nextPolicy);
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawFileRetentionPolicy: nextPolicy }),
      });
      if (!response.ok) throw new Error("save failed");
      setMessage("Raw-file retention preference saved.");
    } catch {
      setPolicy(previous);
      setMessage("The retention preference could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok && response.status !== 202) {
        throw new Error(payload.error ?? "Account deletion could not be started.");
      }
      router.replace("/sign-in?account_deleted=1");
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Account deletion could not be started.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="settings-stack">
      <section className="settings-panel" aria-labelledby="retention-title">
        <p className="eyebrow">Privacy control</p>
        <h2 id="retention-title">Original PDF retention</h2>
        <p className="settings-copy">
          This controls only the uploaded PDF. Your approved, editable profile remains available for
          matching until you delete the resume or your ResuLens account.
        </p>
        <fieldset className="retention-options" disabled={busy}>
          <legend className="sr-only">Choose original PDF retention</legend>
          {policies.map((item) => (
            <label className="retention-option" key={item.value}>
              <input
                type="radio"
                name="raw-file-retention"
                value={item.value}
                checked={policy === item.value}
                onChange={() => void savePolicy(item.value)}
              />
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {message ? (
          <p className="form-message" role="status" aria-live="polite">
            {message}
          </p>
        ) : null}
      </section>

      <section className="settings-panel danger-panel" aria-labelledby="delete-account-title">
        <p className="eyebrow">Danger zone</p>
        <h2 id="delete-account-title">Delete account and applicant data</h2>
        <p className="settings-copy">
          This blocks new work, revokes your sessions, and removes private PDFs, extracted profile
          versions, embeddings, matches, actions, and preferences. Cleanup retries safely if a
          provider is temporarily unavailable.
        </p>
        <label className="field-label" htmlFor="delete-confirmation">
          Type <strong>DELETE</strong> to confirm
        </label>
        <div className="delete-account-controls">
          <input
            id="delete-confirmation"
            className="text-input"
            name="delete-confirmation"
            autoComplete="off"
            spellCheck={false}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <button
            className="button-secondary destructive-button"
            type="button"
            disabled={busy || confirmation !== "DELETE"}
            onClick={() => void deleteAccount()}
          >
            {busy ? "Deleting…" : "Delete My Account"}
          </button>
        </div>
        {deleteError ? (
          <p role="alert" className="form-error">
            {deleteError}
          </p>
        ) : null}
      </section>
    </div>
  );
}
