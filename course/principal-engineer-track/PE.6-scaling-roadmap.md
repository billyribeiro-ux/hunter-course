# PE.6 — The Scaling Roadmap

> The most expensive engineering mistake is not building the wrong thing. It's building the right thing too early — paying its full complexity cost for years before it returns a cent. This lesson is the *order*.

## Why this matters

You now know how to build Contactly, instrument it, defend it, operate it, and price it. The last principal skill is *sequencing*: knowing that multi-region, queues, a read replica, feature flags, a microservice split, and a dedicated cache are all correct — *eventually* — and that adding any of them now is not foresight, it's self-harm. The course said "no" to staging environments, blue-green, canaries, feature flags. This lesson is the systematic version of that "no," and the map of when each "no" becomes "now."

## The Principal Engineer lens

**Complexity is a loan. You pay interest on it every single day until it pays off — and most of it never pays off.** A queue you added "to be safe" is a queue you debug, monitor, secure, and onboard people into, for years, before the load that justified it arrives — if it ever does. The principal doesn't ask "is this good architecture?" (almost everything is, in isolation). They ask "what does this cost me *per day until the day it's needed*, and how confident am I that day comes?"

Corollary: **the order is the strategy.** Any individual scaling move is a known pattern a senior can execute. Knowing which one is *next* — the single highest-leverage addition for the constraint you *actually have*, not the one you fear — is the judgment that doesn't fit in a diff. Optimising a constraint you don't have yet is indistinguishable from procrastinating on the one you do.

## Step 1 — The triggers, not the timeline

There is no "at 10k users do X." Scaling is driven by *observed constraints*, and you already built the instruments that observe them — that's why this lesson is last. The roadmap is a set of triggers, each wired to a signal from an earlier lesson:

| The signal fires (source) | The constraint it reveals | The next move |
|---|---|---|
| Latency SLO burning, traced to read queries (PE.2) | DB read capacity | Add a read replica; route heavy reads to it |
| Cost line growing faster than users (PE.5) | A super-linear access pattern | Fix the N+1 / add the index *first*; infra second |
| Webhook handler approaching timeout under burst (PE.3 runbook) | Synchronous work that should be async | Introduce a queue **for that path only** |
| A second customer segment needs schema you can't migrate safely (PE.1) | The monolithic data model | Split *that bounded context*, not "microservices" |
| Threat model gains a "teams/sharing" boundary (PE.4) | Multi-tenant model insufficient | Re-model first, then build orgs/RBAC |
| Deploy fear rising; rollbacks frequent | Release blast radius | *Now* feature flags earn their cost |

Every row's left column is a signal an earlier PE lesson taught you to *see*. The roadmap is not a plan you follow; it's a set of constraints you let the system *announce*. You build the instrument first so the trigger can fire — which is the entire reason this track ends here.

## Step 2 — Fix the code before you buy the infrastructure

The most common scaling error: reaching for infrastructure to paper over a code defect. The order is non-negotiable:

