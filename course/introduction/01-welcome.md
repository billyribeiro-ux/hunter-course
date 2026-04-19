# Introduction — Welcome

> If you can code along with this course, you can ship a real SaaS. If you read it thoughtfully, you'll ship a *well-engineered* one.

## What this course is

This is the course I wish I'd had when I first tried to ship a SaaS.

Most tutorials teach you to collect a payment. Yay. Then they end — right at the point where the interesting problems begin. What happens when a user upgrades? How do you prevent free-trial abuse? Where should entitlements live — in your DB, in Stripe, or in your app? How do you deploy this without bricking production users? How do you write it so the person who joins your team six months from now can reason about it?

We'll answer all of that, with code.

We'll build **Contactly** — a lightweight contact-management SaaS with:

- Email + password auth (Supabase).
- Row-level security so users physically cannot read each other's contacts.
- A public **/pricing** page that loads real prices from Stripe.
- Three tiers (Free, Plus $10/mo, Pro $20/mo) with **dynamic pricing** — no hard-coded price IDs.
- **Free trials** with or without a payment method.
- A **Stripe Customer Portal** for self-service upgrades/cancels.
- **Tier-based access control** in the UI *and* on the server — features are visible-but-restricted, with upgrade CTAs.
- **End-to-end tests** that run in CI against a local Supabase.
- A real **CI/CD pipeline** that pushes Supabase migrations and deploys to Vercel.

Everything is written with **SvelteKit 2.55 remote functions**, Svelte 5 runes, TypeScript, Zod 4, and Tailwind 4.

## What "Principal Engineer Level 7+" means in this course

A Principal Engineer is not someone who knows every API. It's someone who:

1. **Picks the right abstraction** for the current size of the problem — and doesn't over-engineer when simpler would do.
2. **Designs for the sad path** (network flakes, webhook retries, partial failures) as much as for the happy path.
3. **Writes code that the next person can read** — including themselves in six months.
4. **Pins what matters, loosens what doesn't**. Versions, API contracts, DB schemas.
5. **Tests the important parts** — not to hit coverage, but to sleep at night.

We'll apply those instincts at every step. You'll see me stop mid-build to ask: *"should we do this now, or later?"* That is the course.

## What you need to know

- **Comfortable**: SvelteKit basics (routes, loads, forms), TypeScript, HTML/CSS.
- **Helpful but not required**: any previous exposure to Supabase or Stripe.
- **Not required**: being a senior engineer. If you can read code and follow instructions, you can finish this. We teach every pattern from first principles.

## What you need installed

We'll walk through installation in Lesson 1.1, but here's the short list:

- **Node.js 22.15 LTS** (install via `fnm`, `volta`, or direct download)
- **pnpm 10.11+** (`corepack enable` then `corepack use pnpm@10.11.0`)
- **Git**
- **Docker Desktop** (for running Supabase locally)
- **VS Code** or your editor of choice (we'll set up recommended extensions)
- **A Stripe account** (free, test mode)
- **A Supabase account** (free tier fine for the final deploy)
- **A Vercel account** (free hobby tier fine)

Don't install them yet — we'll do it together.

## A word on pace

Take each lesson one at a time. Type the code yourself; don't just paste it. Read the commentary. If a concept doesn't click, the course's Discord is the place to ask. Most importantly: **when something breaks, don't skip ahead.** The debugging *is* the learning.

On to [what we're building →](./02-what-were-building.md)
