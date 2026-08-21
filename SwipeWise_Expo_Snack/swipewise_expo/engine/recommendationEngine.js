// SwipeWise Recommendation Engine v1
// Pure, deterministic financial decision logic. No network calls, no LLM calls.
// Financial facts must be supplied by verified reference data (normally Supabase).

export const REASON_CODES = Object.freeze({
  MERCHANT_BONUS: 'MERCHANT_BONUS',
  CATEGORY_BONUS: 'CATEGORY_BONUS',
  BASE_REWARD: 'BASE_REWARD',
  HIGHEST_CASHBACK: 'HIGHEST_CASHBACK',
  HIGHEST_ESTIMATED_POINT_VALUE: 'HIGHEST_ESTIMATED_POINT_VALUE',
  TRAVEL_POINTS_PREFERENCE: 'TRAVEL_POINTS_PREFERENCE',
  CASHBACK_PREFERENCE: 'CASHBACK_PREFERENCE',
  MAXIMUM_VALUE: 'MAXIMUM_VALUE',
  RELEVANT_EXTENDED_WARRANTY: 'RELEVANT_EXTENDED_WARRANTY',
  PURCHASE_PROTECTION: 'PURCHASE_PROTECTION',
  MOBILE_DEVICE_PROTECTION: 'MOBILE_DEVICE_PROTECTION',
  RENTAL_COVERAGE: 'RENTAL_COVERAGE',
  TRAVEL_PROTECTION: 'TRAVEL_PROTECTION',
  NETWORK_ACCEPTANCE: 'NETWORK_ACCEPTANCE',
  NETWORK_NOT_ACCEPTED: 'NETWORK_NOT_ACCEPTED',
  THRESHOLD_NOT_MET: 'THRESHOLD_NOT_MET',
  CAP_REACHED: 'CAP_REACHED',
  POST_CAP_RATE_USED: 'POST_CAP_RATE_USED',
  SHARED_CAP: 'SHARED_CAP',
  AMOUNT_REQUIRED: 'AMOUNT_REQUIRED',
  POINT_VALUE_UNAVAILABLE: 'POINT_VALUE_UNAVAILABLE',
  STALE_DATA_WARNING: 'STALE_DATA_WARNING',
  UNCERTAIN_DATA_WARNING: 'UNCERTAIN_DATA_WARNING',
  BENEFIT_TIE_BREAK: 'BENEFIT_TIE_BREAK',
  LEGACY_PRODUCT: 'LEGACY_PRODUCT',
});

export const WARNING_CODES = Object.freeze({
  NETWORK_NOT_ACCEPTED: 'NETWORK_NOT_ACCEPTED',
  ACCEPTANCE_UNKNOWN: 'ACCEPTANCE_UNKNOWN',
  POINT_VALUE_UNAVAILABLE: 'POINT_VALUE_UNAVAILABLE',
  STALE_DATA_WARNING: 'STALE_DATA_WARNING',
  UNCERTAIN_DATA_WARNING: 'UNCERTAIN_DATA_WARNING',
  PRODUCT_NOT_ELIGIBLE: 'PRODUCT_NOT_ELIGIBLE',
  NO_VERIFIED_RULE: 'NO_VERIFIED_RULE',
  RULE_NOT_EFFECTIVE: 'RULE_NOT_EFFECTIVE',
  AMOUNT_REQUIRED: 'AMOUNT_REQUIRED',
  THRESHOLD_NOT_MET: 'THRESHOLD_NOT_MET',
  THRESHOLD_SCOPE_UNKNOWN: 'THRESHOLD_SCOPE_UNKNOWN',
  CAP_PROGRESS_UNKNOWN: 'CAP_PROGRESS_UNKNOWN',
  CAP_PERIOD_UNRESOLVED: 'CAP_PERIOD_UNRESOLVED',
  CAP_REACHED: 'CAP_REACHED',
  POST_CAP_RATE_USED: 'POST_CAP_RATE_USED',
  SHARED_CAP: 'SHARED_CAP',
  MERCHANT_CLASSIFICATION_REQUIRED: 'MERCHANT_CLASSIFICATION_REQUIRED',
  RULE_CONDITIONS_NOT_MET: 'RULE_CONDITIONS_NOT_MET',
  RULE_CONDITIONS_UNKNOWN: 'RULE_CONDITIONS_UNKNOWN',
  TEMPORARY_PROMOTION: 'TEMPORARY_PROMOTION',
  CACHE_STALE: 'CACHE_STALE',
  LEGACY_PRODUCT: 'LEGACY_PRODUCT',
  INCOMPARABLE_REWARD_CURRENCIES: 'INCOMPARABLE_REWARD_CURRENCIES',
  LOGGED_PURCHASES_ONLY: 'LOGGED_PURCHASES_ONLY',
  BENEFIT_CONDITIONS_APPLY: 'BENEFIT_CONDITIONS_APPLY',
});

const BENEFIT_TIE_WINDOW_PERCENT = 0.25;

const CATEGORY_PARENTS = Object.freeze({
  'flight ticket': ['travel'],
  hotel: ['travel'],
  'rental car': ['travel'],
  pharmacy: ['drug stores'],
  'drug store': ['drug stores'],
  streaming: ['subscriptions'],
  subscriptions: ['streaming'],
  'food / grocery delivery': ['groceries'],
  'transit / ride share': ['transportation'],
  'costco gas': ['gas'],
  'warehouse purchase': ['other'],
});

const BENEFIT_CONTEXT = Object.freeze({
  electronics: {
    purchase_security: 2,
    purchase_protection: 2,
    extended_warranty: 3,
    mobile_device_insurance: 3,
  },
  'mobile device': {
    purchase_security: 2,
    purchase_protection: 2,
    extended_warranty: 2,
    mobile_device_insurance: 4,
  },
  travel: {
    trip_cancellation: 3,
    trip_interruption: 3,
    flight_delay: 2,
    baggage_delay: 2,
    lost_baggage: 2,
    common_carrier_accident: 1,
    travel_accident: 1,
    travel_medical: 2,
    hotel_motel_burglary: 1,
  },
  'flight ticket': {
    trip_cancellation: 3,
    trip_interruption: 3,
    flight_delay: 3,
    baggage_delay: 3,
    lost_baggage: 3,
    common_carrier_accident: 1,
    travel_accident: 1,
    travel_medical: 2,
  },
  hotel: {
    trip_cancellation: 2,
    trip_interruption: 2,
    travel_medical: 2,
    hotel_motel_burglary: 3,
  },
  'rental car': {
    rental_vehicle_insurance: 4,
    rental_car_insurance: 4,
    auto_rental_collision_loss_damage_waiver: 4,
    trip_interruption: 1,
  },
  other: {
    purchase_security: 2,
    purchase_protection: 2,
    extended_warranty: 2,
  },
});

const ACQUISITION_LIFECYCLES = new Set([
  'WELCOME_BONUS',
  'ACQUISITION_OFFER',
  'SIGNUP_BONUS',
  'PERSONALIZED_OFFER',
  'TARGETED_OFFER',
]);

