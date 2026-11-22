import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function compile(file, imports = {}, extra = '') {
  const compiled = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('module','exports','require',code + extra)(compiled,compiled.exports,name => imports[name] ?? require(name));
  return compiled.exports;
}
const types = compile('lib/recruitment-types.ts');
const nav = compile('lib/chat-navigation.ts');
const offer = compile('lib/current-offer.ts');
const employment = { role_name:'QA role', start_date:'2026-10-18', response:'pending', company_name:'QA Company', registered_at:'2026-10-18T10:00:00Z', show_on_profile:false, include_in_cv:false, paid_at:null };
const snapshot = types.employmentSnapshot(employment);
assert.deepEqual(snapshot,{role_name:'QA role',start_date:'2026-10-18',response:'pending'});
assert.equal(types.employmentSnapshot(null),null);
for(const company of [true,false]) {
  assert.match(types.employmentPresentation(employment,company).description,/gransk|godkän/i);
  assert.match(types.employmentPresentation({...employment,response:'approved'},company).title,/bekräftad/);
  assert.match(types.employmentPresentation({...employment,response:'disputed'},company).description,/rättelse|invän/);
}
const convA = {id:'a',match_id:'match-a',job_id:'same-job'}, convB = {id:'b',match_id:'match-b',job_id:'same-job'};
assert.equal(nav.isRequestedConversation(convA,{matchId:'match-b',jobId:'same-job'}),false);
assert.equal(nav.isRequestedConversation(convB,{matchId:'match-b',jobId:'same-job'}),true);
assert.equal(nav.isRequestedConversation(convB,{conversationId:'a',matchId:'match-b'}),false);
assert.equal(nav.isRequestedConversation(convA,{jobId:'same-job'}),true);
assert.equal(nav.isRequestedConversation(convA,{}),false);
assert.notEqual(nav.chatRequestKey({matchId:'same-id'}),nav.chatRequestKey({jobId:'same-id'}));
assert.match(readFileSync('components/recruitment-summary.tsx','utf8'),/chats\?match=\$\{item.match_id\}/);
assert.match(readFileSync('app/chats/page.tsx','utf8'),/isRequestedConversation\(item.conv,request\)/);
assert.doesNotMatch(readFileSync('lib/pricing-data.ts','utf8'),/20 kandidater|En aktiv rekrytering/);

let rpcReply = {data:{ok:true},error:null}; const rpcCalls = [], events = [];
globalThis.window = {dispatchEvent:event => events.push(event.type)};
const api = compile('lib/recruitment.ts', {
  '@/lib/supabase':{getSupabaseClient:()=>({rpc:async (...args)=>{rpcCalls.push(args);return rpcReply;}})},
  '@/lib/supabase-errors':{getSupabaseErrorMessage:(error,fallback)=>error?.message??fallback},
});
rpcReply={error:{code:'40001',message:'Changed'}};
await assert.rejects(api.recruitmentAction('respond','match-a',{}),api.RecruitmentConflictError);
assert.equal(events.length,0);
rpcReply={data:{ok:true},error:null};
await api.recruitmentAction('respond','match-a',{expected_employment:snapshot});
assert.deepEqual(rpcCalls.at(-1)[1],{p_action:'respond',p_match_id:'match-a',p_payload:{expected_employment:snapshot}});
assert.deepEqual(events,['mnw-navigation-refresh','mnw-recruitment-refresh']);

