import React from "react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
          <div className="w-16 h-16 rounded-full border-2 border-t-cyan-400 border-r-cyan-400 border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="font-mono text-sm text-cyan-300 animate-pulse tracking-wide">
          Initializing NexusGraph Engine...
        </p>
      </div>
    </div>
  );
}
