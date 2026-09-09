import { failure, json, jsonBody, requireDb } from '../_lib.js';
import { managedProperties, managedPropertyIds } from '../_managed-properties.js';

const kinds = new Set(['repair','edit']);
const clean = (value) => typeof value === 'string' ? value.trim() : '';
function validate(input = {}) {
  const target=clean(input.target), kind=clean(input.kind), summary=clean(input.summary), details=clean(input.details);
  if(!managedPropertyIds.has(target)) throw Object.assign(new Error('Invalid repair target'),{status:400});
  if(!kinds.has(kind)) throw Object.assign(new Error('Invalid repair type'),{status:400});
  if(summary.length<8||summary.length>120) throw Object.assign(new Error('Repair summary must be between 8 and 120 characters'),{status:400});
  if(details.length<12||details.length>2000) throw Object.assign(new Error('Repair details must be between 12 and 2000 characters'),{status:400});
  return {target,kind,summary,details,status:'awaiting-branch-work',deploymentGate:'blocked-until-all-tests-pass'};
}
function parsePayload(row){try{return JSON.parse(row.payload_json||'{}');}catch{return{};}}

export async function onRequestGet({ env }) {
  try {
    const db=requireDb(env);
    const {results=[]}=await db.prepare("SELECT event_id, type, recorded_at, payload_json FROM history_events WHERE type IN ('repair-requested','repair-status-changed') ORDER BY recorded_at DESC").all();
    const statusByRepair=new Map();
    for(const row of results){
      if(row.type!=='repair-status-changed') continue;
      const payload=parsePayload(row), repairEventId=payload.repairEventId;
      if(repairEventId&&!statusByRepair.has(repairEventId)) statusByRepair.set(repairEventId,{status:payload.status,lastAction:payload.action,lastChangedAt:row.recorded_at});
    }
    const requests=results.filter((row)=>row.type==='repair-requested').map((row)=>{
      const repair=parsePayload(row), change=statusByRepair.get(row.event_id);
      return {eventId:row.event_id,recordedAt:row.recorded_at,...repair,status:change?.status||repair.status,lastAction:change?.lastAction||null,lastChangedAt:change?.lastChangedAt||row.recorded_at};
    });
    return json({schemaVersion:'1.1.0',managedProperties,requests});
  }
  catch(error){return failure(error);}
}

export async function onRequestPost({ request, env }) {
  try { const repair=validate(await jsonBody(request)); const db=requireDb(env); const recordedAt=new Date().toISOString(), eventId=crypto.randomUUID(); await db.prepare('INSERT INTO history_events (event_id, type, title, actor, recorded_at, payload_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(eventId,'repair-requested',`${repair.kind==='edit'?'Code edit':'Repair'} requested: ${repair.summary}`,'owner',recordedAt,JSON.stringify(repair)).run(); return json({recorded:true,eventId,recordedAt,request:repair,note:'Repair request recorded. Production execution remains blocked until branch tests and evidence pass.'}); }
  catch(error){return failure(error);}
}
