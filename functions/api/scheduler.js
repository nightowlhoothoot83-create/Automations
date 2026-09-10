import { failure, json, requireDb } from '../_lib.js';
import { requireScheduler } from '../_owner-auth.js';
import { automationById, dispatchAutomation, nextRunAt, recordAutomationAction } from '../_automation-control.js';

export async function onRequestPost({ request, env }) {
  try {
    requireScheduler(request, env);
    if (!env.GITHUB_CONTROL_TOKEN) throw Object.assign(new Error('GitHub control token is not configured yet'), { status: 503 });
    const db = requireDb(env);
    const now = new Date();
    const due = await db.prepare(`SELECT automation_id, frequency, next_run_at
      FROM automation_schedules
      WHERE managed_by_hub=1 AND paused=0 AND frequency!='manual' AND next_run_at IS NOT NULL AND next_run_at<=?1
      ORDER BY next_run_at ASC LIMIT 12`).bind(now.toISOString()).all();
    const results = [];
    for (const row of due.results || []) {
      const automation = automationById(row.automation_id);
      if (!automation || !automation.safeRun || !automation.schedulable) {
        results.push({ automationId: row.automation_id, status: 'blocked', reason: 'Automation is not eligible for scheduled safe-run dispatch' });
        continue;
      }
      try {
        const dispatched = await dispatchAutomation(automation, env.GITHUB_CONTROL_TOKEN);
        const next = nextRunAt(row.frequency, now);
        await db.prepare('UPDATE automation_schedules SET last_run_at=?2, next_run_at=?3, last_status=?4, updated_at=?2 WHERE automation_id=?1')
          .bind(automation.id, now.toISOString(), next, 'requested').run();
        await recordAutomationAction(db, automation.id, 'scheduled-run', 'requested', dispatched, 'hub-scheduler');
        results.push({ automationId: automation.id, status: 'requested', nextRunAt: next });
      } catch (error) {
        await db.prepare('UPDATE automation_schedules SET last_status=?2, updated_at=?3 WHERE automation_id=?1')
          .bind(automation.id, `failed: ${error.message}`.slice(0, 240), now.toISOString()).run();
        await recordAutomationAction(db, automation.id, 'scheduled-run', 'failed', { error: error.message }, 'hub-scheduler');
        results.push({ automationId: automation.id, status: 'failed', error: error.message });
      }
    }
    return json({ ok: true, checkedAt: now.toISOString(), due: results.length, results });
  } catch (error) { return failure(error); }
}
