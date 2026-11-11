import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ts from 'typescript';
import {unzipSync,strFromU8} from 'fflate';
import {historyRows,historyFields,HISTORY_SUBJECT as subject,HISTORY_OTHER as id,HISTORY_TIME as time} from './fixtures/structured-export-history.mjs';
const require=createRequire(import.meta.url),load=Module._load,ext=Module._extensions['.ts'];
Module._load=function(n,...args){return n==='server-only'?{}:load.call(this,n,...args);};
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {buildStructuredPersonalDataExport:structured}=require('../lib/server/structured-personal-data-export.ts'),{buildPersonalDataExport:build}=require('../lib/personal-data-export.ts'),{readableExportRecord:render}=require('../lib/personal-data-export-display.ts');
const inventory=require('../docs/privacy/personal-data-inventory.json'),groups=[...inventory.groups,...inventory.outsideCatalog];
const info={controller:'QA',contact:'qa@example.invalid',purposes:['QA'],recipients:['QA'],retention:['QA'],sources:['QA'],rights:['QA'],automatedProcessing:['QA']};
let passed=0,browser;const dir=mkdtempSync(join(tmpdir(),'mnw-readable-'));
function check(ok,label){assert.ok(ok,label);passed++;console.log('PASS '+label);}
function packageFor(role){const rows={...historyRows(role),'public.profiles':[{id:subject,role}]};if(role==='youth')Object.assign(rows,{
 'public.youth_profiles':[{user_id:subject,onboarding_completed:true,cv_generated:false,cv_uploaded:null,short_onboarding_completed:true,recruitment_profile_version:3,updated_at:time}],
 'public.youth_application_drafts':[{id,youth_user_id:subject,job_id:id,created_at:time,updated_at:time}],
 'public.youth_saved_jobs':[{id,youth_user_id:subject,job_id:id,created_at:time}],
 'public.youth_job_impressions':[{youth_user_id:subject,job_id:id,first_seen_at:time}],
 'public.youth_job_dismissals':[{youth_user_id:subject,job_id:id,dismissed_at:time}],
 'public.swipe_actions':[{id,youth_user_id:subject,job_id:id,decision:'interested',created_at:time}],
 'public.application_workplace_preferences':[{youth_user_id:subject,job_id:id,workplace_id:id,updated_at:time}],
});const categories=groups.map(g=>({id:g.id,reviewState:'pending',sources:(g.relations??[]).map(relation=>rows[relation]?{relation,status:'collected',rows:rows[relation]}:{relation,status:'not_collected'})}));
 return {rows,result:structured({subjectId:subject,reviewState:'pending',consistency:'non_transactional',collection:{version:1,subjectId:subject,startedAt:time,finishedAt:time,reviewState:'pending',visibility:'subject_review',consistency:'non_transactional',categories},cv:null},{exportId:id,createdAt:time,information:info})};}
