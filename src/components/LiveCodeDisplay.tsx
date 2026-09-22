"use client";

import React, { useState, useEffect } from "react";
import { getTotpCode, getSecondsRemaining, formatCodeDisplay } from "@/lib/totp";
import { Copy, Check, Clock, RefreshCw } from "lucide-react";

interface LiveCodeDisplayProps {
  secret: string;
  period?: number;
  label?: string;
  className?: string;
}

export const LiveCodeDisplay: React.FC<LiveCodeDisplayProps> = ({
  secret,
  period = 30,
  label = "Live 6-Digit TOTP Code",
  className = "",
}) => {
  const [code, setCode] = useState<string>("------");
  const [secondsLeft, setSecondsLeft] = useState<number>(period);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!secret) return;

    const updateTotp = () => {
      const currentCode = getTotpCode(secret);
      const remaining = getSecondsRemaining(period);
      setCode(currentCode);
      setSecondsLeft(remaining);
    };

    updateTotp();
    const interval = setInterval(updateTotp, 1000);
    return () => clearInterval(interval);
  }, [secret, period]);

  const handleCopyCode = async () => {
    if (!code || code === "------") return;
    const cleanCode = code.replace(/\s/g, "");
    try {
      await navigator.clipboard.writeText(cleanCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const formattedCode = formatCodeDisplay(code);
  const isWarning = secondsLeft <= 5;

  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (secondsLeft / period) * circumference;

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-panel p-5 border border-border shadow-lg transition-all duration-300 ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-background/60 px-2.5 py-1 rounded-full text-xs font-mono text-foreground border border-border">
          <RefreshCw className="w-3 h-3 animate-spin text-accent" style={{ animationDuration: "3s" }} />
          <span>Syncing Live</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
        {/* Monospace Code Display */}
        <button
          onClick={handleCopyCode}
          type="button"
          title="Click to copy code"
          className="group relative flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-background border border-border hover:border-accent/50 transition-all duration-200 cursor-pointer w-full sm:w-auto flex-1 active:scale-[0.99]"
        >
          <span className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-foreground drop-shadow-sm">
            {formattedCode}
          </span>
          <div className="flex items-center justify-center p-2 rounded-lg bg-panel group-hover:bg-accent/20 text-muted group-hover:text-foreground transition-colors ml-auto sm:ml-2">
            {copied ? (
              <Check className="w-5 h-5 text-accent animate-bounce" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </div>
          {copied && (
            <span className="absolute -top-3 right-3 bg-accent text-background font-sans text-[11px] font-bold px-2 py-0.5 rounded-full shadow-md">
              Copied!
            </span>
          )}
        </button>

        {/* Circular SVG Countdown Ring */}
        <div className="flex items-center gap-3">
          <div className="relative w-14 h-14 flex items-center justify-center">
            <svg className="w-14 h-14 transform -rotate-90">
              <circle
                cx="28"
                cy="28"
                r={radius}
                className="stroke-border"
                strokeWidth="3.5"
                fill="transparent"
              />
              <circle
                cx="28"
                cy="28"
                r={radius}
                className={`transition-all duration-1000 ease-linear ${
                  isWarning ? "stroke-destructive" : "stroke-accent"
                }`}
                strokeWidth="3.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            <div className="absolute flex flex-col items-center justify-center">
              <span
                className={`font-mono text-xs font-bold transition-colors ${
                  isWarning ? "text-destructive animate-pulse" : "text-foreground"
                }`}
              >
                {secondsLeft}s
              </span>
            </div>
          </div>

          <div className="text-left text-xs text-muted">
            <span className="block font-medium text-foreground">Period: {period}s</span>
            <span className={isWarning ? "text-destructive font-semibold" : "text-muted"}>
              {isWarning ? "Refreshing soon!" : "Expires next cycle"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
