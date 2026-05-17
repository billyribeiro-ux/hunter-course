# Principal Engineer Track

> The course taught you to *build* Contactly. This track is about the judgment that decides what to build, what to refuse, how to know it's healthy, and what to do at 3 a.m. when it isn't.

Everything before this point produces a working, production-grade SaaS. That gets you to *senior*. The distance from senior to **Principal Engineer (L7)** is not more frameworks — it's the meta-skills that don't appear in any diff:

- Writing decisions down so they can be challenged, remembered, and reversed deliberately.
- Defining "good enough" numerically, and using that number to arbitrate every reliability-vs-feature argument.
- Turning an outage from a panic into a procedure, and a procedure into organisational learning.
- Reasoning about the attack surface *before* the attacker does.
- Knowing what a request, and a customer, actually cost — and when the architecture's economics break.
- Knowing the *order* in which to add complexity, and refusing to add it early.

None of these lessons contain a Svelte component, because none of these skills are a component. They contain artifacts you will actually keep in the repo: an ADR, an SLO spec, a runbook, a threat model, a cost model, a scaling roadmap.

## The through-line

One idea connects all six lessons: **reversibility and blast radius are the only two variables that matter when deciding how careful to be.** A reversible decision with a small blast radius: decide fast, alone, in a comment. An irreversible decision with a large blast radius: ADR, threat model, second opinion, staged rollout. Most engineers apply uniform caution and are therefore either too slow on the small things or too reckless on the large ones. Principals calibrate.

## The lessons

- [PE.1 Architecture Decision Records](./PE.1-architecture-decision-records.md) — decisions as durable, challengeable artifacts.
- [PE.2 SLOs, SLIs & error budgets](./PE.2-slos-and-error-budgets.md) — "good enough," as a number that ends arguments.
- [PE.3 Incident response & blameless postmortems](./PE.3-incident-response.md) — the runbook and the learning loop.
- [PE.4 Threat modeling Contactly](./PE.4-threat-modeling.md) — STRIDE against the real attack surface.
- [PE.5 Cost engineering & unit economics](./PE.5-cost-engineering.md) — the cost of a request, a customer, a mistake.
- [PE.6 The scaling roadmap](./PE.6-scaling-roadmap.md) — what to add, in what order, and what to refuse.

Read them last. They only make sense once you've felt the weight of the system they're about.

Back to: [course index ←](../README.md)
