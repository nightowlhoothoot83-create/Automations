import { failure, json, jsonBody, requireDb } from '../_lib.js';
import { requireOwner } from '../_owner-auth.js';
import { currentReleaseSha, dispatchReleaseStage, latestReleaseRows, recordReleaseApproval, releaseState, upsertReleaseEvidence } from '../_release-control.js';

const ACTIONS = new Set(['check', 'test', 'preview', 'approve', 'deploy']);

function requirePassed(stages, stage, message) {
  if (stages[stage]?.status !== 'success') throw Object.assign(new Error(message), { status: 409 });
}

export async function onRequestPost({ request, env }) {
  try {
    const actor = requireOwner(request, env);
    const input = await jsonBody(request, 32_768);
    if (!ACTIONS.has(input.action)) throw Object.assign(new Error('Unsupported release action'), { status: 400 });
    const db = requireDb(env);
    const current = await currentReleaseSha(env);
    if (!current.sha) throw Object.assign(new Error('Could not resolve the current Hub release commit'), { status: 503 });
    const evidence = await latestReleaseRows(db, current.sha);

    if (input.action === 'approve') {
      requirePassed(evidence.stages, 'preview', 'Preview must pass before review approval');
      const approval = await recordReleaseApproval(db, current.sha, actor);
      return json({ ok: true, action: 'approve', releaseSha: current.sha, approval, state: await releaseState(env) });
    }

    if (input.action === 'test') requirePassed(evidence.stages, 'check', 'Run Check successfully before Test');
    if (input.action === 'preview') {
      requirePassed(evidence.stages, 'check', 'Run Check successfully before Preview');
      requirePassed(evidence.stages, 'test', 'Run Test successfully before Preview');
    }
    if (input.action === 'deploy') {
      requirePassed(evidence.stages, 'preview', 'Preview must pass before Deploy');
      if (Number(evidence.stages.preview?.screenshotCount || 0) < 2) throw Object.assign(new Error('Desktop and mobile screenshots are required before Deploy'), { status: 409 });
      const state = await releaseState(env);
      if (!state.gates.canDeploy) throw Object.assign(new Error('Owner approval for this exact preview is required before Deploy'), { status: 409 });
    }

    const dispatched = await dispatchReleaseStage(env, input.action);
    await upsertReleaseEvidence(db, { releaseSha: current.sha, stage: input.action, status: 'requested', payload: { actor, dispatched } });
    return json({ ok: true, action: input.action, releaseSha: current.sha, dispatched, state: await releaseState(env) });
  } catch (error) { return failure(error); }
}
