-- SwipeWise planned production schema (not required by the v0.1 local prototype).
-- Apply only after creating a Supabase project and reviewing all policies.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  reward_preference text not null default 'overall',
  created_at timestamptz not null default now()
);

create table if not exists public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  country_code text not null default 'CA'
);

create table if not exists public.card_products (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.banks(id),
  name text not null,
  network text not null,
  annual_fee numeric(10,2) not null default 0,
  active boolean not null default true,
  data_status text not null default 'draft',
  verified_at timestamptz,
  source_url text
);

create table if not exists public.reward_rules (
  id uuid primary key default gen_random_uuid(),
  card_product_id uuid not null references public.card_products(id) on delete cascade,
  category text not null,
  reward_kind text not null,
  rate numeric(10,4) not null,
  point_value_cents numeric(10,4),
  spend_cap numeric(12,2),
  effective_from date,
  effective_until date,
  verified_at timestamptz,
  source_url text
);

create table if not exists public.card_benefits (
  id uuid primary key default gen_random_uuid(),
  card_product_id uuid not null references public.card_products(id) on delete cascade,
  benefit_type text not null,
  details text,
  verified_at timestamptz,
  source_url text
);

create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_product_id uuid not null references public.card_products(id),
  nickname text,
  created_at timestamptz not null default now(),
  unique(user_id, card_product_id)
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_name text not null,
  purchase_mode text not null,
  category text not null,
  amount numeric(12,2),
  recommended_card_id uuid references public.card_products(id),
  used_card_id uuid references public.card_products(id),
  estimated_reward numeric(12,4),
  recommendation_followed boolean,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_cards enable row level security;
alter table public.purchases enable row level security;
alter table public.banks enable row level security;
alter table public.card_products enable row level security;
alter table public.reward_rules enable row level security;
alter table public.card_benefits enable row level security;

create policy "profiles_self_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "user_cards_self_all" on public.user_cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "purchases_self_all" on public.purchases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public verified reference data is readable; only service/admin roles should be allowed to write it.
create policy "banks_public_read" on public.banks for select using (true);
create policy "cards_public_verified_read" on public.card_products for select using (data_status = 'verified');
create policy "rules_public_verified_read" on public.reward_rules for select using (verified_at is not null);
create policy "benefits_public_verified_read" on public.card_benefits for select using (verified_at is not null);
