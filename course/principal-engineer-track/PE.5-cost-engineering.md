# PE.5 — Cost Engineering & Unit Economics

> An engineer who can't state the cost of one request and one customer is flying the business blind. The architecture that's "free" at 100 users is a five-figure invoice at 100,000 — and you'll find out from the bill, not the design review, unless you do this.

## Why this matters

Contactly runs on Vercel + Supabase + Stripe. Every one of those has a pricing cliff — a point where the curve that was flat goes vertical. The N+1 signed-URL bug from Extras E.10 wasn't only a latency bug; at scale it was a *cost* bug, multiplying Storage API calls by your busiest users. Cost is not a finance concern bolted on later; it is an architectural property you either reason about up front or get surprised by in production.

The principal skill is not frugality. It's *knowing the number* — so that "this is fine" and "this will bankrupt us at 10×" are statements of fact, not vibes.

## The Principal Engineer lens

**Every architectural decision is also a cost decision, whether or not you priced it.** Serverless: you traded fixed server cost for per-invocation cost, which is a discount at low volume and a tax at high volume. Supabase over self-hosted Postgres: you bought operational simplicity with a margin on every row and every GB egress. These were correct trades (see ADR-0006) — but a trade you didn't price is a trade you didn't actually make; you just deferred the invoice.

Corollary: **the unit that matters is cost per customer, not cost per month.** A total bill is a number you can't act on. *Cost to serve one Plus customer for one month* is a number you can compare to the $10 they pay — and that comparison is the entire business. An engineer who optimises the bill without knowing the per-customer margin is optimising blind.

## Step 1 — Cost the request before the customer

Start at the smallest unit: one user action. Trace "open the contacts page" through the bill.

| Resource consumed | Priced as | Notes |
|---|---|---|
| 1 Vercel serverless invocation (SSR + remote fns) | per-invocation + GB-seconds | duration matters: a slow handler costs *more*, twice |
| N Postgres queries via Supabase | included until the connection/compute tier | the N is the lever — see Step 2 |
| 1 batched signed-URL Storage call (post-E.10 fix) | per Storage API op | the *un*fixed N+1 was N ops here — a cost bug, not just latency |
| egress: the rendered page + avatars | per GB out | avatars dominate; the E.10 client-side resize cut this ~100× |

Two findings fall out immediately. First, **latency and cost are the same axis on serverless** — the slow handler is billed for its slowness in GB-seconds, so PE.2's latency SLO is *also* a cost control. Second, **the E.10 resize and batch fixes were unit-economics fixes**: a 12 MB avatar served raw is egress you pay for on every render, forever; the 15 KB WebP is the same feature at 1% of the cost. A correctness review that ignores cost is half a review.

## Step 2 — Find the cliffs before you fall off them

Every provider's pricing is flat then vertical. Name Contactly's cliffs *now*, while they're far away and cheap to design around:

- **Supabase compute/connection cliff.** The free/small tier serves a few hundred concurrent users; past it you step compute tiers. The lever is *queries per request*. The N+1 from E.10 doesn't just slow page loads — it drags you toward this cliff at a fraction of the user count. Fixing N+1s is buying runway before the cliff, not just shaving milliseconds.
- **Vercel invocation/bandwidth cliff.** Generous, then metered. The lever is *bytes shipped* (the E.10 resize) and *handler duration* (the PE.2 latency SLO). Same two fixes, again.
- **Stripe is the benign one.** Percentage-of-transaction: it scales *with revenue by construction*, so it never surprises you — Stripe gets more expensive only when you're making more money. Knowing *which* costs scale with revenue (safe) versus with usage (dangerous) is the core of the discipline.

The pattern: the dangerous cliffs are the ones priced by *usage*; the safe ones are priced by *revenue*. An architecture whose cost scales with usage and whose price scales with revenue has a margin that *erodes as it grows* — the worst possible shape, and invisible until the curves cross.

## Step 3 — Build the per-customer model

One table in `docs/unit-economics.md`. Estimates are fine; *having the model* is the point — a wrong model you update beats no model you defend.

```markdown
## Cost to serve one Plus customer / month (order-of-magnitude)

Assumptions: ~500 contacts, ~40 sessions/mo, ~15 page loads/session,
avatars resized (E.10), queries batched (no N+1).

  Vercel invocations + GB-s        ~ $0.05
  Supabase compute share + storage ~ $0.10
  Storage egress (resized avatars) ~ $0.02
  Stripe fee on $10 (2.9% + 30¢)   ~ $0.59   <- scales WITH revenue
  Email (Resend, transactional)    ~ $0.01
  Sentry event share               ~ $0.01
  --------------------------------------------
  ~ $0.78 to serve, on $10 revenue  → ~92% gross margin

## The number that ends arguments
A debate over a $0.02/customer optimisation is noise at 92% margin
and 200 customers. The same debate at 100k customers and a thinner
margin is the roadmap. Same change, opposite priority — the model,
not the opinion, tells you which world you're in.
```

