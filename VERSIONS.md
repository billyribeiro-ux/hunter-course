# Pinned Versions — May 29, 2026

This course is built against these **exact** versions. If you use newer versions, APIs may have drifted. When you're done, you can upgrade one package at a time and fix breakage incrementally — but don't do that mid-course.

## Why pin?

A Principal Engineer pins everything that can break the build. Floating versions (`^` or `~`) are how 2 AM pages happen. We pin exact versions in `package.json` and commit the lockfile.

## Core stack

| Package | Version | Why this one |
|---|---|---|
| `svelte` | `5.56.0` | Svelte 5 runes stable; latest patch tracking 5.x performance + correctness fixes (May 2026) |
| `@sveltejs/kit` | `2.61.1` | Mature remote functions, async route data, sorted-keys caching |
| `@sveltejs/adapter-vercel` | `6.3.3` | v6 tracks Vercel Fluid Compute defaults and Node 22+ runtimes |
| `@sveltejs/vite-plugin-svelte` | `7.1.2` | Vite-8 compatible Svelte plugin |
| `vite` | `8.0.14` | Vite 8 stable; Rolldown-vite is the default bundler path |
| `typescript` | `6.0.3` | TS 6 baseline; native Node `--experimental-strip-types` parity |
| `tailwindcss` | `4.3.0` | CSS-first config; matched Vite plugin below |
| `@tailwindcss/vite` | `4.3.0` | Official Vite plugin, pinned to match runtime |

## Data & auth

| Package | Version | Why this one |
|---|---|---|
| `@supabase/supabase-js` | `2.106.2` | Latest stable; tracks platform features |
| `@supabase/ssr` | `0.10.3` | Cookie-based SSR client for SvelteKit |
| `supabase` (CLI) | `2.102.0` | Matches hosted platform schema; v2 line |

## Payments

| Package | Version | Why this one |
|---|---|---|
| `stripe` | `22.2.0` | API version `2026-03-25.dahlia` pinned; see `$lib/server/stripe.ts` |
| `@stripe/stripe-js` | `9.7.0` | Browser loader for Stripe Elements (Extras E.4) |
| Stripe CLI | `1.42.1` | For webhook forwarding in local dev |

## Validation & utilities

| Package | Version | Why this one |
|---|---|---|
| `zod` | `4.4.3` | Standard Schema compliant for remote-function validators |
| `nanoid` | `5.1.11` | ESM-only; URL-safe IDs |
| `clsx` | `2.1.1` | Conditional className composition (unchanged — already stable) |
| `tailwind-merge` | `3.6.0` | Resolve Tailwind class conflicts; v3 line matches Tailwind 4 |

## Testing & tooling

| Package | Version | Why this one |
|---|---|---|
| `@playwright/test` | `1.60.0` | Latest stable May 2026 |
| `vitest` | `4.1.7` | Vitest 4; flat config, faster runs |
| `eslint` | `10.4.1` | Flat config only (v9 + v10 both flat) |
| `prettier` | `3.8.3` | With `prettier-plugin-svelte` 4.0.1 |
| `pnpm` | `11.5.0` | Deterministic installs; v11 line |
| `node` | `24.16.0` (LTS "Krypton") | Specified in `.nvmrc` and Volta; current LTS |

## External services (live as of May 29, 2026)

| Service | Version / API | Notes |
|---|---|---|
| Stripe API | `2026-03-25.dahlia` | Pinned via SDK v22 default |
| Supabase Platform | hosted (matches CLI 2.102) | Postgres 17 on new projects |
| Vercel Runtime | Fluid Compute, Node 24 | Default for Node functions |
| GitHub Actions | `ubuntu-24.04` | `actions/checkout@v5`, `actions/setup-node@v6`, `pnpm/action-setup@v5`, `actions/upload-artifact@v5` |

## `package.json` snippet

```json
{
  "engines": {
    "node": ">=24.16 <25",
    "pnpm": ">=11.5"
  },
  "packageManager": "pnpm@11.5.0"
}
```

## Optional / Extras packages

| Package | Version | Used in |
|---|---|---|
| `@sentry/sveltekit` | `10.55.0` | Extras E.15 (error tracking) |
| `@upstash/ratelimit` | `2.0.8` | Extras E.9 (rate limiting; v2 API) |
| `@upstash/redis` | `1.38.0` | Extras E.9 |
| `concurrently` | `10.0.0` | Module 6.3.1 (`dev:all` script) |
| `valibot` | `1.4.1` | Optional alternative to zod for Standard Schema validators |
| `@sveltejs/mcp` | `0.1.23` | Local MCP server for `svelte-autofixer` audits |

## Upgrading later

After you finish the course and ship v1, upgrade in this order:
1. Patch versions of everything (`pnpm up`).
2. Stripe API version (read the migration notes first).
3. SvelteKit minor.
4. Tailwind major (rarely breaks).
5. Svelte major.

Read every changelog. Test every path. Principal Engineers don't yolo-upgrade.
