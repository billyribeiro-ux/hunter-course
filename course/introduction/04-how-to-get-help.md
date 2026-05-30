# Introduction — How to Get Help

> The best debug tool is patience. The second best is asking well.

## When something breaks

Nine times out of ten, it's one of these five things:

1. **Versions drift.** Run `node -v`, `pnpm -v`, and `cat VERSIONS.md`. Compare.
2. **Env vars missing.** Did you copy `.env.example` → `.env.local` and fill in *all* values? Did you restart `pnpm dev` after editing?
3. **Services not running.** Is Supabase up? Is the Stripe listener forwarding? Is Docker running?
4. **Stale build cache.** Delete `.svelte-kit/` and restart.
5. **You skipped a step.** No judgment. Read the previous lesson again slowly.

A 10-minute re-read is almost always faster than a 30-minute debug.

## Ask a good question

When something is genuinely broken, the quality of help you get matches the quality of the question you ask. Paste:

- The command you ran.
- The **full** error (not "it doesn't work").
- Your `VERSIONS.md` and the relevant `package.json` snippet.
- The file and the commit you're on.

Example of a great question:

> On lesson 6.3 (Create Webhook Endpoint), after running `stripe listen --forward-to localhost:5173/api/webhooks/stripe`, I POSTed a `customer.subscription.created` event via `stripe trigger`. The endpoint returns `400 Invalid signature`. My `PRIVATE_STRIPE_WEBHOOK_SECRET` is copied from the output of `stripe listen` (starts with `whsec_…`). I restarted `pnpm dev`. Node 24.16, pnpm 11.5, stripe-node 22.2.0. Stack trace attached.

A Principal Engineer would help that person. A "this doesn't work, halp!" message gets a shrug.

## Where to ask

- **Course Discord** (link on course homepage) — #support channel, searchable.
- **GitHub Discussions** on this repo — good for long-form, indexable questions.
- **The usual suspects**: SvelteKit Discord, Supabase Discord, Stripe Discord.

Do not DM strangers on Twitter. They will not answer, and you have better options.

## Reading the source

Whenever the course says "here's the file":

1. Read it.
2. Type it (paste is fine, but read as you paste).
3. Run it.
4. *Then* read the commentary.

Your eyes will skip over prose you don't need; they'll slow down on code that breaks. That's exactly right.

Next: [The Principal Engineer mindset →](./05-principal-engineer-mindset.md)
