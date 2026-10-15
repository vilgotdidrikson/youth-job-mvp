import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url);
Module._extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {validateJobWorkplaces,getJobWorkplaces,jobMatchesCity,jobCities}=require('../lib/job-workplaces.ts');
const places=[{id:'11111111-1111-4111-8111-111111111111',name:'City',address:' Gatan 1 ',postal_code:'11111',city:'Stockholm',longitude:18,latitude:59},{id:'22222222-2222-4222-8222-222222222222',name:'Väst',address:'Gatan 2',postal_code:'22222',city:'Göteborg',longitude:12,latitude:58}];
assert.equal(validateJobWorkplaces(places)[0].address,'Gatan 1');
for(const input of [[],[...places,places[0]],Array(11).fill(places[0]),[{...places[0],name:''}],[{...places[0],longitude:200}],[{...places[0],latitude:NaN}],[{...places[0],longitude:null}],[{...places[0],id:'invalid'}]])assert.throws(()=>validateJobWorkplaces(input));
assert.equal(jobMatchesCity({workplaces:places},' göteborg '),true);assert.equal(jobMatchesCity({workplaces:places},'Umeå'),false);assert.equal(jobCities({workplaces:places}),'Stockholm / Göteborg');assert.equal(getJobWorkplaces({id:'legacy',city:'Umeå'})[0].city,'Umeå');
const writes=[];const rows=[];let currentUser='company-a';
const db={from(table){assert.equal(table,'jobs');let data;return {insert(payload){writes.push(structuredClone(payload));data={id:'job-1',created_at:'now',...payload};rows.push(data);return this;},update(payload){writes.push(structuredClone(payload));data={...rows[0],...payload};return this;},select(){return this;},eq(){return this;},async single(){return {data,error:null};},async maybeSingle(){return {data:rows[0],error:null};}};}};
const load=Module._load;
Module._load=function(request,parent,...rest){if(request==='@/lib/auth')return {getCurrentUser:async()=>({id:currentUser,email:'qa@example.invalid'}),getUserProfile:async()=>({role:'company'})};if(request==='@/lib/supabase')return {getSupabaseClient:()=>db};if(request==='@/lib/job-location')return {geocodeJobLocation:async({city})=>({longitude:city==='Göteborg'?12:18,latitude:59})};if(request.startsWith('@/'))return load.call(this,path.resolve(request.slice(2)),parent,...rest);return load.call(this,request,parent,...rest);};
try{
const {createJob,updateJob}=require('../lib/jobs.ts');
const created=await createJob({title:'QA',description:'QA',city:'Stockholm',address:'Gatan 1',salary_per_hour:'',employment_type:'Deltid',workplaces:places.map(p=>({...p,longitude:null,latitude:null}))});
assert.equal(writes.length,1);assert.equal(created.workplaces.length,2);assert.equal(writes[0].workplaces[1].longitude,12);assert.equal(writes[0].company_user_id,'company-a');
await updateJob('job-1',{workplaces:[places[1]]});assert.equal(writes.at(-1).workplaces.length,1);
const count=writes.length;currentUser='company-b';await assert.rejects(updateJob('job-1',{workplaces:places}),/own jobs/);assert.equal(writes.length,count);
currentUser='company-a';await assert.rejects(createJob({title:'QA',description:'QA',city:'Stockholm',salary_per_hour:'',employment_type:'Deltid',workplaces:[]}),/1–10/);assert.equal(writes.length,count);
}finally{Module._load=load;}
console.log('PASS workplace validation, geocoding, create/update payloads, foreign owner denial, legacy fallback and all-city filtering.');
