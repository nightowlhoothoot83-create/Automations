const operationsStyles = document.createElement('link'); operationsStyles.rel = 'stylesheet'; operationsStyles.href = 'operations.css'; document.head.append(operationsStyles);
let dashboard;
const $ = (selector) => document.querySelector(selector);
const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const label = (status) => status === 'passed' ? 'Passing' : status === 'failed' ? 'Failed' : status === 'warning' ? 'Warning' : 'Skipped';
const when = (date) => new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(date));
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 3200); }

function renderActions(data) {
  $('#approval-badge').textContent = data.overview.approvals;
  $('#next-approval').innerHTML = data.nextApproval ? `<h2>${esc(data.nextApproval.action)}</h2><p>${esc(data.nextApproval.reason)} · ${esc(data.nextApproval.risk)} risk · ${esc(data.nextApproval.provenance || 'live')} source</p><div class="action-buttons"><button class="primary" data-decision="approved" data-id="${esc(data.nextApproval.id)}">Record approval</button><button class="secondary" data-decision="deferred" data-id="${esc(data.nextApproval.id)}">Defer</button></div>` : '<h2>You’re all clear.</h2><p>No production actions are awaiting approval.</p>';
  $('#next-task').innerHTML = data.nextTask ? `<h2>${esc(data.nextTask.title)}</h2><p>${esc(data.nextTask.detail)}</p><div class="action-buttons"><button class="primary" id="review-task">Review evidence</button><button class="secondary">Assign repair</button></div>` : '<h2>No urgent tasks.</h2><p>All monitored systems are currently clear.</p>';
}
function render(data) {
  dashboard = data; renderActions(data);
  if (data.mode !== 'live') { $('#mode-banner').hidden = false; $('#mode-banner').innerHTML = `<b>${data.mode === 'mixed' ? 'Mixed-source mode' : 'Demonstration mode'}:</b> ${data.mode === 'mixed' ? 'Automation evidence is live, but fixture adapters are visibly labelled.' : 'No Automation 6 run artifact was found. All operational examples are fixture data.'}${data.sourceWarnings.length ? ` · ${esc(data.sourceWarnings.join('; '))}` : ''}`; }
  const metrics = [['Passed',data.overview.passed,''],['Warnings',data.overview.warning,'warning'],['Failed',data.overview.failed,'danger'],['Skipped',data.overview.skipped,''],['Needs attention',data.overview.attention,'warning'],['Approvals',data.overview.approvals,'']];
  $('#metrics').innerHTML = metrics.map(([name,value,state]) => `<article class="metric ${state}"><b>${value}</b><span>${name}</span></article>`).join('');
  $('#business-list').innerHTML = data.businesses.map((item) => `<div class="business-row ${item.status}"><div class="business-icon">${esc(item.name.slice(0,2).toUpperCase())}</div><div class="row-main"><b>${esc(item.name)}</b><small>${esc(item.type)} · ${item.projects} project${item.projects === 1 ? '' : 's'}</small></div><span class="status-dot" title="${esc(item.status)}"></span></div>`).join('');
  const run = data.runs[0], total = Object.values(run.summary).reduce((a,b)=>a+b,0), score = Math.round(((run.summary.passed + run.summary.skipped) / Math.max(total,1))*100);
  $('#run-status').className = `status-chip ${run.status}`; $('#run-status').textContent = run.status;
  $('#run-summary').innerHTML = `<div class="run-score"><div class="donut" style="--value:${score}" data-label="${score}%"></div><div class="run-bars">${Object.entries(run.summary).map(([key,value]) => `<div class="bar-row"><span>${esc(key)}</span><div class="bar"><i style="width:${value/Math.max(total,1)*100}%"></i></div><b>${value}</b></div>`).join('')}</div></div><p class="muted">${esc(run.automation)} · completed ${when(run.finishedAt)}</p>`;
  renderActivity('all');
  $('#module-grid').innerHTML = data.modules.map((item) => `<article class="module"><b>${esc(item.label)}</b><strong>${item.count}</strong><small>${esc(item.state)}</small></article>`).join('');
  $('#repair-list').innerHTML = data.queues.repairs.map((item) => `<div class="queue-row"><div class="row-main"><b>${esc(item.title)}</b><small>${esc(item.status)} · ${esc(item.priority)} priority</small>${item.branch ? `<code>${esc(item.branch)}</code>` : ''}</div>${item.tests ? `<span class="proof">${item.tests.passed} tests ✓</span>` : '<span class="source-pill">SUGGESTED</span>'}</div>`).join('') || '<p class="muted">No repair metadata configured.</p>';
  $('#content-list').innerHTML = data.queues.content.map((item) => `<div class="queue-row"><div class="row-main"><b>${esc(item.title)}</b><small>${esc(item.channel)} · ${esc(item.status)}</small></div><span class="source-pill">${esc(item.provenance)}</span></div>`).join('') || '<p class="muted">No content source configured.</p>';
  const finance = data.financeSummary, money = (value) => new Intl.NumberFormat('en-AU',{style:'currency',currency:finance.currency,maximumFractionDigits:0}).format(value);
  $('#finance-summary').innerHTML = `<div class="finance-number"><span>Estimated net</span><strong>${money(finance.net)}</strong></div><div class="finance-split"><span>Income <b>${money(finance.income)}</b></span><span>Expenses <b>${money(finance.expenses)}</b></span></div>${finance.needsReconciliation ? `<p class="attention-line">${finance.needsReconciliation} tax record needs reconciliation</p>` : ''}`;
  $('#asset-list').innerHTML = data.queues.assets.map((item) => `<div class="queue-row"><div class="preview-tile">${item.type === 'screenshot' ? '▣' : '◇'}</div><div class="row-main"><b>${esc(item.title)}</b><small>${esc(item.business)} · ${esc(item.status)}</small></div><span class="source-pill">${esc(item.provenance)}</span></div>`).join('') || '<p class="muted">No asset source configured.</p>';
  const sourceHeaders = document.querySelectorAll('.operations-grid .panel-head .source-pill');
  [data.queues.repairs[0]?.provenance, data.queues.content[0]?.provenance, finance.provenance, data.queues.assets[0]?.provenance].forEach((mode,index) => { sourceHeaders[index].textContent = `${mode || 'unconfigured'}${index === 2 ? ' · estimates' : ' adapter'}`.toUpperCase(); });
  $('#updated').textContent = `Updated ${when(data.generatedAt)} · ${data.source}`;
}
function renderActivity(filter) {
  const items = dashboard.activity.filter((item) => filter === 'all' || item.status === filter);
  $('#activity-list').innerHTML = items.map((item) => `<div class="activity-row ${item.status}"><span class="status-dot"></span><div class="activity-icon">${item.kind === 'health' ? '♥' : item.kind === 'seo' ? 'S' : item.kind === 'links' ? '↗' : '✓'}</div><div class="row-main"><b>${esc(item.title)}</b><small>${esc(item.kind)} · ${item.durationMs} ms</small></div><code class="evidence">${esc(JSON.stringify(item.evidence))}</code><time>${when(item.at)}</time></div>`).join('') || '<p class="muted">No activity matches this filter.</p>';
}
async function load() { const response = await fetch('/api/dashboard'); if (!response.ok) throw new Error('Dashboard could not be loaded'); render(await response.json()); }
document.addEventListener('click', async (event) => {
  const filter = event.target.closest('[data-filter]'); if (filter) { document.querySelectorAll('.filter').forEach((button)=>button.classList.remove('active')); filter.classList.add('active'); return renderActivity(filter.dataset.filter); }
  const decision = event.target.closest('[data-decision]'); if (decision) { const response = await fetch('/api/decisions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:decision.dataset.id,decision:decision.dataset.decision})}); const result=await response.json(); toast(result.note || result.error); return load(); }
  if (event.target.closest('#review-task')) document.querySelector('#activity').scrollIntoView();
  if (event.target.closest('#refresh')) { await load(); toast('Dashboard refreshed from local evidence.'); }
});
load().catch((error) => { $('#mode-banner').hidden=false; $('#mode-banner').textContent=error.message; });