const samples={};
try{
 for(const role of ['youth','company','private']){
  const {rows,result}=packageFor(role),entries=unzipSync(result.bytes),html=strFromU8(entries['LAS-MIG.html']);samples[role]=html;
  check(html.includes('class="record"')&&!html.includes('QA_PRIVATE'),role+' actual ZIP shows projected records without excluded raw material');
  check(!html.includes('<script')&&!html.includes('<iframe')&&!html.includes('<img'),role+' HTML contains no executable injected elements');
  check(result.manifest.coverage==='needs_completion'&&result.manifest.pendingCategories.length===25,role+' readable view retains incomplete coverage');
  for(const [relation,records]of Object.entries(rows)){
   const category=groups.find(g=>g.relations?.includes(relation)).id;
   const json=JSON.parse(strFromU8(entries['uppgifter/'+category+'.json'])),actual=json.records.find(r=>r.source===relation);
   const keys=historyFields[relation]??Object.keys(records[0]);
   assert.deepEqual(actual,{source:relation,...Object.fromEntries(keys.map(k=>[k,records[0][k]]))});
   check(html.includes(records[0].id??records[0].job_id??records[0].user_id??records[0].company_user_id),role+' record ID retained: '+relation);
  }
 }
 const cases=[
  [{source:'public.profiles',role:'youth'},'Kontotyp','Ungdom'],
  [{source:'public.application_completions',status:'withdrawn'},'Status','Återkallad'],
  [{source:'public.application_followups',status:'pending'},'Status','Obesvarad'],
  [{source:'public.application_followups',status:'skipped'},'Status','Avstått'],
  [{source:'public.jobs',status:'closed'},'Status','Stängd'],
  [{source:'public.company_profiles',verification_status:'rejected'},'Verifieringsstatus','Inte godkänt'],
  [{source:'public.company_match_profiles',profile_version:7},'Företagsprofilens version','7'],
  [{source:'public.application_completions',profile_version:7},'Kravprofilens version','7'],
  [{source:'public.company_recruitment_controls',restriction:'none'},'Rekryteringsbegränsning','Ingen begränsning'],
  [{source:'public.recruitment_outcomes',outcome:'no_hire'},'Utfall','Ingen anställd'],
  [{source:'public.company_billing_details',country_code:'SE'},'Land','Sverige (SE)'],
  [{source:'public.youth_profiles',cv_generated:false},'CV genererat','Nej'],
  [{source:'public.youth_profiles',cv_uploaded:null},'CV uppladdat','Inget angivet värde'],
 ];for(const [row,label,value]of cases){const html=render(row,1);check(html.includes(label)&&html.includes(value),'Swedish label/value '+label+'/'+value);}
 check(render({source:'public.jobs',status:'future_state'},1).includes('future_state'),'unknown enum is preserved instead of invented');
 const unknown=render({source:'future.source',status:'submitted',free_text:'Inte erfaren. Åäö 🧑‍🍳 SLUTMARKÖR'},1);check(unknown.includes('future.source')&&unknown.includes('submitted')&&unknown.includes('Inte erfaren. Åäö 🧑‍🍳 SLUTMARKÖR'),'generic reviewed strings and unknown sources remain verbatim');
 const malicious=render({'<img src=x onerror=alert(1)>':'<script>alert(1)</script>',nested:{text:'<iframe src="https://example.invalid">x</iframe>'},url:'https://example.invalid'},1);
 check(!malicious.includes('<script')&&!malicious.includes('<img')&&!malicious.includes('<iframe')&&!malicious.includes('<a '),'generic field names, nested JSON and URLs never create markup or links');
 check(malicious.includes('&lt;script&gt;')&&malicious.includes('&lt;iframe'),'HTML-sensitive data remains readable after escaping');
 check(render(['Text','<img>'],1).includes('&lt;img&gt;'),'top-level reviewed arrays remain readable and escaped');
 check(render('Hel originaltext Åäö',1).includes('Hel originaltext Åäö'),'top-level reviewed scalar retained');
 const timestamp='2026-10-30T15:30:00.123456+05:30',dated=render({source:'public.youth_saved_jobs',created_at:timestamp},1);
 check(dated.includes('datetime="'+timestamp+'"')&&dated.includes('11:00:00')&&dated.includes('(Stockholm)'),'offset/microsecond timestamp preserved with explicit Stockholm display');
 check(render({source:'public.youth_saved_jobs',created_at:'not-a-date'},1).includes('not-a-date'),'invalid date is never reformatted');
 check(render({source:'public.youth_saved_jobs',future_at:timestamp},1).includes('>'+timestamp+'<'),'unknown timestamp field remains verbatim');
 // Every field in the production scalar policy must have a human label.
 const source=ts.createSourceFile('policy.ts',readFileSync('lib/server/structured-personal-data-export.ts','utf8'),ts.ScriptTarget.Latest,true);let policies;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='POLICIES')policies=n.initializer;else ts.forEachChild(n,visit);}visit(source);
 for(const policy of policies.properties){const relation=policy.name.text,fields=policy.initializer.properties.find(p=>p.name.text==='fields').initializer.properties;
  const row={source:relation,...Object.fromEntries(fields.map(f=>[f.name.text,'QA_VALUE']))};const html=render(row,1);check(!html.includes('>Post 1<')&&fields.every(f=>f.name.text==='id'||!html.includes('<dt>'+f.name.text+'</dt>')),'all known fields have readable labels: '+relation);
 }
 // Build a generic reviewed payload as a second actual archive for browser XSS checks.
 const generic={subjectId:subject,exportId:id,createdAt:time,information:info,categories:groups.map(g=>({id:g.id,subjectId:subject,status:g.id==='account'?'included':'requires_review',...(g.id==='account'?{records:[{subjectId:subject,data:{text:'<script>globalThis.__EXPORT_XSS__=1</script>',nested:{image:'<img src="https://example.invalid/x">'},cv:'Inte erfaren. Åäö 🧑‍🍳 SLUTMARKÖR'}}],summary:[{label:'QA',value:'QA'}]}:{})}))};
 const genericZip=unzipSync(build(subject,generic).bytes);samples.generic=strFromU8(genericZip['LAS-MIG.html']);
 check(JSON.parse(strFromU8(genericZip['uppgifter/account.json'])).records[0].cv.endsWith('SLUTMARKÖR'),'JSON text stays unchanged alongside new HTML');
 if(process.env.MNW_READABLE_CHROMIUM){const playwright=require(process.env.MNW_PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));browser=await playwright.chromium.launch({headless:true,executablePath:process.env.MNW_READABLE_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});console.log('BROWSER '+browser.version());const page=await browser.newPage(),network=[],errors=[];page.on('request',r=>{if(!r.url().startsWith('file:'))network.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  for(const [role,html]of Object.entries(samples)){const file=join(dir,role+'.html');writeFileSync(file,html);for(const width of [375,768,1280]){await page.setViewportSize({width,height:812});await page.goto('file://'+file);check(await page.locator('.record').count()>0,role+'/'+width+' actual extracted HTML displays records');check(await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)<=innerWidth+1),role+'/'+width+' no horizontal overflow');check(await page.locator('script,img,iframe').count()===0&&await page.evaluate(()=>typeof globalThis.__EXPORT_XSS__==='undefined'),role+'/'+width+' no script/image/frame injection');}
   if(role==='company'&&process.env.MNW_READABLE_SCREENSHOT){await page.setViewportSize({width:375,height:812});await page.locator('#del-account').scrollIntoViewIfNeeded();await page.screenshot({path:process.env.MNW_READABLE_SCREENSHOT});}
  }
  check(network.length===0&&errors.length===0,'offline HTML has no external network or browser exceptions');
 }
 console.log(`PASS ${passed} readable export checks; actual ZIP/HTML/JSON, browser=${!!browser}; no account or backend requests.`);
}finally{rmSync(dir,{recursive:true,force:true});await browser?.close();Module._load=load;if(ext)Module._extensions['.ts']=ext;else delete Module._extensions['.ts'];}
