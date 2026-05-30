import { form, getRequestEvent } from '$app/server';
import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { getOrCreateStripeCustomer } from '$lib/server/services/customers';
import { stripe } from '$lib/server/stripe';
import { enforce } from '$lib/server/rate-limit';

function requireUser() {
	const event = getRequestEvent();
	if (!event.locals.user) error(401, 'Unauthorized');
	return event;
}

export const updateProfile = form(
	z.object({
		full_name: z
			.string()
			.min(2)
			.max(120)
			// Belt-and-brace XSS guard against any future `{@html full_name}`.
			.regex(/^[^<>]+$/, 'Name cannot contain < or >.')
	}),
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

// Constant message so we never reveal whether the target email already
// belongs to another account.
const EMAIL_UPDATE_OK = {
	message: 'Check your inbox to confirm the new email address.'
};

export const updateEmail = form(
	z.object({ email: z.string().email() }),
	async ({ email }) => {
		const event = requireUser();
		await enforce(event, 'updateAuth', `user:${event.locals.user!.id}`);
		const { error: err } = await event.locals.supabase.auth.updateUser({ email });
		if (err) {
			// Treat "already in use" the same as success to prevent enumeration
			// from inside an authenticated session.
			if (/already|exists|registered/i.test(err.message)) return EMAIL_UPDATE_OK;
			return { error: 'Could not update email.' };
		}
		return EMAIL_UPDATE_OK;
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
		const event = requireUser();
		await enforce(event, 'updateAuth', `user:${event.locals.user!.id}`);
		const { error: err } = await event.locals.supabase.auth.updateUser({ password: _password });
		if (err) {
			// Surface only the password-policy class of message; everything else
			// becomes a generic failure.
			const isPasswordPolicy = /password|weak|short|breached|pwned/i.test(err.message);
			return { error: isPasswordPolicy ? err.message : 'Could not update password.' };
		}
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