export function recommendCards({
  cards = [],
  context = {},
  rewardPreference = 'Maximum Overall Value',
  pointValuations = {},
  purchases = [],
  capUsage = null,
  referenceMeta = {},
} = {}) {
  const normalizedContext = normalizeContext(context);
  const candidates = cards
    .map((card) => evaluateCard({
      card,
      context: normalizedContext,
      pointValuations,
      purchases,
      capUsage,
    }))
    .filter(Boolean);

  const eligible = candidates.filter((candidate) => candidate.eligible);
  const rankedCards = stableSort(eligible, (a, b) => compareCandidates(a, b, rewardPreference));

  const amountRequired = normalizedContext.amount == null
    ? amountCouldChangeWinner({ cards, context: normalizedContext, rewardPreference, pointValuations, purchases, capUsage })
    : false;

  if (amountRequired) {
    rankedCards.forEach((candidate) => addUnique(candidate.reasonCodes, REASON_CODES.AMOUNT_REQUIRED));
  }

  const pointCurrenciesWithoutValues = new Set(eligible.filter((c) => c.rewardKind === 'points' && c.estimatedEquivalentPercent == null).map((c) => c.rewardCurrency).filter(Boolean));
  const incomparableWarning = pointCurrenciesWithoutValues.size > 1 ? [WARNING_CODES.INCOMPARABLE_REWARD_CURRENCIES] : [];
  if (incomparableWarning.length) rankedCards.forEach((candidate) => addUnique(candidate.warningCodes, WARNING_CODES.INCOMPARABLE_REWARD_CURRENCIES));

  const allWarnings = unique([
    ...candidates.flatMap((candidate) => candidate.warningCodes),
    ...incomparableWarning,
    ...(referenceMeta.cacheStale ? [WARNING_CODES.CACHE_STALE] : []),
  ]);

  const winner = rankedCards[0] || null;
  if (winner) applyWinnerReasons(winner, rankedCards, rewardPreference);

  return {
    recommended_card_id: winner?.cardProductId || null,
    recommended_card_slug: winner?.cardSlug || null,
    recommended_card_name: winner?.cardName || null,
    ranked_cards: rankedCards,
    ineligible_cards: candidates.filter((candidate) => !candidate.eligible),
    amount_required: amountRequired,
    data_confidence: overallConfidence(rankedCards, allWarnings),
    reason_codes: winner ? winner.reasonCodes : [],
    warning_codes: unique([...(winner?.warningCodes || []), ...allWarnings]),
    rule_ids_used: winner ? winner.ruleIdsUsed : [],
    source_urls: winner ? winner.sourceUrls : [],
    verified_at: winner ? winner.verifiedAt : null,
    reference_cache_fetched_at: referenceMeta.fetchedAt || null,
  };
}

export function requiresPurchaseAmount(args = {}) {
  return recommendCards({ ...args, context: { ...(args.context || {}), amount: null } }).amount_required;
}

function evaluateCard({ card, context, pointValuations, purchases, capUsage }) {
  const status = evaluateProductStatus(card);
  const acceptance = evaluateAcceptance(card, context);
  const warningCodes = [...status.warnings, ...acceptance.warnings];
  const reasonCodes = acceptance.accepted === true ? [REASON_CODES.NETWORK_ACCEPTANCE] : [];

  if (!status.eligible || acceptance.accepted === false) {
    return baseCandidate(card, {
      eligible: false,
      warningCodes: unique(warningCodes),
      reasonCodes: acceptance.accepted === false ? [REASON_CODES.NETWORK_NOT_ACCEPTED] : reasonCodes,
      acceptance: acceptance.status,
      dataConfidence: status.confidence,
    });
  }

  const ruleResolution = resolveRewardRule({ card, context, purchases, capUsage });
  warningCodes.push(...ruleResolution.warnings);
  reasonCodes.push(...ruleResolution.reasons);

  if (!ruleResolution.rule) {
    warningCodes.push(WARNING_CODES.NO_VERIFIED_RULE);
    return baseCandidate(card, {
      eligible: false,
      warningCodes: unique(warningCodes),
      reasonCodes: unique(reasonCodes),
      acceptance: acceptance.status,
      dataConfidence: degradeConfidence(status.confidence, warningCodes),
    });
  }

  const rule = ruleResolution.rule;
  const reward = calculateReward({
    rule,
    effectiveRate: ruleResolution.effectiveRate,
    split: ruleResolution.split,
    amount: context.amount,
    pointValuations,
  });

  if (rule.reward_kind === 'points' && reward.estimatedEquivalentPercent == null) {
    warningCodes.push(WARNING_CODES.POINT_VALUE_UNAVAILABLE);
    reasonCodes.push(REASON_CODES.POINT_VALUE_UNAVAILABLE);
  }

  const benefits = relevantBenefits(card.benefits || [], context.purchaseCategory, context.purchaseDate);
  reasonCodes.push(...benefits.reasonCodes);
  warningCodes.push(...benefits.warningCodes);

  return {
    ...baseCandidate(card),
    eligible: true,
    acceptance: acceptance.status,
    rewardKind: rule.reward_kind,
    rewardCurrency: rule.reward_currency || (rule.reward_kind === 'cashback' ? 'CAD_CASHBACK' : null),
    rewardRate: ruleResolution.effectiveRate,
    advertisedRate: toNumber(rule.rate),
    pointsMultiplier: rule.reward_kind === 'points' ? ruleResolution.effectiveRate : null,
    estimatedRewardUnits: reward.estimatedRewardUnits,
    estimatedRewardValue: reward.estimatedRewardValue,
    estimatedEquivalentPercent: reward.estimatedEquivalentPercent,
    rewardValueSource: reward.rewardValueSource,
    benefitHighlights: benefits.items,
    benefitPriority: benefits.priority,
    reasonCodes: unique(reasonCodes),
    warningCodes: unique(warningCodes),
    dataConfidence: degradeConfidence(status.confidence, warningCodes),
    primaryRule: rule,
    ruleIdsUsed: unique([rule.id, ...(ruleResolution.additionalRuleIds || [])].filter(Boolean)),
    sourceUrls: unique([
      card.sourceUrl,
      rule.source_url,
      ...benefits.items.map((benefit) => benefit.source_url),
    ].filter(Boolean)),
    verifiedAt: latestVerificationDate([
      card.verifiedAt,
      rule.verified_at,
      ...benefits.items.map((benefit) => benefit.verified_at),
    ]),
    cap: ruleResolution.cap,
    amountSensitive: ruleResolution.amountSensitive,
    specificity: ruleResolution.specificity,
    uncertaintyCount: unique(warningCodes).length,
  };
}

function baseCandidate(card, overrides = {}) {
  return {
    cardProductId: card.cardProductId || card.card_product_id || card.uuid || null,
    cardSlug: card.slug || card.id || null,
    cardName: card.name || card.slug || 'Card',
    bankName: card.bank || card.bankName || card.bank?.name || '',
    network: card.network || null,
    productStatus: normalizeUpper(card.productStatus || card.product_status || (card.active === false ? 'INACTIVE' : 'ACTIVE')),
    verificationStatus: normalizeUpper(card.verificationStatus || card.verification_status || card.dataStatus || card.data_status || 'UNCERTAIN'),
    eligible: false,
    acceptance: 'unknown',
    rewardKind: null,
    rewardCurrency: null,
    rewardRate: null,
    advertisedRate: null,
    pointsMultiplier: null,
    estimatedRewardUnits: null,
    estimatedRewardValue: null,
    estimatedEquivalentPercent: null,
    rewardValueSource: null,
    benefitHighlights: [],
    benefitPriority: 0,
    reasonCodes: [],
    warningCodes: [],
    dataConfidence: 'UNCERTAIN',
    primaryRule: null,
    ruleIdsUsed: [],
    sourceUrls: [],
    verifiedAt: card.verifiedAt || card.verified_at || null,
    cap: null,
    amountSensitive: false,
    specificity: 0,
    uncertaintyCount: 0,
    ...overrides,
  };
}

