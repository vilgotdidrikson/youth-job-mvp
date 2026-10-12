import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=mkdtempSync(join(tmpdir(),'mnw-openai-'));
const previous={text:process.env.OPENAI_TEXT_MODEL,cv:process.env.OPENAI_CV_MODEL};
try {
  const compiled=ts.transpileModule(readFileSync('lib/openai-config.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
  writeFileSync(join(dir,'config.mjs'),compiled);
  const {OPENAI_API_BASE_URL,openaiTextOptions}=await import(pathToFileURL(join(dir,'config.mjs')));
  delete process.env.OPENAI_TEXT_MODEL;delete process.env.OPENAI_CV_MODEL;
  assert.equal(OPENAI_API_BASE_URL,'https://api.openai.com/v1');
  assert.deepEqual(openaiTextOptions(3600),{model:'gpt-4.1-mini',max_completion_tokens:3600,store:false});
  process.env.OPENAI_CV_MODEL='gpt-4.1-mini-2025-04-14';
  assert.equal(openaiTextOptions(3000).model,process.env.OPENAI_CV_MODEL);
  process.env.OPENAI_TEXT_MODEL='gpt-4.1-mini';
  assert.equal(openaiTextOptions(3000).model,process.env.OPENAI_TEXT_MODEL);
  for(const file of ['lib/application-analysis-worker.ts','lib/analyze-application-followups.ts','app/api/company/candidate-assessment/route.ts','app/api/company/job/generate/route.ts','app/api/youth/applications/analyze/route.ts']) {
    const source=readFileSync(file,'utf8');
    assert.ok(source.includes('baseURL: OPENAI_API_BASE_URL'),`${file}: official endpoint required`);
    assert.ok(source.includes('openaiTextOptions('),`${file}: shared model/storage configuration required`);
    assert.ok(!/groq/i.test(source),`${file}: retired provider remains`);
  }
  assert.ok(readFileSync('app/api/internal/matching/process/route.ts','utf8').includes('process.env.OPENAI_API_KEY'));
  console.log('PASS: OpenAI-only endpoints, model precedence, bounded output and disabled response storage.');
} finally {
  for(const [name,value] of [['OPENAI_TEXT_MODEL',previous.text],['OPENAI_CV_MODEL',previous.cv]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}
  rmSync(dir,{recursive:true,force:true});
}
