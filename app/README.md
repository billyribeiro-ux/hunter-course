# Contactly (reference app)

The finished app from the course. If you're reading this because something in your own build doesn't match, diff against this directory.

## Run it

```bash
cp .env.example .env.local
pnpm install
pnpm supabase:start       # starts local Postgres + Auth
pnpm supabase:types       # generate TS types from schema
pnpm stripe:seed          # seeds Stripe products/prices (needs stripe secret key)
pnpm stripe:listen        # in a second terminal: forwards webhook events
pnpm dev                  # http://localhost:5173
```

## Test it

```bash
pnpm test                 # Playwright E2E
pnpm check                # svelte-check
pnpm lint                 # prettier + eslint
```

## Ship it

Push to `main` on a fork connected to Vercel; the GitHub Action in `.github/workflows/deploy.yml` handles the rest.
