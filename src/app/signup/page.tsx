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
import { CheckCircle2, Mail } from "lucide-react";

const MIN_PASSWORD_LENGTH = 10;

export default function SignupPage() {
  const router = useRouter();
  const { unlockMaster } = useVault();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (signUpError || !data.user) {
        setError(signUpError?.message ?? "Could not create account.");
        return;
      }

      const kdfSalt = generateSaltBase64();
      
      // Upsert profile salt
      try {
        await supabase
          .from("profiles")
          .upsert({
            id: data.user.id,
            kdf_salt: kdfSalt,
            totp_enabled: false,
          });
      } catch (err) {
        // In case database trigger already initialized salt
        console.warn("Profile init notice:", err);
      }

      // Check if Supabase requires email confirmation (no active session yet)
      if (!data.session) {
        setNeedsConfirmation(true);
        return;
      }

      // If user session is active immediately:
      const key = await deriveKey(password, kdfSalt);
      await unlockMaster(key);
      router.push("/vault");
    } finally {
      setSubmitting(false);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex-1 flex items-center justify-center p-4 py-12">
          <AuthCard
            title="Check your email"
            subtitle={`We sent a confirmation link or code to ${email}.`}
          >
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent border border-accent/20">
                <Mail className="h-7 w-7" />
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Please verify your email address to activate your account. Once verified, log in with your master password to unlock your vault.
              </p>
              <a
                href="/login"
                className={`${primaryButtonClass} block text-center`}
              >
                Go to Log in
              </a>
            </div>
          </AuthCard>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center">
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <AuthCard
          title="Create a vault"
          subtitle="Your master password encrypts everything on your device. It cannot be reset if forgotten."
        >
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
                autoComplete="new-password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="confirm-password">
                Confirm master password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
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
              {submitting ? "Creating vault…" : "Create vault"}
            </button>
          </form>
          <div className="mt-5 flex items-center justify-between text-sm text-muted">
            <span>Already have a vault?</span>
            <a className={linkClass} href="/login">
              Log in
            </a>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
