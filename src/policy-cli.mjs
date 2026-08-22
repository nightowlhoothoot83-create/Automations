import { readFile } from 'node:fs/promises'; import { planRetention, applyRetention, validateSchedules } from './policy.mjs';
const load = async (file) => JSON.parse(await readFile(file, 'utf8'));
const [policy, schedules, inventory, orchestration] = await Promise.all([load('config/retention-policy.json'), load('config/schedules.json'), load('config/target-inventory.json'), load('config/orchestration.json')]);
validateSchedules(schedules, inventory, new Set(orchestration.automations.map((item) => item.id)));
const plan = await planRetention(policy); const result = await applyRetention(plan, { execute: process.argv.includes('--execute-retention') });
console.log(JSON.stringify({ schedules: { valid: true, count: schedules.schedules.length }, retention: result }, null, 2));
