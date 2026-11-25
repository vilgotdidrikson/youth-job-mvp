import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
const require = createRequire(import.meta.url), originalLoad = Module._load;
Module._extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222', id = '33333333-3333-4333-8333-333333333333';
let user = owner, authHook, replies = [], calls = [];
const db = createClient('https://qa.invalid', 'test-only-public-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
  calls.push({ url: new URL(url), ...init });
  const wanted = replies.findIndex(r => r.path === new URL(url).pathname);
  const reply = wanted >= 0 ? replies.splice(wanted,1)[0] : replies.shift(); assert.ok(reply, 'Every SDK request needs an explicit simulated response');
  if (reply.before) reply.before();
  return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'Content-Type': 'application/json' } });
} } });
Module._load = function(name, parent, ...rest) {
  if (name === '@/lib/auth' || (name === './auth' && parent.filename.includes('/lib/'))) return { getCurrentUser: async () => { authHook?.(); return user ? { id: user } : null; }, getUserProfile: async () => ({ role: 'company' }) };
  if (name === '@/lib/supabase') return { getSupabaseClient: () => db };
  if (name === '@/lib/supabase-errors') return { logSupabaseError() {}, getSupabaseErrorMessage: (_e, fallback) => fallback };
  // Unused matching dependencies need no runtime behavior for this contract.
  if (['@/lib/jobs', '@/lib/application-completions', '@/lib/cv-completion'].includes(name)) return {};
  return originalLoad.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, parent, ...rest);
};
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; }); return { promise,resolve,reject }; };
const reset = (...values) => { replies=values;calls=[];user=owner;authHook=undefined; };
const okConv = { body: { id: 'conversation', match_id: 'match' } };
const duplicate = { status: 409, body: { code:'23505',message:'duplicate primary key' } };
const receipt = { id, conversation_id:'conversation', sender_user_id:owner, message_text:'Hej', video_kind:null };
try {
  const { sendMessage, getMessages, getMyConversations, getMyConversationContacts } = require('../lib/chat.ts');
  const { getMyMatches } = require('../lib/matching.ts');
  const { readChatInbox } = require('../lib/chat-inbox.ts');
  const signal = new AbortController().signal, options = { requestId:id,expectedUserId:owner,signal };
  reset(okConv,{body:null,status:201}); await sendMessage('conversation','Hej',options);
  assert.equal(calls[1].method,'POST'); assert.equal(JSON.parse(calls[1].body).id,id); assert.equal(JSON.parse(calls[1].body).sender_user_id,owner); assert.ok(calls[1].signal instanceof AbortSignal);
  assert.doesNotMatch(new Headers(calls[1].headers).get('Prefer') ?? '', /resolution=/, 'No upsert/conflict overwrite');
  reset(okConv,duplicate,{body:receipt}); await sendMessage('conversation','Hej',options);
  const filters=calls[2].url.searchParams; assert.equal(filters.get('id'),`eq.${id}`); assert.equal(filters.get('conversation_id'),'eq.conversation'); assert.equal(filters.get('sender_user_id'),`eq.${owner}`);
  for (const patch of [{sender_user_id:other},{conversation_id:'other'},{message_text:'changed'},{video_kind:'file'},{id:other}]) {
    reset(okConv,duplicate,{body:{...receipt,...patch}}); await assert.rejects(sendMessage('conversation','Hej',options),/kunde inte bekräftas/);
  }
  reset(okConv,{status:403,body:{code:'42501',message:'denied'}}); await assert.rejects(sendMessage('conversation','Hej',options)); assert.equal(calls.length,2,'Permission failures do not become duplicate success');
  reset();user=other;await assert.rejects(sendMessage('conversation','Hej',options),/Kontot har ändrats/);assert.equal(calls.length,0);
  reset({...okConv,before:()=>{user=other;}});await assert.rejects(sendMessage('conversation','Hej',options),/Kontot har ändrats/);assert.equal(calls.length,1,'Account change during access check starts no insert');
  const cancelled = new AbortController();cancelled.abort(); reset();await assert.rejects(sendMessage('conversation','Hej',{...options,signal:cancelled.signal}));assert.equal(calls.length,0);
  reset();await assert.rejects(sendMessage('conversation','Hej',{...options,requestId:'bad'}));assert.equal(calls.length,0);
  reset({body:[receipt]});assert.equal((await getMessages('conversation',signal))[0].id,id);assert.equal(calls[0].url.searchParams.get('conversation_id'),'eq.conversation');
  reset({body:[{...receipt,conversation_id:'foreign'}]});await assert.rejects(getMessages('conversation',signal),/kunde inte verifieras/);
  reset({body:[]});await getMyConversations(owner,signal);assert.ok(calls[0].url.searchParams.get('or').includes(owner));assert.ok(calls[0].signal);
  reset({body:[]});await getMyConversationContacts(signal);assert.equal(calls[0].url.pathname,'/rest/v1/rpc/get_my_conversation_contacts');assert.ok(calls[0].signal);
  reset();user=other;await assert.rejects(getMyMatches({expectedUserId:owner,signal}),/Kontot har ändrats/);assert.equal(calls.length,0);
  const conv={id:'conversation',youth_user_id:other,company_user_id:owner,match_id:'match'};
  const inboxReplies = (row=conv) => [{path:'/rest/v1/conversations',body:[row]},{path:'/rest/v1/rpc/get_my_conversation_contacts',body:[{conversation_id:'conversation',other_name:'QA kontakt',job_title:'QA jobb'}]},{path:'/rest/v1/matches',body:[{id:'match',youth_user_id:other,company_user_id:owner,status:'in_contact'}]}];
  reset(...inboxReplies()); const inbox=await readChatInbox(owner,signal);assert.equal(inbox[0].otherName,'QA kontakt');assert.equal(inbox[0].status,'in_contact');
  reset(...inboxReplies({...conv,company_user_id:other}));await assert.rejects(readChatInbox(owner,signal),/konto kunde inte verifieras/);
  reset(...inboxReplies());let count=0;authHook=()=>{if(++count===2)user=other;};await assert.rejects(readChatInbox(owner,signal),/konto kunde inte verifieras/);
  console.log('PASS actual chat/matching/inbox functions through Supabase SDK with simulated HTTP: scoped queries, UUID insert, exact duplicate receipt, denial/mismatches, abort and account change. No live RLS claim.');

  const { createChatTextSender } = require('../lib/chat-text-sender.ts');
  const attempts=[], pending=[];
  const sender=createChatTextSender(owner,(conv,text,opts)=>{const d=deferred();attempts.push({conv,text,...opts});pending.push(d);return d.promise;});
  const first=sender.send('conversation','Hej');assert.equal(await sender.send('conversation','Hej'),false);assert.equal(attempts.length,1);
  pending[0].reject(new Error('uncertain'));await assert.rejects(first);const retry=sender.send('conversation','Hej');assert.equal(attempts[0].requestId,attempts[1].requestId);pending[1].resolve();assert.equal(await retry,true);
  const intentional=sender.send('conversation','Hej');assert.notEqual(attempts[1].requestId,attempts[2].requestId);pending[2].resolve();await intentional;
  const old=sender.send('other-conversation','Hej');sender.stop();await assert.rejects(old);assert.equal(attempts[3].signal.aborted,true);pending[3].resolve();assert.equal(await sender.send('conversation','Hej'),false);
  const late=deferred(), timeouts=[];
  const timed=createChatTextSender(owner,(_c,_t,o)=>{timeouts.push(o);return timeouts.length===1?late.promise:Promise.resolve();},5);
  await assert.rejects(timed.send('conversation','Hej'),/Texten finns kvar/);assert.equal(timeouts[0].signal.aborted,true);late.resolve();assert.equal(await timed.send('conversation','Hej'),true);assert.equal(timeouts[0].requestId,timeouts[1].requestId);timed.stop();
  const fresh=createChatTextSender(other,(_c,_t,o)=>{assert.equal(o.expectedUserId,other);assert.notEqual(o.requestId,attempts[0].requestId);return Promise.resolve();});await fresh.send('conversation','Hej');fresh.stop();
  console.log('PASS actual text sender: simultaneous submit lock, stable retry ID after uncertain response/timeout, separate intentional sends, stop/late response and account isolation.');
} finally { Module._load=originalLoad; }
