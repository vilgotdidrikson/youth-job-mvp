import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function compile(file, imports = {}, extra = '') {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('module','exports','require',code + extra)(module,module.exports,name => imports[name] ?? require(name));
  return module.exports;
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
function harness({company=false,record=employment,write=async()=>{},reload=async()=>{}}={}) {
  const slots=[];let cursor=0,props;const calls=[],closed=[];
  const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>slots[i]=value];},useRef(initial){const i=cursor++;return slots[i]??={current:initial};}};
  const module=compile('components/recruitment-panel.tsx',{
    react,
    '@/components/modal-dialog':{ModalDialog:()=>null},
    '@/lib/recruitment':{RecruitmentConflictError:api.RecruitmentConflictError,recruitmentAction:async(...args)=>{calls.push(args);await write(...args);}},
    '@/lib/recruitment-types':types,
    '@/lib/visible-refresh':{},
    '@/lib/current-offer':offer,
    './recruitment.module.css':{default:{}},
  },'\nmodule.exports.__form=EmploymentForm;');
  props={item:{match_id:'match-a',job_title:'QA ad',youth_name:'QA Youth',employment:record},company,onClose:()=>closed.push(true),onSaved:reload};
  const render=()=>{cursor=0;return module.__form(props);};
  const button=label=>nodes(render()).find(n=>n.type==='button'&&text(n)===label);
  const submit=()=>nodes(render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  return {render,button,submit,calls,closed,updateRecord(record){props={...props,item:{...props.item,employment:record}};},wrapper:module.RecruitmentPanel};
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
ui=harness({record:{...employment,response:'approved'}});assert.ok(ui.button('Spara synlighet och CV'));assert.ok(ui.button('Begär rättelse av anställningen'));
await ui.submit();assert.equal(ui.calls[0][2].show_on_profile,false);assert.equal(ui.calls[0][2].include_in_cv,false);
assert.notEqual(ui.wrapper({matchId:'a'}).key,ui.wrapper({matchId:'b'}).key,'Changing conversations resets open dialogs and records');
console.log('PASS: reviewed facts, stale form props, conflict recovery, no duplicate writes, successful-write/read-failure, independent consent, correction after approval, current pricing and exact-match chat links.');
