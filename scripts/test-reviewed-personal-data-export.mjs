import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
import {unzipSync,strFromU8} from 'fflate';
const require=createRequire(import.meta.url),oldLoad=Module._load,oldTs=Module._extensions['.ts'];
Module._load=function(n,...args){return n==='server-only'?{}:oldLoad.call(this,n,...args);};
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {personalDataReviewFingerprint:hash,buildReviewedPersonalDataExport:build,ReviewedExportError}=require('../lib/server/reviewed-personal-data-export.ts');
const {EXPORT_CATEGORY_IDS:ids}=require('../lib/personal-data-export.ts');
const subject='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function fixture(){
 const file={ownerId:subject,bucketId:'youth-documents',name:'dokument-1.pdf',mimeType:'application/pdf',status:'included',bytes:new TextEncoder().encode('%PDF-1.7\nÅsa 🧑‍🍳')};
 const b={subjectId:subject,reviewState:'pending',collection:{subjectId:subject,reviewState:'pending',finishedAt:'2026-10-30T10:00:00.000Z',categories:ids.map(id=>({id,sources:[{relation:'qa.'+id,status:'collected',rows:[]}]}))},cv:{files:[file]}};
 const a={subjectId:subject,sourceFingerprint:hash(b),reviewedBy:other,reviewedAt:'2026-10-30T10:01:00.000Z',categories:ids.map(id=>id==='account'?{id,subjectId:subject,status:'included',records:[{subjectId:subject,data:{name:'Åsa',note:'Kan inte måndagar'}}],summary:[{label:'Namn',value:'Åsa'}]}:id==='storage-content'?{id,subjectId:subject,status:'included',records:[],summary:[]}:{id,subjectId:subject,status:'requires_review'}),files:[{...file,bytes:new Uint8Array(file.bytes)}]};
 const m={exportId:'33333333-3333-4333-8333-333333333333',createdAt:'2026-10-30T10:02:00.000Z',information:{controller:'QA',contact:'qa@example.invalid',purposes:['QA'],recipients:['QA'],retention:['QA'],sources:['QA'],rights:['QA'],automatedProcessing:['QA']}};
 return{b,a,m};
}
function rejects(change,code){const {b,a,m}=fixture();change(b,a,m);assert.throws(()=>build(b,a,m),e=>e instanceof ReviewedExportError&&e.code===code&&!e.message.includes('QA_PRIVATE'));}
try{
 await test('explicit reviewed data creates actual ZIP with original approved bytes',()=>{const {b,a,m}=fixture(),out=build(b,a,m),files=unzipSync(out.bytes);assert.equal(JSON.parse(strFromU8(files['uppgifter/account.json'])).records[0].name,'Åsa');assert.deepEqual(files[out.manifest.files[0].path],b.cv.files[0].bytes);assert.equal(out.manifest.coverage,'needs_completion');});
 await test('raw collected source never copied into reviewed package',()=>{const {b,a,m}=fixture();b.collection.categories[0].sources[0].rows.push({private:'QA_PRIVATE'});a.sourceFingerprint=hash(b);const out=build(b,a,m);for(const bytes of Object.values(unzipSync(out.bytes)))assert.ok(!strFromU8(bytes).includes('QA_PRIVATE'));});
 for(const mode of ['row','file'])await test('changed source requires new review: '+mode,()=>rejects(b=>{if(mode==='row')b.collection.categories[0].sources[0].rows.push({changed:true});else b.cv.files[0].bytes[0]=0;},'stale_review'));
 await test('object key order does not change fingerprint',()=>assert.equal(hash({b:2,a:1}),hash({a:1,b:2})));
 for(const mode of ['subject','reviewer','timestamp'])await test('invalid approval rejected: '+mode,()=>rejects((b,a)=>{if(mode==='subject')a.subjectId=other;if(mode==='reviewer')a.reviewedBy='no';if(mode==='timestamp')a.reviewedAt='invalid';},'invalid_review'));
 for(const time of ['2026-10-30T09:59:00.000Z','2026-10-30T10:03:00.000Z'])await test('review time must follow collection and precede creation: '+time,()=>rejects((b,a)=>{a.reviewedAt=time;},'invalid_review'));
 for(const status of ['unavailable','not_collected'])for(const decision of ['included','not_applicable'])await test('unread source cannot become complete: '+status+'/'+decision,()=>rejects((b,a)=>{b.collection.categories[0].sources[0].status=status;a.sourceFingerprint=hash(b);a.categories[0]={id:ids[0],subjectId:subject,status:decision,...(decision==='included'?{records:[],summary:[]}: {})};},'unread_source'));
 await test('outside-catalog category with no sources cannot be silently excluded',()=>rejects((b,a)=>{b.collection.categories[0].sources=[];a.sourceFingerprint=hash(b);a.categories[0]={id:ids[0],subjectId:subject,status:'not_applicable'};},'unread_source'));
 for(const mode of ['added','missing','renamed','bytes'])await test('approved file must match current original: '+mode,()=>rejects((b,a)=>{if(mode==='added')a.files.push(a.files[0]);if(mode==='missing')a.files=[];if(mode==='renamed')a.files[0].name='other.pdf';if(mode==='bytes')a.files[0].bytes[0]=0;},'file_mismatch'));
 await test('unavailable original cannot be approved as included',()=>rejects((b,a)=>{b.cv.files[0]={ownerId:subject,bucketId:'youth-documents',name:'dokument-1.pdf',mimeType:'application/pdf',status:'unavailable'};a.sourceFingerprint=hash(b);},'file_mismatch'));
 await test('reviewer can withhold an original file without publishing bytes',()=>{const {b,a,m}=fixture();const metadata={...a.files[0]};delete metadata.bytes;a.files=[{...metadata,status:'requires_review'}];const out=build(b,a,m);assert.equal(out.manifest.files[0].path,null);});
 await test('getters and toJSON are rejected without execution',()=>{let n=0;const x={get bad(){n++;throw Error('QA_PRIVATE');}};assert.throws(()=>hash(x),ReviewedExportError);assert.throws(()=>hash({toJSON(){n++;return'bad';}}),ReviewedExportError);assert.equal(n,0);});
 for(const value of [new Date(),NaN,Infinity,undefined,1n,'\ud800',Array(2),new Uint8Array(new SharedArrayBuffer(2))])await test('unsupported fingerprint data rejected: '+typeof value,()=>assert.throws(()=>hash(value),ReviewedExportError));
 await test('cyclic and excessive-depth fingerprints rejected',()=>{const x={};x.x=x;assert.throws(()=>hash(x),ReviewedExportError);let deep={};for(let i=0;i<26;i++)deep={deep};assert.throws(()=>hash(deep),ReviewedExportError);});
 console.log(`PASS ${passed} reviewed package checks. Local fictitious data and actual ZIP only.`);
}finally{Module._load=oldLoad;if(oldTs)Module._extensions['.ts']=oldTs;else delete Module._extensions['.ts'];}
