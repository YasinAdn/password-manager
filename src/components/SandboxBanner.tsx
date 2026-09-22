"use client";

import React from "react";
import { ShieldAlert, Zap, RotateCcw } from "lucide-react";

interface SandboxBannerProps {
  onAutoFillDemo?: (email: string, pass: string) => void;
  className?: string;
}

export const SandboxBanner: React.FC<SandboxBannerProps> = ({
  onAutoFillDemo,
  className = "",
}) => {
  const handleResetSandbox = () => {
    if (typeof window === "undefined") return;
    if (confirm("Reset local sandbox storage to fresh state?")) {
      localStorage.removeItem("mynexvault_sandbox_mock_db_v1");
      localStorage.removeItem("mynexvault_totp_2fa_demo-user-123");
      window.location.reload();
    }
  };

  return (
    <div
      className={`w-full bg-gradient-to-r from-amber-950/40 via-background to-slate-900 border-b border-amber-800/40 px-4 py-2.5 text-xs text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <div>
          <strong className="font-semibold text-amber-300">Sandbox Mode Active:</strong>{" "}
          <span className="text-amber-200/80">
            Running 100% offline with in-browser Mock Supabase. No real backend required.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onAutoFillDemo && (
          <button
            type="button"
            onClick={() => onAutoFillDemo("demo@mynexvault.app", "password123")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors font-medium cursor-pointer"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Auto-fill Demo Account</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleResetSandbox}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-background hover:bg-panel text-muted hover:text-foreground border border-border text-[11px] transition-colors cursor-pointer"
          title="Reset sandbox database"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Sandbox</span>
        </button>
      </div>
    </div>
  );
};