function evaluateProductStatus(card) {
  const productStatus = normalizeUpper(card.productStatus || card.product_status || (card.active === false ? 'INACTIVE' : 'ACTIVE'));
  const verification = normalizeUpper(card.verificationStatus || card.verification_status || card.dataStatus || card.data_status || 'UNCERTAIN');
  const owned = card.isOwned !== false;
  const warnings = [];

  if (!owned) return { eligible: false, confidence: 'UNCERTAIN', warnings: [WARNING_CODES.PRODUCT_NOT_ELIGIBLE] };

  if (['UNCERTAIN', 'DRAFT', 'DEMO'].includes(verification)) {
    return { eligible: false, confidence: 'UNCERTAIN', warnings: [WARNING_CODES.UNCERTAIN_DATA_WARNING] };
  }

  let confidence = verification === 'STALE' ? 'STALE' : 'VERIFIED';
  if (verification === 'STALE') warnings.push(WARNING_CODES.STALE_DATA_WARNING);

  if (['RETIRED', 'LEGACY'].includes(productStatus)) {
    // An already-owned legacy product can still compete when its current earning
    // rules remain verified. Product lifecycle is disclosed as a warning, but it
    // does not downgrade verified financial facts by itself.
    warnings.push(WARNING_CODES.LEGACY_PRODUCT);
    return { eligible: true, confidence, warnings };
  }

  if (productStatus !== 'ACTIVE' || card.active === false) {
    return { eligible: false, confidence: 'UNCERTAIN', warnings: [WARNING_CODES.PRODUCT_NOT_ELIGIBLE] };
  }

  return { eligible: true, confidence, warnings };
}

function evaluateAcceptance(card, context) {
  const excluded = new Set((context.excludedCardSlugs || []).map(normalizeText));
  if (excluded.has(normalizeText(card.slug || card.id))) {
    return { accepted: false, status: 'not_accepted', warnings: [WARNING_CODES.NETWORK_NOT_ACCEPTED] };
  }

  if (!Array.isArray(context.acceptedNetworks) || context.acceptedNetworks.length === 0) {
    return { accepted: null, status: 'unknown', warnings: [WARNING_CODES.ACCEPTANCE_UNKNOWN] };
  }

  const cardFamily = networkFamily(card.network);
  const accepted = context.acceptedNetworks.map(networkFamily).includes(cardFamily);
  return accepted
    ? { accepted: true, status: 'accepted', warnings: [] }
    : { accepted: false, status: 'not_accepted', warnings: [WARNING_CODES.NETWORK_NOT_ACCEPTED] };
}

function resolveRewardRule({ card, context, purchases, capUsage }) {
  const nowDate = dateOnly(context.purchaseDate);
  const allRules = Array.isArray(card.rewardRules) ? card.rewardRules : Array.isArray(card.rules) ? card.rules : [];
  const evaluated = allRules.map((rule) => evaluateRuleApplicability(rule, context, nowDate));

  const warnings = unique(evaluated.flatMap((item) => item.warnings));
  const applicable = evaluated.filter((item) => item.applicable)
    .sort((a, b) => b.specificity - a.specificity || b.modeSpecificity - a.modeSpecificity || compareIds(a.rule.id, b.rule.id));

  for (const match of applicable) {
    const capState = resolveCapState({ card, rule: match.rule, context, purchases, capUsage, allRules });
    const resultWarnings = unique([...warnings, ...capState.warnings]);
    const reasons = [...match.reasons, ...capState.reasons];

    if (capState.exhaustedWithoutPostCap) {
      // Promotion/category rule no longer pays; continue to next lower-precedence rule.
      continue;
    }

    return {
      rule: match.rule,
      effectiveRate: capState.effectiveRate,
      split: capState.split,
      cap: capState.cap,
      amountSensitive: capState.amountSensitive || match.amountSensitive,
      specificity: match.specificity,
      warnings: resultWarnings,
      reasons: unique(reasons),
      additionalRuleIds: [],
    };
  }

  return { rule: null, warnings, reasons: [], amountSensitive: false, specificity: 0 };
}

function evaluateRuleApplicability(rule, context, purchaseDate) {
  const warnings = [];
  const reasons = [];
  const verification = normalizeUpper(rule.verification_status || rule.verificationStatus || rule.data_status || rule.dataStatus || 'UNCERTAIN');
  const lifecycle = normalizeUpper(rule.lifecycle_status || rule.lifecycleStatus || 'PERMANENT');

  if (normalizeText(rule.data_status || rule.dataStatus) !== 'verified') {
    return { rule, applicable: false, specificity: 0, modeSpecificity: 0, warnings: [WARNING_CODES.UNCERTAIN_DATA_WARNING], reasons: [] };
  }
  if (verification === 'UNCERTAIN' || verification === 'DRAFT' || verification === 'DEMO') {
    return { rule, applicable: false, specificity: 0, modeSpecificity: 0, warnings: [WARNING_CODES.UNCERTAIN_DATA_WARNING], reasons: [] };
  }
  if (verification === 'STALE') warnings.push(WARNING_CODES.STALE_DATA_WARNING);
  if (ACQUISITION_LIFECYCLES.has(lifecycle)) {
    return { rule, applicable: false, specificity: 0, modeSpecificity: 0, warnings: [], reasons: [] };
  }

  const effectiveFrom = rule.effective_from ? dateOnly(rule.effective_from) : null;
  const effectiveUntil = rule.effective_until ? dateOnly(rule.effective_until) : null;
  if ((effectiveFrom && purchaseDate < effectiveFrom) || (effectiveUntil && purchaseDate > effectiveUntil)) {
    return { rule, applicable: false, specificity: 0, modeSpecificity: 0, warnings: [WARNING_CODES.RULE_NOT_EFFECTIVE], reasons: [] };
  }
  if (lifecycle === 'TEMPORARY_PROMOTION') warnings.push(WARNING_CODES.TEMPORARY_PROMOTION);

  const mode = normalizePurchaseMode(rule.purchase_mode || rule.purchaseMode);
  if (mode && mode !== 'both' && mode !== context.purchaseMode) {
    return { rule, applicable: false, specificity: 0, modeSpecificity: 0, warnings, reasons: [] };
  }

  const merchantMatch = merchantPatternMatches(rule.merchant_pattern || rule.merchantPattern, context);
  if ((rule.merchant_pattern || rule.merchantPattern) && !merchantMatch) {
    return { rule, applicable: false, specificity: 0, modeSpecificity: 0, warnings, reasons: [] };
  }

  const categoryMatch = categoryMatches(rule.category, context, Boolean(rule.merchant_pattern || rule.merchantPattern));
  if (!categoryMatch.match) {
    return { rule, applicable: false, specificity: 0, modeSpecificity: 0, warnings: [...warnings, ...categoryMatch.warnings], reasons: [] };
  }
  warnings.push(...categoryMatch.warnings);

  const conditions = evaluateEligibilityConditions(rule, context, { merchantMatch, categoryMatch });
  if (conditions.status === 'not_met') {
    return { rule, applicable: false, specificity: 0, modeSpecificity: 0, warnings: [...warnings, WARNING_CODES.RULE_CONDITIONS_NOT_MET], reasons: [] };
  }
  if (conditions.status === 'unknown') {
    // Financial trust rule: do not silently award an accelerated rate whose material
    // issuer conditions cannot be established. Base "Other" rules can still apply.
    const isBase = normalizeText(rule.category) === 'other' && !(rule.merchant_pattern || rule.merchantPattern);
    if (!isBase) {
      return { rule, applicable: false, specificity: 0, modeSpecificity: 0, warnings: [...warnings, ...conditions.warnings, WARNING_CODES.RULE_CONDITIONS_UNKNOWN], reasons: [] };
    }
    warnings.push(...conditions.warnings, WARNING_CODES.RULE_CONDITIONS_UNKNOWN);
  }

  const specificity = ruleSpecificity(rule, categoryMatch, merchantMatch);
  const modeSpecificity = mode ? 1 : 0;
  if (rule.merchant_pattern || rule.merchantPattern) reasons.push(REASON_CODES.MERCHANT_BONUS);
  else if (normalizeText(rule.category) === 'other') reasons.push(REASON_CODES.BASE_REWARD);
  else reasons.push(REASON_CODES.CATEGORY_BONUS);

  let amountSensitive = false;
  if (toNumber(rule.min_spend) != null) amountSensitive = true;
  if (toNumber(rule.spend_cap) != null && toNumber(rule.post_cap_rate) !== toNumber(rule.rate)) amountSensitive = true;

  return {
    rule,
    applicable: true,
    specificity,
    modeSpecificity,
    warnings: unique(warnings),
    reasons: unique(reasons),
    amountSensitive,
  };
}

