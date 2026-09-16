import assert from 'node:assert/strict';
import {
  ACCEPTANCE_STATUS,
  MCC_STATUS,
  NORMALIZATION_STATUS,
  createManualMerchant,
  findCatalogMerchant,
  normalizeProviderMerchant,
  orderNearbyMerchants,
  searchCatalogMerchants,
  toRecommendationMerchantContext,
} from '../services/merchantNormalization.js';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function tomtomResult({ id, name, dist = 20, score = 0.9, brands = [], classification = 'shop' }) {
  return {
    id,
    dist,
    score,
    position: { lat: 49.28, lon: -123.12 },
    address: { streetNumber: '1', streetName: 'Test St', municipality: 'Vancouver', countrySubdivision: 'BC', postalCode: 'V0V0V0' },
    poi: {
      name,
      brands: brands.map((brand) => ({ name: brand })),
      classifications: [{ names: [{ name: classification }] }],
    },
  };
}

test('1. Costco provider alias normalizes to canonical Costco', () => {
  const merchant = normalizeProviderMerchant(tomtomResult({ id: 'c1', name: 'Costco Wholesale #1234' }), { mode: 'In Store' });
  assert.equal(merchant.merchantKey, 'costco');
  assert.equal(merchant.canonicalName, 'Costco');
  assert.equal(merchant.normalizationStatus, NORMALIZATION_STATUS.KNOWN);
  assert.equal(merchant.providerPlaceId, 'c1');
  assert.equal(merchant.providerName, 'Costco Wholesale #1234');
});

test('2. Shell aliases normalize without losing provider metadata', () => {
  const merchant = normalizeProviderMerchant(tomtomResult({ id: 's1', name: 'Shell Station #98', brands: ['Shell'] }), { mode: 'In Store' });
  assert.equal(merchant.merchantKey, 'shell');
  assert.equal(merchant.canonicalName, 'Shell');
  assert.equal(merchant.providerName, 'Shell Station #98');
  assert.equal(merchant.providerPlaceId, 's1');
});

test('3. Unknown manual merchant preserves the user-entered merchant name', () => {
  const merchant = createManualMerchant('Local Electronics Shop', { mode: 'In Store' });
  assert.equal(merchant.name, 'Local Electronics Shop');
  assert.equal(merchant.enteredName, 'Local Electronics Shop');
  assert.equal(merchant.normalizationStatus, NORMALIZATION_STATUS.MANUAL);
});

test('4. Unknown manual merchant never fabricates MCC or network acceptance', () => {
  const merchant = createManualMerchant('Local Electronics Shop', { mode: 'In Store' });
  assert.equal(merchant.mccEvidence.status, MCC_STATUS.UNKNOWN);
  assert.equal(merchant.mccEvidence.value, null);
  assert.equal(merchant.acceptance.status, ACCEPTANCE_STATUS.UNKNOWN);
  assert.equal(merchant.acceptance.networks, null);
});

test('5. Verified Costco in-store acceptance exposes Mastercard only', () => {
  const merchant = createManualMerchant('Costco', { mode: 'In Store' });
  assert.equal(merchant.acceptance.status, ACCEPTANCE_STATUS.VERIFIED);
  assert.deepEqual(merchant.acceptance.networks, ['Mastercard']);
});

test('6. Costco online acceptance stays mode-specific', () => {
  const merchant = createManualMerchant('Costco', { mode: 'Online' });
  assert.equal(merchant.acceptance.status, ACCEPTANCE_STATUS.VERIFIED);
  assert.deepEqual(merchant.acceptance.networks, ['Mastercard', 'Visa']);
});

test('7. Provider POI classifications are not promoted to financial MCC evidence', () => {
  const merchant = normalizeProviderMerchant(tomtomResult({ id: 'u1', name: 'Unlisted Pharmacy', classification: 'pharmacy' }), { mode: 'In Store' });
  assert.deepEqual(merchant.providerCategories, ['pharmacy']);
  assert.equal(merchant.mccEvidence.status, MCC_STATUS.UNKNOWN);
  const context = toRecommendationMerchantContext(merchant);
  assert.equal(context.mcc, null);
  assert.deepEqual(context.merchantClassifications, []);
});

