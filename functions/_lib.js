export const securityHeaders = {
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'content-type': 'application/json; charset=utf-8',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY'
};

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...securityHeaders, ...extraHeaders } });
}

export async function jsonBody(request, maxBytes = 1_048_576) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) throw Object.assign(new Error('Request too large'), { status: 413 });
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw Object.assign(new Error('Request too large'), { status: 413 });
  try { return JSON.parse(text || '{}'); } catch { throw Object.assign(new Error('Invalid JSON request body'), { status: 400 }); }
}

export function failure(error) {
  const status = Number(error?.status) || 500;
  return json({ error: status >= 500 ? 'Internal hub error' : error.message }, status);
}

export function requireDb(env) {
  if (!env?.HUB_DB) throw Object.assign(new Error('Hub database binding is unavailable'), { status: 503 });
  return env.HUB_DB;
}
