export function validateBrief(brief, canon) {
  if (!brief?.theme?.trim()) throw new Error('Choose a story theme.');
  if (!brief.format || ![30, 60, 90, 120].includes(Number(brief.format.dur))) throw new Error('Choose a supported video format.');
  if (!Array.isArray(brief.chars) || brief.chars.length < 1 || brief.chars.length > 3 || new Set(brief.chars).size !== brief.chars.length || brief.chars.some(id => !canon[id])) throw new Error('Choose one to three Spew Crew characters.');
}

export function parseStoryboard(text, allowed) {
  let story;
  try { story = JSON.parse(text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')); }
  catch { throw new Error('The story response was not valid JSON.'); }
  if (!story?.title?.trim() || typeof story.voiceoverScript !== 'string' || !Array.isArray(story.frames) || story.frames.length < 1 || story.frames.length > 8) throw new Error('The story needs a title, narration, and one to eight scenes.');
  for (const frame of story.frames) {
    if (typeof frame.scene !== 'string' || !frame.scene.trim() || typeof frame.voiceover !== 'string') throw new Error('Every scene needs a description and narration.');
    if (!Array.isArray(frame.characters) || !frame.characters.length || frame.characters.some(id => !allowed.includes(id))) throw new Error('The story used an unselected character.');
  }
  return story;
}

export async function requestGeneration(workerUrl, body, { fetchImpl = fetch, signal } = {}) {
  const url = new URL(workerUrl);
  if (url.protocol !== 'https:') throw new Error('The generation connection must use HTTPS.');
  const response = await fetchImpl(url.href.replace(/\/$/, '') + (body.mode === 'text' ? '/generate-story' : '/generate-image'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('The generation service returned an unreadable response.'); }
  if (!response.ok) throw new Error(data.error || `Generation failed (${response.status}).`);
  const value = body.mode === 'text' ? data.text : data.imageB64;
  if (typeof value !== 'string' || !value) throw new Error(`The generation service returned no ${body.mode === 'text' ? 'story' : 'image'}.`);
  if (body.mode === 'image' && !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('The generation service returned invalid image data.');
  return value;
}

export function createJob(brief, canon, id = crypto.randomUUID()) {
  validateBrief(brief, canon);
  return { id, brief: structuredClone(brief), title: brief.theme, theme: brief.theme, format: brief.format.name,
    chars: [...brief.chars], schedDate: brief.date, schedTime: brief.time, platforms: brief.platforms || [],
    status: 'pending', created: new Date().toLocaleDateString('en-AU'), createdAt: new Date().toISOString(), completedScenes: 0 };
}

export async function processJob(job, { textPrompt, imagePrompt, generate, save, references = {}, signal, onProgress = () => {} }) {
  if (job.status === 'package-ready') return job;
  const cancelled = () => { if (signal?.aborted) throw new DOMException('Stopped by owner.', 'AbortError'); };
  try {
    cancelled(); job.status = 'generating'; delete job.error; await save(job);
    if (!job.script) {
      onProgress('Writing story and storyboard');
      const text = await generate({ mode: 'text', prompt: textPrompt(job.brief) }, signal);
      job.script = parseStoryboard(text, job.chars); job.title = job.script.title;
      await save(job);
    }
    for (const [index, frame] of job.script.frames.entries()) {
      cancelled();
      if (!frame.imageB64) {
        onProgress(`Illustrating scene ${index + 1} of ${job.script.frames.length}`);
        frame.imageB64 = await generate({ mode: 'image', prompt: imagePrompt(frame, job.brief),
          references: frame.characters.flatMap(id => references[id] ? [references[id]] : []) }, signal);
        if (!frame.imageB64) throw new Error(`Scene ${index + 1} has no image.`);
      }
      job.completedScenes = index + 1; await save(job);
    }
    cancelled(); job.coverB64 = job.script.frames[0].imageB64; job.status = 'package-ready';
    await save(job); return job;
  } catch (error) {
    job.status = error.name === 'AbortError' ? 'stopped' : 'failed'; job.error = error.message;
    await save(job); return job;
  }
}

export class JobQueue {
  running = false;
  async run(jobs, options) {
    if (this.running) throw new Error('The queue is already running.');
    this.running = true;
    try {
      const snapshot = jobs.filter(job => job.status === 'pending');
      for (const job of snapshot) { if (options.signal?.aborted) break; await processJob(job, options); }
      return snapshot;
    } finally { this.running = false; }
  }
}

export async function openStore(indexedDBImpl = indexedDB) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDBImpl.open('spewcrew-production', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const transaction = (mode, action) => new Promise((resolve, reject) => {
    const tx = db.transaction('records', mode); const request = action(tx.objectStore('records'));
    tx.oncomplete = () => resolve(request.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Storage transaction failed.'));
  });
  return { put: value => transaction('readwrite', s => s.put(value)), get: id => transaction('readonly', s => s.get(id)), all: () => transaction('readonly', s => s.getAll()) };
}
