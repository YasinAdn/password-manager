"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateSaltBase64 } from "@/lib/crypto";
import { isValidEmail } from "@/lib/validation";
import AuthCard from "@/components/AuthCard";
import {
  errorBoxClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  noAutofillFormProps,
  noAutofillPasswordProps,
} from "@/lib/ui";

type Step = "request" | "confirm";

const MIN_PASSWORD_LENGTH = 10;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email);
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setStep("confirm");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Master password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "recovery",
      });
      if (verifyError || !data.user) {
        setError(verifyError?.message ?? "Could not verify that code.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Old vault items were encrypted with a key derived from the master
      // password you just forgot -- there is no way to recover them. Rotate
      // the salt and clear them so the vault is usable again going forward.
      const kdfSalt = generateSaltBase64();
      await supabase.from("vault_items").delete().eq("user_id", data.user.id);
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({ id: data.user.id, kdf_salt: kdfSalt });
      if (profileError) {
        setError(profileError.message);
        return;
      }

      router.push("/login");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "confirm") {
    return (
      <AuthCard
        title="Set a new master password"
        subtitle={`Enter the code sent to ${email}.`}
      >
        <form onSubmit={handleConfirm} className="space-y-4" {...noAutofillFormProps}>
          {error ? <p className={errorBoxClass}>{error}</p> : null}
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            Resetting your master password permanently erases your existing
            saved passwords — they were encrypted with the password you
            forgot and cannot be recovered. This cannot be undone.
          </div>
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
          <div>
            <label className={labelClass} htmlFor="new-password">
              New master password
            </label>
            <input
              id="new-password"
              type="password"
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              {...noAutofillPasswordProps}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="confirm-password">
              Confirm new master password
            </label>
            <input
              id="confirm-password"
              type="password"
              className={inputClass}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              {...noAutofillPasswordProps}
              required
            />
          </div>
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={submitting}
          >
            {submitting ? "Resetting…" : "Reset master password"}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset master password"
      subtitle="We'll email you a verification code."
    >
      <form onSubmit={handleRequest} className="space-y-4" {...noAutofillFormProps}>
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
        <button
          type="submit"
          className={primaryButtonClass}
          disabled={submitting}
        >
          {submitting ? "Sending…" : "Send code"}
        </button>
      </form>
    </AuthCard>
  );
}
