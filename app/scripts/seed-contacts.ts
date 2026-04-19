#!/usr/bin/env tsx
/**
 * Seed contacts against the local Supabase using the service role key.
 * Useful for demoing tier-limits without registering a new account each time.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/types/database.types';

const url = process.env.PUBLIC_SUPABASE_URL;
const service = process.env.PRIVATE_SUPABASE_SERVICE_ROLE;
if (!url || !service) {
	console.error('Missing Supabase env vars. Copy .env.example to .env.local first.');
	process.exit(1);
}

const admin = createClient<Database>(url, service);

const DEMO_USER = '11111111-1111-1111-1111-111111111111';
const names = ['Linus', 'Margaret', 'Guido', 'Edsger', 'Barbara', 'Donald', 'Leslie', 'Tim'];

const rows = names.map((n) => ({
	user_id: DEMO_USER,
	name: n,
	email: `${n.toLowerCase()}@seed.contactly.app`
}));

const { error } = await admin.from('contacts').insert(rows);
if (error) {
	console.error(error);
	process.exit(1);
}
console.log(`Inserted ${rows.length} contacts for demo user.`);
