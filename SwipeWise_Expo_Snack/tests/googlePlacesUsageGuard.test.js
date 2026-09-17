import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20260917090000_google_places_usage_guard.sql'), 'utf8');
const edge = fs.readFileSync(path.join(root, 'supabase/functions/merchant-search/index.ts'), 'utf8');

const checks = [
  ['aggregate usage table exists', /create table if not exists public\.google_places_monthly_usage/i.test(sql)],
  ['atomic consume RPC exists', /create or replace function public\.consume_google_places_request/i.test(sql)],
  ['authenticated clients are revoked', /revoke all on function[\s\S]*authenticated/i.test(sql)],
  ['service_role alone receives RPC execute', /grant execute on function[\s\S]*to service_role/i.test(sql)],
  ['guard uses Pacific monthly boundary', /America\/Los_Angeles/.test(sql)],
  ['default hard cap is 4000', /DEFAULT_MONTHLY_REQUEST_LIMIT\s*=\s*4_000/.test(edge)],
  ['configured cap cannot exceed 4900', /MAX_FREE_TIER_SAFETY_LIMIT\s*=\s*4_900/.test(edge)],
  ['Edge Function consumes allowance before Google request', edge.indexOf('consumeGooglePlacesAllowance(monthlyLimit)') < edge.indexOf('googlePlacesRequest(endpoint, apiKey, googleBody)')],
  ['guard failure does not call Google', /GOOGLE_PLACES_USAGE_GUARD_UNAVAILABLE/.test(edge)],
  ['limit reached has explicit safe fallback error', /GOOGLE_PLACES_SAFETY_LIMIT_REACHED/.test(edge)],
];

let passed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    console.error(`FAIL ${name}`);
    process.exitCode = 1;
  } else {
    passed += 1;
    console.log(`PASS ${passed}. ${name}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`\nGoogle Places usage guard checks: ${passed}/${checks.length} passed`);
