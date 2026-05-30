/**
 * THIS FILE IS GENERATED.
 *
 * Regenerate with:  pnpm supabase:types
 *
 * We commit it so CI doesn't need to boot Supabase just to typecheck.
 * This is the shape we build up across the course; it matches the
 * migrations in `supabase/migrations/`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					full_name: string | null;
					updated_at: string;
				};
				Insert: {
					id: string;
					full_name?: string | null;
					updated_at?: string;
				};
				Update: {
					id?: string;
					full_name?: string | null;
					updated_at?: string;
				};
				Relationships: [];
			};
			contacts: {
				Row: {
					id: string;
					user_id: string;
					name: string;
					email: string | null;
					phone: string | null;
					notes: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					name: string;
					email?: string | null;
					phone?: string | null;
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					name?: string;
					email?: string | null;
					phone?: string | null;
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			billing_products: {
				Row: {
					id: string;
					active: boolean;
					name: string;
					description: string | null;
					metadata: Json | null;
				};
				Insert: {
					id: string;
					active?: boolean;
					name: string;
					description?: string | null;
					metadata?: Json | null;
				};
				Update: {
					id?: string;
					active?: boolean;
					name?: string;
					description?: string | null;
					metadata?: Json | null;
				};
				Relationships: [];
			};
			billing_prices: {
				Row: {
					id: string;
					product_id: string;
					active: boolean;
					currency: string;
					unit_amount: number;
					interval: 'month' | 'year' | null;
					interval_count: number | null;
					trial_period_days: number | null;
					lookup_key: string | null;
					metadata: Json | null;
				};
				Insert: {
					id: string;
					product_id: string;
					active?: boolean;
					currency: string;
					unit_amount: number;
					interval?: 'month' | 'year' | null;
					interval_count?: number | null;
					trial_period_days?: number | null;
					lookup_key?: string | null;
					metadata?: Json | null;
				};
				Update: {
					id?: string;
					product_id?: string;
					active?: boolean;
					currency?: string;
					unit_amount?: number;
					interval?: 'month' | 'year' | null;
					interval_count?: number | null;
					trial_period_days?: number | null;
					lookup_key?: string | null;
					metadata?: Json | null;
				};
				Relationships: [
					{
						foreignKeyName: 'billing_prices_product_id_fkey';
						columns: ['product_id'];
						referencedRelation: 'billing_products';
						referencedColumns: ['id'];
					}
				];
			};
			billing_customers: {
				Row: {
					user_id: string;
					stripe_customer_id: string;
				};
				Insert: {
					user_id: string;
					stripe_customer_id: string;
				};
				Update: {
					user_id?: string;
					stripe_customer_id?: string;
				};
				Relationships: [];
			};
			billing_subscriptions: {
				Row: {
					id: string;
					user_id: string;
					status:
						| 'trialing'
						| 'active'
						| 'canceled'
						| 'incomplete'
						| 'incomplete_expired'
						| 'past_due'
						| 'unpaid'
						| 'paused';
					price_id: string;
					quantity: number | null;
					cancel_at_period_end: boolean;
					current_period_start: string;
					current_period_end: string;
					trial_start: string | null;
					trial_end: string | null;
					cancel_at: string | null;
					canceled_at: string | null;
					metadata: Json | null;
				};
				Insert: {
					id: string;
					user_id: string;
					status: Database['public']['Tables']['billing_subscriptions']['Row']['status'];
					price_id: string;
					quantity?: number | null;
					cancel_at_period_end?: boolean;
					current_period_start: string;
					current_period_end: string;
					trial_start?: string | null;
					trial_end?: string | null;
					cancel_at?: string | null;
					canceled_at?: string | null;
					metadata?: Json | null;
				};
				Update: Partial<
					Database['public']['Tables']['billing_subscriptions']['Insert']
				>;
				Relationships: [];
			};
			stripe_events: {
				Row: {
					id: string;
					type: string;
					received_at: string;
				};
				Insert: {
					id: string;
					type: string;
					received_at?: string;
				};
				Update: {
					id?: string;
					type?: string;
					received_at?: string;
				};
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: {
			insert_contact_if_under_limit: {
				Args: {
					p_name: string;
					p_email: string | null;
					p_phone: string | null;
					p_notes: string | null;
				};
				Returns: Database['public']['Tables']['contacts']['Row'];
			};
		};
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
}
