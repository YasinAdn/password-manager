import { authenticator } from 'otplib';

/**
 * TOTP Authenticator Configuration
 * 
 * VERIFICATION WINDOW TRADE-OFF (window: 1):
 * 
 * window=0 → Only the current 30-second time-step is accepted.
 * window=1 → Current time-step ± 1 step (i.e., 3 valid codes at any time).
 *   ✅ CHOSEN: Tolerates ≤30s clock drift between phone and server while
 *   minimizing brute-force surface for Google Authenticator.
 */
authenticator.options = {
  step: 30,
  window: 1, // ±1 step drift window for Google Auth compatibility
};

/**
 * Generate a random Base32 TOTP secret key
 */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Build standard otpauth:// URI for QR code generation
 */
export function buildOtpauthUri(
  accountName: string,
  issuer: string,
  secret: string
): string {
  const safeAccount = accountName.trim() || 'user@mynexvault.app';
  const safeIssuer = issuer.trim() || 'MynexVault';
  return authenticator.keyuri(safeAccount, safeIssuer, secret);
}

/**
 * Compute the current 6-digit TOTP code for a secret
 */
export function getTotpCode(secret: string): string {
  if (!secret) return '------';
  try {
    return authenticator.generate(secret);
  } catch (err) {
    console.error('Error generating TOTP code:', err);
    return '------';
  }
}

/**
 * Verify a 6-digit TOTP code against a secret
 */
export function verifyTotpCode(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const cleanToken = token.replace(/[\s-]/g, '');
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return false;
  }
  try {
    return authenticator.verify({ token: cleanToken, secret });
  } catch (err) {
    console.error('Error verifying TOTP code:', err);
    return false;
  }
}

/**
 * Calculate remaining seconds until next TOTP code epoch
 */
export function getSecondsRemaining(period: number = 30): number {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const remainder = nowInSeconds % period;
  return period - remainder;
}

/**
 * Format raw Base32 secret string into 4-character chunks for UI display
 */
export function formatSecretDisplay(secret: string): string {
  if (!secret) return '';
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Format 6-digit TOTP code into "123 456" for readability
 */
export function formatCodeDisplay(code: string): string {
  if (!code || code.length !== 6) return code;
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}
