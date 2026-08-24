import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadEvidenceSnapshots } from '../src/hub/evidence.mjs';

test('evidence adapter preserves immutable snapshot provenance',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'hub-evidence-'));const snapshotPath=join(directory,'audit.json');const configPath=join(directory,'config.json');
  await writeFile(snapshotPath,JSON.stringify({schemaVersion:'1.0.0',source:'automation-1',mode:'snapshot',capturedAt:'2026-08-22T00:00:00.000Z',sourceRef:'abc123',items:[{id:'one',label:'One',status:'warning',summary:'Dated evidence',coverage:'public'}],approvalItems:[]}));
  await writeFile(configPath,JSON.stringify({schemaVersion:'1.0.0',sources:[{id:'audit',enabled:true,adapter:'snapshot-file',path:snapshotPath}]}));
  const result=await loadEvidenceSnapshots(configPath);assert.equal(result.snapshots[0].mode,'snapshot');assert.equal(result.snapshots[0].sourceRef,'abc123');assert.equal(result.snapshots[0].items[0].status,'warning');
});

test('missing snapshot degrades independently without claiming live status',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'hub-evidence-'));const configPath=join(directory,'config.json');
  await writeFile(configPath,JSON.stringify({schemaVersion:'1.0.0',sources:[{id:'missing',enabled:true,adapter:'snapshot-file',path:join(directory,'none.json')}]}));
  const result=await loadEvidenceSnapshots(configPath);assert.deepEqual(result.snapshots,[]);assert.match(result.warnings[0],/not available/);
});
