import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=mkdtempSync(join(tmpdir(),'mnw-supplement-'));
try {
  writeFileSync(join(dir,'rules.mjs'),ts.transpileModule(readFileSync('lib/application-supplement.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  const {supplementQuestions,supplementPayload}=await import(pathToFileURL(join(dir,'rules.mjs')));
  const application={status:'submitted',questions:[{id:'q1',question:'Tillgänglighet?'},{id:'q2',question:'Vad vill du lära dig?'},{id:'q3',question:'Kunskaper?'}],answers:{q2:'Produktkunskap'},omitted_question_ids:['q3']};
  const followups=[{id:'f1',question:'Kassasystem?',answer:'',status:'pending'}];
  const rows=supplementQuestions(application,followups);
  assert.deepEqual(rows.map(row=>row.status),['pending','answered','skipped','pending']);
  assert.equal(rows.filter(row=>row.status==='pending').length,2);
  assert.deepEqual(supplementPayload(rows,{'static:q1':'  Helger  ','static:q2':'Inte uttryckligen redigerat','followup:f1':'Kassa' },[],[]),{answers:{q1:'Helger'},skipIds:[],followupAnswers:{f1:'Kassa'},followupSkipIds:[]});
  assert.deepEqual(supplementPayload(rows,{'static:q1':'Ignorera vid avstå','static:q3':'Nytt svar'},['static:q1','followup:f1'],['static:q3']),{answers:{q3:'Nytt svar'},skipIds:['q1'],followupAnswers:{},followupSkipIds:['f1']});
  assert.deepEqual(supplementQuestions({...application,status:'needs_completion'},[]),[],'Older unsent applications must not claim optional published questions');
  const page=readFileSync('app/applications/page.tsx','utf8');
  assert.match(page,/"submitted" \? "Skickad"/,'Pending optional questions must never replace the sent status');
  const prepare=readFileSync('lib/application-completions.ts','utf8').split('export async function prepareApplication')[1].split('export async function getApplicationCompletions')[0];
  assert.doesNotMatch(prepare,/await analyzeApplications/,'Swiping must not await AI');
  console.log('PASS: unified optional questions, omissions, edits, explicit sharing and sent-status guards.');
} finally {rmSync(dir,{recursive:true,force:true});}
