/**
 * totp-storage.ts — TOTP 2FA Profile & Security Storage Manager
 * 
 * Manages TOTP 2FA status, secret keys, rate-limiting lockout state,
 * and time-step replay protection for user accounts.
 */

export interface TotpProfileConfig {
  enabled: boolean;
  secret: string; // Base32 secret key
  issuer: string;
  accountName: string;
  createdAt: string;
  lastUsedTimestep: number | null;
  failedAttempts: number;
  failedWindowStart: string | null;
  lockedUntil: string | null;
}

const LOCAL_STORAGE_KEY_PREFIX = 'mynexvault_totp_2fa_';

function getStorageKey(userId: string): string {
  return `${LOCAL_STORAGE_KEY_PREFIX}${userId}`;
}

/**
 * Load TOTP 2FA config for a user from local persistent storage.
 */
export function getTotpConfig(userId: string): TotpProfileConfig | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as TotpProfileConfig;
  } catch (err) {
    console.error('Failed to load TOTP config:', err);
    return null;
  }
}

/**
 * Save TOTP 2FA config for a user
 */
export function saveTotpConfig(userId: string, config: TotpProfileConfig): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save TOTP config:', err);
  }
}

/**
 * Disable TOTP 2FA for a user
 */
export function disableTotpConfig(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.removeItem(getStorageKey(userId));
  } catch (err) {
    console.error('Failed to disable TOTP:', err);
  }
}

// ── Rate Limiting (5 attempts → 5-minute lockout) ────────────────────────────

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;
const WINDOW_DURATION_MS = 5 * 60 * 1000;

export interface RateLimitCheck {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutRemainingMs: number;
  totalFailedAttempts: number;
}

export function checkTotpRateLimit(userId: string): RateLimitCheck {
  const config = getTotpConfig(userId);
  if (!config) {
    return {
      isLocked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      lockoutRemainingMs: 0,
      totalFailedAttempts: 0,
    };
  }

  const now = Date.now();

  if (config.lockedUntil) {
    const expiry = new Date(config.lockedUntil).getTime();
    if (now < expiry) {
      return {
        isLocked: true,
        remainingAttempts: 0,
        lockoutRemainingMs: expiry - now,
        totalFailedAttempts: config.failedAttempts,
      };
    }
    // Lockout expired — reset
    config.failedAttempts = 0;
    config.failedWindowStart = null;
    config.lockedUntil = null;
    saveTotpConfig(userId, config);
  }

  if (config.failedWindowStart) {
    const windowStart = new Date(config.failedWindowStart).getTime();
    if (now - windowStart > WINDOW_DURATION_MS) {
      config.failedAttempts = 0;
      config.failedWindowStart = null;
      saveTotpConfig(userId, config);
    }
  }

  return {
    isLocked: false,
    remainingAttempts: MAX_FAILED_ATTEMPTS - (config.failedAttempts || 0),
    lockoutRemainingMs: 0,
    totalFailedAttempts: config.failedAttempts || 0,
  };
}

export function recordFailedTotpAttempt(userId: string): RateLimitCheck {
  let config = getTotpConfig(userId);
  const now = new Date();

  if (!config) {
    config = {
      enabled: false,
      secret: '',
      issuer: 'MynexVault',
      accountName: '',
      createdAt: now.toISOString(),
      lastUsedTimestep: null,
      failedAttempts: 0,
      failedWindowStart: null,
      lockedUntil: null,
    };
  }

  if (!config.failedWindowStart) {
    config.failedWindowStart = now.toISOString();
  }

  config.failedAttempts = (config.failedAttempts || 0) + 1;

  if (config.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    config.lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS).toISOString();
  }

  saveTotpConfig(userId, config);
  return checkTotpRateLimit(userId);
}

export function resetTotpRateLimit(userId: string): void {
  const config = getTotpConfig(userId);
  if (config) {
    config.failedAttempts = 0;
    config.failedWindowStart = null;
    config.lockedUntil = null;
    saveTotpConfig(userId, config);
  }
}

// ── Replay Protection ────────────────────────────────────────────────────────

export function getCurrentTimestep(period: number = 30): number {
  return Math.floor(Date.now() / 1000 / period);
}

export function isReplayedTimestep(userId: string, period: number = 30): boolean {
  const config = getTotpConfig(userId);
  if (!config || config.lastUsedTimestep === null) return false;
  const currentTimestep = getCurrentTimestep(period);
  return currentTimestep <= config.lastUsedTimestep;
}

export function consumeTimestep(userId: string, period: number = 30): void {
  const config = getTotpConfig(userId);
  if (config) {
    config.lastUsedTimestep = getCurrentTimestep(period);
    saveTotpConfig(userId, config);
  }
}
