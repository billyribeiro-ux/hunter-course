-- ─────────────────────────────────────────────────────────────────────────────
-- Stripe webhook event-replay protection.
--
-- Stripe delivers webhooks at-least-once. Every handler in this app is
-- idempotent today, but the safety belt is making *processing* idempotent
-- too: insert the event id first, and skip the handler if it already exists.
--
-- Service role only — clients never see this table.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.stripe_events (
    id            text primary key,
    type          text not null,
    received_at   timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
-- No policies → no one but service role can read or write. That's the point.
