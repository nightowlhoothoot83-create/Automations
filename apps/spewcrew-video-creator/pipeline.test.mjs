import test from 'node:test';
import assert from 'node:assert/strict';
import { createJob, processJob, JobQueue, parseStoryboard, requestGeneration } from './pipeline.mjs';

const canon = { rizzy: {}, spewy: {}, milky: {} };
const brief = { theme: 'Sharing', format: { name: 'YouTube Short', dur: 60 }, chars: ['rizzy'] };
const story = () => ({ title: 'Sharing', voiceoverScript: 'Together!', frames: [1, 2].map(n => ({ scene: `Scene ${n}`, voiceover: 'Together!', characters: ['rizzy'] })) });
const options = () => ({ textPrompt: () => 'story', imagePrompt: () => 'image', save: async () => {}, generate: async body => body.mode === 'text' ? JSON.stringify(story()) : 'aW1hZ2U=' });

test('job creation snapshots the brief and rejects missing character selection', () => {
  const input = structuredClone(brief); const job = createJob(input, canon, 'a'); input.chars.push('spewy');
  assert.deepEqual(job.chars, ['rizzy']); assert.throws(() => createJob({ ...brief, chars: [] }, canon));
});
test('storyboards reject invented characters, empty scenes and excessive scene counts', () => {
  const invalid = story(); invalid.frames[0].characters = ['stranger'];
  assert.throws(() => parseStoryboard(JSON.stringify(invalid), brief.chars));
  invalid.frames = Array(9).fill(story().frames[0]); assert.throws(() => parseStoryboard(JSON.stringify(invalid), brief.chars));
});
test('generation saves each completed scene and only marks complete packages ready', async () => {
  const job = createJob(brief, canon, 'a'); const saved = [];
  await processJob(job, { ...options(), save: async j => saved.push(structuredClone(j)) });
  assert.equal(job.status, 'package-ready'); assert.equal(job.completedScenes, 2);
  assert.ok(saved.some(j => j.completedScenes === 1 && j.status === 'generating'));
});
test('failed scenes retain checkpoints and resume without regenerating saved scenes or script', async () => {
  const job = createJob(brief, canon, 'a'); let images = 0;
  await processJob(job, { ...options(), generate: async body => {
    if (body.mode === 'text') return JSON.stringify(story());
    if (++images === 2) throw new Error('Provider unavailable'); return 'aW1hZ2U=';
  } });
  assert.equal(job.status, 'failed'); assert.equal(job.completedScenes, 1);
  let resumed = 0;
  await processJob(job, { ...options(), generate: async body => { assert.equal(body.mode, 'image'); resumed++; return 'aW1hZ2U='; } });
  assert.equal(resumed, 1); assert.equal(job.status, 'package-ready');
});
test('reference images accompany only scenes featuring those characters', async () => {
  const job = createJob(brief, canon, 'a'); const ref = { mimeType: 'image/png', data: 'aW1hZ2U=' };
  await processJob(job, { ...options(), references: { rizzy: ref, spewy: { data: 'other' } }, generate: async body => {
    if (body.mode === 'text') return JSON.stringify(story()); assert.deepEqual(body.references, [ref]); return 'aW1hZ2U=';
  } });
});
test('cancelled jobs stop and completed jobs never incur generation again', async () => {
  const controller = new AbortController(); controller.abort();
  const job = createJob(brief, canon, 'a');
  await processJob(job, { ...options(), signal: controller.signal, generate: async () => assert.fail('Must not generate') });
  assert.equal(job.status, 'stopped');
  job.status = 'package-ready'; await processJob(job, { ...options(), generate: async () => assert.fail('Must not regenerate') });
});
test('queue continues independent jobs after provider failures', async () => {
  const jobs = ['a', 'b'].map(id => createJob(brief, canon, id)); let requests = 0;
  await new JobQueue().run(jobs, { ...options(), generate: async body => {
    if (++requests === 1) throw new Error('First job failed'); return body.mode === 'text' ? JSON.stringify(story()) : 'aW1hZ2U=';
  } });
  assert.deepEqual(jobs.map(j => j.status), ['failed', 'package-ready']);
});
test('queue prevents overlapping runs', async () => {
  const queue = new JobQueue(); let release; const waiting = new Promise(r => { release = r; });
  const running = queue.run([createJob(brief, canon, 'a')], { ...options(), save: async () => waiting });
  await assert.rejects(() => queue.run([], options()), /already running/); release(); await running;
});
test('server connection sends no browser API key and surfaces malformed provider responses', async () => {
  let sent;
  const result = await requestGeneration('https://example.com', { mode: 'text', prompt: 'story' }, { fetchImpl: async (url, init) => {
    sent = { url, init }; return { ok: true, json: async () => ({ text: 'story' }) };
  } });
  assert.equal(result, 'story'); assert.equal(sent.url, 'https://example.com/generate-story');
  assert.deepEqual(JSON.parse(sent.init.body), { mode: 'text', prompt: 'story' });
  await assert.rejects(() => requestGeneration('http://example.com', {}, {}), /HTTPS/);
  await assert.rejects(() => requestGeneration('https://example.com', { mode: 'image' }, { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /no image/);
});
