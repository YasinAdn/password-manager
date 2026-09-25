"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Papa from "papaparse";
import type { VaultItemData } from "@/lib/crypto";
import { heroActionCardClass, secondaryButtonClass } from "@/lib/ui";
import { sanitizeSafeUrl } from "@/lib/validation";

// Common header names across password-manager CSV exports (Chrome, Bitwarden,
// LastPass, generic). Matching is case-insensitive against these aliases.
const HEADER_ALIASES: Record<keyof VaultItemData, string[]> = {
  title: ["title", "name", "website", "site", "website name"],
  url: ["url", "login_uri", "uri", "website url"],
  email: ["email", "email address"],
  username: ["username", "login_username", "user", "user name"],
  password: ["password", "login_password"],
};

type FieldMap = Partial<Record<keyof VaultItemData, string>>;

function buildFieldMap(headers: string[]): FieldMap {
  const normalized = headers.map((h) => ({ raw: h, norm: h.trim().toLowerCase() }));
  const map: FieldMap = {};
  for (const field of Object.keys(HEADER_ALIASES) as (keyof VaultItemData)[]) {
    const match = normalized.find((h) => HEADER_ALIASES[field].includes(h.norm));
    if (match) map[field] = match.raw;
  }
  return map;
}

function rowToItem(
  row: Record<string, string>,
  fieldMap: FieldMap,
): VaultItemData | null {
  const get = (field: keyof VaultItemData) => {
    const col = fieldMap[field];
    return col ? (row[col] ?? "").trim() : "";
  };
  const title = get("title");
  const password = get("password");
  if (!title && !password) return null; // blank row

  const rawUrl = get("url");
  const safeUrl = rawUrl ? sanitizeSafeUrl(rawUrl) || undefined : undefined;

  return {
    title: title || "Untitled",
    url: safeUrl,
    email: get("email") || undefined,
    username: get("username") || undefined,
    password,
  };
}

type Status =
  | { state: "idle" }
  | { state: "importing" }
  | { state: "done"; succeeded: number; failed: number }
  | { state: "error"; message: string };

// The CSV file is read and parsed entirely in the browser (FileReader +
// Papa.parse) -- nothing about it is uploaded anywhere. Each row is
// encrypted individually through the normal addItem() path before it ever
// reaches Supabase, same as adding one entry by hand.
export default function CsvImport({
  onImport,
  variant = "default",
  className,
}: {
  onImport: (
    items: VaultItemData[],
  ) => Promise<{ succeeded: number; failed: number }>;
  variant?: "default" | "hero";
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file again later
    if (!file) return;

    setStatus({ state: "importing" });
    try {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      });
      if (parsed.errors.length) {
        setStatus({
          state: "error",
          message: parsed.errors[0].message || "Could not parse that CSV.",
        });
        return;
      }

      const fieldMap = buildFieldMap(parsed.meta.fields ?? []);
      if (!fieldMap.password) {
        setStatus({
          state: "error",
          message: 'No "password" column found in that CSV.',
        });
        return;
      }

      const items = parsed.data
        .map((row) => rowToItem(row, fieldMap))
        .filter((item): item is VaultItemData => item !== null);

      if (items.length === 0) {
        setStatus({
          state: "error",
          message: "No rows with a password were found.",
        });
        return;
      }

      const result = await onImport(items);
      setStatus({ state: "done", ...result });
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Import failed.",
      });
    }
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".csv,text/csv"
      className="hidden"
      onChange={handleFile}
    />
  );

  if (variant === "hero") {
    return (
      <div className={`flex flex-col items-center gap-2 ${className ?? ""}`}>
        {fileInput}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={status.state === "importing"}
          title="Parsed entirely in your browser -- never uploaded raw"
          className={heroActionCardClass}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-accent transition-transform duration-200 group-hover:scale-110"
          >
            <path d="M12 3v12" />
            <path d="m7 8 5-5 5 5" />
            <path d="M5 21h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1" />
            <path d="M5 21a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h1" />
          </svg>
          <span className="text-sm font-semibold text-foreground">
            {status.state === "importing" ? "Importing…" : "Import CSV"}
          </span>
          <span className="text-xs text-muted">
            From Chrome, Bitwarden, LastPass, or similar
          </span>
        </button>
        {status.state === "done" ? (
          <span className="text-xs text-muted">
            Imported {status.succeeded}
            {status.failed ? `, ${status.failed} failed` : ""}
          </span>
        ) : null}
        {status.state === "error" ? (
          <span className="text-xs text-danger">{status.message}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      {fileInput}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={status.state === "importing"}
        title="Parsed entirely in your browser -- never uploaded raw"
        className={`${secondaryButtonClass} w-auto px-3 py-1.5 text-xs`}
      >
        {status.state === "importing" ? "Importing…" : "Import CSV"}
      </button>
      {status.state === "done" ? (
        <span className="text-xs text-muted">
          Imported {status.succeeded}
          {status.failed ? `, ${status.failed} failed` : ""}
        </span>
      ) : null}
      {status.state === "error" ? (
        <span className="text-xs text-danger">{status.message}</span>
      ) : null}
    </div>
  );
}
