const OWNER = 'nightowlhoothoot83-create';
const REPO = 'ascension-automation-hub';
const WORKFLOW = 'hub-release-gate.yml';
const STAGES = ['check', 'test', 'preview', 'deploy'];

async function github(path, token, options = {}) {
  if (!token) throw Object.assign(new Error('GitHub control token is not configured'), { status: 503 });
  const response = await fetch(`https://api.github.com${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Ascension-Automation-Hub/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `GitHub API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

export function approvalIdForSha(sha) { return `hub-release:${sha}`; }

export async function currentReleaseSha(env) {
  const token = env?.GITHUB_CONTROL_TOKEN || env?.GITHUB_READ_TOKEN;
  const ref = String(env?.HUB_RELEASE_REF || 'main');
  const result = await github(`/repos/${OWNER}/${REPO}/git/ref/heads/${encodeURIComponent(ref)}`, token);
  return { sha: result.object?.sha, ref };
}

export async function dispatchReleaseStage(env, stage) {
  if (!STAGES.includes(stage)) throw Object.assign(new Error('Unsupported release stage'), { status: 400 });
  const token = env?.GITHUB_CONTROL_TOKEN;
  const ref = String(env?.HUB_RELEASE_REF || 'main');
  await github(`/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, token, {
    method: 'POST',
    body: { ref, inputs: { stage } }
  });
  return { requested: true, stage, ref };
}

export async function latestReleaseRows(db, sha = null) {
  if (!db) throw Object.assign(new Error('Hub database binding is unavailable'), { status: 503 });
  const target = sha || (await db.prepare('SELECT release_sha FROM release_evidence ORDER BY recorded_at DESC LIMIT 1').first())?.release_sha;
  if (!target) return { releaseSha: null, stages: {} };
  const { results = [] } = await db.prepare('SELECT release_sha, stage, status, run_id, run_url, preview_url, screenshot_count, recorded_at, payload_json FROM release_evidence WHERE release_sha=?1 ORDER BY recorded_at ASC').bind(target).all();
  const stages = Object.fromEntries(results.map((row) => [row.stage, {
    stage: row.stage,
    status: row.status,
    runId: row.run_id,
    runUrl: row.run_url,
    previewUrl: row.preview_url,
    screenshotCount: Number(row.screenshot_count || 0),
    recordedAt: row.recorded_at,
    payload: (() => { try { return JSON.parse(row.payload_json || '{}'); } catch { return {}; } })()
  }]));
  return { releaseSha: target, stages };
}

export async function releaseState(env) {
  const db = env?.HUB_DB;
  if (!db) throw Object.assign(new Error('Hub database binding is unavailable'), { status: 503 });
  let current = null;
  try { current = await currentReleaseSha(env); } catch (error) { current = { sha: null, ref: String(env?.HUB_RELEASE_REF || 'main'), warning: error.message }; }
  const evidence = await latestReleaseRows(db, current.sha || null);
  const sha = current.sha || evidence.releaseSha;
  const approvalId = sha ? approvalIdForSha(sha) : null;
  const decision = approvalId ? await db.prepare('SELECT decision, actor, recorded_at FROM decisions WHERE approval_id=?1').bind(approvalId).first() : null;
  const stages = evidence.releaseSha === sha ? evidence.stages : {};
  const checkPassed = stages.check?.status === 'success';
  const testPassed = stages.test?.status === 'success';
  const previewPassed = stages.preview?.status === 'success';
  const screenshotsReady = Number(stages.preview?.screenshotCount || 0) >= 2;
  const approved = decision?.decision === 'approved';
  return {
    releaseSha: sha,
    shortSha: sha ? sha.slice(0, 7) : null,
    ref: current.ref,
    warning: current.warning || null,
    stages,
    approval: decision ? { id: approvalId, ...decision } : { id: approvalId, decision: null },
    gates: {
      canCheck: Boolean(sha),
      canTest: checkPassed,
      canPreview: checkPassed && testPassed,
      canReview: previewPassed,
      canApprove: previewPassed && screenshotsReady,
      canDeploy: previewPassed && screenshotsReady && approved
    },
    review: {
      previewUrl: stages.preview?.previewUrl || null,
      runUrl: stages.preview?.runUrl || stages.test?.runUrl || stages.check?.runUrl || null,
      screenshotCount: Number(stages.preview?.screenshotCount || 0),
      testsPassed: testPassed,
      checkPassed,
      previewPassed
    },
    generatedAt: new Date().toISOString()
  };
}

export async function upsertReleaseEvidence(db, input) {
  if (!db) throw Object.assign(new Error('Hub database binding is unavailable'), { status: 503 });
  if (!input?.releaseSha || !STAGES.includes(input.stage)) throw Object.assign(new Error('Invalid release evidence'), { status: 400 });
  if (!['requested', 'running', 'success', 'failed', 'cancelled'].includes(input.status)) throw Object.assign(new Error('Invalid release status'), { status: 400 });
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO release_evidence (release_sha, stage, status, run_id, run_url, preview_url, screenshot_count, recorded_at, payload_json)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    ON CONFLICT(release_sha, stage) DO UPDATE SET status=excluded.status, run_id=excluded.run_id, run_url=excluded.run_url, preview_url=COALESCE(excluded.preview_url, release_evidence.preview_url), screenshot_count=MAX(excluded.screenshot_count, release_evidence.screenshot_count), recorded_at=excluded.recorded_at, payload_json=excluded.payload_json`)
    .bind(input.releaseSha, input.stage, input.status, String(input.runId || ''), input.runUrl || null, input.previewUrl || null, Number(input.screenshotCount || 0), now, JSON.stringify(input.payload || {})).run();
  return { recorded: true, releaseSha: input.releaseSha, stage: input.stage, status: input.status, recordedAt: now };
}

export async function recordReleaseApproval(db, sha, actor = 'owner') {
  const stateRows = await latestReleaseRows(db, sha);
  const preview = stateRows.stages.preview;
  if (preview?.status !== 'success') throw Object.assign(new Error('Preview must pass before approval'), { status: 409 });
  if (Number(preview.screenshotCount || 0) < 2) throw Object.assign(new Error('Desktop and mobile screenshots are required before approval'), { status: 409 });
  const approvalId = approvalIdForSha(sha);
  const recordedAt = new Date().toISOString();
  const eventId = crypto.randomUUID();
  await db.batch([
    db.prepare('INSERT INTO decisions (approval_id, decision, actor, recorded_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(approval_id) DO UPDATE SET decision=excluded.decision, actor=excluded.actor, recorded_at=excluded.recorded_at').bind(approvalId, 'approved', actor, recordedAt),
    db.prepare('INSERT INTO history_events (event_id, type, title, approval_id, decision, actor, recorded_at, payload_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)').bind(eventId, 'release-approval', `Owner approved Hub release ${sha.slice(0, 7)}`, approvalId, 'approved', actor, recordedAt, JSON.stringify({ releaseSha: sha, previewUrl: preview.previewUrl, screenshotCount: preview.screenshotCount }))
  ]);
  return { approvalId, decision: 'approved', recordedAt, eventId };
}
