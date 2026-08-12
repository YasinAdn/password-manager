import Link from "next/link";
import { linkClass } from "@/lib/ui";

export const metadata = {
  title: "Privacy Policy — Vault",
};

const CONTACT_EMAIL = "yasin.adnan@mynexsystems.com";
const LAST_UPDATED = "August 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="flex-1 px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Privacy Policy
          </h1>
          <p className="mt-1 text-sm text-muted">Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="What Vault is">
          <p>
            Vault is a self-hosted, client-encrypted password manager. This
            policy explains exactly what data is collected, how it is used,
            and — just as importantly — what is never collected.
          </p>
        </Section>

        <Section title="Data we collect">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Email address</strong> —
              used solely to create and authenticate your account (sign-in,
              password reset). We do not use it for marketing and do not
              share it with third parties.
            </li>
            <li>
              <strong className="text-foreground">Encrypted vault items</strong>{" "}
              — every password, username, and note you save is encrypted
              (AES-256-GCM) on your device before it is ever sent to our
              servers. We store only the resulting ciphertext — we cannot
              read, and do not have access to, the contents of your vault.
            </li>
            <li>
              <strong className="text-foreground">A non-secret salt</strong>{" "}
              — a random value used to derive your encryption key from your
              master password. The salt is not sensitive on its own and
              cannot be used to recover your master password or your data.
            </li>
          </ul>
        </Section>

        <Section title="What we never see or store">
          <ul className="list-disc space-y-2 pl-5">
            <li>Your master password — it never leaves your device.</li>
            <li>
              The plaintext contents of any saved password, username, URL, or
              note.
            </li>
          </ul>
        </Section>

        <Section title="Where data is stored">
          <p>
            Application data is stored with Supabase, our database and
            authentication provider. We do not use any advertising,
            analytics, or tracking services, and we do not sell or share your
            data with third parties.
          </p>
        </Section>

        <Section title="Master password resets">
          <p>
            Because your vault is encrypted with a key derived from your
            master password, resetting a forgotten master password makes any
            previously saved vault items permanently unreadable — they are
            deleted as part of the reset so the vault remains usable going
            forward. This is a limitation of client-side encryption, not a
            data-retention choice: we have no way to recover data encrypted
            under a password you no longer have.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            You can delete individual vault items at any time from within the
            app. To delete your account and all associated data entirely,
            contact us at the address below.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If this policy changes, the &ldquo;Last updated&rdquo; date above
            will change accordingly.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data can be sent to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Link href="/" className={linkClass}>
          ← Back to Vault
        </Link>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </section>
  );
}
