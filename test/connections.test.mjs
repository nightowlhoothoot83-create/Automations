import test from 'node:test'; import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises';
import { validateConnections, inspectConnections } from '../src/connections.mjs';

test('example connections are valid and mock adapter is exercised', async () => {
  const config = validateConnections(JSON.parse(await readFile('config/connections.example.json', 'utf8')));
  const statuses = await inspectConnections(config, { env: {}, cwd: process.cwd() });
  assert.equal(statuses.find((item) => item.id === 'mock-development').state, 'ready');
  assert.equal(statuses.find((item) => item.id === 'github-primary').state, 'not-configured');
  assert.equal(JSON.stringify(statuses).includes('TOKEN'), true);
  assert.equal(JSON.stringify(statuses).includes('secret-value'), false);
});

test('inline credentials are rejected', () => assert.throws(() => validateConnections({ schemaVersion: '1.0.0', connections: [{ id: 'bad', type: 'github', enabled: true, credentialEnv: null, settings: { repository: 'owner/repo', apiToken: 'secret-value' } }] }), /credentialEnv/));

test('configured live adapter remains dormant during inspection', async () => {
  const config = validateConnections({ schemaVersion: '1.0.0', connections: [{ id: 'github-test', type: 'github', enabled: true, credentialEnv: 'GITHUB_TEST_TOKEN', settings: { repository: 'owner/repo', apiBaseUrl: 'http://127.0.0.1:1' } }] });
  const [result] = await inspectConnections(config, { env: { GITHUB_TEST_TOKEN: 'secret-value' } });
  assert.equal(result.state, 'ready-to-activate'); assert.equal(result.tested, false); assert.equal(JSON.stringify(result).includes('secret-value'), false);
});
