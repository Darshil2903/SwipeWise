import { GENERIC_PURCHASE_CATEGORIES, MERCHANT_CATALOG, merchantCatalogForMode } from '../config/merchantCatalog.js';

export const MCC_STATUS = Object.freeze({ VERIFIED: 'VERIFIED', LIKELY: 'LIKELY', UNKNOWN: 'UNKNOWN' });
export const ACCEPTANCE_STATUS = Object.freeze({ VERIFIED: 'VERIFIED', UNKNOWN: 'UNKNOWN' });
export const NORMALIZATION_STATUS = Object.freeze({ KNOWN: 'KNOWN', PROVIDER_ONLY: 'PROVIDER_ONLY', MANUAL: 'MANUAL' });

export function normalizeMerchantText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/https?:\/\//g, ' ')
    .replace(/www\./g, ' ')
    .replace(/\.ca\b/g, ' ')
    .replace(/\b(store|location|station)\s*#?\s*\d+[a-z-]*\b/g, ' ')
    .replace(/#\s*\d+[a-z-]*/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function aliasScore(input, alias) {
  const a = normalizeMerchantText(input);
  const b = normalizeMerchantText(alias);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.startsWith(b) || b.startsWith(a)) return 90;
  if (a.includes(b) || b.includes(a)) return 80;
  return 0;
}

export function findCatalogMerchant(name, mode = null, brandHints = []) {
  const candidates = mode ? merchantCatalogForMode(mode) : MERCHANT_CATALOG;
  const hints = [name, ...(brandHints || [])].filter(Boolean);
  let best = null;
  for (const merchant of candidates) {
    let score = 0;
    for (const hint of hints) {
      for (const alias of [merchant.canonicalName, merchant.brand, ...(merchant.aliases || []), ...(merchant.domains || [])]) {
        score = Math.max(score, aliasScore(hint, alias));
      }
    }
    if (score && (!best || score > best.score)) best = { merchant, score };
  }
  return best;
}

function modeKey(mode) {
  return mode === 'Online' || mode === 'online' ? 'online' : 'in_store';
}

function addressText(address = {}) {
  if (address.formattedAddress) return String(address.formattedAddress).trim();
  return [address.streetNumber, address.streetName, address.municipality, address.countrySubdivision, address.postalCode]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function providerClassifications(result = {}) {
  const classes = result?.poi?.classifications || [];
  return classes.flatMap((item) => item?.names || []).map((item) => item?.name).filter(Boolean);
}

function providerBrands(result = {}) {
  return (result?.poi?.brands || []).map((item) => item?.name).filter(Boolean);
}

function finiteProviderNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function acceptanceFor(catalogMerchant, mode) {
  const evidence = catalogMerchant?.acceptanceByMode?.[modeKey(mode)] || null;
  if (!evidence || evidence.status !== 'VERIFIED') {
    return { status: ACCEPTANCE_STATUS.UNKNOWN, networks: null, source: null, verifiedAt: null, scope: null };
  }
  return { ...evidence, networks: [...evidence.networks] };
}

function mccFor(catalogMerchant) {
  const evidence = catalogMerchant?.mccEvidence || null;
  if (!evidence || evidence.status !== MCC_STATUS.VERIFIED || !evidence.value) {
    return { status: MCC_STATUS.UNKNOWN, value: null, source: evidence?.source || null, verifiedAt: evidence?.verifiedAt || null };
  }
  return evidence;
}

export function normalizeProviderMerchant(result, { mode = 'In Store' } = {}) {
  const providerName = result?.poi?.name || result?.name || 'Unknown merchant';
  const brands = providerBrands(result);
  const match = findCatalogMerchant(providerName, modeKey(mode), brands);
  const catalog = match?.merchant || null;
  const categories = catalog?.categories || GENERIC_PURCHASE_CATEGORIES;
  const acceptance = acceptanceFor(catalog, mode);
  const mccEvidence = mccFor(catalog);
  const providerCategories = providerClassifications(result);

  const provider = result?.provider || 'google';

  return {
    id: catalog ? `merchant:${catalog.key}` : `${provider}:${result?.id || normalizeMerchantText(providerName)}`,
    merchantKey: catalog?.key || null,
    name: catalog?.canonicalName || providerName,
    canonicalName: catalog?.canonicalName || providerName,
    enteredName: null,
    providerName,
    providerPlaceId: result?.id || null,
    provider,
    providerScore: finiteProviderNumber(result?.score),
    distanceMeters: finiteProviderNumber(result?.dist),
    address: addressText(result?.address),
    coordinates: result?.position && Number.isFinite(Number(result.position.lat)) && Number.isFinite(Number(result.position.lon))
      ? { latitude: Number(result.position.lat), longitude: Number(result.position.lon) }
      : null,
    brand: catalog?.brand || brands[0] || null,
    categories,
    normalizedCategory: catalog?.normalizedCategory || providerCategories[0] || null,
    providerCategories,
    normalizationStatus: catalog ? NORMALIZATION_STATUS.KNOWN : NORMALIZATION_STATUS.PROVIDER_ONLY,
    normalizationConfidence: catalog ? (match.score >= 90 ? 'HIGH' : 'MEDIUM') : 'LOW',
    mccEvidence,
    acceptance,
    source: { provider, providerPlaceId: result?.id || null },
  };
}

export function normalizeCatalogMerchant(catalogMerchant, { mode = 'Online', enteredName = null } = {}) {
  const acceptance = acceptanceFor(catalogMerchant, mode);
  const mccEvidence = mccFor(catalogMerchant);
  return {
    id: `merchant:${catalogMerchant.key}`,
    merchantKey: catalogMerchant.key,
    name: catalogMerchant.canonicalName,
    canonicalName: catalogMerchant.canonicalName,
    enteredName,
    providerName: null,
    providerPlaceId: null,
    provider: 'catalog',
    providerScore: null,
    distanceMeters: null,
    address: '',
    coordinates: null,
    brand: catalogMerchant.brand || null,
    categories: catalogMerchant.categories || GENERIC_PURCHASE_CATEGORIES,
    normalizedCategory: catalogMerchant.normalizedCategory || null,
    providerCategories: [],
    normalizationStatus: NORMALIZATION_STATUS.KNOWN,
    normalizationConfidence: 'HIGH',
    mccEvidence,
    acceptance,
    source: { provider: 'catalog', providerPlaceId: null },
  };
}

export function createManualMerchant(name, { mode = 'In Store' } = {}) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  const match = findCatalogMerchant(trimmed, modeKey(mode));
  if (match?.score >= 80) {
    return normalizeCatalogMerchant(match.merchant, { mode, enteredName: trimmed });
  }

  return {
    id: `manual:${normalizeMerchantText(trimmed) || 'merchant'}`,
    merchantKey: null,
    name: trimmed,
    canonicalName: trimmed,
    enteredName: trimmed,
    providerName: null,
    providerPlaceId: null,
    provider: 'manual',
    providerScore: null,
    distanceMeters: null,
    address: '',
    coordinates: null,
    brand: null,
    categories: GENERIC_PURCHASE_CATEGORIES,
    normalizedCategory: null,
    providerCategories: [],
    normalizationStatus: NORMALIZATION_STATUS.MANUAL,
    normalizationConfidence: 'UNKNOWN',
    mccEvidence: { status: MCC_STATUS.UNKNOWN, value: null, source: null, verifiedAt: null },
    acceptance: { status: ACCEPTANCE_STATUS.UNKNOWN, networks: null, source: null, verifiedAt: null, scope: null },
    source: { provider: 'manual', providerPlaceId: null },
  };
}

