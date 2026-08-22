import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2); const execute = args.includes('--execute');
const configPath = args[args.indexOf('--config') + 1] || 'config/orchestration.json';
const config = JSON.parse(await readFile(configPath, 'utf8'));
if (config.schemaVersion !== '1.0.0' || !Array.isArray(config.automations)) throw new Error('Unsupported orchestration configuration');
const workers = config.automations.filter((item) => item.enabled && item.command);
if (!execute) {
  console.log(JSON.stringify({ mode: 'dry-run', workers: workers.map(({ id, command }) => ({ id, command })) }, null, 2));
} else {
  for (const worker of workers) {
    const [executable, ...workerArgs] = worker.command;
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(executable, workerArgs, { shell: false, stdio: 'inherit', env: { ...process.env, CI: 'true' }, windowsHide: true });
      child.on('error', reject); child.on('close', resolve);
    });
    if (exitCode !== 0 && config.defaults.failurePolicy !== 'continue-independent') process.exitCode = exitCode;
  }
}
