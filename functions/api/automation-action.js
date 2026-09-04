import { failure, json, jsonBody, requireDb } from '../_lib.js';
import { requireOwner } from '../_owner-auth.js';
import { automationById, dispatchAutomation, nextRunAt, recordAutomationAction, upsertSchedule } from '../_automation-control.js';

const ACTIONS = new Set(['run-now', 'schedule', 'pause', 'resume']);

async function currentSchedule(db, id, fallback) {
  const row = await db.prepare('SELECT frequency, paused, managed_by_hub FROM automation_schedules WHERE automation_id=?1').bind(id).first();
  return row || { frequency: fallback, paused: 0, managed_by_hub: 0 };
}

export async function onRequestPost({ request, env }) {
  try {
    const authMode = requireOwner(request, env);
    const input = await jsonBody(request, 32_768);
    if (!ACTIONS.has(input.action)) throw Object.assign(new Error('Unsupported automation action'), { status: 400 });
    const automation = automationById(input.automationId);
    if (!automation) throw Object.assign(new Error('Unknown automation'), { status: 404 });

    if (input.action === 'run-now') {
      if (!env.GITHUB_CONTROL_TOKEN) throw Object.assign(new Error('GitHub control token is not configured yet'), { status: 503 });
      const result = await dispatchAutomation(automation, env.GITHUB_CONTROL_TOKEN, input.inputs || {});
      const db = env.HUB_DB;
      if (db) {
        const now = new Date();
        const schedule = await currentSchedule(db, automation.id, automation.defaultFrequency);
        const next = schedule.managed_by_hub && !schedule.paused ? nextRunAt(schedule.frequency, now) : null;
        await db.prepare('UPDATE automation_schedules SET last_run_at=?2, next_run_at=COALESCE(?3,next_run_at), last_status=?4, updated_at=?2 WHERE automation_id=?1')
          .bind(automation.id, now.toISOString(), next, 'requested').run();
        await recordAutomationAction(db, automation.id, 'run-now', 'requested', result, authMode);
      }
      return json({ ok: true, action: 'run-now', automationId: automation.id, result });
    }

    const db = requireDb(env);
    if (input.action === 'schedule') {
      const result = await upsertSchedule(db, automation, input.frequency, false, true);
      await recordAutomationAction(db, automation.id, 'schedule', 'saved', result, authMode);
      return json({ ok: true, action: 'schedule', ...result });
    }

    const existing = await currentSchedule(db, automation.id, automation.defaultFrequency);
    if (!automation.schedulable) throw Object.assign(new Error('This automation is intentionally manual'), { status: 409 });
    const paused = input.action === 'pause';
    const result = await upsertSchedule(db, automation, existing.frequency || automation.defaultFrequency, paused, true);
    await recordAutomationAction(db, automation.id, input.action, 'saved', result, authMode);
    return json({ ok: true, action: input.action, ...result });
  } catch (error) { return failure(error); }
}
