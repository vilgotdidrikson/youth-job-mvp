import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';
import {unzipSync,strFromU8} from 'fflate';
const require=createRequire(import.meta.url),oldTs=Module._extensions['.ts'];
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {buildPersonalDataExport:buildForSubject,EXPORT_CATEGORY_IDS:ids,EXPORT_LIMITS:limits,ExportPackageError}=require('../lib/personal-data-export.ts');
const subject='11111111-1111-4111-8111-111111111111',foreign='22222222-2222-4222-8222-222222222222';
const build=(i,files=[])=>buildForSubject(subject,i,files);
const cv='Jag kan inte arbeta måndagar. Jag har själv beskrivit ADHD. Åsa Öberg – caféarbete 🧑‍🍳.\nSLUTMARKÖR';
const row=data=>({subjectId:subject,data});
const input=()=>({subjectId:subject,exportId:'33333333-3333-4333-8333-333333333333',createdAt:'2026-10-28T10:00:00.000Z',information:{controller:'QA Exportverksamhet',contact:'qa@example.invalid',purposes:['Fiktivt exportprov'],recipients:['QA mottagare'],retention:['QA granskningsunderlag'],sources:['Egna fiktiva uppgifter'],rights:['Fiktiv information, inte en juridisk bedömning'],automatedProcessing:['Fiktiv beskrivning']},categories:ids.map(id=>id==='account'?{id,subjectId:subject,status:'included',records:[row({full_name:'Åsa Öberg',cv_text:cv})],summary:[{label:'Namn',value:'Åsa Öberg'},{label:'Underlag',value:cv}]}:id==='storage-content'?{id,subjectId:subject,status:'included',records:[],summary:[]}:{id,subjectId:subject,status:'requires_review'})});
const file=(values={})=>({ownerId:subject,bucketId:'youth-documents',name:'Åsas CV #1.pdf',mimeType:'application/pdf',status:'included',bytes:new TextEncoder().encode('%PDF-1.4\n% Fiktivt QA-dokument\n%%EOF\n'),...values});
let passed=0;
const rejects=(change,code='invalid_input')=>{const i=input(),f=[];change(i,f);assert.throws(()=>build(i,f),e=>e instanceof ExportPackageError&&e.code===code&&!e.message.includes('QA_PRIVATE'));passed++;};
const dir=mkdtempSync(join(tmpdir(),'mnw-export-'));
try {
 const i=input(),f=file(),archive=build(i,[f,file()]),entries=unzipSync(archive.bytes);assert.equal(archive.mimeType,'application/zip');assert.equal(Object.keys(entries).length,6);passed++;
 const manifest=JSON.parse(strFromU8(entries['oversikt.json']));assert.equal(manifest.categories.length,24);assert.equal(manifest.coverage,'needs_completion');assert.equal('complete' in manifest,false);assert.equal(manifest.pendingCategories.length,22);passed++;
 assert.deepEqual(JSON.parse(strFromU8(entries['uppgifter/account.json'])).records,[{full_name:'Åsa Öberg',cv_text:cv}]);assert.deepEqual(entries[manifest.files[0].path],f.bytes);assert.ok(manifest.files[0].path!==manifest.files[1].path);passed++;
 f.bytes.fill(0);i.information.controller='CHANGED';assert.ok(strFromU8(entries[manifest.files[0].path]).startsWith('%PDF'));assert.equal(archive.manifest.information.controller,'QA Exportverksamhet');passed++;
 const reordered=input();reordered.categories.reverse();assert.deepEqual(build(reordered,[file(),file()]).bytes,archive.bytes);passed++;
 const partial=input();for(const c of partial.categories)if(c.status==='requires_review')c.status='not_applicable';const missing={ownerId:subject,bucketId:'youth-documents',name:'Återstår.pdf',mimeType:'application/pdf',status:'unavailable'};const p=build(partial,[missing]);assert.equal(p.manifest.coverage,'needs_completion');assert.equal(p.manifest.pendingFiles,1);assert.equal(p.manifest.files[0].path,null);assert.ok(!Object.keys(unzipSync(p.bytes)).some(x=>x.startsWith('filer/')));passed++;
 assert.equal(build(partial).manifest.coverage,'provided_sources_included');passed++;
 rejects(i=>i.categories.pop(),'incomplete_inventory');rejects(i=>i.categories.push(i.categories[0]),'incomplete_inventory');rejects(i=>i.categories[1]={...i.categories[0]},'incomplete_inventory');rejects(i=>i.categories[0].id='new-unreviewed-source','incomplete_inventory');
 rejects(i=>{i.subjectId=foreign;for(const c of i.categories){c.subjectId=foreign;for(const r of c.records||[])r.subjectId=foreign;}},'scope_mismatch');rejects(i=>i.categories[0].subjectId=foreign,'scope_mismatch');rejects(i=>i.categories[0].records[0].subjectId=foreign,'scope_mismatch');rejects((i,f)=>f.push(file({ownerId:foreign})),'scope_mismatch');
 rejects(i=>i.categories.find(c=>c.id==='safety').records=[row('QA_PRIVATE')]);rejects(i=>i.categories[0].records=[{data:'Missing subject'}]);rejects(i=>i.information.debugPayload={raw:'QA_PRIVATE'});rejects(i=>i.debugPayload='QA_PRIVATE');rejects(i=>delete i.information.rights);rejects(i=>i.createdAt='2026-02-31T10:00:00.000Z');rejects(i=>i.categories[0].status='complete');rejects(i=>i.categories[0].summary=[]);
 for(const key of ['password','refresh_token','authorization','API-Key','lockToken','ａｃｃｅｓｓ＿ｔｏｋｅｎ','pa\u200bssword','__proto__'])rejects(i=>i.categories[0].records=[row(JSON.parse(JSON.stringify({safe:'x'}).slice(0,-1)+',"'+key+'":"QA_PRIVATE"}'))],'unsafe_field');
 for(const value of [undefined,NaN,Infinity,-0,Number.MAX_SAFE_INTEGER+1,1n,()=>{},new Date(),new Error('QA_PRIVATE'),[1,,3],'\ud800'])rejects(i=>i.categories[0].records=[row(value)]);
 rejects(i=>{const x={};x.self=x;i.categories[0].records=[row(x)];});
 let invoked=0;rejects(i=>{const x={};Object.defineProperty(x,'private',{enumerable:true,get(){invoked++;return'QA_PRIVATE';}});i.categories[0].records=[row(x)];});assert.equal(invoked,0);passed++;
 rejects(i=>{i.categories[0].records=[row({toJSON(){invoked++;return'QA_PRIVATE';}})];});assert.equal(invoked,0);passed++;
 rejects(i=>{i.categories[0].records=[row(new Proxy({},{getOwnPropertyDescriptor(){throw Error('QA_PRIVATE');},ownKeys(){throw Error('QA_PRIVATE');}}))];});
 for(const name of ['../cv.pdf','/tmp/cv.pdf','C:\\cv.pdf','..','NUL.pdf','COM1.pdf','.hidden.pdf','cv.pdf.','cv?.pdf','cv\u202e.pdf','A\u030asa.pdf','字'.repeat(100)+'.pdf'])rejects((i,f)=>f.push(file({name})),'unsafe_file');
 rejects((i,f)=>f.push(file({mimeType:'text/html'})),'unsafe_file');rejects((i,f)=>f.push(file({name:'cv.html'})),'unsafe_file');rejects((i,f)=>f.push(file({bucketId:'../other'})),'unsafe_file');rejects((i,f)=>f.push(file({status:'unavailable'})),'unsafe_file');rejects((i,f)=>f.push(file({url:'https://example.invalid/QA_PRIVATE'})),'unsafe_file');
 rejects((i,f)=>{const x=file();Object.defineProperty(x,'name',{enumerable:true,get(){invoked++;return'QA_PRIVATE.pdf';}});f.push(x);},'unsafe_file');assert.equal(invoked,0);passed++;
 rejects((i,f)=>{i.categories.find(c=>c.id==='storage-content').status='requires_review';delete i.categories.find(c=>c.id==='storage-content').records;delete i.categories.find(c=>c.id==='storage-content').summary;f.push(file());},'unsafe_file');
 rejects((i,f)=>f.push(file({bytes:new Uint8Array(limits.fileBytes+1)})),'too_large');rejects((i,f)=>f.push(...Array.from({length:limits.files+1},()=>file())),'too_large');
 rejects(i=>i.categories[0].records=[row({text:'x'.repeat(limits.jsonBytes+1)})],'too_large');rejects(i=>i.categories[0].records=[row(Array(limits.nodes+1).fill(null))],'too_large');
 rejects((i,f)=>{const bytes=new Uint8Array(23*1024*1024);f.push(file({bytes}),file({bytes}),file({bytes}));},'too_large');
 rejects((i,f)=>{const a=file({name:'1.pdf',bytes:new Uint8Array()}),b=file({name:'2.pdf',bytes:new Uint8Array()});const needed=limits.totalBytes-build(input(),[a,b]).bytes.length+1;a.bytes=new Uint8Array(Math.floor(needed/2));b.bytes=new Uint8Array(Math.ceil(needed/2));f.push(a,b);},'too_large');
 const xss=input();xss.categories[0].summary.push({label:'<script>__EXPORT_XSS__=1</script>',value:'<img src="https://example.invalid/QA_PRIVATE" onerror="__EXPORT_XSS__=1">'});xss.categories[0].summary.push({label:'L'.repeat(120),value:'långt'.repeat(700)});xss.information.contact='<iframe src="https://example.invalid/QA_PRIVATE"></iframe>';
 const web=build(xss,[file()]),html=strFromU8(unzipSync(web.bytes)['LAS-MIG.html']);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<iframe'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('default-src \'none\''));assert.ok(html.includes('%C3%85sas%20CV%20%231.pdf'));passed++;
 writeFileSync(join(dir,'export.zip'),web.bytes);
 const verify=spawnSync('python',['-c',`import zipfile,sys,pathlib,json\nz=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None\nassert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts and '\\\\' not in n for n in z.namelist())\nassert json.loads(z.read('uppgifter/account.json'))['records'][0]['cv_text'].endswith('SLUTMARKÖR')\nassert any('Åsas CV #1.pdf' in n for n in z.namelist())\nz.extractall(sys.argv[2])`,join(dir,'export.zip'),join(dir,'unpacked')],{encoding:'utf8'});assert.equal(verify.status,0,verify.stderr);passed++;
 // Optional real Chromium check, with no external network access in the summary.
 if(process.env.MNW_EXPORT_PLAYWRIGHT_MODULE){
  const {chromium}=require(process.env.MNW_EXPORT_PLAYWRIGHT_MODULE),custom=process.env.MNW_EXPORT_CHROMIUM_MODULE?require(process.env.MNW_EXPORT_CHROMIUM_MODULE).default:null;
  const server=await chromium.launchServer({headless:true,...(custom?{executablePath:await custom.executablePath(),args:custom.args.filter(a=>a!=='--single-process')}:{})});
  try{const browser=await chromium.connect(server.wsEndpoint()),page=await browser.newPage();const requests=[];page.on('request',request=>{if(!request.url().startsWith('file:'))requests.push(request.url());});
   for(const width of [375,1280]){await page.setViewportSize({width,height:812});await page.goto('file://'+join(dir,'unpacked','LAS-MIG.html'));assert.equal(await page.locator('h1').innerText(),'Dina uppgifter');assert.equal(await page.locator('script,img,iframe').count(),0);assert.equal(await page.evaluate(()=>typeof globalThis.__EXPORT_XSS__),'undefined');assert.ok(await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)<=innerWidth+1));assert.ok((await page.locator('main').innerText()).includes(cv));passed++;}
   assert.equal(requests.length,0);passed++;
   if(process.env.MNW_EXPORT_SCREENSHOT_DIR){mkdirSync(process.env.MNW_EXPORT_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.MNW_EXPORT_SCREENSHOT_DIR,'export-desktop.png'),fullPage:true});await page.setViewportSize({width:375,height:812});await page.screenshot({path:join(process.env.MNW_EXPORT_SCREENSHOT_DIR,'export-mobile.png'),fullPage:true});}
  }finally{await server.kill();}
 }
 console.log(`PASS ${passed} export-package checks: actual ZIP/independent Python CRC+UTF-8 extraction, faithful own text/files, inventory/scope checks, missing-file status, escaped HTML, no secret-field serialization/getters, safe paths and explicit size failures. Browser checks: ${!!process.env.MNW_EXPORT_PLAYWRIGHT_MODULE}. No Auth, database, provider or storage requests.`);
}finally{rmSync(dir,{recursive:true,force:true});if(oldTs)Module._extensions['.ts']=oldTs;else delete Module._extensions['.ts'];}
