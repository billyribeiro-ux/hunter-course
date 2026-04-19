-- ─────────────────────────────────────────────────────────────────────────────
-- Contacts table
--
-- One row per contact. Owned by a single user. RLS enforces that users can
-- only ever see or mutate their own rows — no application-layer filters.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.contacts (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    name        text not null check (length(name) between 1 and 120),
    email       text,
    phone       text,
    notes       text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index contacts_user_id_idx on public.contacts (user_id);
create index contacts_created_at_idx on public.contacts (created_at desc);

alter table public.contacts enable row level security;

create policy "Contacts are visible to owner"
    on public.contacts for select
    using (auth.uid() = user_id);

create policy "Contacts are insertable by owner"
    on public.contacts for insert
    with check (auth.uid() = user_id);

create policy "Contacts are updatable by owner"
    on public.contacts for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Contacts are deletable by owner"
    on public.contacts for delete
    using (auth.uid() = user_id);
