"use client";

import React, { useState, useEffect, useCallback } from "react";
import { verifyTotpCode } from "@/lib/totp";
import {
  checkTotpRateLimit,
  recordFailedTotpAttempt,
  resetTotpRateLimit,
  isReplayedTimestep,
  consumeTimestep,
  type RateLimitCheck,
} from "@/lib/totp-storage";
import {
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  RotateCcw,
  ArrowRight,
  Repeat,
  Lock,
} from "lucide-react";
import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

interface Totp2faChallengeProps {
  userId: string;
  secret: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type VerificationStatus = "idle" | "success" | "failed" | "replay" | "locked";

export const Totp2faChallenge: React.FC<Totp2faChallengeProps> = ({
  userId,
  secret,
  onSuccess,
  onCancel,
}) => {
  const [tokenInput, setTokenInput] = useState("");
  const [status, setStatus] = useState<VerificationStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const [rateLimit, setRateLimit] = useState<RateLimitCheck>({
    isLocked: false,
    remainingAttempts: 5,
    lockoutRemainingMs: 0,
    totalFailedAttempts: 0,
  });
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  useEffect(() => {
    const refreshRateLimit = () => {
      const check = checkTotpRateLimit(userId);
      setRateLimit(check);
      if (check.isLocked) {
        setLockoutCountdown(Math.ceil(check.lockoutRemainingMs / 1000));
        setStatus("locked");
        setErrorMessage(
          `Too many attempts. Account locked for ${Math.ceil(check.lockoutRemainingMs / 1000)}s.`,
        );
      } else if (status === "locked") {
        setStatus("idle");
        setErrorMessage("");
      }
    };

    refreshRateLimit();
    const interval = setInterval(refreshRateLimit, 1000);
    return () => clearInterval(interval);
  }, [userId, status]);

  const handleVerify = useCallback(
    (codeToVerify?: string) => {
      const targetToken = (codeToVerify || tokenInput).replace(/[\s-]/g, "");
      if (!targetToken || targetToken.length !== 6) {
        setStatus("failed");
        setErrorMessage("Please enter a 6-digit numeric TOTP code.");
        return;
      }

      // Check Rate Limit
      const currentLimit = checkTotpRateLimit(userId);
      if (currentLimit.isLocked) {
        setStatus("locked");
        setErrorMessage(
          `Too many attempts! Locked for ${Math.ceil(currentLimit.lockoutRemainingMs / 1000)}s.`,
        );
        setRateLimit(currentLimit);
        return;
      }

      // Check Replay Protection
      if (isReplayedTimestep(userId, 30)) {
        setStatus("replay");
        setErrorMessage(
          "Code already used! This time-step was consumed. Wait 30 seconds for Google Authenticator to refresh.",
        );
        return;
      }

      // Verify Code
      const isMatch = verifyTotpCode(targetToken, secret);

      if (isMatch) {
        consumeTimestep(userId, 30);
        resetTotpRateLimit(userId);
        setStatus("success");
        setErrorMessage("Match ✅ — 2FA Authentication successful!");
        setTimeout(() => {
          onSuccess();
        }, 400);
      } else {
        const updated = recordFailedTotpAttempt(userId);
        setRateLimit(updated);

        if (updated.isLocked) {
          setStatus("locked");
          setErrorMessage(
            `Too many failed attempts! Account locked for 5 minutes. (${updated.totalFailedAttempts}/5 failed)`,
          );
        } else {
          setStatus("failed");
          setErrorMessage(
            `No match ❌ — Code incorrect or expired. (${updated.totalFailedAttempts}/5 attempts used)`,
          );
        }
      }
    },
    [tokenInput, userId, secret, onSuccess],
  );

  useEffect(() => {
    const clean = tokenInput.replace(/[\s-]/g, "");
    if (clean.length === 6) {
      handleVerify(clean);
    }
  }, [tokenInput, handleVerify]);

  const isLocked = rateLimit.isLocked;

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-7 shadow-2xl space-y-5 animate-fade-in">
        {/* Step Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <div className="p-2.5 rounded-xl bg-background border border-border text-accent">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-bold">
              Step 2 of 2 — 2FA Active 🔒
            </span>
            <h2 className="text-lg font-semibold text-foreground">
              Google Authenticator Code
            </h2>
          </div>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Open <strong>Google Authenticator</strong> on your phone and enter the 6-digit code for your vault.
        </p>

        {/* Rate Limit Status Badge */}
        {rateLimit.totalFailedAttempts > 0 && (
          <div
            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between font-medium ${
              isLocked
                ? "bg-destructive/20 border-destructive/50 text-destructive"
                : "bg-background border-border text-muted"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {isLocked ? (
                <Ban className="w-4 h-4 text-destructive animate-pulse" />
              ) : (
                <Clock className="w-4 h-4 text-accent" />
              )}
              {isLocked
                ? `Locked: ${lockoutCountdown}s remaining`
                : `Attempts: ${rateLimit.totalFailedAttempts}/5 failed`}
            </span>
          </div>
        )}

        {/* 6-Digit Code Input */}
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              maxLength={7}
              autoFocus
              disabled={isLocked}
              value={tokenInput}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9\s]/g, "");
                setTokenInput(val);
              }}
              placeholder={isLocked ? "Locked..." : "123 456"}
              className={`${inputClass} text-center font-mono text-2xl font-bold tracking-widest text-accent ${
                isLocked
                  ? "opacity-50 cursor-not-allowed border-destructive"
                  : ""
              }`}
            />
            {tokenInput && !isLocked && (
              <button
                onClick={() => {
                  setTokenInput("");
                  setStatus("idle");
                }}
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => handleVerify()}
            disabled={isLocked || tokenInput.replace(/\s/g, "").length !== 6}
            type="button"
            className={`${primaryButtonClass} w-full flex items-center justify-center gap-2`}
          >
            <span>Verify Code</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Banner */}
        {status !== "idle" && (
          <div
            className={`p-3.5 rounded-lg border text-xs font-medium flex items-start gap-2.5 ${
              status === "success"
                ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                : status === "replay"
                  ? "bg-amber-950/40 border-amber-500/50 text-amber-300"
                  : "bg-destructive/20 border-destructive/50 text-destructive"
            }`}
          >
            {status === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : status === "replay" ? (
              <Repeat className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">
                {status === "success"
                  ? "Match ✅"
                  : status === "replay"
                    ? "Code Already Used 🔄"
                    : status === "locked"
                      ? "Locked 🔒"
                      : "No Match ❌"}
              </p>
              <p className="mt-0.5 text-[11px] opacity-90">{errorMessage}</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onCancel}
          className={`${secondaryButtonClass} w-full text-xs mt-1`}
        >
          Cancel &amp; Lock Master Password
        </button>
      </div>
    </div>
  );
};
