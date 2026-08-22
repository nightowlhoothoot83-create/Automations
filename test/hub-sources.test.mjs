import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSources } from '../src/hub/sources.mjs';

test('file adapter loads a versioned source and exposes fixture provenance', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hub-source-'));
  const sourcePath = join(directory, 'content.json'); const configPath = join(directory, 'config.json');
  await writeFile(sourcePath, JSON.stringify({ schemaVersion:'1.0.0',kind:'content',mode:'fixture',updatedAt:'2026-08-22T00:00:00.000Z',items:[{id:'one'}] }));
  await writeFile(configPath, JSON.stringify({ schemaVersion:'1.0.0',sources:[{id:'content-fixture',kind:'content',adapter:'json-file',path:sourcePath,enabled:true}] }));
  const result = await loadSources(configPath); assert.equal(result.sources.content.mode, 'fixture'); assert.equal(result.sources.content.items[0].id, 'one'); assert.deepEqual(result.warnings, []);
});

test('source failures degrade independently and remain visible as warnings', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hub-source-')); const configPath = join(directory, 'config.json');
  await writeFile(configPath, JSON.stringify({ schemaVersion:'1.0.0',sources:[{id:'missing-finance',kind:'finance',adapter:'json-file',path:join(directory,'missing.json'),enabled:true}] }));
  const result = await loadSources(configPath); assert.equal(result.sources.finance, undefined); assert.match(result.warnings[0], /missing-finance/);
});
