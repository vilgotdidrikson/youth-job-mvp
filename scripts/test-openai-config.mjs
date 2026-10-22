import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=mkdtempSync(join(tmpdir(),'mnw-openai-'));
const names=['OPENAI_TEXT_MODEL','OPENAI_CV_MODEL','OPENAI_MATCH_MODEL','OPENAI_JOB_MODEL','OPENAI_APPLICATION_MODEL'];
const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
try {
  const compiled=ts.transpileModule(readFileSync('lib/openai-config.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
  writeFileSync(join(dir,'config.mjs'),compiled);
  const {OPENAI_API_BASE_URL,openaiTextOptions,openaiResponseOptions,currentTextModel,currentRealtimeModel}=await import(pathToFileURL(join(dir,'config.mjs')));
  for(const name of names)delete process.env[name];
  assert.equal(OPENAI_API_BASE_URL,'https://api.openai.com/v1');
  assert.deepEqual(openaiTextOptions(3600),{model:'gpt-6-luna',max_completion_tokens:6000,store:false,reasoning_effort:'medium'});
  assert.ok(!('temperature' in openaiTextOptions(3600)),'Reasoning must not send unsupported temperature');
  assert.deepEqual(openaiTextOptions(3000,'job'),{model:'gpt-6-luna',max_completion_tokens:3000,store:false,reasoning_effort:'none',temperature:0.35});
  assert.equal(openaiTextOptions(4000,'application').reasoning_effort,'none');
  process.env.OPENAI_CV_MODEL='gpt-4.1-mini-2025-04-14';
  assert.equal(openaiTextOptions(3000).model,'gpt-6-luna','CV settings do not change matching');
  process.env.OPENAI_TEXT_MODEL='gpt-4.1-mini';
  assert.equal(openaiTextOptions(3000).model,'gpt-6-luna','Retired global defaults do not override explicit Luna task defaults');
  process.env.OPENAI_MATCH_MODEL='gpt-4.1-mini';
  assert.equal(openaiTextOptions(3600).model,'gpt-6-luna','Retired deployment override must migrate too');
  for(const model of ['gpt-4o','gpt-4o-mini','gpt-4.1','gpt-4.1-mini','gpt-4o-mini-2024-07-18','gpt-4.1-mini-2025-04-14']) assert.equal(currentTextModel(model),'gpt-6-luna');
  assert.equal(currentTextModel('gpt-6-sol'),'gpt-6-sol');
  assert.equal(currentTextModel('gpt-4o-mini-tts'),'gpt-4o-mini-tts','Do not conflate modalities');
  assert.deepEqual(openaiResponseOptions(1200),{model:'gpt-6-luna',store:false,max_output_tokens:1200,reasoning:{effort:'none'},temperature:0});
  assert.equal('temperature' in openaiResponseOptions(1200,'gpt-6.1-sol'),false);
  assert.equal(currentRealtimeModel('gpt-realtime'),'gpt-realtime-2.1');
  assert.equal(currentRealtimeModel(undefined,true),'gpt-realtime-2.1-mini');
  assert.equal(currentRealtimeModel('gpt-4o-mini-tts-2025-12-15',true),'gpt-realtime-2.1-mini');
  assert.equal(openaiTextOptions(3000,'job').model,'gpt-6-luna','Task overrides remain separate');
  for(const file of ['lib/application-analysis-worker.ts','lib/analyze-application-followups.ts','app/api/company/candidate-assessment/route.ts','app/api/company/job/generate/route.ts','app/api/youth/applications/analyze/route.ts']) {
    const source=readFileSync(file,'utf8');
    assert.ok(source.includes('baseURL: OPENAI_API_BASE_URL'),`${file}: official endpoint required`);
    assert.ok(source.includes('openaiTextOptions('),`${file}: shared model/storage configuration required`);
    assert.ok(!/groq/i.test(source),`${file}: retired provider remains`);
  }
  assert.ok(readFileSync('app/api/internal/matching/process/route.ts','utf8').includes('process.env.OPENAI_API_KEY'));
  console.log('PASS: Luna task routing, stronger matching reasoning, compatible sampling, isolated overrides and OpenAI-only endpoints.');
} finally {
  for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}
  rmSync(dir,{recursive:true,force:true});
}