export function searchCatalogMerchants(query, { mode = 'online', limit = 10 } = {}) {
  const text = normalizeMerchantText(query);
  const source = merchantCatalogForMode(mode);
  const scored = source.map((merchant) => {
    const aliases = [merchant.canonicalName, merchant.brand, ...(merchant.aliases || []), ...(merchant.domains || [])].filter(Boolean);
    const score = text ? Math.max(...aliases.map((alias) => aliasScore(query, alias))) : 1;
    return { merchant, score };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.merchant.canonicalName.localeCompare(b.merchant.canonicalName))
    .slice(0, limit);

  return scored.map(({ merchant }) => normalizeCatalogMerchant(merchant, { mode }));
}

function distanceBand(distance) {
  if (!Number.isFinite(distance)) return 4;
  if (distance <= 30) return 0;
  if (distance <= 100) return 1;
  if (distance <= 250) return 2;
  return 3;
}

export function nearbyConfidenceLabel(merchant) {
  const distance = merchant?.distanceMeters;
  const known = merchant?.normalizationStatus === NORMALIZATION_STATUS.KNOWN;
  if (known && Number.isFinite(distance) && distance <= 50) return 'High confidence';
  if (Number.isFinite(distance) && distance <= 150) return known ? 'Likely nearby' : 'Nearby';
  return 'Possible match';
}

export function orderNearbyMerchants(merchants = []) {
  return [...merchants].sort((a, b) => {
    const band = distanceBand(a.distanceMeters) - distanceBand(b.distanceMeters);
    if (band) return band;
    const known = Number(b.normalizationStatus === NORMALIZATION_STATUS.KNOWN) - Number(a.normalizationStatus === NORMALIZATION_STATUS.KNOWN);
    if (known) return known;
    const score = (b.providerScore || 0) - (a.providerScore || 0);
    if (score) return score;
    return (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER);
  });
}

export function toRecommendationMerchantContext(merchant) {
  if (!merchant) return {};
  const mccVerified = merchant.mccEvidence?.status === MCC_STATUS.VERIFIED;
  const acceptanceVerified = merchant.acceptance?.status === ACCEPTANCE_STATUS.VERIFIED;
  return {
    merchantName: merchant.canonicalName || merchant.name || '',
    mcc: mccVerified ? merchant.mccEvidence.value : null,
    acceptedNetworks: acceptanceVerified ? merchant.acceptance.networks : null,
    // Provider categories are intentionally NOT promoted into financial issuer/MCC
    // classifications. A POI category is not proof of how a card network codes a transaction.
    merchantClassifications: [],
    merchantAttributes: {},
  };
}
