"use client";

import { useState, useRef, useEffect } from "react";

export default function CopyButton({
  value,
  label,
  autoClearSeconds = 60,
}: {
  value: string;
  label: string;
  autoClearSeconds?: number;
}) {
  const [copied, setCopied] = useState(false);
  const clearTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      // Security: Auto-clear clipboard for passwords after autoClearSeconds
      if (label.toLowerCase() === "password" && autoClearSeconds > 0) {
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);

        clearTimerRef.current = setTimeout(async () => {
          try {
            // Attempt to check if clipboard still holds the copied secret
            let canWipe = true;
            if (navigator.clipboard.readText) {
              try {
                const currentContent = await navigator.clipboard.readText();
                if (currentContent !== value) {
                  canWipe = false;
                }
              } catch {
                // If readText is blocked without gesture, do not wipe unknown user content
                canWipe = false;
              }
            }
            if (canWipe) {
              await navigator.clipboard.writeText("");
            }
          } catch {
            // Clipboard write might be restricted when window is inactive
          }
        }, autoClearSeconds * 1000);
      }
    } catch {
      // Clipboard API can fail (permissions, insecure context) -- not worth surfacing.
    }
  }

  const isPassword = label.toLowerCase() === "password";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
      title={
        isPassword
          ? `Copy ${label} (automatically clears in ${autoClearSeconds}s)`
          : `Copy ${label}`
      }
    >
      {copied ? (isPassword ? "Copied (60s)" : "Copied") : "Copy"}
    </button>
  );
}
