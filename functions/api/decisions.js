import { failure, json, jsonBody, requireDb } from '../_lib.js';

const allowed = new Set(['approved', 'changes-requested', 'deferred']);

export async function onRequestPost({ request, env }) {
  try {
    const input = await jsonBody(request);
    if (!input.id || !allowed.has(input.decision)) throw Object.assign(new Error('Invalid approval decision'), { status: 400 });
    const db = requireDb(env);
    const recordedAt = new Date().toISOString();
    const eventId = crypto.randomUUID();
    await db.batch([
      db.prepare('INSERT INTO decisions (approval_id, decision, actor, recorded_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(approval_id) DO UPDATE SET decision=excluded.decision, actor=excluded.actor, recorded_at=excluded.recorded_at').bind(input.id, input.decision, 'owner', recordedAt),
      db.prepare('INSERT INTO history_events (event_id, type, title, approval_id, decision, actor, recorded_at, payload_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)').bind(eventId, 'approval-decision', `Owner marked ${input.id} as ${input.decision}`, input.id, input.decision, 'owner', recordedAt, JSON.stringify({ approvalId: input.id, decision: input.decision }))
    ]);
    return json({ recorded: true, note: `Decision recorded: ${input.decision}`, eventId });
  } catch (error) { return failure(error); }
}
