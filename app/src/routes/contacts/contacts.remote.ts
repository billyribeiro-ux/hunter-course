import { query, form, command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { getActiveTier, tierLimit } from '$lib/server/tiers';

const IdSchema = z.string().uuid();

const ContactSchema = z.object({
	name: z.string().min(1, 'Name is required.').max(120),
	email: z.string().email().or(z.literal('')).optional(),
	phone: z.string().max(40).optional(),
	notes: z.string().max(2000).optional()
});

const UpdateSchema = ContactSchema.extend({ id: IdSchema });

function requireUser() {
	const event = getRequestEvent();
	if (!event.locals.user) error(401, 'Unauthorized');
	return event;
}

/** Read all contacts the current user owns. RLS enforces the filter. */
export const getContacts = query(async () => {
	const { locals } = requireUser();
	const { data, error: err } = await locals.supabase
		.from('contacts')
		.select('*')
		.order('created_at', { ascending: false });
	if (err) throw err;
	return data;
});

/** Create a contact. Validates tier limit server-side. */
export const createContact = form(ContactSchema, async (input) => {
	const { locals } = requireUser();
	const userId = locals.user!.id;

	const tier = await getActiveTier(locals.supabaseAdmin, userId);
	const limit = tierLimit(tier);
	if (limit !== Infinity) {
		const { count } = await locals.supabase
			.from('contacts')
			.select('id', { count: 'exact', head: true });
		if ((count ?? 0) >= limit) {
			return { error: `Contact limit reached for the ${tier} plan.` };
		}
	}

	const { error: err } = await locals.supabase.from('contacts').insert({
		user_id: userId,
		name: input.name,
		email: input.email || null,
		phone: input.phone || null,
		notes: input.notes || null
	});
	if (err) return { error: 'Could not create contact.' };

	// Single-flight refresh: push fresh list down with the same response.
	void getContacts().refresh();
	return { ok: true };
});

/** Update an existing contact. RLS enforces ownership. */
export const updateContact = form(UpdateSchema, async (input) => {
	const { locals } = requireUser();

	const { error: err } = await locals.supabase
		.from('contacts')
		.update({
			name: input.name,
			email: input.email || null,
			phone: input.phone || null,
			notes: input.notes || null,
			updated_at: new Date().toISOString()
		})
		.eq('id', input.id);
	if (err) return { error: 'Could not update contact.' };

	void getContacts().refresh();
	return { ok: true };
});

/** Delete a contact. Called imperatively from click handlers. */
export const deleteContact = command(IdSchema, async (id) => {
	const { locals } = requireUser();
	const { error: err } = await locals.supabase.from('contacts').delete().eq('id', id);
	if (err) error(500, 'Could not delete contact.');
	void getContacts().refresh();
});
