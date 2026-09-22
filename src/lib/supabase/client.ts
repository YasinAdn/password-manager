import { createBrowserClient } from "@supabase/ssr";
import { MockSupabaseClient } from "./mock-supabase";

/**
 * Returns an active Supabase client. If environment variables are missing,
 * set to mock sandbox values, or unconfigured, falls back to the MockSupabaseClient
 * for 100% offline local sandbox testing.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isMockSandbox =
    !url ||
    !key ||
    url.includes("mock-sandbox") ||
    url.includes("YOUR_SUPABASE") ||
    url.includes("example.com") ||
    key.includes("mock-anon-key");

  if (isMockSandbox) {
    return new MockSupabaseClient() as unknown as ReturnType<typeof createBrowserClient>;
  }

  try {
    return createBrowserClient(url, key);
  } catch (err) {
    console.warn("Supabase browser client init failed, falling back to Sandbox Mock client:", err);
    return new MockSupabaseClient() as unknown as ReturnType<typeof createBrowserClient>;
  }
}
