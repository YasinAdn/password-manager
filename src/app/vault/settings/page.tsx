"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { deriveKey } from "@/lib/crypto";
import { useVault } from "@/lib/vault-context";
import {
  errorBoxClass,
  inputClass,
  labelClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

const MIN_PASSWORD_LENGTH = 10;

// Changing the master password (as opposed to resetting a forgotten one)
// keeps the same kdf_salt -- only the password text changes -- and
// re-encrypts every vault item with the new key before touching the auth
// password, so nothing is lost.
export default function VaultSettingsPage() {
  const { isUnlocked, reencryptAll } = useVault();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <main className="flex-1 px-4 py-8">
      <div className="mx-auto max-w-sm">
        <Link
          href="/vault"
          className={`${secondaryButtonClass} mb-6 inline-block w-auto px-3 py-1.5 text-xs`}
        >
          ← Back to vault
        </Link>
        <div className="rounded-xl border border-border bg-panel p-7">
          <h1 className="text-lg font-semibold text-foreground">
            Change master password
          </h1>
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
      </div>
    </main>
  );
}
