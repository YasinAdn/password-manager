import Link from "next/link";
import { linkClass, primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

const FAQS = [
  {
    q: "What is Vault?",
    a: "Vault is a free, open-source, self-hosted password manager. It stores your passwords, usernames, and notes, encrypting everything on your own device before any of it reaches a server.",
  },
  {
    q: "Is Vault free?",
    a: "Yes. Vault is free to use, and free to self-host under a noncommercial license — you can deploy your own private instance with your own Supabase project at no cost.",
  },
  {
    q: "How does Vault encrypt my passwords?",
    a: "Your master password and a random per-account salt are run through the Argon2id key-derivation function entirely in your browser to produce an AES-256-GCM encryption key. Every vault item is encrypted with that key before it is ever sent to the server — the server only ever stores unreadable ciphertext, never your master password and never your data in plaintext.",
  },
  {
    q: "Can I self-host Vault?",
    a: "Yes. Vault's source code is publicly available on GitHub. You can deploy your own fully private instance — your own database, your own data, isolated from everyone else's — by following the setup guide in the repository.",
  },
  {
    q: "What happens if I forget my master password?",
    a: "You can reset it via a one-time email code, but the previously saved vault items cannot be recovered — they were encrypted with a key derived from the password you forgot, and there is no server-side copy of that key. The reset clears the unreadable items so the vault is usable again afterward.",
  },
  {
    q: "Does Vault use ads or tracking?",
    a: "No. Vault has no advertising, no analytics, and no third-party trackers, and does not sell or share your data.",
  },
];

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Vault",
        applicationCategory: "SecurityApplication",
        operatingSystem: "Web, Android",
        description:
          "Vault is a free, open-source, self-hosted password manager with client-side AES-256-GCM encryption. Your master password never leaves your device.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        url: "https://passten.vercel.app",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: f.a,
          },
        })),
      },
    ],
  };

  return (
    <main className="flex-1 px-4 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-2xl space-y-16">
        {/* Hero */}
        <section className="text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
            <span className="font-mono text-xs uppercase tracking-wide text-muted">
              Vault
            </span>
          </div>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
            A password manager that can&rsquo;t read your passwords
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted">
            Vault is a free, open-source, self-hosted password manager. Every
            password is encrypted with AES-256-GCM on your own device before
            it ever reaches a server — your master password never leaves
            your browser.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className={`${primaryButtonClass} w-auto px-6 py-3`}
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className={`${secondaryButtonClass} w-auto px-6 py-3`}
            >
              Sign in
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Feature
            title="Client-side encryption"
            body="Passwords are encrypted with AES-256-GCM on your device using a key derived from your master password via Argon2id. The server only ever sees ciphertext."
          />
          <Feature
            title="Import in one click"
            body="Bring your existing passwords over from Chrome, Bitwarden, LastPass, or any similar CSV export — parsed entirely in your browser, never uploaded raw."
          />
          <Feature
            title="No ads, no tracking"
            body="No advertising, no analytics, no third-party trackers. Your data is never sold or shared."
          />
          <Feature
            title="Open source & self-hostable"
            body="Fork the source on GitHub and deploy your own fully private instance, free for any noncommercial use."
          />
        </section>

        {/* FAQ (also encoded above as FAQPage JSON-LD) */}
        <section id="frequently-asked-questions">
          <h2 className="mb-6 text-center text-xl font-semibold text-foreground">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {FAQS.map((f) => (
              <div key={f.q}>
                <h3 className="text-sm font-semibold text-foreground">
                  {f.q}
                </h3>
                <p className="mt-1 text-sm text-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted">
          <a
            href="https://github.com/YasinAdn/password-manager"
            className={linkClass}
          >
            Source on GitHub
          </a>
          <Link href="/privacy" className={linkClass}>
            Privacy Policy
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 text-sm text-muted">{body}</p>
    </div>
  );
}
