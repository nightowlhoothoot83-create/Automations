const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const GROUPS={
  'site-adsense':'Site & AdSense Health',
  saas:'SaaS Health & Repair',
  'store-listings':'Store & Listings',
  'marketing-assets':'Marketing & Assets',
  'automation-health':'System & Automation Health'
};
let controlState;
let releaseStateCache;

function toastOwner(message){const t=q('#toast');if(!t)return;t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3200);}
function scrollToId(id){const el=q(id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}
function firstHref(selector){const el=q(selector);return el?.href||el?.getAttribute?.('href')||null;}
function esc(value=''){return String(value).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function friendlyTime(value){if(!value)return 'Not recorded';try{return new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(value));}catch{return 'Not recorded';}}
function stateLabel(value='unknown'){return String(value).replaceAll('_',' ').replaceAll('-',' ');}
function stateClass(value=''){return /success|passed|completed/i.test(value)?'passed':/fail|error|cancel/i.test(value)?'failed':/queued|progress|waiting|requested/i.test(value)?'warning':'';}

async function apiJson(url,options={}){
  const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(body.error||`Request failed (${response.status})`);error.status=response.status;throw error;}
  return body;
}
function ownerHeaders(){const key=sessionStorage.getItem('ascension-owner-key');return key?{'X-Ascension-Owner-Key':key}:{};}
async function ownerPostTo(path,payload,retry=true){
  try{return await apiJson(path,{method:'POST',headers:ownerHeaders(),body:JSON.stringify(payload)});}
  catch(error){
    if(retry&&(error.status===401||error.status===503)){
      const key=window.prompt('Owner control is locked. If Cloudflare Access is not enabled, enter the Hub owner control key. It is kept only for this browser session.');
      if(key){sessionStorage.setItem('ascension-owner-key',key);return ownerPostTo(path,payload,false);}
    }
    throw error;
  }
}
const ownerPost=(payload,retry=true)=>ownerPostTo('/api/automation-action',payload,retry);

const actionTargets={tests:'#release-evidence-summary',review:'#review-path',screenshots:'#release-evidence-summary',changes:'#repositories',logs:'#activity',history:'#decision-history'};
qa('[data-owner-action]').forEach((button)=>button.addEventListener('click',()=>{
  const action=button.dataset.ownerAction;
  if(action==='check'){scrollToId('#connected-automations');toastOwner('Use Run now on the check you want. Safe checks can run without touching production.');return;}
  if(action==='preview'){
    const href=releaseStateCache?.review?.previewUrl||firstHref('#review-list a[href^="http"], #asset-list a[href^="http"]');
    if(href){window.open(href,'_blank','noopener,noreferrer');toastOwner('Opening preview evidence.');}
    else{scrollToId('#review-path');toastOwner('No preview URL is attached yet, so production stays locked.');}
    return;
  }
  if(action==='deploy'){toastOwner('Deploy remains locked until passing evidence, screenshots and owner approval are recorded.');return;}
  const target=actionTargets[action];if(target){scrollToId(target);toastOwner(action==='screenshots'?'Opening visual evidence.':action==='tests'?'Opening test evidence.':'Opening review evidence.');}
}));

function ensureReleaseEvidencePanel(){
  let panel=q('#release-evidence-summary');if(panel)return panel;
  panel=document.createElement('div');panel.id='release-evidence-summary';panel.className='release-evidence-summary';
  const lane=q('.release-lane');lane?.insertAdjacentElement('afterend',panel);
  return panel;
}