test('8. Recommendation context includes verified network evidence only', () => {
  const costco = createManualMerchant('Costco', { mode: 'In Store' });
  const unknown = createManualMerchant('Some Local Shop', { mode: 'In Store' });
  assert.deepEqual(toRecommendationMerchantContext(costco).acceptedNetworks, ['Mastercard']);
  assert.equal(toRecommendationMerchantContext(unknown).acceptedNetworks, null);
});

test('9. In-store catalog search finds normalized known merchants without GPS', () => {
  const results = searchCatalogMerchants('Best Buy', { mode: 'in_store' });
  assert.ok(results.length >= 1);
  assert.equal(results[0].merchantKey, 'best-buy');
});

test('10. Online catalog search supports Amazon, Best Buy and Air Canada', () => {
  assert.equal(searchCatalogMerchants('Amazon', { mode: 'online' })[0]?.merchantKey, 'amazon');
  assert.equal(searchCatalogMerchants('Best Buy', { mode: 'online' })[0]?.merchantKey, 'best-buy');
  assert.equal(searchCatalogMerchants('Air Canada', { mode: 'online' })[0]?.merchantKey, 'air-canada');
});

test('11. Explicit purchase mode controls normalization context, not physical location', () => {
  const inStore = createManualMerchant('Costco', { mode: 'In Store' });
  const online = createManualMerchant('Costco', { mode: 'Online' });
  assert.deepEqual(inStore.acceptance.networks, ['Mastercard']);
  assert.deepEqual(online.acceptance.networks, ['Mastercard', 'Visa']);
  assert.notDeepEqual(inStore.acceptance.networks, online.acceptance.networks);
});

test('12. Nearby ordering is deterministic but never performs selection', () => {
  const farKnown = normalizeProviderMerchant(tomtomResult({ id: 'a', name: 'Costco', dist: 120, score: 0.9 }), { mode: 'In Store' });
  const closeUnknown = normalizeProviderMerchant(tomtomResult({ id: 'b', name: 'Cafe Next Door', dist: 20, score: 0.8 }), { mode: 'In Store' });
  const closeKnown = normalizeProviderMerchant(tomtomResult({ id: 'c', name: 'Shell', dist: 25, score: 0.7 }), { mode: 'In Store' });
  const ordered = orderNearbyMerchants([farKnown, closeUnknown, closeKnown]);
  assert.equal(ordered.length, 3);
  assert.equal(ordered[0].providerPlaceId, 'c');
  assert.equal(ordered[1].providerPlaceId, 'b');
  assert.equal(ordered[2].providerPlaceId, 'a');
  assert.ok(Array.isArray(ordered));
});

test('13. No nearby provider results remains a valid empty state', () => {
  assert.deepEqual(orderNearbyMerchants([]), []);
});

test('14. Unknown provider merchant remains PROVIDER_ONLY with unknown acceptance', () => {
  const merchant = normalizeProviderMerchant(tomtomResult({ id: 'z9', name: 'Neighbourhood Market' }), { mode: 'In Store' });
  assert.equal(merchant.normalizationStatus, NORMALIZATION_STATUS.PROVIDER_ONLY);
  assert.equal(merchant.acceptance.status, ACCEPTANCE_STATUS.UNKNOWN);
  assert.equal(merchant.acceptance.networks, null);
});

test('15. Known alias matching is deterministic', () => {
  const match = findCatalogMerchant('Amazon Canada', 'online');
  assert.equal(match?.merchant?.key, 'amazon');
  assert.ok(match.score >= 80);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

console.log(`\nMerchant context tests: ${passed}/${tests.length} passed`);
if (passed !== tests.length) process.exitCode = 1;
