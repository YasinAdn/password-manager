"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deriveKey } from "@/lib/crypto";
import { useVault } from "@/lib/vault-context";
import {
  errorBoxClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

// Shown whenever there's a valid Supabase session but no derived key in
// memory (e.g. right after a page reload) -- the account stays "logged in"
// but the vault itself stays locked until the master password is re-entered.
export default function LockScreen() {
  const router = useRouter();
  const { unlock } = useVault();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
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

      const key = await deriveKey(password, profile.kdf_salt);
      const result = await unlock(key);
      if (!result.ok) {
        setError(result.error ?? "Could not unlock your vault.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-7 shadow-2xl">
        <h1 className="text-lg font-semibold text-foreground">Vault locked</h1>
        <p className="mt-1 text-sm text-muted">
          Enter your master password to unlock it.
        </p>
        <form onSubmit={handleUnlock} className="mt-6 space-y-4">
          {error ? <p className={errorBoxClass}>{error}</p> : null}
          <div>
            <label className={labelClass} htmlFor="unlock-password">
              Master password
            </label>
            <input
              id="unlock-password"
              type="password"
              autoComplete="off"
              autoFocus
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={submitting}
          >
            {submitting ? "Unlocking…" : "Unlock"}
          </button>
        </form>
        <button
          type="button"
          onClick={handleSignOut}
          className={`${secondaryButtonClass} mt-3`}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