function evaluateEligibilityConditions(rule, context, { merchantMatch }) {
  const conditions = rule.eligibility_conditions || rule.eligibilityConditions || {};
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) return { status: 'met', warnings: [] };

  let unknown = false;
  const warnings = [];

  for (const [rawKey, value] of Object.entries(conditions)) {
    const key = normalizeText(rawKey);

    if (['scope', 'basis', 'excludes', 'includes', 'stacking', 'do_not_apply_as_universal_base_earn'].includes(key)) continue;

    if (key === 'country') {
      if (!context.country) unknown = true;
      else if (normalizeText(context.country) !== normalizeText(value)) return { status: 'not_met', warnings };
      continue;
    }

    if (key === 'mcc') {
      if (!context.mcc) {
        // An exact normalized reward category can be enough for the dedicated EV charging taxonomy.
        if (!(normalizeText(context.rewardCategory) === 'electric vehicle charging' && String(value) === '5552')) unknown = true;
      } else if (String(context.mcc) !== String(value)) return { status: 'not_met', warnings };
      continue;
    }

    if (key === 'merchant_classification') {
      if (merchantMatch && (rule.merchant_pattern || rule.merchantPattern)) continue;
      if (!context.rewardCategory && !context.merchantClassifications?.length) {
        unknown = true;
        warnings.push(WARNING_CODES.MERCHANT_CLASSIFICATION_REQUIRED);
        continue;
      }
      if (!classificationMatches(value, context)) return { status: 'not_met', warnings };
      continue;
    }

    if (key === 'direct_purchase_required') {
      if (value === true && !(merchantMatch && context.merchantName)) unknown = true;
      continue;
    }

    if (key === 'eligible_select_providers') {
      const provided = context.conditions?.[rawKey] ?? context.conditions?.[key];
      if (value === true && provided !== true) {
        if (provided === false) return { status: 'not_met', warnings };
        unknown = true;
      }
      continue;
    }

    if (key === 'american_express_travel_is_merchant') {
      if (value === true && !merchantMatch) return { status: 'not_met', warnings };
      continue;
    }

    if (key === 'merchant_primary_business') {
      const evidence = [context.rewardCategory, ...(context.merchantClassifications || [])].filter(Boolean).map(normalizeText).join(' ');
      if (!evidence) unknown = true;
      else if (!textSemanticallyContains(evidence, normalizeText(value))) return { status: 'not_met', warnings };
      continue;
    }

    // Account-linking, primary-cardholder, good-standing, fare/payment-plan and similar
    // conditions require explicit context. Never assume them true.
    if (typeof value === 'boolean' && value === true) {
      const provided = context.conditions?.[rawKey] ?? context.conditions?.[key];
      if (provided === true) continue;
      if (provided === false) return { status: 'not_met', warnings };
      unknown = true;
      continue;
    }
  }

  return unknown ? { status: 'unknown', warnings: unique(warnings) } : { status: 'met', warnings: unique(warnings) };
}

