"use client";

import { useEffect } from "react";

// Root-layout error boundary. Fires when the layout itself throws (before
// any route can render) so it must render its own <html> and <body>. No
// access to our normal theme provider or fonts here — keep it minimal.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("global error", error);
  }, [error]);

  return (
    <html lang="zh-Hant">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          background: "#020617",
          color: "#e2e8f0",
          minHeight: "100dvh",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <p style={{ fontSize: "3rem", margin: 0 }}>🏐</p>
          <h1 style={{ fontSize: "1.25rem", margin: "0.75rem 0" }}>
            VolleyPal 遇到嚴重錯誤
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#94a3b8",
              lineHeight: 1.5,
            }}
          >
            請重新整理頁面。若持續發生,請通知賽事管理員。
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: "0.6875rem",
                color: "#64748b",
                fontFamily: "monospace",
                marginTop: "1rem",
              }}
            >
              {error.digest}
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1.25rem",
              background: "#f97316",
              color: "#020617",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            重新整理
          </button>
        </div>
      </body>
    </html>
  );
}
