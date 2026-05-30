// See https://svelte.dev/docs/kit/types#app
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';

/**
 * The narrowed user shape that ships to the browser via +layout.server.ts.
 * Server-side `locals.user` keeps the full Supabase `User` (we may need
 * `user_metadata`, etc. on the server); only this projection crosses the
 * serialization boundary.
 */
export interface SafeUser {
	id: string;
	email: string | null;
	fullName: string | null;
}

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			supabase: SupabaseClient<Database>;
			supabaseAdmin: SupabaseClient<Database>;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session: Session | null;
			user: User | null;
		}
		interface PageData {
			session: Session | null;
			user: SafeUser | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
