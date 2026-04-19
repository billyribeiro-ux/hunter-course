# Contactly — Modern SaaS Course (April 2026 Edition)

> Build a production-grade, tier-based SaaS contact-management app the **Principal Engineer Level 7+** way — explained like you've never coded before, then refined until it's the codebase you'd stake your career on.

This repo is both a **course** (read it front-to-back) and a **reference app** (copy it file-by-file). Every lesson ends with code you can diff against `/app` to see if you got it right.

## What you're building

**Contactly** is a multi-tier SaaS for managing personal contacts, backed by:

- **SvelteKit 2.55** with **remote functions** (the hot April 2026 feature)
- **Svelte 5 runes** (`$state`, `$derived`, `$effect`, `$props`)
- **Supabase** (Postgres + Auth + RLS) via `@supabase/ssr`
- **Stripe** subscriptions with **dynamic pricing** (no hard-coded price IDs)
- **TypeScript** end-to-end, **Zod 4** at every boundary
- **Tailwind CSS 4** (no config file — CSS-first)
- **Playwright** E2E tests, running against Supabase local in CI
- **GitHub Actions → Vercel** CI/CD pipeline with ephemeral Supabase

Users can register, manage contacts (CRUD with RLS), upgrade to Free/Plus/Pro tiers, start free trials (with or without payment method), self-serve upgrades/downgrades via Stripe Customer Portal, and get their UI gracefully restricted by tier.

## Who this is for

You should be **familiar** with SvelteKit, TypeScript, and web development. You do **not** need to know Stripe, Supabase, RLS, remote functions, CI/CD, or any of the Principal-Engineer-grade practices we'll cover — we teach those from zero.

If you've never coded before, work through [Module 0 — Prerequisites](./course/module-00-prerequisites/README.md) first.

## How to use this repo

### Option A — Build it yourself (recommended)

1. Fork this repo.
2. Open `course/README.md` and start at Module 1.
3. Each lesson has all the code inline. Type it (or paste it), then run it.
4. When stuck, diff your `app/` against the reference `app/` in the `reference` branch.

### Option B — Clone and run

```bash
git clone https://github.com/YOUR_USER/contactly.git
cd contactly/app
cp .env.example .env.local   # fill in Supabase + Stripe keys
pnpm install
pnpm supabase:start
pnpm dev
```

## Repo layout

```
hunter-course/
├── README.md                    # you are here
├── LICENSE                      # MIT
├── VERSIONS.md                  # exact pinned versions (April 19, 2026)
├── CONTRIBUTING.md              # how to contribute fixes
├── course/                      # every lesson as plain markdown
│   ├── README.md                # course outline + navigation
│   ├── introduction/
│   ├── module-01-project-setup/
│   ├── module-02-integrate-sveltekit-supabase/
│   ├── ...
│   └── thank-you.md
└── app/                         # the final working Contactly app
    ├── package.json
    ├── src/
    ├── supabase/
    ├── tests/
    └── .github/workflows/
```

## Course outline

Full outline with links → [`course/README.md`](./course/README.md)

13 modules. ~65 lessons. Every line of code explained.

## Versions pinned (April 19, 2026)

See [`VERSIONS.md`](./VERSIONS.md) for the exact `package.json` / service versions we use. **Do not use newer versions** while following the course — APIs drift, and a broken tutorial is a rage tutorial.

## License

MIT. Ship it, fork it, sell it, teach with it. Attribution appreciated, not required.

---

Made with absurd attention to detail, because that's how Principal Engineers ship.
