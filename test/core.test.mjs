import test from 'node:test'; import assert from 'node:assert/strict';
import { validateConfig, REPORT_SCHEMA_VERSION } from '../src/core.mjs';

test('accepts a minimal safe config', () => assert.equal(validateConfig({ schemaVersion: REPORT_SCHEMA_VERSION, targets: [], commands: [] }).schemaVersion, REPORT_SCHEMA_VERSION));
test('rejects shell-enabled commands', () => assert.throws(() => validateConfig({ schemaVersion: REPORT_SCHEMA_VERSION, targets: [], commands: [{ id: 'x', executable: 'node', args: [], shell: true }] }), /cannot enable a shell/));
test('rejects non-http targets', () => assert.throws(() => validateConfig({ schemaVersion: REPORT_SCHEMA_VERSION, targets: [{ id: 'x', url: 'file:///secret', checks: [] }], commands: [] }), /HTTP/));
