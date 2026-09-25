/**
 * mock-supabase.ts — Standalone Offline Mock Supabase Client
 * 
 * Provides full multi-user authentication, immutable per-user Argon2id salts,
 * persistent TOTP 2FA configuration in profiles, and isolated vault items CRUD.
 * Used for offline development and sandbox testing without external dependencies.
 */

import { generateSaltBase64 } from "@/lib/crypto";

export interface MockUser {
  id: string;
  email: string;
}

export interface MockUserRecord {
  id: string;
  email: string;
  password: string;
}

export interface MockProfileRow {
  id: string;
  kdf_salt: string;
  totp_enabled?: boolean;
  totp_secret?: string | null;
  totp_account?: string | null;
  totp_issuer?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MockVaultItemRow {
  id: string;
  user_id: string;
  encrypted_data: string;
  iv: string;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = "mynexvault_sandbox_mock_db_v1";

interface SandboxState {
  currentUser: MockUser | null;
  users: Record<string, MockUserRecord>; // email -> record
  profiles: Record<string, MockProfileRow>; // userId -> profile
  vaultItems: MockVaultItemRow[];
}

function getInitialState(): SandboxState {
  if (typeof window === "undefined") {
    return { currentUser: null, users: {}, profiles: {}, vaultItems: [] };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: SandboxState = JSON.parse(raw);
      // Migrate older state formats to ensure every user has a stable id and matching profile
      if (parsed.users) {
        for (const [emailKey, u] of Object.entries(parsed.users as Record<string, any>)) {
          if (!u.id) {
            // Find existing profile or use deterministic ID
            const existingId = Object.keys(parsed.profiles || {}).find(
              (pid) => pid === `user-${emailKey}` || pid.includes(emailKey)
            );
            u.id = existingId || `user-${emailKey.replace(/[^a-zA-Z0-9]/g, "-")}`;
          }
          if (!parsed.profiles[u.id]) {
            parsed.profiles[u.id] = {
              id: u.id,
              kdf_salt: generateSaltBase64(),
              totp_enabled: false,
            };
          }
        }
      }
      return parsed;
    }
  } catch (err) {
    console.error("Failed to parse sandbox state:", err);
  }

  // Pre-seed Demo User
  const demoUserId = "demo-user-123";
  const demoSalt = generateSaltBase64();

  const initialState: SandboxState = {
    currentUser: null,
    users: {
      "demo@mynexvault.app": {
        id: demoUserId,
        email: "demo@mynexvault.app",
        password: "password123",
      },
    },
    profiles: {
      [demoUserId]: {
        id: demoUserId,
        kdf_salt: demoSalt,
        totp_enabled: false,
      },
    },
    vaultItems: [],
  };

  saveState(initialState);
  return initialState;
}

function saveState(state: SandboxState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save sandbox state:", err);
  }
}

export class MockSupabaseClient {
  private state: SandboxState;

  constructor() {
    this.state = getInitialState();
  }

  // ── Auth API ────────────────────────────────────────────────────────────────

  auth = {
    getUser: async () => {
      this.state = getInitialState();
      return {
        data: { user: this.state.currentUser },
        error: null,
      };
    },

    signInWithPassword: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      this.state = getInitialState();
      const cleanEmail = email.trim().toLowerCase();
      const userRecord = this.state.users[cleanEmail];

      if (!userRecord || userRecord.password !== password) {
        return {
          data: { user: null, session: null },
          error: { message: "Invalid login credentials." },
        };
      }

      const userId = userRecord.id;

      // Ensure profile exists with an immutable salt. NEVER generate a new salt on an existing profile!
      if (!this.state.profiles[userId]) {
        this.state.profiles[userId] = {
          id: userId,
          kdf_salt: generateSaltBase64(),
          totp_enabled: false,
        };
      }

      const user: MockUser = { id: userId, email: userRecord.email };
      this.state.currentUser = user;
      saveState(this.state);

      return {
        data: { user, session: { access_token: `mock-token-${userId}` } },
        error: null,
      };
    },

    signUp: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      this.state = getInitialState();
      const cleanEmail = email.trim().toLowerCase();

      if (this.state.users[cleanEmail]) {
        return {
          data: { user: null, session: null },
          error: { message: "User already registered." },
        };
      }

      // Generate a stable unique user ID
      const userId = `user-${cleanEmail.replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now().toString(36)}`;
      const user: MockUser = { id: userId, email: cleanEmail };

      this.state.users[cleanEmail] = { id: userId, email: cleanEmail, password };
      this.state.profiles[userId] = {
        id: userId,
        kdf_salt: generateSaltBase64(),
        totp_enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.state.currentUser = user;

      saveState(this.state);

      return {
        data: { user, session: { access_token: `mock-token-${userId}` } },
        error: null,
      };
    },

    signOut: async () => {
      this.state = getInitialState();
      this.state.currentUser = null;
      saveState(this.state);
      return { error: null };
    },

