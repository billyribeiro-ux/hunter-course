# PE.4 — Threat Modeling Contactly

> Penetration testing finds the bug you have. Threat modeling finds the bug class you keep shipping. One is a scan; the other is a way of seeing the system the attacker already sees.

## Why this matters

Every defensive choice in this course — RLS on every table, idempotency keys, webhook signature verification, the open-redirect guard in Extras E.13, rate limiting in E.9, PII scrubbing in E.15 — was an *answer*. This lesson is the *question* they were answering, made explicit and systematic, so the next feature gets its defenses designed in rather than retrofitted after the incident.

A threat model is not a security audit you pass. It is a structured paranoia you run *before* writing the feature, when defenses are a design choice instead of an emergency.

## The Principal Engineer lens

**The attacker does not care about your architecture diagram; they care about your trust boundaries.** A trust boundary is any line where data or control crosses from something you don't control into something you do — browser→server, webhook→handler, one user's session→another's row. Bugs cluster on these lines because that's where assumptions get made. Threat modeling is the discipline of walking every boundary on purpose, before the attacker walks it for you.

Corollary: **"who would attack a contacts app?" is the question that ships the breach.** The threat is rarely a targeted adversary; it's the bored user editing a request id, the credential-stuffing botnet that doesn't know or care what you do, the curious customer who notices `/api/...?id=` and increments it. Modeling only the cinematic attacker means missing the one who actually shows up.

## Step 1 — Draw the trust boundaries

Before listing threats, name where control changes hands. Contactly has exactly five boundaries that matter:

1. **Browser → SvelteKit server** — every remote function call. The client is fully attacker-controlled; *nothing* it sends is trusted.
2. **SvelteKit server → Postgres** — mediated by RLS. The boundary's integrity *is* the RLS policy set.
3. **Stripe → webhook endpoint** — an unauthenticated public URL that mutates billing state. The highest-value boundary in the system.
4. **User session → another user's data** — the multi-tenant boundary, enforced *inside* the database by `auth.uid() = user_id`.
5. **App → third parties** (Stripe, Supabase, Sentry, Resend) — data leaving your control; secrets that authenticate you to them.

Every threat in this lesson lives on one of these five lines. A feature that doesn't cross a boundary needs no threat model; a feature that crosses two needs a careful one.

## Step 2 — STRIDE, walked per boundary

STRIDE is a checklist so you don't model only the threats you already feared. For each boundary, ask all six. Worked against Contactly's real surface:

| STRIDE | Concrete Contactly threat | The defense you already built (or must) |
|---|---|---|
| **S**poofing | Forged webhook POST to `/api/webhooks/stripe` to grant a free Pro tier | Stripe signature verification (`constructEvent`) — Module 6.3 |
| **T**ampering | Edit the remote-function payload: change `contactId` to another user's | RLS `auth.uid() = user_id` — the *only* thing stopping it (Module 4.1) |
| **R**epudiation | "I never deleted that / I never downgraded" — no proof either way | Append-only audit log — Extras E.14 |
| **I**nfo disclosure | Cursor/`id` param fuzzing; one user enumerating another's rows | RLS + strict input validation (Extras E.12 injection fix); signed Storage URLs (E.10) |
| **D**enial of service | Credential-stuffing login; mass signup to farm trials; webhook flood | Rate limiting on auth/checkout — Extras E.9; Stripe sig as the webhook gate |
| **E**levation of privilege | Free user calling a tier-gated remote function directly, not via UI | Server-side entitlement check returning 402 — Module 10.2 |

The table's value is the *empty cells you find when you build a new feature*. Add a "share contact" feature and the Tampering/Info-disclosure rows light up red — because sharing punches a hole in boundary #4, the multi-tenant line. STRIDE is how you notice that *before* the share feature ships, not after a customer reports seeing a stranger's contacts.

## Step 3 — The highest-value target: the webhook

Walk boundary #3 deliberately, because it's the one an attacker reasons about exactly the way you must:

- It's a **public, unauthenticated URL** that **mutates billing state**. That sentence alone is the threat model.
- Spoofing → signature verification is not optional hardening; it is the *entire* authentication of this boundary. Without it, `curl` grants Pro.
- Replay → a captured-and-resent valid event. The idempotency ledger (`stripe_events`, Module 6/7) is what makes a replay a no-op. *This is why that ledger exists* — and PE.3's runbook leaned on it to recover an incident. One defensive structure, three lessons deep.
- Tampering → you cannot trust the event body's *amounts*; you re-fetch the subscription from Stripe by id rather than believing the payload. The webhook tells you *what changed*, never *what is true*.

