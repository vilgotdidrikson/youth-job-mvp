import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdtempSync,rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const dir=mkdtempSync(resolve('.session-tests-'));
try {
 const output=ts.transpileModule(readFileSync('lib/session-events.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 writeFileSync(dir+'/session-events.mjs',output);
 const {sessionUserForEvent}=await import(pathToFileURL(dir+'/session-events.mjs'));
 const original={id:'youth-a',user_metadata:{name:'Old name'}};
 let current=original,extraPageLoads=0;
 for(let i=0;i<10;i++) {const next=sessionUserForEvent(current,{id:'youth-a',user_metadata:{name:'Old name'}},'TOKEN_REFRESHED');if(next!==current)extraPageLoads++;current=next;}
 assert.equal(extraPageLoads,0,'Background application requests must not trigger another page analysis after rotating the token');
 assert.equal(current,original);
 const changed={id:'youth-a',user_metadata:{name:'Updated name'}};
 assert.equal(sessionUserForEvent(current,changed,'USER_UPDATED'),changed);
 const secondAccount={id:'company-b'};
 assert.equal(sessionUserForEvent(current,secondAccount,'TOKEN_REFRESHED'),secondAccount);
 assert.equal(sessionUserForEvent(current,null,'SIGNED_OUT'),null);
 assert.equal(sessionUserForEvent(null,original,'INITIAL_SESSION'),original);
 console.log('PASS: repeated token rotations retain page identity; metadata updates, account changes and sign-out remain visible.');
} finally {rmSync(dir,{recursive:true,force:true});}
