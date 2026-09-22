"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { deriveKey } from "@/lib/crypto";
import { useVault } from "@/lib/vault-context";
import { TotpSetupCard } from "@/components/TotpSetupCard";
import { HoldToConfirmButton } from "@/components/HoldToConfirmButton";
import { ShieldCheck, ShieldAlert, KeyRound, Smartphone, Trash2 } from "lucide-react";
import {
  errorBoxClass,
  inputClass,
  labelClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

const MIN_PASSWORD_LENGTH = 10;

export default function VaultSettingsPage() {
  const { isUnlocked, reencryptAll, clearAllItems, totpConfig, enableTotp2FA, disableTotp2FA } = useVault();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Clear All Saved Passwords state
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearSuccess, setClearSuccess] = useState(false);

  // TOTP Setup toggle
  const [showTotpSetup, setShowTotpSetup] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(
        `New master password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        setError("Not signed in.");
        return;
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) {
        setError("Current master password is incorrect.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("kdf_salt")
        .eq("id", user.id)
        .single();
      if (profileError || !profile) {
        setError(profileError?.message ?? "Could not load your vault profile.");
        return;
      }

      const newKey = await deriveKey(newPassword, profile.kdf_salt);
      await reencryptAll(newKey);

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isUnlocked) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-16 text-sm text-muted">
        <p>Unlock your vault first.</p>
        <Link href="/vault" className={linkClass}>
          Go to vault
        </Link>
      </div>
    );
  }

  const isTotpActive = totpConfig?.enabled === true;

  return (
    <main className="flex-1 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/vault"
          className={`${secondaryButtonClass} inline-block w-auto px-3 py-1.5 text-xs`}
        >
          ← Back to vault
        </Link>

        {/* ── Two-Factor Authentication (TOTP) Card ── */}
        <div className="rounded-xl border border-border bg-panel p-7 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-background border border-border text-accent">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Two-Factor Authentication (TOTP 2FA)
                </h2>
                <p className="text-xs text-muted">
                  Pair with Google Authenticator or Authy for 2-step vault unlock
                </p>
              </div>
            </div>

            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isTotpActive
                ? "bg-accent/20 border-accent/40 text-accent"
                : "bg-destructive/10 border-destructive/30 text-destructive"
            }`}>
              {isTotpActive ? "2FA Enabled 🟢" : "2FA Disabled 🔴"}
            </div>
          </div>

          {isTotpActive && !showTotpSetup && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-background border border-border text-xs text-muted space-y-1">
                <p className="font-semibold text-foreground">Active Configuration:</p>
                <p>Account: <strong className="text-foreground">{totpConfig?.accountName}</strong></p>
                <p>Issuer: <strong className="text-foreground">{totpConfig?.issuer}</strong></p>
                <p>Status: <span className="text-accent font-semibold">Protected with 2-step verification</span></p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowTotpSetup(true)}
                  className={`${secondaryButtonClass} w-auto text-xs px-3 py-2`}
                >
                  View QR Code / Secret
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Are you sure you want to disable TOTP 2FA?")) {
                      disableTotp2FA();
                      setShowTotpSetup(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-medium border border-destructive/30 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Disable TOTP 2FA</span>
                </button>
              </div>
            </div>
          )}

          {(!isTotpActive || showTotpSetup) && (
            <div className="space-y-4">
              <TotpSetupCard
                initialAccount={totpConfig?.accountName ?? "user@mynexvault.app"}
                initialIssuer={totpConfig?.issuer ?? "MynexVault"}
                initialSecret={totpConfig?.secret}
                onSaveConfig={(secret, account, issuer) => {
                  enableTotp2FA(secret, account, issuer);
                  setShowTotpSetup(false);
                }}
                onCancel={isTotpActive ? () => setShowTotpSetup(false) : undefined}
              />
            </div>
          )}
        </div>

        {/* Change Master Password Card */}
        <div className="rounded-xl border border-border bg-panel p-7 shadow-xl">
          <h2 className="text-lg font-semibold text-foreground">
            Change master password
          </h2>
          <p className="mt-1 text-sm text-muted">
            Your saved passwords are re-encrypted with the new one — nothing
            is lost.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error ? <p className={errorBoxClass}>{error}</p> : null}
            {success ? (
              <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
                Master password changed.
              </p>
            ) : null}
            <div>
              <label className={labelClass} htmlFor="current-password">
                Current master password
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="off"
                className={inputClass}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="new-password">
                New master password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="off"
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="confirm-new-password">
                Confirm new master password
              </label>
              <input
                id="confirm-new-password"
                type="password"
                autoComplete="off"
                className={inputClass}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>
            <button
              type="submit"
              className={primaryButtonClass}
              disabled={submitting}
            >
              {submitting ? "Updating…" : "Update master password"}
            </button>
          </form>
        </div>

        {/* Clear List (Wipe Saved Passwords) Card */}
        <div className="rounded-xl border border-red-500/30 bg-panel p-7 shadow-xl space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Clear Saved Passwords
              </h2>
              <p className="text-xs text-muted">
                Permanently delete all credentials and items stored in your vault.
              </p>
            </div>
          </div>

          {clearError ? <p className={errorBoxClass}>{clearError}</p> : null}

          {clearSuccess ? (
            <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
              All saved passwords have been cleared from your vault.
            </p>
          ) : null}

          <div className="pt-2">
            <HoldToConfirmButton
              holdDurationMs={5000}
              idleLabel="Hold for 5 seconds to Clear All Saved Passwords"
              holdingLabel="Keep holding to clear all passwords..."
              confirmedLabel="All Saved Passwords Cleared!"
              onConfirm={async () => {
                setClearError(null);
                setClearSuccess(false);
                try {
                  await clearAllItems();
                  setClearSuccess(true);
                } catch (err: unknown) {
                  const message = err instanceof Error ? err.message : "Failed to clear saved passwords.";
                  setClearError(message);
                }
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
