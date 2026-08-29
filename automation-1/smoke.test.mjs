import assert from "node:assert/strict";
import test from "node:test";
import { checkTarget, containsExpectedJson } from "./smoke.mjs";

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
