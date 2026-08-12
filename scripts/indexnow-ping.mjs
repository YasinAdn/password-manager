// Notifies IndexNow-participating search engines (Bing, Yandex, and others
// -- notably NOT Google, which has never adopted this protocol) that the
// site's public pages have changed, so they can crawl sooner rather than
// waiting for their own schedule. No account or console needed: ownership
// is proven by hosting the key file below at the site root, which ties it
// to this one key -- the plain-text key file itself has nothing sensitive
// in it. Run after any content change to the public pages:
//
//   node scripts/indexnow-ping.mjs

const SITE_URL = "https://passten.vercel.app";
const KEY = "a38fa356fe6bd9762b8e18ef93bac539";
const KEY_LOCATION = `${SITE_URL}/${KEY}.txt`;

const urlList = [SITE_URL, `${SITE_URL}/privacy`];

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(SITE_URL).host,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  }),
});

console.log(`IndexNow ping: ${res.status} ${res.statusText}`);
if (!res.ok) {
  console.log(await res.text());
  process.exit(1);
}
