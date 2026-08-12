"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useVault, type VaultItem } from "@/lib/vault-context";
import CsvImport from "@/components/CsvImport";
import EmptyVaultState from "@/components/EmptyVaultState";
import LockScreen from "@/components/LockScreen";
import MobileHeaderMenu from "@/components/MobileHeaderMenu";
import ThemeToggle from "@/components/ThemeToggle";
import VaultItemForm from "@/components/VaultItemForm";
import VaultItemRow from "@/components/VaultItemRow";
import type { VaultItemData } from "@/lib/crypto";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

export default function VaultPage() {
  const router = useRouter();
  const { isUnlocked, items, addItem, updateItem, deleteItem, lock } =
    useVault();

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<VaultItem | "new" | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setEmail(data.user?.email ?? null);
      setCheckingSession(false);
      if (!data.user) router.push("/login");
    });
  }, [router]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    lock();
    router.push("/login");
  }

  async function handleSave(data: VaultItemData) {
    if (editing === "new") {
      await addItem(data);
    } else if (editing) {
      await updateItem(editing.id, data);
    }
    setEditing(null);
  }

  async function handleImport(newItems: VaultItemData[]) {
    let succeeded = 0;
    let failed = 0;
    for (const item of newItems) {
      try {
        await addItem(item);
        succeeded++;
      } catch {
        failed++;
      }
    }
    return { succeeded, failed };
  }

  if (checkingSession) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }
  if (!hasSession) return null;
  if (!isUnlocked) return <LockScreen />;

  const q = query.trim().toLowerCase();
  const filtered = items.filter((it) => {
    if (!q) return true;
    return [it.data.title, it.data.url, it.data.email, it.data.username]
      .filter((v): v is string => Boolean(v))
      .some((v) => v.toLowerCase().includes(q));
  });

  return (
    <main className="flex-1 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <header className="animate-fade-in-up relative z-20 mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
              <h1 className="font-mono text-xs uppercase tracking-wide text-muted">
                Vault
              </h1>
            </div>
            {email ? <p className="mt-1 text-sm text-muted">{email}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {/* Desktop / wide viewports: full icon row */}
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/vault/settings"
                aria-label="Settings"
                title="Settings"
                className={`${secondaryButtonClass} flex w-auto items-center justify-center px-2.5 py-1.5`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Link>
              <ThemeToggle />
              <button
                type="button"
                onClick={handleSignOut}
                className={`${secondaryButtonClass} w-auto px-3 py-1.5 text-xs`}
              >
                Sign out
              </button>
            </div>

            {/* Narrow / app viewport: theme toggle + burger menu holding
                Settings and Sign out, so the header stays uncluttered. */}
            <div className="flex items-center gap-2 sm:hidden">
              <ThemeToggle />
              <MobileHeaderMenu onSignOut={handleSignOut} />
            </div>
          </div>
        </header>

        {editing ? (
          <div className="mb-6 rounded-xl border border-border bg-panel p-6">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              {editing === "new" ? "Add password" : "Edit password"}
            </h2>
            <VaultItemForm
              // Forces a fresh mount (and fresh internal state) whenever the
              // target item changes -- otherwise clicking Edit on a
              // different item while a form is already open leaves the
              // old item's data on screen.
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? undefined : editing.data}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          </div>
        ) : items.length === 0 ? (
          <EmptyVaultState
            onAddManual={() => setEditing("new")}
            onImport={handleImport}
          />
        ) : (
          <>
            <div className="animate-fade-in-up mb-4 space-y-2">
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="Search…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setEditing("new")}
                  className={`${primaryButtonClass} w-auto px-4`}
                >
                  + Add
                </button>
              </div>
              <CsvImport onImport={handleImport} />
            </div>

            <div className="space-y-2">
              {filtered.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">
                  No matches.
                </p>
              ) : (
                filtered.map((item, i) => (
                  <VaultItemRow
                    key={item.id}
                    item={item}
                    index={i}
                    onEdit={() => setEditing(item)}
                    onDelete={() => deleteItem(item.id)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
