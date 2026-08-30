import { dashboardSnapshot } from '../_generated.js';
import { failure, json, requireDb } from '../_lib.js';

export async function onRequestGet({ env }) {
  try {
    const db = requireDb(env);
    const { results = [] } = await db.prepare('SELECT approval_id, decision, actor, recorded_at FROM decisions ORDER BY recorded_at DESC').all();
    const decisions = Object.fromEntries(results.map((row) => [row.approval_id, row]));
    const dashboard = structuredClone(dashboardSnapshot);
    dashboard.approvals = dashboard.approvals.filter((item) => !decisions[item.id]);
    dashboard.nextApproval = dashboard.approvals[0] || null;
    dashboard.overview.approvals = dashboard.approvals.length;
    dashboard.storage = { mode: 'cloudflare-d1', decisionCount: results.length };
    return json(dashboard);
  } catch (error) { return failure(error); }
}
