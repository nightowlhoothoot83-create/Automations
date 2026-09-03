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

export function buildAutomation6Report(checks, runStartedAt, finishedAt, evidencePath) {
  const results = checks.map(check => ({
    id: check.id,
    kind: check.id.endsWith("auth-gate") ? "auth-boundary" : "http-smoke",
    status: check.outcome === "pass" ? "passed" : "failed",
    startedAt: check.startedAt,
    durationMs: check.durationMs,
    evidence: {
      url: check.url,
      httpStatus: check.status ?? null,
      contentType: check.contentType ?? null,
      notes: check.notes
    }
  }));
  results.push({
    id: "credentialed-workflow-coverage",
    kind: "coverage",
    status: "warning",
    startedAt: runStartedAt,
    durationMs: 0,
    evidence: {
      reason: "Credential-free run cannot prove owner access, paid/provider operations, generation, persistence, exports, or downloads.",
      gated: true
    }
  });
  const failed = results.filter(result => result.status === "failed").length;
  const warning = results.filter(result => result.status === "warning").length;
  return {
    schemaVersion: "1.0.0",
    runId: `automation-1-${runStartedAt.replaceAll(":", "-")}`,
    startedAt: runStartedAt,
    finishedAt,
    status: failed ? "failed" : warning ? "warning" : "passed",
    summary: {
      passed: results.filter(result => result.status === "passed").length,
      warning,
      failed,
      skipped: results.filter(result => result.status === "skipped").length
    },
    results,
    approvals: [],
    reviewPackage: {
      capturedAt: finishedAt,
      evidenceStatus: failed ? "failed" : warning ? "warning" : "passed",
      knownFailures: failed,
      evidenceRefs: [{ label: "Automation 1 credential-free smoke evidence", url: evidencePath.replaceAll("\\", "/") }],
      provenance: "live-read-only",
      approvalRequested: false
    }
  };
}

async function main() {
  const configPath = resolve(process.argv[2] || "automation-1/targets.json");
  const outputPath = resolve(process.argv[3] || "artifacts/automation-1/smoke.json");
  const reportPath = resolve(process.argv[4] || "artifacts/automation-1/report-v1.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const runStartedAt = new Date().toISOString();
  const checks = await Promise.all(config.targets.map(target => checkTarget(target)));
  const finishedAt = new Date().toISOString();
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
  const automation6Report = buildAutomation6Report(checks, runStartedAt, finishedAt, outputPath);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(automation6Report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary));
  process.exitCode = report.summary.fail ? 1 : 0;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${resolve(process.argv[1]).replaceAll("\\", "/")}`).href) await main();
