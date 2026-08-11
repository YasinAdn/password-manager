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

type Step = "form" | "verify";

const MIN_PASSWORD_LENGTH = 10;

// Master password never leaves this component's React state -- it's not
// written to sessionStorage/localStorage/the URL, so it survives the
// signup -> email-verify -> vault-unlock sequence purely in memory.
export default function SignupPage() {
  const router = useRouter();
  const { unlock } = useVault();

  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Master password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      setStep("verify");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "signup",
      });
      if (verifyError || !data.user) {
        setError(verifyError?.message ?? "Could not verify that code.");
        return;
      }

      const kdfSalt = generateSaltBase64();
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ id: data.user.id, kdf_salt: kdfSalt });
      if (profileError) {
        setError(profileError.message);
        return;
      }

      const key = await deriveKey(password, kdfSalt);
      const result = await unlock(key);
      if (!result.ok) {
        setError(result.error ?? "Could not unlock your new vault.");
        return;
      }
      router.push("/vault");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "verify") {
    return (
      <AuthCard
        title="Check your email"
        subtitle={`Enter the 6-digit code sent to ${email}.`}
      >
        <form onSubmit={handleVerify} className="space-y-4">
          {error ? <p className={errorBoxClass}>{error}</p> : null}
          <div>
            <label className={labelClass} htmlFor="otp">
              Verification code
            </label>
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`${inputClass} text-center font-mono text-lg tracking-widest`}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              required
            />
          </div>
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={submitting}
          >
            {submitting ? "Verifying…" : "Verify & create vault"}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your vault"
      subtitle="Your master password never leaves this browser."
    >
      <form onSubmit={handleSignup} className="space-y-4">
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
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="confirmPassword">
            Confirm master password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="off"
            className={inputClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </div>
        <p className="text-xs text-muted">
          There is no way to recover your saved passwords if you forget this
          one — it&apos;s never sent anywhere. Write it down somewhere safe.
        </p>
        <button
          type="submit"
          className={primaryButtonClass}
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create vault"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        Already have a vault?{" "}
        <a className={linkClass} href="/login">
          Log in
        </a>
      </p>
    </AuthCard>
  );
}
