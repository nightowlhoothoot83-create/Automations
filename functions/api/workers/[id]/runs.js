import { workerSnapshots } from '../../../_generated.js';
import { json } from '../../../_lib.js';

export function onRequestGet({ params }) {
  const result = workerSnapshots[params.id];
  return result ? json(result) : json({ error: 'Unknown worker' }, 404);
}
