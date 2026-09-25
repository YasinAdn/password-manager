export const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent";

export const labelClass =
  "mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-muted";

export const primaryButtonClass =
  "w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "w-full rounded-lg border border-border px-4 py-2.5 text-sm text-foreground transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50";

export const errorBoxClass =
  "mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger";

export const linkClass = "text-accent hover:underline";

export const heroActionCardClass =
  "group flex flex-col items-center gap-2 rounded-xl border border-border bg-panel px-6 py-8 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";

// Attributes to prevent Chrome, Edge, Firefox, Safari and password manager extensions
// (1Password, Bitwarden, LastPass, Dashlane, Proton Pass) from prompting to save passwords or autofilling.
export const noAutofillFormProps = {
  autoComplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-protonpass-ignore": "true",
  "data-form-type": "other",
} as const;

export const noAutofillPasswordProps = {
  autoComplete: "new-password",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-protonpass-ignore": "true",
  "data-form-type": "other",
} as const;
