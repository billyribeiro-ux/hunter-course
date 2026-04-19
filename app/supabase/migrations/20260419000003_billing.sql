-- ─────────────────────────────────────────────────────────────────────────────
-- Billing mirror tables
--
-- These are a **local mirror** of Stripe state. Only webhook handlers and
-- the seed script write to them; the app reads from them on every request.
--
-- RLS: everyone can read products/prices (pricing page is public); customers
-- and subscriptions are owner-only. Writes are always done via service role.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.billing_products (
    id          text primary key,
    active      boolean not null default true,
    name        text not null,
    description text,
    metadata    jsonb
);

create table public.billing_prices (
    id                 text primary key,
    product_id         text not null references public.billing_products(id) on delete cascade,
    active             boolean not null default true,
    currency           text not null,
    unit_amount        bigint not null,
    interval           text check (interval in ('month', 'year')),
    interval_count     integer,
    trial_period_days  integer,
    lookup_key         text unique,
    metadata           jsonb
);

create index billing_prices_product_id_idx on public.billing_prices (product_id);

create table public.billing_customers (
    user_id            uuid primary key references auth.users(id) on delete cascade,
    stripe_customer_id text not null unique
);

create table public.billing_subscriptions (
    id                      text primary key,
    user_id                 uuid not null references auth.users(id) on delete cascade,
    status                  text not null check (status in (
                                'trialing', 'active', 'canceled', 'incomplete',
                                'incomplete_expired', 'past_due', 'unpaid', 'paused'
                            )),
    price_id                text not null references public.billing_prices(id),
    quantity                integer,
    cancel_at_period_end    boolean not null default false,
    current_period_start    timestamptz not null,
    current_period_end      timestamptz not null,
    trial_start             timestamptz,
    trial_end               timestamptz,
    cancel_at               timestamptz,
    canceled_at             timestamptz,
    metadata                jsonb
);

create index billing_subs_user_id_idx on public.billing_subscriptions (user_id);
create index billing_subs_status_idx on public.billing_subscriptions (status);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.billing_products      enable row level security;
alter table public.billing_prices        enable row level security;
alter table public.billing_customers     enable row level security;
alter table public.billing_subscriptions enable row level security;

create policy "Products are public"       on public.billing_products for select using (true);
create policy "Prices are public"         on public.billing_prices   for select using (true);
create policy "Customer visible to owner" on public.billing_customers
    for select using (auth.uid() = user_id);
create policy "Subs visible to owner"     on public.billing_subscriptions
    for select using (auth.uid() = user_id);
