"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deriveKey, generateSaltBase64 } from "@/lib/crypto";
import { useVault } from "@/lib/vault-context";
import { isValidEmail } from "@/lib/validation";
import AuthCard from "@/components/AuthCard";
import { Totp2faChallenge } from "@/components/Totp2faChallenge";
import {
  errorBoxClass,
  inputClass,
  labelClass,
  linkClass,
  primaryButtonClass,
  noAutofillFormProps,
  noAutofillPasswordProps,
} from "@/lib/ui";

export default function LoginPage() {
  const router = useRouter();
  const { unlockMaster, verifyTotp, lock } = useVault();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // In-line TOTP 2FA step if enabled on the user's account
  const [totpChallenge, setTotpChallenge] = useState<{
    userId: string;
    secret: string;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (signInError || !data.user) {
        setError(signInError?.message ?? "Could not sign in.");
        return;
      }

      // Fetch user profile salt
      const { data: fetchedProfile, error: profileError } = await supabase
        .from("profiles")
        .select("kdf_salt, totp_enabled, totp_secret")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        return;
      }

      let profile = fetchedProfile;
      if (!profile) {
        // Only if profile genuinely didn't exist (initial bootstrap)
        const kdfSalt = generateSaltBase64();
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({ id: data.user.id, kdf_salt: kdfSalt });
        if (insertError) {
          setError(insertError.message);
          return;
        }
        profile = { kdf_salt: kdfSalt };
      }

      const key = await deriveKey(password, profile.kdf_salt);
      const result = await unlockMaster(key);
      if (!result.ok) {
        setError(result.error ?? "Could not unlock your vault.");
        return;
      }

      // If user has TOTP 2FA enabled, challenge them right here
      if (result.totpRequired && result.totpSecret) {
        setTotpChallenge({
          userId: data.user.id,
          secret: result.totpSecret,
        });
        return;
      }

      router.push("/vault");
    } finally {
      setSubmitting(false);
    }
  }

  // 2-Step verification screen
  if (totpChallenge) {
    return (
      <div className="flex-1 flex flex-col justify-center">
        <Totp2faChallenge
          userId={totpChallenge.userId}
          secret={totpChallenge.secret}
          onSuccess={() => {
            verifyTotp();
            router.push("/vault");
          }}
          onCancel={() => {
            setTotpChallenge(null);
            lock();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center">
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <AuthCard title="Unlock your vault" subtitle="Log in with your master password.">
          <form onSubmit={handleSubmit} className="space-y-4" {...noAutofillFormProps}>
            {error ? <p className={errorBoxClass}>{error}</p> : null}
            <div>
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="password">
                Master password
              </label>
              <input
                id="password"
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                {...noAutofillPasswordProps}
                required
              />
            </div>

            <button
              type="submit"
              className={primaryButtonClass}
              disabled={submitting}
            >
              {submitting ? "Unlocking…" : "Log in"}
            </button>
          </form>
          <div className="mt-5 flex items-center justify-between text-sm text-muted">
            <a className={linkClass} href="/signup">
              Create a vault
            </a>
            <a className={linkClass} href="/reset-password">
              Forgot password?
            </a>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
