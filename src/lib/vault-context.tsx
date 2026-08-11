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

export interface VaultItem {
  id: string;
  data: VaultItemData;
  createdAt: string;
  updatedAt: string;
}

interface UnlockResult {
  ok: boolean;
  error?: string;
}

interface VaultContextValue {
  isUnlocked: boolean;
  items: VaultItem[];
  loading: boolean;
  unlock: (key: CryptoKey) => Promise<UnlockResult>;
  lock: () => void;
  addItem: (data: VaultItemData) => Promise<void>;
  updateItem: (id: string, data: VaultItemData) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  reencryptAll: (newKey: CryptoKey) => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

// The derived AES key lives only in this React state -- never in
// localStorage/sessionStorage -- so a full page reload clears it and the
// vault falls back to the lock screen even though the Supabase session
// (auth cookie) is still valid.
export function VaultProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(false);

  const unlock = useCallback(
    async (candidateKey: CryptoKey): Promise<UnlockResult> => {
      setLoading(true);
      try {
        const supabase = createClient();
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
            // AES-GCM auth-tag check failed -- this key doesn't match the
            // data it was encrypted with, i.e. wrong master password.
            return { ok: false, error: "Incorrect master password." };
          }
        }

        setKey(candidateKey);
        setItems(decrypted);
        return { ok: true };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const lock = useCallback(() => {
    setKey(null);
    setItems([]);
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

  // Used by the "change master password" flow: re-encrypts every item
  // currently held in memory with a freshly derived key, then swaps the
  // active key. Requires the vault to already be unlocked with the *old*
  // key (the plaintext `items` are only available while unlocked).
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

  const value = useMemo<VaultContextValue>(
    () => ({
      isUnlocked: key !== null,
      items,
      loading,
      unlock,
      lock,
      addItem,
      updateItem,
      deleteItem,
      reencryptAll,
    }),
    [key, items, loading, unlock, lock, addItem, updateItem, deleteItem, reencryptAll],
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
