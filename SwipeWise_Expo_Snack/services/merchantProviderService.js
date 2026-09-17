import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import {
  normalizeProviderMerchant,
  orderNearbyMerchants,
  searchCatalogMerchants,
} from './merchantNormalization.js';

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function functionErrorMessage(error) {
  const fallback = error?.message || 'Merchant provider request failed.';
  const response = error?.context;
  if (!response) return fallback;

  try {
    const readable = typeof response.clone === 'function' ? response.clone() : response;
    const payload = await readable.json();
    return payload?.error || payload?.message || fallback;
  } catch {
    return fallback;
  }
}

async function invokeProvider(body) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Merchant provider is unavailable until Supabase is configured.');
  }
  const { data, error } = await supabase.functions.invoke('merchant-search', { body });
  if (error) throw new Error(await functionErrorMessage(error));
  if (!data || data.ok !== true) throw new Error(data?.error || 'Merchant provider request failed.');
  return Array.isArray(data.results) ? data.results : [];
}

export async function getNearbyMerchants(coords, { radius = 600, limit = 12 } = {}) {
  const latitude = finite(coords?.latitude);
  const longitude = finite(coords?.longitude);
  if (latitude == null || longitude == null) throw new Error('A valid foreground location is required.');

  // Google Places content is intentionally not cached or durably stored by this
  // client service. Each explicit nearby request goes through the backend proxy.
  const raw = await invokeProvider({
    action: 'nearby',
    latitude,
    longitude,
    radius,
    limit,
  });
  return orderNearbyMerchants(raw.map((result) => normalizeProviderMerchant(result, { mode: 'In Store' })));
}

export async function searchInStoreMerchants(query, { coords = null, limit = 12 } = {}) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return searchCatalogMerchants('', { mode: 'in_store', limit });

  const local = searchCatalogMerchants(trimmed, { mode: 'in_store', limit });

  // Location denial must never block merchant search. Without user-provided
  // foreground coordinates we intentionally avoid server-IP-biased Google
  // Text Search and keep the local catalog + manual-entry fallback.
  const latitude = finite(coords?.latitude);
  const longitude = finite(coords?.longitude);
  if (!isSupabaseConfigured || latitude == null || longitude == null) return local;

  try {
    const raw = await invokeProvider({
      action: 'search',
      query: trimmed,
      latitude,
      longitude,
      radius: 10_000,
      limit,
    });
    const provider = raw.map((result) => normalizeProviderMerchant(result, { mode: 'In Store' }));

    // Prefer physical Google place results when available. Keep catalog entries
    // only for merchant identities not already represented by a provider result.
    const providerKnownKeys = new Set(provider.map((merchant) => merchant.merchantKey).filter(Boolean));
    const localFallback = local.filter((merchant) => !merchant.merchantKey || !providerKnownKeys.has(merchant.merchantKey));
    return [...provider, ...localFallback].slice(0, limit);
  } catch {
    // Manual/local catalog fallback intentionally remains available when the
    // provider is unavailable or the monthly safety cap has been reached.
    return local;
  }
}

export function searchOnlineMerchants(query, { limit = 12 } = {}) {
  return searchCatalogMerchants(query, { mode: 'online', limit });
}

// Kept as a compatibility no-op for callers from older Chat 07 builds.
// Google Places provider content is not cached in this implementation.
export function clearNearbyMerchantCache() {}
