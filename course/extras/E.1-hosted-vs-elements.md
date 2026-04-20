# E.1 — Hosted Checkout vs Stripe Elements

> Before you spend a weekend rebuilding checkout from scratch, read this. The trade-off is real.

## Why this matters

The rest of the Extras module shows you how to build a fully custom cart + checkout flow — the kind of multi-step, branded experience you see on Simpler Trading, Superhuman, Linear. It's gorgeous. It's also four to six times the code of hosted Stripe Checkout, and it ships with a longer list of things that can go wrong.

This lesson isn't about code. It's the decision framework: when does the extra effort pay off, and when are you just recreating Stripe's work worse?

## The Principal Engineer lens

**Default to Stripe's hosted path. Deviate only with a specific reason.** Hosted Checkout is built by a team of hundreds of Stripe engineers, tested across every country / card network / bank / accessibility tool. Your 200-line replacement will never be as good — it will only be *different*, in ways that matter for your brand.

Corollary: **"it looks nicer" is not a sufficient reason.** Nicer in whose eyes? Yours? Your investors'? Actual customers pass through checkout in ~90 seconds and never remember what it looked like — they remember whether it worked. If you're going to build custom, build for a *measured* reason: higher conversion, fewer support tickets, a specific regulatory requirement, a design-system requirement that hosted can't meet.

## Step 1 — What hosted Checkout gives you

Out of the box:

- **Pixel-perfect across devices**, including the weirdest small-screen cases.
- **Localised** to 30+ languages and currencies.
- **Apple Pay / Google Pay** with zero config.
- **3D Secure (SCA)** handled invisibly where required.
- **PCI compliance** by Stripe (you never touch card numbers).
- **Tax collection** in all ~100 countries Stripe Tax supports.
- **Coupons, trials, address collection, shipping, invoicing** — all opt-in flags.
- **Accessibility** to WCAG 2.1 AA.
- **Future features** added automatically when Stripe ships them (BNPL, crypto, new wallets).

You get all of this with ~50 lines of Node code (the checkout-session creator from Module 9.1).

## Step 2 — What Stripe Elements gives you

The embedded approach — rendering `<PaymentElement />` inside your own page — gives you:

- Full control over layout, typography, spacing, colour.
- The cart sidebar can stay visible during the payment step.
- Multi-step forms (sign-in → billing → payment) with your own progress UI.
- Custom copy at any point in the flow.
- In-page error rendering next to the field that errored.
- Conversion optimisation experiments you control (field order, wording, CTAs).

What you lose:

- You handle session state (cart contents, checkout progress, recovery on abandonment).
- You write the sign-in / billing-address / payment steps.
- You handle 3DS redirects, Apple Pay / Google Pay integration, tax computation.
- You own the accessibility work.
- You own i18n.
- Every Stripe feature update requires you to re-read the Elements changelog.

Elements handles the card-field UI itself (a Stripe-served iframe, so you stay PCI-compliant), but *everything around it* is your code.

## Step 3 — When hosted is the right answer

Hosted Checkout wins if:

- You sell one thing at a time (one subscription, or one product → one checkout).
- Your customers are distributed globally — hosted's auto-localisation is a massive lift.
- You have limited frontend engineering capacity.
- You haven't measured that checkout is your conversion bottleneck.
- Your brand tolerates Stripe's (heavily customisable) default layout with your logo and colour.

For ~90% of SaaS products, that's the winning position. Contactly would happily ship the hosted path forever.

## Step 4 — When Elements is the right answer

Elements wins if:

