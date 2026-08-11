"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deriveKey, generateSaltBase64 } from "@/lib/crypto";
import { useVault } from "@/lib/vault-context";
import { isValidEmail } from "@/lib/validation";
import AuthCard from "@/components/AuthCard";
import {
  errorBoxClass,
  inputClass,
  labelClass,
  linkClass,
  primaryButtonClass,
} from "@/lib/ui";

export default function LoginPage() {
  const router = useRouter();
  const { unlock } = useVault();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !data.user) {
        setError(signInError?.message ?? "Could not sign in.");
        return;
      }

      const { data: fetchedProfile, error: profileError } = await supabase
        .from("profiles")
        .select("kdf_salt")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileError) {
        setError(profileError.message);
        return;
      }

      // Self-heal: a profile row should always exist after signup, but if
      // the signup flow was interrupted before it was created, make one now
      // rather than leaving the account permanently stuck.
      let profile = fetchedProfile;
      if (!profile) {
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
      const result = await unlock(key);
      if (!result.ok) {
        setError(result.error ?? "Could not unlock your vault.");
        return;
      }
      router.push("/vault");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Unlock your vault" subtitle="Log in with your master password.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <p className={errorBoxClass}>{error}</p> : null}
        <div>
          <label className={labelClass} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
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
            autoComplete="off"
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
  );
}
