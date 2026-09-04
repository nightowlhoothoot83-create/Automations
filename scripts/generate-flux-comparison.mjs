import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fal } from '@fal-ai/client';
import { buildPodArtworkPrompt, selectPodArtworkModel } from '../src/pod-art-direction.mjs';

const root = process.cwd();
const envText = await readFile(path.join(root, '.env.local'), 'utf8');
const key = envText.match(/^FAL_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error('FAL_KEY is missing from .env.local');

const rawPrompt = process.env.COMPARISON_PROMPT || 'A print-on-demand T-shirt graphic of a fierce Australian wedge-tailed eagle in bold vintage screen-print style';
const prompt = buildPodArtworkPrompt(rawPrompt, { product: process.env.COMPARISON_PRODUCT || 'T-shirt graphic' });
const outputBaseName = process.env.COMPARISON_OUTPUT || 'flux-pro-v1-1';
const endpointId = selectPodArtworkModel({ stage: process.env.COMPARISON_STAGE || 'final-artwork', requestedEndpoint: process.env.COMPARISON_ENDPOINT });
fal.config({ credentials: key });
const startedAt = Date.now();
const input = endpointId.includes('flux-pro/')
  ? { prompt, image_size: 'square_hd', num_images: 1, output_format: 'png', enhance_prompt: false }
  : { prompt, image_size: 'square_hd', num_images: 1 };
const result = await fal.subscribe(endpointId, {
  input,
  logs: false,
});
const image = result.data?.images?.[0];
if (!image?.url) throw new Error('FLUX returned no image URL');

const outputDir = path.join(root, 'artifacts', 'pod-provider-comparison');
await mkdir(outputDir, { recursive: true });
const response = await fetch(image.url);
if (!response.ok) throw new Error(`Unable to download FLUX output (${response.status})`);
const contentType = response.headers.get('content-type') || image.content_type || 'image/jpeg';
const extension = contentType.includes('png') ? 'png' : 'jpg';
const outputPath = path.join(outputDir, `${outputBaseName}.${extension}`);
await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
await writeFile(path.join(outputDir, `${outputBaseName}-result.json`), JSON.stringify({
  schemaVersion: '1.0.0',
  provider: 'fal.ai',
  model: endpointId.includes('flux-pro/v1.1') ? 'FLUX 1.1 Pro' : 'FLUX.1 Schnell',
  rawPrompt,
  endpointId,
  prompt,
  width: image.width ?? null,
  height: image.height ?? null,
  contentType,
  latencyMs: Date.now() - startedAt,
  outputFile: path.relative(root, outputPath).replaceAll('\\', '/'),
  generatedAt: new Date().toISOString(),
  approvalStatus: 'pending-owner-review',
}, null, 2));

console.log(JSON.stringify({ ok: true, outputPath, width: image.width, height: image.height, contentType }));
