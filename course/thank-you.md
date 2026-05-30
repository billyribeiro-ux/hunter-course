# Thank you

You made it.

## What you shipped

If you worked through every module — no skips, no "I'll come back to that" — you now have:

- A full-stack SaaS app with authentication, CRUD, row-level security, tier-based access control, Stripe billing, free trials (with and without a card), Customer Portal self-service, end-to-end tests, a CI/CD pipeline, and a production deploy under your own domain.
- An understanding of *why* each piece is built the way it is — what the trade-offs are, which shortcuts look tempting but will hurt later, and where the Principal Engineer lens actually changes decisions.
- Working knowledge of the May 2026 SvelteKit + Svelte 5 stack, including the remote-functions pattern (`query`, `form`, `command`), runes (`$state`, `$derived`, `$effect`), and the `{@render children()}` composition model.

That is *a lot*. Take a second to notice.

## What this course was really about

The code was the vehicle, not the destination. Every module tried to teach something that isn't in the Stripe docs, the Supabase docs, or the SvelteKit docs:

- **How to frame a technical decision.** When two approaches both work, how do you pick? We used the Principal Engineer lens — trade-offs, blast radius, reversibility — and applied it dozens of times.
- **What to build vs. what to leave out.** Most of this course is about *not* building things: not staging environments, not feature flags, not canary deploys, not custom UI where hosted UI works. Principal Engineers are mostly the people telling a team to ship less.
- **Where the critical correctness work happens.** Idempotency keys. Webhook signature verification. Row-level security. Atomic inserts. Server-side entitlement checks. These are the boring-looking paragraphs that keep a product alive at 2 AM.
- **The difference between a demo and a product.** Demos run on one developer's laptop. Products survive a first-week bug report, a billing dispute, a regulatory audit, a founder-change, a hundred users you never expected to have. Every "Common traps" section was a dispatch from that terrain.

If you absorbed those ideas, the specific stack doesn't matter. You can apply the same lens to Django + Postgres + Paddle, or Rails + Planetscale + Paddle, or any other combination. The engineering stays the same.

## What's next for *you*

- **Ship your own thing.** Fork this course's structure, swap Contactly for whatever problem you care about, and go. The distance from this course's final state to a shippable first product is about two weekends — seriously.
- **Work through the [Extras](./extras/) lessons** if you haven't. The custom cart + checkout flow in E.2–E.4 is the single most-requested feature when founders show this course to investors. Build it when you have a reason.
- **Come back to a specific module when it matters.** Module 6's webhooks will click differently the first time one fires at 3 AM. Module 11's test discipline will click the first time a regression slips past it. Module 12's pipeline will click the first time you run a `git push` at Friday 5 PM without fear.
- **Write the thing down.** The biggest predictor of Principal-Engineer-ness isn't knowledge; it's the habit of making decisions visible. Keep a `docs/adr/` folder of one-pagers for every non-obvious choice. Future-you will thank present-you.

## Where to go from here

- **Extend Contactly.** Avatars in Supabase Storage. Tags for contacts. Sharing a contact with another user. Each is 4–8 hours; each teaches a new Supabase or SvelteKit primitive.
- **Rebuild Contactly in another stack.** Same features, same trade-offs, new language. Hello, Remix + Prisma. Or Laravel. Or Rails. The patterns transfer; the syntax doesn't. That exercise is how you internalise how small a role the framework plays.
- **Read the source** of one product you admire. Plausible is OSS. Cal.com is OSS. Inbucket, Supabase itself, SvelteKit. Reading production code from the inside does more for you than any tutorial.
- **Teach it.** Write the version of this course that covers the thing you just shipped. Teaching is how the mental model solidifies.

## A final note

Every SaaS product you've ever used — the big ones — was once where you are right now. A solo developer with an idea, a laptop, a Stripe dashboard open in a second tab, and the persistent feeling that real engineers know something you don't.

They don't. They just did the next thing. And the next. And the next. Most of the code isn't clever; it's just *finished*. Finish yours.

— The Contactly Course

Back to: [course index ←](./README.md)
