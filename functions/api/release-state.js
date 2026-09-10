import { failure, json } from '../_lib.js';
import { releaseState } from '../_release-control.js';

export async function onRequestGet({ env }) {
  try { return json(await releaseState(env)); }
  catch (error) { return failure(error); }
}