function resolveCapState({ card, rule, context, purchases, capUsage, allRules }) {
  const rate = toNumber(rule.rate) ?? 0;
  const cap = toNumber(rule.spend_cap);
  const postCapRate = toNumber(rule.post_cap_rate);
  const minSpend = toNumber(rule.min_spend);
  const warnings = [];
  const reasons = [];

  if (minSpend != null) {
    const thresholdScope = normalizeUpper(rule.eligibility_conditions?.threshold_scope || 'TRANSACTION');
    if (thresholdScope !== 'TRANSACTION') {
      warnings.push(WARNING_CODES.THRESHOLD_SCOPE_UNKNOWN);
      return {
        effectiveRate: findFallbackRate(rule, allRules, context),
        split: null,
        cap: null,
        amountSensitive: false,
        exhaustedWithoutPostCap: false,
        warnings,
        reasons: [REASON_CODES.THRESHOLD_NOT_MET],
      };
    }
    if (context.amount == null) {
      return {
        effectiveRate: rate,
        split: null,
        cap: null,
        amountSensitive: true,
        exhaustedWithoutPostCap: false,
        warnings: [WARNING_CODES.AMOUNT_REQUIRED],
        reasons: [REASON_CODES.AMOUNT_REQUIRED],
      };
    }
    if (context.amount < minSpend) {
      warnings.push(WARNING_CODES.THRESHOLD_NOT_MET);
      reasons.push(REASON_CODES.THRESHOLD_NOT_MET);
      return {
        effectiveRate: findFallbackRate(rule, allRules, context),
        split: null,
        cap: null,
        amountSensitive: false,
        exhaustedWithoutPostCap: false,
        warnings,
        reasons,
      };
    }
  }

  if (cap == null) {
    return { effectiveRate: rate, split: null, cap: null, amountSensitive: false, exhaustedWithoutPostCap: false, warnings, reasons };
  }

  const capGroup = rule.cap_group || rule.capGroup || rule.id;
  if (rule.cap_group || rule.capGroup) {
    warnings.push(WARNING_CODES.SHARED_CAP);
    reasons.push(REASON_CODES.SHARED_CAP);
  }

  const usage = getCapUsage({ card, rule, context, purchases, capUsage, allRules });
  const capInfo = {
    group: capGroup,
    spendCap: cap,
    period: rule.cap_period || rule.capPeriod || null,
    resetRule: rule.cap_reset_rule || rule.capResetRule || null,
    scope: rule.cap_scope || rule.capScope || null,
    usageAmount: usage.amount,
    minimumKnownSpend: usage.minimumKnownSpend,
    authoritative: usage.authoritative,
    source: usage.source,
    periodStart: usage.periodStart || null,
    periodEnd: usage.periodEnd || null,
  };

  warnings.push(...usage.warnings);

  const definitelyReached = usage.minimumKnownSpend != null && usage.minimumKnownSpend >= cap;
  if (definitelyReached || (usage.authoritative && usage.amount >= cap)) {
    warnings.push(WARNING_CODES.CAP_REACHED);
    reasons.push(REASON_CODES.CAP_REACHED);
    if (postCapRate == null) {
      return { effectiveRate: 0, split: null, cap: capInfo, amountSensitive: false, exhaustedWithoutPostCap: true, warnings: unique(warnings), reasons: unique(reasons) };
    }
    warnings.push(WARNING_CODES.POST_CAP_RATE_USED);
    reasons.push(REASON_CODES.POST_CAP_RATE_USED);
    return { effectiveRate: postCapRate, split: null, cap: capInfo, amountSensitive: false, exhaustedWithoutPostCap: false, warnings: unique(warnings), reasons: unique(reasons) };
  }

  if (!usage.authoritative) {
    // Logged purchases prove a minimum, never the full issuer-account spend. Use the
    // conservative post-cap rate where one exists rather than pretending the cap is unused.
    warnings.push(WARNING_CODES.CAP_PROGRESS_UNKNOWN, WARNING_CODES.LOGGED_PURCHASES_ONLY);
    if (postCapRate != null) {
      warnings.push(WARNING_CODES.POST_CAP_RATE_USED);
      reasons.push(REASON_CODES.POST_CAP_RATE_USED);
      return { effectiveRate: postCapRate, split: null, cap: capInfo, amountSensitive: false, exhaustedWithoutPostCap: false, warnings: unique(warnings), reasons: unique(reasons) };
    }
    return { effectiveRate: findFallbackRate(rule, allRules, context), split: null, cap: capInfo, amountSensitive: false, exhaustedWithoutPostCap: true, warnings: unique(warnings), reasons: unique(reasons) };
  }

  const used = usage.amount || 0;
  const remaining = Math.max(0, cap - used);
  if (context.amount == null) {
    return {
      effectiveRate: rate,
      split: null,
      cap: capInfo,
      amountSensitive: postCapRate !== rate,
      exhaustedWithoutPostCap: false,
      warnings: unique(warnings),
      reasons: unique(reasons),
    };
  }

  if (context.amount <= remaining) {
    return { effectiveRate: rate, split: null, cap: capInfo, amountSensitive: false, exhaustedWithoutPostCap: false, warnings: unique(warnings), reasons: unique(reasons) };
  }

  if (postCapRate == null) {
    return {
      effectiveRate: rate,
      split: { preCapAmount: remaining, preCapRate: rate, postCapAmount: context.amount - remaining, postCapRate: 0 },
      cap: capInfo,
      amountSensitive: false,
      exhaustedWithoutPostCap: false,
      warnings: unique([...warnings, WARNING_CODES.CAP_REACHED]),
      reasons: unique([...reasons, REASON_CODES.CAP_REACHED]),
    };
  }

  const blendedRate = context.amount > 0
    ? ((remaining * rate) + ((context.amount - remaining) * postCapRate)) / context.amount
    : postCapRate;

  return {
    effectiveRate: blendedRate,
    split: { preCapAmount: remaining, preCapRate: rate, postCapAmount: context.amount - remaining, postCapRate },
    cap: capInfo,
    amountSensitive: false,
    exhaustedWithoutPostCap: false,
    warnings: unique([...warnings, WARNING_CODES.CAP_REACHED, WARNING_CODES.POST_CAP_RATE_USED]),
    reasons: unique([...reasons, REASON_CODES.CAP_REACHED, REASON_CODES.POST_CAP_RATE_USED]),
  };
}

function getCapUsage({ card, rule, context, purchases, capUsage, allRules }) {
  const key = capUsageKey(card, rule, context.purchaseDate);
  const supplied = capUsage?.[key] || capUsage?.[rule.cap_group] || capUsage?.[rule.id];
  if (supplied) {
    const amount = toNumber(supplied.amount) ?? 0;
    return {
      amount,
      minimumKnownSpend: toNumber(supplied.minimumKnownSpend) ?? amount,
      authoritative: supplied.authoritative === true,
      source: supplied.source || (supplied.authoritative ? 'AUTHORITATIVE' : 'SUPPLIED_NON_AUTHORITATIVE'),
      periodStart: supplied.periodStart || null,
      periodEnd: supplied.periodEnd || null,
      warnings: supplied.authoritative ? [] : [WARNING_CODES.CAP_PROGRESS_UNKNOWN],
    };
  }
  return deriveCapUsageFromPurchases({ card, rule, context, purchases, allRules });
}

export function deriveCapUsageFromPurchases({ card, rule, context = {}, purchases = [], allRules = [] }) {
  const period = resolveCapPeriod(rule, context.purchaseDate || new Date().toISOString());
  if (!period.resolved) {
    return {
      amount: 0,
      minimumKnownSpend: 0,
      authoritative: false,
      source: 'UNRESOLVED_PERIOD',
      periodStart: null,
      periodEnd: null,
      warnings: [WARNING_CODES.CAP_PERIOD_UNRESOLVED, WARNING_CODES.CAP_PROGRESS_UNKNOWN],
    };
  }

  const cardSlug = card.slug || card.id;
  const capGroup = rule.cap_group || rule.id;
  const groupRules = allRules.filter((candidate) => (candidate.cap_group || candidate.id) === capGroup);
  const relevant = purchases.filter((purchase) => {
    if ((purchase.usedCardId || purchase.used_card_slug) !== cardSlug) return false;
    const date = new Date(purchase.date || purchase.purchased_at || 0);
    if (Number.isNaN(date.getTime()) || date < period.start || date > period.end) return false;
    if (normalizeUpper(rule.cap_scope || '') === 'ALL_ACCOUNT_NET_PURCHASES') return true;
    if (normalizeUpper(rule.cap_scope || '') === 'CATEGORY_GROUP_SPEND') {
      return groupRules.some((groupRule) => historicalPurchaseDefinitelyMatches(groupRule, purchase));
    }
    return historicalPurchaseDefinitelyMatches(rule, purchase);
  });

  const minimumKnownSpend = relevant.reduce((sum, purchase) => sum + (toNumber(purchase.amount) || 0), 0);
  return {
    amount: minimumKnownSpend,
    minimumKnownSpend,
    authoritative: false,
    source: 'SWIPEWISE_LOGS_ONLY',
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    warnings: [WARNING_CODES.CAP_PROGRESS_UNKNOWN, WARNING_CODES.LOGGED_PURCHASES_ONLY],
  };
}

function historicalPurchaseDefinitelyMatches(rule, purchase) {
  const historicalContext = normalizeContext({
    merchantName: purchase.merchant || purchase.merchant_name,
    purchaseMode: purchase.mode || purchase.purchase_mode,
    purchaseCategory: purchase.category,
    rewardCategory: purchase.rewardCategory || purchase.reward_category || null,
    purchaseDate: purchase.date || purchase.purchased_at,
    country: purchase.country || 'CA',
  });
  const merchantPattern = rule.merchant_pattern || rule.merchantPattern;
  if (merchantPattern && !merchantPatternMatches(merchantPattern, historicalContext)) return false;
  if (merchantPattern) return categoryMatches(rule.category, historicalContext, true).match;

  // Do not infer network/MCC merchant classification from an old purchase's item category.
  const conditions = rule.eligibility_conditions || {};
  if (conditions.merchant_classification && !historicalContext.rewardCategory) return false;
  return categoryMatches(rule.category, historicalContext, false).match;
}

