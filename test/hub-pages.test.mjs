import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestPost as recordDecision } from '../functions/api/decisions.js';
import { onRequestGet as getDashboard } from '../functions/api/dashboard.js';

function fakeDb(decisions = []) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) { calls.push({ sql, values }); return this; },
        async all() { return { results: decisions }; },
        async run() { return { meta: { changes: 1 } }; }
      };
    },
    async batch(statements) { assert.equal(statements.length, 2); return statements.map(() => ({ success: true })); }
  };
}

test('Pages dashboard requires D1 and preserves snapshot provenance', async () => {
  const missing = await getDashboard({ env: {} });
  assert.equal(missing.status, 503);
  const response = await getDashboard({ env: { HUB_DB: fakeDb() } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.storage.mode, 'cloudflare-d1');
  assert.match(body.source, /fixture|configured|automation/i);
});

test('Pages decision endpoint validates input and writes decision plus history atomically', async () => {
  const invalid = await recordDecision({ request: new Request('https://hub.test/api/decisions', { method: 'POST', body: '{"decision":"approved"}' }), env: { HUB_DB: fakeDb() } });
  assert.equal(invalid.status, 400);
  const db = fakeDb();
  const response = await recordDecision({ request: new Request('https://hub.test/api/decisions', { method: 'POST', body: '{"id":"deploy-safe-fix","decision":"deferred"}' }), env: { HUB_DB: db } });
  assert.equal(response.status, 200);
  assert.equal(db.calls.length, 2);
  assert.match(db.calls[0].sql, /ON CONFLICT/);
});
