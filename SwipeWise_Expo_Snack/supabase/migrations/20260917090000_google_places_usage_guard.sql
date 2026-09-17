-- SwipeWise Google Places monthly safety guard.
-- Purpose: stop Google Places calls before SwipeWise can cross the selected
-- free-tier safety threshold. This table stores only an aggregate monthly
-- request count. It stores no user IDs, merchant queries, or coordinates.

create table if not exists public.google_places_monthly_usage (
  month_start date primary key,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.google_places_monthly_usage is
  'Aggregate monthly Google Places request-attempt counter for the SwipeWise server-side safety cap. No user or location data is stored.';

alter table public.google_places_monthly_usage enable row level security;

-- Mobile/browser clients must not read or mutate this internal counter.
revoke all on table public.google_places_monthly_usage from public, anon, authenticated;
grant select, insert, update on table public.google_places_monthly_usage to service_role;

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

  -- Google Maps Platform free usage caps reset at the start of each month in
  -- Pacific Time. America/Los_Angeles handles PST/PDT automatically.
  v_month := date_trunc('month', timezone('America/Los_Angeles', now()))::date;

  insert into public.google_places_monthly_usage (month_start, request_count, updated_at)
  values (v_month, 0, now())
  on conflict (month_start) do nothing;

  -- Atomic guarded increment. Under concurrency, at most p_limit requests can
  -- be authorized for a given month.
  update public.google_places_monthly_usage
     set request_count = request_count + 1,
         updated_at = now()
   where month_start = v_month
     and request_count < p_limit
  returning request_count into v_count;

  if found then
    return query
      select true,
             v_count,
             greatest(p_limit - v_count, 0),
             v_month;
    return;
  end if;

  select request_count
    into v_count
    from public.google_places_monthly_usage
   where google_places_monthly_usage.month_start = v_month;

  return query
    select false,
           coalesce(v_count, p_limit),
           0,
           v_month;
end;
$$;

revoke all on function public.consume_google_places_request(integer) from public, anon, authenticated;
grant execute on function public.consume_google_places_request(integer) to service_role;
