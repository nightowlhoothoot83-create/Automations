import { failure, json, jsonBody, requireDb } from '../../_lib.js';

export async function onRequestPost({ request, env }) {
  try {
    const input = await jsonBody(request);
    const keep = Number(input.keep ?? 500);
    if (!Number.isInteger(keep) || keep < 1 || keep > 5000) throw Object.assign(new Error('Retention keep must be between 1 and 5000'), { status: 400 });
    const db = requireDb(env);
    const before = await db.prepare('SELECT COUNT(*) AS count FROM history_events').first();
    const archivedAt = new Date().toISOString();
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO history_archive (event_id, type, title, approval_id, decision, actor, recorded_at, payload_json, archived_at) SELECT event_id, type, title, approval_id, decision, actor, recorded_at, payload_json, ?1 FROM history_events WHERE event_id IN (SELECT event_id FROM history_events ORDER BY recorded_at DESC LIMIT -1 OFFSET ?2)').bind(archivedAt, keep),
      db.prepare('DELETE FROM history_events WHERE event_id IN (SELECT event_id FROM history_events ORDER BY recorded_at DESC LIMIT -1 OFFSET ?1)').bind(keep)
    ]);
    const after = await db.prepare('SELECT COUNT(*) AS count FROM history_events').first();
    return json({ archived: Number(before?.count || 0) - Number(after?.count || 0), retained: Number(after?.count || 0), storage: 'cloudflare-d1' });
  } catch (error) { return failure(error); }
}
