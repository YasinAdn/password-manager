"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "./supabase/client";
import { decryptItem, encryptItem, type VaultItemData } from "./crypto";
import {
  getTotpConfig,
  saveTotpConfig,
  disableTotpConfig,
  type TotpProfileConfig,
} from "./totp-storage";

export interface VaultItem {
  id: string;
  data: VaultItemData;
  createdAt: string;
  updatedAt: string;
}

interface UnlockResult {
  ok: boolean;
  error?: string;
  totpRequired?: boolean;
  totpSecret?: string;
}

interface VaultContextValue {
  isUnlocked: boolean;
  isMasterUnlocked: boolean;
  isTotpRequired: boolean;
  isTotpVerified: boolean;
  items: VaultItem[];
  loading: boolean;
  candidateKey: CryptoKey | null;
  totpConfig: TotpProfileConfig | null;

  unlockMaster: (key: CryptoKey) => Promise<UnlockResult>;
  unlock: (key: CryptoKey) => Promise<UnlockResult>;
  verifyTotp: () => void;
  lock: () => void;
  addItem: (data: VaultItemData) => Promise<void>;
  updateItem: (id: string, data: VaultItemData) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  clearAllItems: () => Promise<void>;
  reencryptAll: (newKey: CryptoKey) => Promise<void>;

