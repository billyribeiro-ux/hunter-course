import Stripe from 'stripe';
import { env } from '$env/dynamic/private';

/**
 * Singleton Stripe client pinned to the **exact** API version this app was
 * written and tested against. When you later upgrade, pin the new version
 * here after reading the migration notes — don't let the SDK drift silently.
 *
 * Stripe API version: 2026-03-25.dahlia (default in stripe-node v22)
 */
export const stripe = new Stripe(env.PRIVATE_STRIPE_SECRET_KEY, {
	apiVersion: '2026-03-25.dahlia',
	typescript: true,
	appInfo: {
		name: 'Contactly',
		version: '1.0.0',
		url: 'https://contactly-app.vercel.app'
	}
});

export type { Stripe };