const nodes = root => !root || typeof root !== 'object' ? [] : [root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(child=>child===root?[]:nodes(child))];
const text = node => node==null||typeof node==='boolean' ? '' : typeof node!=='object'?String(node):Array.isArray(node)?node.map(text).join(''):text(node.props?.children);
function harness({company=false,record=employment,invoiceOffer,write=async()=>{},reload=async()=>{},retry}={}) {
  const slots=[];let cursor=0,props;const calls=[],closed=[];
  const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>slots[i]=value];},useRef(initial){const i=cursor++;return slots[i]??={current:initial};},useId:()=>'hint'};
  const panel=compile('components/recruitment-panel.tsx',{
    react,
    "next/link":{default:"a"},
    "@/lib/hire-test-invoices":{},
    "@/lib/invoice-pilot":{isInvoicePilotDev:()=>true},
    '@/components/modal-dialog':{ModalDialog:()=>null},
    '@/lib/recruitment':{RecruitmentConflictError:api.RecruitmentConflictError,recruitmentAction:async(...args)=>{calls.push(args);await write(...args);}},
    '@/lib/recruitment-types':types,
    '@/lib/visible-refresh':{},
    '@/lib/current-offer':offer,
    './recruitment.module.css':{default:{}},
  },'\nmodule.exports.__form=EmploymentForm;');
  props={item:{match_id:'match-a',job_title:'QA ad',youth_name:'QA Youth',employment:record},company,invoiceOffer,onClose:()=>closed.push(true),onSaved:reload,onRetryInvoiceOffer:retry};
  const render=()=>{cursor=0;return panel.__form(props);};
  const button=label=>nodes(render()).find(n=>n.type==='button'&&text(n)===label);
  const submit=()=>nodes(render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  return {render,button,submit,calls,closed,updateRecord(record){props={...props,item:{...props.item,employment:record}};},updateOffer(invoiceOffer){props={...props,invoiceOffer};},wrapper:panel.RecruitmentPanel};
}
let ui=harness();ui.render();ui.updateRecord({...employment,role_name:'new facts',start_date:'2026-10-19'});
await ui.submit();assert.deepEqual(ui.calls[0][2].expected_employment,snapshot,'Open review must submit the displayed facts, not refreshed props');
assert.ok(text(ui.render()).includes('QA role'));
ui=harness({write:async()=>{throw new api.RecruitmentConflictError();}});
await ui.submit();assert.ok(ui.button('Hämta senaste uppgifter'));assert.equal(ui.closed.length,0);assert.equal(ui.button('Uppgifterna stämmer'),undefined);
await ui.button('Hämta senaste uppgifter').props.onClick();assert.equal(ui.calls.length,1,'Reload after conflict may not resubmit the decision');assert.equal(ui.closed.length,1);
ui=harness({reload:async()=>{throw Error('offline');}});await ui.submit();assert.match(text(ui.render()),/Uppgifterna är sparade/);
await ui.submit();assert.equal(ui.calls.length,1,'Refresh failure after a successful write may not duplicate registration');
let resolveWrite;ui=harness({write:()=>new Promise(resolve=>{resolveWrite=resolve;})});
const first=ui.submit();await ui.submit();assert.equal(ui.calls.length,1,'Double submit must be locked before rerender');resolveWrite();await first;
ui=harness({company:true,record:null});assert.ok(text(ui.render()).includes(offer.CURRENT_COMPANY_OFFER.registration));
assert.match(text(ui.render()), /Testa fakturaflödet i admin/);
const registerForm=nodes(ui.render());assert.ok(ui.button(types.REGISTER_EMPLOYMENT),'New registration uses the shared action name');
assert.deepEqual(registerForm.filter(n=>n.type==='li').map(text),[...types.EMPLOYMENT_STEPS],'Registration explains review and next status');
for(const input of registerForm.filter(n=>n.type==='input'))assert.ok(registerForm.some(n=>n.props?.id===input.props['aria-describedby']&&text(n)),'Role and start date have a described hint');
ui=harness({company:true});assert.ok(ui.button('Skicka rättelse'));assert.equal(nodes(ui.render()).filter(n=>n.type==='li').length,0);
assert.equal(types.employmentPresentation(null,true).action,types.REGISTER_EMPLOYMENT);
assert.equal(types.employmentStatusLabel(),'Anställning registrerad');assert.equal(types.employmentStatusLabel('pending'),'Anställning registrerad');
assert.equal(types.employmentStatusLabel('approved'),'Anställning bekräftad');assert.match(types.employmentStatusLabel('disputed'),/rättas/);
for(const file of ['components/recruitment-panel.tsx','components/close-recruitment-dialog.tsx','app/admin/recruitment/page.tsx','app/applications/page.tsx','app/chats/page.tsx','lib/matching.ts'])assert.doesNotMatch(readFileSync(file,'utf8'),/Markera(d)? som anställd|hired:\s*"Anställd"/,`${file} uses the shared hire terms`);
assert.match(readFileSync('components/close-recruitment-dialog.tsx','utf8'),/REGISTER_EMPLOYMENT/);
ui=harness({record:{...employment,response:'approved'}});assert.ok(ui.button('Spara synlighet och CV'));assert.ok(ui.button('Begär rättelse av anställningen'));
await ui.submit();assert.equal(ui.calls[0][2].show_on_profile,false);assert.equal(ui.calls[0][2].include_in_cv,false);
assert.match(offer.CURRENT_COMPANY_OFFER.future, /500 kr per bekräftad anställning.*planerat pris.*1 000 kr/i);
assert.match(offer.CURRENT_COMPANY_OFFER.future, /Arbetsgivaren faktureras först när kandidaten har bekräftat/);
ui=harness({company:true,record:null,invoiceOffer:offer.HIRE_TEST_TERMS});
assert.match(text(ui.render()), /testfaktura på 500 kr/);
await ui.submit();assert.equal(ui.calls.length,0,'Test invoice requires consent before registering');
nodes(ui.render()).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});
await ui.submit();assert.equal(ui.calls[0][2].test_invoice_terms,offer.HIRE_TEST_TERMS);
let retries=0;
ui=harness({company:true,record:null,invoiceOffer:'error',retry:()=>{retries++;}});
let startInput=nodes(ui.render()).find(n=>n.type==='input'&&n.props.type==='date');
startInput.props.onChange({target:{value:'2026-12-01'}});
await ui.submit();assert.equal(ui.calls.length,0);
ui.button('Hämta pris och villkor igen').props.onClick();
assert.equal(retries,1);
ui.updateOffer({seller:'Fiktiv säljare',terms:'Granskade fiktiva villkor',acceptance:'approved-version',version:'v1'});
assert.match(text(ui.render()), /fakturerar ert företag 500 kr när kandidaten bekräftar/);
assert.equal(nodes(ui.render()).find(n=>n.type==='input'&&n.props.type==='date').props.value,'2026-12-01');
await ui.submit();assert.equal(ui.calls.length,0);
nodes(ui.render()).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});
await ui.submit();assert.equal(ui.calls[0][2].bank_invoice_terms,'approved-version');
assert.notEqual(ui.wrapper({matchId:'a'}).key,ui.wrapper({matchId:'b'}).key,'Changing conversations resets open dialogs and records');

