-- ─────────────────────────────────────────────────────────────────────────────
-- Atomic "create contact if under tier limit" RPC.
--
-- Replaces the app-layer count-then-insert in contacts.remote.ts, which had
-- a check-then-act race: two concurrent requests at limit-1 could both pass
-- the check and end up at limit+1.
--
-- This function takes a per-user advisory lock so the count and insert run
-- serially per user. Tier→limit mapping is duplicated from
-- `src/lib/config/pricing.ts` on purpose: this is the authoritative check;
-- the TS map is for UI display only. If the mapping ever drifts, the UI is
-- wrong but the server still enforces correctly.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.insert_contact_if_under_limit(
    p_name  text,
    p_email text,
    p_phone text,
    p_notes text
)
returns public.contacts
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_lookup_key text;
    v_limit int;
    v_count bigint;
    v_row public.contacts;
begin
    if v_user_id is null then
        raise exception 'unauthenticated' using errcode = '28000';
    end if;

    -- Serialize count+insert per user. Lock is released at transaction end.
    perform pg_advisory_xact_lock(hashtext('contact-limit:' || v_user_id::text));

    select bp.lookup_key into v_lookup_key
    from billing_subscriptions bs
    join billing_prices bp on bp.id = bs.price_id
    where bs.user_id = v_user_id
      and bs.status in ('trialing', 'active')
    order by bs.current_period_end desc
    limit 1;

    v_limit := case
        when v_lookup_key like 'pro_%'  then 2147483647  -- effectively unlimited
        when v_lookup_key like 'plus_%' then 25
        else 5                                            -- free
    end;

    select count(*) into v_count from contacts where user_id = v_user_id;

    if v_count >= v_limit then
        raise exception 'contact_limit_reached' using errcode = 'P0001';
    end if;

    insert into contacts (user_id, name, email, phone, notes)
    values (v_user_id, p_name, p_email, p_phone, p_notes)
    returning * into v_row;

    return v_row;
end;
$$;

revoke all on function public.insert_contact_if_under_limit(text, text, text, text) from public;
grant  execute on function public.insert_contact_if_under_limit(text, text, text, text) to authenticated;
