# E.15 — Error Tracking with Sentry

> Module 12.1 said "add once you have real users." You have them now. SvelteKit's `handleError` hooks, a Svelte 5 `<svelte:boundary>`, a user-facing error id, and PII you didn't accidentally ship.

## Why this matters

Module 12.1's observability section ended with: *"Error tracking (Sentry, or Vercel's built-in error monitoring). Not covered in this course; add once you have real users."* This is that lesson.

Without error tracking, your bug reports are "it didn't work" with no stack, no breadcrumb, no idea how many users hit it. With it, you get the exact line, the release, the browser, and a count — the difference between "we think we fixed it" and "the graph went to zero." The trap is doing it badly: shipping every user's email and auth token into a third party, or catching errors in a boundary that structurally can't catch the ones you actually have.

## The Principal Engineer lens

**An error tracker is a PII funnel pointed at a third party. Aim it deliberately.** Stack traces, request bodies, and breadcrumbs routinely contain emails, tokens, and customer data. The default SDK config sends more than you think. Scrubbing is not optional polish — it's the difference between a debugging tool and a data-processing agreement you didn't mean to sign.

Corollary: **know exactly which errors each mechanism can and cannot catch.** A Svelte error boundary catches render and effect errors — *not* errors in event handlers, `setTimeout`, or `await` continuations. If you believe the boundary covers your `onclick` handler, you've built a safety net with a hole exactly where people fall.

## Step 1 — Install, pinned

```bash
pnpm --filter app add @sentry/sveltekit@9.20.0
```

