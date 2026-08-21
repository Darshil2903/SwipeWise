-- SwipeWise DEMO reference seed
-- Run AFTER backend/supabase_schema.sql.
--
-- These rows exist only so the current Expo prototype can persist wallet card
-- relationships while the verified Canadian card database is built separately.
-- They are explicitly marked data_status='demo'. No reward percentages are
-- inserted here and nothing in this file should be treated as verified finance data.

insert into public.banks (slug, name, country_code)
values
  ('cibc', 'CIBC', 'CA'),
  ('td', 'TD', 'CA'),
  ('rbc', 'RBC', 'CA'),
  ('american-express', 'American Express', 'CA')
on conflict (name) do update
set slug = excluded.slug,
    country_code = excluded.country_code;

insert into public.card_products (bank_id, slug, name, network, annual_fee, active, data_status)
select b.id, x.slug, x.name, x.network, null, true, 'demo'
from (
  values
    ('CIBC', 'cibc-costco', 'Costco Mastercard', 'Mastercard'),
    ('CIBC', 'cibc-aventura', 'Aventura Visa', 'Visa'),
    ('TD', 'td-aeroplan', 'Aeroplan Visa Infinite', 'Visa'),
    ('RBC', 'rbc-avion', 'Avion Visa Infinite', 'Visa'),
    ('American Express', 'amex-cobalt', 'Cobalt Card', 'American Express')
) as x(bank_name, slug, name, network)
join public.banks b on b.name = x.bank_name
on conflict (slug) do update
set bank_id = excluded.bank_id,
    name = excluded.name,
    network = excluded.network,
    active = true,
    data_status = 'demo';
