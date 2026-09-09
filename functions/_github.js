const OWNER = 'nightowlhoothoot83-create';
const REPOSITORIES = [
  { name: 'ascension-automation-hub', label: 'Management Hub', expectedBranch: 'main', visibility: 'private' },
  { name: 'Automations', label: 'Automation infrastructure', expectedBranch: 'codex/automation-6-infrastructure', visibility: 'public' },
  { name: 'ADG-MONITOR-V4', label: 'ADG Monitor', expectedBranch: 'main', visibility: 'public' },
  { name: 'Raven-Sharp-Image-Optimiser-Upscaler', label: 'Image Optimiser & Upscaler', expectedBranch: 'main', visibility: 'public' },
  { name: 'Raven-Sharp-POD-Automation', label: 'POD Suite', expectedBranch: 'main', visibility: 'public' },
  { name: 'Raven-Sharp-Content-Creator', label: 'Content Creator', expectedBranch: 'main', visibility: 'public' },
  { name: 'Raven-Sharp-Ad-Manager', label: 'Ad Manager', expectedBranch: 'main', visibility: 'public' },
  { name: 'Raven-Sharp-Book-Creator', label: 'Book Creator', expectedBranch: 'main', visibility: 'public' },
  { name: 'Raven-Sharp-Smart-AI-Cleaner', label: 'Smart Cleaner app', expectedBranch: 'main', visibility: 'public' },
  { name: 'Raven-Sharp-Smart-Cleaner-Web', label: 'Smart Cleaner web', expectedBranch: 'main', visibility: 'public' },
  { name: 'Raven-Sharp-Hub', label: 'Raven Sharp Hub', expectedBranch: 'main', visibility: 'public' },
  { name: 'Raven-Sharp-Store-Ops', label: 'Raven Sharp Store Ops', expectedBranch: 'main', visibility: 'public' },
  { name: 'Raven-Sharp-QA-Agent', label: 'Raven Sharp QA Agent', expectedBranch: 'main', visibility: 'public' },
  { name: 'Mycalctools', label: 'MyCalcTools', expectedBranch: 'main', visibility: 'public' },
  { name: 'Mycalendartools', label: 'MyCalendarTools', expectedBranch: 'main', visibility: 'public' },
  { name: 'Wheelnamepicker', label: 'Wheel Name Picker', expectedBranch: 'main', visibility: 'public' },
  { name: 'Mystical-Moments', label: 'Mystical Moments', expectedBranch: 'main', visibility: 'public' },
  { name: 'Natures-Sacred-Synergy', label: "Nature's Sacred Synergy", expectedBranch: 'main', visibility: 'public' },
  { name: 'Natures-Synergy-Services', label: "Nature's Synergy Services", expectedBranch: 'main', visibility: 'public' },
  { name: 'Ascension-Digital-Group', label: 'Ascension Digital Group', expectedBranch: 'main', visibility: 'public' },
  { name: 'OpenACM', label: 'OpenACM', expectedBranch: 'main', visibility: 'public' }
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
      const branchMatches = details.default_branch === repository.expectedBranch;
      return { ...base, defaultBranch: details.default_branch, branchMatches, updatedAt: details.updated_at, provenance: 'live', state: latest?.status === 'completed' ? latest.conclusion || 'unknown' : latest?.status || 'no-runs', latestWorkflow: latest ? { name: latest.name, status: latest.status, conclusion: latest.conclusion, event: latest.event, branch: latest.head_branch, createdAt: latest.created_at, url: latest.html_url } : null };
    } catch (error) {
      return { ...base, defaultBranch: repository.expectedBranch, branchMatches:null, updatedAt: null, provenance: 'degraded', state: 'unavailable', latestWorkflow: null, warning: repository.visibility === 'private' && !token ? 'Private repository is configured; live GitHub access requires a read-only token.' : error.message };
    }
  }));
}