The model's job is not precision; it's *converting architecture arguments into arithmetic*. "Should we cache this?" has no answer. "Caching this saves $0.03/customer/month, which is $0 today and $36k/year at 100k customers" has one — and it tells you to write it down and revisit, not to do it now.

## Step 4 — Spend the optimisation budget like the error budget

PE.2 taught: don't buy reliability users can't perceive. The mirror: **don't buy cost savings the business can't feel.** At 92% margin and a two-digit user count, an afternoon shaving $0.02/customer is an afternoon stolen from product — the single most expensive thing an early-stage engineer can optimise is the bill instead of the product.

The discipline is a *trigger*, not a prohibition (same shape as ADR "revisit when," SLO burn, threat-model re-trigger):

```markdown
## Cost re-examination triggers
- A single line item exceeds 15% of cost-to-serve.
- Cost-to-serve exceeds 25% of revenue (margin < 75%).
- Any cost line is growing faster than user count
  (super-linear → an N+1, an unbounded query, a missing index, a leak).
- We are within 1 user-growth doubling of a named provider cliff.
```

The third trigger is the load-bearing one. A cost growing *with users* is fine and expected. A cost growing *faster than users* is a bug with an invoice — an N+1, an unbounded `select`, a missing index, a leak — and it is found in the *cost* graph long before it's found in the latency graph, because the bill integrates what a p99 chart smooths over.

## Step 5 — Make cost observable, cheaply

You do not need a FinOps platform at this stage; you need the number to be *known*, not *discoverable*.

- Monthly, record each provider's actual bill and the active-customer count in `docs/unit-economics.md`. Two numbers, twelve rows a year.
- The ratio (total ÷ customers) is your real cost-to-serve. Watch its *slope*, not its value. Flat or falling as you grow: healthy. Rising: a Step-4 trigger has silently fired and the model needs a visit.
- Tag the largest serverless functions and the heaviest queries (you already identified them for PE.2's SLIs and Module 12's build-log review — the instrumentation is shared, not new).

The recurring pattern across this whole track: the tooling is deliberately boring and mostly already in place. These practices die from absent *consequence*, never from absent dashboards.

## Apply it

- `docs/unit-economics.md` exists with a per-customer cost model and a monthly bill/customer-count log.
- You can state cost-to-serve one Plus customer and the resulting gross margin as numbers.
- You can name each provider's pricing cliff and the architectural lever that controls distance to it.
- You can classify every cost line as scaling-with-revenue (safe) or scaling-with-usage (watch).
- The re-examination triggers are written down; the "growing faster than users" one is understood as a bug detector, not a finance metric.
- You can explain why the E.10 resize + batch fixes were *unit-economics* fixes, not just performance ones.

## Common traps

- **Optimising the bill instead of the product, early.** At 92% margin and two-digit users, engineering hours are worth orders of magnitude more on product. Frugality is not the skill; *knowing the number* is.
- **Tracking the monthly total.** An un-actionable number. Cost *per customer* is the one you can compare to price and act on.
- **Not knowing which costs scale with revenue vs usage.** Revenue-scaling costs (Stripe) never surprise you; usage-scaling costs do. The whole risk lives in the second category.
- **Treating an N+1 as only a latency bug.** It's a cost bug *and* a cliff-accelerator. The cost graph catches super-linear growth the p99 chart hides.
- **No per-customer model because "the numbers are guesses."** A wrong model you update each month beats no model. The artifact's job is turning architecture arguments into arithmetic, not being precise.
- **Discovering the cliff from the invoice.** The cliffs are public and knowable today. Naming them while they're far away is the entire exercise.

## Recap

Cost the request, then the customer; find the usage-priced cliffs while they're distant; build a per-customer model whose job is converting architecture debates into arithmetic; spend the optimisation budget only where the business can feel it, triggered — not prohibited — by a cost growing faster than users; and keep the number *known* with two boring numbers a month. Latency and cost are one axis on serverless, so half the work was already done by PE.2. The architecture that's free at 100 users is a decision you priced — or a bill you didn't see coming.

Next: [PE.6 The scaling roadmap →](./PE.6-scaling-roadmap.md)
