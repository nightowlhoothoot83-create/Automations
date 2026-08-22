import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const historyPath = () => resolve(process.env.HUB_HISTORY_PATH || 'data/hub/activity-v1.jsonl');
const archiveDirectory = () => resolve(process.env.HUB_HISTORY_ARCHIVE_DIR || 'data/hub/archives');
function validateRecord(event) { return event?.schemaVersion === '1.0.0' && typeof event.eventId === 'string' && typeof event.recordedAt === 'string' && typeof event.type === 'string' && typeof event.title === 'string'; }
export async function appendHistory(event) {
  if (!event?.type || !event?.title) throw new Error('Invalid history event');
  const record = { schemaVersion:'1.0.0', eventId:randomUUID(), recordedAt:new Date().toISOString(), ...event };
  const path = historyPath(); await mkdir(dirname(path), { recursive:true }); await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8'); return record;
}
export async function readHistory(limit = 100) {
  let text; try { text = await readFile(historyPath(), 'utf8'); } catch (error) { if (error.code === 'ENOENT') return { events:[], warnings:[] }; throw error; }
  const events = [], warnings = [];
  for (const [index,line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try { const event = JSON.parse(line); if (!validateRecord(event)) throw new Error('unsupported record'); events.push(event); }
    catch (error) { warnings.push(`History line ${index + 1}: ${error.message}`); }
  }
  return { events:events.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)).slice(0,limit), warnings };
}

export async function exportHistory() {
  const { events, warnings } = await readHistory(Number.MAX_SAFE_INTEGER);
  return { schemaVersion:'1.0.0', kind:'ascension-hub-history-export', exportedAt:new Date().toISOString(), eventCount:events.length, events:events.slice().reverse(), warnings };
}

export async function importHistory(bundle) {
  if (bundle?.schemaVersion !== '1.0.0' || bundle.kind !== 'ascension-hub-history-export' || !Array.isArray(bundle.events) || bundle.events.length > 10_000) throw new Error('Unsupported history import bundle');
  if (bundle.events.some((event) => !validateRecord(event))) throw new Error('History import contains invalid records');
  const { events:current } = await readHistory(Number.MAX_SAFE_INTEGER); const seen = new Set(current.map((event) => event.eventId));
  const additions = bundle.events.filter((event) => !seen.has(event.eventId));
  if (additions.length) { const path = historyPath(); await mkdir(dirname(path),{recursive:true}); await appendFile(path, additions.map((event)=>JSON.stringify(event)).join('\n') + '\n','utf8'); }
  return { imported:additions.length, duplicates:bundle.events.length-additions.length, total:current.length+additions.length, provenance:'preserved' };
}

export async function retainHistory(keep = 500) {
  if (!Number.isInteger(keep) || keep < 1 || keep > 10_000) throw new Error('Retention keep must be between 1 and 10000');
  const { events, warnings } = await readHistory(Number.MAX_SAFE_INTEGER); if (events.length <= keep) return { retained:events.length, archived:0, archivePath:null, warnings };
  const newest = events.slice(0,keep), archived = events.slice(keep).reverse(); const directory = archiveDirectory(); await mkdir(directory,{recursive:true});
  const archivePath = resolve(directory,`history-v1-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
  await writeFile(archivePath,JSON.stringify({schemaVersion:'1.0.0',kind:'ascension-hub-history-export',exportedAt:new Date().toISOString(),reason:'retention-archive',eventCount:archived.length,events:archived},null,2));
  await writeFile(historyPath(),newest.reverse().map((event)=>JSON.stringify(event)).join('\n') + '\n','utf8');
  return { retained:newest.length, archived:archived.length, archivePath, warnings };
}
