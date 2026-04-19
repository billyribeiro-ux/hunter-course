/**
 * The **only** hard-coded pricing info the app knows about.
 * Actual amounts, IDs, and trial lengths are loaded from Stripe → DB.
 * This file drives the tier ordering, feature matrix, and UX copy.
 *
 * Lookup keys must match what we create in `scripts/seed-stripe.ts`.
 */

export type Tier = 'free' | 'plus' | 'pro';
export type Interval = 'month' | 'year';

export interface TierFeature {
	label: string;
	/** Show a green check vs a red x on the pricing page */
	included: boolean;
}

export interface TierConfig {
	tier: Tier;
	name: string;
	tagline: string;
	/** Maximum contacts this tier can create (Infinity for unlimited) */
	contactLimit: number;
	/** Whether to offer a free trial when subscribing */
	freeTrialDays: number | null;
	features: TierFeature[];
	/** Stripe lookup keys for month/year prices (undefined for free) */
	lookupKeys?: Record<Interval, string>;
	/** Display order on the pricing page */
	order: number;
	cta: string;
}

export const PRICING: Readonly<Record<Tier, TierConfig>> = {
	free: {
		tier: 'free',
		name: 'Free',
		tagline: 'Kick the tires, no card needed.',
		contactLimit: 5,
		freeTrialDays: null,
		features: [
			{ label: 'Up to 5 Contacts', included: true },
			{ label: 'Community Support', included: false },
			{ label: 'Automatic Backups', included: false },
			{ label: '24/7 Customer Support', included: false },
			{ label: 'SSO', included: false }
		],
		order: 0,
		cta: 'Get Started'
	},
	plus: {
		tier: 'plus',
		name: 'Plus',
		tagline: 'For the standard user.',
		contactLimit: 25,
		freeTrialDays: 14,
		features: [
			{ label: 'Up to 25 Contacts', included: true },
			{ label: 'Community Support', included: true },
			{ label: 'Automatic Backups', included: true },
			{ label: '24/7 Customer Support', included: false },
			{ label: 'SSO', included: false }
		],
		lookupKeys: {
			month: 'plus_monthly',
			year: 'plus_yearly'
		},
		order: 1,
		cta: 'Start Free Trial'
	},
	pro: {
		tier: 'pro',
		name: 'Pro',
		tagline: 'For the power user.',
		contactLimit: Infinity,
		freeTrialDays: 14,
		features: [
			{ label: 'Unlimited Contacts', included: true },
			{ label: 'Community Support', included: true },
			{ label: 'Automatic Backups', included: true },
			{ label: '24/7 Customer Support', included: true },
			{ label: 'SSO', included: true }
		],
		lookupKeys: {
			month: 'pro_monthly',
			year: 'pro_yearly'
		},
		order: 2,
		cta: 'Start Free Trial'
	}
};

export const PRICING_ORDERED: ReadonlyArray<TierConfig> = Object.values(PRICING).sort(
	(a, b) => a.order - b.order
);

export function tierByLookupKey(key: string): TierConfig | undefined {
	return PRICING_ORDERED.find(
		(p) => p.lookupKeys?.month === key || p.lookupKeys?.year === key
	);
}
