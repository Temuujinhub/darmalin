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

## Notes

- Contact form has no backend: it opens the visitor's email client addressed to `info@dar-rimal.ae` (change in `public/js/main.js` and page footers if the address differs).
- Placeholder email addresses (`info@`, `careers@dar-rimal.ae`) and news items should be updated with real ones as the company goes live.
