const OWNER = 'nightowlhoothoot83-create';
const REPOSITORIES = [
  { name: 'ascension-automation-hub', label: 'Management Hub', expectedBranch: 'main', visibility: 'private' },
  { name: 'Automations', label: 'Automation infrastructure', expectedBranch: 'codex/automation-6-infrastructure', visibility: 'public' },
  { name: 'ADG-MONITOR-V4', label: 'ADG SaaS monitor', expectedBranch: 'main', visibility: 'public' }
];

async function github(path, token, fetcher) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Ascension-Management-Hub/1.0', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetcher(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
  return response.json();
}

export async function repositoryStatus(token, fetcher = fetch) {
  return Promise.all(REPOSITORIES.map(async (repository) => {
    const base = { id: repository.name.toLowerCase(), name: repository.name, label: repository.label, url: `https://github.com/${OWNER}/${repository.name}`, expectedBranch: repository.expectedBranch, visibility: repository.visibility };
    try {
      const [details, runs] = await Promise.all([
        github(`/repos/${OWNER}/${repository.name}`, token, fetcher),
        github(`/repos/${OWNER}/${repository.name}/actions/runs?per_page=1`, token, fetcher)
      ]);
      const latest = runs.workflow_runs?.[0] || null;
      return { ...base, defaultBranch: details.default_branch, updatedAt: details.updated_at, provenance: 'live', state: latest?.status === 'completed' ? latest.conclusion || 'unknown' : latest?.status || 'no-runs', latestWorkflow: latest ? { name: latest.name, status: latest.status, conclusion: latest.conclusion, event: latest.event, branch: latest.head_branch, createdAt: latest.created_at, url: latest.html_url } : null };
    } catch (error) {
      return { ...base, defaultBranch: repository.expectedBranch, updatedAt: null, provenance: 'degraded', state: 'unavailable', latestWorkflow: null, warning: repository.visibility === 'private' && !token ? 'Private repository is configured; live GitHub access requires a read-only token.' : error.message };
    }
  }));
}

