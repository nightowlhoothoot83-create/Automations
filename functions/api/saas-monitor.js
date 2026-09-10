import { loadSaasReport } from '../_saas-monitor.js';
import { failure, json } from '../_lib.js';

export async function onRequestGet() {
  try { return json(await loadSaasReport()); }
  catch (error) { return failure(error); }
}
