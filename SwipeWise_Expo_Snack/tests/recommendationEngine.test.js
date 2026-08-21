import assert from 'node:assert/strict';
import fs from 'node:fs';
import { recommendCards, WARNING_CODES, REASON_CODES } from '../engine/recommendationEngine.js';

const verified = {
  id: '', data_status: 'verified', verification_status: 'VERIFIED', lifecycle_status: 'PERMANENT',
  effective_from: null, effective_until: null, purchase_mode: null, merchant_pattern: null,
  min_spend: null, spend_cap: null, post_cap_rate: null, cap_group: null, cap_period: null,
  cap_reset_rule: null, cap_scope: null, eligibility_conditions: {}, source_url: 'https://issuer.example/rule',
  verified_at: '2026-08-17T00:00:00Z',
};
const rule = (id, category, reward_kind, rate, reward_currency, extra={}) => ({...verified,id,category,reward_kind,rate,reward_currency,...extra});
const benefit = (id,type,extra={}) => ({id,benefit_type:type,details:type.replaceAll('_',' '),data_status:'verified',verification_status:'VERIFIED',verified_at:'2026-08-17T00:00:00Z',source_url:'https://issuer.example/benefit',...extra});
const card = (slug,name,network,rules,benefits=[]) => ({id:slug,slug,cardProductId:`uuid-${slug}`,name,bank:name.split(' ')[0],network,active:true,dataStatus:'verified',productStatus:'ACTIVE',verificationStatus:'VERIFIED',verifiedAt:'2026-08-17T00:00:00Z',sourceUrl:'https://issuer.example/card',rewardRules:rules,benefits,isOwned:true});

const costco = card('cibc-costco','CIBC Costco Mastercard','Mastercard',[
  rule('costco-dining','Dining / Restaurants','cashback',3,'CAD_CASHBACK'),
  rule('costco-gas','Gas','cashback',3,'CAD_CASHBACK',{merchant_pattern:'Costco Gas',purchase_mode:'in_store',spend_cap:5000,post_cap_rate:1,cap_group:'cibc_costco_gas_ev_calendar_year',cap_period:'CALENDAR_YEAR',cap_scope:'CATEGORY_GROUP_SPEND',eligibility_conditions:{country:'CA',merchant_classification:'Costco gas station'}}),
  rule('costco-generic-gas','Gas','cashback',2,'CAD_CASHBACK',{spend_cap:5000,post_cap_rate:1,cap_group:'cibc_costco_gas_ev_calendar_year',cap_period:'CALENDAR_YEAR',cap_scope:'CATEGORY_GROUP_SPEND',eligibility_conditions:{merchant_classification:'gas merchant'}}),
  rule('costco-ca','Shopping','cashback',2,'CAD_CASHBACK',{merchant_pattern:'Costco.ca',purchase_mode:'online',spend_cap:8000,post_cap_rate:1,cap_group:'cibc_costco_ca_calendar_year',cap_period:'CALENDAR_YEAR',cap_scope:'CATEGORY_GROUP_SPEND',eligibility_conditions:{merchant_classification:'Costco.ca'}}),
  rule('costco-base','Other','cashback',1,'CAD_CASHBACK',{eligibility_conditions:{scope:'all other qualifying purchases, including Costco warehouse purchases'}}),
],[benefit('costco-pp','purchase_security'),benefit('costco-ew','extended_warranty'),benefit('costco-mobile','mobile_device_insurance')]);