function resolveCapPeriod(rule, purchaseDate) {
  const date = new Date(purchaseDate);
  if (Number.isNaN(date.getTime())) return { resolved: false };
  const period = normalizeUpper(rule.cap_period || rule.capPeriod || '');

  if (period === 'MONTHLY') {
    return {
      resolved: true,
      start: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0)),
      end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
    };
  }

  if (period === 'CALENDAR_YEAR') {
    return {
      resolved: true,
      start: new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0)),
      end: new Date(Date.UTC(date.getUTCFullYear(), 11, 31, 23, 59, 59, 999)),
    };
  }

  // "ANNUAL" can mean statement-year/cardmember-year and must not be guessed.
  return { resolved: false };
}

function calculateReward({ rule, effectiveRate, split, amount, pointValuations }) {
  const rewardKind = rule.reward_kind;
  const rewardCurrency = rule.reward_currency || (rewardKind === 'cashback' ? 'CAD_CASHBACK' : null);
  const valuation = rewardKind === 'points' ? normalizeValuation(pointValuations?.[rewardCurrency]) : null;

  if (rewardKind === 'cashback') {
    const value = amount == null ? null : rewardFromRate(amount, effectiveRate, split);
    return {
      estimatedRewardUnits: value,
      estimatedRewardValue: value,
      estimatedEquivalentPercent: effectiveRate,
      rewardValueSource: 'ISSUER_VERIFIED_CASHBACK_RATE',
    };
  }

  const units = amount == null ? null : rewardUnitsFromRate(amount, effectiveRate, split);
  if (!valuation) {
    return { estimatedRewardUnits: units, estimatedRewardValue: null, estimatedEquivalentPercent: null, rewardValueSource: null };
  }

  const equivalentPercent = effectiveRate * valuation.centsPerPoint;
  const estimatedValue = units == null ? null : (units * valuation.centsPerPoint) / 100;
  return {
    estimatedRewardUnits: units,
    estimatedRewardValue: estimatedValue,
    estimatedEquivalentPercent: equivalentPercent,
    rewardValueSource: valuation.source || 'SWIPEWISE_ESTIMATED_POINT_VALUATION',
  };
}

function rewardFromRate(amount, rate, split) {
  if (!split) return amount * rate / 100;
  return (split.preCapAmount * split.preCapRate / 100) + (split.postCapAmount * split.postCapRate / 100);
}

function rewardUnitsFromRate(amount, rate, split) {
  if (!split) return amount * rate;
  return (split.preCapAmount * split.preCapRate) + (split.postCapAmount * split.postCapRate);
}

function normalizeValuation(raw) {
  const centsPerPoint = toNumber(raw?.centsPerPoint ?? raw?.cents_per_point);
  if (centsPerPoint == null || centsPerPoint < 0) return null;
  const status = normalizeUpper(raw.status || 'ESTIMATED');
  if (!['ESTIMATED', 'VERIFIED_METHODOLOGY'].includes(status)) return null;
  return { centsPerPoint, source: raw.source || null, asOf: raw.asOf || raw.as_of || null };
}

function compareCandidates(a, b, preference) {
  // 1) Acceptance certainty when both are otherwise usable.
  const acceptanceDiff = acceptanceRank(b.acceptance) - acceptanceRank(a.acceptance);
  if (acceptanceDiff) return acceptanceDiff;

  // 2) Verified-data confidence.
  const confidenceDiff = confidenceRank(b.dataConfidence) - confidenceRank(a.dataConfidence);
  if (confidenceDiff) return confidenceDiff;

  // 3) Explicit reward preference.
  if (preference === 'Cashback') {
    const kindDiff = (b.rewardKind === 'cashback' ? 1 : 0) - (a.rewardKind === 'cashback' ? 1 : 0);
    if (kindDiff) return kindDiff;
    if (a.rewardKind === 'cashback' && b.rewardKind === 'cashback') {
      const valueDiff = compareNullableNumberDesc(a.estimatedEquivalentPercent, b.estimatedEquivalentPercent);
      if (valueDiff) return valueDiff;
    }
  }

  if (preference === 'Travel Points') {
    const kindDiff = (b.rewardKind === 'points' ? 1 : 0) - (a.rewardKind === 'points' ? 1 : 0);
    if (kindDiff) return kindDiff;
    if (a.rewardKind === 'points' && b.rewardKind === 'points') {
      if (a.rewardCurrency === b.rewardCurrency) {
        const rateDiff = (b.rewardRate || 0) - (a.rewardRate || 0);
        if (rateDiff) return rateDiff;
      } else if (a.estimatedEquivalentPercent != null && b.estimatedEquivalentPercent != null) {
        const valueDiff = b.estimatedEquivalentPercent - a.estimatedEquivalentPercent;
        if (valueDiff) return valueDiff;
      } else {
        // Different, unvalued point currencies are not mathematically comparable.
        // Prefer the rule that is more specifically matched to this purchase
        // before using contextual benefits as a deterministic tie-breaker.
        const specificityDiff = (b.specificity || 0) - (a.specificity || 0);
        if (specificityDiff) return specificityDiff;
        const benefitDiff = b.benefitPriority - a.benefitPriority;
        if (benefitDiff) return benefitDiff;
      }
    }
  }

  if (preference === 'Maximum Overall Value') {
    const bothComparable = a.estimatedEquivalentPercent != null && b.estimatedEquivalentPercent != null;
    if (bothComparable) {
      const delta = b.estimatedEquivalentPercent - a.estimatedEquivalentPercent;
      if (Math.abs(delta) > BENEFIT_TIE_WINDOW_PERCENT) return delta;
      const benefitDiff = b.benefitPriority - a.benefitPriority;
      if (benefitDiff) return benefitDiff;
      if (delta) return delta;
    } else if (a.estimatedEquivalentPercent != null || b.estimatedEquivalentPercent != null) {
      // A known monetary estimate outranks an unvalued points currency provisionally.
      return b.estimatedEquivalentPercent != null ? 1 : -1;
    } else if (a.rewardKind === 'points' && b.rewardKind === 'points' && a.rewardCurrency === b.rewardCurrency) {
      const rateDiff = (b.rewardRate || 0) - (a.rewardRate || 0);
      if (rateDiff) return rateDiff;
    } else {
      const benefitDiff = b.benefitPriority - a.benefitPriority;
      if (benefitDiff) return benefitDiff;
    }
  }

  // 4) More specific verified issuer rule beats a fallback when the reward comparison ties.
  const specificityDiff = (b.specificity || 0) - (a.specificity || 0);
  if (specificityDiff) return specificityDiff;

  // 5) Fewer unresolved conditions/warnings.
  const uncertaintyDiff = (a.uncertaintyCount || 0) - (b.uncertaintyCount || 0);
  if (uncertaintyDiff) return uncertaintyDiff;

  // 6) Stable deterministic fallback. Never random.
  return compareIds(a.cardSlug, b.cardSlug);
}

