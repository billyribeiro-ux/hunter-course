# Pinned Versions — April 19, 2026

This course is built against these **exact** versions. If you use newer versions, APIs may have drifted. When you're done, you can upgrade one package at a time and fix breakage incrementally — but don't do that mid-course.

## Why pin?

A Principal Engineer pins everything that can break the build. Floating versions (`^` or `~`) are how 2 AM pages happen. We pin exact versions in `package.json` and commit the lockfile.

## Core stack

| Package | Version | Why this one |
|---|---|---|
| `svelte` | `5.28.2` | Svelte 5 runes stable since Oct 2024; this is the latest patch as of April 2026 |
| `@sveltejs/kit` | `2.55.0` | SvelteKit 2.55 ships stabilized remote functions and sorted-keys caching (April 2026) |
| `@sveltejs/adapter-vercel` | `5.9.0` | Tracks Vercel's Fluid Compute runtime |
| `vite` | `7.2.4` | Vite 7 with rolldown-vite alpha available; 7.2 is the LTS-grade line |
| `typescript` | `5.7.3` | Stable TS with `--erasableSyntaxOnly` support for Node --experimental-strip-types |
| `tailwindcss` | `4.2.0` | CSS-first config; 3.8× faster recompiles; webpack plugin shipped Feb 2026 |
| `@tailwindcss/vite` | `4.2.0` | Official Vite plugin |

## Data & auth

| Package | Version | Why this one |
|---|---|---|
| `@supabase/supabase-js` | `2.103.2` | Latest stable; improved SSR cookie handling |
| `@supabase/ssr` | `0.5.3` | Cookie-based SSR client for SvelteKit |
| `supabase` (CLI) | `1.243.0` | Matches hosted platform schema |

## Payments

| Package | Version | Why this one |
|---|---|---|
| `stripe` | `22.0.2` | API version `2026-03-25.dahlia` pinned; see `$lib/server/stripe.ts` |
| Stripe CLI | `1.26.0` | For webhook forwarding in local dev |

## Validation & utilities

| Package | Version | Why this one |
|---|---|---|
| `zod` | `4.3.6` | 14× faster parsing; Standard Schema compliant for remote-function validators |
| `@zod/mini` | `4.3.6` | Optional ~1.9 KB variant for client-only validation |
| `nanoid` | `5.0.9` | ESM-only; URL-safe IDs |
| `clsx` | `2.1.1` | Conditional className composition |
| `tailwind-merge` | `2.6.0` | Resolve Tailwind class conflicts |

## Testing & tooling

| Package | Version | Why this one |
|---|---|---|
| `@playwright/test` | `1.59.1` | Latest stable April 2026 |
| `vitest` | `3.1.4` | Unit tests (minimal in this course) |
| `eslint` | `9.25.0` | Flat config only |
| `prettier` | `3.5.3` | With `prettier-plugin-svelte` 3.3.3 |
| `pnpm` | `10.11.0` | Deterministic installs |
| `node` | `22.15.0` (LTS) | Specified in `.nvmrc` and Volta |

## External services (live as of April 19, 2026)

| Service | Version / API | Notes |
|---|---|---|
| Stripe API | `2026-03-25.dahlia` | Pinned via SDK v22 default |
| Supabase Platform | hosted (matches CLI 1.243) | Postgres 17 on new projects |
| Vercel Runtime | Fluid Compute | Default for Node functions |
| GitHub Actions | `ubuntu-24.04` | `actions/checkout@v5`, `actions/setup-node@v4`, `pnpm/action-setup@v4` |

## `package.json` snippet

```json
{
  "engines": {
    "node": ">=22.15 <23",
    "pnpm": ">=10.11"
  },
  "packageManager": "pnpm@10.11.0"
}
```

## Upgrading later

After you finish the course and ship v1, upgrade in this order:
1. Patch versions of everything (`pnpm up`).
2. Stripe API version (read the migration notes first).
3. SvelteKit minor.
4. Tailwind major (rarely breaks).
5. Svelte major.

Read every changelog. Test every path. Principal Engineers don't yolo-upgrade.
