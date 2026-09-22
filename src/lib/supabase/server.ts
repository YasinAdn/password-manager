import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { MockSupabaseClient } from "./mock-supabase";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !url ||
    !key ||
    url.includes("mock-sandbox") ||
    url.includes("YOUR_SUPABASE") ||
    url.includes("example.com")
  ) {
    return new MockSupabaseClient() as unknown as ReturnType<typeof createServerClient>;
  }

  const cookieStore = await cookies();

  try {
    return createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component -- safe to ignore
          }
        },
      },
    });
  } catch (err) {
    return new MockSupabaseClient() as unknown as ReturnType<typeof createServerClient>;
  }
}
