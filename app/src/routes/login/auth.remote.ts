import { form, getRequestEvent } from '$app/server';
import { redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { enforce, clientIp } from '$lib/server/rate-limit';

const LoginSchema = z.object({
	email: z.string().email('Enter a valid email.'),
	// Leading underscore -> never rehydrated on error reload (sensitive)
	_password: z.string().min(6, 'Password must be at least 6 characters.')
});

export const login = form(LoginSchema, async ({ email, _password }) => {
	const event = getRequestEvent();
	const ip = clientIp(event);
	const normalizedEmail = email.toLowerCase();

	// Two-key limit: rotating IPs get caught by the per-email limit; rotating
	// emails get caught by the per-IP limit. Together, credential stuffing is
	// bounded regardless of which dimension the attacker varies.
	await enforce(event, 'login', `ip:${ip}`);
	await enforce(event, 'login', `email:${normalizedEmail}`);

	const { error } = await event.locals.supabase.auth.signInWithPassword({
		email,
		password: _password
	});

	if (error) {
		return { error: 'Incorrect email or password.' };
	}

	redirect(303, '/contacts');
});
