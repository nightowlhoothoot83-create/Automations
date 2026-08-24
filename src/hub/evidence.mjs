import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function json(path){return JSON.parse(await readFile(resolve(path),'utf8'));}
function validate(snapshot){if(snapshot?.schemaVersion!=='1.0.0'||snapshot.mode!=='snapshot'||typeof snapshot.sourceRef!=='string'||!Array.isArray(snapshot.items)||!Array.isArray(snapshot.approvalItems))throw new Error('Unsupported evidence snapshot');return snapshot;}

export async function loadEvidenceSnapshots(configPath=process.env.HUB_EVIDENCE_CONFIG||'config/hub-evidence.example.json'){
  let config;try{config=await json(configPath);}catch(error){if(error.code==='ENOENT')return{snapshots:[],warnings:[`Evidence registry not found: ${configPath}`]};throw error;}
  if(config.schemaVersion!=='1.0.0'||!Array.isArray(config.sources))throw new Error('Unsupported evidence registry');
  const snapshots=[],warnings=[];
  for(const source of config.sources.filter((item)=>item.enabled)){
    try{if(source.adapter!=='snapshot-file')throw new Error('Unsupported evidence adapter');snapshots.push({...validate(await json(source.path)),sourceId:source.id,adapter:source.adapter});}
    catch(error){warnings.push(`${source.id}: ${error.code==='ENOENT'?'configured snapshot is not available':error.message}`);}
  }
  return{snapshots,warnings};
}
