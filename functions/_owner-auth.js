function timingSafeEqualText(left = '', right = '') {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function ownerAuthMode(request, env) {
  const accessEmail = request.headers.get('cf-access-authenticated-user-email') || '';
  if (env?.HUB_OWNER_EMAIL && accessEmail && accessEmail.toLowerCase() === String(env.HUB_OWNER_EMAIL).toLowerCase()) return 'cloudflare-access';
  const suppliedKey = request.headers.get('x-ascension-owner-key') || '';
  if (env?.HUB_OWNER_CONTROL_KEY && timingSafeEqualText(suppliedKey, env.HUB_OWNER_CONTROL_KEY)) return 'owner-key';
  return null;
}

export function requireOwner(request, env) {
  const mode = ownerAuthMode(request, env);
  if (mode) return mode;
  if (!env?.HUB_OWNER_EMAIL && !env?.HUB_OWNER_CONTROL_KEY) {
    throw Object.assign(new Error('Owner controls are not configured yet. Add Cloudflare Access owner email or HUB_OWNER_CONTROL_KEY before enabling write controls.'), { status: 503 });
  }
  throw Object.assign(new Error('Owner authorization required'), { status: 401 });
}

export function requireScheduler(request, env) {
  if (!env?.HUB_SCHEDULER_KEY) throw Object.assign(new Error('Scheduler key is not configured'), { status: 503 });
  const header = request.headers.get('authorization') || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!timingSafeEqualText(supplied, env.HUB_SCHEDULER_KEY)) throw Object.assign(new Error('Scheduler authorization required'), { status: 401 });
  return true;
}
