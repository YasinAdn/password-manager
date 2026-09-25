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

/**
 * Validates and sanitizes a URL strictly permitting only http: and https: schemes.
 * Blocks dangerous schemes like javascript:, data:, vbscript:, file: to prevent DOM XSS.
 * If the user omitted a scheme (e.g., 'github.com'), it safely prepends 'https://'.
 * Returns the sanitized URL string, or null if invalid or unsafe.
 */
export function sanitizeSafeUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Reject known dangerous pseudo-protocols
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    // If no protocol was provided (e.g. "github.com/login"), test with https://
    try {
      const withHttps = new URL(`https://${trimmed}`);
      if (withHttps.protocol === "http:" || withHttps.protocol === "https:") {
        return withHttps.toString();
      }
    } catch {
      return null;
    }
  }
  return null;
}
