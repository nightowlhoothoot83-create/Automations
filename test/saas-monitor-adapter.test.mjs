import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSaasReport, toReportV1 } from '../functions/_saas-monitor.js';

const raw = { version:4,detector_version:'4.2',run_at:'2026-09-05T15:48:56.928Z',apps:[
  {id:'pod',name:'Raven Sharp POD',url:'https://pod.example',status:'review',baseline_percent:92,issues:[{severity:'warning',area:'ecosystem footer',message:'Footer logo missing',recommendation:'Restore the approved ADG logo.'}]},
  {id:'content',name:'Content Creator',url:'https://content.example',status:'passed',baseline_percent:100,issues:[]}
]};

test('SaaS Monitor v4 maps to Automation 6 report-v1 with actionable findings',()=>{
  const report=toReportV1(raw);
  assert.equal(report.schemaVersion,'1.0.0');
  assert.deepEqual(report.summary,{passed:1,warning:1,failed:0,skipped:0});
  assert.equal(report.status,'warning');
  assert.equal(report.results[0].evidence.nextAction,'Restore the approved ADG logo.');
  assert.equal(report.reviewPackage.provenance,'live-cloudflare-worker');
  assert.equal(report.reviewPackage.approvalRequested,false);
});

test('live SaaS report is prominent without creating a fake approval',()=>{
  const dashboard={source:'base',mode:'demonstration',sourceWarnings:[],overview:{status:'passed',passed:0,warning:0,failed:0,attention:0},runs:[],activity:[],queues:{repairs:[]},nextTask:null};
  mergeSaasReport(dashboard,toReportV1(raw));
  assert.equal(dashboard.runs[0].provenance,'live');
  assert.equal(dashboard.queues.repairs[0].status,'needs-repair');
  assert.match(dashboard.nextTask.detail,/approved ADG logo/);
  assert.equal(dashboard.approvals,undefined);
});
