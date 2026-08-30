import { failure, json, requireDb } from '../../_lib.js';

export async function onRequestGet({ env }) {
  try {
    const db = requireDb(env);
    const { results = [] } = await db.prepare('SELECT event_id AS eventId, type, title, approval_id AS approvalId, decision, actor, recorded_at AS recordedAt, payload_json AS payloadJson FROM history_events ORDER BY recorded_at ASC').all();
    const events = results.map(({ payloadJson, ...row }) => ({ ...row, payload: JSON.parse(payloadJson || '{}') }));
    return json({ schemaVersion: '1.0.0', exportedAt: new Date().toISOString(), events }, 200, { 'content-disposition': 'attachment; filename="ascension-history.json"' });
  } catch (error) { return failure(error); }
}
