import { repositoryStatus } from '../_github.js';
import { failure, json } from '../_lib.js';

export async function onRequestGet({ env }) {
  try {
    const repositories = await repositoryStatus(env.GITHUB_READ_TOKEN);
    return json({ generatedAt: new Date().toISOString(), repositories });
  } catch (error) { return failure(error); }
}

