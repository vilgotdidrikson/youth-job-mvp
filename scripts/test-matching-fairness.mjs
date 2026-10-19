import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
Module._extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {matchingCriteria,assessCandidate,candidateSourceDetails,candidateSource}=require('../lib/candidate-assessment.ts');
const {minimizeMatchingText}=require('../lib/matching-input-policy.ts');
const {emptyRecruitmentProfile}=require('../lib/recruitment-profile.ts');
const trait=matchingCriteria([{label:'Punktlig',category:'trait'}]);
for(const claim of ['Jag är punktlig.','Jag är bra på att passa tider.','Jag passar tider.','Jag kommer i tid.']) {
 const result=assessCandidate(trait,[],candidateSource({cv_text:claim}));
 assert.equal(result.criteria[0].status,'fulfilled');assert.equal(result.score,null);assert.equal(result.criteria[0].weight,0);
}
assert.equal(assessCandidate(trait,[],candidateSource({cv_text:'Jag är inte bra på att passa tider.'})).criteria[0].status,'unfulfilled');
for(const text of ['Jag var fotbollstränare.','Min bror är punktlig.','Jag vill vara punktlig.','Jag är punktlig om jag får skjuts.','Jag har aldrig sagt att jag är punktlig.','Jag är punktlig. Jag kommer inte i tid.'])assert.equal(assessCandidate(trait,[{id:'c0',status:'fulfilled',evidence:text}],candidateSource({cv_text:text})).criteria[0].status,'unknown',text);
assert.equal(matchingCriteria([{label:'Punktlig',category:'must_have',required:true}])[0].weight,0,'Trait cannot become a personality score by choosing another category');
const rawProfile=emptyRecruitmentProfile();rawProfile.examples=[{strength:'responsibility',context:'Fotbollstränare',action:'Jag planerade träningar för tolv barn.'}];
const role=assessCandidate(matchingCriteria([{label:'Ansvarstagande',category:'trait'},{label:'Ledarskap',category:'must_have'}]),[],candidateSource({recruitment_profile:rawProfile}));assert.ok(role.criteria.every(c=>c.status==='unknown'));assert.equal(role.score,null);
const plain='Jag har B-körkort. Jag kan inte arbeta helger.';
const base=matchingCriteria([{label:'B-körkort',required:true},{label:'Kan arbeta helger',required:true}]);
assert.equal(assessCandidate(base,[],candidateSource({cv_text:plain})).score,50);
assert.equal(assessCandidate(base,[],candidateSource({cv_text:plain+'\n'+('Jag trivs med arbete. '.repeat(3000))})).score,50,'Text length does not earn points');
const detail='Jag hanterade returer i kassasystemet och inventerade lagret under juli 2025.';
const mixed={full_name:'Alex Testsson',cv_text:`Alex Testsson\n${detail}\nJag har ADHD. Jag är medlem i SSU. Min e-post är alex@example.invalid. Jag bor på Testgatan 7. Jag heter Alex Testsson.`,cv_structured:{workExperience:[{role:'Butiksmedarbetare',tasks:['Jag kontrollerade leveranser.','Jag har diabetes.'],sourceNotes:'PRIVATE REJECTED DRAFT'}]},answers:{q1:'Jag kan arbeta kvällar. Jag är muslim.'},followup_answers:[{answer:'Jag har B-körkort.'}],raw_chat:'PRIVATE CHAT',rejected_ai:'PRIVATE SUGGESTION'};
const minimized=candidateSourceDetails(mixed);
assert.equal(minimized.status,'review_required');
assert.ok(minimized.text.includes('inventerade lagret under juli 2025'));assert.ok(minimized.text.includes('Jag kontrollerade leveranser.'));assert.ok(minimized.text.includes('Jag kan arbeta kvällar.'));
for(const secret of ['Alex Testsson','ADHD','SSU','alex@example.invalid','Testgatan','diabetes','muslim','PRIVATE'])assert.ok(!minimized.text.includes(secret),secret);
assert.ok(candidateSource({cv_text:'x'.repeat(35000)+'\nJag skötte inventering.'}).includes('Jag skötte inventering.'),'No silent 14k/32k truncation');
assert.throws(()=>candidateSource({cv_text:'x'.repeat(120001)}));
assert.equal(minimizeMatchingText('Jag var ledare i moskéns ungdomsgrupp. Jag tog emot bokningar.').status,'review_required','Indirect religious disclosure triggers review');
// Capture the exact outgoing SDK request: no real provider or network call.
const original=Module._load;const payloads=[];let offline=false;
Module._load=function(name,parent,...rest){if(name==='openai')return {default:class {constructor(){this.chat={completions:{create:async payload=>{payloads.push(payload);if(offline)throw Error('offline');return {choices:[{message:{content:'{"criteria":[],"answers":[]}'}}]};}}};}}};return original.call(this,name,parent,...rest);};
try {
 const {requestMatchingEvidence}=require('../lib/matching-provider.ts');
 await requestMatchingEvidence('synthetic-key',minimized.text,matchingCriteria([{label:'Kassavana',required:true},{label:'Politisk övertygelse',required:true}]),[{id:'q1',question:'Berätta om kassasystemet'},{id:'q2',question:'Har du ADHD?'}]);
 const actual=JSON.parse(payloads[0].messages[1].content);
 assert.ok(actual.source.includes('inventerade lagret under juli 2025'));assert.ok(actual.source.includes('Jag kontrollerade leveranser.'));
 assert.deepEqual(actual.criteria.map(c=>c.label),['Kassavana']);assert.deepEqual(actual.questions.map(q=>q.id),['q1']);
 for(const secret of ['Alex Testsson','ADHD','SSU','alex@example.invalid','Testgatan','diabetes','muslim','PRIVATE'])assert.ok(!JSON.stringify(actual).includes(secret),'Outgoing '+secret);
 offline=true;await assert.rejects(requestMatchingEvidence('synthetic-key','Jag kan JavaScript.',matchingCriteria([{label:'JavaScript',required:true}])));
 const before=payloads.length;await assert.rejects(requestMatchingEvidence('synthetic-key','x'.repeat(120001),base));assert.equal(payloads.length,before,'Oversized text fails before provider call');
} finally {Module._load=original;}
console.log('PASS synonyms, explicit contradiction/unknown, no inferred personality or personality score, equal facts across text lengths, mixed approved text/structured details, local minimization and exact SDK payload, no raw drafts, oversize and provider outage. Provider simulated; minimizer is heuristic.');
