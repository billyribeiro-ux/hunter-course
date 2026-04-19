import { form } from '$app/server';
import { redirect } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { z } from 'zod';

const LoginSchema = z.object({
	email: z.string().email('Enter a valid email.'),
	// Leading underscore -> never rehydrated on error reload (sensitive)
	_password: z.string().min(6, 'Password must be at least 6 characters.')
});

export const login = form(LoginSchema, async ({ email, _password }) => {
	const { locals } = getRequestEvent();
	const { error } = await locals.supabase.auth.signInWithPassword({
		email,
		password: _password
	});

	if (error) {
		return { error: 'Incorrect email or password.' };
	}

	redirect(303, '/contacts');
});
