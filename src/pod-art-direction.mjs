const STYLE_SIGNALS = {
  psychedelic: {
    include: [
      'layered 1960s/1970s psychedelic poster energy',
      'warped concentric contours and liquid optical patterns',
      'dense hand-drawn ornamental detail',
      'electric high-contrast colour relationships',
      'playful surreal personality and rhythmic visual movement'
    ],
    avoid: ['generic app icon', 'flat clip-art mascot', 'minimal corporate logo', 'empty white body', 'simple black silhouette']
  },
  funky: {
    include: ['irreverent character expression', 'unexpected asymmetrical accents', 'bold retro-futurist shapes'],
    avoid: ['sterile symmetry', 'default emoji styling']
  },
  trending: {
    include: ['contemporary maximalist apparel-graphic finish', 'editorial colour confidence', 'distinctive thumbnail silhouette'],
    avoid: ['generic AI aesthetic', 'copied brand language', 'protected characters']
  }
};

export function buildPodArtworkPrompt(userPrompt, options = {}) {
  if (typeof userPrompt !== 'string' || userPrompt.trim().length < 8) throw new Error('A meaningful artwork prompt is required');
  const normalized = userPrompt.trim();
  const lower = normalized.toLowerCase();
  const matched = Object.entries(STYLE_SIGNALS).filter(([term]) => lower.includes(term));
  const include = [...new Set(matched.flatMap(([, rule]) => rule.include))];
  const avoid = [...new Set(matched.flatMap(([, rule]) => rule.avoid))];
  const product = options.product || 'print-on-demand apparel graphic';

  return [
    `Create original ${product} artwork.`,
    `Creative brief: ${normalized}.`,
    include.length ? `Art direction: ${include.join('; ')}.` : 'Art direction: polished, distinctive, authored illustration with deliberate shape language, depth and tactile detail.',
    'Composition: one dominant subject, strong readable silhouette, full and intentional use of the square canvas, balanced detail from thumbnail distance through close inspection.',
    'Production finish: professional merchandise illustration, crisp intentional edges, controlled micro-detail, coherent palette, no accidental tangencies or unfinished areas.',
    'Output only the isolated artwork—not a garment, room, framed print, UI tile or product mockup. No border, caption, watermark or logo unless explicitly requested.',
    `Avoid: ${[...avoid, 'placeholder geometry', 'large blank areas', 'blurry detail', 'muddy colours', 'stock-vector look', 'generic clip art'].join('; ')}.`
  ].join('\n');
}

export function selectPodArtworkModel({ stage = 'final-artwork', requestedEndpoint } = {}) {
  if (requestedEndpoint) return requestedEndpoint;
  return stage === 'draft' ? 'fal-ai/flux-1/schnell' : 'fal-ai/flux-pro/v1.1';
}

export function podQualityGate() {
  return {
    minimumOverallScore: 80,
    required: ['prompt-adherence', 'style-specificity', 'subject-readability', 'composition', 'colour-harmony', 'detail-quality', 'originality', 'print-readiness'],
    automaticFailure: ['generic-clip-art', 'generic-app-icon', 'large-unintended-blank-area', 'missing-requested-style', 'visible-generation-artifact', 'watermark-or-unrequested-text'],
    actionOnFailure: 'reject-and-regenerate-with-targeted-correction'
  };
}