Pinned, like everything else (Module 12.4's rule). Sentry's SDK has had breaking minors; `latest` is a time bomb.

## Step 2 — The two `handleError` hooks

SvelteKit routes every *unexpected* error through `handleError` — once on the server, once on the client. This is the documented integration point and the one place that sees loading, rendering, and endpoint errors.

```ts
// src/hooks.server.ts
import * as Sentry from '@sentry/sveltekit';
import type { HandleServerError } from '@sveltejs/kit';
import { env } from '$lib/server/env';

Sentry.init({
	dsn: env.SENTRY_DSN,
	environment: env.PUBLIC_VERCEL_ENV ?? 'development',
	tracesSampleRate: 0.1,
	sendDefaultPii: false // do NOT auto-attach IP/cookies/headers
});

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const errorId = crypto.randomUUID();

	// Expected errors (thrown via `error()` from @sveltejs/kit) never reach
	// here — SvelteKit only calls handleError for *unexpected* ones.
	Sentry.captureException(error, {
		tags: { errorId, status },
		extra: { route: event.route.id }
	});

	return { message: 'Something went wrong on our end.', errorId };
};
```

```ts
// src/hooks.client.ts
import * as Sentry from '@sentry/sveltekit';
import type { HandleClientError } from '@sveltejs/kit';
import { PUBLIC_SENTRY_DSN, PUBLIC_VERCEL_ENV } from '$env/static/public';

Sentry.init({
	dsn: PUBLIC_SENTRY_DSN,
	environment: PUBLIC_VERCEL_ENV ?? 'development',
	tracesSampleRate: 0.1,
	sendDefaultPii: false,
	replaysSessionSampleRate: 0, // session replay is a PII firehose; off by default
	replaysOnErrorSampleRate: 0
});

export const handleError: HandleClientError = ({ error, event, status, message }) => {
	const errorId = crypto.randomUUID();
	Sentry.captureException(error, {
		tags: { errorId, status },
		extra: { route: event.route?.id }
	});
	return { message: 'Something went wrong.', errorId };
};
```

`sendDefaultPii: false` is the single most important line in this lesson. The server hook uses the private `SENTRY_DSN`; the client hook must use the `PUBLIC_`-prefixed one (it ships to the browser — that's expected and fine, the DSN is not a secret, but the env access rules from Module 2.1 still apply).

## Step 3 — A typed, surfaced error id

`handleError`'s return becomes `page.error`. Type it so the `+error.svelte` page can show the id the user quotes to support.

```ts
// src/app.d.ts
declare global {
	namespace App {
		interface Error {
			message: string;
			errorId: string;
		}
	}
}
export {};
```

```svelte
<!-- src/routes/+error.svelte -->
<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="mx-auto mt-24 max-w-md text-center">
	<h1 class="text-2xl font-semibold text-text-1">{page.status}</h1>
	<p class="mt-2 text-text-2">{page.error?.message}</p>
	{#if page.error?.errorId}
		<p class="mt-4 text-xs text-text-2">
			Reference:
			<code class="rounded bg-surface-1 px-1.5 py-0.5">{page.error.errorId}</code>
		</p>
	{/if}
	<a href="/app" class="mt-6 inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm text-white">
		Back to app
	</a>
</div>
```

Now a support ticket reads "error `8f3c…`" and you paste that straight into Sentry's search. The `tags: { errorId }` on the capture is what makes that search resolve to one event.

## Step 4 — A component-level boundary

`+error.svelte` catches errors that bubble to a route. For a widget that can fail without taking the page down — a flaky third-party chart, the realtime list from E.13 — wrap it in Svelte 5's `<svelte:boundary>` (added in 5.3.0).

```svelte
<!-- src/lib/components/SafeWidget.svelte -->
<script lang="ts">
	import * as Sentry from '@sentry/sveltekit';
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		children: Snippet;
	}
	let { label, children }: Props = $props();

	function report(error: unknown) {
		Sentry.captureException(error, { tags: { boundary: label } });
	}
</script>

<svelte:boundary onerror={report}>
	{@render children()}

	{#snippet failed(error, reset)}
		<div role="alert" class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
			<p class="text-red-500">This section failed to load.</p>
			<button
				type="button"
				class="mt-2 rounded-lg border border-border-1 px-3 py-1.5 text-text-1"
				onclick={reset}
			>
				Try again
			</button>
		</div>
	{/snippet}
</svelte:boundary>
```

Usage: `<SafeWidget label="realtime-list"><LiveContactList … /></SafeWidget>`. A render error inside the realtime list now shows a recoverable inline message *and* reports to Sentry — the rest of the page stays alive. `reset` re-creates the boundary's contents, so "Try again" actually retries.

## Step 5 — Know the boundary's blind spot

This is the part most teams get wrong. From the Svelte docs, verbatim in spirit:

> Errors occurring outside the rendering process (for example, in event handlers or after a `setTimeout` or async work) are *not* caught by error boundaries.

So this is **not** caught by `<svelte:boundary>`:

```svelte
<button onclick={() => { throw new Error('boom'); }}>…</button>
```

Event-handler and async errors need explicit capture:

```ts
async function onSave() {
	try {
		await saveContact(form);
	} catch (err) {
		Sentry.captureException(err);
		toasts.error('Could not save. Our team has been notified.');
	}
}
```

The mental model: `<svelte:boundary>` covers *rendering and effects*; `handleError` covers *loading and endpoints*; everything in an `onclick` or a `.then()` is **yours** to `try/catch`. Three mechanisms, three domains, zero overlap — and the gap between them is exactly where unhandled errors hide if you assume the boundary is a catch-all.

## Step 6 — Scrub PII before it leaves

Even with `sendDefaultPii: false`, your own error messages leak. `new Error(\`Failed for ${user.email}\`)` ships that email. Add a `beforeSend` scrubber as a backstop.

```ts
// shared scrubber, used in both hooks' Sentry.init
beforeSend(eventData) {
	// drop request cookies/headers entirely
	if (eventData.request) {
		delete eventData.request.cookies;
		delete eventData.request.headers;
	}
	// redact emails anywhere in the message
	if (eventData.message) {
		eventData.message = eventData.message.replace(
			/[\w.+-]+@[\w-]+\.[\w.-]+/g,
			'[email]'
		);
	}
	return eventData;
}
```

`beforeSend` runs in-process before anything is transmitted. It's the last line of defence and the one that survives a careless `new Error(...)` written six months from now by someone who never read this lesson.

## Step 7 — Identify the user without identifying them

You want "how many *users* hit this," not "which person." Set a stable, non-PII id.

```ts
// in hooks.server.ts handleError, when a session exists:
Sentry.setUser({ id: event.locals.user?.id ?? 'anonymous' });
// id is the Supabase UUID — opaque, not an email. No username, no email.
```

The UUID lets Sentry compute "12 users affected" without ever storing who they are. That's the entire identification budget you need for triage.

## Step 8 — Source maps, uploaded privately

A minified stack trace is unreadable. Upload source maps at build time so Sentry de-minifies — but ensure they're **not** served publicly (they reveal your source).

The `@sentry/sveltekit` Vite plugin handles upload during `vite build`; set `SENTRY_AUTH_TOKEN` in Vercel (Module 12.3's env-var discipline) and confirm `.map` files are excluded from the deployed static output. A public source map is a free copy of your codebase.

## Verify

- Throw in a `load` function → `+error.svelte` shows a reference id; the same id is a tag on the Sentry event.
- Throw in a component's render → the nearest `<svelte:boundary>` shows "Try again"; clicking it recovers; Sentry has the event tagged with the boundary label.
- Throw in an `onclick` with no try/catch → it does *not* hit the boundary (confirming Step 5); add the try/catch → it's captured.
- Trigger an error whose message contains an email → the Sentry event shows `[email]`, not the address.
- Check a Sentry event's payload → no cookies, no auth header, user is a UUID.
- Build for production → stack traces in Sentry are de-minified; `curl https://contactly.app/...js.map` → 404.

## Common traps

- **`sendDefaultPii: true` (or leaving the default unaudited).** Silently ships IPs, cookies, and headers. Set it false and verify a real payload.
- **Believing `<svelte:boundary>` catches event-handler errors.** It structurally cannot. Your `onclick`s need their own try/catch.
- **Capturing *expected* errors.** `error(404, …)` from `@sveltejs/kit` is control flow, not a bug. SvelteKit already excludes these from `handleError`; don't re-add them with a manual capture.
- **`handleError` that throws.** The docs are blunt: it must never throw. A throwing error handler turns one error into an infinite error.
- **Public source maps.** De-minified traces are great for you and for anyone reading your source. Upload them to Sentry, exclude them from the deploy.
- **One DSN for prod and preview.** Preview noise drowns prod signal. Scope by `environment` and ideally separate projects.
- **No release/version tag.** "Is this fixed in the deploy from 20 minutes ago?" is unanswerable without a release marker. The Sentry Vite plugin sets it from the git SHA — keep that on.

## Recap

Two `handleError` hooks, a typed surfaced error id, a Svelte 5 `<svelte:boundary>` for recoverable widget failures, an explicit map of what each mechanism does and does not catch, a `beforeSend` PII backstop, opaque user identification, and private source maps. The observability gap Module 12 flagged is closed — without turning your error tracker into an accidental data-processing pipeline.

This is the last Extras lesson. Every one of them takes a function you already shipped and makes it the version you'd be proud to show another engineer.

You can now build, defend, and operate a production SaaS. The final track is about the judgment that decides *what* to build and *when* — the distance from senior to principal.

Next: [Principal Engineer Track →](../principal-engineer-track/README.md)
