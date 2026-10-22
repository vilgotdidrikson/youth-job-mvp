import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function compile(file,imports={},extra='') {
  const module={exports:{}};
  const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('module','exports','require',code+extra)(module,module.exports,name=>imports[name]??require(name));
  return module.exports;
}
const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(child=>nodes(child))];
const content=n=>n==null||typeof n==='boolean'?'':typeof n!=='object'?String(n):Array.isArray(n)?n.map(content).join(''):content(n.props?.children);
function stateHarness(){const slots=[],effects=[];let cursor=0;return {
  react:{useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef(initial){const i=cursor++;return slots[i]??={current:initial};},useEffect(fn){effects.push(fn);},useSyncExternalStore(_subscribe,get){return get();},Suspense:()=>null},
  render(fn){cursor=0;return fn();},mount(){effects.splice(0).forEach(fn=>fn());},
};}
const dummy=()=>null;
const journey=compile('lib/profile-journey.ts');
const user={id:'qa-owner'},profile={role:'youth'};
let conversation=null,reads=0;const uploads=[],sends=[];
const query={get:key=>key==='conversation'?conversation:key==='return'?'build':null};
const Recorder=()=>null,Picker=()=>null;
const tabKeyboard=compile('lib/tab-keyboard.ts');
const studioImports=ui=>({
  react:ui.react,'next/link':dummy,'next/navigation':{useSearchParams:()=>query},
  '@/lib/tab-keyboard':tabKeyboard,'@/components/tab-list':compile('components/tab-list.tsx',{'@/lib/tab-keyboard':tabKeyboard}),
  '@/hooks/use-require-auth':{useRequireAuth:()=>({user,profile,status:'ready'})},
  '@/components/auth-gate-message':{AuthGateMessage:dummy},
  '@/components/video-recorder':{VideoRecorder:Recorder},
  '@/components/video-picker':{VideoPicker:Picker,VideoPreview:dummy},
  '@/components/ui-icon':{UiIcon:dummy},'@/components/video.module.css':{default:{}},
  '@/lib/supabase':{getSupabaseClient:()=>({from(){reads++;return this;},select(){return this;},eq(){return this;},async maybeSingle(){return{data:{id:conversation},error:null};}})},
  '@/lib/video-client':{uploadVideo:async(...args)=>{uploads.push(args);return{id:'video',owner_id:user.id,conversation_id:args[3]};},sendVideoMessage:async(...args)=>sends.push(args)},
});
let ui=stateHarness();let studio=compile('app/video/record/page.tsx',studioImports(ui),'\nmodule.exports.Studio=VideoStudio;').Studio;
let tree=ui.render(studio);ui.mount();await Promise.resolve();
assert.match(content(tree),/Profilvideo används inte längre/);
assert.ok(!nodes(tree).some(n=>n.type===Recorder||n.type===Picker),'Old direct links must not mount camera or upload controls');
assert.equal(reads,0);assert.equal(uploads.length,0);assert.equal(sends.length,0);
conversation='chat-a';ui=stateHarness();studio=compile('app/video/record/page.tsx',studioImports(ui),'\nmodule.exports.Studio=VideoStudio;').Studio;
tree=ui.render(studio);ui.mount();await Promise.resolve();await Promise.resolve();tree=ui.render(studio);
const recorder=nodes(tree).find(n=>n.type===Recorder);assert.equal(recorder.props.disabled,false);
const file=new File(['qa'],'qa.webm',{type:'video/webm'});recorder.props.onRecorded(file,12);
tree=ui.render(studio);const button=nodes(tree).find(n=>n.type==='button'&&content(n)==='Skicka video');
await button.props.onClick();await Promise.resolve();await Promise.resolve();
assert.equal(uploads.length,1);assert.equal(uploads[0][3],'chat-a');assert.equal(sends.length,1);assert.equal(sends[0][0],'chat-a');
assert.match(content(ui.render(studio)),/Videon är skickad/);

ui=stateHarness();const Player=()=>null;
const chat=compile('components/chat-video.tsx',{
  react:ui.react,'next/link':dummy,'./modal-dialog':{ModalDialog:dummy},'./ui-icon':{UiIcon:dummy},
  '@/lib/video-client':{getVideo:()=>{throw Error('Legacy message must not request a video');}},
  './video-picker':{VideoPicker:Picker},'./video-player':{VideoPlayer:Player},
  './report-dialog':{ReportDialog:dummy},'./video.module.css':{default:{}},
});
tree=ui.render(()=>chat.VideoMessage({message:{id:'legacy',video_kind:'profile',sender_user_id:user.id},own:true}));
assert.match(content(tree),/Profilvideo används inte längre/);assert.ok(!nodes(tree).some(n=>n.type===Player));
tree=ui.render(()=>chat.ChatVideoComposer({conversationId:'chat-a',userId:user.id,onSent(){}}));
assert.ok(!content(tree).includes('Dela profilvideo'));assert.match(content(tree),/Spela in video/);assert.match(content(tree),/Välj video/);

globalThis.localStorage={getItem:()=> 'video'};
ui=stateHarness();const builder=compile('components/profile-builder.tsx',{
  react:ui.react,'next/link':dummy,'next/navigation':{useSearchParams:()=>({get:()=>null})},
  '@/hooks/use-require-auth':{useRequireAuth:()=>({user,profile,status:'ready'})},
  '@/hooks/use-recruitment-profile':{useRecruitmentProfile:()=>({profile:{},loading:false,error:null})},
  '@/hooks/use-cv-completion':{useCvCompletion:()=>({cvCompleted:true,cvLoading:false})},
  './auth-gate-message':{AuthGateMessage:dummy},'@/lib/recruitment-profile':{completedProfileSections:()=>[]},
  '@/lib/profile-journey':journey,'./profile-journey':{ProfileJourneyHeader:dummy,ProfileStepComplete:dummy},
  './ui-icon':{UiIcon:dummy},'./recruitment-profile.module.css':{default:{}},
});
tree=ui.render(builder.ProfileBuilder);
assert.ok(nodes(tree).some(n=>n.props?.href==='/profile/develop?section=preferences&return=build'));
assert.ok(!content(tree).includes('frivillig video'));assert.equal(journey.PROFILE_JOURNEY.length,5);
assert.ok(!existsSync('components/profile-video.tsx'));
assert.ok(!readFileSync('app/company/page.tsx','utf8').includes('Kandidatens presentationsvideo'));
delete globalThis.localStorage;
console.log('PASS actual studio/profile/chat callbacks: old links mount no media, chat recording sends in scope, retired shares make no playback request, five steps and legacy resume.');
