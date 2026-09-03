import { appendHistory, readHistory } from './history.mjs';

const targets = new Set(['management-hub','image-optimiser','pod-suite','ad-manager','book-creator','content-creator','smart-cleaner-web']);
const kinds = new Set(['repair','edit']);
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

export async function listRepairRequests() {
  const { events, warnings } = await readHistory(Number.MAX_SAFE_INTEGER);
  return { schemaVersion:'1.0.0', requests:events.filter((event)=>event.type==='repair-requested' && event.repair).map((event)=>({ eventId:event.eventId, recordedAt:event.recordedAt, ...event.repair })), warnings };
}
