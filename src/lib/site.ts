// Single source of truth for the site's canonical URL. Resolves in order:
//
// 1. NEXT_PUBLIC_SITE_URL, if you want to force a specific value (e.g. you
//    have multiple domains pointed at this deployment and want one
//    canonical origin).
// 2. Vercel's own VERCEL_PROJECT_PRODUCTION_URL -- automatically set by
//    Vercel to whatever domain (custom domain, or the default *.vercel.app
//    one) is actually assigned as this project's production domain. This
//    updates itself if you rename the project or attach/change a custom
//    domain -- no code change needed.
// 3. A hardcoded fallback, for local dev and any environment where neither
//    of the above is set.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://passten.vercel.app");
