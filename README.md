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

## Notes

- Contact form has no backend: it opens the visitor's email client addressed to `info@dar-rimal.ae` (change in `public/js/main.js` and page footers if the address differs).
- Placeholder email addresses (`info@`, `careers@dar-rimal.ae`) and news items should be updated with real ones as the company goes live.
