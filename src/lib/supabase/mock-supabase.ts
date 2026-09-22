/**
 * mock-supabase.ts — Standalone Offline Mock Supabase Client
 * 
 * Enables testing the full password manager (Auth, Master Password, TOTP 2FA,
 * Vault Items CRUD) in a 100% offline browser sandbox without needing any
 * Supabase backend or API keys.
 */

import { generateSaltBase64 } from "@/lib/crypto";

export interface MockUser {
  id: string;
  email: string;
}

export interface MockProfileRow {
  id: string;
  kdf_salt: string;
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
  users: Record<string, { email: string; password: string }>; // email -> info
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
      return JSON.parse(raw);
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
        email: "demo@mynexvault.app",
        password: "password123",
      },
    },
    profiles: {
      [demoUserId]: {
        id: demoUserId,
        kdf_salt: demoSalt,
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
      const userRecord = this.state.users[email.toLowerCase()];

      if (!userRecord || userRecord.password !== password) {
        return {
          data: { user: null, session: null },
          error: { message: "Invalid login credentials." },
        };
      }

      // Find or create user ID
      let userId = Object.keys(this.state.profiles).find(
        (id) => this.state.profiles[id].id === `user-${email.toLowerCase()}`
      );
      if (!userId) {
        userId = email === "demo@mynexvault.app" ? "demo-user-123" : `user-${Date.now()}`;
        if (!this.state.profiles[userId]) {
          this.state.profiles[userId] = {
            id: userId,
            kdf_salt: generateSaltBase64(),
          };
        }
      }

      const user: MockUser = { id: userId, email: userRecord.email };
      this.state.currentUser = user;
      saveState(this.state);

      return {
        data: { user, session: { access_token: "mock-token" } },
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
      const cleanEmail = email.toLowerCase();

      if (this.state.users[cleanEmail]) {
        return {
          data: { user: null, session: null },
          error: { message: "User already registered." },
        };
      }

      const userId = `user-${Date.now()}`;
      const user: MockUser = { id: userId, email: cleanEmail };

      this.state.users[cleanEmail] = { email: cleanEmail, password };
      this.state.profiles[userId] = {
        id: userId,
        kdf_salt: generateSaltBase64(),
      };
      this.state.currentUser = user;

      saveState(this.state);

      return {
        data: { user, session: { access_token: "mock-token" } },
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
              return { data: profile, error: null };
            },
            maybeSingle: async () => {
              const profile = self.state.profiles[val];
              return { data: profile ?? null, error: null };
            },
          }),
        }),
        insert: async (row: { id: string; kdf_salt: string }) => {
          self.state.profiles[row.id] = { id: row.id, kdf_salt: row.kdf_salt };
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
            return Promise.resolve({ data: userItems, error: null });
          },
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
          eq: async (col: string, id: string) => {
            self.state.vaultItems = self.state.vaultItems.filter((it) => it.id !== id);
            saveState(self.state);
            return { error: null };
          },
        }),
      };
    }

    throw new Error(`Mock table '${table}' not implemented in sandbox client.`);
  }
}
