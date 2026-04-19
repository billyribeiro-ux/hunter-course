-- Seed used by `supabase db reset`.
-- Seeds two demo users so Playwright has something to log in as.

insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
) values
(
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated',
    'demo@contactly.app',
    crypt('Password123!', gen_salt('bf')),
    now(),
    '{"full_name":"Demo User"}'::jsonb,
    now(), now(), '', '', '', ''
),
(
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated',
    'pro@contactly.app',
    crypt('Password123!', gen_salt('bf')),
    now(),
    '{"full_name":"Pro User"}'::jsonb,
    now(), now(), '', '', '', ''
)
on conflict (id) do nothing;

-- Give the demo user a handful of contacts.
insert into public.contacts (user_id, name, email, phone, notes) values
('11111111-1111-1111-1111-111111111111', 'Ada Lovelace',  'ada@analytic.engine',  '+44 20 1111 1111', 'Pioneer.'),
('11111111-1111-1111-1111-111111111111', 'Grace Hopper',  'grace@compiler.dev',   '+1 212 222 2222',  'Nanoseconds!'),
('11111111-1111-1111-1111-111111111111', 'Alan Turing',   'alan@turing.test',     '+44 161 333 3333', null)
on conflict do nothing;
