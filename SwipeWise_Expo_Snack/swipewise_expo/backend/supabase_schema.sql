-- NOTE (Recommendation Engine v1): this is the original base schema.
-- The live development database is additionally extended by Chat 05 migration
-- SwipeWise_verified_card_data_v1_2026_08_17.sql. Do not infer that the absence
-- of those later columns in this baseline file means they are absent live.

-- SwipeWise development/production-ready Supabase schema
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- Security model:
--   * auth.users is the source of identity.
--   * private user tables use RLS and auth.uid() isolation.
--   * public reference tables are client-readable only when rows are demo/verified.
--   * the mobile app must use only a publishable client key; never service_role/secret keys.
--
-- This file intentionally does NOT contain real payment credentials or verified financial data.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- User-owned data
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reward_preference text not null default 'overall'
    check (reward_preference in ('overall', 'cashback', 'travel_points')),
  appearance text not null default 'system'
    check (appearance in ('system', 'light', 'dark')),
  nearby_store_suggestions boolean not null default true,
  notifications jsonb not null default '{"purchase_alerts":true,"recommendations":true,"monthly_summary":true,"reward_updates":true,"marketing":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Public/reference card data
-- -----------------------------------------------------------------------------
create table if not exists public.banks (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null unique,
  country_code text not null default 'CA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.card_products (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.banks(id) on delete restrict,
  slug text not null unique,
  name text not null,
  network text,
  annual_fee numeric(10,2),
  active boolean not null default true,
  data_status text not null default 'draft'
    check (data_status in ('draft', 'demo', 'verified', 'retired')),
  verified_at timestamptz,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bank_id, name)
);

create table if not exists public.reward_rules (
  id uuid primary key default gen_random_uuid(),
  card_product_id uuid not null references public.card_products(id) on delete cascade,
  category text not null,
  merchant_pattern text,
  purchase_mode text check (purchase_mode is null or purchase_mode in ('in_store', 'online')),
  reward_kind text not null check (reward_kind in ('cashback', 'points')),
  rate numeric(10,4) not null check (rate >= 0),
  point_value_cents numeric(10,4) check (point_value_cents is null or point_value_cents >= 0),
  min_spend numeric(12,2) check (min_spend is null or min_spend >= 0),
  spend_cap numeric(12,2) check (spend_cap is null or spend_cap >= 0),
  data_status text not null default 'draft'
    check (data_status in ('draft', 'demo', 'verified', 'retired')),
  effective_from date,
  effective_until date,
  verified_at timestamptz,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_from is null or effective_until >= effective_from)
);

create table if not exists public.card_benefits (
  id uuid primary key default gen_random_uuid(),
  card_product_id uuid not null references public.card_products(id) on delete cascade,
  benefit_type text not null,
  details text,
  data_status text not null default 'draft'
    check (data_status in ('draft', 'demo', 'verified', 'retired')),
  verified_at timestamptz,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_product_id uuid not null references public.card_products(id) on delete restrict,
  nickname text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, card_product_id)
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_name text not null,
  purchase_mode text not null check (purchase_mode in ('in_store', 'online')),
  category text not null,
  amount numeric(12,2) check (amount is null or amount >= 0),
  recommended_card_id uuid references public.card_products(id) on delete set null,
  used_card_id uuid references public.card_products(id) on delete set null,
  estimated_reward numeric(12,4) check (estimated_reward is null or estimated_reward >= 0),
  recommendation_followed boolean,
  override_reason text,
  notes text,
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Separate history allows SwipeWise to later retain a recommendation even when
-- the user chooses not to log a purchase. The current Expo milestone does not
-- write this table yet, but it is protected now so the contract is ready.
create table if not exists public.recommendation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_name text,
  purchase_mode text check (purchase_mode is null or purchase_mode in ('in_store', 'online')),
  category text,
  amount numeric(12,2) check (amount is null or amount >= 0),
  recommended_card_id uuid references public.card_products(id) on delete set null,
  context jsonb not null default '{}'::jsonb,
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Automatically create profile/settings when Supabase Auth creates a user
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), '')
    )
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profile/settings rows for any Auth users that existed before this schema was applied.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), '')
  )
from auth.users u
on conflict (id) do nothing;

