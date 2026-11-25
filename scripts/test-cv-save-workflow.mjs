import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),load=Module._load,oldFetch=globalThis.fetch;
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const env={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY};Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://qa.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'qa-public'});
let actor=owner,token='qa-token',mode='',calls=[],stored,uploadedPath=null,fileBytes=0,patchStarted=false;
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
Module._load=function(n,parent,...args){if(n==='@/lib/supabase')return{getSupabaseClient:()=>({auth:{getUser:async()=>({data:{user:actor?{id:actor}:null},error:null}),getSession:async()=>({data:{session:{user:{id:actor},access_token:token}},error:null})}})};if(n.startsWith('@/'))return load.call(this,path.resolve(n.slice(2)),parent,...args);return load.call(this,n,parent,...args);};
const cvModule=require('../lib/structured-cv.ts'),review=require('../lib/cv-fact-review.ts'),service=require('../lib/cv-save-workflow.ts');
const cv=cvModule.createEmptyStructuredCv({name:'QA Person',city:'Teststad'});cv.profile.summary='Jag hjälper gärna kunder.';const text=cvModule.renderStructuredCv(cv),approval=review.cvReviewSnapshot(text,cv);
const reviewed={kind:'reviewed',text,structured:cv,approval};
const originalDoc={type:'cv',name:'Original.pdf',url:owner+'/original.pdf'},otherDoc={type:'other',name:'Intyg.txt',url:owner+'/intyg.txt'};
const base=()=>({user_id:owner,documents:[originalDoc,otherDoc],...Object.fromEntries(Object.keys(review.reviewedCvPayload(text,cv,approval)).map(k=>[k,null])),full_name:'QA Person',address:'QA privat adress',cv_uploaded:false});
const reset=()=>{actor=owner;token='qa-token';mode='';calls=[];stored=base();uploadedPath=null;fileBytes=0;patchStarted=false;};
globalThis.fetch=async(input,init={})=>{
 const url=new URL(input,'https://app.invalid'),auth=new Headers(init.headers).get('authorization');assert.ok(['Bearer qa-token','Bearer qa-refreshed'].includes(auth));calls.push({url,method:init.method??'GET',auth,body:init.body});
 if(url.pathname==='/auth/v1/user')return Response.json({id:mode==='wrongidentity'?other:owner,email:'qa@example.invalid'});
 if(url.pathname==='/rest/v1/profiles'){assert.equal(url.searchParams.get('id'),'eq.'+owner);return Response.json({role:mode==='company'?'company':'youth'});}
 if(url.pathname==='/rest/v1/youth_profiles'){
  assert.equal(url.searchParams.get('user_id'),'eq.'+owner);
  if(init.method==='PATCH'){
   patchStarted=true;if(mode==='hang')return new Promise(()=>{});
   const fields=JSON.parse(init.body);assert.ok(!('address'in fields),'Unrelated private fields never written');
   if(mode!=='deny')stored={...stored,...fields};if(mode==='switch')actor=other;
   if(mode==='lost'||mode==='deny')return Response.json({message:'QA_PRIVATE'},{status:503});
   return Response.json(stored);
  }
  if(mode==='readfail'&&patchStarted)return Response.json({message:'QA_PRIVATE'},{status:503});
  if(mode==='partial'&&patchStarted){const {certificates,...rest}=stored;assert.equal(certificates,null);return Response.json(rest);}
  return Response.json(mode==='foreignrow'?{...stored,user_id:other}:stored);
 }
 if(url.pathname.startsWith('/storage/v1/object/info/youth-documents/')){
  const path=url.pathname.split('/youth-documents/')[1];assert.ok(path.startsWith(owner+'/'));
  if(mode==='missingfile')return Response.json({message:'QA_PRIVATE'},{status:404});
  return Response.json({name:path,size:mode==='oversize'?6*1024*1024:fileBytes||17,content_type:mode==='badmime'?'text/html':'application/pdf'});
 }
 if(url.pathname.startsWith('/storage/v1/object/youth-documents/')){
  assert.equal(init.method,'POST');assert.equal(new Headers(init.headers).get('x-upsert'),'false');uploadedPath=url.pathname.split('/youth-documents/')[1];assert.ok(uploadedPath.startsWith(owner+'/'));
  const file=init.body.get('');assert.equal(file.type,'application/pdf');assert.ok((await file.text()).startsWith('%PDF-'));fileBytes=file.size;
  if(mode==='uploadlost')return Response.json({message:'QA_PRIVATE'},{status:503});return Response.json({Key:'youth-documents/'+uploadedPath,Id:'qa-file'});
 }
 if(url.pathname==='/api/youth/applications/submit'){assert.deepEqual(JSON.parse(init.body),{action:'drafts'});return Response.json({application:{sent_count:1,unavailable_count:0,pending_count:0}});}
 throw Error('Unexpected request '+url.pathname);
};
const signal=()=>new AbortController().signal,patches=()=>calls.filter(c=>c.method==='PATCH').length,uploads=()=>calls.filter(c=>c.url.pathname.startsWith('/storage/v1/object/youth-documents/')).length;
try{
 reset();let task=service.createCvSave(owner,reviewed);await assert.rejects(task.submitDrafts(signal()));assert.equal(calls.length,0);await task.save(signal());assert.equal(patches(),1);await assert.rejects(task.save(signal()));assert.equal(patches(),1);assert.equal((await task.read(signal())).confirmed,true);assert.deepEqual(stored.documents,[originalDoc,otherDoc]);assert.equal(stored.address,'QA privat adress');await task.submitDrafts(signal());await assert.rejects(task.submitDrafts(signal()));assert.equal(calls.filter(c=>c.url.pathname.startsWith('/api/')).length,1);
 reset();task=service.createCvSave(owner,reviewed);await task.save(signal());token='qa-refreshed';assert.equal((await task.read(signal())).confirmed,true);assert.equal(calls.at(-1).auth,'Bearer qa-refreshed');assert.equal(patches(),1);
 for(const scenario of ['wrongidentity','foreignrow','company']){reset();mode=scenario;await assert.rejects(service.createCvSave(owner,reviewed).save(signal()));assert.equal(patches(),0);}
 reset();actor=other;await assert.rejects(service.createCvSave(owner,reviewed).save(signal()));assert.equal(calls.length,0);
 reset();assert.throws(()=>service.createCvSave(owner,{...reviewed,approval:null}));assert.equal(calls.length,0);
 for(const scenario of ['lost','deny']){reset();mode=scenario;task=service.createCvSave(owner,reviewed);await assert.rejects(task.save(signal()),e=>e instanceof service.CvSaveUnconfirmed&&!e.message.includes('QA_PRIVATE'));mode='';assert.equal((await task.read(signal())).confirmed,scenario==='lost');assert.equal(patches(),1);}
 reset();mode='partial';task=service.createCvSave(owner,reviewed);await task.save(signal());assert.equal((await task.read(signal())).confirmed,false);await assert.rejects(task.submitDrafts(signal()));
 reset();mode='readfail';task=service.createCvSave(owner,reviewed);await task.save(signal());await assert.rejects(task.read(signal()));mode='';assert.equal((await task.read(signal())).confirmed,true);assert.equal(patches(),1);
 reset();mode='switch';task=service.createCvSave(owner,reviewed);await task.save(signal());await assert.rejects(task.read(signal()));assert.equal(calls.filter(c=>c.url.pathname.startsWith('/api/')).length,0);
 for(const file of [new File(['HTML'],'bad.pdf',{type:'application/pdf'}),new File(['%PDF-foo'],'bad.html',{type:'text/html'}),new File([], 'empty.pdf',{type:'application/pdf'})]){reset();await assert.rejects(service.uploadOwnedCvPdf(owner,file,signal()));assert.equal(uploads(),0);assert.equal(calls.length,0);}
 reset();const document=await service.uploadOwnedCvPdf(owner,new File(['%PDF-1.7\nQA bytes'],'QA.pdf'),signal());assert.equal(document.url,uploadedPath);assert.equal(uploads(),1);task=service.createCvSave(owner,{kind:'uploaded',document});await task.save(signal());assert.equal((await task.read(signal())).confirmed,true);assert.equal(stored.cv_uploaded,true);assert.equal(stored.cv_generated,false);assert.deepEqual(stored.documents,[otherDoc,document]);assert.equal(uploads(),1);
 reset();mode='uploadlost';let candidate;await assert.rejects(service.uploadOwnedCvPdf(owner,new File(['%PDF-1.7 QA'],'QA.pdf',{type:'application/pdf'}),signal()),e=>{candidate=e.document;return e instanceof service.CvUploadUnconfirmed;});mode='';await service.verifyOwnedCvUpload(owner,candidate,signal());assert.equal(uploads(),1,'Verification never reuploads');
 for(const scenario of ['missingfile','oversize','badmime']){reset();mode=scenario;await assert.rejects(service.createCvSave(owner,{kind:'uploaded',document:originalDoc}).save(signal()));assert.equal(patches(),0);}
 reset();assert.throws(()=>service.createCvSave(owner,{kind:'uploaded',document:{...originalDoc,url:other+'/foreign.pdf'}}));assert.equal(calls.length,0);
 reset();mode='hang';const controller=new AbortController();task=service.createCvSave(owner,reviewed);const pending=task.save(controller.signal);while(!patchStarted)await new Promise(setImmediate);controller.abort();await assert.rejects(pending,e=>e instanceof service.CvSaveUnconfirmed);assert.equal(patches(),1);
 console.log('PASS actual CV workflow through installed SDK/simulated HTTP: scoped identity/role/token, exact reviewed approval, field/document preservation, one save attempt, lost/rejected write and read-only recovery, refreshed same-owner token, PDF header/MIME/size, private non-upsert upload, uncertain upload verification, one owned draft-submission attempt, abort and account change. No live writes or AI.');
}finally{Module._load=load;globalThis.fetch=oldFetch;if(env.url===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=env.url;if(env.key===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=env.key;}
