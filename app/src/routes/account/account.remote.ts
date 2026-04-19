import { form, getRequestEvent } from '$app/server';
import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { getOrCreateStripeCustomer } from '$lib/server/services/customers';
import { stripe } from '$lib/server/stripe';

function requireUser() {
	const event = getRequestEvent();
	if (!event.locals.user) error(401, 'Unauthorized');
	return event;
}

export const updateProfile = form(
	z.object({ full_name: z.string().min(2).max(120) }),
	async ({ full_name }) => {
		const { locals } = requireUser();
		const { error: err } = await locals.supabase
			.from('profiles')
			.update({ full_name, updated_at: new Date().toISOString() })
			.eq('id', locals.user!.id);
		if (err) return { error: 'Could not update profile.' };
		return { ok: true };
	}
);

export const updateEmail = form(
	z.object({ email: z.string().email() }),
	async ({ email }) => {
		const { locals } = requireUser();
		const { error: err } = await locals.supabase.auth.updateUser({ email });
		if (err) return { error: err.message };
		return { ok: true };
	}
);

export const updatePassword = form(
	z
		.object({
			_password: z.string().min(8),
			_confirm: z.string()
		})
		.refine((d) => d._password === d._confirm, {
			message: 'Passwords do not match.',
			path: ['_confirm']
		}),
	async ({ _password }) => {
		const { locals } = requireUser();
		const { error: err } = await locals.supabase.auth.updateUser({ password: _password });
		if (err) return { error: err.message };
		return { ok: true };
	}
);

export const openBillingPortal = form(z.object({}), async () => {
	const { locals, url } = requireUser();
	const customerId = await getOrCreateStripeCustomer(locals.supabaseAdmin, locals.user!);

	const portal = await stripe.billingPortal.sessions.create({
		customer: customerId,
		return_url: `${url.origin}/account`
	});

	return { url: portal.url };
});

export const signOut = form(z.object({}), async () => {
	const { locals } = requireUser();
	await locals.supabase.auth.signOut();
	redirect(303, '/');
});
