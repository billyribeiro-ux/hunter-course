-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles table
--
-- One row per user. Keyed by auth.users.id. Populated automatically by a
-- trigger on auth.users so we never have an orphan auth row without a profile.
--
-- RLS: users can read/update only their own row.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    full_name   text,
    updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by owner"
    on public.profiles for select
    using (auth.uid() = id);

create policy "Profiles are updatable by owner"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- ── Auto-create a profile when a new auth user is inserted ───────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();
