"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type GlobalErrorProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const router = useRouter();

  useEffect(() => {
    console.error("Application global error", error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>MMG Stellar</title>
      </head>
      <body style={{ margin: 0, background: "#0c0a09", color: "#fafaf9", fontFamily: "'Avenir Next', 'Segoe UI', sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "radial-gradient(circle at top, rgba(245, 158, 11, 0.12), transparent 30%)" }}>
          <section role="alert" style={{ width: "100%", maxWidth: "620px", boxSizing: "border-box", padding: "48px 32px", border: "1px solid rgba(252, 211, 77, 0.25)", borderRadius: "32px", background: "rgba(28, 25, 23, 0.9)", textAlign: "center" }}>
            <div aria-hidden="true" style={{ width: "72px", height: "72px", margin: "0 auto", display: "grid", placeItems: "center", border: "1px solid rgba(252, 211, 77, 0.35)", borderRadius: "999px", color: "#fde68a", fontSize: "36px" }}>!</div>
            <p style={{ margin: "24px 0 0", color: "#fcd34d", fontSize: "12px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>MMG Stellar</p>
            <h1 style={{ margin: "12px 0 0", fontFamily: "Georgia, serif", fontSize: "42px", fontWeight: 400 }}>We hit a small snag.</h1>
            <p style={{ maxWidth: "480px", margin: "16px auto 0", color: "#d6d3d1", lineHeight: 1.6 }}>The site could not load right now. Please try again, or return to the home page.</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px", marginTop: "32px" }}>
              <button type="button" onClick={() => reset()} style={{ cursor: "pointer", border: 0, borderRadius: "999px", padding: "12px 20px", background: "#f59e0b", color: "#1c1917", fontWeight: 700 }}>Try again</button>
              <button type="button" onClick={() => router.push("/")} style={{ cursor: "pointer", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "999px", padding: "11px 20px", background: "transparent", color: "#fafaf9", fontWeight: 700 }}>Go to home</button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
