import { readFile, mkdir, writeFile } from 'node:fs/promises'; import path from 'node:path';
import { validateConnections, inspectConnections } from './connections.mjs';

const args = process.argv.slice(2); const configPath = args[args.indexOf('--config') + 1] || 'config/connections.example.json';
const config = validateConnections(JSON.parse(await readFile(configPath, 'utf8'))); const connections = await inspectConnections(config);
const report = { schemaVersion: '1.0.0', generatedAt: new Date().toISOString(), configPath: path.resolve(configPath), connections };
await mkdir('artifacts/hub', { recursive: true }); await writeFile('artifacts/hub/connections-v1.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
