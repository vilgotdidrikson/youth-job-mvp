// Actual Chromium UI over controlled Auth/Data/API fixtures. No hosted acceptance claim.
import assert from'node:assert/strict';import{createRequire}from'node:module';import{mkdirSync}from'node:fs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MNW_PLAYWRIGHT_MODULE||'playwright-core');
const app=process.env.MNW_CASE_APP||'http://127.0.0.1:3013',base='https://vwcfjvwfeatvuisojwrh.supabase.co';
assert.ok(new URL(app).hostname==='127.0.0.1','Local fixture UI only');
const A='11111111-1111-4111-8111-111111111111',caseId='77777777-7777-4777-8777-777777777777';
let count=0,browser;const ok=(v,m)=>{assert.ok(v,m);count++;console.log('PASS '+m);};
const user={id:A,email:'qa-browser@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{role:'youth'},app_metadata:{provider:'email'},created_at:'2026-11-12T09:00:00Z'};
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:A,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated',aud:'authenticated'})).toString('base64url')+'.QA_SIGNATURE';
const record=()=>({id:caseId,requester_id:A,kind:'access',body:'QA begäran med svenska tecken åäö.',status:'new',revision:crypto.randomUUID(),created_at:'2026-11-12T09:00:00Z',updated_at:'2026-11-12T09:00:00Z',reply_due_at:'2026-12-12T09:00:00Z',closed_at:null,assigned:false,is_mine:false,events:[],events_truncated:false});
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.MNW_CASE_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [375,1280]){
  const context=await browser.newContext({viewport:{width,height:850}}),page=await context.newPage();let cases=[],creates=0,lists=0,uncertain=true,adminCalls=0;
  await context.addInitScript(({token,user})=>localStorage.setItem('sb-vwcfjvwfeatvuisojwrh-auth-token',JSON.stringify({access_token:token,refresh_token:'QA_REFRESH',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{token,user});
  await context.route(base+'/**',async route=>{const url=new URL(route.request().url());let data=[];if(url.pathname==='/auth/v1/user')data=user;else if(url.pathname.includes('/rpc/is_admin_account'))data=true;else if(url.pathname.startsWith('/rest/v1/profiles'))data={id:A,role:'youth',full_name:'QA'};await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
  await context.route(app+'/api/account/privacy-cases',async route=>{const input=route.request().postDataJSON();if(input.action==='list'){lists++;await route.fulfill({json:{available:true,cases,next:null}});}else if(input.action==='create'){creates++;cases=[{...record(),id:input.id,kind:input.kind,body:input.body}];if(uncertain){uncertain=false;await route.abort('failed');}else await route.fulfill({json:cases[0]});}else{const c={...cases[0],revision:crypto.randomUUID(),events:[{id:input.eventId,action:'user_reply',created_at:'2026-11-12T09:01:00Z',public_message:input.message}]};cases=[c];await route.fulfill({json:c});}});
  await page.goto(app+'/account/privacy-requests');await page.getByRole('heading',{name:'Nytt ärende'}).waitFor();
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' own case page fits viewport');
  await page.getByLabel('Beskriv din begäran').fill('QA min begäran åäö');
  await page.getByRole('button',{name:'Skicka begäran',exact:true}).evaluate(el=>{el.click();el.click();});
  await page.getByRole('button',{name:'Kontrollera ärenden före nytt försök'}).waitFor();ok(creates===1,width+' double click issues one create');
  ok(await page.getByLabel('Beskriv din begäran').inputValue()==='QA min begäran åäö',width+' uncertain result preserves text');
  await page.getByRole('button',{name:'Kontrollera ärenden före nytt försök'}).click();await page.getByText('Ärendet finns sparat.',{exact:false}).waitFor();ok(creates===1&&lists===2,width+' recovery only reads and finds original request');
  await page.getByLabel('Komplettera ärendet').fill('QA min komplettering');await page.getByRole('button',{name:'Skicka komplettering',exact:true}).click();await page.getByText('Din komplettering är sparad.',{exact:true}).waitFor();ok(await page.getByText('QA min komplettering',{exact:true}).count()===1,width+' own follow-up renders the saved thread');
  await context.route(app+'/api/admin/privacy-cases',async route=>{adminCalls++;const input=route.request().postDataJSON();assert.equal(input.password,'QA_PASSWORD');assert.equal(input.totpCode,'123456');if(input.action==='list')await route.fulfill({json:{available:true,cases:[record()],next:null}});else await route.fulfill({json:{...record(),status:'in_progress',assigned:true,is_mine:true}});});
  await page.goto(app+'/admin/privacy-cases');await page.getByRole('heading',{name:'Verifiera ärendeåtkomst'}).waitFor();ok(adminCalls===0,width+' admin queue is not read before credential submit');
  await page.getByLabel('Lösenord',{exact:true}).fill('QA_PASSWORD');await page.getByLabel('Aktuell tvåfaktorskod',{exact:true}).fill('123456');await page.getByRole('button',{name:'Läs aktuell ärendekö'}).click();await page.getByRole('button',{name:/Ej tilldelat/}).waitFor();
  ok(await page.getByLabel('Lösenord',{exact:true}).inputValue()===''&&await page.getByLabel('Aktuell tvåfaktorskod',{exact:true}).inputValue()==='',width+' admin credentials clear immediately after submit');
  await page.getByRole('button',{name:/Ej tilldelat/}).click();await page.getByRole('button',{name:'Verifiera och utför åtgärden'}).waitFor();ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' admin thread and navigation fit viewport');
  mkdirSync('/tmp/mnw-case-screens',{recursive:true});await page.screenshot({path:'/tmp/mnw-case-screens/admin-'+width+'.png',fullPage:true});
  await page.getByRole('button',{name:'Töm ärendevyn'}).click();ok(await page.getByRole('button',{name:'Verifiera och utför åtgärden'}).count()===0,width+' explicit clear removes private case content');
  await context.close();
 }
 console.log('PASS '+count+' actual Chromium checks over controlled Auth/API fixtures; no real credentials, hosted-case handling or physical authenticator test.');
}finally{await browser?.close();}