const aventuraVisa = card('cibc-aventura-visa','CIBC Aventura Visa Card','Visa',[
  rule('av-visa-base','Other','points',0.5,'AVENTURA_POINTS'),
  rule('av-visa-grocery','Groceries','points',1,'AVENTURA_POINTS',{spend_cap:6000,post_cap_rate:0.5,cap_group:'cibc_aventura_visa_accelerated',cap_period:'ANNUAL',cap_scope:'CATEGORY_GROUP_SPEND',eligibility_conditions:{merchant_classification:'credit-card-network grocery store'}}),
]);
const aventuraGold = card('cibc-aventura-gold-visa','CIBC Aventura Gold Visa Card','Visa',[
  rule('av-gold-base','Other','points',1,'AVENTURA_POINTS'),
  rule('av-gold-grocery','Groceries','points',1.5,'AVENTURA_POINTS',{spend_cap:80000,post_cap_rate:1,cap_group:'cibc-aventura-gold-visa_accelerated_all_account_spend',cap_period:'ANNUAL',cap_scope:'ALL_ACCOUNT_NET_PURCHASES',eligibility_conditions:{merchant_classification:'credit-card-network grocery store'}}),
]);
const aventuraInfinite = card('cibc-aventura-visa-infinite','CIBC Aventura Visa Infinite Card','Visa Infinite',[
  rule('av-inf-base','Other','points',1,'AVENTURA_POINTS'),
  rule('av-inf-grocery','Groceries','points',1.5,'AVENTURA_POINTS',{spend_cap:80000,post_cap_rate:1,cap_group:'cibc-aventura-visa-infinite_accelerated_all_account_spend',cap_period:'ANNUAL',cap_scope:'ALL_ACCOUNT_NET_PURCHASES',eligibility_conditions:{merchant_classification:'credit-card-network grocery store'}}),
],[benefit('av-inf-rental','rental_vehicle_insurance')]);
const aventuraPrivilege = card('cibc-aventura-visa-infinite-privilege','CIBC Aventura Visa Infinite Privilege Card','Visa Infinite Privilege',[
  rule('av-vip-base','Other','points',1.25,'AVENTURA_POINTS'),
  rule('av-vip-grocery','Groceries','points',2,'AVENTURA_POINTS',{spend_cap:200000,post_cap_rate:1.25,cap_group:'cibc_aventura_infinite_privilege_accelerated_all_account_spend',cap_period:'ANNUAL',cap_scope:'ALL_ACCOUNT_NET_PURCHASES',eligibility_conditions:{merchant_classification:'Visa grocery store or supermarket'}}),
  rule('av-vip-dining','Dining / Restaurants','points',2,'AVENTURA_POINTS',{spend_cap:200000,post_cap_rate:1.25,cap_group:'cibc_aventura_infinite_privilege_accelerated_all_account_spend',cap_period:'ANNUAL',cap_scope:'ALL_ACCOUNT_NET_PURCHASES',eligibility_conditions:{merchant_classification:'Visa eating place, restaurant, drinking place or fast food restaurant'}}),
]);
const td = card('td-aeroplan','TD Aeroplan Visa Infinite Card','Visa Infinite',[
  rule('td-base','Other','points',1,'AEROPLAN_POINTS'),
  rule('td-gas','Gas','points',1.5,'AEROPLAN_POINTS',{spend_cap:80000,post_cap_rate:1,cap_group:'td_aeroplan_accelerated',cap_period:'ANNUAL',cap_scope:'CATEGORY_GROUP_SPEND',eligibility_conditions:{merchant_classification:'eligible gas'}}),
  rule('td-grocery','Groceries','points',1.5,'AEROPLAN_POINTS',{spend_cap:80000,post_cap_rate:1,cap_group:'td_aeroplan_accelerated',cap_period:'ANNUAL',cap_scope:'CATEGORY_GROUP_SPEND',eligibility_conditions:{merchant_classification:'eligible grocery'}}),
  rule('td-aircanada','Travel','points',1.5,'AEROPLAN_POINTS',{merchant_pattern:'Air Canada',spend_cap:80000,post_cap_rate:1,cap_group:'td_aeroplan_accelerated',cap_period:'ANNUAL',cap_scope:'CATEGORY_GROUP_SPEND',eligibility_conditions:{direct_purchase_required:true}}),
]);
const rbc = card('rbc-avion','RBC Avion Visa Infinite','Visa Infinite',[
  rule('rbc-travel','Travel','points',1.25,'AVION_POINTS',{eligibility_conditions:{merchant_classification:'Visa travel-related merchant category'}}),
  rule('rbc-base','Other','points',1,'AVION_POINTS'),
],[benefit('rbc-rental','rental_vehicle_insurance'),benefit('rbc-trip','trip_cancellation')]);
const cobalt = card('amex-cobalt','American Express Cobalt Card','American Express',[
  rule('amex-dining','Dining / Restaurants','points',5,'MEMBERSHIP_REWARDS_POINTS',{spend_cap:2500,post_cap_rate:1,cap_group:'amex_cobalt_5x_monthly',cap_period:'MONTHLY',cap_scope:'CATEGORY_GROUP_SPEND',eligibility_conditions:{country:'CA',merchant_classification:['restaurant','quick service restaurant','coffee shop','drinking establishment']}}),
  rule('amex-grocery','Groceries','points',5,'MEMBERSHIP_REWARDS_POINTS',{spend_cap:2500,post_cap_rate:1,cap_group:'amex_cobalt_5x_monthly',cap_period:'MONTHLY',cap_scope:'CATEGORY_GROUP_SPEND',eligibility_conditions:{country:'CA',merchant_classification:'stand-alone grocery store'}}),
  rule('amex-streaming','Streaming','points',3,'MEMBERSHIP_REWARDS_POINTS',{purchase_mode:'online',eligibility_conditions:{country:'CA',eligible_select_providers:true}}),
  rule('amex-gas','Gas','points',2,'MEMBERSHIP_REWARDS_POINTS',{eligibility_conditions:{country:'CA',merchant_classification:'stand-alone automobile gasoline station'}}),
  rule('amex-base','Other','points',1,'MEMBERSHIP_REWARDS_POINTS'),
],[benefit('amex-mobile','mobile_device_insurance'),benefit('amex-pp','purchase_security'),benefit('amex-trip','travel_accident')]);

