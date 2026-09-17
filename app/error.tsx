"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Fido workspace render error", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="error-page">
      <div className="error-card">
        <div className="error-logo">
          fido <span>LK</span>
        </div>
        <h1>We couldn’t open the workspace.</h1>
        <p>Your records were not changed. Try loading the workspace again.</p>
        <button className="primary" onClick={retry}>
          Try again
        </button>
      </div>
    </main>
  );
}
