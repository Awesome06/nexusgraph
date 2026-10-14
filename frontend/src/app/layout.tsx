import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexusGraph — Autonomous Engineering Brain & Incident Remediation Swarm",
  description: "Autonomous multi-agent system powered by FalkorDB for connected incident remediation, ADR governance, and cross-session memory.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#080b11] text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
