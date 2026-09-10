const DEFAULT_URL = 'https://adg-saas-monitor.ascensiondigitalagency.workers.dev/report.json';
const VERSION = '1.0.0';

function status(value) {
  if (value === 'passed') return 'passed';
  if (value === 'needs_attention') return 'failed';
  return 'warning';
}

export function toReportV1(raw) {
  if (raw?.version !== 4 || !Array.isArray(raw.apps) || !raw.run_at) throw new Error('Unsupported SaaS Monitor contract');
  const finishedAt = new Date(raw.run_at).toISOString();
  const results = raw.apps.map((app) => {
    const findings = (app.issues || []).filter((item) => ['warning', 'critical'].includes(item.severity));
    return {
      id: `saas-${app.id}`,
      kind: 'saas-launch-readiness',
      status: status(app.status),
      startedAt: finishedAt,
      durationMs: Math.max(0, Number(app.homepage?.response_ms || 0)),
      evidence: {
        product: app.name,
        targetUrl: app.url,
        baselinePercent: app.baseline_percent,
        detectorVersion: raw.detector_version || app.detector?.version || null,
        findings: findings.map((item) => ({ severity: item.severity, area: item.area, message: item.message, recommendation: item.recommendation })),
        nextAction: findings[0]?.recommendation || 'No repair required.',
        sourceUrl: DEFAULT_URL
      }
    };
  });
  const summary = { passed: 0, warning: 0, failed: 0, skipped: 0 };
  for (const result of results) summary[result.status] += 1;
  return {
    schemaVersion: VERSION,
    runId: `adg-saas-monitor-${finishedAt.replace(/[:.]/g, '-')}`,
    startedAt: finishedAt,
    finishedAt,
    status: summary.failed ? 'failed' : summary.warning ? 'warning' : 'passed',
    summary,
    results,
    approvals: [],
    reviewPackage: {
      capturedAt: finishedAt,
      evidenceStatus: summary.failed ? 'failed' : summary.warning ? 'warning' : 'passed',
      knownFailures: summary.failed,
      evidenceRefs: [{ label:'Live SaaS Monitor report',url:DEFAULT_URL }],
      provenance: 'live-cloudflare-worker',
      approvalRequested: false
    },
    source: { kind: 'cloudflare-worker', contract: 'adg-saas-monitor/v4', url: DEFAULT_URL }
  };
}

export async function loadSaasReport(fetcher = fetch, url = DEFAULT_URL) {
  const response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': 'Ascension-Management-Hub/1.0' }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`SaaS Monitor returned HTTP ${response.status}`);
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 1_000_000) throw new Error('SaaS Monitor report exceeded 1 MB');
  return toReportV1(JSON.parse(text));
}

export function mergeSaasReport(dashboard, report) {
  const run = { id: report.runId, automation: 'Automation 6 · SaaS Monitor', workerId: 'adg-saas-monitor', status: report.status, startedAt: report.startedAt, finishedAt: report.finishedAt, summary: report.summary, provenance: 'live' };
  dashboard.runs = [run, ...dashboard.runs.filter((item) => item.workerId !== 'adg-saas-monitor')];
  const activity = report.results.map((item) => ({ id: item.id, title: item.evidence.product, kind: item.kind, status: item.status, at: item.startedAt, durationMs: item.durationMs, evidence: item.evidence, provenance: 'live', workerId: 'adg-saas-monitor' }));
  dashboard.activity = [...activity, ...dashboard.activity.filter((item) => item.workerId !== 'adg-saas-monitor')].sort((a, b) => b.at.localeCompare(a.at));
  const repairs = report.results.filter((item) => item.status !== 'passed').map((item) => ({ id: `repair-${item.id}`, title: `${item.evidence.product}: ${item.evidence.findings[0]?.area || 'review finding'}`, status: 'needs-repair', priority: item.status === 'failed' ? 'critical' : 'high', provenance: 'live', branch: null, tests: null, evidence: item.evidence }));
  dashboard.queues.repairs = [...repairs, ...dashboard.queues.repairs.filter((item) => !String(item.id).startsWith('repair-saas-'))];
  dashboard.overview.passed += report.summary.passed;
  dashboard.overview.warning += report.summary.warning;
  dashboard.overview.failed += report.summary.failed;
  dashboard.overview.attention += report.summary.warning + report.summary.failed;
  dashboard.overview.status = report.status === 'failed' ? 'failed' : report.status === 'warning' && dashboard.overview.status === 'passed' ? 'warning' : dashboard.overview.status;
  dashboard.nextTask = repairs[0] ? { id: repairs[0].id, title: repairs[0].title, detail: repairs[0].evidence.nextAction, status: 'warning', provenance: 'live' } : dashboard.nextTask;
  dashboard.source = `${dashboard.source} + live ADG SaaS Monitor report-v1`;
  dashboard.mode = 'mixed';
  return dashboard;
}