  enableTotp2FA: (secret: string, accountName: string, issuer: string) => Promise<void>;
  disableTotp2FA: () => Promise<void>;
}

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes auto-lock timeout

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(false);

  // TOTP 2FA State
  const [totpVerified, setTotpVerified] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [totpConfig, setTotpConfigState] = useState<TotpProfileConfig | null>(null);

  const lock = useCallback(() => {
    setKey(null);
    setItems([]);
    setTotpVerified(false);
    setCurrentUserId(null);
    setTotpConfigState(null);
  }, []);

  // Step 1: Master password key derivation & test decryption
  const unlockMaster = useCallback(
    async (candidateKey: CryptoKey): Promise<UnlockResult> => {
      setLoading(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return { ok: false, error: "Not signed in." };

        setCurrentUserId(user.id);

        // Fetch user profile from database to get persistent TOTP configuration (Zero Trust)
        const { data: profile } = await supabase
          .from("profiles")
          .select("totp_enabled, totp_secret, totp_account, totp_issuer")
          .eq("id", user.id)
          .maybeSingle();

        let activeTotpConfig: TotpProfileConfig | null = null;
        if (profile?.totp_enabled && profile.totp_secret) {
          activeTotpConfig = {
            enabled: true,
            secret: profile.totp_secret,
            accountName: profile.totp_account || user.email || "user@mynexvault.app",
            issuer: profile.totp_issuer || "MynexVault",
            createdAt: new Date().toISOString(),
            lastUsedTimestep: null,
            failedAttempts: 0,
            failedWindowStart: null,
            lockedUntil: null,
          };
          saveTotpConfig(user.id, activeTotpConfig);
        } else {
          // Check local storage cache
          const localConfig = getTotpConfig(user.id);
          if (localConfig?.enabled) {
            activeTotpConfig = localConfig;
          }
        }
        setTotpConfigState(activeTotpConfig);

        // CRITICAL ZERO TRUST DEFENSE: Always filter by user_id = user.id!
        // Guarantees queries can never retrieve or decrypt another user's ciphertext.
        const { data, error } = await supabase
          .from("vault_items")
          .select("id, encrypted_data, iv, created_at, updated_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) return { ok: false, error: error.message };

        const decrypted: VaultItem[] = [];
        for (const row of data ?? []) {
          try {
            const itemData = await decryptItem(
              candidateKey,
              row.encrypted_data,
              row.iv,
            );
            decrypted.push({
              id: row.id,
              data: itemData,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            });
          } catch {
            return { ok: false, error: "Incorrect master password." };
          }
        }

        setKey(candidateKey);
        setItems(decrypted);

        // Check if 2FA TOTP is enabled for this user
        if (activeTotpConfig && activeTotpConfig.enabled) {
          setTotpVerified(false);
          return { ok: true, totpRequired: true, totpSecret: activeTotpConfig.secret };
        } else {
          setTotpVerified(true);
          return { ok: true, totpRequired: false };
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Step 2: Complete TOTP verification
  const verifyTotp = useCallback(() => {
    setTotpVerified(true);
  }, []);

  const addItem = useCallback(
    async (data: VaultItemData) => {
      if (!key) throw new Error("Vault is locked.");
      const supabase = createClient();
      const { ciphertext, iv } = await encryptItem(key, data);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const { data: inserted, error } = await supabase
        .from("vault_items")
        .insert({ user_id: user.id, encrypted_data: ciphertext, iv })
        .select("id, created_at, updated_at")
        .single();
      if (error || !inserted) throw new Error(error?.message ?? "Save failed.");

      setItems((prev) => [
        {
          id: inserted.id,
          data,
          createdAt: inserted.created_at,
          updatedAt: inserted.updated_at,
        },
        ...prev,
      ]);
    },
    [key],
  );

  const updateItem = useCallback(
    async (id: string, data: VaultItemData) => {
      if (!key) throw new Error("Vault is locked.");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const { ciphertext, iv } = await encryptItem(key, data);
      const { data: updated, error } = await supabase
        .from("vault_items")
        .update({ encrypted_data: ciphertext, iv })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("updated_at")
        .single();
      if (error || !updated)
        throw new Error(error?.message ?? "Update failed.");

      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, data, updatedAt: updated.updated_at } : it,
        ),
      );
    },
    [key],
  );

  const deleteItem = useCallback(async (id: string) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in.");

    const { error } = await supabase
      .from("vault_items")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const clearAllItems = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in.");

    const { error } = await supabase
      .from("vault_items")
      .delete()
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
    setItems([]);
  }, []);

  const reencryptAll = useCallback(
    async (newKey: CryptoKey) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      for (const item of items) {
        const { ciphertext, iv } = await encryptItem(newKey, item.data);
        const { error } = await supabase
          .from("vault_items")
          .update({ encrypted_data: ciphertext, iv })
          .eq("id", item.id)
          .eq("user_id", user.id);
        if (error) throw new Error(error.message);
      }
      setKey(newKey);
    },
    [items],
  );

  const enableTotp2FA = useCallback(
    async (secret: string, accountName: string, issuer: string) => {
      if (!currentUserId) return;
      const config: TotpProfileConfig = {
        enabled: true,
        secret,
        accountName,
        issuer,
        createdAt: new Date().toISOString(),
        lastUsedTimestep: null,
        failedAttempts: 0,
        failedWindowStart: null,
        lockedUntil: null,
      };
      saveTotpConfig(currentUserId, config);
      setTotpConfigState(config);
      setTotpVerified(true);

      // Persist permanently into database profile row
      try {
        const supabase = createClient();
        await supabase
          .from("profiles")
          .update({
            totp_enabled: true,
            totp_secret: secret,
            totp_account: accountName,
            totp_issuer: issuer,
          })
          .eq("id", currentUserId);
      } catch (err) {
        console.error("Failed to persist TOTP to profile in database:", err);
      }
    },
    [currentUserId],
  );

  const disableTotp2FA = useCallback(async () => {
    if (!currentUserId) return;
    disableTotpConfig(currentUserId);
    setTotpConfigState(null);

    // Persist permanently into database profile row
    try {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({
          totp_enabled: false,
          totp_secret: null,
        })
        .eq("id", currentUserId);
    } catch (err) {
      console.error("Failed to disable TOTP in database:", err);
    }
  }, [currentUserId]);

  const isMasterUnlocked = key !== null;
  const isTotpRequired = isMasterUnlocked && totpConfig?.enabled === true && !totpVerified;
  const isUnlocked = isMasterUnlocked && (!totpConfig?.enabled || totpVerified);

  // Inactivity Auto-Lock: drops CryptoKey and decrypted items after 15 minutes of inactivity
  useEffect(() => {
    if (!isUnlocked) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lock();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((evt) =>
      window.addEventListener(evt, resetTimer, { passive: true }),
    );

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [isUnlocked, lock]);

  const value = useMemo<VaultContextValue>(
    () => ({
      isUnlocked,
      isMasterUnlocked,
      isTotpRequired,
      isTotpVerified: totpVerified,
      items,
      loading,
      candidateKey: key,
      totpConfig,
      unlockMaster,
      unlock: unlockMaster,
      verifyTotp,
      lock,
      addItem,
      updateItem,
      deleteItem,
      clearAllItems,
      reencryptAll,
      enableTotp2FA,
      disableTotp2FA,
    }),
    [
      isUnlocked,
      isMasterUnlocked,
      isTotpRequired,
      totpVerified,
      items,
      loading,
      key,
      totpConfig,
      unlockMaster,
      verifyTotp,
      lock,
      addItem,
      updateItem,
      deleteItem,
      clearAllItems,
      reencryptAll,
      enableTotp2FA,
      disableTotp2FA,
    ],
  );

  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  );
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within a VaultProvider");
  return ctx;
}
