# PE.3 — Incident Response & Blameless Postmortems

> An outage is going to happen. The only variable you control is whether it's a panic you improvise or a procedure you execute — and whether the organisation is smarter afterward or just more afraid.

## Why this matters

The error budget from PE.2 will, eventually, get spent in a single bad afternoon: a migration locks `contacts` at peak, a Stripe webhook secret rotates and silently 400s for six hours, a deploy ships a broken RLS policy and one user sees another's data. In that hour, the difference between a ten-minute blip and a trust-destroying saga is entirely about *whether you had decided what to do before it happened*.

You built every safeguard the rest of the course teaches. This lesson is the admission that they will, someday, all be insufficient at once — and the procedure for that day.

## The Principal Engineer lens

**Incident response is a skill you rehearse, not a doc you write.** A runbook nobody has executed is fiction. The principal contribution is not authoring the procedure — it's running the drill so that, under real adrenaline, the team executes muscle memory instead of inventing process while customers are down.

Corollary: **blame makes systems less safe.** The instant a postmortem can end someone's standing, every future incident gets hidden, minimised, or reported late — exactly when speed and honesty matter most. A blameless culture is not kindness; it is the only configuration in which you reliably *learn* from failure instead of *burying* it. Punishing the human guarantees the *system* flaw survives to recur.

## Step 1 — Severity, declared out loud

Most damage happens in the ambiguous minutes where nobody has said the word "incident" and everyone assumes someone else is handling it. Kill the ambiguity with a severity ladder and a rule: **anyone may declare; declaring is never wrong.**

| Sev | Definition (Contactly-concrete) | Response |
|---|---|---|
| **SEV1** | Data integrity or cross-user exposure. Wrong billing state applied; one user sees another's contacts. | All-hands now. Page everyone. Public status note. |
| **SEV2** | Core flow down for all users. Login broken; checkout 500s; app un-loadable. | Incident commander + responders now. |
| **SEV3** | Degraded or partial. Slow but working; one non-critical feature broken. | Normal hours, prioritised above feature work. |

SEV1 is defined by *correctness/exposure*, not volume — one user seeing another's data is SEV1 even if it's one user, because it's the promise PE.2 protected with the strictest nine. Declaring early and downgrading is *free*; declaring late is the entire cost of the incident.

## Step 2 — Roles, even if it's two people

Improvisation fails because everyone debugs and nobody coordinates, or vice versa. Separate the roles even when the same person wears two hats — naming the hat changes the behaviour.

- **Incident Commander (IC)** — owns the *response*, not the fix. Decides, delegates, time-boxes, communicates. The IC's hands are off the keyboard; the moment the IC starts debugging, coordination dies and the incident lengthens.
- **Operator** — the only person changing the system. One set of hands on production prevents two fixes colliding into a worse state.
- **Scribe** — timestamps everything in one channel. The scribe is writing the postmortem *as it happens*, when memory is accurate, not reconstructing it days later when it's a story.

Solo at 3 a.m.? You are IC and Operator — but *say so*, in writing, in the channel: "I'm IC+Operator on this." Naming the roles is what triggers the disciplined behaviour even alone.

## Step 3 — The runbook, executable not aspirational

A runbook is a checklist that works when you are frightened, sleep-deprived, and have a customer on the phone. That means concrete commands, not "investigate the database."

```markdown
## RUNBOOK: Stripe webhooks failing (no subscription updates)

Symptom: customers pay, tier doesn't change. stripe_events stops growing.

1. STOP THE BLEEDING (target: < 5 min)
   - Stripe dashboard → Developers → Webhooks → check last delivery + error.
   - 400s? → signing secret mismatch. Compare Stripe's secret to Vercel
     STRIPE_WEBHOOK_SECRET (prod scope). Re-copy, redeploy.
   - Timeouts? → handler is slow/erroring. Check Vercel function logs
     for api/webhooks/stripe.

2. ASSESS BLAST RADIUS
   - SELECT count(*) FROM stripe_events WHERE created_at > <incident_start>;
   - List affected customers: paid in Stripe, no matching
     stripe_subscriptions row in the window.

3. RECOVER (do NOT hand-edit billing rows)
   - Fix root cause (secret/deploy), then Stripe dashboard →
     resend the failed events. Idempotency ledger (Module 6/7)
     makes replay safe — that ledger exists for exactly this.

4. VERIFY
   - Affected customers now have correct tier. Spot-check three.
   - stripe_events resuming.

5. COMMUNICATE
   - Scribe: log resolution time. IC: status update.
```

Every step is an action, a target time, and a guardrail ("do NOT hand-edit billing rows"). Notice step 3 *relies on* the idempotency ledger you built in Module 6/7 — the runbook is where defensive engineering pays out. A runbook that says "investigate" is a runbook that has never been run.

## Step 4 — Communicate on a schedule, not on progress

The instinct under pressure is to go silent and fix. Silence is read as "they don't know it's broken" — which converts a technical incident into a trust incident. The discipline: **communicate on a fixed cadence regardless of whether there's news.**

- SEV1/2: external status update every 30 minutes, even if the update is "still investigating, next update by HH:MM." A heartbeat with no news still says *we are on it and we are honest*.
- Internal: the scribe's channel is the single source of truth. No side-DMs — they fragment the picture and the IC loses the thread.
- Never say "fixed" until *verified* (runbook step 4). A premature all-clear that reopens is far more corrosive to trust than a longer, honest outage.

