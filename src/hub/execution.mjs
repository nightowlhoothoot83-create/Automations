import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { appendHistory, readHistory } from './history.mjs';
import { getApprovedHubDeployment } from './model.mjs';

export const DEPLOY_CONFIRMATION = 'EXECUTE APPROVED MANAGEMENT HUB DEPLOY';
const PROJECT_NAME = 'ascension-automation-hub';
let activeExecution;

function runProcess(executable, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(executable, args, { cwd:process.cwd(), shell:false, stdio:['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(-20_000); });
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-20_000); });
    child.once('error', reject);
    child.once('close', (code, signal) => resolveRun({ code, signal, stdout, stderr }));
  });
}

async function fixedHubDeployRunner() {
  const build = await runProcess(process.execPath, [resolve('scripts/build-hub-pages.mjs')]);
  if (build.code !== 0) return { stage:'build', ...build };
  const deploy = await runProcess(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'pages', 'deploy', resolve('src/hub/public'), '--project-name', PROJECT_NAME]);
  return { stage:'deploy', build, ...deploy };
}

async function performExecution(input, runner) {
  const approvalId = input?.approvalId;
  if (input?.confirmation !== DEPLOY_CONFIRMATION) {
    const error = new Error(`Second confirmation must exactly match: ${DEPLOY_CONFIRMATION}`);
    error.statusCode = 400;
    throw error;
  }
  let approvalContext;
  try { approvalContext = await getApprovedHubDeployment(approvalId); }
  catch (error) { error.statusCode ||= 409; throw error; }
  const { approval, report } = approvalContext;
  const { events } = await readHistory(Number.MAX_SAFE_INTEGER);
  if (events.some((event) => event.type === 'deployment-execution-succeeded' && event.approvalId === approvalId)) {
    const error = new Error('This approved deployment was already executed successfully');
    error.statusCode = 409;
    throw error;
  }
  const started = await appendHistory({ type:'deployment-execution-started', title:`Management Hub deployment started: ${approvalId}`, approvalId, runId:report.runId, actor:'local-owner', provenance:'live', target:PROJECT_NAME });
  try {
    const result = await runner();
    if (result.code !== 0) {
      const error = new Error(`Management Hub ${result.stage} failed with exit code ${result.code ?? 'unknown'}`);
      error.result = result;
      throw error;
    }
    const completed = await appendHistory({ type:'deployment-execution-succeeded', title:`Management Hub deployment succeeded: ${approvalId}`, approvalId, runId:report.runId, actor:'local-owner', provenance:'live', target:PROJECT_NAME, startedEventId:started.eventId, stage:result.stage });
    return { approvalId, status:'succeeded', target:PROJECT_NAME, eventId:completed.eventId, recordedAt:completed.recordedAt, evidenceCapturedAt:approval.capturedAt };
  } catch (error) {
    await appendHistory({ type:'deployment-execution-failed', title:`Management Hub deployment failed: ${approvalId}`, approvalId, runId:report.runId, actor:'local-owner', provenance:'live', target:PROJECT_NAME, startedEventId:started.eventId, error:error.message });
    throw error;
  }
}

export function executeApprovedHubDeploy(input, options = {}) {
  if (activeExecution) {
    const error = new Error('A Management Hub deployment execution is already in progress');
    error.statusCode = 409;
    throw error;
  }
  const execution = performExecution(input, options.runner || fixedHubDeployRunner);
  activeExecution = execution;
  return execution.finally(() => { if (activeExecution === execution) activeExecution = undefined; });
}