const initial = [costco, aventuraVisa, aventuraGold, aventuraInfinite, aventuraPrivilege, td, rbc, cobalt];
const baseContext = {merchantName:'Example Merchant',purchaseMode:'in_store',purchaseCategory:'Other',rewardCategory:null,amount:100,purchaseDate:'2026-08-17T12:00:00Z',country:'CA',acceptedNetworks:['Visa','Mastercard','American Express']};
const valuations = {MEMBERSHIP_REWARDS_POINTS:{centsPerPoint:1,status:'ESTIMATED',source:'TEST_ONLY'},AEROPLAN_POINTS:{centsPerPoint:1,status:'ESTIMATED',source:'TEST_ONLY'},AVENTURA_POINTS:{centsPerPoint:1,status:'ESTIMATED',source:'TEST_ONLY'},AVION_POINTS:{centsPerPoint:1,status:'ESTIMATED',source:'TEST_ONLY'}};

let scenarioCount=0;

function run(name,{cards=initial,context={},preference='Maximum Overall Value',pointValuations={},capUsage=null,mutate=null,expectedWinner,expectedOrderPrefix=[],expectedWarning=null,expectedReason=null,amountRequired=false}){
  scenarioCount += 1;
  let cs=cards.map(c=>structuredClone(c));
  if(mutate) cs=mutate(cs);
  const result=recommendCards({cards:cs,context:{...baseContext,...context},rewardPreference:preference,pointValuations,purchases:[],capUsage});
  assert.equal(result.recommended_card_slug,expectedWinner,`${name}: winner`);
  assert.equal(result.amount_required,amountRequired,`${name}: amount_required`);
  if(expectedOrderPrefix.length) assert.deepEqual(result.ranked_cards.slice(0,expectedOrderPrefix.length).map(x=>x.cardSlug),expectedOrderPrefix,`${name}: order`);
  if(expectedWarning) assert.ok(result.warning_codes.includes(expectedWarning),`${name}: warning ${expectedWarning}`);
  if(expectedReason) assert.ok(result.reason_codes.includes(expectedReason),`${name}: reason ${expectedReason}`);
  caseReports.push({
    name,
    input: {
      owned_cards: cards.map((card) => card.slug),
      context: {...baseContext, ...context},
      reward_preference: preference,
      point_valuations_present: Object.keys(pointValuations || {}),
      cap_usage: capUsage,
    },
    expected: {
      winner: expectedWinner,
      alternative_order_prefix: expectedOrderPrefix,
      required_warning: expectedWarning,
      required_reason: expectedReason,
      amount_required: amountRequired,
    },
    actual: {
      winner: result.recommended_card_slug,
      ranked_order: result.ranked_cards.map((item) => item.cardSlug),
      rules_used: result.rule_ids_used,
      reason_codes: result.reason_codes,
      warning_codes: result.warning_codes,
      amount_required: result.amount_required,
      data_confidence: result.data_confidence,
    },
    passed: true,
  });
  return result;
}

