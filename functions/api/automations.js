import { failure, json } from '../_lib.js';
import { listAutomationState } from '../_automation-control.js';

export async function onRequestGet({ env }) {
  try {
    return json(await listAutomationState(env));
  } catch (error) { return failure(error); }
}
