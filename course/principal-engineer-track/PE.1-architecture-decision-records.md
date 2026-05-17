# PE.1 — Architecture Decision Records

> A decision nobody can find, challenge, or date is a rumour. An ADR turns "why is it like this?" from an archaeology dig into a 90-second read.

## Why this matters

Six months from now someone — possibly you — will look at `src/lib/server/stripe.ts`, see the pinned API version `2026-03-25.dahlia`, and ask "why is this frozen? can I bump it?" Without a record, the answer costs an afternoon of `git blame`, Slack archaeology, and a guess. With a record, it costs the time to read one page that says *what* was decided, *why*, *what we gave up*, and *when this should be revisited*.

Every consequential choice in this course was a decision: remote functions over `+server.ts`, lookup keys over price IDs, hosted Checkout as the default, RLS as the security boundary, keyset over OFFSET pagination. Each was defensible. None is self-documenting. The code shows *what*; only an ADR shows *why* and *why not the alternative*.

## The Principal Engineer lens

**Undocumented decisions decay into cargo cult.** The second engineer copies the pattern without the reasoning. The third defends it without knowing the trade-off. By the fifth, "we do it this way" is folklore, and nobody can tell whether the original constraint still holds. An ADR is how a decision stays *alive* — challengeable on its merits instead of frozen by fear.

Corollary: **the value of an ADR is the rejected alternative.** "We chose X" is documentation. "We chose X over Y because Z, accepting trade-off W" is *thinking*. The day Z stops being true, anyone can find the ADR and reopen X. Without the recorded Y and Z, reversing the decision means rediscovering the entire analysis from scratch — so nobody does, and the system ossifies.

## Step 1 — The format (one file, six headings)

ADRs live in the repo, in `docs/adr/`, numbered, append-only. Never edit a decided ADR — supersede it with a new one. The format is deliberately tiny; a heavy template guarantees nobody writes them.

```markdown
# ADR-0007: Pin the Stripe API version

- **Status**: Accepted
- **Date**: 2026-04-18
- **Deciders**: @founder, @backend
- **Supersedes**: —

## Context
Stripe's SDK defaults to the account's dashboard API version, which can be
changed by anyone in the Stripe dashboard, silently, with no deploy. Our
webhook handler and subscription sync parse fields whose shape is
version-dependent.

## Decision
Pin `apiVersion: '2026-03-25.dahlia'` explicitly in `src/lib/server/stripe.ts`.
Bumps happen only via a PR that also updates the webhook/sync code and is
tested against the new version's event shapes.

## Alternatives considered
- **Float on the account default.** Rejected: a dashboard click by a
  non-engineer becomes a silent production schema change. Unacceptable
  blast radius for an invisible action.
- **Pin via the Stripe dashboard's "API version" setting.** Rejected:
  still out-of-band from the code; the repo wouldn't be the source of truth.

## Consequences
- (+) The event shape our code parses is now a property of the repo, not
  of a dashboard someone else can click.
- (+) Upgrades are deliberate, reviewed, and tested.
- (−) We must actively track Stripe's version changelog; pinned ≠ free.
- **Revisit when**: Stripe deprecates `2026-03-25.dahlia`, or we need a
  feature only in a later version.
```

Six headings. Context, Decision, Alternatives, Consequences — plus Status and a *Revisit when* trigger. The "Revisit when" line is what stops an ADR becoming a tombstone: it names the condition under which the decision is *supposed* to be reopened.

## Step 2 — What earns an ADR (and what doesn't)

Apply the through-line: **reversibility × blast radius.**

