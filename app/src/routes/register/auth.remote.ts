import { form, getRequestEvent } from '$app/server';
import { redirect } from '@sveltejs/kit';
import { z } from 'zod';

const RegisterSchema = z
	.object({
		full_name: z.string().min(2, 'Please enter your name.'),
		email: z.string().email('Enter a valid email.'),
		_password: z.string().min(8, 'Password must be at least 8 characters.'),
		_confirm: z.string()
	})
	.refine((d) => d._password === d._confirm, {
		message: 'Passwords do not match.',
		path: ['_confirm']
	});

export const register = form(RegisterSchema, async ({ full_name, email, _password }) => {
	const { locals, url } = getRequestEvent();
	const { data, error } = await locals.supabase.auth.signUp({
		email,
		password: _password,
		options: {
			emailRedirectTo: `${url.origin}/auth/callback`,
			data: { full_name }
		}
	});

	if (error || !data.user) {
		return { error: error?.message ?? 'Could not create account.' };
	}

	// A trigger on auth.users creates the profile row; we only need to
	// confirm the write here if the user is already signed in (email confirm off).
	if (data.session) redirect(303, '/contacts');
	return { message: 'Check your email to confirm your account.' };
});
