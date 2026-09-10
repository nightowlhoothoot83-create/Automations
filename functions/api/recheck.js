import { failure, json } from '../_lib.js';

const BASE = 'https://adg-saas-monitor.ascensiondigitalagency.workers.dev';

export async function onRequestPost({ fetcher = fetch }) {
  try {
    const current = await fetcher(`${BASE}/report.json`, { headers:{ Accept:'application/json' }, signal:AbortSignal.timeout(8000) });
    if (!current.ok) throw new Error(`SaaS Monitor returned HTTP ${current.status}`);
    const report = await current.json();
    const target = report.apps?.find((app) => app.status !== 'passed') || report.apps?.[0];
    if (!target?.id) throw new Error('No SaaS target is available to recheck');
    const started = await fetcher(`${BASE}/run?site=${encodeURIComponent(target.id)}`, { redirect:'manual', signal:AbortSignal.timeout(8000) });
    if (![200, 302, 303].includes(started.status)) throw new Error(`SaaS recheck returned HTTP ${started.status}`);
    return json({ status:'started',target:target.id,note:`Live read-only recheck started for ${target.name}. Refresh shortly to view the completed report-v1 evidence.` },202);
  } catch (error) { return failure(error); }
}
