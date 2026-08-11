"use client";

import { useState, type ReactNode } from "react";
import type { VaultItem } from "@/lib/vault-context";
import CopyButton from "./CopyButton";

export default function VaultItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: VaultItem;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${item.data.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <div className="text-sm font-medium text-foreground">
            {item.data.title}
          </div>
          <div className="text-xs text-muted">
            {item.data.username || item.data.email || "—"}
          </div>
        </div>
        <span className="text-muted">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border px-4 py-4">
          {item.data.url ? (
            <Field label="URL" value={item.data.url}>
              <a
                href={item.data.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-accent hover:underline"
              >
                {item.data.url}
              </a>
            </Field>
          ) : null}
          {item.data.email ? <Field label="Email" value={item.data.email} /> : null}
          {item.data.username ? (
            <Field label="Username" value={item.data.username} />
          ) : null}
          <div>
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted">
              Password
            </div>
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate font-mono text-sm text-foreground">
                {showPassword
                  ? item.data.password
                  : "•".repeat(Math.min(item.data.password.length, 16))}
              </span>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted hover:border-accent hover:text-foreground"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
              <CopyButton value={item.data.password} label="password" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-accent"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md border border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted">
          {label}
        </span>
        <CopyButton value={value} label={label.toLowerCase()} />
      </div>
      {children ?? <span className="text-sm text-foreground">{value}</span>}
    </div>
  );
}