A junior secures the endpoints with auth and considers the job done. A principal notices the *unauthenticated* endpoint is the most dangerous thing in the system and gives it the most defense, because that is where the attacker is already looking.

## Step 4 — The bug class, not the bug

Threat modeling's payoff is eliminating *classes*, not instances. Map each Contactly defense to the class it kills:

- **RLS on every table** kills the entire IDOR/tampering class on boundary #4 — not "this endpoint checks ownership" (which you'll forget on endpoint #19) but "the database refuses cross-tenant reads, so forgetting is *structurally impossible*." The defense is at the layer where it cannot be bypassed by an omission.
- **Strict input validation at the boundary** (the Extras E.12 cursor fix) kills the injection class — not by escaping this one string but by proving the input alphabet excludes the metacharacters.
- **Idempotency keys** kill the double-apply class — not "we check for duplicates here" but "a replay is definitionally a no-op."

When you evaluate a defense, ask: *does this kill the bug, or the bug class?* "We added an ownership check to this endpoint" is a senior answer. "Cross-tenant access is impossible because the database enforces it below the application" is the principal one. Defenses that depend on every future engineer remembering are not defenses; they're deferred incidents.

## Step 5 — The model is a living artifact

Write it down: `docs/threat-model.md` — the five boundaries, the STRIDE table, and crucially a **"Changes that require re-modeling"** trigger list:

```markdown
## Re-model the threat surface when we add:
- Any feature that crosses the multi-tenant boundary
  (sharing, teams, an admin/impersonation view)
- Any new unauthenticated endpoint (a public API, an embed, a webhook)
- Any new third party that receives user data (a new boundary #5 spoke)
- File upload / processing beyond avatars
- Anything that takes a user-supplied URL the server fetches (SSRF class)
```

That trigger list is the deliverable, mirroring the ADR "Revisit when" and the SLO burn alert: each PE practice carries the condition for its own reinvocation. A threat model written once and never reopened describes a system you no longer run.

## Step 6 — Where this course's defenses came from

Re-read the Common traps sections across the whole course with this lens and you'll see they are the threat model, distributed. "Don't trust `redirect` params" (E.13) is the Spoofing/Open-redirect row. "Never bill from the client's price" (E.2/E.4) is the Tampering row. "Verify RLS-on-replication with a second account" (E.13) is the Info-disclosure row. The course taught the *defenses* inline; this lesson is the *frame* that generates them — so the *next* feature, the one no lesson covers, gets the same rigor.

## Apply it

- `docs/threat-model.md` exists: five named trust boundaries, a STRIDE row per boundary, and a re-model trigger list.
- For each major existing feature you can name which boundary it crosses and which defense holds the line.
- For each defense you can state the bug *class* it eliminates, and whether it's enforced at a layer that survives a future engineer's omission.
- The webhook endpoint's model explicitly states "public + unauthenticated + mutates billing" and the three defenses that follow from it.
- Adding "share a contact" to the model immediately lights up the multi-tenant boundary rows *before* any code is written.

## Common traps

- **Modeling the cinematic attacker.** The real one is the bored user editing an id and the botnet that doesn't know you exist. Model the surface, not a persona.
- **"Who'd attack a contacts app?"** The question that ships the IDOR. Value to the attacker (accounts, cards, a trial farm) ≠ how interesting your app feels to you.
- **Fixing the bug, not the class.** An ownership check on *this* endpoint leaves nineteen others. Push the defense to the layer where omission is impossible.
- **Auth on the authenticated endpoints, blind to the unauthenticated one.** The webhook is the most dangerous surface *because* it's public; it needs the most modeling, not the least.
- **A threat model written once.** It describes a system you stopped running the day you shipped the next feature. The re-model trigger list is what keeps it alive.
- **Trusting the webhook body's values.** It tells you *what changed*; re-fetch from the source for *what's true*.

## Recap

Name the five trust boundaries; walk all six STRIDE prompts per boundary; give the unauthenticated billing webhook the most defense because that's where the attacker already is; evaluate every defense by the bug *class* it eliminates and whether it survives a future omission; and keep the model alive with an explicit re-model trigger. The course's Common traps are this model, distributed; this lesson is the frame that generates the defenses for the feature no lesson will ever cover.

Next: [PE.5 Cost engineering & unit economics →](./PE.5-cost-engineering.md)
