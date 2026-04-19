# Contributing

Fixes, typos, and clarifications are welcome. Here's the bar.

## Lesson edits

Lessons live under `course/`. One lesson = one markdown file. When you edit one:

- Keep the "explain like I've never coded" voice.
- Any code block must be copy-pasteable and produce the final behavior described.
- If you change code in a lesson, you **must** also update the reference `app/` to match.
- Diff-check: at the end of each module, the running `app/` should match what a student following the lessons would have.

## Code edits

- Match the existing style. Prettier runs on commit.
- Types must resolve (`pnpm -C app typecheck`).
- ESLint must pass (`pnpm -C app lint`).
- Playwright must pass (`pnpm -C app test`).

## Commit style

We use Conventional Commits, but loosely:

```
feat(module-07): add Stripe webhook dedup section
fix(app): correct RLS policy on contacts.update
docs: typo in 3.2
```

## PR flow

1. Branch off `main`.
2. Make the change + update the lesson + update the app.
3. Open a PR. Describe the "why" not the "what."
4. Wait for CI. If it's red, it's your problem, not the pipeline's.

## Code of conduct

Be kind. Assume good intent. If you ship something brilliant, credit is yours; if you break something, a fix is appreciated. That's it.
