# Vault — a self-hosted password manager

Next.js + Supabase. One email + master password both logs you in **and**
unlocks your saved passwords — Supabase never sees the master password or the
decrypted data, only encrypted blobs.

## How the security model works

- **Login** is handled entirely by Supabase Auth (email + password). Supabase
  hashes that password server-side with bcrypt automatically — nothing to
  configure.
- **Vault encryption** is separate and happens entirely in your browser: the
  same master password + a random per-user salt are run through **Argon2id**
  (via `hash-wasm`, pure WASM, no network call) to derive an AES-256-GCM key.
  Every saved credential is encrypted with that key *before* it's sent to
  Supabase — the `vault_items.encrypted_data` column is unreadable ciphertext,
  even to someone with direct database access.
- The derived key lives only in memory (React state). **Reloading the page
  locks the vault** even though you stay logged in — re-enter your master
  password to unlock it again. This mirrors Bitwarden/1Password.
- **If you forget your master password**, resetting it via email recovers
  *account access* but not your existing saved passwords — they were
  encrypted with a key derived from the password you forgot, and there is no
  server-side copy of that key to fall back on. The reset flow deletes the
  now-unreadable old items so the vault is usable again afterward. Changing
  your master password *while logged in* (you know the current one) does not
  lose anything — it re-encrypts everything with the new key first.
- 2FA (TOTP/Google Authenticator) is not implemented yet — planned as a
  follow-up once this core flow is verified working.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an
   account).
2. **New Project** → pick an organization, name it (e.g. `vault`), set a
   database password (this is Supabase's own DB password, unrelated to your
   vault's master password), pick a region, and create it. Provisioning takes
   about 2 minutes.
3. Once it's ready: **Project Settings → API** → copy the **Project URL**
   and the **anon / public** key.
4. Copy `.env.local.example` to `.env.local` (already done in this repo —
   just edit the values) and paste them in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   ```

## 2. Set up the database

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste in the contents of [`supabase/schema.sql`](supabase/schema.sql) and
   run it. This creates the `profiles` and `vault_items` tables with Row
   Level Security enabled, so every user can only ever see their own rows.

## 3. Configure email OTP codes

By default Supabase's confirmation/reset emails contain a clickable link.
This app uses a **6-digit code** instead:

1. **Authentication → Email Templates**.
2. Open **Confirm signup** — edit the template so it includes `{{ .Token }}`
   (the 6-digit code) instead of (or alongside) `{{ .ConfirmationURL }}`.
3. Do the same for **Reset Password**.
4. (Optional, for faster local testing) **Authentication → Providers →
   Email** → you can disable "Confirm email" while developing, but then
   signup won't require the OTP step at all — leave it enabled to test the
   real flow.

## 4. Run it

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. It redirects to `/login` (or `/vault` if
you're already signed in).

## Project layout

- `src/lib/crypto.ts` — Argon2id key derivation + AES-256-GCM encrypt/decrypt.
  Everything here runs client-side; nothing here ever talks to the network.
- `src/lib/vault-context.tsx` — React context holding the in-memory key,
  decrypted item list, and CRUD operations against Supabase.
- `src/lib/supabase/` — browser/server/middleware Supabase client setup
  (standard `@supabase/ssr` pattern).
- `src/app/signup`, `src/app/login`, `src/app/reset-password` — auth flows.
- `src/app/vault` — the protected vault UI; `src/app/vault/settings` — change
  master password.
- `supabase/schema.sql` — run once in Supabase's SQL editor.

## Related

- [password-manager-android](https://github.com/YasinAdn/password-manager-android)
  — an installable Android app (Trusted Web Activity) wrapping this web app.

## Notes

- Installed with `npm install --ignore-scripts` because of this machine's
  global `allow-scripts` npm restriction — none of this project's
  dependencies (Next.js, React, Tailwind, Supabase clients, `hash-wasm`) need
  install-time native builds, so this is safe here.
- After a meaningful content change to the public pages (`/`, `/privacy`),
  run `node scripts/indexnow-ping.mjs` to nudge IndexNow-participating
  search engines (Bing, Yandex) to recrawl sooner. Google doesn't use this
  protocol — it discovers pages by crawling links (e.g. from the GitHub
  repo) and the sitemap.
- Domain-agnostic by design: every canonical URL, sitemap entry, JSON-LD
  reference, and `llms.txt` link derives from `src/lib/site.ts`, which
  resolves to Vercel's own production domain automatically (see the file
  for the exact resolution order). Renaming the Vercel project or moving
  to a custom domain needs no code change here. The Android app is the
  one thing that *does* need a manual step when the domain changes — see
  the [android repo](https://github.com/YasinAdn/password-manager-android)'s
  README for why (it's an Android platform requirement, not a limitation
  of this code) and how to repoint it.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). Free to use, fork, modify, and
self-host for any noncommercial purpose — including deploying your own
private vault, per the note above. Commercial use (selling it, offering it
as a paid hosted service, bundling it into a paid product) requires a
separate agreement — contact yasin.adnan@mynexsystems.com.

<!-- verifying vercel auto-deploy on push -->