- You have a **multi-product cart** (e.g. Simpler Trading's trading-room subscriptions *plus* one-off courses). Hosted Checkout can do multi-line items, but doesn't persist a cart across a browsing session; you'd need custom cart-to-Checkout translation anyway.
- You want the **cart visible during payment** — the "I can still see what I'm buying" reassurance that increases conversion on higher-priced products.
- You've **A/B-tested hosted vs custom** and measured custom wins. (Rare but possible.)
- You have a **regulated requirement** that hosted can't meet (e.g. healthcare-specific form fields inline with billing).
- You're building a **product-led-growth** flow where the user has already been on-boarded, and the checkout needs to feel like step N+1 of their in-app journey, not a redirect to a new domain.
- You have the engineering bandwidth to maintain it.

The Simpler Trading screenshot we're modelling after is the classic Elements use case: a multi-product cart, a stepper with pre-auth sign-in, and a persistent shopping-cart sidebar.

## Step 5 — The "dual-path" compromise

There's a middle way: keep hosted Checkout for most flows, build Elements only where the conversion lift justifies it.

For Contactly, that'd look like:

- `/pricing` → click Upgrade → **hosted Checkout**. (Simple, one product.)
- `/checkout` (new, future flow for multi-product purchases) → **custom Elements**. (Cart + stepper.)

Both flows hit the same webhook. Same DB tables. Same entitlement logic. Only the UI that collects payment differs. The user sees whichever is more appropriate for the flow they're in.

This is the path we recommend most teams take. Ship hosted first; add Elements for the one or two flows where a cart really matters.

## Step 6 — The honest cost comparison

Rough engineering-days estimate:

| Feature | Hosted Checkout | Stripe Elements |
|---|---|---|
| Initial integration | 0.5 day | 3 days |
| Multi-step stepper | n/a (Stripe does it) | 1 day |
| Cart sidebar | n/a | 1 day |
| Coupon support | 0.1 day (flag) | 1 day |
| Apple Pay / Google Pay | 0 (auto) | 2 days |
| 3DS redirect handling | 0 (auto) | 1 day |
| i18n for 10 languages | 0 (auto) | 5+ days |
| Accessibility audit | 0 (auto) | 2 days |
| Keeping up with Stripe changes | 0 | ~1 day / quarter |
| **Total to v1 parity** | **~0.5 day** | **~16 days** |

That's 32x the effort for visual parity. The *only* reason to pay that cost is if your custom version delivers something hosted can't — and you've confirmed customers want it.

## Step 7 — How to decide in 60 seconds

Answer these four questions. If you answer "no" to any, stay on hosted.

1. Does your product need a **multi-item cart** (not just a single-subscription purchase)?
2. Have you seen **measurable evidence** that your users want a different checkout experience (session recordings, support tickets, abandon-cart surveys)?
3. Do you have **at least one frontend engineer** who can own this for its lifetime?
4. Are you ready to **keep pace with Stripe's Elements changelog** — reviewing it each quarter and adjusting?

Four yeses and you can build Elements with confidence. Any "no" and hosted is the rational choice.

## Verify

- You can articulate in one sentence why hosted vs Elements is the right call for your product.
- You know which features come free from hosted and which you'd own with Elements.
- You've identified which flows (if any) in your own app justify Elements.

## Common traps

- **Building Elements because "we're custom by default."** Then every bug is yours. Then every Stripe changelog update is homework. Defaults exist for a reason.
- **Building Elements for visual reasons that a design-system application could solve.** Hosted Checkout's theming is deep — fonts, colours, spacing, button shapes. Try that first.
- **Treating Elements as a one-time build.** It isn't. It's a quarterly maintenance task for the life of the product.
- **Underestimating localisation.** English-first engineering teams routinely ship checkout flows that can't render yen, ₹, or RTL languages. Hosted has solved this; Elements hasn't until *you* solve it.

## Recap

Hosted is the default. Elements is the exception. The rest of this module teaches Elements because some products need it — but the very first step is being sure yours is one of them.

If you're reading on: excellent. Contactly-the-tutorial will ship Elements specifically to teach the pattern, even though Contactly-the-product would probably stay hosted. Pick up in E.2.

Next: [E.2 The cart store and cart sidebar component →](./E.2-cart-store-sidebar.md)
