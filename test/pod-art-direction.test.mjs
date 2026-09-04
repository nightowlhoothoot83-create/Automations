import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPodArtworkPrompt, selectPodArtworkModel, podQualityGate } from '../src/pod-art-direction.mjs';

test('psychedelic POD briefs receive specific maximalist art direction and anti-clip-art constraints', () => {
  const prompt = buildPodArtworkPrompt('A fun funky trending psychedelic owl image');
  assert.match(prompt, /liquid optical patterns/);
  assert.match(prompt, /dense hand-drawn ornamental detail/);
  assert.match(prompt, /generic app icon/);
  assert.match(prompt, /flat clip-art mascot/);
  assert.match(prompt, /isolated artwork/);
});

test('final art defaults to Pro while Schnell is limited to drafts', () => {
  assert.equal(selectPodArtworkModel(), 'fal-ai/flux-pro/v1.1');
  assert.equal(selectPodArtworkModel({ stage: 'draft' }), 'fal-ai/flux-1/schnell');
});

test('quality gate rejects generic or style-missing output', () => {
  const gate = podQualityGate();
  assert.equal(gate.minimumOverallScore, 80);
  assert.ok(gate.automaticFailure.includes('generic-clip-art'));
  assert.ok(gate.automaticFailure.includes('missing-requested-style'));
});