const results=[];
const caseReports=[];
results.push(run('1 Costco warehouse',{cards:[costco,td],context:{merchantName:'Costco',purchaseCategory:'Warehouse Purchase',acceptedNetworks:['Mastercard']},preference:'Cashback',expectedWinner:'cibc-costco',expectedOrderPrefix:['cibc-costco'],expectedReason:REASON_CODES.BASE_REWARD}));
results.push(run('2 Costco gas',{cards:[costco,td],context:{merchantName:'Costco',purchaseCategory:'Costco Gas',acceptedNetworks:['Mastercard'],amount:50},preference:'Cashback',capUsage:{cibc_costco_gas_ev_calendar_year:{amount:1000,authoritative:true}},expectedWinner:'cibc-costco',expectedReason:REASON_CODES.MERCHANT_BONUS}));
results.push(run('3 generic grocery',{cards:[aventuraVisa,aventuraGold,aventuraInfinite,aventuraPrivilege],context:{rewardCategory:'Groceries',purchaseCategory:'Groceries',merchantClassifications:['grocery store'],merchantAttributes:{standalone:true}},preference:'Travel Points',capUsage:{cibc_aventura_visa_accelerated:{amount:0,authoritative:true},'cibc-aventura-gold-visa_accelerated_all_account_spend':{amount:0,authoritative:true},'cibc-aventura-visa-infinite_accelerated_all_account_spend':{amount:0,authoritative:true},cibc_aventura_infinite_privilege_accelerated_all_account_spend:{amount:0,authoritative:true}},expectedWinner:'cibc-aventura-visa-infinite-privilege'}));
results.push(run('4 restaurant dining',{cards:[costco,cobalt],context:{rewardCategory:'Dining / Restaurants',purchaseCategory:'Dining / Restaurants',merchantClassifications:['restaurant']},preference:'Maximum Overall Value',pointValuations:valuations,capUsage:{amex_cobalt_5x_monthly:{amount:0,authoritative:true}},expectedWinner:'amex-cobalt',expectedReason:REASON_CODES.MAXIMUM_VALUE}));
results.push(run('5 generic gas',{cards:[costco,td,cobalt],context:{rewardCategory:'Gas',purchaseCategory:'Gas',merchantClassifications:['gas station'],merchantAttributes:{standalone:true}},preference:'Cashback',capUsage:{cibc_costco_gas_ev_calendar_year:{amount:0,authoritative:true},td_aeroplan_accelerated:{amount:0,authoritative:true}},expectedWinner:'cibc-costco'}));
results.push(run('6 electronics',{cards:[costco,cobalt],context:{purchaseCategory:'Electronics',rewardCategory:null},preference:'Maximum Overall Value',expectedWinner:'cibc-costco',expectedReason:REASON_CODES.MAXIMUM_VALUE}));
results.push(run('7 Air Canada flight',{cards:[td,rbc],context:{merchantName:'Air Canada',purchaseCategory:'Flight Ticket',acceptedNetworks:['Visa'],amount:600},preference:'Travel Points',capUsage:{td_aeroplan_accelerated:{amount:0,authoritative:true}},expectedWinner:'td-aeroplan',expectedReason:REASON_CODES.MERCHANT_BONUS}));
results.push(run('8 rental car',{cards:[rbc,aventuraInfinite],context:{merchantName:'Rental Company',purchaseCategory:'Rental Car',rewardCategory:'Travel',merchantClassifications:['car rental']},preference:'Travel Points',expectedWinner:'rbc-avion',expectedReason:REASON_CODES.RENTAL_COVERAGE}));
results.push(run('9 online streaming',{cards:[cobalt,costco],context:{merchantName:'Eligible Streamer',purchaseMode:'online',purchaseCategory:'Streaming',rewardCategory:'Streaming',conditions:{eligible_select_providers:true}},preference:'Travel Points',expectedWinner:'amex-cobalt'}));
results.push(run('10 in-store blocks online rule',{cards:[cobalt,costco],context:{merchantName:'Eligible Streamer',purchaseMode:'in_store',purchaseCategory:'Streaming',rewardCategory:'Streaming',conditions:{eligible_select_providers:true}},preference:'Cashback',expectedWinner:'cibc-costco'}));
results.push(run('11 purchase no amount',{cards:[costco],context:{amount:null,purchaseCategory:'Other'},preference:'Cashback',expectedWinner:'cibc-costco',amountRequired:false}));
results.push(run('12 amount-dependent winner',{cards:[costco,cobalt],context:{amount:null,purchaseCategory:'Dining / Restaurants',rewardCategory:'Dining / Restaurants',merchantClassifications:['restaurant']},preference:'Maximum Overall Value',pointValuations:valuations,capUsage:{amex_cobalt_5x_monthly:{amount:2450,authoritative:true}},expectedWinner:'amex-cobalt',amountRequired:true}));

