import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const VERSION = '1.0.0';
const KINDS = new Set(['content', 'assets', 'finance', 'repairs', 'approvals']);

function validateEnvelope(value, expectedKind) {
  if (!value || value.schemaVersion !== VERSION || value.kind !== expectedKind || !KINDS.has(value.kind) || !['live', 'fixture'].includes(value.mode) || !Array.isArray(value.items)) throw new Error(`Unsupported ${expectedKind} source contract`);
  if (value.items.some((item) => !item || typeof item.id !== 'string')) throw new Error(`Invalid ${expectedKind} source item`);
  return value;
}

export async function loadSources(configPath = process.env.HUB_SOURCES_CONFIG || 'config/hub-sources.example.json') {
  let config;
  try { config = JSON.parse(await readFile(resolve(configPath), 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return { sources: {}, warnings: [`Source config not found: ${configPath}`] };
    throw error;
  }
  if (config.schemaVersion !== VERSION || !Array.isArray(config.sources)) throw new Error('Unsupported hub source configuration');
  const sources = {}, warnings = [];
  for (const entry of config.sources.filter((item) => item.enabled)) {
    if (entry.adapter !== 'json-file' || !KINDS.has(entry.kind) || typeof entry.path !== 'string') { warnings.push(`Skipped unsupported source: ${entry.id || 'unknown'}`); continue; }
    try {
      const envelope = validateEnvelope(JSON.parse(await readFile(resolve(entry.path), 'utf8')), entry.kind);
      sources[entry.kind] = { ...envelope, sourceId: entry.id, adapter: entry.adapter };
    } catch (error) { warnings.push(`${entry.id}: ${error.message}`); }
  }
  return { sources, warnings };
}
