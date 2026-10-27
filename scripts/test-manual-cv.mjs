import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),original=Module._load;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.css']=m=>{m.exports={__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};};
const React=require('react');let active,user='qa-manual-a';const storage=new Map(),writes=[],network=[];let query=new URLSearchParams(),savedProfile;
const settle=()=>new Promise(resolve=>setImmediate(resolve));
class View{
 constructor(fn,props={}){this.fn=fn;this.props=props;this.slots=[];this.effects=[];this.index=0;}
 // eslint-disable-next-line @typescript-eslint/no-this-alias -- Test hook dispatcher.
 render(){active=this;this.index=0;return this.fn(this.props)}
 flush(){for(const item of this.effects.filter(Boolean))if(item.pending){item.cleanup?.();item.cleanup=item.fn();item.pending=false}}
 stop(){for(const item of this.effects.filter(Boolean))item.cleanup?.()}
}
const hooks={...React,useState(initial){const v=active,i=v.index++;if(!(i in v.slots))v.slots[i]=typeof initial==='function'?initial():initial;return[v.slots[i],value=>{v.slots[i]=typeof value==='function'?value(v.slots[i]):value}]},useRef(initial){const v=active,i=v.index++;return v.slots[i]??={current:initial}},useMemo(fn){active.index++;return fn()},useEffect(fn,deps){const v=active,i=v.index++,old=v.effects[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))v.effects[i]={fn,deps,pending:true,cleanup:old?.cleanup}}};
const cv=require('../lib/structured-cv.ts'),review=require('../lib/cv-fact-review.ts');
savedProfile={full_name:'Alex QA',city:'Stockholm',documents:[],cv_structured:null,certificates:null,extracurriculars:null};
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
globalThis.window={scrollTo(){}};
globalThis.fetch=async(url,options)=>{network.push({url,options});throw Error('AI must not run on the manual path')};
Module._load=function(name,parent,...rest){
 if(name==='react')return hooks;
 if(name==='next/link')return{__esModule:true,default:'a'};
 if(name==='next/navigation')return{useRouter:()=>({replace(){}}),useSearchParams:()=>query};
 if(name==='@/hooks/use-session')return{useSession:()=>({user:{id:user},profile:{role:'youth'},loading:false})};
 if(name==='@/hooks/use-verified-experience')return{useVerifiedExperience:()=>({items:[],error:null})};
 if(name==='@/lib/api-client')return{authenticatedHeaders:async()=>({})};
 if(name==='@/lib/onboarding')return{getYouthProfile:async()=>savedProfile,saveReviewedCvToProfile:async(text,facts,approval)=>{writes.push(review.reviewedCvPayload(text,facts,approval));return savedProfile},saveUploadedCvToProfile:async()=>{writes.push('pdf')}};
 if(name==='@/lib/storage')return{getYouthDocumentSignedUrl:async()=>'',uploadYouthDocument:async()=>({type:'cv',name:'QA.pdf',url:'qa/QA.pdf'})};
 if(name==='@/lib/youth-job-flow')return{submitApplicationDraftsAfterCv:async()=>({sent:0,unavailable:0,pending:0})};
 if(name==='./ui-icon')return{UiIcon:'UiIcon'};
 if(name==='./profile-journey')return{ProfileStepComplete:'ProfileStepComplete'};
 if(name==='./cv-fact-review')return{CvFactReview:'CvFactReview'};
 if(name.startsWith('@/'))return original.call(this,path.resolve(name.slice(2)),parent,...rest);
 return original.call(this,name,parent,...rest);
};
const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(nodes)];
const text=root=>root===null||root===undefined?'':typeof root==='string'||typeof root==='number'?String(root):Array.isArray(root)?root.map(text).join(''):text(root.props?.children);
const button=(root,label)=>{const result=nodes(root).find(n=>n.type==='button'&&(text(n)===label||nodes(n).some(child=>child.type==='strong'&&text(child)===label)));assert.ok(result,'button '+label);return result};
const field=(root,label)=>{const result=nodes(root).find(n=>n.props?.['aria-label']===label);assert.ok(result,'field '+label);return result};
try{
 const {cvCreationMethod}=require('../lib/cv-method.ts');for(const value of [undefined,null,'manual','unexpected',true,{}])assert.equal(cvCreationMethod(value),'manual');assert.equal(cvCreationMethod('ai'),'ai');
 const {YouthCvHub}=require('../components/youth-cv-hub.tsx');
 const mount=async(props={})=>{const wrapper=YouthCvHub(props),v=new View(wrapper.type,wrapper.props);v.render();v.flush();await settle();const tree=v.render();v.flush();return{v,tree}};
 let{v,tree}=await mount();assert.ok(button(tree,'Skriv själv'));assert.ok(button(tree,'Ta hjälp av AI'));assert.ok(button(tree,'Ladda upp ett CV'));
 button(tree,'Skriv själv').props.onClick();tree=v.render();field(tree,'Kort om mig').props.onChange({target:{value:'Jag tycker om att hjälpa människor.'}});tree=v.render();v.flush();
 // Switching methods is local and retains the same draft, including on direct create entry.
 let radios=nodes(tree).filter(n=>n.type==='input'&&n.props.type==='radio');radios[1].props.onChange();tree=v.render();assert.equal(field(tree,'Kort om mig').props.value,'Jag tycker om att hjälpa människor.');assert.equal(network.length,0);
 radios=nodes(tree).filter(n=>n.type==='input'&&n.props.type==='radio');radios[0].props.onChange();tree=v.render();v.flush();assert.equal(JSON.parse(storage.get('employo-cv-hub-draft:'+user)).method,'manual');v.stop();
 ({v,tree}=await mount({initialCreate:true}));assert.equal(field(tree,'Kort om mig').props.value,'Jag tycker om att hjälpa människor.');
 button(tree,'Fortsätt').props.onClick();tree=v.render();field(tree,'Skola').props.onChange({target:{value:'QA Gymnasium'}});tree=v.render();button(tree,'Fortsätt').props.onClick();tree=v.render();field(tree,'Erfarenhet').props.onChange({target:{value:'Praktik på QA Café våren 2026.'}});tree=v.render();button(tree,'Fortsätt').props.onClick();tree=v.render();field(tree,'Kompetenser').props.onChange({target:{value:'Servering, Excel'}});tree=v.render();button(tree,'Fortsätt').props.onClick();tree=v.render();field(tree,'Språk').props.onChange({target:{value:'Svenska, Engelska'}});tree=v.render();button(tree,'Fortsätt').props.onClick();tree=v.render();button(tree,'Förhandsvisa mitt CV').props.onClick();tree=v.render();
 assert.equal(network.length,0);assert.equal(field(tree,'CV-förhandsvisning').props.readOnly,true);assert.ok(!text(tree).includes('Skriv om med AI'));
 let facts=nodes(tree).find(n=>n.type==='CvFactReview');assert.equal(facts.props.manual,true);assert.ok(facts.props.text.includes('QA Gymnasium'));assert.equal(button(tree,'Gör mitt CV klart').props.disabled,true);
 facts.props.onApprove(true);tree=v.render();assert.equal(button(tree,'Gör mitt CV klart').props.disabled,false);
 facts=nodes(tree).find(n=>n.type==='CvFactReview');const corrected=review.updateCvFact(facts.props.cv,['personalInfo','city'],'Malmö');facts.props.onChange(corrected);tree=v.render();assert.equal(button(tree,'Gör mitt CV klart').props.disabled,true,'correction requires fresh approval');
 facts=nodes(tree).find(n=>n.type==='CvFactReview');facts.props.onApprove(true);tree=v.render();button(tree,'Gör mitt CV klart').props.onClick();await settle();tree=v.render();assert.equal(writes.length,1);assert.equal(writes[0].cv_structured.personalInfo.city,'Malmö');assert.equal(network.length,0);assert.ok(text(tree).includes('Ditt CV är sparat'));v.stop();
 // Saved CVs keep all structured entries in edit mode; approval is never restored.
 savedProfile={...savedProfile,cv_structured:cv.structuredCvFromForm({full_name:'Alex QA',work_experiences:[{company:'A',description:'Praktik A'},{company:'B',description:'Praktik B'}]})};savedProfile.cv_text=cv.renderStructuredCv(savedProfile.cv_structured);query=new URLSearchParams('edit=1');({v,tree}=await mount({initialCreate:true}));facts=nodes(tree).find(n=>n.type==='CvFactReview');assert.equal(facts.props.cv.workExperience.length,2);assert.equal(facts.props.approved,false);v.stop();
 query=new URLSearchParams();const first=YouthCvHub({});user='qa-manual-b';assert.notEqual(YouthCvHub({}).key,first.key);({v,tree}=await mount({initialCreate:true}));assert.notEqual(field(tree,'Kort om mig').props.value,'Jag tycker om att hjälpa människor.');v.stop();
 // The shared fact-review sync handler itself also refuses AI when in manual mode.
 const {CvFactReview}=require('../components/cv-fact-review.tsx');let synced=false;const factsView=new View(CvFactReview,{cv:savedProfile.cv_structured,text:savedProfile.cv_text+' changed',sourceText:'QA',manual:true,approved:false,onSync:()=>{synced=true},onApprove(){},onChange(){}});tree=factsView.render();const sync=button(tree,'Uppdatera uppgifterna från texten');assert.equal(sync.props.disabled,true);await sync.props.onClick();await settle();assert.equal(synced,false);assert.equal(network.length,0);factsView.stop();
 // Explicit AI failure can fall back to the same manual answers without another request.
 user='qa-manual-fallback';savedProfile={full_name:'QA',city:'Stockholm',documents:[],cv_structured:null,certificates:null,extracurriculars:null};
 ({v,tree}=await mount({initialCreate:true}));field(tree,'Kort om mig').props.onChange({target:{value:'Mina egna svar finns kvar.'}});tree=v.render();
 for(let i=0;i<5;i++){button(tree,'Fortsätt').props.onClick();tree=v.render()}
 radios=nodes(tree).filter(n=>n.type==='input'&&n.props.type==='radio');radios[1].props.onChange();tree=v.render();button(tree,'Skapa CV-förslag med AI').props.onClick();await settle();tree=v.render();assert.equal(network.length,1);
 radios=nodes(tree).filter(n=>n.type==='input'&&n.props.type==='radio');radios[0].props.onChange();tree=v.render();button(tree,'Förhandsvisa mitt CV').props.onClick();tree=v.render();assert.ok(field(tree,'CV-förhandsvisning').props.value.includes('Mina egna svar finns kvar.'));assert.equal(network.length,1,'manual fallback does not retry AI');v.stop();
 console.log('PASS actual manual CV callbacks: method choices, switching/restored drafts, form → preview → correction → approval → save, existing facts, account keys and blocked AI generation/sync. Persistence is simulated.');
}finally{Module._load=original}
