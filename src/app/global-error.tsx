"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="product-page" id="main-content">
          <section className="empty-state" role="alert">
            <p className="eyebrow">ResuLens recovery</p>
            <h1>Something interrupted this view.</h1>
            <p>
              Your private data was not included in the error report. Try loading the page again.
            </p>
            <button className="button-primary" type="button" onClick={reset}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
