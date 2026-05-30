import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { error, type RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Per-endpoint rate limiters, backed by Upstash Redis.
 *
 * Why Upstash: serverless-friendly, HTTP-native (no connection pool to manage
 * across Vercel functions), generous free tier. The in-memory alternative is
 * broken on Vercel — limits "reset" whenever a new function instance spins up.
 *
 * Thresholds are deliberate, not arbitrary:
 *  - login          : 5 / 15 min  — normal users use 2-3; attackers bounded.
 *  - signup         : 3 / 1 h     — real users sign up once.
 *  - resetPassword  : 3 / 1 h     — same logic as signup.
 *  - updateAuth     : 10 / 10 min — covers updateEmail + updatePassword on
 *                                   an authenticated session.
 */
const redis =
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({
              url: env.UPSTASH_REDIS_REST_URL,
              token: env.UPSTASH_REDIS_REST_TOKEN
          })
        : null;

const limiters = redis
    ? {
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
          updateAuth: new Ratelimit({
              redis,
              limiter: Ratelimit.slidingWindow(10, '10 m'),
              analytics: true,
              prefix: 'rl:update-auth'
          })
      }
    : null;

export type LimiterName = 'login' | 'signup' | 'resetPassword' | 'updateAuth';

/**
 * Enforce a rate limit, throwing a 429 if exceeded.
 *
 * Failure policy:
 *  - Upstash unreachable → fail OPEN for auth endpoints (better to let a
 *    legitimate user in than lock out everyone when Redis blinks). Logged
 *    so oncall sees it.
 *  - Limit exceeded → 429 with `retryAfterSeconds` in the body and the
 *    standard `ratelimit-*` response headers.
 *  - Limiters not configured (no Upstash env vars) → no-op. Dev environments
 *    don't need it; production must set the env vars or the safety belt
 *    is silently absent. The healthcheck in CI should verify presence.
 */
export async function enforce(
    event: RequestEvent,
    limiter: LimiterName,
    key: string
): Promise<void> {
    if (!limiters) return;

    try {
        const { success, reset, remaining } = await limiters[limiter].limit(key);
        event.setHeaders({
            'ratelimit-remaining': String(remaining),
            'ratelimit-reset': String(reset)
        });
        if (!success) {
            const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
            error(429, {
                message: `Too many requests. Try again in ${retryAfter}s.`,
                code: 'RATE_LIMITED'
            });
        }
    } catch (e) {
        // Re-throw SvelteKit's HttpError (the 429 above).
        if (e && typeof e === 'object' && 'status' in e) throw e;
        console.error('[rate-limit] upstash unreachable', e);
    }
}

/**
 * Extract a best-effort client IP from the request. `x-forwarded-for` is
 * set by Vercel/most proxies; we take the first entry (the real client).
 */
export function clientIp(event: RequestEvent): string {
    return (
        event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        event.getClientAddress() ??
        'unknown'
    );
}
