import { spawn } from 'node:child_process';
import { mkdir, writeFile, appendFile, readFile, rename } from 'node:fs/promises';
import path from 'node:path';

export const REPORT_SCHEMA_VERSION = '1.0.0';

export function validateConfig(config) {
  if (config?.schemaVersion !== REPORT_SCHEMA_VERSION) throw new Error(`Unsupported config schemaVersion: ${config?.schemaVersion ?? 'missing'}`);
  if (!Array.isArray(config.targets) || !Array.isArray(config.commands)) throw new Error('Config requires targets and commands arrays');
  const ids = new Set();
  for (const target of config.targets) {
    if (!target.id || ids.has(target.id)) throw new Error(`Target id is missing or duplicated: ${target.id ?? 'missing'}`);
    ids.add(target.id);
    const url = new URL(target.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Target ${target.id} must use HTTP(S)`);
  }
  for (const command of config.commands) {
    if (!command.id || !command.executable || !Array.isArray(command.args)) throw new Error('Commands require id, executable, and args');
    if (command.shell === true) throw new Error(`Command ${command.id} cannot enable a shell`);
  }
  return config;
}

export async function fetchBounded(url, { timeoutMs, maxBodyBytes }) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'Automation6-Monitor/1.0' } });
  const reader = response.body?.getReader();
  const chunks = []; let size = 0;
  while (reader) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > maxBodyBytes) { await reader.cancel(); throw new Error(`Response exceeds ${maxBodyBytes} bytes`); }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks.map((v) => Buffer.from(v))).toString('utf8');
  return { response, body };
}

function findLinks(html, base) {
  const links = new Set();
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    try { const url = new URL(match[1], base); if (['http:', 'https:'].includes(url.protocol)) links.add(url.href); } catch {}
  }
  return [...links];
}

export async function checkTarget(target, defaults = {}) {
  const startedAt = new Date().toISOString(); const start = performance.now();
  try {
    const { response, body } = await fetchBounded(target.url, { timeoutMs: defaults.timeoutMs ?? 10000, maxBodyBytes: defaults.maxBodyBytes ?? 1000000 });
    const evidence = { url: target.url, finalUrl: response.url, statusCode: response.status, contentType: response.headers.get('content-type') };
    const results = [];
    if (target.checks.includes('health')) results.push(result(target.id, 'health', response.ok ? 'passed' : 'failed', startedAt, start, evidence));
    if (target.checks.includes('seo')) {
      const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
      const descriptionTag = body.match(/<meta\b[^>]*\bname=["']description["'][^>]*>/i)?.[0];
      const canonicalTag = body.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0];
      const description = attribute(descriptionTag, 'content')?.trim();
      const canonical = attribute(canonicalTag, 'href');
      const missing = [!title && 'title', !description && 'meta description', !canonical && 'canonical'].filter(Boolean);
      results.push(result(target.id, 'seo', missing.length ? 'warning' : 'passed', startedAt, start, { ...evidence, title, description, canonical, missing }));
    }
    if (target.checks.includes('links')) {
      const links = findLinks(body, response.url); const broken = [];
      for (const link of links.slice(0, 50)) {
        try { const r = await fetch(link, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(defaults.timeoutMs ?? 10000) }); if (!r.ok) broken.push({ url: link, statusCode: r.status }); }
        catch (error) { broken.push({ url: link, error: error.message }); }
      }
      results.push(result(target.id, 'links', broken.length ? 'warning' : 'passed', startedAt, start, { checked: Math.min(links.length, 50), discovered: links.length, broken, capped: links.length > 50 }));
    }
    return results;
  } catch (error) { return [result(target.id, 'health', 'failed', startedAt, start, { url: target.url, error: error.message })]; }
}

function result(id, kind, status, startedAt, start, evidence) { return { id, kind, status, startedAt, durationMs: Math.round(performance.now() - start), evidence }; }

function attribute(tag, name) { return tag?.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]; }

export function runCommand(command, cwd) {
  const startedAt = new Date().toISOString(); const start = performance.now();
  return new Promise((resolve) => {
    const child = spawn(command.executable, command.args, { cwd, shell: false, env: { ...process.env, CI: 'true' }, windowsHide: true });
    let stdout = '', stderr = ''; const cap = 200000;
    child.stdout.on('data', (d) => { stdout = (stdout + d).slice(-cap); }); child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-cap); });
    const timer = setTimeout(() => child.kill(), command.timeoutMs ?? 300000);
    child.on('error', (error) => { clearTimeout(timer); resolve(result(command.id, command.kind ?? 'regression', 'failed', startedAt, start, { error: error.message })); });
    child.on('close', (code, signal) => { clearTimeout(timer); resolve(result(command.id, command.kind ?? 'regression', code === 0 ? 'passed' : 'failed', startedAt, start, { exitCode: code, signal, stdout, stderr })); });
  });
}

export async function writeRun(outputRoot, report, screenshotRequests = []) {
  const dir = path.join(outputRoot, report.runId); await mkdir(dir, { recursive: true });
  for (const item of report.results) await appendFile(path.join(dir, 'events.jsonl'), `${JSON.stringify({ schemaVersion: REPORT_SCHEMA_VERSION, runId: report.runId, ...item })}\n`);
  await writeFile(path.join(dir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (screenshotRequests.length) await writeFile(path.join(dir, 'screenshot-requests.json'), `${JSON.stringify(screenshotRequests, null, 2)}\n`);
  return dir;
}

export async function updateHubIndex(hubRoot, report, reportPath, maxRuns = 100) {
  await mkdir(hubRoot, { recursive: true });
  const indexPath = path.join(hubRoot, 'runs-v1.json');
  let previous = { schemaVersion: REPORT_SCHEMA_VERSION, updatedAt: report.finishedAt, runs: [] };
  try { previous = JSON.parse(await readFile(indexPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const entry = { runId: report.runId, status: report.status, startedAt: report.startedAt, finishedAt: report.finishedAt, summary: report.summary, reportPath };
  const runs = [entry, ...previous.runs.filter((item) => item.runId !== report.runId)].slice(0, maxRuns);
  const next = { schemaVersion: REPORT_SCHEMA_VERSION, updatedAt: report.finishedAt, latestRunId: report.runId, runs };
  const temporary = `${indexPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`); await rename(temporary, indexPath);
  return indexPath;
}
