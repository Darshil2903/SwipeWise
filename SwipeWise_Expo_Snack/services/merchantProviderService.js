import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import {
  normalizeProviderMerchant,
  orderNearbyMerchants,
  searchCatalogMerchants,
} from './merchantNormalization.js';

const NEARBY_CACHE_TTL_MS = 60_000;
let nearbyCache = null;

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cacheMatches(coords, radius) {
  if (!nearbyCache) return false;
  if (Date.now() - nearbyCache.createdAt > NEARBY_CACHE_TTL_MS) return false;
  if (nearbyCache.radius !== radius) return false;
  const lat = finite(coords?.latitude);
  const lon = finite(coords?.longitude);
  if (lat == null || lon == null) return false;
  return Math.abs(lat - nearbyCache.latitude) < 0.0005 && Math.abs(lon - nearbyCache.longitude) < 0.0005;
}

async function invokeProvider(body) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Merchant provider is unavailable until Supabase is configured.');
  }
  const { data, error } = await supabase.functions.invoke('merchant-search', { body });
  if (error) throw error;
  if (!data || data.ok !== true) throw new Error(data?.error || 'Merchant provider request failed.');
  return Array.isArray(data.results) ? data.results : [];
}

export async function getNearbyMerchants(coords, { radius = 600, limit = 12 } = {}) {
  const latitude = finite(coords?.latitude);
  const longitude = finite(coords?.longitude);
  if (latitude == null || longitude == null) throw new Error('A valid foreground location is required.');

  if (cacheMatches(coords, radius)) return nearbyCache.results;

  const raw = await invokeProvider({
    action: 'nearby',
    latitude,
    longitude,
    radius,
    limit,
  });
  const normalized = orderNearbyMerchants(raw.map((result) => normalizeProviderMerchant(result, { mode: 'In Store' })));

  // Memory only; this disappears when the JS process ends. It is not purchase
  // history, analytics, AsyncStorage, or a durable coordinate log.
  nearbyCache = { latitude, longitude, radius, results: normalized, createdAt: Date.now() };
  return normalized;
}

export async function searchInStoreMerchants(query, { coords = null, limit = 12 } = {}) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return searchCatalogMerchants('', { mode: 'in_store', limit });

  const local = searchCatalogMerchants(trimmed, { mode: 'in_store', limit });
  if (!isSupabaseConfigured) return local;

  try {
    const raw = await invokeProvider({
      action: 'search',
      query: trimmed,
      latitude: finite(coords?.latitude),
      longitude: finite(coords?.longitude),
      radius: coords ? 10_000 : null,
      limit,
    });
    const provider = raw.map((result) => normalizeProviderMerchant(result, { mode: 'In Store' }));
    const seen = new Set();
    return [...local, ...provider].filter((merchant) => {
      const key = merchant.providerPlaceId || merchant.merchantKey || `${merchant.name}:${merchant.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  } catch {
    return local;
  }
}

export function searchOnlineMerchants(query, { limit = 12 } = {}) {
  return searchCatalogMerchants(query, { mode: 'online', limit });
}

export function clearNearbyMerchantCache() {
  nearbyCache = null;
}
