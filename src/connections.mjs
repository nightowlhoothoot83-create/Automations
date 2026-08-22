import { readFile } from 'node:fs/promises';
import path from 'node:path';

const allowedTypes = new Set(['github', 'cloudflare', 'management-hub', 'monitoring', 'storage', 'logging', 'mock']);
const secretName = /(token|secret|password|credential|api.?key)/i;

export function validateConnections(config) {
  if (config?.schemaVersion !== '1.0.0' || !Array.isArray(config.connections)) throw new Error('Unsupported connections configuration');
  const ids = new Set();
  for (const connection of config.connections) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(connection.id) || ids.has(connection.id)) throw new Error(`Invalid or duplicate connection id: ${connection.id}`);
    ids.add(connection.id);
    if (!allowedTypes.has(connection.type) || typeof connection.enabled !== 'boolean' || !connection.settings) throw new Error(`Invalid connection: ${connection.id}`);
    for (const [key, value] of Object.entries(connection.settings)) if (secretName.test(key) && value) throw new Error(`Connection ${connection.id} must reference credentials through credentialEnv, not settings.${key}`);
    if (connection.credentialEnv !== null && !/^[A-Z][A-Z0-9_]*$/.test(connection.credentialEnv)) throw new Error(`Invalid credentialEnv for ${connection.id}`);
    validateTypeSettings(connection);
  }
  return config;
}

function validateTypeSettings(connection) {
  const settings = connection.settings;
  for (const key of ['apiBaseUrl', 'endpoint']) if (settings[key]) {
    const protocol = new URL(settings[key]).protocol; if (!['http:', 'https:'].includes(protocol)) throw new Error(`${connection.id}.${key} must use HTTP(S)`);
  }
  if (connection.type === 'github' && settings.repository && !/^[^/\s]+\/[^/\s]+$/.test(settings.repository)) throw new Error(`${connection.id}.repository must be owner/name`);
  for (const key of ['fixturePath', 'storagePath', 'logPath']) if (settings[key] && path.isAbsolute(settings[key])) throw new Error(`${connection.id}.${key} must be workspace-relative`);
}

export async function inspectConnections(config, { env = process.env, cwd = process.cwd() } = {}) {
  const statuses = [];
  for (const connection of config.connections) {
    const missing = requiredSettings(connection).filter((key) => !connection.settings[key]);
    if (!connection.enabled) { statuses.push(status(connection, 'not-configured', missing, false)); continue; }
    if (missing.length) { statuses.push(status(connection, 'needs-configuration', missing, false)); continue; }
    if (connection.credentialEnv && !env[connection.credentialEnv]) { statuses.push(status(connection, 'needs-credential', [], false)); continue; }
    if (connection.type === 'mock') {
      const fixture = JSON.parse(await readFile(path.resolve(cwd, connection.settings.fixturePath), 'utf8'));
      statuses.push({ ...status(connection, fixture.reachable ? 'ready' : 'failed', [], true), evidence: fixture }); continue;
    }
    statuses.push(status(connection, 'ready-to-activate', [], false));
  }
  return statuses;
}

function requiredSettings(connection) {
  if (connection.type === 'github') return ['repository'];
  if (connection.type === 'cloudflare') return ['accountId', 'projectName'];
  if (connection.type === 'management-hub' || connection.type === 'monitoring') return ['endpoint'];
  if (connection.type === 'mock') return ['fixturePath'];
  return [];
}

function status(connection, state, missing, tested) {
  return { id: connection.id, type: connection.type, enabled: connection.enabled, state, missing, tested, credentialEnv: connection.credentialEnv, credentialPresent: connection.credentialEnv ? undefined : null };
}
