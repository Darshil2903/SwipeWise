-- Fix SwipeWise Google Places usage-guard RPC ambiguity.
-- The function returns a column named month_start; unqualified references to
-- the table's month_start column can therefore be ambiguous in PL/pgSQL.
-- Use explicit table aliases and the primary-key constraint for ON CONFLICT.

create or replace function public.consume_google_places_request(p_limit integer)
returns table (
  allowed boolean,
  used integer,
  remaining integer,
  month_start date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date;
  v_count integer;
begin
  if p_limit is null or p_limit < 1 then
    raise exception 'p_limit must be at least 1';
  end if;

  v_month := date_trunc('month', timezone('America/Los_Angeles', now()))::date;

  insert into public.google_places_monthly_usage (month_start, request_count, updated_at)
  values (v_month, 0, now())
  on conflict on constraint google_places_monthly_usage_pkey do nothing;

  update public.google_places_monthly_usage as g
     set request_count = g.request_count + 1,
         updated_at = now()
   where g.month_start = v_month
     and g.request_count < p_limit
  returning g.request_count into v_count;

  if found then
    return query
      select true,
             v_count,
             greatest(p_limit - v_count, 0),
             v_month;
    return;
  end if;

  select g.request_count
    into v_count
    from public.google_places_monthly_usage as g
   where g.month_start = v_month;

  return query
    select false,
           coalesce(v_count, p_limit),
           0,
           v_month;
end;
$$;

revoke all on function public.consume_google_places_request(integer) from public, anon, authenticated;
grant execute on function public.consume_google_places_request(integer) to service_role;
