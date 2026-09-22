import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // In Sandbox Mock mode, bypass server-side Supabase middleware check
  // and allow client-side MockSupabaseClient to handle authentication & routing.
  if (
    !url ||
    !key ||
    url.includes("mock-sandbox") ||
    url.includes("YOUR_SUPABASE") ||
    url.includes("example.com")
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const protectedPrefixes = ["/vault"];
    const isProtected = protectedPrefixes.some((p) =>
      request.nextUrl.pathname.startsWith(p),
    );

    if (!user && isProtected) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }
  } catch (err) {
    console.warn("Middleware updateSession exception (sandbox fallback):", err);
    return NextResponse.next({ request });
  }

  return supabaseResponse;
}
