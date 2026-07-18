"use client";

import { useEffect, useRef } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reported = useRef(false);

  useEffect(() => {
    console.error(error);
    if (reported.current) return;
    reported.current = true;
    fetch("/api/log-error", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p
            style={{
              fontSize: "3rem",
              fontWeight: 800,
              color: "#dc2626",
              margin: 0,
            }}
          >
            Oops!
          </p>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginTop: "1rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              marginTop: "0.5rem",
              color: "#64748b",
              fontSize: "0.875rem",
              maxWidth: "28rem",
            }}
          >
            A critical error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.25rem",
              background: "#16A34A",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
