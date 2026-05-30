import { form, getRequestEvent } from '$app/server';
import { redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { enforce, clientIp } from '$lib/server/rate-limit';

const RegisterSchema = z
	.object({
		// Block angle-brackets so a future {@html ...} on full_name can't be
		// weaponised. Svelte auto-escapes interpolations, so this is belt-and-brace.
		full_name: z
			.string()
			.min(2, 'Please enter your name.')
			.max(120)
			.regex(/^[^<>]+$/, 'Name cannot contain < or >.'),
		email: z.string().email('Enter a valid email.'),
		_password: z.string().min(8, 'Password must be at least 8 characters.'),
		_confirm: z.string()
	})
	.refine((d) => d._password === d._confirm, {
		message: 'Passwords do not match.',
		path: ['_confirm']
	});

// Constant response used whether or not the email is already registered.
// Prevents user enumeration: an attacker submitting candidate emails gets
// the same message either way.
const GENERIC_OK = {
	message: "If that email isn't already registered, check your inbox to confirm."
};

export const register = form(RegisterSchema, async ({ full_name, email, _password }) => {
	const event = getRequestEvent();
	const ip = clientIp(event);
	await enforce(event, 'signup', `ip:${ip}`);

	const { data, error } = await event.locals.supabase.auth.signUp({
		email,
		password: _password,
		options: {
			emailRedirectTo: `${event.url.origin}/auth/callback`,
			data: { full_name }
		}
	});

	// Two real failure modes we *should* surface to the user:
	//  - Password rejected by Supabase policy (too short, pwned, etc.)
	//  - Network / transient errors
	// Everything else (including "user already registered") collapses into
	// the constant GENERIC_OK response so we don't leak account existence.
	if (error) {
		const code = error.code ?? '';
		const isEnumerationLeak = code === 'user_already_exists' || /already/i.test(error.message);
		if (isEnumerationLeak) return GENERIC_OK;
		return { error: error.message };
	}

	// With email confirmations off in local dev, signUp leaves us signed in.
	if (data.session) redirect(303, '/contacts');
	return GENERIC_OK;
});