function applyWinnerReasons(winner, rankedCards, preference) {
  if (preference === 'Cashback' && winner.rewardKind === 'cashback') {
    addUnique(winner.reasonCodes, REASON_CODES.CASHBACK_PREFERENCE);
    addUnique(winner.reasonCodes, REASON_CODES.HIGHEST_CASHBACK);
  }
  if (preference === 'Travel Points' && winner.rewardKind === 'points') {
    addUnique(winner.reasonCodes, REASON_CODES.TRAVEL_POINTS_PREFERENCE);
  }
  if (preference === 'Maximum Overall Value') {
    addUnique(winner.reasonCodes, REASON_CODES.MAXIMUM_VALUE);
  }

  if (winner.rewardKind === 'points' && winner.estimatedEquivalentPercent != null) {
    addUnique(winner.reasonCodes, REASON_CODES.HIGHEST_ESTIMATED_POINT_VALUE);
  }

  const runnerUp = rankedCards[1];
  if (runnerUp && winner.benefitPriority > runnerUp.benefitPriority
    && winner.estimatedEquivalentPercent != null && runnerUp.estimatedEquivalentPercent != null
    && Math.abs(winner.estimatedEquivalentPercent - runnerUp.estimatedEquivalentPercent) <= BENEFIT_TIE_WINDOW_PERCENT) {
    addUnique(winner.reasonCodes, REASON_CODES.BENEFIT_TIE_BREAK);
  }
}

function relevantBenefits(benefits, purchaseCategory, purchaseDate) {
  const category = normalizeText(purchaseCategory || 'Other');
  const profile = BENEFIT_CONTEXT[category]
    || (['flight ticket', 'hotel', 'rental car'].includes(category) ? BENEFIT_CONTEXT.travel : null)
    || BENEFIT_CONTEXT.other;
  const date = dateOnly(purchaseDate);

  const items = benefits
    .filter((benefit) => benefitIsUsable(benefit, date))
    .map((benefit) => {
      const type = normalizeText(benefit.benefit_type || benefit.benefitType).replaceAll(' ', '_');
      const priority = profile[type] || 0;
      const keyConditions = benefit.key_conditions || benefit.keyConditions || {};
      const conditionsApply = Boolean(keyConditions && typeof keyConditions === 'object' && Object.keys(keyConditions).length);
      return { ...benefit, relevancePriority: priority, conditionsApply };
    })
    .filter((benefit) => benefit.relevancePriority > 0)
    .sort((a, b) => b.relevancePriority - a.relevancePriority || compareIds(a.id, b.id))
    .slice(0, 5);

  const reasonCodes = [];
  items.forEach((benefit) => {
    const type = normalizeText(benefit.benefit_type || benefit.benefitType).replaceAll(' ', '_');
    if (type === 'extended_warranty') reasonCodes.push(REASON_CODES.RELEVANT_EXTENDED_WARRANTY);
    if (['purchase_security', 'purchase_protection'].includes(type)) reasonCodes.push(REASON_CODES.PURCHASE_PROTECTION);
    if (type === 'mobile_device_insurance') reasonCodes.push(REASON_CODES.MOBILE_DEVICE_PROTECTION);
    if (['rental_vehicle_insurance', 'rental_car_insurance', 'auto_rental_collision_loss_damage_waiver'].includes(type)) reasonCodes.push(REASON_CODES.RENTAL_COVERAGE);
    if (['trip_cancellation', 'trip_interruption', 'flight_delay', 'baggage_delay', 'lost_baggage', 'travel_medical', 'travel_accident', 'common_carrier_accident'].includes(type)) reasonCodes.push(REASON_CODES.TRAVEL_PROTECTION);
  });

  const warningCodes = items.some((item) => item.conditionsApply) ? [WARNING_CODES.BENEFIT_CONDITIONS_APPLY] : [];
  return { items, priority: items.reduce((max, item) => Math.max(max, item.relevancePriority), 0), reasonCodes: unique(reasonCodes), warningCodes };
}

function benefitIsUsable(benefit, purchaseDate) {
  const dataStatus = normalizeText(benefit.data_status || benefit.dataStatus);
  const verification = normalizeUpper(benefit.verification_status || benefit.verificationStatus || benefit.data_status || 'UNCERTAIN');
  if (dataStatus !== 'verified' || ['UNCERTAIN', 'DRAFT', 'DEMO'].includes(verification)) return false;
  const from = benefit.effective_from ? dateOnly(benefit.effective_from) : null;
  const until = benefit.effective_until ? dateOnly(benefit.effective_until) : null;
  if (from && purchaseDate < from) return false;
  if (until && purchaseDate > until) return false;
  return true;
}

function categoryMatches(ruleCategory, context, merchantSpecific) {
  const rule = normalizeText(ruleCategory || 'Other');
  if (rule === 'other') return { match: true, exact: false, parent: false, warnings: [] };

  const rewardCategory = normalizeText(context.rewardCategory);
  const purchaseCategory = normalizeText(context.purchaseCategory);
  const target = rewardCategory || (merchantSpecific ? purchaseCategory : '');

  if (!target) {
    return { match: false, exact: false, parent: false, warnings: [WARNING_CODES.MERCHANT_CLASSIFICATION_REQUIRED] };
  }
  if (target === rule) return { match: true, exact: true, parent: false, warnings: [] };
  if ((CATEGORY_PARENTS[target] || []).includes(rule)) return { match: true, exact: false, parent: true, warnings: [] };
  return { match: false, exact: false, parent: false, warnings: [] };
}

function ruleSpecificity(rule, categoryMatch, merchantMatch) {
  const merchantSpecific = Boolean(rule.merchant_pattern || rule.merchantPattern) && merchantMatch;
  const base = normalizeText(rule.category) === 'other' && !merchantSpecific;
  if (merchantSpecific && categoryMatch.exact) return 400;
  if (merchantSpecific) return 350;
  if (categoryMatch.exact) return 300;
  if (categoryMatch.parent) return 250;
  if (base) return 100;
  return 0;
}

function merchantPatternMatches(pattern, context) {
  if (!pattern) return true;
  const p = normalizeText(pattern);
  const merchant = normalizeText(context.merchantName);
  const combined = normalizeText(`${context.merchantName || ''} ${context.purchaseCategory || ''} ${context.rewardCategory || ''}`);
  if (!merchant) return false;
  if (merchant.includes(p) || p.includes(merchant)) return true;
  const tokens = p.split(/\s+/).filter((token) => token.length > 2);
  return tokens.length > 0 && tokens.every((token) => combined.includes(token));
}

function classificationMatches(expected, context) {
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  const evidence = [context.rewardCategory, ...(context.merchantClassifications || [])]
    .filter(Boolean)
    .map(normalizeText);
  if (!evidence.length) return false;

  return expectedValues.some((value) => {
    const expectedText = normalizeText(value);
    if (expectedText.includes('stand-alone') && context.merchantAttributes?.standalone !== true) return false;
    return evidence.some((actual) => textSemanticallyContains(actual, expectedText) || textSemanticallyContains(expectedText, actual));
  });
}

function textSemanticallyContains(haystack, needle) {
  const synonyms = [
    ['groceries', 'grocery', 'supermarket'],
    ['dining / restaurants', 'restaurant', 'eating place', 'fast food', 'coffee shop', 'drinking establishment'],
    ['gas', 'gasoline', 'service station', 'fuel'],
    ['drug stores', 'drug store', 'pharmacy'],
    ['travel', 'airline', 'accommodation', 'car rental', 'travel agency'],
  ];
  if (haystack.includes(needle) || needle.includes(haystack)) return true;
  return synonyms.some((group) => group.some((word) => haystack.includes(word)) && group.some((word) => needle.includes(word)));
}

