import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { loadSources } from './sources.mjs';
import { loadWorkerReports } from './workers.mjs';
import { appendHistory, readHistory } from './history.mjs';
import { loadEvidenceSnapshots } from './evidence.mjs';

const REPORT_VERSION = '1.0.0';
const indexPath = () => resolve(process.env.HUB_RUN_INDEX_PATH || 'artifacts/hub/runs-v1.json');
const decisionsPath = () => resolve('data/hub/decisions.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function validateReport(report) {
  if (!report || report.schemaVersion !== REPORT_VERSION || !Array.isArray(report.results) || !Array.isArray(report.approvals)) throw new Error('Unsupported Automation 6 report contract');
  return report;
}

function priority(status) { return status === 'failed' ? 0 : status === 'warning' ? 1 : 2; }
function resultTitle(result) { return result.id.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function reviewApproval(item) {
  const evidenceRefs = Array.isArray(item.evidenceRefs) ? item.evidenceRefs.filter(Boolean) : [];
  const knownFailures = Number.isInteger(item.knownFailures) ? item.knownFailures : null;
  const blockers = [];
  if (item.provenance !== 'live') blockers.push(`${item.provenance || 'unknown'} evidence is not current live evidence`);
  if (!item.capturedAt) blockers.push('capture time is missing');
  if (!evidenceRefs.length) blockers.push('no review evidence is attached');
  if (item.evidenceStatus !== 'passed') blockers.push('evidence has not passed');
  if (knownFailures !== 0) blockers.push(knownFailures === null ? 'known-failure count is missing' : `${knownFailures} known failure${knownFailures === 1 ? '' : 's'} remain`);
  return { ...item, evidenceRefs, knownFailures, approvalEligible: blockers.length === 0, approvalBlockers: blockers };
}

export async function loadReport() {
  const index = await readJson(indexPath());
  if (!index?.runs?.length) return null;
  if (index.schemaVersion !== REPORT_VERSION) throw new Error('Unsupported hub run index contract');
  const latest = index.runs.find((run) => run.runId === index.latestRunId) || index.runs[0];
  return validateReport(await readJson(resolve(latest.reportPath)));
}

function demoReport() {
  const now = new Date();
  return {
    schemaVersion: REPORT_VERSION, runId: 'demo-ascension-001', startedAt: new Date(now - 172000).toISOString(), finishedAt: now.toISOString(), status: 'warning',
    summary: { passed: 12, warning: 2, failed: 1, skipped: 1 },
    results: [
      { id: 'raven-sharp-production-health', kind: 'health', status: 'passed', startedAt: now.toISOString(), durationMs: 684, evidence: { httpStatus: 200, contentType: 'text/html' } },
      { id: 'ascension-digital-seo', kind: 'seo', status: 'warning', startedAt: now.toISOString(), durationMs: 391, evidence: { warning: 'Meta description needs attention' } },
      { id: 'lead-engine-regression', kind: 'test', status: 'failed', startedAt: now.toISOString(), durationMs: 4218, evidence: { exitCode: 1, summary: 'Checkout handoff assertion failed' } },
      { id: 'raven-sharp-link-check', kind: 'links', status: 'passed', startedAt: now.toISOString(), durationMs: 1224, evidence: { checked: 28, failed: 0 } },
      { id: 'weekly-screenshot-capture', kind: 'screenshots', status: 'skipped', startedAt: now.toISOString(), durationMs: 0, evidence: { reason: 'Renderer not configured' } }
    ],
    approvals: [{ id: 'deploy-lead-engine-repair', action: 'Approve repaired checkout handoff for production deployment', reason: 'Tests pass on the repair branch; production deployment remains approval-gated.', risk: 'medium', status: 'pending' }]
  };
}

export async function buildDashboard() {
  const realReport = await loadReport();
  const report = realReport || demoReport();
  const { sources, warnings: sourceWarnings } = await loadSources();
  const { reports: workerReports, warnings: workerWarnings } = await loadWorkerReports();
  const { snapshots, warnings: evidenceWarnings } = await loadEvidenceSnapshots();
  const { events: historyEvents, warnings: historyWarnings } = await readHistory();
  const extraWorkers = workerReports.filter((item) => item.workerId !== 'automation-6');
  const decisions = await readJson(decisionsPath(), {});
  const sourceApprovals = (sources.approvals?.items || []).map((item) => ({ ...item, provenance: sources.approvals.mode }));
  const workerApprovals = extraWorkers.flatMap((worker) => worker.report.approvals.map((item) => ({ ...item, priority: 3, provenance: worker.mode, workerId: worker.workerId })));
  const evidenceApprovals = snapshots.flatMap((snapshot)=>snapshot.approvalItems.map((item)=>({...item,priority:4,provenance:'snapshot',sourceRef:snapshot.sourceRef,workerId:snapshot.source})));
  const openApprovals = [...report.approvals.map((item) => ({ ...item, priority: 0, provenance: realReport ? 'live' : 'fixture', workerId:'automation-6' })), ...sourceApprovals, ...workerApprovals, ...evidenceApprovals].filter((item) => !decisions[item.id]).map(reviewApproval).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  const repairs = (sources.repairs?.items || []).map((item) => ({ ...item, provenance: sources.repairs.mode }));
  const work = [
    ...report.results.filter((item) => ['failed', 'warning'].includes(item.status)).map((item) => ({ id: item.id, title: resultTitle(item), status: item.status, detail: item.evidence.summary || item.evidence.warning || 'Review captured test evidence.', rank: priority(item.status), provenance: realReport ? 'live' : 'fixture' })),
    ...extraWorkers.flatMap((worker) => worker.report.results.filter((item) => ['failed','warning'].includes(item.status)).map((item) => ({ id:item.id, title:resultTitle(item), status:item.status, detail:item.evidence.summary || `${worker.label} requires review.`, rank:priority(item.status) + 2, provenance:worker.mode, workerId:worker.workerId }))),
    ...snapshots.flatMap((snapshot)=>snapshot.items.filter((item)=>item.status==='warning').map((item)=>({id:`${snapshot.source}-${item.id}`,title:item.label,status:'warning',detail:`Snapshot evidence: ${item.summary}`,rank:4,provenance:'snapshot',sourceRef:snapshot.sourceRef}))),
    ...repairs.filter((item) => item.status !== 'complete').map((item) => ({ id: item.id, title: item.title, status: item.priority === 'critical' ? 'failed' : 'warning', detail: item.branch ? `Repair is ready on ${item.branch}` : 'Suggested repair needs branch preparation.', rank: item.priority === 'critical' ? 0 : 2, provenance: item.provenance }))
  ].sort((a, b) => a.rank - b.rank);
  const content = (sources.content?.items || []).map((item) => ({ ...item, provenance: sources.content.mode }));
  const assets = (sources.assets?.items || []).map((item) => ({ ...item, provenance: sources.assets.mode }));
  const finance = (sources.finance?.items || []).map((item) => ({ ...item, provenance: sources.finance.mode }));
  const money = (category) => finance.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0);
  const sourceModes = Object.values(sources).map((source) => source.mode);
  return {
    schemaVersion: REPORT_VERSION, generatedAt: new Date().toISOString(), mode: realReport && sourceModes.every((mode) => mode === 'live') && extraWorkers.every((worker) => worker.mode === 'live') && snapshots.length===0 ? 'live' : realReport ? 'mixed' : 'demonstration', source: realReport ? 'automation-6/report-v1 + configured adapters' : 'demonstration report + configured fixture/snapshot adapters', sourceWarnings:[...sourceWarnings,...workerWarnings,...historyWarnings,...evidenceWarnings],
    overview: { status: report.status, ...report.summary, approvals: openApprovals.length, attention: work.length },
    nextApproval: openApprovals[0] || null,
    nextTask: work[0] || null,
    businesses: [{ id: 'ascension-digital', name: 'Ascension Digital', type: 'Portfolio', status: report.status, projects: 3 }, { id: 'raven-sharp', name: 'Raven Sharp', type: 'Website', status: report.results.some((item) => item.id.includes('raven') && item.status === 'failed') ? 'failed' : 'passed', projects: 1 }],
    runs: [{ id: report.runId, automation: 'Automation 6', status: report.status, startedAt: report.startedAt, finishedAt: report.finishedAt, summary: report.summary, provenance:realReport ? 'live' : 'fixture' }, ...extraWorkers.map((worker) => ({ id:worker.report.runId, automation:worker.label, workerId:worker.workerId, status:worker.report.status, startedAt:worker.report.startedAt, finishedAt:worker.report.finishedAt, summary:worker.report.summary, provenance:worker.mode }))],
    activity: [...historyEvents.map((event) => ({ id:event.eventId, title:event.title, kind:event.type, status:event.decision === 'approved' ? 'passed' : 'warning', at:event.recordedAt, durationMs:0, evidence:{ decision:event.decision, approvalId:event.approvalId, actor:event.actor }, provenance:'local' })), ...report.results.map((item) => ({ id: item.id, title: resultTitle(item), kind: item.kind, status: item.status, at: item.startedAt, durationMs: item.durationMs, evidence: item.evidence, provenance:realReport ? 'live' : 'fixture' })), ...extraWorkers.flatMap((worker) => worker.report.results.map((item) => ({ id:item.id, title:resultTitle(item), kind:item.kind, status:item.status, at:item.startedAt, durationMs:item.durationMs, evidence:item.evidence, provenance:worker.mode, workerId:worker.workerId })))].sort((a,b)=>b.at.localeCompare(a.at)),
    approvals: openApprovals,
    decisionHistory: historyEvents.filter((event) => event.type === 'approval-decision'),
    evidenceCoverage:{state:realReport?'live-plus-snapshots':'snapshot-only',canonicalLiveAvailable:Boolean(realReport),snapshots:snapshots.map((snapshot)=>({source:snapshot.source,sourceId:snapshot.sourceId,capturedAt:snapshot.capturedAt,sourceRef:snapshot.sourceRef,mode:snapshot.mode,items:snapshot.items})),snapshotItemCount:snapshots.reduce((count,snapshot)=>count+snapshot.items.length,0)},
    queues: { content, assets, repairs, finance },
    financeSummary: { currency: finance[0]?.currency || 'AUD', income: money('income'), expenses: money('expense'), net: money('income') - money('expense'), needsReconciliation: finance.filter((item) => item.status === 'needs-reconciliation').length, provenance: sources.finance?.mode || 'unconfigured' },
    modules: [{ id: 'projects', label: 'Projects', count: 3, state: 'active' }, { id: 'monitors', label: 'Monitors & tests', count: report.results.length, state: realReport?'live':'fixture' }, { id:'audit-evidence',label:'Audit evidence',count:snapshots.reduce((count,snapshot)=>count+snapshot.items.length,0),state:snapshots.length?'snapshot':'unconfigured' }, { id: 'content', label: 'Content approvals', count: content.filter((item) => item.status === 'awaiting-approval').length, state: sources.content?.mode || 'unconfigured' }, { id: 'assets', label: 'Assets & previews', count: assets.length, state: sources.assets?.mode || 'unconfigured' }, { id: 'repairs', label: 'Branch-ready repairs', count: repairs.filter((item) => item.status === 'branch-ready').length, state: sources.repairs?.mode || 'unconfigured' }, { id: 'finance', label: 'Finance & tax', count: finance.length, state: sources.finance?.mode || 'unconfigured' }]
  };
}

export async function recordDecision(id, decision) {
  if (!id || !['approved', 'deferred', 'changes-requested'].includes(decision)) throw new Error('Invalid approval decision');
  const dashboard = await buildDashboard();
  const approval = dashboard.approvals.find((item) => item.id === id);
  if (!approval) throw new Error('Approval item is not open or does not exist');
  if (decision === 'approved' && !approval.approvalEligible) throw new Error(`Approval blocked: ${approval.approvalBlockers.join('; ')}`);
  const path = decisionsPath();
  const current = await readJson(path, {});
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ ...current, [id]: decision }, null, 2));
  const event = await appendHistory({ type:'approval-decision', title:`Approval ${decision}: ${id}`, approvalId:id, decision, actor:'local-owner', provenance:'local' });
  return { id, decision, recordedAt: event.recordedAt, eventId:event.eventId, note: 'Decision recorded locally; no deployment or production mutation was executed.' };
}
