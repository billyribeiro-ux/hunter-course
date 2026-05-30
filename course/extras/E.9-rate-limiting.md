# E.9 — Rate Limiting Sensitive Endpoints

> Supabase Edge Ratelimiter + a 30-line middleware. Login, signup, password reset, checkout — locked to honest traffic only.

## Why this matters

Any endpoint that touches identity, money, or email is a target. Login forms get credential-stuffed. Signup forms get used to farm free trials. Webhook endpoints get probed for vulnerabilities. Left unprotected, these endpoints absorb thousands of malicious requests per hour — bloating your bills and eventually leaking data.

Rate limiting is the smallest intervention with the largest security/cost payoff. This lesson wires up Upstash Redis-backed per-IP and per-user limits on the four endpoints that matter most in Contactly.

## The Principal Engineer lens

**Rate limit by identity, not by IP.** IPs rotate; users don't. For authenticated endpoints, key the limit on `user.id`. For pre-auth endpoints (login, signup), key on IP *and* email — a credential-stuffing attacker rotates IPs but has to try the same email over and over to exploit account takeover, so email is a useful key.

Corollary: **rate limits should fail closed locally, open globally.** When Redis is unreachable, the safe choice depends on the endpoint: for login, fail open (let users in; don't lock out everyone because Redis blinked) and page the oncall. For checkout, fail closed (refuse payment) because a dropped limit check is a possible double-charge vector.

## Step 1 — Choose a store

Three options, good to worst:

- **Upstash Redis** — serverless-friendly, generous free tier, edge-cacheable. What we use.
- **Supabase Postgres** — works, but every rate-limit check is a DB round-trip. Fine for low-volume endpoints.
- **In-memory (Vercel function memory)** — broken. Vercel scales functions across instances; the limit "resets" whenever a new instance spins up. Don't.

```bash
pnpm --filter app add @upstash/ratelimit@2.0.8 @upstash/redis@1.38.0
```

## Step 2 — The Upstash client

```ts
// src/lib/server/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } from '$env/static/private';

const redis = new Redis({
	url: UPSTASH_REDIS_REST_URL,
	token: UPSTASH_REDIS_REST_TOKEN
});

export const limiters = {
	login: new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(5, '15 m'),
		analytics: true,
		prefix: 'rl:login'
	}),
	signup: new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(3, '1 h'),
		analytics: true,
		prefix: 'rl:signup'
	}),
	resetPassword: new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(3, '1 h'),
		analytics: true,
		prefix: 'rl:reset'
	}),
	checkout: new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(10, '10 m'),
		analytics: true,
		prefix: 'rl:checkout'
	})
};

export type LimiterName = keyof typeof limiters;
```

Four named limiters, each with deliberate thresholds:

- **Login: 5 per 15 minutes.** Normal user: at most 2-3 attempts. Attacker: 5 is generous but bounded.
- **Signup: 3 per hour.** Real users sign up once, not 3x. An email farm gets shut down fast.
- **Reset password: 3 per hour.** Same logic; resets are rare for legitimate users.
- **Checkout: 10 per 10 minutes.** Genuine users retry after a declined card; attackers can't probe many cards fast.

## Step 3 — The middleware

```ts
// src/lib/server/rate-limit.ts (continued)
import { error, type RequestEvent } from '@sveltejs/kit';

export async function enforce(
	event: RequestEvent,
	limiter: LimiterName,
	key: string
): Promise<void> {
	try {
		const { success, reset, remaining } = await limiters[limiter].limit(key);
		event.setHeaders({
			'ratelimit-remaining': String(remaining),
			'ratelimit-reset': String(reset)
		});
		if (!success) {
			const retryAfter = Math.ceil((reset - Date.now()) / 1000);
			throw error(429, {
				code: 'RATE_LIMITED',
				message: `Too many requests. Try again in ${retryAfter}s.`,
				retryAfterSeconds: retryAfter
			});
		}
	} catch (e) {
		// SvelteKit's error() throws an object with `status` - rethrow it.
		if (e && typeof e === 'object' && 'status' in e) throw e;

		// Upstash unreachable: fail open for auth, closed for checkout.
		if (limiter === 'checkout') {
			throw error(503, 'Rate limiter unavailable. Please retry.');
		}
		// Log and continue for login/signup/reset
		console.error('[rate-limit] upstash unreachable', e);
	}
}
```

`setHeaders` exposes the limit state to the client — debuggable, and some UI libraries use it for graceful "you're almost at the limit" warnings.

## Step 4 — Apply to login

```ts
// src/lib/remote/auth.remote.ts (excerpt)
export const loginCommand = command(LoginSchema, async (input) => {
	const event = getRequestEvent();
	const ip = event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

	// Two-key limit: per-IP and per-email.
	await enforce(event, 'login', `ip:${ip}`);
	await enforce(event, 'login', `email:${input.email.toLowerCase()}`);

	// ... existing login logic ...
});
```

Both limits must pass. Attackers rotating IPs get caught by the per-email limit; attackers rotating emails get caught by the per-IP limit. Together, the attack surface drops by orders of magnitude.

## Step 5 — Apply to signup

```ts
export const signupCommand = command(SignupSchema, async (input) => {
	const event = getRequestEvent();
	const ip = event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
	await enforce(event, 'signup', `ip:${ip}`);
	// ... existing signup logic ...
});
```

Single key (IP) — per-email limit on signup is redundant because the email can only sign up once anyway (unique constraint).

## Step 6 — Apply to reset password

```ts
export const requestPasswordResetCommand = command(ResetSchema, async (input) => {
	const event = getRequestEvent();
	const ip = event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
	await enforce(event, 'resetPassword', `ip:${ip}`);
	await enforce(event, 'resetPassword', `email:${input.email.toLowerCase()}`);
	// ... existing reset logic ...
});
```

Important nuance: **always respond identically whether the email exists or not.** Combine rate limiting with constant-time response to avoid leaking which emails have accounts.

## Step 7 — Apply to checkout

```ts
// src/lib/remote/checkout.remote.ts (excerpt from E.4)
export const createSubscriptionIntent = command(InputSchema, async (input) => {
	const event = getRequestEvent();
	const user = requireUser(event.locals);
	await enforce(event, 'checkout', `user:${user.id}`);
	// ... existing intent-creation logic ...
});
```

User-keyed (not IP), because authenticated. A user retrying checkout 15 times in 10 minutes is probably a fraud pattern regardless of which IP they're on.

## Step 8 — UI handling of 429

When a 429 comes back, surface it nicely:

```ts
try {
	await loginCommand({ email, password });
} catch (err) {
	if (err.status === 429) {
		toasts.error(
			`Too many attempts. Please wait ${err.body.retryAfterSeconds}s before trying again.`,
			err.body.retryAfterSeconds * 1000
		);
		return;
	}
	toasts.error(err.body?.message ?? 'Unknown error');
}
```

Show a countdown toast, disable the form temporarily, don't re-enable until the retry-after window expires. Better UX than a silent "button did nothing."

## Step 9 — Webhook endpoints are special

Stripe / Supabase webhooks shouldn't be rate-limited the same way. They come from a known set of Stripe IPs; bursts are legitimate (100 events in seconds during a backfill). Use a *higher* limit keyed on the IP range — or exempt entirely and rely on signature verification (Module 6.3) to reject malformed requests.

```ts
// src/routes/api/webhooks/stripe/+server.ts
export const POST = async (event) => {
	// Signature verification IS the rate limit — an attacker can't forge sigs.
	const raw = await event.request.text();
	const sig = event.request.headers.get('stripe-signature');
	const ev = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
	// ... handle event ...
};
```

Signature verification does the work; adding an arbitrary rate limit just creates a new failure mode.

## Step 10 — Monitoring

Upstash's analytics dashboard shows per-limiter request counts and deny rates. Check it weekly for the first month:

- **Login deny rate spike**: credential-stuffing attack. Add captcha (hCaptcha / Turnstile) to login.
- **Signup deny rate 0%**: good.
- **Signup deny rate 10%+**: either signup fraud or a bug making users try again. Investigate.
- **Checkout deny rate non-zero**: almost always a retry loop in your own code. Fix it.

Real signals; low-noise; free (Upstash analytics is included).

## Verify

- Try logging in with wrong password 6 times within 15 min → 6th attempt returns 429 with retry-after.
- After the window, try again → succeeds.
- Try signing up from the same IP 4 times in an hour → 4th attempt 429s.
- Checkout intent endpoint: burst 11 requests → 11th 429s.
- Webhook endpoint: burst 50 requests with valid signatures → all accepted (not rate-limited).
- Kill Upstash (delete token) → login still works (fail open); checkout returns 503 (fail closed).

## Common traps

- **Trusting `req.ip` or `x-real-ip` blindly.** Attackers forge these headers. Only `x-forwarded-for` on Vercel is trustworthy (Vercel sets it). Still worth validating.
- **Keying everything on IP alone.** IPv6 users share addresses; corporate NAT means 1000 users behind one IP. Combine with email/user key.
- **Not exposing retry-after.** Users see "too many attempts" and hammer F5; you're now rate-limited by your own rate limiter. Show a visible countdown.
- **Applying login's limit to `/app`**. Every page load would count. Limiters are for state-changing / sensitive endpoints, not for reads.
- **Counting the success + the failure.** A successful login shouldn't burn the limit. Some libraries offer `limit` vs `limitIfFailed` — pick wisely.
- **Deploying without testing Redis connectivity from Vercel.** The app runs; logins 503 in prod. Test the full path, including production env vars.

## Recap

Four sensitive endpoints, two keys each, one Redis-backed store, a dozen lines of middleware. Attackers are now facing a rate-limited boundary everywhere it matters. Legitimate users never notice. Your auth logs go quiet.

That's the Extras module. If you made it through, Contactly now has:

- A custom Simpler Trading-style cart + multi-step checkout with Stripe Elements.
- Parallel trial paths (with and without a card).
- Optimistic UI on contacts.
- CSV import respecting tier limits.
- Keyboard shortcuts and a command palette.
- Rate limiting on login, signup, reset, checkout.

Every lesson enhances a function you'd already built in the core course. None are required; each is a step from "shipped" to "truly finished."

Next: [E.10 Contact avatars with Supabase Storage →](./E.10-avatars-supabase-storage.md)