function amountCouldChangeWinner({ cards, context, rewardPreference, pointValuations, purchases, capUsage }) {
  // Unknown cap progress cannot be fixed by asking only for the transaction amount.
  // We ask only when a verified threshold/cap state is known enough that amount can
  // deterministically change the winner.
  const noAmount = { ...context, amount: null };
  const baselineCandidates = cards.map((card) => evaluateCard({ card, context: noAmount, pointValuations, purchases, capUsage })).filter((c) => c?.eligible);
  if (!baselineCandidates.length) return false;
  const baselineWinner = stableSort(baselineCandidates, (a, b) => compareCandidates(a, b, rewardPreference))[0]?.cardSlug;

  for (const candidate of baselineCandidates) {
    const rule = candidate.primaryRule;
    if (!rule) continue;

    const minSpend = toNumber(rule.min_spend);
    if (minSpend != null) {
      const below = Math.max(0, minSpend - 0.01);
      const above = minSpend;
      if (winnerForAmount(below) !== winnerForAmount(above)) return true;
    }

    const cap = toNumber(rule.spend_cap);
    if (cap != null && candidate.cap?.authoritative === true) {
      const remaining = Math.max(0, cap - (candidate.cap.usageAmount || 0));
      if (remaining > 0) {
        // Compare the current pre-cap regime with the verified post-cap regime.
        // This avoids assuming a transaction size while still proving whether the
        // transaction amount can ever change the winner as it crosses this cap.
        const currentWinner = winnerForAmount(Math.min(Math.max(0.01, remaining), Math.max(0.01, cap)));
        const groupKey = rule.cap_group || rule.id;
        const exhaustedUsage = {
          ...(capUsage || {}),
          [groupKey]: {
            amount: cap,
            minimumKnownSpend: cap,
            authoritative: true,
            source: 'AMOUNT_REQUIREMENT_PROBE',
          },
        };
        const postCapWinner = winnerForAmountWithCapUsage(0.01, exhaustedUsage);
        if (currentWinner !== postCapWinner) return true;
      }
    }
  }
  return false;

  function winnerForAmount(amount) {
    return winnerForAmountWithCapUsage(amount, capUsage);
  }

  function winnerForAmountWithCapUsage(amount, usageOverride) {
    const candidates = cards.map((card) => evaluateCard({ card, context: { ...context, amount }, pointValuations, purchases, capUsage: usageOverride })).filter((c) => c?.eligible);
    return stableSort(candidates, (a, b) => compareCandidates(a, b, rewardPreference))[0]?.cardSlug || baselineWinner;
  }
}

function findFallbackRate(rule, allRules, context) {
  const candidates = allRules
    .filter((candidate) => candidate.id !== rule.id)
    .map((candidate) => evaluateRuleApplicability(candidate, context, dateOnly(context.purchaseDate)))
    .filter((candidate) => candidate.applicable)
    .sort((a, b) => b.specificity - a.specificity || compareIds(a.rule.id, b.rule.id));
  return toNumber(candidates[0]?.rule?.rate) ?? 0;
}

function capUsageKey(card, rule, purchaseDate) {
  return `${card.cardProductId || card.card_product_id || card.slug || card.id}:${rule.cap_group || rule.id}:${dateOnly(purchaseDate)}`;
}

function normalizeContext(context) {
  const amount = context.amount == null || context.amount === '' ? null : toNumber(context.amount);
  return {
    merchantName: context.merchantName || context.merchant || '',
    purchaseMode: normalizePurchaseMode(context.purchaseMode || context.mode) || 'in_store',
    purchaseCategory: context.purchaseCategory || context.category || 'Other',
    rewardCategory: context.rewardCategory || null,
    amount,
    purchaseDate: context.purchaseDate || context.date || new Date().toISOString(),
    country: context.country || 'CA',
    mcc: context.mcc || null,
    acceptedNetworks: context.acceptedNetworks || null,
    excludedCardSlugs: context.excludedCardSlugs || [],
    merchantClassifications: context.merchantClassifications || [],
    merchantAttributes: context.merchantAttributes || {},
    conditions: context.conditions || {},
  };
}

function overallConfidence(rankedCards, warnings) {
  if (!rankedCards.length) return 'INSUFFICIENT_DATA';
  if (warnings.includes(WARNING_CODES.UNCERTAIN_DATA_WARNING)) return 'UNCERTAIN';
  if (warnings.includes(WARNING_CODES.POINT_VALUE_UNAVAILABLE)
    || warnings.includes(WARNING_CODES.CAP_PROGRESS_UNKNOWN)
    || warnings.includes(WARNING_CODES.ACCEPTANCE_UNKNOWN)
    || warnings.includes(WARNING_CODES.MERCHANT_CLASSIFICATION_REQUIRED)
    || warnings.includes(WARNING_CODES.INCOMPARABLE_REWARD_CURRENCIES)) return 'LIMITED';
  if (warnings.includes(WARNING_CODES.STALE_DATA_WARNING) || warnings.includes(WARNING_CODES.CACHE_STALE)) return 'STALE';
  return 'HIGH';
}

function degradeConfidence(base, warnings) {
  // Data confidence describes the verification/lifecycle quality of the financial
  // reference data itself. Context gaps (acceptance, MCC/classification, cap
  // progress, point valuation) are surfaced separately as warning codes and in
  // the top-level recommendation confidence; they must not masquerade as stale
  // or unverified issuer data and distort reward ranking.
  if (warnings.includes(WARNING_CODES.UNCERTAIN_DATA_WARNING)) return 'UNCERTAIN';
  if (warnings.includes(WARNING_CODES.STALE_DATA_WARNING)) return 'STALE';
  return base || 'VERIFIED';
}

function acceptanceRank(status) {
  return status === 'accepted' ? 2 : status === 'unknown' ? 1 : 0;
}

function confidenceRank(status) {
  return ({ VERIFIED: 5, HIGH: 5, LIMITED: 4, STALE: 3, UNCERTAIN: 1, INSUFFICIENT_DATA: 0 })[normalizeUpper(status)] || 0;
}

function compareNullableNumberDesc(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

function networkFamily(network) {
  const value = normalizeText(network);
  if (value.includes('mastercard')) return 'mastercard';
  if (value.includes('american express') || value === 'amex') return 'amex';
  if (value.includes('visa')) return 'visa';
  return value;
}

function normalizePurchaseMode(value) {
  const mode = normalizeText(value).replaceAll(' ', '_');
  if (!mode) return null;
  if (['online'].includes(mode)) return 'online';
  if (['in_store', 'instore', 'in-store'].includes(mode)) return 'in_store';
  if (['both', 'all'].includes(mode)) return 'both';
  return mode;
}

function dateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '1970-01-01';
  return date.toISOString().slice(0, 10);
}

function latestVerificationDate(values) {
  const dates = values.filter(Boolean).map((value) => new Date(value)).filter((date) => !Number.isNaN(date.getTime()));
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString();
}

function toNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeUpper(value) {
  return String(value ?? '').trim().toUpperCase();
}

function compareIds(a, b) {
  return String(a || '').localeCompare(String(b || ''));
}

function stableSort(array, compare) {
  return array.map((value, index) => ({ value, index }))
    .sort((a, b) => compare(a.value, b.value) || a.index - b.index)
    .map((item) => item.value);
}

function addUnique(array, value) {
  if (value && !array.includes(value)) array.push(value);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