    updateUser: async ({ password }: { password?: string }) => {
      this.state = getInitialState();
      if (!this.state.currentUser) {
        return { error: { message: "Not signed in." } };
      }

      if (password) {
        const userEmail = this.state.currentUser.email.toLowerCase();
        if (this.state.users[userEmail]) {
          this.state.users[userEmail].password = password;
          saveState(this.state);
        }
      }

      return { data: { user: this.state.currentUser }, error: null };
    },

    resetPasswordForEmail: async (email: string) => {
      this.state = getInitialState();
      const cleanEmail = email.trim().toLowerCase();
      if (!this.state.users[cleanEmail]) {
        return { error: { message: "User not found." } };
      }
      return { error: null };
    },

    verifyOtp: async ({ email }: { email: string; token: string; type: string }) => {
      this.state = getInitialState();
      const cleanEmail = email.trim().toLowerCase();
      const userRecord = this.state.users[cleanEmail];
      if (!userRecord) {
        return { data: { user: null, session: null }, error: { message: "Invalid code or user." } };
      }
      const user: MockUser = { id: userRecord.id, email: userRecord.email };
      this.state.currentUser = user;
      saveState(this.state);
      return { data: { user, session: { access_token: `mock-token-${user.id}` } }, error: null };
    },
  };

  // ── Database API (from) ─────────────────────────────────────────────────────

  from(table: string) {
    this.state = getInitialState();
    const self = this;

    if (table === "profiles") {
      return {
        select: (cols: string) => ({
          eq: (col: string, val: string) => ({
            single: async () => {
              const profile = self.state.profiles[val];
              if (!profile) {
                return { data: null, error: { message: "Profile not found." } };
              }
              return { data: { ...profile }, error: null };
            },
            maybeSingle: async () => {
              const profile = self.state.profiles[val];
              return { data: profile ? { ...profile } : null, error: null };
            },
          }),
        }),
        insert: async (row: MockProfileRow) => {
          self.state.profiles[row.id] = {
            ...(self.state.profiles[row.id] || {}),
            ...row,
          };
          saveState(self.state);
          return { error: null };
        },
        update: (updates: Partial<MockProfileRow>) => ({
          eq: async (col: string, val: string) => {
            if (self.state.profiles[val]) {
              self.state.profiles[val] = {
                ...self.state.profiles[val],
                ...updates,
                updated_at: new Date().toISOString(),
              };
              saveState(self.state);
            }
            return { data: self.state.profiles[val], error: null };
          },
        }),
        upsert: async (row: Partial<MockProfileRow> & { id: string }) => {
          self.state.profiles[row.id] = {
            ...(self.state.profiles[row.id] || {}),
            ...row,
            updated_at: new Date().toISOString(),
          } as MockProfileRow;
          saveState(self.state);
          return { error: null };
        },
      };
    }

    if (table === "vault_items") {
      return {
        select: (cols: string) => ({
          order: (col: string, { ascending }: { ascending: boolean }) => {
            const userItems = self.state.vaultItems.filter(
              (it) => it.user_id === self.state.currentUser?.id
            );
            userItems.sort((a, b) =>
              ascending
                ? a.created_at.localeCompare(b.created_at)
                : b.created_at.localeCompare(a.created_at)
            );
            return Promise.resolve({ data: [...userItems], error: null });
          },
          eq: (col: string, val: string) => ({
            order: (col2: string, { ascending }: { ascending: boolean }) => {
              const userItems = self.state.vaultItems.filter(
                (it) => it.user_id === val
              );
              return Promise.resolve({ data: [...userItems], error: null });
            },
          }),
        }),

        insert: (row: { user_id: string; encrypted_data: string; iv: string }) => ({
          select: (cols: string) => ({
            single: async () => {
              const now = new Date().toISOString();
              const newRow: MockVaultItemRow = {
                id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                user_id: row.user_id,
                encrypted_data: row.encrypted_data,
                iv: row.iv,
                created_at: now,
                updated_at: now,
              };
              self.state.vaultItems.unshift(newRow);
              saveState(self.state);
              return { data: newRow, error: null };
            },
          }),
        }),

        update: (updates: { encrypted_data: string; iv: string }) => ({
          eq: (col: string, id: string) => ({
            select: (cols: string) => ({
              single: async () => {
                const itemIdx = self.state.vaultItems.findIndex((it) => it.id === id);
                if (itemIdx === -1) {
                  return { data: null, error: { message: "Item not found." } };
                }
                const now = new Date().toISOString();
                self.state.vaultItems[itemIdx].encrypted_data = updates.encrypted_data;
                self.state.vaultItems[itemIdx].iv = updates.iv;
                self.state.vaultItems[itemIdx].updated_at = now;
                saveState(self.state);
                return { data: { updated_at: now }, error: null };
              },
            }),
          }),
        }),

        delete: () => ({
          eq: async (col: string, val: string) => {
            if (col === "user_id") {
              self.state.vaultItems = self.state.vaultItems.filter((it) => it.user_id !== val);
            } else {
              self.state.vaultItems = self.state.vaultItems.filter((it) => it.id !== val);
            }
            saveState(self.state);
            return { error: null };
          },
        }),
      };
    }

    throw new Error(`Mock table '${table}' not implemented in sandbox client.`);
  }
}
