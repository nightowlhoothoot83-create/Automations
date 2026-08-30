import { failure, json, jsonBody, requireDb } from '../../_lib.js';

export async function onRequestPost({ request, env }) {
  try {
    const input = await jsonBody(request);
    if (input.schemaVersion !== '1.0.0' || !Array.isArray(input.events)) throw Object.assign(new Error('Unsupported history bundle'), { status: 400 });
    if (input.events.length > 1000) throw Object.assign(new Error('History bundle exceeds 1000 events'), { status: 413 });
    const db = requireDb(env);
    let imported = 0;
    let duplicates = 0;
    for (const event of input.events) {
      if (!event.eventId || !event.type || !event.title || !event.recordedAt) throw Object.assign(new Error('Invalid history event'), { status: 400 });
      const result = await db.prepare('INSERT OR IGNORE INTO history_events (event_id, type, title, approval_id, decision, actor, recorded_at, payload_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)').bind(event.eventId, event.type, event.title, event.approvalId || null, event.decision || null, event.actor || null, event.recordedAt, JSON.stringify(event.payload || {})).run();
      if (result.meta?.changes) imported += 1; else duplicates += 1;
    }
    return json({ imported, duplicates });
  } catch (error) { return failure(error); }
}
