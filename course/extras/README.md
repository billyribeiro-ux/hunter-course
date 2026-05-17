# Extras — Function Enhancements

> Optional lessons that take Contactly from "shipped" to "polished." Each one enhances a function you already have — not a new feature, a better version of an existing one.

These lessons are independent. Pick the ones that match your product's priorities. Nothing here is required for Contactly to run in production; everything here is how you turn a working product into a *good* product.

## The spine of this module

The centrepiece is a **custom cart + multi-step checkout** built with Stripe Elements. Instead of sending users to Stripe's hosted Checkout, we render every step in our own UI — a Simpler Trading-style layout with a persistent shopping-cart sidebar, a Sign-in / Billing / Payment stepper, and embedded Stripe Elements for the card fields.

The cart and checkout span four lessons because they're one coherent redesign, not a sprinkle of tweaks. Read them in order.

## The lessons

### Custom cart + checkout (Simpler Trading style)

- [E.1 Hosted Checkout vs Stripe Elements — the trade-off](./E.1-hosted-vs-elements.md)
- [E.2 The cart store and cart sidebar component](./E.2-cart-store-sidebar.md)
- [E.3 The three-step checkout stepper](./E.3-checkout-stepper.md)
- [E.4 Embedded payment with Stripe Elements](./E.4-stripe-elements-payment.md)

### The credit-card toggle

- [E.5 One flow, two trials — with and without a card](./E.5-trial-with-without-card.md)

### Other enhancements

- [E.6 Optimistic UI for contacts](./E.6-optimistic-ui.md)
- [E.7 CSV import for contacts](./E.7-csv-import.md)
- [E.8 Keyboard shortcuts](./E.8-keyboard-shortcuts.md)
- [E.9 Rate limiting sensitive endpoints](./E.9-rate-limiting.md)

### Advanced — scale, data & operations

These go deeper: object storage, full-text search, flat-time pagination, realtime, an immutable audit trail, and production error tracking. They fill the gaps the core course deliberately deferred.

- [E.10 Contact avatars with Supabase Storage](./E.10-avatars-supabase-storage.md)
- [E.11 Full-text contact search](./E.11-fulltext-search.md)
- [E.12 Cursor pagination & infinite scroll](./E.12-cursor-pagination.md)
- [E.13 Realtime contact sync](./E.13-realtime-sync.md)
- [E.14 Audit log](./E.14-audit-log.md)
- [E.15 Error tracking with Sentry](./E.15-error-tracking-sentry.md)

## How to read this module

Each Extras lesson assumes you've finished Modules 1–13. They build on existing code — the remote functions from Module 4, the Stripe integration from Module 6, the entitlements from Module 10, and the toast system from Module 13.1.

You don't have to implement all of them. You *do* have to decide which ones fit your product. The [E.1 trade-off lesson](./E.1-hosted-vs-elements.md) is the one to read before committing a weekend to embedded Stripe Elements — it's not always the right choice.

Back to: [course index ←](../README.md)
