"use client";

import {
  createContext,
  useCallback,
  useContext,
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

  enableTotp2FA: (secret: string, accountName: string, issuer: string) => void;
  disableTotp2FA: () => void;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(false);

  // TOTP 2FA State
  const [totpVerified, setTotpVerified] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [totpConfig, setTotpConfigState] = useState<TotpProfileConfig | null>(null);

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
        const config = getTotpConfig(user.id);
        setTotpConfigState(config);

        const { data, error } = await supabase
          .from("vault_items")
          .select("id, encrypted_data, iv, created_at, updated_at")
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

        // Check if 2FA TOTP is enabled for this profile
        if (config && config.enabled) {
          setTotpVerified(false);
          return { ok: true, totpRequired: true, totpSecret: config.secret };
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

  const lock = useCallback(() => {
    setKey(null);
    setItems([]);
    setTotpVerified(false);
    setCurrentUserId(null);
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
      const { ciphertext, iv } = await encryptItem(key, data);
      const { data: updated, error } = await supabase
        .from("vault_items")
        .update({ encrypted_data: ciphertext, iv })
        .eq("id", id)
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
    const { error } = await supabase.from("vault_items").delete().eq("id", id);
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
      for (const item of items) {
        const { ciphertext, iv } = await encryptItem(newKey, item.data);
        const { error } = await supabase
          .from("vault_items")
          .update({ encrypted_data: ciphertext, iv })
          .eq("id", item.id);
        if (error) throw new Error(error.message);
      }
      setKey(newKey);
    },
    [items],
  );

  const enableTotp2FA = useCallback(
    (secret: string, accountName: string, issuer: string) => {
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
    },
    [currentUserId],
  );

  const disableTotp2FA = useCallback(() => {
    if (!currentUserId) return;
    disableTotpConfig(currentUserId);
    setTotpConfigState(null);
  }, [currentUserId]);

  const isMasterUnlocked = key !== null;
  const isTotpRequired = isMasterUnlocked && totpConfig?.enabled === true && !totpVerified;
  const isUnlocked = isMasterUnlocked && (!totpConfig?.enabled || totpVerified);

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