function stageStatus(state,stage){return state?.stages?.[stage]?.status||'not run';}
function releaseEvidenceHtml(state){
  const review=state.review||{},approval=state.approval||{};
  const links=[];
  if(review.previewUrl)links.push(`<a class="compact-button" href="${esc(review.previewUrl)}" target="_blank" rel="noopener noreferrer">Open preview</a>`);
  if(review.runUrl)links.push(`<a class="compact-button" href="${esc(review.runUrl)}" target="_blank" rel="noopener noreferrer">Open test & screenshot evidence</a>`);
  return `<div class="release-proof-head"><div><b>Release ${esc(state.shortSha||'not resolved')}</b><small>${esc(state.ref||'main')} · refreshed ${esc(friendlyTime(state.generatedAt))}</small></div><span class="status-chip ${state.gates?.canDeploy?'passed':state.gates?.canReview?'warning':''}">${state.gates?.canDeploy?'Ready to deploy':state.gates?.canReview?'Ready for owner review':'Working through gates'}</span></div><div class="release-proof-grid"><span>Check <b>${esc(stateLabel(stageStatus(state,'check')))}</b></span><span>Test <b>${esc(stateLabel(stageStatus(state,'test')))}</b></span><span>Preview <b>${esc(stateLabel(stageStatus(state,'preview')))}</b></span><span>Screenshots <b>${Number(review.screenshotCount||0)}/2</b></span><span>Approval <b>${esc(approval.decision||'not approved')}</b></span><span>Deploy <b>${esc(stateLabel(stageStatus(state,'deploy')))}</b></span></div>${state.warning?`<p class="review-warning">${esc(state.warning)}</p>`:''}<div class="release-proof-links">${links.join('')}</div><p class="muted">For visual changes, Review does not unlock until both desktop and mobile screenshots are captured from the preview.</p>`;
}

function replaceReleaseButton(card,label,enabled,handler,primary=false){
  const old=q('button',card);if(!old)return null;
  const button=old.cloneNode(false);button.textContent=label;button.disabled=!enabled;button.className=primary?'primary compact-button':'compact-button';
  old.replaceWith(button);if(enabled&&handler)button.addEventListener('click',handler);return button;
}

async function runReleaseAction(action){
  const card=q(`.release-step[data-stage="${action}"]`);const button=q('button',card);if(button){button.disabled=true;button.textContent='Starting…';}
  try{
    const result=await ownerPostTo('/api/release-action',{action});
    releaseStateCache=result.state||releaseStateCache;
    toastOwner(action==='approve'?'Preview approved for this exact release.':`${action[0].toUpperCase()+action.slice(1)} requested.`);
    await loadReleaseState(false);
    if(action!=='approve')window.setTimeout(()=>loadReleaseState(false),5000);
  }catch(error){toastOwner(error.message);await loadReleaseState(false);}
}

function renderReleaseLane(state){
  releaseStateCache=state;const gates=state.gates||{};
  const panel=ensureReleaseEvidencePanel();panel.innerHTML=releaseEvidenceHtml(state);
  const check=q('.release-step[data-stage="check"]'),test=q('.release-step[data-stage="test"]'),preview=q('.release-step[data-stage="preview"]'),review=q('.release-step[data-stage="review"]'),deploy=q('.release-step[data-stage="deploy"]');
  const setTone=(card,ready)=>{if(!card)return;card.classList.toggle('is-ready',Boolean(ready));card.classList.toggle('is-locked',!ready);};
  setTone(check,gates.canCheck);setTone(test,gates.canTest);setTone(preview,gates.canPreview);setTone(review,gates.canReview);setTone(deploy,gates.canDeploy);
  replaceReleaseButton(check,stageStatus(state,'check')==='success'?'Re-run check':'Run check',gates.canCheck,()=>runReleaseAction('check'));
  replaceReleaseButton(test,stageStatus(state,'test')==='success'?'Re-run tests':'Run tests',gates.canTest,()=>runReleaseAction('test'));
  if(stageStatus(state,'preview')==='success'&&state.review?.previewUrl)replaceReleaseButton(preview,'Open preview',true,()=>window.open(state.review.previewUrl,'_blank','noopener,noreferrer'));
  else replaceReleaseButton(preview,'Create preview',gates.canPreview,()=>runReleaseAction('preview'));
  replaceReleaseButton(review,state.approval?.decision==='approved'?'Approved ✓':'Review evidence',gates.canReview,()=>scrollToId('#release-evidence-summary'));
  qa('.release-approve-button',review).forEach((el)=>el.remove());
  if(gates.canApprove&&state.approval?.decision!=='approved'){
    const approve=document.createElement('button');approve.className='primary compact-button release-approve-button';approve.textContent='Approve this preview';
    approve.addEventListener('click',()=>{if(window.confirm('Approve this exact preview and its desktop/mobile screenshots for production deploy?'))runReleaseAction('approve');});review.append(approve);
  }
  replaceReleaseButton(deploy,gates.canDeploy?'Deploy to production':'Deploy locked',gates.canDeploy,()=>{if(window.confirm('Deploy this approved, tested preview to production now?'))runReleaseAction('deploy');},gates.canDeploy);
}

