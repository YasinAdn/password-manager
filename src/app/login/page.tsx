"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deriveKey, generateSaltBase64 } from "@/lib/crypto";
import { useVault } from "@/lib/vault-context";
import { isValidEmail } from "@/lib/validation";
import AuthCard from "@/components/AuthCard";
import { SandboxBanner } from "@/components/SandboxBanner";
import {
  errorBoxClass,
  inputClass,
  labelClass,
  linkClass,
  primaryButtonClass,
} from "@/lib/ui";
import { Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { unlockMaster } = useVault();

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
      const result = await unlockMaster(key);
      if (!result.ok) {
        setError(result.error ?? "Could not unlock your vault.");
        return;
      }
      router.push("/vault");
    } finally {
      setSubmitting(false);
    }
  }

  const handleAutoFillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      <SandboxBanner onAutoFillDemo={handleAutoFillDemo} />

      <div className="flex-1 flex items-center justify-center p-4 py-12">
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

            <button
              type="button"
              onClick={() => handleAutoFillDemo("demo@mynexvault.app", "password123")}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Fill Demo Credentials (demo@mynexvault.app)</span>
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
