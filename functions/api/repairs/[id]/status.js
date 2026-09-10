import { failure, json, jsonBody, requireDb } from '../../../_lib.js';

const actions = new Set(['dismiss','already-fixed','retest','reopen']);
const clean=(value)=>typeof value==='string'?value.trim():'';
const statusFor={ dismiss:'dismissed', 'already-fixed':'resolved-awaiting-retest', retest:'retest-requested', reopen:'awaiting-branch-work' };

export async function onRequestPost({ request, env, params }) {
  try {
    const repairEventId=clean(params?.id), input=await jsonBody(request), action=clean(input.action);
    if(!repairEventId) throw Object.assign(new Error('Invalid repair event ID'),{status:400});
    if(!actions.has(action)) throw Object.assign(new Error('Invalid repair action'),{status:400});
    const db=requireDb(env);
    const {results=[]}=await db.prepare("SELECT event_id, payload_json FROM history_events WHERE event_id=?1 AND type='repair-requested' LIMIT 1").bind(repairEventId).all();
    if(!results.length) throw Object.assign(new Error('Invalid repair event ID'),{status:400});
    let repair={}; try{repair=JSON.parse(results[0].payload_json||'{}');}catch{}
    const status=statusFor[action], recordedAt=new Date().toISOString(), eventId=crypto.randomUUID();
    const payload={repairEventId,action,status};
    await db.prepare('INSERT INTO history_events (event_id, type, title, actor, recorded_at, payload_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(eventId,'repair-status-changed',`Repair ${action}: ${repair.summary||repairEventId}`,'owner',recordedAt,JSON.stringify(payload)).run();
    return json({recorded:true,eventId,repairEventId,action,status,note:action==='retest'?'Retest requested. No production mutation was performed.':'Repair history preserved.'});
  } catch(error){return failure(error);}
}
