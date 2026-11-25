import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
const require = createRequire(import.meta.url);
function load(file, imports = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require','module','exports',compiled)(name => imports[name] ?? require(name), module,module.exports);
  return module.exports;
}
const jobs=load('../lib/youth-demo-data.ts',{'./demo-data':load('../lib/demo-data.ts')});
const chat=load('../lib/demo-chat.ts',{'./youth-demo-data':jobs});
const valid={jobId:'cafe',messages:[{own:false,text:'Hej Alex!'},{own:true,text:'Kan jag jobba helger?'}]};
assert.equal(chat.parseDemoChat(valid).messages.at(-1).role,'user');
for(const value of [null,{}, {...valid,jobId:'unknown'}, {...valid,messages:[]}, {...valid,messages:[{own:false,text:'Not a user'}]}, {...valid,messages:[{own:'user',text:'Invalid role'}]}, {...valid,messages:[{own:true,text:'x'.repeat(501)}]}, {...valid,messages:Array(13).fill({own:true,text:'Hi'})}]) assert.equal(chat.parseDemoChat(value),null);
assert.ok(chat.demoChatInstructions(jobs.youthJobs[0]).includes('Kvarterskaffet'));
assert.ok(!chat.demoChatInstructions(jobs.youthJobs[0]).includes('Gröna Hörnet'));
const {consumeDemoChatQuota}=load('../lib/demo-chat-quota.ts');
function database() {
  const rows=new Map();
  return {rows,from(){let operation='read', patch, filters=[];const query={
    select(){return query},eq(k,v){filters.push([k,v]);return query},
    async insert(row){await Promise.resolve();if(rows.has(row.bucket))return {error:{code:'23505'}};rows.set(row.bucket,{...row});return {error:null}},
    update(value){operation='update';patch=value;return query},
    async maybeSingle(){await Promise.resolve();const row=[...rows.values()].find(row=>filters.every(([key,value])=>row[key]===value));if(!row)return {data:null,error:null};if(operation==='update')Object.assign(row,patch);return {data:{...row},error:null}}
  };return query}};
}
const now=new Date('2026-11-15T18:00:00Z'), secret='test-only-secret';
const db=database();for(let i=0;i<6;i++)assert.equal(await consumeDemoChatQuota(db,secret,'test-ip',now),true);assert.equal(await consumeDemoChatQuota(db,secret,'test-ip',now),false);
for(let minute=1;minute<5;minute++)for(let i=0;i<6;i++)assert.equal(await consumeDemoChatQuota(db,secret,'test-ip',new Date(+now+minute*60000)),true);
assert.equal(await consumeDemoChatQuota(db,secret,'test-ip',new Date(+now+5*60000)),false);
assert.ok([...db.rows.values()].every(row=>!row.bucket.includes('test-ip')));
const globalKey=createHmac('sha256',secret).update('demo-chat:v1:global-day:2026-11-15').digest('hex');
assert.equal(db.rows.get(globalKey).window_start,'2026-11-16T00:00:00.000Z');
db.rows.get(globalKey).attempts=499;assert.equal(await consumeDemoChatQuota(db,secret,'another-ip',now),true);assert.equal(await consumeDemoChatQuota(db,secret,'third-ip',now),false);
const concurrent=database();const results=await Promise.all(Array.from({length:50},()=>consumeDemoChatQuota(concurrent,secret,'same-ip',now)));assert.ok(results.filter(Boolean).length<=6);assert.equal(concurrent.rows.get(globalKey)?.attempts || 0, results.filter(Boolean).length);
let calls=0, allow=true;
const FakeOpenAI=class { responses={create:async options=>{calls++;assert.equal(options.store,false);assert.equal(options.max_output_tokens,300);return {status:'completed',output_text:'Hej! Helger fungerar fint hos oss.'}}}; };
const saved={key:process.env.OPENAI_API_KEY,secret:process.env.SUPABASE_SECRET_KEY};process.env.OPENAI_API_KEY='test-key';process.env.SUPABASE_SECRET_KEY='test-secret';
try {
 const route=load('../app/api/demo/chat/route.ts',{'openai':FakeOpenAI,'@/lib/demo-chat':chat,'@/lib/prelaunch-server':{prelaunchDb:()=>({})},'@/lib/demo-chat-quota':{consumeDemoChatQuota:async()=>allow}});
 const request=(body=valid,origin='https://matchnwork.se')=>new Request('https://matchnwork.se/api/demo/chat',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await route.POST(request(valid,'https://other.example'))).status,403);assert.equal(calls,0);
 assert.equal((await route.POST(request({...valid,jobId:'unknown'}))).status,400);assert.equal(calls,0);
 allow=false;assert.equal((await route.POST(request())).status,429);assert.equal(calls,0);
 allow=true;const response=await route.POST(request());assert.equal(response.status,200);assert.equal((await response.json()).text,'Hej! Helger fungerar fint hos oss.');assert.equal(calls,1);
} finally { for(const [key,value] of [['OPENAI_API_KEY',saved.key],['SUPABASE_SECRET_KEY',saved.secret]])value===undefined?delete process.env[key]:process.env[key]=value; }
console.log('Demo chat: bounded validation, isolated job context, atomic IP/global quotas, concurrency, expiry, same-origin and no paid calls before validation passed.');
