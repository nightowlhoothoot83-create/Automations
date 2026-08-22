import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fal } from '@fal-ai/client';

const root = process.cwd();
const envText = await readFile(path.join(root, '.env.local'), 'utf8');
const key = envText.match(/^FAL_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error('FAL_KEY is missing from .env.local');

const prompt = 'A print-on-demand T-shirt graphic of a fierce Australian wedge-tailed eagle in bold vintage screen-print style, centered symmetrical composition, limited palette of charcoal black, warm ochre and cream, crisp clean edges, strong silhouette, no mockup, no garment, no border, no watermark, no text, isolated artwork on a plain white background';
fal.config({ credentials: key });
const startedAt = Date.now();
const result = await fal.subscribe('fal-ai/flux-1/schnell', {
  input: { prompt, image_size: 'square_hd', num_images: 1 },
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
const outputPath = path.join(outputDir, `flux-schnell.${extension}`);
await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
await writeFile(path.join(outputDir, 'flux-result.json'), JSON.stringify({
  schemaVersion: '1.0.0',
  provider: 'fal.ai',
  model: 'FLUX.1 Schnell',
  endpointId: 'fal-ai/flux-1/schnell',
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
