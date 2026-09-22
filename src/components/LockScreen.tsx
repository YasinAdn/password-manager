"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deriveKey } from "@/lib/crypto";
import { useVault } from "@/lib/vault-context";
import { Totp2faChallenge } from "./Totp2faChallenge";
import {
  errorBoxClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";
import { Lock, ShieldCheck } from "lucide-react";

export default function LockScreen() {
  const router = useRouter();
  const { unlockMaster, verifyTotp, lock } = useVault();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // 2-Step Authentication State
  const [totpStepRequired, setTotpStepRequired] = useState(false);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
    };
    fetchUser();
  }, []);

  async function handleMasterUnlock(e: FormEvent) {
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
      const result = await unlockMaster(key);

      if (!result.ok) {
        setError(result.error ?? "Could not unlock your vault.");
        return;
      }

      // Step 2: Check if TOTP 2FA is required
      if (result.totpRequired && result.totpSecret) {
        setTotpStepRequired(true);
        setTotpSecret(result.totpSecret);
      } else {
        // Vault unlocked directly (no TOTP configured)
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    lock();
    router.push("/login");
  }

  // If Step 1 Master Password succeeded and Step 2 TOTP is required, show Totp2faChallenge
  if (totpStepRequired && userId && totpSecret) {
    return (
      <Totp2faChallenge
        userId={userId}
        secret={totpSecret}
        onSuccess={() => {
          verifyTotp();
        }}
        onCancel={() => {
          setTotpStepRequired(false);
          setTotpSecret(null);
          lock();
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-7 shadow-2xl space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <div className="p-2.5 rounded-xl bg-background border border-border text-accent">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold">
              Step 1 of 2 — Master Password
            </span>
            <h1 className="text-lg font-semibold text-foreground">Vault Locked</h1>
          </div>
        </div>

        {email ? (
          <p className="text-xs text-muted">Signed in as <strong className="text-foreground">{email}</strong></p>
        ) : null}

        <p className="text-xs text-muted leading-relaxed">
          Enter your master password to derive your encryption key and initiate 2-step verification.
        </p>

        <form onSubmit={handleMasterUnlock} className="space-y-4 pt-1">
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
            {submitting ? "Verifying Master Password…" : "Unlock Master Password"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleSignOut}
          className={`${secondaryButtonClass} w-full text-xs mt-2`}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
