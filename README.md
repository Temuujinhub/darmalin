# Dar Al Rimal International Petroleum Trading LLC — Website

Corporate website for **Dar Al Rimal International Petroleum Trading LLC** (دار الرمال العالمية لتجارة البترول ذ.م.م), Dubai, UAE.

Static multi-page site (no build step) served from `public/` via **Cloudflare Workers** static assets.

## Pages

| Page | File |
|---|---|
| Home | `public/index.html` |
| Who We Are | `public/who-we-are.html` |
| What We Do (products & services) | `public/what-we-do.html` |
| Our Impact & Sustainability | `public/sustainability.html` |
| Careers | `public/careers.html` |
| Media & News | `public/media.html` |
| Contact | `public/contact.html` |
| 404 | `public/404.html` |

Shared assets: `public/css/style.css`, `public/js/main.js`, `public/img/logo.svg`.

## Develop & deploy

```bash
npm install
npm run dev     # local preview at http://localhost:8787
npm run deploy  # deploy to Cloudflare Workers
```

The Cloudflare Workers Builds integration (connected to this GitHub repo) deploys automatically on push using `wrangler.jsonc` — no build command required.

To serve the site on `dar-rimal.ae`, add the domain under **Workers & Pages → darmalin → Settings → Domains & Routes** in the Cloudflare dashboard.

## Market data (`/api/prices`)

`src/worker.js` assembles petroleum benchmarks by hub from three public sources; `src/parsers.js` validates every payload (instrument name, plausible range, internal consistency) and drops anything doubtful, so a card is only shown for a quote that passed its checks.

| Source | Hubs | Needs |
|---|---|---|
| NYMEX / ICE futures via Yahoo Finance (stooq fallback) | North Sea, Cushing, New York Harbor, Mont Belvieu, Henry Hub, TTF, JKM | nothing |
| Shanghai INE / SHFE, Dalian DCE via Sina Finance | Shanghai, Dalian | nothing |
| U.S. port spot prices via EIA open data | US Gulf Coast, Los Angeles, New York Harbor | free API key |

To enable the EIA cards, register a free key at https://www.eia.gov/opendata/register.php and add it to the Worker as a secret named `EIA_API_KEY` (Cloudflare dashboard → Workers & Pages → darmalin → Settings → Variables and Secrets), or run `npx wrangler secret put EIA_API_KEY`.

## Request for Quotation (`/api/rfq`)

`public/contact.html` is the RFQ form (product, order type, quantity and unit, Incoterms, destination, payment, company, buyer role, contact, email, phone/WhatsApp, optional LOI/spec upload, notes). The browser validates for quick feedback; `src/rfq.js` validates again on the server and is the authority. The option lists in the page and in `src/rfq.js` must match.

The Worker forwards each valid request to a Google Apps Script web app that appends it to a Google Sheet, saves the attachment to Drive and emails `info@dar-rimal.ae`. The buyer sees "Thank you" only after the sheet confirms the row was written. If it was not (not configured yet, Google error, network), the buyer gets one-tap WhatsApp / email buttons with their request already written out, so no request is lost.

Setup, once:

1. Create a Google Sheet → Extensions → Apps Script. Paste the whole of `docs/rfq-google-apps-script.gs`, Save.
2. Deploy → New deployment → Web app. Execute as: **Me**. Who has access: **Anyone**. Authorize, copy the Web app URL.
3. Cloudflare → Workers & Pages → darmalin → Settings → **Runtime variables and secrets** → Add → Secret `RFQ_WEBHOOK_URL` = that URL → Deploy.

After editing the script later: Deploy → Manage deployments → Edit → Version: New version (keeps the same URL).

## Market news (`/news/`)

The daily fuel market news on the Media page is published automatically by the bot in
[Temuujinhub/twitter-tech-bot](https://github.com/Temuujinhub/twitter-tech-bot) (`src/website/`,
workflow `.github/workflows/website-news.yml`). Once a day it picks an oil/fuel story from official and
primary sources (government agencies, exchanges, state news agencies), has Claude write a short English
article that names and links the source, and commits to this repository:

| File | What |
|---|---|
| `content/news/<date>-<slug>.json` | Article data (text, images, source) — not served; used to rebuild pages |
| `public/news/<date>-<slug>.html` | Article page, built from `templates/news-page.html`, served at `/news/<date>-<slug>` |
| `public/news/img/` | 1–5 images per article (source images with credit, or a generated chart/graphic) |
| `public/news/index.json` | Published articles (also used to avoid repeats, and by the X bot) |
| `public/news/index.html` | Archive of all market news (`/news/`) |
| `public/news/feed.xml` | RSS feed of the latest 30 articles |
| `public/sitemap.xml` | Sitemap of every page and article — regenerated on each publish |
| `public/media.html`, `public/index.html` | The "Market news" block between `<!-- market-news:start -->` and `<!-- market-news:end -->` (6 and 3 latest) — do not edit by hand |

Cloudflare Workers Builds deploys each push to `main`. If you change the site header, footer or head tags, update
`templates/news-page.html` as well (it lives outside `public/`, so it is not served), then re-render every article
without calling Claude: `node src/website/generate.js --site-dir ../darmalin --rebuild` (in the bot repository).

The bot also posts each article on X once, with the article link as the source.

## SEO

- Every page has a unique title and description, a canonical URL, Open Graph/Twitter tags and favicons.
  Internal links use clean URLs (`/what-we-do`, not `what-we-do.html`, which Cloudflare redirects with a 307).
- Structured data (JSON-LD): `Organization` + `WebSite` on the home page, `BreadcrumbList` on inner pages,
  `NewsArticle` on articles, `CollectionPage` on `/news/`.
- `robots.txt` points to `sitemap.xml` (Cloudflare prepends its managed AI-crawler rules).
- One-time setup outside the code:
  1. [Google Search Console](https://search.google.com/search-console): add the `dar-rimal.ae` domain property
     (verify with the DNS TXT record in Cloudflare), then submit `https://dar-rimal.ae/sitemap.xml`.
  2. [Bing Webmaster Tools](https://www.bing.com/webmasters): import the site from Search Console.
  3. Cloudflare → Caching → Configuration → **Crawler Hints** on (tells Bing/Yandex about changes via IndexNow).
  4. Google Business Profile for the Dubai office (Maps and local results for "petroleum trading company Dubai").

## Notes

- Contact form has no backend: it opens the visitor's email client addressed to `info@dar-rimal.ae` (change in `public/js/main.js` and page footers if the address differs).
- Placeholder email addresses (`info@`, `careers@dar-rimal.ae`) and news items should be updated with real ones as the company goes live.
