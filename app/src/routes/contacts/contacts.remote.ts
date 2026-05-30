import { query, form, command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';

const IdSchema = z.string().uuid();

// `^[^<>]+$` is a belt-and-brace XSS guard: even though Svelte auto-escapes
// `{name}` interpolations, a future `{@html name}` regression would otherwise
// be exploitable.
const ContactSchema = z.object({
	name: z
		.string()
		.min(1, 'Name is required.')
		.max(120)
		.regex(/^[^<>]+$/, 'Name cannot contain < or >.'),
	email: z.string().email().or(z.literal('')).optional(),
	phone: z
		.string()
		.max(40)
		.regex(/^[^<>]*$/, 'Phone cannot contain < or >.')
		.optional(),
	notes: z
		.string()
		.max(2000)
		.regex(/^[^<>]*$/, 'Notes cannot contain < or >.')
		.optional()
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

/**
 * Create a contact via the `insert_contact_if_under_limit` RPC, which takes
 * a per-user advisory lock so concurrent inserts can't both squeak past the
 * tier limit (the read+insert is now atomic at the database level).
 */
export const createContact = form(ContactSchema, async (input) => {
	const { locals } = requireUser();

	const { error: err } = await locals.supabase.rpc('insert_contact_if_under_limit', {
		p_name: input.name,
		p_email: input.email || null,
		p_phone: input.phone || null,
		p_notes: input.notes || null
	});

	if (err) {
		if (err.message?.includes('contact_limit_reached')) {
			return { error: 'Contact limit reached for your plan.' };
		}
		return { error: 'Could not create contact.' };
	}

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
