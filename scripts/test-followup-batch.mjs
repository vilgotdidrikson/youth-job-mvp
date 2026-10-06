import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=mkdtempSync(join(tmpdir(),'mnw-question-batch-'));
const previousKey=process.env.GROQ_API_KEY;
try {
  process.env.GROQ_API_KEY='synthetic-test-key';
  const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  writeFileSync(join(dir,'evidence.mjs'),compile('lib/application-evidence.ts'));
  writeFileSync(join(dir,'mocks.mjs'),`export const calls=[];
    export const source='Jag vill lära mig produktkunskap.';
    export let fail=false;
    export function setFailure(value){fail=value;}
    export class OpenAI{constructor(){this.chat={completions:{create:async(args)=>{calls.push(['ai',args]);if(fail)throw Error('offline');return {choices:[{message:{content:JSON.stringify({criteria:[],answers:[{id:'q1',evidence:source}]})}}]};}}};}}
    export const matchingCriteria=()=>[{id:'c0',label:'Kassa'}];
    export const candidateSource=profile=>source+(profile.answers ? JSON.stringify(profile.answers):'');
    export const assessCandidate=()=>({criteria:[]});
    export const candidateAssessmentHash=value=>value.includes('Uppgift från profil/CV:') ? 'b'.repeat(64):'a'.repeat(64);
    export const queueApplicationFollowups=async(...args)=>{calls.push(['queue',args]);return {queued:1};};
    export const pdfCvSource=async()=>({status:'none',text:''});
    export const groqTextOptions=()=>({model:'test'});`);
  const imports=`import {OpenAI,matchingCriteria,candidateSource,assessCandidate,candidateAssessmentHash,queueApplicationFollowups,pdfCvSource,groqTextOptions} from './mocks.mjs';\nimport {verifiedApplicationAnswers} from './evidence.mjs';\n`;
  writeFileSync(join(dir,'analyze.mjs'),imports+compile('lib/analyze-application-followups.ts').replace(/^import .*;\n/gm,''));
  const {analyzeApplicationFollowups}=await import(pathToFileURL(join(dir,'analyze.mjs')));
  const mocks=await import(pathToFileURL(join(dir,'mocks.mjs')));
  let batchVersion=null,stale=false;
  const rpc=[];
  const client={rpc:async(name,args)=>{
    rpc.push([name,args]);
    if(name==='get_my_application_followup_input') return {data:{available:true,profile:{},profile_version:2,question_batch_version:batchVersion,questions:[{id:'q1',question:'Vad vill du lära dig?'}],answers:{},source_updated_at:'2026-10-06T00:00:00Z'}};
    if(name==='claim_application_followup_analysis') return {data:{claimed:true}};
    if(name==='consume_api_quota') return {data:true};
    if(name==='apply_my_application_evidence_snapshot') return {data:{stale}};
    return {data:{}};
  }};
  assert.deepEqual(await analyzeApplicationFollowups(client,'job','youth'),{queued:1});
  assert.equal(mocks.calls.filter(([name])=>name==='ai').length,1,'Static and criterion checks must share one provider call');
  assert.equal(rpc.find(([name])=>name==='apply_my_application_evidence_snapshot')[1].p_answers.q1,'Uppgift från profil/CV: '+mocks.source);
  assert.equal(mocks.calls.find(([name])=>name==='queue')[1][5],'b'.repeat(64),'Cache hash must include the newly published literal evidence');
  assert.equal(rpc.at(-1)[0],'release_application_followup_analysis');
  batchVersion=2;mocks.calls.length=0;rpc.length=0;
  assert.deepEqual(await analyzeApplicationFollowups(client,'job','youth'),{queued:0,cached:true});
  assert.equal(mocks.calls.length,0,'Answering a completed batch must not run AI or queue more questions');
  batchVersion=null;stale=true;mocks.calls.length=0;rpc.length=0;
  assert.deepEqual(await analyzeApplicationFollowups(client,'job','youth'),{queued:0,stale:true});
  assert.equal(mocks.calls.filter(([name])=>name==='queue').length,0);
  assert.equal(rpc.at(-1)[0],'release_application_followup_analysis');
  stale=false;mocks.setFailure(true);mocks.calls.length=0;
  assert.deepEqual(await analyzeApplicationFollowups(client,'job','youth'),{queued:0,temporary:true});
  assert.equal(mocks.calls.filter(([name])=>name==='queue').length,0,'An outage must not invent missing facts');
  console.log('PASS: one combined AI pass, literal CV evidence, stable batch, stale-source and outage guards.');
} finally {
  if(previousKey===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=previousKey;
  rmSync(dir,{recursive:true,force:true});
}
