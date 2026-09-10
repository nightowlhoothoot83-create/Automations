import { workerSnapshots } from '../../../_generated.js';
import { json } from '../../../_lib.js';
import { loadSaasReport } from '../../../_saas-monitor.js';

export async function onRequestGet({ params, fetcher = fetch }) {
  if (params.id === 'adg-saas-monitor') {
    try {
      const report = await loadSaasReport(fetcher);
      return json({ state:'available',workerId:'adg-saas-monitor',label:'ADG SaaS Monitor',mode:'live',contract:'automation-6/report-v1',runs:[report] });
    } catch (error) {
      return json({ state:'degraded',workerId:'adg-saas-monitor',mode:'degraded',contract:'automation-6/report-v1',warning:error.message });
    }
  }
  const result = workerSnapshots[params.id];
  return result ? json(result) : json({ error: 'Unknown worker' }, 404);
}
