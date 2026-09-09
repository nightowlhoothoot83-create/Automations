import { appendHistory, readHistory } from './history.mjs';

export const managedProperties = Object.freeze([
  { id:'management-hub', name:'Ascension Manager Hub', type:'hub', repo:'nightowlhoothoot83-create/ascension-automation-hub' },
  { id:'raven-sharp-hub', name:'Raven Sharp Hub', type:'hub', repo:'nightowlhoothoot83-create/Raven-Sharp-Hub' },
  { id:'image-optimiser', name:'Image Optimiser & Upscaler', type:'saas', repo:'nightowlhoothoot83-create/Raven-Sharp-Image-Optimiser-Upscaler' },
  { id:'pod-suite', name:'POD Suite', type:'saas', repo:'nightowlhoothoot83-create/Raven-Sharp-POD-Automation' },
  { id:'ad-manager', name:'Ad Manager', type:'saas', repo:'nightowlhoothoot83-create/Raven-Sharp-Ad-Manager' },
  { id:'book-creator', name:'Book Creator', type:'saas', repo:'nightowlhoothoot83-create/Raven-Sharp-Book-Creator' },
  { id:'content-creator', name:'Content Creator', type:'saas', repo:'nightowlhoothoot83-create/Raven-Sharp-Content-Creator' },
  { id:'smart-cleaner', name:'Smart Cleaner', type:'saas', repo:'nightowlhoothoot83-create/Raven-Sharp-Smart-AI-Cleaner' },
  { id:'mycalctools', name:'MyCalcTools', type:'adsense', repo:'nightowlhoothoot83-create/Mycalctools', baselineApproved:true },
  { id:'mycalendartools', name:'MyCalendarTools', type:'adsense', repo:'nightowlhoothoot83-create/Mycalendartools', baselineApproved:true },
  { id:'wheelnamepicker', name:'Wheel Name Picker', type:'adsense', repo:'nightowlhoothoot83-create/Wheelnamepicker', baselineApproved:true },
  { id:'mystical-moments', name:'Mystical Moments', type:'website', repo:'nightowlhoothoot83-create/Mystical-Moments' },
  { id:'natures-sacred-synergy', name:"Nature's Sacred Synergy", type:'website', repo:'nightowlhoothoot83-create/Natures-Sacred-Synergy' },
  { id:'natures-synergy-services', name:"Nature's Synergy Services", type:'website', repo:'nightowlhoothoot83-create/Natures-Synergy-Services' },
  { id:'store-ops', name:'Raven Sharp Store Ops', type:'automation', repo:'nightowlhoothoot83-create/Raven-Sharp-Store-Ops' },
  { id:'qa-agent', name:'Raven Sharp QA Agent', type:'automation', repo:'nightowlhoothoot83-create/Raven-Sharp-QA-Agent' },
  { id:'adg-monitor', name:'ADG Monitor', type:'monitor', repo:'nightowlhoothoot83-create/ADG-MONITOR-V4' }
]);

const targets = new Set(managedProperties.map((item)=>item.id));
const kinds = new Set(['repair','edit']);
const actions = new Set(['dismiss','already-fixed','retest','reopen']);
const clean = (value) => typeof value === 'string' ? value.trim() : '';

export function validateRepairRequest(input = {}) {
  const target=clean(input.target), kind=clean(input.kind), summary=clean(input.summary), details=clean(input.details);
  if (!targets.has(target)) throw new Error('Invalid repair target');
  if (!kinds.has(kind)) throw new Error('Invalid repair type');
  if (summary.length < 8 || summary.length > 120) throw new Error('Repair summary must be between 8 and 120 characters');
  if (details.length < 12 || details.length > 2000) throw new Error('Repair details must be between 12 and 2000 characters');
  return { target, kind, summary, details };
}

export async function recordRepairRequest(input) {
  const request = validateRepairRequest(input);
  const event = await appendHistory({ type:'repair-requested', title:`${request.kind === 'edit' ? 'Code edit' : 'Repair'} requested: ${request.summary}`, actor:'local-owner', provenance:'local', repair:{ ...request, status:'awaiting-branch-work', deploymentGate:'blocked-until-all-tests-pass' } });
  return { recorded:true, eventId:event.eventId, recordedAt:event.recordedAt, request:event.repair, note:'Repair request recorded. Production execution remains blocked until branch tests and evidence pass.' };
}

export async function updateRepairRequest(eventId, action) {
  eventId=clean(eventId); action=clean(action);
  if (!eventId) throw new Error('Invalid repair event ID');
  if (!actions.has(action)) throw new Error('Invalid repair action');
  const { events } = await readHistory(Number.MAX_SAFE_INTEGER);
  const original=events.find((event)=>event.eventId===eventId && event.type==='repair-requested' && event.repair);
  if (!original) throw new Error('Invalid repair event ID');
  const status={ dismiss:'dismissed', 'already-fixed':'resolved-awaiting-retest', retest:'retest-requested', reopen:'awaiting-branch-work' }[action];
  const event=await appendHistory({ type:'repair-status-changed', title:`Repair ${action}: ${original.repair.summary}`, actor:'local-owner', provenance:'local', repairEventId:eventId, repairAction:action, repairStatus:status });
  return { recorded:true, eventId:event.eventId, repairEventId:eventId, action, status, note:action==='retest'?'Retest requested. No production mutation was performed.':'Repair history preserved.' };
}

export async function listRepairRequests() {
  const { events, warnings } = await readHistory(Number.MAX_SAFE_INTEGER);
  const statusEvents=events.filter((event)=>event.type==='repair-status-changed' && event.repairEventId);
  const latestStatus=new Map();
  for (const event of statusEvents) if (!latestStatus.has(event.repairEventId)) latestStatus.set(event.repairEventId,event);
  const requests=events.filter((event)=>event.type==='repair-requested' && event.repair).map((event)=>{
    const change=latestStatus.get(event.eventId);
    return { eventId:event.eventId, recordedAt:event.recordedAt, ...event.repair, status:change?.repairStatus || event.repair.status, lastAction:change?.repairAction || null, lastChangedAt:change?.recordedAt || event.recordedAt };
  });
  return { schemaVersion:'1.1.0', managedProperties, requests, warnings };
}