## Step 5 — The blameless postmortem

Within 48 hours of any SEV1/2, a written postmortem. Append-only, in `docs/postmortems/`, alongside the ADRs and the SLO doc — the operational memory lives with the code.

```markdown
# Postmortem: Webhook outage 2026-05-14

- Severity: SEV2 | Duration: 14:02–17:38 UTC (3h36m)
- Budget impact: spent ~38% of May availability budget
- Author: @oncall  | Status: action items open

## Impact
~120 customers paid and did not receive their tier for up to 3h36m.
All recovered via event replay. No data loss. No incorrect charges.

## Timeline (UTC)
14:02 STRIPE_WEBHOOK_SECRET rotated in Stripe dashboard (routine).
14:02 Vercel still holds the old secret → all webhooks 400.
15:47 First customer report ("paid, still on Free").
15:49 SEV2 declared. IC @a, Operator @b.
16:10 Root cause: secret mismatch (runbook step 1).
16:25 New secret in Vercel, redeployed.
16:40 Failed events resent from Stripe dashboard.
17:38 All 120 verified correct. Resolved.

## Root cause (5 whys — system, not person)
Secret rotated in Stripe but not in Vercel. → No process couples
the two. → Rotation is a manual dashboard action with no checklist.
→ The two systems have no shared source of truth for the secret.
→ We never built rotation as a procedure because it had never bitten.

## What went well
- Idempotency ledger made replay completely safe (Module 6/7 paid off).
- Runbook step 1 found root cause in ~20 min.

## What went badly
- 1h45m between breakage and detection. No webhook-failure alert.
- Detected by a customer, not by us. Unacceptable for a billing path.

## Action items (owner, due, tracked)
- [ ] Alert: webhook 400/timeout rate > 0 for 5 min → page. @a, 3 days
- [ ] Runbook: "Rotating the webhook secret" couples both systems. @b, 1wk
- [ ] ADR: secrets that live in two places need a rotation procedure. @a
```

The root cause analysis names *systems and missing processes*, never a person. "@x rotated the secret" is true and worthless; "no process couples the two systems" is the finding that prevents recurrence. The fix is always a system change — an alert, a coupled procedure, an ADR — because the next person will make the same human mistake and the system must be the thing that stops them.

## Step 6 — Action items are the only output that matters

A postmortem whose action items are never done is a diary. Rules that make it an *engine*:

- Every action item has an **owner and a due date**, tracked where real work is tracked — not buried in the doc.
- Action items from a budget-exhausting incident are **top of the next sprint**, ahead of features. PE.2's budget policy *forces* this; this is where the two lessons interlock.
- "Detected by a customer, not by us" *always* produces a detection action item. An incident you didn't catch is two failures — the break and the blindness — and the blindness is the more dangerous one.

## Step 7 — Rehearse before you need it

The runbook is a hypothesis until executed under load. Quarterly, run a **game day**: deliberately break a thing in a preview/staging environment and have someone who didn't write the runbook recover from it using only the runbook.

You are not testing the system. You are testing the *runbook and the humans*: Is step 1 actually findable at 3 a.m.? Does the new hire know how to declare a SEV? Does the "resend events" step actually work? Every gap a game day finds is a gap you didn't find during a real outage with customers watching. The drill is cheap; the unrehearsed real incident is not.

## Apply it

- `docs/postmortems/` and runbooks exist in the repo, beside ADRs and `slo.md`.
- A severity ladder defines SEV1 by *correctness/exposure*, not just volume.
- At least one runbook is concrete commands with time targets and guardrails — no "investigate."
- The postmortem template's root-cause section structurally cannot name a person (5-whys on systems).
- Action items have owners, due dates, and are tracked outside the doc; budget-exhausting incidents preempt the next sprint.
- A game day has been run by someone who didn't write the runbook.

## Common traps

- **No declared severity.** The ambiguous "is this an incident?" minutes are where most of the damage and delay live. Anyone declares; declaring is never wrong.
- **IC with hands on the keyboard.** Coordination collapses, the incident lengthens, two fixes collide. The IC commands; the Operator types.
- **Going silent to focus.** Silence becomes a trust incident on top of the technical one. Fixed-cadence updates even with no news.
- **Blameful postmortems.** Guarantees the next incident is hidden or reported late. The root cause is always a system gap; the human is never the finding.
- **Action items with no owner/date.** The postmortem becomes a diary. Owner, date, tracked, and prioritised above features after a budget breach.
- **A runbook never executed.** Fiction discovered mid-outage. Game-day it with someone who didn't write it.
- **Premature all-clear.** Unverified "fixed" that reopens destroys more trust than the original, longer outage. Verify (runbook step 4) before you say it.

## Recap

Declare severity early and freely; separate IC/Operator/Scribe even when alone; execute a runbook of concrete commands that *leans on* the defensive engineering you already built; communicate on a cadence, not on progress; write a blameless postmortem whose root cause is a system gap and whose action items preempt the next sprint; and rehearse it on a game day before the real one. The outage is inevitable. The panic is optional.

Next: [PE.4 Threat modeling Contactly →](./PE.4-threat-modeling.md)
