import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const historyPath = () => resolve(process.env.HUB_HISTORY_PATH || 'data/hub/activity-v1.jsonl');
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
    try { const event = JSON.parse(line); if (event.schemaVersion !== '1.0.0' || !event.eventId || !event.recordedAt) throw new Error('unsupported record'); events.push(event); }
    catch (error) { warnings.push(`History line ${index + 1}: ${error.message}`); }
  }
  return { events:events.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)).slice(0,limit), warnings };
}
