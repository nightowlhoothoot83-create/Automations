import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

export function containsExpectedJson(actual, expected) {
  return Object.entries(expected).every(([key, value]) => actual?.[key] === value);
}

export async function checkTarget(target, fetchImpl = fetch) {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  try {
    const response = await fetchImpl(target.url, {
      headers: { "user-agent": "RavenSharp-Automation-1/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000)
    });
    const body = await response.text();
    let assertion = response.status === target.expectStatus;
    const notes = [];
    const contentType = response.headers.get("content-type") || "";
    if (response.status !== target.expectStatus) notes.push(`expected HTTP ${target.expectStatus}, received ${response.status}`);
    if (target.expectContentType && !contentType.toLowerCase().includes(target.expectContentType.toLowerCase())) {
      assertion = false;
      notes.push(`expected content-type containing ${target.expectContentType}, received ${contentType || "none"}`);
    }
    if (target.expectText && !body.includes(target.expectText)) {
      assertion = false;
      notes.push(`response did not contain required marker: ${target.expectText}`);
    }
    if (target.expectJson) {
      try {
        const parsed = JSON.parse(body);
        if (!containsExpectedJson(parsed, target.expectJson)) {
          assertion = false;
          notes.push("JSON health contract did not match");
        }
      } catch {
        assertion = false;
        notes.push("response was not valid JSON");
      }
    }
    return {
      id: target.id,
      url: target.url,
      outcome: assertion ? "pass" : "fail",
      status: response.status,
      contentType,
      durationMs: Math.round(performance.now() - started),
      startedAt,
      notes
    };
  } catch (error) {
    return { id: target.id, url: target.url, outcome: "fail", durationMs: Math.round(performance.now() - started), startedAt, notes: [String(error)] };
  }
}

async function main() {
  const configPath = resolve(process.argv[2] || "automation-1/targets.json");
  const outputPath = resolve(process.argv[3] || "artifacts/automation-1/smoke.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const checks = await Promise.all(config.targets.map(target => checkTarget(target)));
  const report = {
    schemaVersion: 1,
    automation: "raven-sharp-saas-autonomous-qa-repair",
    generatedAt: new Date().toISOString(),
    readOnly: true,
    summary: {
      pass: checks.filter(check => check.outcome === "pass").length,
      fail: checks.filter(check => check.outcome === "fail").length
    },
    checks
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary));
  process.exitCode = report.summary.fail ? 1 : 0;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${resolve(process.argv[1]).replaceAll("\\", "/")}`).href) await main();