insert into public.user_settings (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;

-- -----------------------------------------------------------------------------
-- Updated-at triggers
-- -----------------------------------------------------------------------------
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at before update on public.user_settings
for each row execute procedure public.set_updated_at();

drop trigger if exists banks_set_updated_at on public.banks;
create trigger banks_set_updated_at before update on public.banks
for each row execute procedure public.set_updated_at();

drop trigger if exists card_products_set_updated_at on public.card_products;
create trigger card_products_set_updated_at before update on public.card_products
for each row execute procedure public.set_updated_at();

drop trigger if exists reward_rules_set_updated_at on public.reward_rules;
create trigger reward_rules_set_updated_at before update on public.reward_rules
for each row execute procedure public.set_updated_at();

drop trigger if exists card_benefits_set_updated_at on public.card_benefits;
create trigger card_benefits_set_updated_at before update on public.card_benefits
for each row execute procedure public.set_updated_at();

drop trigger if exists user_cards_set_updated_at on public.user_cards;
create trigger user_cards_set_updated_at before update on public.user_cards
for each row execute procedure public.set_updated_at();

drop trigger if exists purchases_set_updated_at on public.purchases;
create trigger purchases_set_updated_at before update on public.purchases
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index if not exists idx_card_products_bank_id on public.card_products(bank_id);
create index if not exists idx_card_products_status on public.card_products(data_status) where active = true;
create index if not exists idx_reward_rules_card_category on public.reward_rules(card_product_id, category);
create index if not exists idx_reward_rules_status on public.reward_rules(data_status);
create index if not exists idx_card_benefits_card_type on public.card_benefits(card_product_id, benefit_type);
create index if not exists idx_user_cards_user_id on public.user_cards(user_id);
create index if not exists idx_user_cards_product_id on public.user_cards(card_product_id);
create index if not exists idx_purchases_user_date on public.purchases(user_id, purchased_at desc);
create index if not exists idx_purchases_used_card on public.purchases(used_card_id);
create index if not exists idx_purchases_recommended_card on public.purchases(recommended_card_id);
create index if not exists idx_recommendation_history_user_date on public.recommendation_history(user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_cards enable row level security;
alter table public.purchases enable row level security;
alter table public.recommendation_history enable row level security;
alter table public.banks enable row level security;
alter table public.card_products enable row level security;
alter table public.reward_rules enable row level security;
alter table public.card_benefits enable row level security;

-- Drop old and new policy names so this script can be safely re-run during development.
drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_self_insert on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists user_settings_self_select on public.user_settings;
drop policy if exists user_settings_self_insert on public.user_settings;
drop policy if exists user_settings_self_update on public.user_settings;
drop policy if exists user_cards_self_all on public.user_cards;
drop policy if exists user_cards_self_select on public.user_cards;
drop policy if exists user_cards_self_insert on public.user_cards;
drop policy if exists user_cards_self_update on public.user_cards;
drop policy if exists user_cards_self_delete on public.user_cards;
drop policy if exists purchases_self_all on public.purchases;
drop policy if exists purchases_self_select on public.purchases;
drop policy if exists purchases_self_insert on public.purchases;
drop policy if exists purchases_self_update on public.purchases;
drop policy if exists purchases_self_delete on public.purchases;
drop policy if exists recommendation_history_self_select on public.recommendation_history;
drop policy if exists recommendation_history_self_insert on public.recommendation_history;
drop policy if exists recommendation_history_self_delete on public.recommendation_history;
drop policy if exists banks_public_read on public.banks;
drop policy if exists cards_public_verified_read on public.card_products;
drop policy if exists cards_public_read on public.card_products;
drop policy if exists rules_public_verified_read on public.reward_rules;
drop policy if exists rules_public_read on public.reward_rules;
drop policy if exists benefits_public_verified_read on public.card_benefits;
drop policy if exists benefits_public_read on public.card_benefits;

-- profiles: the authenticated user can only see/change their own row.
create policy profiles_self_select on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

-- Trigger creation is primary, but self-insert is allowed as a safe recovery path.
create policy profiles_self_insert on public.profiles
for insert to authenticated
with check ((select auth.uid()) = id);

create policy profiles_self_update on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- settings: own row only.
create policy user_settings_self_select on public.user_settings
for select to authenticated
using ((select auth.uid()) = user_id);

create policy user_settings_self_insert on public.user_settings
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy user_settings_self_update on public.user_settings
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- wallet: User A can never read/write User B's rows.
create policy user_cards_self_select on public.user_cards
for select to authenticated
using ((select auth.uid()) = user_id);

create policy user_cards_self_insert on public.user_cards
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy user_cards_self_update on public.user_cards
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_cards_self_delete on public.user_cards
for delete to authenticated
using ((select auth.uid()) = user_id);

-- purchases: User A can never read/write User B's rows.
create policy purchases_self_select on public.purchases
for select to authenticated
using ((select auth.uid()) = user_id);

create policy purchases_self_insert on public.purchases
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy purchases_self_update on public.purchases
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy purchases_self_delete on public.purchases
for delete to authenticated
using ((select auth.uid()) = user_id);

-- recommendation history: own rows only.
create policy recommendation_history_self_select on public.recommendation_history
for select to authenticated
using ((select auth.uid()) = user_id);

create policy recommendation_history_self_insert on public.recommendation_history
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy recommendation_history_self_delete on public.recommendation_history
for delete to authenticated
using ((select auth.uid()) = user_id);

-- Public/reference rows: read only when intentionally exposed.
create policy banks_public_read on public.banks
for select to anon, authenticated
using (true);

create policy cards_public_read on public.card_products
for select to anon, authenticated
using (active = true and data_status in ('demo', 'verified'));

create policy rules_public_read on public.reward_rules
for select to anon, authenticated
using (data_status in ('demo', 'verified'));

create policy benefits_public_read on public.card_benefits
for select to anon, authenticated
using (data_status in ('demo', 'verified'));

-- -----------------------------------------------------------------------------
-- API privileges. RLS still decides which rows an authenticated client can use.
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.banks, public.card_products, public.reward_rules, public.card_benefits to anon, authenticated;

grant select, insert, update on public.profiles, public.user_settings to authenticated;
grant select, insert, update, delete on public.user_cards, public.purchases to authenticated;
grant select, insert, delete on public.recommendation_history to authenticated;

-- Do not grant anon/authenticated INSERT/UPDATE/DELETE on reference tables.
revoke insert, update, delete on public.banks, public.card_products, public.reward_rules, public.card_benefits from anon, authenticated;
