import { readFile, readdir, stat, rm, mkdir, writeFile } from 'node:fs/promises'; import path from 'node:path';

export function validateTargetSelection(inventory, selectedIds) {
  if (inventory?.schemaVersion !== '1.0.0' || !Array.isArray(inventory.targets)) throw new Error('Unsupported target inventory');
  const byId = new Map(inventory.targets.map((item) => [item.id, item])); const selected = [];
  for (const id of selectedIds) {
    const target = byId.get(id); if (!target) throw new Error(`Unknown target: ${id}`);
    if (target.selection !== 'approved') throw new Error(`Target ${id} is ${target.selection}; explicit approval is required before selection`);
    selected.push(target);
  }
  return selected;
}

export function validateSchedules(manifest, inventory, workers) {
  if (manifest?.schemaVersion !== '1.0.0' || !Array.isArray(manifest.schedules)) throw new Error('Unsupported schedule manifest');
  const ids = new Set(); const targetIds = new Set(inventory.targets.map((item) => item.id));
  for (const schedule of manifest.schedules) {
    if (ids.has(schedule.id) || !workers.has(schedule.workerId)) throw new Error(`Invalid schedule: ${schedule.id}`); ids.add(schedule.id);
    if (!/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(schedule.cron)) throw new Error(`Schedule ${schedule.id} requires a five-field cron`);
    if (schedule.mode !== 'read-only') throw new Error(`Schedule ${schedule.id} must be read-only`);
    for (const id of schedule.targetSelectors) if (!targetIds.has(id)) throw new Error(`Schedule ${schedule.id} references unknown target ${id}`);
  }
  return manifest;
}

export async function planRetention(policy, cwd = process.cwd(), now = Date.now()) {
  const actions = [];
  if (policy.deletionMode !== 'local-generated-only') throw new Error('Retention may only affect local generated artifacts');
  for (const [kind, rule] of Object.entries(policy.artifacts)) {
    const root = path.resolve(cwd, rule.path); if (!root.startsWith(path.resolve(cwd, 'artifacts') + path.sep)) throw new Error(`Unsafe retention path: ${rule.path}`);
    let entries = []; try { entries = await readdir(root); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const detailed = await Promise.all(entries.map(async (name) => ({ name, modifiedMs: (await stat(path.join(root, name))).mtimeMs })));
    detailed.sort((a, b) => b.modifiedMs - a.modifiedMs);
    for (const [index, item] of detailed.entries()) if (index >= rule.maxItems || now - item.modifiedMs > rule.maxAgeDays * 86400000) actions.push({ kind, path: path.join(root, item.name), reason: index >= rule.maxItems ? 'max-items' : 'max-age' });
  }
  return actions;
}

export async function applyRetention(actions, { execute = false } = {}) {
  if (execute) for (const action of actions) await rm(action.path, { recursive: true, force: false });
  return { mode: execute ? 'executed' : 'dry-run', actions };
}

export async function routeApproval(item, routeConfig, cwd = process.cwd()) {
  const route = routeConfig.routes.find((candidate) => candidate.actionClasses.includes(item.actionClass));
  if (!route) throw new Error(`No approval route for ${item.actionClass}`);
  const destination = path.resolve(cwd, route.destination); if (!destination.startsWith(path.resolve(cwd, 'artifacts', 'hub') + path.sep)) throw new Error('Approval destination must be local Management Hub storage');
  await mkdir(path.dirname(destination), { recursive: true }); let current = { schemaVersion: '1.0.0', items: [] };
  try { current = JSON.parse(await readFile(destination, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  current.items = [item, ...current.items.filter((existing) => existing.id !== item.id)]; current.updatedAt = new Date().toISOString();
  await writeFile(destination, `${JSON.stringify(current, null, 2)}\n`); return destination;
}
