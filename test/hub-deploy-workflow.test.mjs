import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Hub GitHub deployment validates before publishing to the existing Pages project', async () => {
  const workflow = await readFile('.github/workflows/deploy-management-hub.yml', 'utf8');
  assert.match(workflow, /npm run check[\s\S]+npm run build:pages[\s\S]+wrangler pages deploy/);
  assert.match(workflow, /project-name=ascension-automation-hub/);
  assert.match(workflow, /environment: production/);
  assert.doesNotMatch(workflow, /wrangler pages project create/);
});
