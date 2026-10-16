"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("NexusGraph App Router Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900/90 border border-red-500/30 backdrop-blur-xl shadow-2xl text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">System Anomaly Detected</h2>
        <p className="text-sm text-slate-400">
          {error?.message || "An unexpected error occurred while rendering the graph workspace."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-all shadow-lg shadow-red-500/20"
        >
          <RefreshCw className="w-4 h-4" />
          Recover Workspace
        </button>
      </div>
    </div>
  );
}
