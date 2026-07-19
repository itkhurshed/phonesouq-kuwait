# PhoneSouq Kuwait — Deploy Guide

A complete, self-contained electronics & mobile e-commerce storefront for the Kuwait market: `index.html` + `css/style.css` + `js/*.js` + `assets/products/*`. No build step, no backend — everything runs from static files.

## What's included

- **~893 products** across 13 departments (Smartphones, Tablets, Smartwatches, Audio, Computer & Office, Gaming, Smart Home, Home Appliances, Personal Care, Cameras, Tools & DIY, Outdoor & Auto, Accessories):
  - **194 branded items** across **115 real phone brands** (Apple, Samsung, Xiaomi, and 112 more, grouped into Major Global / Chinese & Asian / Rugged & Specialist / Regional / Classic-Discontinued).
  - **700 real photographed products** from the two catalogues you supplied (`Mohammad_200_Electronics_Home_Gadgets_KWD.zip` + `Mohammad_500_More_Electronics_Photos_KWD.zip`), each with its real photo and the KWD price from your `price_list.csv` files, sold under the store's own **PhoneSouq** house brand (with Essential/Plus/Pro/Premium tiers where your data provided them). Photos live in `assets/products/a/` and `assets/products/b/` (~51 MB total) and are regenerated from the original ZIPs by `.build_catalog.py` into `js/catalog-real.js` if you ever need to re-run it with updated prices.
  - **Note from your supplied README files**: these 700 products are described as *"generic, unbranded catalogue concepts"* with *"suggested"* KWD prices, *"not verified live retail quotations"* — worth a quick sanity pass on pricing/supplier cost before the site goes fully live.
- **Professional catalog browsing**: category departments, 115-brand directory, search, price/rating/brand filters, sort, and **pagination ("Load More", 24 at a time)** so the browser never has to render nearly 900 cards at once.
- **Kuwaiti Dinar pricing** (`KD 000.000`), no VAT (confirmed Kuwait has ruled it out before 2028). Checkout: KNET / Card / Cash on Delivery, Kuwait governorate + area fields, free delivery over KD 25.
- **Customer accounts (users management)**: sign up / log in, editable profile, password change, and an order history tied to the account — all under **My Account** (person icon in the header, or the footer link).
- **Security measures** (see caveats below): passwords are SHA-256 hashed client-side before storage (never stored in plain text), a password-strength meter on signup, and brute-force lockout (5 failed attempts → 60-second lock) on **both** the customer login and the admin login.
- **Admin portal**: **username `admin`, password `P@ssw0rd`** — now accessed only via a small, discreet ⚙️ icon fixed at the bottom-left of every page (no longer in the main navigation or footer), per your request. Manage products (with photo upload), view orders, and a live analytics dashboard.
- **WhatsApp integration**: a floating WhatsApp chat button (bottom-right, every page), a "💬 Ask on WhatsApp" button on every product with the product name/price pre-filled, a "Chat with us about this order" link on the order confirmation screen, and a WhatsApp link on the "forgot password" prompt.
- **Order tracking, animations, dark mode** — unchanged from before, now covering the full catalog.

## Before you go live — please do these

1. **Set your real WhatsApp Business number.** It's currently a placeholder: `WHATSAPP_NUMBER = '96550000000'` near the top of `js/app.js`. Replace it with your real number (digits only, country code, no `+`/spaces).
2. **Change the admin password.** `admin` / `P@ssw0rd` is a demo credential documented on the login screen itself — change `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `js/app.js` before sharing the site.
3. **Verify the 700 imported prices/costs** against your actual suppliers — your own README flagged them as suggested, unverified figures.
4. **Optimize the product photos for the web** before a real launch: 700 JPGs at ~50–100 KB each is fine, but converting to WebP and adding a CDN (Cloudflare/Netlify both do this automatically) will noticeably speed up first load.

## Security — what's real here and what isn't

This is a static site with no backend, so "security system" here means the client-side layer: hashed (not plain-text) passwords, a strength meter, and login lockouts. That's honest UX, but it is **not** production-grade security:

- Passwords are hashed with SHA-256 in the browser (Web Crypto API) purely so nothing is stored as plain text in `localStorage` — this is not a substitute for server-side bcrypt/argon2 hashing with per-user salts.
- The lockout counters live in the visitor's own `localStorage`, so clearing browser storage resets them — real rate-limiting has to happen server-side.
- There's no real session/auth boundary since there's no server; anyone with the admin password (or browser dev tools) can see everything a normal user can.
- **For a real launch**: put authentication behind a real backend (hashed + salted server-side, HTTPS-only, server-side rate limiting), and treat everything in this guide as a working prototype of the *user experience*, not a security boundary.

## Go live in ~2 minutes (free, no account needed)

**Netlify Drop**: go to https://app.netlify.com/drop and drag this whole folder onto the page — you'll get a live URL immediately.
**Vercel**: `npm i -g vercel`, then run `vercel` from inside this folder.
**GitHub Pages**: push this folder to a repo → Settings → Pages → `main` branch, `/ (root)`.

All three work because the site is 100% static (note: at ~51 MB, mostly product photos, this is still well within Netlify/Vercel/GitHub Pages' free limits).

## Re-running the automated tests

An automated end-to-end smoke test (`.selftest.js`, hidden file in this folder) now covers: the merged 893-product catalog, pagination, real-photo rendering, all 13 category departments, the 115-brand directory, the full Kuwait checkout (KNET/COD/Card), order tracking, admin login + lockout, and the entire customer-accounts flow (signup, duplicate-email rejection, wrong-password rejection, login, profile update, password change, checkout prefill, logout), plus the WhatsApp links. It currently passes **40/40 checks** with zero JavaScript errors.

```bash
npm install jsdom
node .selftest.js
```

## Customizing

- **Real-catalog data**: regenerate `js/catalog-real.js` from the original ZIPs by re-running `python3 .build_catalog.py` (edit the category-mapping dictionaries at the top of that script if you add more product types).
- **Branded phone catalog**: `FEATURED_RAW`, `SECONDARY_RAW`, `TABLET_RAW`, `WATCH_RAW`, `BRAND_GROUPS_RAW` in `js/app.js`.
- **Admin login**: `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `js/app.js`.
- **WhatsApp number**: `WHATSAPP_NUMBER` in `js/app.js`.
- **Lockout policy**: `MAX_ATTEMPTS` / `LOCK_MS` in `js/auth.js`.
- **Pagination size**: `PAGE_SIZE` in `js/app.js` (currently 24 per page).
- **Delivery pricing**: `FREE_DELIVERY_THRESHOLD` / `DELIVERY_FEE` in `js/app.js`.

## Sources

- [Kuwait VAT implementation update — vatcalc.com](https://www.vatcalc.com/kuwait/kuwait-election-means-vat-implementation-unlikely-soon/)
- [Kuwait government rules out VAT — Fiscal Solutions](https://fiscalsolutions.co.uk/news/kuwait-government-rules-out-the-implementation-of-vat/)
- [Kuwait — Corporate — Other taxes, PwC Worldwide Tax Summaries](https://taxsummaries.pwc.com/kuwait/corporate/other-taxes)