1. **Fix the access pattern.** An N+1 (E.10), a missing index (E.12's keyset depends on one), an unbounded `select`. This is hours of work and often *removes* the trigger entirely. The read replica you were about to provision was compensating for a query that shouldn't exist.
2. **Add the index / cache the computed thing.** Still code-level, still reversible, still cheap.
3. **Only then, infrastructure.** Replica, queue, partition (you already partitioned `audit_log` in E.14 — that was a code-level retention fix that *avoided* an infra problem; the same instinct generalises).

A queue added on top of an N+1 webhook handler scales the bug. A read replica fronting an unindexed query buys you one doubling and a bigger bill. Infrastructure multiplies whatever pattern you point it at — so the pattern must be correct *before* you multiply it. The senior adds the replica; the principal first asks why the query is slow.

## Step 3 — What to refuse, and the sentence that justifies refusing it

Each of these is correct eventually and wrong now. The skill is the *one-sentence* justification for "not yet," because you will have to say it under pressure from someone who read a scaling blog:

- **Microservices.** "We have one team and one bounded context; a service boundary now is a distributed-systems tax (network failure, partial deploys, distributed transactions) paid daily for a team-coordination benefit we don't yet need." Split when *teams* contend on the codebase, not when the codebase is large.
- **Multi-region.** "Our availability SLO (PE.2, 99.5%) is met single-region; multi-region is a 10× operational complexity step bought to chase a nine our users can't perceive." Revisit when the SLO *demands* it or data-residency law does.
- **A dedicated cache (Redis/etc.).** "Postgres serves our read load within SLO; a cache is a second source of truth, a new failure mode, and a consistency problem added before the database is the constraint." Add when the DB is *measured* as the bottleneck *after* Step 2.
- **Feature flags as infrastructure.** "Small reversible PRs (the course's whole delivery model) keep blast radius low; a flag system is config-as-state, a combinatorial test surface, and dead-flag debt — bought before deploy fear is real." Add when rollback frequency or coordinated-launch needs make the cost worth it (the row in Step 1).
- **A staging environment.** "PR previews against prod-like Supabase already fill this role (Module 12); a hand-maintained staging env is a second prod that drifts and lies." The course already refused this; the refusal generalises.

Notice the shape of every justification: *named cost, paid daily, against a benefit not yet needed, with the trigger that flips it.* That sentence structure is the deliverable of this entire track.

## Step 4 — The reversibility ledger

Map each scaling move by the through-line of this whole track — reversibility × blast radius — because that, not "is it good architecture," decides *when*:

| Move | Reversible? | Blast radius | Therefore |
|---|---|---|---|
| Add an index | Trivially (drop it) | Tiny | Do it the moment data *suggests* it. No ADR. |
| Read replica | Yes (stop routing to it) | Medium | Do it when the read-capacity trigger fires. Lightweight ADR. |
| Introduce a queue | Hard (it becomes load-bearing fast) | Large | Full ADR (PE.1), one path only, behind a trigger. |
| Split a service | Very hard | Very large | ADR + threat re-model (PE.4) + only on the *team* trigger. |
| Multi-region | Very hard | Very large | The most-scrutinised decision you will make. Almost never "now." |

The cheap-and-reversible moves (index, replica) you make *eagerly* the moment the signal appears — waiting is the mistake there. The expensive-and-irreversible moves you delay until the trigger is *undeniable* — acting early is the mistake there. Most engineers invert this: they agonise over the index and sleepwalk into the service split. Calibration, the through-line of the entire track, *is* the skill.

## Step 5 — The roadmap is one page, and it lives in the repo

`docs/scaling-roadmap.md`: the Step 1 trigger table, the Step 3 refusals *with their justifying sentence*, and the Step 4 ledger. One page. Reviewed when a trigger fires — not on a calendar.

Its real purpose is not to predict the future; it is to **pre-load the judgment** so the decision is made with a clear head, exactly like PE.1's ADR, PE.2's budget policy, PE.3's severity ladder, PE.4's re-model trigger, and PE.5's cost triggers. Every PE lesson produces the same artifact in a different domain: *a decision made calmly in advance, with the condition that reopens it written down.* That is, finally, the whole definition of operating at L7 — not knowing more patterns, but having pre-committed the judgment so the moment doesn't have to supply it.

## Step 6 — Then stop, and go build the product

The last and hardest principal skill: knowing that the correct scaling move, almost always, is *none yet — go ship product*. Contactly at two-digit users does not need a queue; it needs the next feature that earns the next customer. This entire track is insurance, not a to-do list. You read it so that when a trigger *does* fire you act from prepared judgment instead of panic — and so that, until it fires, you have the conviction to *not* build the impressive thing and build the useful thing instead.

The senior engineer scales the system. The principal engineer knows the system doesn't need scaling yet, can prove it from the instruments, has written down exactly what would change that, and spends the bought time on the product. That is the job.

## Apply it

- `docs/scaling-roadmap.md` exists: trigger table, refusals-with-justification, reversibility ledger. One page.
- Every trigger's left column maps to a signal an earlier PE lesson taught you to instrument and see.
- You can give the one-sentence "not yet" justification for microservices, multi-region, a cache, and feature flags — each naming the daily cost, the deferred benefit, and the flip condition.
- You can place any proposed scaling move in the reversibility ledger and derive its required ceremony from its cell.
- You can articulate why "fix the access pattern" precedes "buy the infrastructure," with a Contactly example (E.10 N+1, E.14 partitioning).
- Asked "shouldn't we add a queue?", you answer with the trigger that isn't firing — not with an opinion.

## Common traps

- **Building the right thing too early.** Correct architecture, wrong time, full complexity cost paid daily for years before (if ever) it returns. The trap this entire lesson exists to prevent.
- **Infrastructure as a band-aid over a code defect.** A replica on an unindexed query, a queue on an N+1 handler. Step 2 order is non-negotiable; infra multiplies the pattern you point it at.
- **A calendar-driven roadmap ("at 10k users…").** Users are not the constraint; the *observed* constraint is. Triggers fire from instruments, not from a user counter.
- **Inverting the reversibility calibration.** Agonising over the trivially-reversible index while sleepwalking into the near-irreversible service split. The exact backwards of the skill.
- **Refusing without the justifying sentence.** "We're not doing microservices" is dogma. "…because we have one team and one bounded context, and the distributed tax is paid daily for a benefit we don't need until teams contend" is judgment. Under pressure, only the second survives.
- **Scaling the system when the job was to ship the product.** The most impressive-looking and most expensive way to avoid the work that actually grows the company.

## Recap

Scaling is trigger-driven, and every trigger is a signal an earlier PE lesson built the instrument to see — which is why this is the last lesson. Fix the access pattern before buying infrastructure; refuse the premature move with a sentence that names its daily cost and its flip condition; calibrate ceremony to reversibility × blast radius; keep the one-page roadmap as pre-loaded judgment, not a prediction; and then, almost always, conclude that the right move is to go build the product. Knowing more patterns made you senior. Pre-committing the judgment so the moment doesn't have to supply it — *that* is L7.

This is the end of the Principal Engineer Track, and of the course.

Next: [Thank you →](../thank-you.md)
