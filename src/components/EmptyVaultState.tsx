"use client";

import CsvImport from "./CsvImport";
import type { VaultItemData } from "@/lib/crypto";
import { heroActionCardClass } from "@/lib/ui";

export default function EmptyVaultState({
  onAddManual,
  onImport,
}: {
  onAddManual: () => void;
  onImport: (
    items: VaultItemData[],
  ) => Promise<{ succeeded: number; failed: number }>;
}) {
  return (
    <div className="flex flex-col items-center gap-8 py-16 text-center">
      <div className="animate-fade-in-up space-y-3">
        <div className="animate-pulse-glow mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-panel text-accent">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Your vault is empty
          </h2>
          <p className="mt-1 text-sm text-muted">
            Add your first password to get started.
          </p>
        </div>
      </div>

      <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onAddManual}
          className={`${heroActionCardClass} animate-fade-in-up [animation-delay:90ms]`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-accent transition-transform duration-200 group-hover:scale-110"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          <span className="text-sm font-semibold text-foreground">
            Add manually
          </span>
          <span className="text-xs text-muted">Enter one password at a time</span>
        </button>

        <CsvImport
          variant="hero"
          onImport={onImport}
          className="animate-fade-in-up [animation-delay:180ms]"
        />
      </div>
    </div>
  );
}
