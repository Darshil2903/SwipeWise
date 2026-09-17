const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RADIUS_METERS = 10_000;
const MAX_RESULTS = 20;
const GOOGLE_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const GOOGLE_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
  'places.types',
].join(',');

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

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function humanizeType(value: unknown) {
  return String(value || '')
    .replaceAll('_', ' ')
    .trim();
}

function cleanPlace(place: any, origin: { latitude: number; longitude: number } | null) {
  const lat = finite(place?.location?.latitude);
  const lon = finite(place?.location?.longitude);
  const types = Array.isArray(place?.types) ? place.types.slice(0, 12).filter(Boolean) : [];
  const primaryType = place?.primaryType || types[0] || null;

  return {
    provider: 'google',
    id: place?.id || null,
    score: null,
    dist: origin && lat != null && lon != null
      ? haversineMeters(origin.latitude, origin.longitude, lat, lon)
      : null,
    position: lat != null && lon != null ? { lat, lon } : null,
    address: place?.formattedAddress ? { formattedAddress: place.formattedAddress } : null,
    poi: {
      name: place?.displayName?.text || null,
      brands: [],
      categorySet: primaryType ? [{ id: primaryType }] : [],
      classifications: types.length
        ? [{
            code: primaryType,
            names: types.map((type: string) => ({ name: humanizeType(type), nameLocale: 'en' })),
          }]
        : [],
    },
  };
}

async function googlePlacesRequest(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': GOOGLE_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });

  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
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
  const origin = latitude != null && longitude != null ? { latitude, longitude } : null;

  let endpoint: string;
  let googleBody: Record<string, unknown>;

  if (action === 'nearby') {
    if (!origin) return json(400, { ok: false, error: 'Location is required.' });
    endpoint = GOOGLE_NEARBY_URL;
    googleBody = {
      languageCode: 'en',
      regionCode: 'CA',
      maxResultCount: limit,
      rankPreference: 'DISTANCE',
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius,
        },
      },
    };
  } else if (action === 'search') {
    if (!query) return json(400, { ok: false, error: 'Search query is required.' });
    endpoint = GOOGLE_TEXT_URL;
    googleBody = {
      textQuery: query,
      languageCode: 'en',
      regionCode: 'CA',
      pageSize: limit,
      includePureServiceAreaBusinesses: false,
      ...(origin ? {
        locationBias: {
          circle: {
            center: { latitude, longitude },
            radius,
          },
        },
      } : {}),
    };
  } else {
    return json(400, { ok: false, error: 'Unsupported merchant-search action.' });
  }

  try {
    const response = await googlePlacesRequest(endpoint, apiKey, googleBody);
    if (!response.ok) {
      // Privacy rule: never log coordinates, query text, user IDs, wallet/card data,
      // purchase amounts, or raw provider response bodies.
      console.error(`merchant-search provider error status=${response.status}`);
      if (response.status === 429) {
        return json(429, { ok: false, error: 'Merchant provider quota reached.' });
      }
      if (response.status === 403) {
        return json(502, { ok: false, error: 'Google Places rejected the server credential or API configuration.' });
      }
      return json(502, { ok: false, error: 'Merchant provider unavailable.' });
    }

    const data = await response.json();
    const results = Array.isArray(data?.places)
      ? data.places.map((place: any) => cleanPlace(place, origin)).filter((place: any) => place.id && place.poi?.name)
      : [];

    return json(200, { ok: true, provider: 'google', results });
  } catch {
    console.error('merchant-search provider request failed');
    return json(502, { ok: false, error: 'Merchant provider unavailable.' });
  }
});
