"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Trash2, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface HoldToConfirmButtonProps {
  onConfirm: () => Promise<void> | void;
  holdDurationMs?: number; // Default 5000ms
  idleLabel?: string;
  holdingLabel?: string;
  confirmedLabel?: string;
  disabled?: boolean;
}

export function HoldToConfirmButton({
  onConfirm,
  holdDurationMs = 5000,
  idleLabel = "Hold for 5s to Clear All Saved Passwords",
  holdingLabel = "Keep holding to wipe all passwords...",
  confirmedLabel = "All Passwords Cleared!",
  disabled = false,
}: HoldToConfirmButtonProps) {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isCompleted, setIsCompleted] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const cancelHold = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    startTimeRef.current = null;
    setIsHolding(false);
    setProgress(0);
  }, []);

  const triggerConfirm = useCallback(async () => {
    cancelHold();
    setIsCompleted(true);
    setIsExecuting(true);
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch {
        // ignore
      }
    }
    try {
      await onConfirm();
    } finally {
      setIsExecuting(false);
      setTimeout(() => {
        setIsCompleted(false);
      }, 4000);
    }
  }, [cancelHold, onConfirm]);

  const updateProgress = useCallback(() => {
    if (!startTimeRef.current) return;
    const elapsed = Date.now() - startTimeRef.current;
    const currentProgress = Math.min(100, (elapsed / holdDurationMs) * 100);
    setProgress(currentProgress);

    if (elapsed >= holdDurationMs) {
      triggerConfirm();
    } else {
      animFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [holdDurationMs, triggerConfirm]);

  const startHold = useCallback(() => {
    if (disabled || isExecuting || isCompleted) return;
    setIsHolding(true);
    startTimeRef.current = Date.now();
    animFrameRef.current = requestAnimationFrame(updateProgress);
  }, [disabled, isExecuting, isCompleted, updateProgress]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const remainingSeconds = Math.max(
    1,
    Math.ceil((holdDurationMs - (progress / 100) * holdDurationMs) / 1000)
  );

  return (
    <div className="space-y-2">
      <button
        type="button"
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        onTouchCancel={cancelHold}
        onContextMenu={(e) => e.preventDefault()}
        disabled={disabled || isExecuting}
        className={`relative overflow-hidden w-full rounded-xl border px-5 py-3.5 font-semibold text-sm transition-all select-none focus:outline-none flex items-center justify-center gap-2.5 ${
          isCompleted
            ? "bg-accent/20 border-accent/50 text-accent cursor-default"
            : isHolding
            ? "border-red-500/60 text-white bg-red-950/40 shadow-[0_0_20px_rgba(239,68,68,0.3)] scale-[0.99]"
            : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {/* Animated Fill Bar */}
        {isHolding && !isCompleted && (
          <div
            className="absolute inset-y-0 left-0 bg-red-600/60 transition-none"
            style={{ width: `${progress}%` }}
          />
        )}

        {/* Text / Status */}
        <span className="relative z-10 flex items-center gap-2 text-center">
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
              <span>Clearing saved passwords...</span>
            </>
          ) : isCompleted ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-accent" />
              <span>{confirmedLabel}</span>
            </>
          ) : isHolding ? (
            <>
              <AlertTriangle className="w-4 h-4 text-red-300 animate-pulse" />
              <span>
                {holdingLabel} ({remainingSeconds}s)
              </span>
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 text-red-400" />
              <span>{idleLabel}</span>
            </>
          )}
        </span>
      </button>

      <p className="text-[11px] text-center text-muted font-mono">
        {isHolding
          ? `Keep holding for ${remainingSeconds} second${
              remainingSeconds === 1 ? "" : "s"
            } to confirm deletion.`
          : "Press and hold the button for 5 full seconds to clear all saved passwords."}
      </p>
    </div>
  );
}
