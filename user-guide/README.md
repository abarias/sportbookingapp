# MMG Stellar Booking Platform User Guide

Official user-facing documentation for customers and staff. The guide is generated from one structured scenario catalog in `data/content.js` and is isolated from the production Next.js application.

## Local use

```bash
cd user-guide
npm run dev
```

Open `http://127.0.0.1:4175`. Use `PORT=4190 npm run dev` if the default port is occupied.

## Update and verify

1. Update persona/scenario content in `data/content.js`.
2. Start the booking application locally or point `GUIDE_APP_URL` to a designated non-production environment.
3. Capture screenshots with synthetic accounts:

```bash
GUIDE_APP_URL=http://localhost:3000 \
GUIDE_CUSTOMER_EMAIL=synthetic-customer@example.test \
GUIDE_CUSTOMER_PASSWORD='use-a-local-secret' \
GUIDE_SUPER_ADMIN_EMAIL=synthetic-admin@example.test \
GUIDE_SUPER_ADMIN_PASSWORD='use-a-local-secret' \
npm run screenshots
```

Credentials are read at runtime and are never written to the screenshot manifest. The capture script only navigates existing pages; use designated UAT/staging accounts and data.

```bash
npm run release
```

Generated PDFs are written to `output/pdf/`. The HTML deployment is written to `dist/`, with downloadable PDF copies under `dist/downloads/`.

## Separate Vercel project

1. Create a new Vercel project from this repository.
2. Set **Root Directory** to `user-guide`.
3. Keep the framework preset as **Other**.
4. Use `npm run build` as the build command and `dist` as the output directory. `vercel.json` already declares these values.
5. No environment variables are needed for the static production guide.
6. Add the documentation subdomain in Vercel and create the requested DNS record with the domain provider.

Do not deploy `.env` files, screenshot credentials, Playwright traces, or screenshots containing real personal/payment data. Recapture the guide after material route, label, permission, or workflow changes.
