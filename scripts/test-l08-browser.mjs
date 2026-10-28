// Explicit DevStaging-only browser acceptance. Passwords/tokens stay in memory.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createInterface} from 'node:readline';
import {mkdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const base='https://vwcfjvwfeatvuisojwrh.supabase.co',app='https://youth-job-mvp-dev.vercel.app',key=process.env.MNW_L08_ANON_KEY;
assert.ok(key,'Provide MNW_L08_ANON_KEY (public DevStaging key).');
assert.ok(process.stdin.isTTY,'Run interactively in a TTY so the fixture seed can be acknowledged.');
const password=randomBytes(24).toString('base64url'),prefix=`qa-l08-${Date.now()}-${randomUUID().slice(0,8)}`,accounts=[];
let server,browser,lastPage,step='prepare',passed=0;const observations=[];
const check=(ok,label)=>{assert.ok(ok,label);passed++;};
async function api(url,method,body,token){const response=await fetch(url,{method,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});return{status:response.status,data:await response.json().catch(()=>null)};}
async function noOverflow(page,label){const d=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,root:document.documentElement.scrollWidth}));check(Math.max(d.body,d.root)<=d.viewport+1,label+' has no document overflow');}
try {
 for(const role of ['youth','company']){
  step='create '+role;const email=`${prefix}-${role}@example.invalid`,r=await api(base+'/auth/v1/signup','POST',{email,password,data:{role}});
  if(r.data?.user?.id)accounts.push({role,email,id:r.data.user.id,token:r.data.access_token,deleted:false});
  check(r.status===200&&!!r.data?.access_token,'disposable '+role+' created');
 }
 // Operator seeds ONLY these identities/jobs via test-l08-browser-seed.sql.
 console.log('FIXTURE '+JSON.stringify({prefix,youth:accounts[0].id,company:accounts[1].id}));
 step='wait for fixture seed';const lines=createInterface({input:process.stdin});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{lines.close();reject(Error('Seed timed out'));},120000);lines.once('line',line=>{clearTimeout(timer);lines.close();if(line==='seeded')resolve();else reject(Error('Seed aborted'));});});
 const pw=require(process.env.MNW_PLAYWRIGHT_MODULE||'playwright').chromium;
 const custom=process.env.MNW_CHROMIUM_MODULE?require(process.env.MNW_CHROMIUM_MODULE).default:null;
 const rawProxy=process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY,p=rawProxy?new URL(rawProxy):null;
 const proxy=p?{server:p.origin,...(p.username?{username:decodeURIComponent(p.username),password:decodeURIComponent(p.password)}:{})}:undefined;
 server=await pw.launchServer({headless:true,proxy,...(custom?{executablePath:await custom.executablePath(),args:custom.args.filter(x=>x!=='--single-process')}:{})});browser=await pw.connect(server.wsEndpoint());
 for(const account of accounts){
  step=account.role+' login';const context=await browser.newContext({viewport:{width:375,height:812},ignoreHTTPSErrors:true});const page=await context.newPage();lastPage=page;page.setDefaultTimeout(25000);
  await page.goto(app+'/login');await page.locator('input[name=email]').fill(account.email);await page.locator('input[name=password]').fill(password);await page.getByRole('button',{name:'Logga in',exact:true}).click();await page.waitForURL(url=>url.pathname!=='/login');check(true,account.role+' signs in through real UI');
  for(const width of [375,768,1280]){
   step=`${account.role} profile ${width}`;console.log('PHASE '+step);await page.setViewportSize({width,height:812});await page.goto(app+'/profile');await page.getByRole('tab',{name:'Inställningar',exact:true}).click();await noOverflow(page,step);
   const opener=page.getByRole('button',{name:'Radera konto permanent',exact:true});await opener.click();const dialog=page.getByRole('dialog',{name:'Radera ditt konto',exact:true});await dialog.waitFor();
   check(await dialog.evaluate(e=>e.matches(':modal')),step+' opens a native modal');
   check((await dialog.innerText()).includes(account.email),step+' identifies the confirmed account');
   check(await dialog.locator('input[name=password]').getAttribute('type')==='password',step+' masks password');
   const bounds=await dialog.boundingBox();check(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.height<=812,step+' dialog fits viewport');
   for(let i=0;i<16;i++){await page.keyboard.press('Tab');check(await dialog.evaluate(e=>document.activeElement===document.body||e.contains(document.activeElement)),step+' keeps keyboard focus in modal '+i);}
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});check(await opener.evaluate(e=>e===document.activeElement),step+' restores opener focus after Escape');
  }
  step=account.role+' deletion wrong password';await page.setViewportSize({width:375,height:667});await page.getByRole('button',{name:'Radera konto permanent',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Radera ditt konto'});
  await dialog.locator('input[name=password]').fill('intentionally-wrong-qa-password');await dialog.locator('input[name=confirmDeletion]').check();let deletes=0;const count=request=>{if(new URL(request.url()).pathname==='/api/account'&&request.method()==='DELETE')deletes++;};page.on('request',count);
  await dialog.getByRole('button',{name:'Radera kontot permanent',exact:true}).dblclick();await dialog.getByRole('alert').waitFor();check((await dialog.getByRole('alert').innerText()).includes('stämmer inte'),account.role+' wrong password rejected');check(deletes===1,account.role+' double click sends one deletion');check(await dialog.locator('input[name=password]').inputValue()==='',account.role+' clears rejected password');check(!await dialog.locator('input[name=confirmDeletion]').isChecked(),account.role+' clears confirmation');page.off('request',count);
  await dialog.getByRole('button',{name:'Avbryt',exact:true}).click();check((await api(base+'/auth/v1/user','GET',undefined,account.token)).status===200,account.role+' survives failed deletion');
  if(account.role==='youth'){
   step='map WebGL';await page.goto(app+'/kartan');await page.waitForTimeout(12000);const map=await page.evaluate(()=>({webgl:!!document.createElement('canvas').getContext('webgl2'),canvas:!!document.querySelector('.mapboxgl-canvas'),pins:document.querySelectorAll('button.job-map-pin').length,fallback:!!document.querySelector('.mnw-map-fallback')}));observations.push({kind:'map',...map});check(map.webgl,'browser supports WebGL2');await noOverflow(page,'map mobile');
   if(map.pins){const pin=page.locator('button.job-map-pin').first();await pin.focus();await page.keyboard.press('Enter');check(await pin.getAttribute('aria-expanded')==='true','map pin opens by keyboard');}
   step='forced no-WebGL fallback';const fallback=await context.newPage();await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};});await fallback.goto(app+'/kartan');lastPage=fallback;await fallback.locator('.mnw-map-fallback').waitFor();await fallback.locator('.mnw-map-job button').first().waitFor();check(await fallback.locator('.mapboxgl-canvas').count()===0,'no-WebGL fallback exposes job list without canvas');await noOverflow(fallback,'no-WebGL mobile');const qa=fallback.locator('.mnw-map-job').filter({hasText:'QA L08 FIKTIVT TESTFÖRETAG'});observations.push({kind:'fallback',qaJobs:await qa.count()});check(await qa.count()===0,'unverified own test jobs do not leak into fallback');const hidden=await api(base+'/rest/v1/jobs?select=id&company_user_id=eq.'+accounts.find(a=>a.role==='company').id,'GET',undefined,account.token);check(hidden.status===200&&Array.isArray(hidden.data)&&hidden.data.length===0,'youth cannot read unverified test jobs through Data API');await fallback.close();
  }
  await context.close();
 }
}catch(error){console.error(JSON.stringify({failedAt:step,errorType:error.name}));if(lastPage){try{mkdirSync('/tmp/mnw-l08-browser',{recursive:true});await lastPage.screenshot({path:'/tmp/mnw-l08-browser/failure.png',timeout:5000});}catch{/* Screenshot failure must not block cleanup. */}}process.exitCode=1;}
finally{
 // Kill the isolated browser even if a driver close hangs in this environment.
 if(server)await server.kill().catch(()=>{});
 for(const account of accounts.filter(a=>a.token&&!a.deleted)){try{account.deleted=(await api(app+'/api/account','DELETE',{password,expectedUserId:account.id},account.token)).status===204;}catch{/* Only IDs below, never credentials. */}}
 console.log(JSON.stringify({fixturePrefix:prefix,passed,observations,remainingFixtureIds:accounts.filter(a=>!a.deleted).map(a=>a.id)}));
 if(accounts.some(a=>!a.deleted))process.exitCode=1;
 process.stdin.destroy();
}