const thresholdRule=rule('test-threshold','Other','cashback',4,'CAD_CASHBACK',{min_spend:100});
const thresholdCard=card('cibc-aventura-visa','CIBC Aventura Visa Card','Visa',[thresholdRule,rule('threshold-base','Other','cashback',0.5,'CAD_CASHBACK')]);
results.push(run('13 threshold boundary below',{cards:[thresholdCard,costco],context:{amount:99.99},preference:'Cashback',expectedWinner:'cibc-costco',expectedReason:REASON_CODES.BASE_REWARD}));
results.push(run('14 threshold boundary met',{cards:[thresholdCard,costco],context:{amount:100},preference:'Cashback',expectedWinner:'cibc-aventura-visa'}));
results.push(run('15 cap before limit',{cards:[cobalt,costco],context:{purchaseCategory:'Dining / Restaurants',rewardCategory:'Dining / Restaurants',merchantClassifications:['restaurant'],amount:100},preference:'Maximum Overall Value',pointValuations:valuations,capUsage:{amex_cobalt_5x_monthly:{amount:2000,authoritative:true}},expectedWinner:'amex-cobalt'}));
const boundary=run('16 exact cap boundary',{cards:[cobalt],context:{purchaseCategory:'Dining / Restaurants',rewardCategory:'Dining / Restaurants',merchantClassifications:['restaurant'],amount:1},preference:'Travel Points',capUsage:{amex_cobalt_5x_monthly:{amount:2499,authoritative:true}},expectedWinner:'amex-cobalt'}); assert.equal(boundary.ranked_cards[0].rewardRate,5);
const exceeded=run('17 cap exceeded',{cards:[cobalt],context:{purchaseCategory:'Dining / Restaurants',rewardCategory:'Dining / Restaurants',merchantClassifications:['restaurant'],amount:10},preference:'Travel Points',capUsage:{amex_cobalt_5x_monthly:{amount:2500,authoritative:true}},expectedWinner:'amex-cobalt',expectedWarning:WARNING_CODES.CAP_REACHED}); assert.equal(exceeded.ranked_cards[0].rewardRate,1);
const split=run('18 post-cap earning split',{cards:[cobalt],context:{purchaseCategory:'Dining / Restaurants',rewardCategory:'Dining / Restaurants',merchantClassifications:['restaurant'],amount:20},preference:'Travel Points',capUsage:{amex_cobalt_5x_monthly:{amount:2490,authoritative:true}},expectedWinner:'amex-cobalt',expectedWarning:WARNING_CODES.POST_CAP_RATE_USED}); assert.equal(split.ranked_cards[0].estimatedRewardUnits,60);
results.push(run('19 shared cap group',{cards:[cobalt],context:{purchaseCategory:'Groceries',rewardCategory:'Groceries',merchantClassifications:['grocery'],merchantAttributes:{standalone:true},amount:10},preference:'Travel Points',capUsage:{amex_cobalt_5x_monthly:{amount:2495,authoritative:true}},expectedWinner:'amex-cobalt',expectedWarning:WARNING_CODES.SHARED_CAP}));
results.push(run('20 unsupported network',{cards:[costco,cobalt,td],context:{acceptedNetworks:['Mastercard']},preference:'Maximum Overall Value',expectedWinner:'cibc-costco',expectedOrderPrefix:['cibc-costco']}));
results.push(run('21 stale data',{cards:[costco,td],mutate:(cs)=>{cs[0].verificationStatus='STALE';return cs;},preference:'Cashback',expectedWinner:'td-aeroplan',expectedWarning:WARNING_CODES.STALE_DATA_WARNING}));
results.push(run('22 uncertain data excluded',{cards:[costco,td],mutate:(cs)=>{cs[0].verificationStatus='UNCERTAIN';return cs;},preference:'Cashback',expectedWinner:'td-aeroplan',expectedWarning:WARNING_CODES.UNCERTAIN_DATA_WARNING}));
results.push(run('23 expired rule',{cards:[costco,td],mutate:(cs)=>{cs[0].rewardRules[4].effective_until='2026-01-01';return cs;},context:{purchaseCategory:'Other'},preference:'Cashback',expectedWinner:'td-aeroplan',expectedWarning:WARNING_CODES.RULE_NOT_EFFECTIVE}));
results.push(run('24 future rule',{cards:[costco,td],mutate:(cs)=>{cs[0].rewardRules[4].effective_from='2027-01-01';return cs;},context:{purchaseCategory:'Other'},preference:'Cashback',expectedWinner:'td-aeroplan',expectedWarning:WARNING_CODES.RULE_NOT_EFFECTIVE}));
results.push(run('25 point valuation unavailable',{cards:[td,rbc],context:{purchaseCategory:'Other'},preference:'Maximum Overall Value',expectedWinner:'rbc-avion',expectedWarning:WARNING_CODES.POINT_VALUE_UNAVAILABLE}));
results.push(run('26 tied cards',{cards:[aventuraGold,aventuraInfinite],context:{purchaseCategory:'Other'},preference:'Travel Points',expectedWinner:'cibc-aventura-gold-visa',expectedOrderPrefix:['cibc-aventura-gold-visa','cibc-aventura-visa-infinite']}));
results.push(run('27 legacy verified owned product',{cards:[aventuraVisa,costco],mutate:(cs)=>{cs[0].productStatus='LEGACY';return cs;},preference:'Travel Points',expectedWinner:'cibc-aventura-visa',expectedWarning:WARNING_CODES.LEGACY_PRODUCT}));
results.push(run('28 unknown cap uses conservative rate',{cards:[cobalt,costco],context:{purchaseCategory:'Dining / Restaurants',rewardCategory:'Dining / Restaurants',merchantClassifications:['restaurant']},preference:'Maximum Overall Value',pointValuations:valuations,expectedWinner:'cibc-costco',expectedWarning:WARNING_CODES.CAP_PROGRESS_UNKNOWN}));

const reportPath = process.env.SWIPEWISE_TEST_REPORT_PATH;
if (reportPath) fs.writeFileSync(reportPath, JSON.stringify({scenario_count: scenarioCount, passed: scenarioCount, failed: 0, generated_at: new Date().toISOString(), cases: caseReports}, null, 2));
console.log(`Recommendation Engine v1: ${scenarioCount} deterministic scenarios passed.`);
