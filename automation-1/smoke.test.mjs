import assert from "node:assert/strict";
import test from "node:test";
import { buildAutomation6Report, checkTarget, containsExpectedJson } from "./smoke.mjs";

test("containsExpectedJson only requires declared health fields", () => {
  assert.equal(containsExpectedJson({ status: "ok", extra: true }, { status: "ok" }), true);
  assert.equal(containsExpectedJson({ status: "down" }, { status: "ok" }), false);
});

test("checkTarget treats an expected auth rejection as a pass", async () => {
  const result = await checkTarget(
    { id: "auth", url: "https://example.invalid/auth/me", expectStatus: 401, expectText: "Not authenticated" },
    async () => new Response('{"detail":"Not authenticated"}', { status: 401 })
  );
  assert.equal(result.outcome, "pass");
  assert.equal(result.status, 401);
});

test("checkTarget fails a misleading HTML fallback for a JSON health endpoint", async () => {
  const result = await checkTarget(
    { id: "health", url: "https://example.invalid/health", expectStatus: 200, expectJson: { status: "ok" } },
    async () => new Response("<html>SPA shell</html>", { status: 200 })
  );
  assert.equal(result.outcome, "fail");
  assert.match(result.notes.join(" "), /valid JSON/);
});

test("checkTarget enforces the declared response content type", async () => {
  const result = await checkTarget(
    { id: "api", url: "https://example.invalid/api", expectStatus: 200, expectContentType: "application/json" },
    async () => new Response("<html>fallback</html>", { status: 200, headers: { "content-type": "text/html" } })
  );
  assert.equal(result.outcome, "fail");
  assert.equal(result.contentType, "text/html");
  assert.match(result.notes.join(" "), /expected content-type/);
});

test("Automation 6 report adapter preserves failures and marks gated coverage", () => {
  const startedAt = "2026-08-30T00:00:00.000Z";
  const report = buildAutomation6Report([
    { id: "hub", url: "https://example.invalid", outcome: "fail", status: 503, contentType: "text/html", durationMs: 5, startedAt, notes: ["unavailable"] }
  ], startedAt, "2026-08-30T00:00:01.000Z", "artifacts/automation-1/smoke.json");

  assert.equal(report.schemaVersion, "1.0.0");
  assert.equal(report.status, "failed");
  assert.deepEqual(report.summary, { passed: 0, warning: 1, failed: 1, skipped: 0 });
  assert.equal(report.reviewPackage.knownFailures, 1);
  assert.equal(report.reviewPackage.provenance, "live-read-only");
  assert.equal(report.reviewPackage.evidenceRefs[0].url, "/#worker-evidence");
  assert.equal(report.results.at(-1).id, "credentialed-workflow-coverage");
});
