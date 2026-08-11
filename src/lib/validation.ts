// Deliberately not relying on the <input type="email"> HTML attribute for
// enforcement -- that's trivially removed via devtools. This runs inside the
// submit handler's actual JS logic, so tampering with the DOM doesn't skip
// it. (The real security boundary is Supabase Auth itself, which
// re-validates email format server-side no matter what the client sends --
// this only improves the error message instead of a raw API error.)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}
