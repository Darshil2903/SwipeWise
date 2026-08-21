import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireSupabase } from '../lib/supabase';

const CACHE_KEY = 'swipewise.reference-data.v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // one hour; verified_at remains visible in the UI.

const BANK_ACCENTS = Object.freeze({
  CIBC: '#B51225',
  TD: '#138A65',
  RBC: '#1E5FC4',
  'American Express': '#247EB5',
});

let memoryCache = null;

export async function getVerifiedReferenceData({ forceRefresh = false } = {}) {
  const cached = await readCache();
  const now = Date.now();
  const fresh = cached && now - new Date(cached.fetchedAt).getTime() <= CACHE_TTL_MS;

  if (!forceRefresh && fresh) return { ...cached, cacheStale: false, cacheSource: 'cache' };

  try {
    const remote = await fetchReferenceData();
    memoryCache = remote;
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote));
    return { ...remote, cacheStale: false, cacheSource: 'supabase' };
  } catch (error) {
    if (cached) {
      return {
        ...cached,
        cacheStale: true,
        cacheSource: 'stale_cache',
        cacheError: error.message || 'Could not refresh verified card data.',
      };
    }
    throw error;
  }
}

export async function clearReferenceCache() {
  memoryCache = null;
  await AsyncStorage.removeItem(CACHE_KEY);
}

async function readCache() {
  if (memoryCache) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cards || !parsed?.fetchedAt) return null;
    memoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

async function fetchReferenceData() {
  const supabase = requireSupabase();
  const { data: products, error: productError } = await supabase
    .from('card_products')
    .select(`
      id,
      slug,
      name,
      network,
      annual_fee,
      active,
      data_status,
      verified_at,
      source_url,
      card_type,
      supplementary_card_fee,
      foreign_transaction_fee_percent,
      product_status,
      verification_status,
      bank:banks(name, slug, country_code)
    `)
    .eq('active', true)
    .eq('data_status', 'verified')
    .order('name', { ascending: true });

  if (productError) throw productError;
  const productIds = (products || []).map((product) => product.id);
  if (!productIds.length) {
    throw new Error('No active verified card products are readable from Supabase. Confirm the Chat 05 verified-data migration and reference-table RLS policies.');
  }

  const [rulesResult, benefitsResult] = await Promise.all([
    supabase
      .from('reward_rules')
      .select(`
        id,
        card_product_id,
        category,
        merchant_pattern,
        purchase_mode,
        reward_kind,
        rate,
        point_value_cents,
        min_spend,
        spend_cap,
        data_status,
        effective_from,
        effective_until,
        verified_at,
        source_url,
        reward_currency,
        post_cap_rate,
        cap_group,
        cap_period,
        cap_reset_rule,
        cap_scope,
        eligibility_conditions,
        lifecycle_status,
        verification_status
      `)
      .in('card_product_id', productIds)
      .eq('data_status', 'verified'),
    supabase
      .from('card_benefits')
      .select(`
        id,
        card_product_id,
        benefit_type,
        details,
        data_status,
        verified_at,
        source_url,
        coverage_limit,
        key_conditions,
        effective_from,
        effective_until,
        verification_status
      `)
      .in('card_product_id', productIds)
      .eq('data_status', 'verified'),
  ]);

  if (rulesResult.error) throw rulesResult.error;
  if (benefitsResult.error) throw benefitsResult.error;

  const rulesByCard = groupByCard((rulesResult.data || []).map(normalizeRule));
  const benefitsByCard = groupByCard((benefitsResult.data || []).map(normalizeBenefit));
  const cards = (products || []).map((product) => normalizeCard(product, rulesByCard[product.id] || [], benefitsByCard[product.id] || []));

  return {
    version: 1,
    fetchedAt: new Date().toISOString(),
    cards,
  };
}

function groupByCard(rows) {
  return rows.reduce((groups, row) => {
    (groups[row.card_product_id] ||= []).push(row);
    return groups;
  }, {});
}

function normalizeCard(product, rewardRules, benefits) {
  const bankName = product.bank?.name || '';
  return {
    id: product.slug,
    slug: product.slug,
    cardProductId: product.id,
    name: product.name,
    bank: bankName,
    bankSlug: product.bank?.slug || null,
    countryCode: product.bank?.country_code || 'CA',
    network: product.network || 'Card',
    fee: numberOrNull(product.annual_fee),
    annualFee: numberOrNull(product.annual_fee),
    supplementaryCardFee: numberOrNull(product.supplementary_card_fee),
    foreignTransactionFeePercent: numberOrNull(product.foreign_transaction_fee_percent),
    cardType: product.card_type || null,
    active: Boolean(product.active),
    dataStatus: product.data_status,
    productStatus: product.product_status || 'ACTIVE',
    verificationStatus: product.verification_status || 'UNCERTAIN',
    verifiedAt: product.verified_at || null,
    sourceUrl: product.source_url || null,
    accent: BANK_ACCENTS[bankName] || '#1877B8',
    rewardRules,
    benefits,
    isOwned: true,
  };
}

function normalizeRule(rule) {
  return {
    ...rule,
    rate: numberOrNull(rule.rate),
    point_value_cents: numberOrNull(rule.point_value_cents),
    min_spend: numberOrNull(rule.min_spend),
    spend_cap: numberOrNull(rule.spend_cap),
    post_cap_rate: numberOrNull(rule.post_cap_rate),
    eligibility_conditions: rule.eligibility_conditions || {},
  };
}

function normalizeBenefit(benefit) {
  return {
    ...benefit,
    key_conditions: benefit.key_conditions || {},
  };
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