| | Small blast radius | Large blast radius |
|---|---|---|
| **Easily reversible** | No ADR. Just do it. (variable name, a helper's shape) | Lightweight ADR. (adding a library, a new route convention) |
| **Hard to reverse** | Short ADR. (a DB column's semantics, an enum's values) | Full ADR + review + second opinion. (the auth model, the billing data model, RLS as the security boundary) |

Writing an ADR for a variable name is bureaucracy; *not* writing one for "RLS is our authorization boundary" is negligence. The skill is calibration, not diligence. If you're unsure which quadrant you're in, that uncertainty *is* the signal to write the ADR.

## Step 3 — The ADRs this course already made for you

Reverse-engineer the decisions you inherited. These should exist in `docs/adr/` for the Contactly you built:

- **ADR-0001: SvelteKit remote functions as the data layer** — over `+server.ts` endpoints. Trade-off: bleeding-edge pattern, smaller Stack Overflow surface, in exchange for type-safe end-to-end calls and less boilerplate.
- **ADR-0002: RLS is the authorization boundary** — not application middleware. Consequence: every table is unsafe until its policies exist; the database, not the app, is the last line. (This is the single highest-blast-radius decision in the system.)
- **ADR-0003: Stripe lookup keys, not price IDs** — environment portability vs an extra indirection.
- **ADR-0004: Hosted Checkout as the default, Elements as the exception** — see Extras E.1; the ADR is the durable form of that lesson's verdict.
- **ADR-0005: Keyset pagination, not OFFSET** — see Extras E.12; flat latency vs a more complex cursor.
- **ADR-0006: Supabase as Postgres+Auth+Storage, single provider** — over best-of-breed components; operational simplicity vs lock-in.

If you can't write the "Alternatives considered" section for one of these, you don't yet understand the decision you're running in production. That gap is the lesson.

## Step 4 — The lifecycle

An ADR has a status, and the status is load-bearing:

- **Proposed** → open for challenge. PR review *is* the debate. Merge = consensus.
- **Accepted** → in force. The code must match it; a divergence is a bug in one or the other.
- **Superseded by ADR-N** → still in the repo (never deleted — the history is the point), but no longer in force. The new ADR's Context explains what changed.
- **Deprecated** → the decision no longer applies and has no replacement (the feature was removed).

Append-only is non-negotiable. An edited ADR is a falsified record; the whole value proposition is that it's a trustworthy history of *what we believed when*.

## Step 5 — Wire it into the workflow

An ADR practice that depends on memory is already dead. Make it structural:

- A PR that introduces an architectural pattern is **not reviewable** without its ADR. Add it to the PR template checklist.
- The ADR and the code that implements it land in the **same PR**. Decision and consequence are reviewed together or not at all.
- Link the ADR from the code at the decision site: `// See docs/adr/0007 — why this version is pinned`. The comment doesn't re-explain; it points to the durable record.
- Quarterly, grep ADRs for "Revisit when" and check whether any trigger has fired. A decision whose revisit-condition is true and that nobody reopened is technical debt with a paper trail.

## Apply it

- `docs/adr/` exists, append-only, numbered, with ADR-0001 through ADR-0006 written for the decisions you inherited.
- Each has a non-empty "Alternatives considered" *and* a "Revisit when".
- The decision site in code links to its ADR by number.
- The PR template requires an ADR for architectural changes.
- You can hand ADR-0002 to a new hire and they understand the authorization model in one read, including what was rejected and why.

## Common traps

- **Writing the ADR after the fact, to rubber-stamp.** Then it's not a decision record, it's an alibi. The ADR is the medium of the decision, written while it's still arguable.
- **Editing a decided ADR.** Falsifies the history that is the entire point. Supersede; never overwrite.
- **A template so heavy nobody writes them.** Six headings. The cost of writing one must be lower than the cost of re-deriving the decision later, or the practice dies.
- **No "Revisit when".** The ADR becomes a tombstone instead of a living constraint. Every decision was made under conditions that can change; name them.
- **ADRs for trivia.** A variable rename does not get an ADR. Bureaucracy discredits the practice for the decisions that genuinely need it.
- **ADR in a wiki, not the repo.** It drifts from the code, needs separate auth, and isn't in the diff. It lives in `docs/adr/` or it doesn't live.

## Recap

An ADR is a six-heading, append-only, repo-resident record whose real payload is the rejected alternative and the revisit trigger. You write one when reversibility is low or blast radius is high — and you *don't* when it isn't. The Contactly you built embodies six such decisions; being able to write their "Alternatives considered" is the test of whether you understand the system you operate.

Next: [PE.2 SLOs, SLIs & error budgets →](./PE.2-slos-and-error-budgets.md)
