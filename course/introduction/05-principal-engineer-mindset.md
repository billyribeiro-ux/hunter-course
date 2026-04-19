# Introduction — The Principal Engineer Mindset

> Skills make you fast. Mindset makes you right.

Before we write a line of code, let's calibrate the lens we'll look through for the rest of the course.

## 1. The boring choice is usually the right one

Postgres, not a fancy new DB. Stripe, not a boutique billing startup. SvelteKit's built-in features, not an exotic plugin. Boring choices have the largest community, the best documentation, and the most Stack Overflow answers at 2 AM. You spend your weirdness points on the problem that's actually *your* value-add — not on your bill pipeline.

## 2. Types are the cheapest tests

A Zod schema at a boundary is a free test that runs every single request. A TypeScript type on a function argument is a free test that runs every single build. We won't write a unit test for every function — we'll use types aggressively and write E2E tests where types can't go.

## 3. RLS is a safety net, not a shortcut

Row-Level Security in Postgres enforces "user can only read their own rows" **at the database**. If you forget it in one route, the DB still blocks the bad query. We'll set RLS policies on every table from day one. But we'll still check permissions in the application layer — defense in depth.

## 4. Stripe is the source of truth. Your DB is the cache.

Stripe knows more about a customer's subscription than you ever will. Retries, proration, failed payments, disputes — all of it lives in Stripe. Our job is to mirror the subset we need, keep it fresh via webhooks, and **never write to our mirror from application code**. Webhooks write. App reads.

## 5. Entitlements live separate from identity

Whether the user is logged in is an *identity* question. Whether they can add a 6th contact is an *entitlement* question. Don't conflate them. We'll have `getActiveTier(userId)` and `tierLimit(tier)` as distinct, testable functions — not a 40-line `if (user.stripeCustomerId && user.subscription && user.subscription.status === 'active' …)` inside a component.

## 6. Every mutation needs three things

1. **Validation** at the boundary (Zod).
2. **Authorization** checked explicitly (not by accident).
3. **Idempotency** assumed, especially for Stripe webhooks.

If a mutation is missing one of those, it's a ticking bomb.

## 7. Make the sad path a first-class citizen

- What if the network fails during checkout?
- What if Stripe retries the same webhook twice?
- What if the user clicks "Delete" and then their laptop sleeps?
- What if two tabs are open and both submit the form at the same time?

We'll ask these questions out loud in every module. You can't answer every one — but you can stop pretending they won't happen.

## 8. Version pinning is kindness

Your future self, your teammates, your CI pipeline: they all thank you for pinning. `^1.2.3` means "surprise me on Tuesday." `1.2.3` means "no surprises." We pin.

## 9. Write code for the reader, not the writer

Your code will be read **far** more often than it's written. A slightly longer variable name, an extra one-line comment explaining *why* (never *what*), a function split into two smaller ones — these are gifts to the next person.

## 10. Ship something you'd stake your name on

At the end of this course you'll have an app in production with your name attached via commits. That's not a drill. Treat every lesson like you're building the real thing, because you are.

Now — onto Module 1.

Next: [Module 1 — Project Setup →](../module-01-project-setup/1.1-sveltekit-project-setup.md)