async function loadReleaseState(showToast=false){
  ensureReleaseEvidencePanel();
  try{const state=await apiJson('/api/release-state');renderReleaseLane(state);if(showToast)toastOwner('Release evidence refreshed.');}
  catch(error){q('#release-evidence-summary').innerHTML=`<p class="review-warning">Release controls are not live yet: ${esc(error.message)}</p>`;}
}

function ensureConnectedPanel(){
  let panel=q('#connected-automations');if(panel)return panel;
  panel=document.createElement('section');panel.className='panel connected-automations-panel';panel.id='connected-automations';
  panel.innerHTML='<div class="panel-head"><div><p class="eyebrow">CONNECTED CONTROLS</p><h2>Everything you can run from the Hub</h2></div><button class="compact-button" id="refresh-automation-controls">Refresh</button></div><p class="execution-intro">Green low-risk checks can run now. Anything that can repair, publish or deploy stays behind Review and owner approval.</p><div id="automation-connection-state" class="connection-strip"></div><div id="automation-control-groups"></div>';
  q('#schedules')?.insertAdjacentElement('afterend',panel);
  q('#refresh-automation-controls',panel)?.addEventListener('click',()=>{loadAutomationControls(true);loadReleaseState(false);});
  return panel;
}

function frequencyOptions(current){return [['6h','Every 6 hours'],['daily','Daily'],['weekly','Weekly'],['manual','Manual only']].map(([value,label])=>`<option value="${value}" ${current===value?'selected':''}>${label}</option>`).join('');}
function automationCard(item){
  const status=item.live?.state||'unknown',run=item.live?.run,schedule=item.schedule||{};
  const canRun=item.safeRun;
  const scheduleControl=item.schedulable?`<label class="automation-schedule-label">Schedule<select data-live-schedule="${esc(item.id)}">${frequencyOptions(schedule.frequency||item.defaultFrequency)}</select></label><button class="compact-button" data-live-pause="${esc(item.id)}">${schedule.paused?'Resume':'Pause'}</button>`:'<span class="source-pill">MANUAL</span>';
  const runControl=canRun?`<button class="primary compact-button" data-live-run="${esc(item.id)}">Run now</button>`:`<button class="compact-button" data-live-review="${esc(item.id)}">Review first</button>`;
  const scheduleText=schedule.managedByHub?`${schedule.paused?'Paused':'Hub managed'} · ${stateLabel(schedule.frequency)}`:(schedule.label||item.nativeSchedule||'Manual');
  return `<article class="automation-control-card" data-automation-card="${esc(item.id)}"><div class="automation-card-head"><div><p class="eyebrow">${esc(GROUPS[item.group]||item.group)}</p><h3>${esc(item.label)}</h3></div><span class="status-chip ${stateClass(status)}">${esc(stateLabel(status))}</span></div><p>${esc(item.description)}</p><div class="automation-proof"><span>Last run <b>${esc(friendlyTime(run?.createdAt||schedule.lastRunAt))}</b></span><span>Schedule <b>${esc(scheduleText)}</b></span><span>Risk <b>${esc(item.risk)}</b></span></div>${item.live?.warning?`<p class="review-warning">${esc(item.live.warning)}</p>`:''}<div class="automation-card-actions">${runControl}${scheduleControl}${run?.url?`<a class="compact-button" href="${esc(run.url)}" target="_blank" rel="noopener noreferrer">View run</a>`:''}</div></article>`;
}