const invoiceSlots = [];
let invoiceCursor = 0, lastInvoiceAttempt, invoiceRequest, invoiceReads = 0;
let rejectInvoiceRead = true;
const invoicePanel = compile('components/hire-test-invoices.tsx',{
  "@/lib/supabase":{getSupabaseClient(){throw Error("No checkout during invoice list rendering");}},
    "@/lib/stripe-test-checkout":compile("lib/stripe-test-checkout.ts",{"./invoice-pilot":compile("lib/invoice-pilot.ts")}),
  react:{
    useState(initial) {
      const i=invoiceCursor++;
      if(!(i in invoiceSlots)) invoiceSlots[i]=initial;
      return [invoiceSlots[i],value=>{invoiceSlots[i]=typeof value==='function'?value(invoiceSlots[i]):value;}];
    },
    useEffect(run,[,,attempt]) {
      if(attempt===lastInvoiceAttempt) return;
      lastInvoiceAttempt=attempt;
      run();
    },
  },
  '@/lib/hire-test-invoices':{
    async listHireInvoices(admin,signal,live) {
      assert.equal(admin,true);assert.equal(live,true);assert.ok(signal instanceof AbortSignal);
      invoiceReads++;
      if(rejectInvoiceRead) throw new Error('Simulerat läsfel');
      return [];
    },
  },
  '@/lib/invoice-pilot':{isInvoicePilotDev:()=>true},
  './company-billing-settings.module.css':{default:{}},
},'\nmodule.exports.__list=HireInvoices;');
const bankInvoices=()=>{
  invoiceCursor=0;
  return invoicePanel.__list({admin:true,live:true});
};
assert.match(text(bankInvoices()),/Hämtar fakturor/);
await new Promise(setImmediate);
invoiceRequest=bankInvoices();
assert.match(text(invoiceRequest),/Fakturorna kunde inte hämtas/);
rejectInvoiceRead=false;
nodes(invoiceRequest).find(n=>n.type==='button'&&text(n)==='Uppdatera fakturor').props.onClick();
bankInvoices();
await new Promise(setImmediate);
assert.match(text(bankInvoices()),/Inga utfärdade fakturor ännu/);
assert.equal(invoiceReads,2);
console.log('PASS: reviewed facts, stale form props, conflict recovery, no duplicate writes, successful-write/read-failure, independent consent, correction after approval, current pricing, exact-match chat links and one hire entry name with explained next steps.');
