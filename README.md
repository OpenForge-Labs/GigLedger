# GigLedger

Mobile-first PWA for delivery and ride partners. GigLedger tracks real ₹/hour
after fuel across Zomato, Swiggy, Uber, Rapido, and Ola.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` (or the Network URL on your phone).

Production / installable PWA:

```bash
npm run build
npm run preview
```

## Features

| Screen | What |
|--------|------|
| **Home** | Aaj ka real kamai/hour, day arrows, per-platform table |
| **Log Order (+)** | Platform, ₹, km, minutes (or timer), edit/delete |
| **Weekly** | Last 7 days totals + ₹/hr bar chart by platform |
| **Settings** | Mileage, petrol ₹, **Export / Import JSON**, Reset |

Orders and settings work locally without an account. The optional API adds
account sign-in and a one-way backup of local data to PostgreSQL.

## Formula

```
real ₹/hr = (earnings − fuel cost) ÷ hours
fuel cost = (distance_km ÷ mileage_km_l) × petrol_price
```

Defaults: **40 km/l**, **₹105/l**. If hours = 0 → “Log your first order” (never NaN).

## Data and privacy

- Orders and settings are stored in browser localStorage by default.
- Account sync is opt-in and requires the API plus PostgreSQL.
- Session tokens are kept in an httpOnly cookie; the server stores only a
	SHA-256 digest of each session token.
- **Export JSON** is the local backup. Use it before clearing browser data or
	switching phones.

## API development

Create a local environment file from the safe template, then configure a
PostgreSQL connection in `server/.env`:

```bash
Copy-Item .env.example server/.env
npm run db:generate
npm run db:migrate
npm run server:dev
```

The Vite client defaults to `http://localhost:3001` for the API and can be
pointed elsewhere with `VITE_API_URL`. Do not commit `server/.env` or real
credentials.

## Validation and scripts

```bash
node scripts/checklist.mjs
npm run lint
npm run build
```

`npm run preview` serves the production build locally. `npm run server:start`
starts the API, and `npm run db:deploy` applies committed Prisma migrations in
deployment environments.

## Install on Android Chrome

1. Open the app in Chrome (localhost or HTTPS)
2. ⋮ → **Install app** / **Add to Home screen**
3. Works offline mid-route via service worker
