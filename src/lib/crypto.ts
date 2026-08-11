import { argon2id } from "hash-wasm";

// Shape of a single vault entry once decrypted. This whole object is what
// gets encrypted together as one JSON blob per row -- nothing about a saved
// credential is readable server-side, not even the site name.
export interface VaultItemData {
  title: string;
  url?: string;
  email?: string;
  username?: string;
  password: string;
}

const ARGON2_ITERATIONS = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_MEMORY_KIB = 19456; // ~19 MiB -- OWASP's minimum recommended Argon2id profile
const ARGON2_HASH_LENGTH = 32; // 256-bit key for AES-256-GCM

function bufToBase64(buf: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary);
}

function base64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

/** Random 16-byte salt for a new user's Argon2id derivation, base64-encoded. */
export function generateSaltBase64(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bufToBase64(salt);
}

/**
 * Derives the vault's AES-256-GCM key from the master password, entirely in
 * the browser. The master password and this key never leave the client --
 * Supabase only ever sees the encrypted blobs produced with it.
 */
export async function deriveKey(
  masterPassword: string,
  saltB64: string,
): Promise<CryptoKey> {
  const salt = base64ToBuf(saltB64);
  const keyBytes = await argon2id({
    password: masterPassword,
    salt,
    iterations: ARGON2_ITERATIONS,
    parallelism: ARGON2_PARALLELISM,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: "binary",
  });
  // hash-wasm's binary output type predates TypeScript's ArrayBuffer-pinned
  // Uint8Array generic; it's always backed by a real ArrayBuffer at runtime.
  return crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypts a vault item into the {ciphertext, iv} pair stored in `vault_items`. */
export async function encryptItem(
  key: CryptoKey,
  data: VaultItemData,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  return {
    ciphertext: bufToBase64(new Uint8Array(ciphertextBuf)),
    iv: bufToBase64(iv),
  };
}

/**
 * Decrypts a vault item. Throws if `key` doesn't match the data it was
 * encrypted with (AES-GCM's auth tag check fails) -- callers use this to
 * detect a wrong master password during unlock.
 */
export async function decryptItem(
  key: CryptoKey,
  ciphertextB64: string,
  ivB64: string,
): Promise<VaultItemData> {
  const iv = base64ToBuf(ivB64);
  const ciphertext = base64ToBuf(ciphertextB64);
  const plaintextBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  const json = new TextDecoder().decode(plaintextBuf);
  return JSON.parse(json) as VaultItemData;
}
