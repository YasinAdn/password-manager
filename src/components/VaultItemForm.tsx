"use client";

import { useState, type FormEvent } from "react";
import type { VaultItemData } from "@/lib/crypto";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

export default function VaultItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: VaultItemData;
  onSave: (data: VaultItemData) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        url: url.trim() || undefined,
        email: email.trim() || undefined,
        username: username.trim() || undefined,
        password,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div>
        <label className={labelClass} htmlFor="item-title">
          Website name
        </label>
        <input
          id="item-title"
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="item-url">
          URL (optional)
        </label>
        <input
          id="item-url"
          className={inputClass}
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="item-email">
          Email
        </label>
        <input
          id="item-email"
          type="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="item-username">
          Username (if applicable)
        </label>
        <input
          id="item-username"
          className={inputClass}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="item-password">
          Password
        </label>
        <div className="flex gap-2">
          <input
            id="item-password"
            type={showPassword ? "text" : "password"}
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="shrink-0 rounded-lg border border-border px-3 text-xs text-muted hover:border-accent"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className={`${primaryButtonClass} w-auto px-5`}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`${secondaryButtonClass} w-auto px-5`}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
