import { failure, json, jsonBody, requireDb } from '../_lib.js';
import { requireScheduler } from '../_owner-auth.js';
import { upsertReleaseEvidence } from '../_release-control.js';

export async function onRequestPost({ request, env }) {
  try {
    requireScheduler(request, env);
    const input = await jsonBody(request, 64_000);
    return json(await upsertReleaseEvidence(requireDb(env), input));
  } catch (error) { return failure(error); }
}
