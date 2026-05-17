# PE.2 — SLOs, SLIs & Error Budgets

> "Is the app reliable enough?" is an argument until it's a number. An error budget turns reliability from a feeling someone defends loudly into arithmetic nobody can dispute.

## Why this matters

Without an SLO, every reliability conversation is vibes. The careful engineer wants to freeze deploys after one blip; the shipping-pressure founder wants to push through three. Neither has data; the louder one wins; the decision is re-litigated next week. With an SLO and an error budget, the question "should we ship this risky change Friday afternoon?" has a *computed* answer: *we've spent 12% of this month's budget, the change is reversible, ship it* — or *we've spent 95%, freeze.*

Contactly's whole value is "your contacts and your billing are correct and available." That promise needs a number, or it isn't a promise — it's a hope.

## The Principal Engineer lens

**100% reliability is the wrong target — it's infinitely expensive and it stops you shipping.** The right target is the *lowest* reliability your users don't notice, because every nine above that is paid for in velocity you could have spent on the product. An error budget reframes reliability from "never fail" (impossible, paralysing) to "fail less than X, and spend the gap deliberately." Reliability becomes a *resource you allocate*, not a virtue you posture about.

Corollary: **an SLO with no consequence is a vanity metric.** If blowing the budget doesn't *change behaviour* — doesn't freeze risky deploys, doesn't reprioritise the backlog — then it's a dashboard nobody acts on. The budget policy (what happens when it's spent) is the actual artifact. The number is just its trigger.

## Step 1 — SLI before SLO

An **SLI** (Service Level *Indicator*) is a measured ratio: good events ÷ valid events. An **SLO** (Service Level *Objective*) is the target that ratio must hold over a window. You cannot set an SLO for something you don't measure, so the SLI comes first, and it must measure what the *user* experiences, not what's easy to graph.

Contactly's user-facing promises decompose into three SLIs:

| Promise | SLI (good ÷ valid) | Measured at |
|---|---|---|
| "I can use the app" | non-5xx, < 1s responses ÷ all requests to `/app/**` | edge / Vercel logs |
| "My payment works" | successful checkout completions ÷ checkout attempts | Stripe + webhook DB |
| "My data is correct" | webhook events applied exactly once ÷ events received | `stripe_events` table |

Note the third. Availability SLIs are table stakes; the one that actually defends Contactly's promise is *correctness* — a webhook double-applied silently overcharges a customer. Most teams only measure latency/uptime because it's what the tools hand them. The principal move is measuring the SLI that maps to the *promise*, even when it's harder to instrument.

## Step 2 — Set the SLO honestly

Pick targets from *user perception*, not from how many nines sound impressive.

- **App availability: 99.5% monthly.** A contacts CRM is not a pacemaker. 99.5% = ~3.6 hours/month of error budget. 99.99% would be ~4 minutes — and cost you multi-region, redundant providers, and an on-call rotation you do not have at this stage. Buying nines you don't need is the most expensive mistake in this lesson.
- **Checkout success: 99.0% monthly**, excluding legitimately declined cards (a declined card is the *system working*; don't pollute the SLI with it — getting "valid events" right is most of the skill).
- **Webhook correctness: 99.99% monthly.** This one *is* near-pacemaker. A wrong billing state is a refund, a support ticket, and a trust loss. Correctness gets the strict nine; availability doesn't need it. Different promises, different rigour — uniform targets are a smell.

## Step 3 — The error budget is the SLO inverted

Budget = 1 − SLO, over the window.

- 99.5% monthly → **0.5% budget** ≈ 3h 39m of "users seeing errors" per month.
- 99.0% checkout → **1% of attempts** may fail non-decline before the objective is breached.
- 99.99% webhook → **0.01%** — at 50k events/month, *five* mis-applied events spends the entire month.

The budget is not a failure allowance you should *try* to use up. It's a *risk allowance you may deliberately spend on velocity*: a Friday deploy, a migration without a maintenance window, a new provider trial. Spent wisely, the budget is how you ship fast *safely*. Left permanently unspent, it means your SLO is too lax or you're shipping too timidly — both are signals.

## Step 4 — The budget policy (the actual deliverable)

The number is inert without a policy that *changes what you do*. Write this in `docs/slo.md` and treat it as binding:

```markdown
## Contactly Error Budget Policy

Window: rolling 30 days. Reviewed: weekly, in the eng sync.

- Budget > 50% remaining:
  Normal operations. Ship freely. Risky-but-reversible changes OK.
- Budget 10–50% remaining:
  Heightened care. Risky changes require a rollback plan in the PR.
  No schema migration without a tested down-path.
- Budget < 10% remaining:
  Feature freeze. Only reliability work and reversible fixes ship.
  Every merge requires a second reviewer.
- Budget exhausted (SLO breached):
  Hard freeze. The next sprint's top priority is the reliability
  work that refills the budget. A postmortem (PE.3) is mandatory
  for the largest single contributor to the burn.

Burn-rate alert: if 2% of the monthly budget burns in 1 hour,
page on-call immediately — at that rate the month is gone in ~2 days.
```

The policy is the lesson. It pre-decides the Friday-deploy argument *before* the pressure is on, when judgement is clear instead of motivated. That pre-commitment is the entire point — it removes the loudest-voice dynamic from the moment it would otherwise dominate.

## Step 5 — Burn rate beats threshold

Alerting "budget < 10%" tells you *after* the month is mostly lost. **Burn rate** — how fast you're spending relative to "even" — tells you *while you can still act*.

- Burning at 1× = you'll exactly exhaust the budget at month end. Fine by definition.
- Burning at 14× for an hour = a fast, localised regression. Page now; it's a leak, not a flood, and it's cheap to stop early.
- Burning at 2× sustained for a day = a slow degradation that won't trip a threshold alert until it's too late, but compounds. Investigate this week.

Two windows, one alert: page when *both* a fast window (1h) and a slow window (6h) show elevated burn. Fast-only is noise (a transient blip); slow-only is too late. The conjunction is the signal. This is the difference between an alert that wakes you for nothing and one that wakes you in time.

## Step 6 — Wire it to the systems you already have

You do not need a new observability platform for this. Contactly already emits everything required:

- **App availability SLI**: Vercel request logs → non-5xx & latency. A scheduled job rolls the daily ratio into a `slo_daily` table.
- **Checkout SLI**: `stripe_subscriptions` creations ÷ Checkout sessions created (both already recorded).
- **Webhook correctness SLI**: `stripe_events` with a processing-error flag ÷ total — you built this idempotency ledger in Module 6/7; it *is* the SLI source.
- The weekly eng-sync reads the rollup and applies the Step 4 policy. Manual is fine at this scale; the discipline is the point, not the dashboard.

The tooling is deliberately boring. An SLO practice fails from lack of *consequence*, never from lack of Grafana.

## Apply it

- `docs/slo.md` exists with three SLIs, three SLOs, and the budget policy.
- Each SLI defines "valid events" explicitly (declined cards excluded from checkout; health-check traffic excluded from availability).
- The budget policy names a concrete behaviour change at each threshold — not "be careful," but "second reviewer required."
- A burn-rate alert pages on conjoined fast+slow windows, not a single threshold.
- The webhook-correctness SLI is sourced from the `stripe_events` ledger you already built.
- Last week's budget number is known by the team, not just discoverable.

## Common traps

- **Targeting 100%, or copying "five nines."** Infinitely expensive, kills velocity, and buys reliability users can't perceive. Target the lowest nine they don't notice.
- **An SLO with no budget policy.** A metric nobody acts on. The policy — the pre-committed behaviour change — is the deliverable; the number is its trigger.
- **Polluting "valid events."** Counting declined cards as checkout failures, or health checks as user traffic, makes the SLI lie. Defining the denominator correctly is most of the work.
- **Threshold alerts instead of burn rate.** "Budget < 10%" fires after the month is lost. Burn rate fires while you can still act.
- **Uniform SLOs across promises.** Webhook *correctness* needs a strict nine; app *availability* doesn't. Same target everywhere means over-paying for some and under-protecting others.
- **Measuring what's easy, not what's promised.** Latency dashboards because the tool ships them, while the correctness SLI that maps to "we didn't overcharge you" goes uninstrumented.

## Recap

An SLI is a measured good/valid ratio at the point the *user* feels it; an SLO is its target; the error budget is the inverted SLO, spent deliberately on velocity; the budget *policy* — pre-committed behaviour changes per threshold, alerted by burn rate — is the artifact that makes any of it matter. Contactly's strictest objective protects correctness, not uptime, because correctness is the promise. The number ends the argument; the policy is why the number has teeth.

Next: [PE.3 Incident response & blameless postmortems →](./PE.3-incident-response.md)
