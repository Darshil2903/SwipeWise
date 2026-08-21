// SwipeWise point-valuation registry.
// IMPORTANT: issuer earn rules are facts; point cash-equivalent values are estimates.
// Production defaults are intentionally empty until SwipeWise adopts a separately sourced
// valuation methodology. The recommendation engine accepts valuations by injection.

export const productionPointValuations = Object.freeze({});

export function buildPointValuation({ rewardCurrency, centsPerPoint, source, asOf, status = 'ESTIMATED' }) {
  if (!rewardCurrency || !Number.isFinite(Number(centsPerPoint)) || Number(centsPerPoint) < 0) {
    throw new Error('A point valuation needs a reward currency and a non-negative cents-per-point value.');
  }
  return {
    rewardCurrency,
    centsPerPoint: Number(centsPerPoint),
    source: source || 'SWIPEWISE_ESTIMATED_POINT_VALUATION',
    asOf: asOf || new Date().toISOString(),
    status,
  };
}