function renderAutomationControls(data){
  controlState=data;const panel=ensureConnectedPanel();
  const c=data.connections||{};
  q('#automation-connection-state',panel).innerHTML=`<span class="${c.githubRead?'ok':'warn'}">GitHub status ${c.githubRead?'connected':'needs token'}</span><span class="${c.githubControl?'ok':'warn'}">Run controls ${c.githubControl?'connected':'needs control token'}</span><span class="${c.database?'ok':'warn'}">Schedules ${c.database?'connected':'needs D1 binding'}</span><span class="${c.schedulerKey?'ok':'warn'}">Scheduler ${c.schedulerKey?'ready':'needs key'}</span>`;
  const byGroup=Object.entries(GROUPS).map(([group,label])=>{const items=data.items.filter((item)=>item.group===group);if(!items.length)return'';return `<section class="automation-group"><div class="automation-group-title"><h3>${esc(label)}</h3><span>${items.length} control${items.length===1?'':'s'}</span></div><div class="automation-control-grid">${items.map(automationCard).join('')}</div></section>`;}).join('');
  q('#automation-control-groups',panel).innerHTML=byGroup;
  bindLiveControls(panel);
}

async function loadAutomationControls(showToast=false){
  ensureConnectedPanel();
  try{const data=await apiJson('/api/automations');renderAutomationControls(data);if(showToast)toastOwner('Automation controls refreshed.');}
  catch(error){q('#automation-control-groups').innerHTML=`<p class="review-warning">Could not load live automation controls: ${esc(error.message)}</p>`;}
}

function bindLiveControls(root){
  qa('[data-live-run]',root).forEach((button)=>button.addEventListener('click',async()=>{
    button.disabled=true;button.textContent='Starting…';
    try{await ownerPost({action:'run-now',automationId:button.dataset.liveRun});toastOwner('Run requested. Refresh in a moment to see GitHub status.');setTimeout(()=>loadAutomationControls(false),1800);}
    catch(error){toastOwner(error.message);button.disabled=false;button.textContent='Run now';}
  }));
  qa('[data-live-schedule]',root).forEach((select)=>select.addEventListener('change',async()=>{
    const previous=controlState?.items.find((item)=>item.id===select.dataset.liveSchedule)?.schedule?.frequency;
    try{await ownerPost({action:'schedule',automationId:select.dataset.liveSchedule,frequency:select.value});toastOwner(`Schedule saved: ${select.options[select.selectedIndex].text}.`);await loadAutomationControls(false);}
    catch(error){toastOwner(error.message);if(previous)select.value=previous;}
  }));
  qa('[data-live-pause]',root).forEach((button)=>button.addEventListener('click',async()=>{
    const item=controlState?.items.find((entry)=>entry.id===button.dataset.livePause);const action=item?.schedule?.paused?'resume':'pause';
    try{await ownerPost({action,automationId:button.dataset.livePause});toastOwner(action==='pause'?'Schedule paused.':'Schedule resumed.');await loadAutomationControls(false);}
    catch(error){toastOwner(error.message);}
  }));
  qa('[data-live-review]',root).forEach((button)=>button.addEventListener('click',()=>{scrollToId('#review-path');toastOwner('This action can change production or content, so Review comes first.');}));
}

// The first schedule cards are plain-English signposts; Connected Controls below is the live source of truth.
qa('[data-schedule-id]').forEach((card)=>{
  const run=q('[data-schedule-run]',card),toggle=q('[data-schedule-toggle]',card),select=q('[data-schedule-select]',card);
  if(run)run.addEventListener('click',()=>{scrollToId('#connected-automations');toastOwner('Choose the exact automation under Connected Controls.');});
  if(toggle)toggle.addEventListener('click',()=>{scrollToId('#connected-automations');toastOwner('Pause and resume the exact automation under Connected Controls.');});
  if(select&&!select.disabled)select.addEventListener('change',()=>{scrollToId('#connected-automations');toastOwner('Save the real schedule under Connected Controls.');});
});

loadAutomationControls(false);
loadReleaseState(false);
