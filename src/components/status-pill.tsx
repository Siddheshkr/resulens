type StatusPillProps = {
  status: string;
  label?: string;
  className?: string;
};

export function StatusPill({ status, label, className = "" }: StatusPillProps) {
  const isApproved = status === "approved";
  const isFailed = status === "failed" || status === "delete_failed";
  const displayText = label ?? status.replaceAll("_", " ");

  const variantClass = isApproved
    ? "status-pill-success"
    : isFailed
      ? "status-pill-danger"
      : "";

  return (
    <span className={`status-pill ${variantClass} ${className}`.trim()}>
      <span className="status-pill-indicator" aria-hidden="true" />
      <span>{displayText}</span>
    </span>
  );
}
