const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RADIUS_METERS = 10_000;
const MAX_RESULTS = 20;
const TOMTOM_BASE = 'https://api.tomtom.com/search/2';

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanResult(result: any) {
  return {
    id: result?.id || null,
    score: finite(result?.score),
    dist: finite(result?.dist),
    position: result?.position ? {
      lat: finite(result.position.lat),
      lon: finite(result.position.lon),
    } : null,
    address: result?.address ? {
      streetNumber: result.address.streetNumber || null,
      streetName: result.address.streetName || null,
      municipality: result.address.municipality || null,
      countrySubdivision: result.address.countrySubdivision || null,
      postalCode: result.address.postalCode || null,
      countryCode: result.address.countryCode || null,
    } : null,
    poi: result?.poi ? {
      name: result.poi.name || null,
      brands: Array.isArray(result.poi.brands)
        ? result.poi.brands.slice(0, 5).map((brand: any) => ({ name: brand?.name || null }))
        : [],
      categorySet: Array.isArray(result.poi.categorySet)
        ? result.poi.categorySet.slice(0, 10).map((item: any) => ({ id: item?.id ?? null }))
        : [],
      classifications: Array.isArray(result.poi.classifications)
        ? result.poi.classifications.slice(0, 10).map((item: any) => ({
            code: item?.code || null,
            names: Array.isArray(item?.names)
              ? item.names.slice(0, 5).map((name: any) => ({ name: name?.name || null, nameLocale: name?.nameLocale || null }))
              : [],
          }))
        : [],
    } : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });

  const apiKey = Deno.env.get('TOMTOM_API_KEY');
  if (!apiKey) return json(503, { ok: false, error: 'Merchant provider is not configured.' });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body.' });
  }

  const action = body?.action;
  const latitude = finite(body?.latitude);
  const longitude = finite(body?.longitude);
  const radius = Math.min(Math.max(Math.round(finite(body?.radius) || 600), 50), MAX_RADIUS_METERS);
  const limit = Math.min(Math.max(Math.round(finite(body?.limit) || 10), 1), MAX_RESULTS);
  const query = String(body?.query || '').trim().slice(0, 120);

  let endpoint: URL;
  if (action === 'nearby') {
    if (latitude == null || longitude == null) return json(400, { ok: false, error: 'Location is required.' });
    endpoint = new URL(`${TOMTOM_BASE}/nearbySearch/.json`);
  } else if (action === 'search') {
    if (!query) return json(400, { ok: false, error: 'Search query is required.' });
    endpoint = new URL(`${TOMTOM_BASE}/poiSearch/${encodeURIComponent(query)}.json`);
  } else {
    return json(400, { ok: false, error: 'Unsupported merchant-search action.' });
  }

  endpoint.searchParams.set('key', apiKey);
  endpoint.searchParams.set('countrySet', 'CA');
  endpoint.searchParams.set('language', 'en-CA');
  endpoint.searchParams.set('limit', String(limit));
  if (latitude != null && longitude != null) {
    endpoint.searchParams.set('lat', String(latitude));
    endpoint.searchParams.set('lon', String(longitude));
    endpoint.searchParams.set('radius', String(radius));
  }

  try {
    const response = await fetch(endpoint.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      // Do not log coordinates, queries, user IDs, wallet data, or provider response bodies.
      console.error(`merchant-search provider error status=${response.status}`);
      return json(response.status === 429 ? 429 : 502, { ok: false, error: response.status === 429 ? 'Merchant provider quota reached.' : 'Merchant provider unavailable.' });
    }

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results.map(cleanResult) : [];
    return json(200, { ok: true, provider: 'tomtom', results });
  } catch {
    console.error('merchant-search provider request failed');
    return json(502, { ok: false, error: 'Merchant provider unavailable.' });
  }
});
