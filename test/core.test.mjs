import test from 'node:test'; import assert from 'node:assert/strict';
import { validateConfig, REPORT_SCHEMA_VERSION, createReviewPackage } from '../src/core.mjs';

test('accepts a minimal safe config', () => assert.equal(validateConfig({ schemaVersion: REPORT_SCHEMA_VERSION, targets: [], commands: [] }).schemaVersion, REPORT_SCHEMA_VERSION));
test('rejects shell-enabled commands', () => assert.throws(() => validateConfig({ schemaVersion: REPORT_SCHEMA_VERSION, targets: [], commands: [{ id: 'x', executable: 'node', args: [], shell: true }] }), /cannot enable a shell/));
test('rejects non-http targets', () => assert.throws(() => validateConfig({ schemaVersion: REPORT_SCHEMA_VERSION, targets: [{ id: 'x', url: 'file:///secret', checks: [] }], commands: [] }), /HTTP/));
test('completed runs emit a review package without inventing an approval', () => { const review=createReviewPackage({capturedAt:'2026-08-30T00:00:00.000Z',status:'passed',summary:{failed:0},approvals:[]}); assert.equal(review.knownFailures,0); assert.equal(review.approvalRequested,false); assert.equal(review.evidenceRefs.length,1); });
