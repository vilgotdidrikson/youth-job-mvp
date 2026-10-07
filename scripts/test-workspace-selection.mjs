import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const dir=mkdtempSync(join(tmpdir(),'mnw-workspace-'));
try {
  async function load(name){const path=join(dir,name+'.mjs');writeFileSync(path,ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);return import(pathToFileURL(path));}
  const {authGuardStatus}=await load('auth-guard-state');
  assert.equal(authGuardStatus(false,'company',null,null),'checking','A signed-in user is not ready before its role profile arrives');
  assert.equal(authGuardStatus(false,'new-account','old-account',null),'checking','A profile for the previous account cannot authorize the new account');
  assert.equal(authGuardStatus(false,'company','company',null),'ready');
  assert.equal(authGuardStatus(false,null,null,null),'redirecting');
  assert.equal(authGuardStatus(false,'company',null,'offline'),'error');
  const {filterCandidates,selectCandidate}=await load('candidate-selection');
  const candidates=[{youthUserId:'a',profile:{full_name:'Åsa'},job:{id:'job1',title:'Butik'}},{youthUserId:'b',profile:{full_name:'Bo'},job:{id:'job2',title:'Café'}}];
  const filtered=filterCandidates(candidates,'  CAFÉ ');assert.equal(filtered.length,1);assert.equal(selectCandidate(filtered,null).youthUserId,'b');
  assert.equal(selectCandidate(filterCandidates(candidates,'ingen träff'),null),null,'A zero-result search must not show decision buttons for a hidden candidate');
  assert.equal(selectCandidate(filtered,'job1:a'),null,'An inaccessible deep link must not select another person');
  assert.equal(selectCandidate(candidates,'job2:b').youthUserId,'b');
  console.log('PASS: account/profile readiness, account switches, search results, hidden candidate decisions and stale deep links.');
} finally {rmSync(dir,{recursive:true,force:true});}
