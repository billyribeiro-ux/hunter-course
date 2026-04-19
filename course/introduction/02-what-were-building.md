# Introduction — What We're Building

> A concrete spec, so every decision downstream has a reason.

## The app in one paragraph

**Contactly** is a SaaS for managing personal contacts. Anyone can register. Free users get 5 contacts. Plus users ($10/mo) get 25. Pro users ($20/mo) get unlimited, plus features a Pro user cares about (SSO, 24/7 support). Paying users can upgrade, downgrade, pause, or cancel themselves through the Stripe Customer Portal. Free trials are offered for paid tiers — optionally with or without a payment method — and we block the obvious abuse vectors.

## The app in screens

1. **Home** (`/`) — Hero + three feature cards. Signed-in users see a "Go to contacts" CTA; signed-out users see "Get started free."
2. **Register** (`/register`) — Name + email + password + confirm.
3. **Login** (`/login`) — Email + password.
4. **Pricing** (`/pricing`) — Three plan cards, Monthly/Yearly toggle, prices loaded from our Stripe mirror.
5. **Contacts** (`/contacts`) — Grid of contact cards. New / Edit / Delete modals. Upgrade banner when the tier limit is hit.
6. **Account** (`/account`) — Current plan + Manage Billing, personal details, email, password, sign out.

## The data in one picture

```
auth.users ──┬── public.profiles  (1:1, auto-created by trigger)
             │
             ├── public.contacts  (1:many, RLS "user_id = auth.uid()")
             │
             ├── public.billing_customers  (1:1, user_id → stripe_customer_id)
             │
             └── public.billing_subscriptions  (1:many)
                                │
                                └─ references billing_prices → billing_products
```

The two `billing_*` catalog tables mirror Stripe. Webhooks keep them in sync. The app never round-trips to Stripe on render.

## The tech — and why

| Choice | Why |
|---|---|
| **SvelteKit 2.55 remote functions** | Co-locates data + mutations with components. Type-safe end-to-end. No more `+page.server.ts` dance for every little action. |
| **Svelte 5 runes** | Explicit reactivity (`$state`, `$derived`). Same mental model client and server. |
| **Supabase (Postgres + Auth + RLS)** | RLS is the most under-used security win in web dev. We lean on it hard. |
| **Stripe** | Still the gold standard for SaaS billing, especially subscriptions + trials. |
| **TypeScript + Zod 4** | Validate every server boundary. Types flow from DB → Zod → UI. |
| **Tailwind 4** | CSS-first, no config file, 3–5× faster builds. |
| **Playwright** | Real browser, real network. Tests that catch real bugs. |
| **GitHub Actions → Vercel** | Free, fast, and the pipeline becomes your source of truth. |

We pin every one of these in [`VERSIONS.md`](../../VERSIONS.md). When you upgrade later, do it on purpose.

## The budget

- Development: **$0**. Every external service has a free tier big enough to build this.
- Production: **$0** at the scale of "me and my friends." Vercel hobby + Supabase free + Stripe pay-as-you-go.

## The timeline

If you work through this end-to-end: **10–20 hours**, spread however you like.

Next: [Prerequisites →](./03-prerequisites.md)
