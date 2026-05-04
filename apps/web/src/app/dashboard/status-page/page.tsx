"use client";

export default function StatusPageSettings() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-slate-400 mb-2 font-mono text-sm">
            <span>Settings</span>
            <span className="text-xs">/</span>
            <span className="text-slate-200">Status Page</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-100 mb-1">Status Page</h1>
          <p className="text-sm text-slate-400">Configure your public status page</p>
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-800 p-12 rounded-xl text-center mt-8 shadow-sm">
        <p className="text-slate-200 font-medium">Status page configuration coming in Phase 4.</p>
        <p className="text-sm text-slate-500 mt-2">Your public status page is available at <code className="font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">/status/[project-slug]</code></p>
      </div>
    </div>
  );
}
