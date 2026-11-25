// Isolated real-browser acceptance. No backend, credentials or product flags.
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {resolve,join} from 'node:path';
import {zipSync,strToU8} from 'fflate';
const require=createRequire(import.meta.url),root=resolve('.');
const webpack=require('next/dist/compiled/webpack/webpack').webpack;
const playwright=require(process.env.MNW_PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||root]}));
const tmp=mkdtempSync(join(root,'.export-browser-'));
let browser,server,compiler,passed=0;
const check=(ok,label)=>{assert.ok(ok,label);passed++;console.log('PASS '+label);};
const fixture=join(tmp,'auth.js'),entry=join(tmp,'entry.tsx');
writeFileSync(fixture,`let user={id:'A'}, listeners=new Set();export const getSupabaseClient=()=>({auth:{getSession:async()=>({data:{session:user?{user,access_token:'qa-token'}:null},error:null}),onAuthStateChange(fn){listeners.add(fn);return{data:{subscription:{unsubscribe(){listeners.delete(fn)}}}}}}});window.qaSwitch=()=>{user={id:'B'};for(const f of listeners)f('SIGNED_IN',{user});};`);
writeFileSync(entry,`import React from 'react';import{createRoot}from'react-dom/client';import{ExportAccountControl}from'../components/export-account-control';const root=createRoot(document.getElementById('root'));window.qaUnmount=()=>root.unmount();window.qaUrls={created:0,revoked:0};const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=(b)=>{window.qaUrls.created++;return create(b)};URL.revokeObjectURL=(u)=>{window.qaUrls.revoked++;revoke(u)};root.render(<React.StrictMode><ExportAccountControl userId="A"/></React.StrictMode>);`);
writeFileSync(join(tmp,'ts-loader.cjs'),`module.exports=s=>require(${JSON.stringify(require.resolve('typescript'))}).transpileModule(s,{compilerOptions:{target:9,module:99,jsx:4}}).outputText;`);
writeFileSync(join(tmp,'css-loader.cjs'),`module.exports=()=> 'module.exports={dialog:"dialog",fields:"fields",actions:"actions"};';`);
const style=readFileSync('app/styles/theme.css','utf8')+readFileSync('app/globals.css','utf8').replace(/^@import .*$/gm,'')+readFileSync('components/delete-account-control.module.css','utf8');
try{
 compiler=webpack({mode:'development',target:'web',entry,devtool:false,output:{path:tmp,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@':root}},module:{rules:[{test:/\.tsx?$/,use:join(tmp,'ts-loader.cjs')},{test:/\.css$/,use:join(tmp,'css-loader.cjs')}]},plugins:[new webpack.DefinePlugin({'process.env.NEXT_PUBLIC_EXPORT_PREVIEW_UI':JSON.stringify('true'),'process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify('https://vwcfjvwfeatvuisojwrh.supabase.co')}),new webpack.NormalModuleReplacementPlugin(/^(?:\.\/supabase|@\/lib\/supabase)$/,r=>{r.request=fixture;})]});
 await new Promise((done,fail)=>compiler.run((error,stats)=>error?fail(error):stats.hasErrors()?fail(Error(stats.toString({all:false,errors:true}))):done()));
 server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(readFileSync(join(tmp,'bundle.js')));}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css; charset=utf-8');res.end(style);}else if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><main style="padding:16px"><div id="root"></div></main><script src="/bundle.js"></script></body></html>');}else{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 browser=await playwright.chromium.launch({headless:true,...(process.env.MNW_CHROMIUM_EXECUTABLE?{executablePath:process.env.MNW_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 console.log('BROWSER '+browser.version());
 const context=await browser.newContext({viewport:{width:375,height:812},acceptDownloads:true}),page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Forbid all nonlocal requests: this fixture cannot contact Supabase or a user account.
 let mode='success',requests=0,held,paths=[];
 const zip=zipSync({'QA.txt':strToU8('Fiktivt browserprov Åäö.')}),name='matchnwork-ofullstandigt-prov-11111111-1111-4111-8111-111111111111.zip';
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==base){await route.abort();return;}
  if(!['/api/account/export-preview','/api/account/export-preview/recover'].includes(url.pathname)){await route.continue();return;}
  requests++;paths.push(url.pathname);assert.equal(request.headers().authorization,'Bearer qa-token');assert.deepEqual(request.postDataJSON(),{expectedUserId:'A',password:'qa-password'});
  if(mode.startsWith('status-')){const status=mode.slice(7),json=JSON.stringify(status==='building'?{status,expiresAt:new Date(Date.now()+3600000).toISOString()}:{status});await route.fulfill({status:200,headers:{'Content-Type':'application/json','Content-Length':String(Buffer.byteLength(json))},body:json});return;}
  if(mode==='hold'){held=route;return;}
  if(mode==='error'){await route.fulfill({status:403,contentType:'application/json',body:'{"error":"QA_PRIVATE"}'});return;}
  await route.fulfill({status:200,headers:{'Content-Type':'application/zip','Content-Length':String(zip.length),'Content-Disposition':`attachment; filename="${name}"`,'X-MatchnWork-Export-Coverage':'needs_completion','X-MatchnWork-Export-Expires':new Date(Date.now()+3600000).toISOString()},body:Buffer.from(zip)});
 });
 const opener=page.getByRole('button',{name:'Hämta exportprov'}),dialog=page.getByRole('dialog');
 async function fresh(){await page.goto(base);await opener.waitFor();requests=0;held=undefined;paths=[];}
 for(const width of [375,768,1280]){
  await page.setViewportSize({width,height:812});await fresh();await opener.click();await dialog.waitFor();
  check(await dialog.evaluate(e=>e.matches(':modal')),width+' native modal');if(width===375&&process.env.MNW_EXPORT_SCREENSHOT)await page.screenshot({path:process.env.MNW_EXPORT_SCREENSHOT});const bounds=await dialog.boundingBox();
  check(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.height<=812,width+' dialog fits viewport');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' no horizontal overflow');
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');check(await dialog.evaluate(e=>document.activeElement===document.body||e.contains(document.activeElement)),width+' no outside control gains focus '+i);}
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});check(await opener.evaluate(e=>e===document.activeElement),width+' focus returns to opener');
 }
 await fresh();await opener.click();await page.getByLabel('Lösenord').fill('qa-password');
 const downloading=page.waitForEvent('download').catch(error=>({failure:error.message}));await page.getByRole('button',{name:'Skapa och hämta'}).click();const download=await downloading;if(typeof download.failure==="string")throw Error(JSON.stringify({failure:download.failure,status:await dialog.innerText(),requests,errors}));
 check(download.suggestedFilename()===name,'actual browser download has safe filename');check(Buffer.compare(readFileSync(await download.path()),Buffer.from(zip))===0,'downloaded ZIP bytes preserved');
 check(await page.getByLabel('Lösenord').inputValue()==='','submitted password cleared');check(requests===1,'one order sent');
 check((await dialog.innerText()).includes('Nedladdningen har startats'),'honest success status');
 await page.evaluate(()=>window.qaSwitch());await dialog.waitFor({state:'detached'});check(await page.evaluate(()=>window.qaUrls.revoked===1),'account switch releases Blob URL');
 mode='error';await fresh();await opener.click();await page.getByLabel('Lösenord').fill('qa-password');await page.getByRole('button',{name:'Skapa och hämta'}).click();await page.getByRole('status').filter({hasText:'Kontrollera lösenordet.'}).waitFor();
 check(!(await dialog.innerText()).includes('QA_PRIVATE'),'raw HTTP error hidden');check(await page.getByLabel('Lösenord').inputValue()==='','failed password cleared');
 mode='hold';await fresh();await opener.click();await page.getByLabel('Lösenord').fill('qa-password');await Promise.all([page.waitForRequest(r=>r.url()===base+'/api/account/export-preview'),page.getByRole('button',{name:'Skapa och hämta'}).click()]);await page.waitForFunction(()=>document.querySelector('button[type=submit]')?.disabled);
 await page.locator('form').dispatchEvent('submit');check(requests===1,'busy form cannot duplicate request');await page.getByRole('button',{name:'Stäng',exact:true}).click();await dialog.waitFor({state:'detached'});
 if(held)await held.abort().catch(()=>{});check(await page.evaluate(()=>window.qaUrls.created===0),'closing pending order creates no file URL');
 mode='hold';await fresh();await opener.click();await page.getByLabel('Lösenord').fill('qa-password');await Promise.all([page.waitForRequest(r=>r.url()===base+'/api/account/export-preview'),page.getByRole('button',{name:'Skapa och hämta'}).click()]);await page.evaluate(()=>window.qaSwitch());await dialog.waitFor({state:'detached'});if(held)await held.abort().catch(()=>{});check(await page.evaluate(()=>window.qaUrls.created===0),'account switch cancels pending download');
 mode='hold';await fresh();await opener.click();await page.getByLabel('Lösenord').fill('qa-password');await Promise.all([page.waitForRequest(r=>r.url()===base+'/api/account/export-preview'),page.getByRole('button',{name:'Skapa och hämta'}).click()]);await page.evaluate(()=>window.qaUnmount());if(held)await held.abort().catch(()=>{});check(await page.evaluate(()=>window.qaUrls.created===0),'unmount cannot start late download');

 for(const status of ['none','building','expired','failed']){
  mode='status-'+status;await fresh();await opener.click();await page.getByLabel('Lösenord').fill('qa-password');await page.getByRole('button',{name:'Hämta befintligt paket',exact:true}).click();
  await page.getByRole('status').filter({hasText:{none:'Inget sparat',building:'skapas fortfarande',expired:'har gått ut',failed:'kunde inte färdigställas'}[status]}).waitFor();
  check(requests===1&&paths[0]==='/api/account/export-preview/recover',status+' recovery never creates an order');check(await page.evaluate(()=>window.qaUrls.created===0),status+' status creates no file URL');check(await page.getByLabel('Lösenord').inputValue()==='',status+' recovery clears password');
 }
 mode='success';await fresh();await opener.click();await page.getByLabel('Lösenord').fill('qa-password');const recovered=page.waitForEvent('download');await page.getByRole('button',{name:'Hämta befintligt paket',exact:true}).click();const recoveredFile=await recovered;
 check(Buffer.compare(readFileSync(await recoveredFile.path()),Buffer.from(zip))===0,'recovered browser ZIP preserves exact bytes');check(requests===1&&paths[0]==='/api/account/export-preview/recover','recovered file sends no create request');
 check(errors.length===0,'no browser exceptions');await context.close();console.log(`PASS ${passed} real Chromium DOM/download checks; local fixture, mocked Auth/HTTP, no backend or physical mobile.`);
}finally{
 // Remove files synchronously first: Node can exit with an unresolved close callback.
 rmSync(tmp,{recursive:true,force:true});
 assert.equal(existsSync(tmp),false);console.log('CLEANUP fixture removed');
 await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(compiler)await new Promise(r=>compiler.close(r));
}
