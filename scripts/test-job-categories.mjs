import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url);
Module._extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const categories=require('../lib/job-categories.ts'),copy=require('../lib/job-copy.ts');
const {suggestJobCategories,effectiveJobCategories,jobMatchesCategory,jobCategoryFilterValues,preferredJobCategories,draftJobCategories}=categories;
for(const title of ['Cafémedarbetare','caféjobb','cafépersonal','Barista','CAFEJOBB'])assert.deepEqual(suggestJobCategories(title).ids,['cafe']);
assert.deepEqual(suggestJobCategories('Ekonom på ett café').ids,['finance']);
assert.deepEqual(suggestJobCategories('Lagerarbetare till café').ids,['warehouse']);
assert.deepEqual(suggestJobCategories('Cafépersonal och lagerarbetare').ids,[]);
assert.deepEqual(suggestJobCategories('Cafépersonal och lagerarbetare').candidates,['cafe','warehouse']);
assert.deepEqual(suggestJobCategories('Astronaut').ids,[]);
assert.deepEqual(suggestJobCategories('Medarbetare','Du arbetar som barista.').ids,['cafe']);
assert.deepEqual(preferredJobCategories(['söker caféjobb','Cafépersonal','Caféarbete']),['cafe']);
const cafe={id:'cafe',title:'Cafémedarbetare',description:'QA',category:'Caféjobb'};
const corrected={...cafe,job_category_ids:['retail'],job_category_manual:true};
assert.deepEqual(effectiveJobCategories(corrected),['retail']);
assert.equal(jobMatchesCategory(corrected,'cafe'),false);
assert.equal(jobMatchesCategory(corrected,'retail'),true);
assert.deepEqual(effectiveJobCategories({...corrected,job_category_ids:[]}),[],'Explicit no-fit choice stays unclassified');
assert.deepEqual(jobCategoryFilterValues([cafe,{...cafe,title:'Cafépersonal',category:'Deltid'},{title:'Astronaut'}]),['cafe','unclassified']);
assert.equal(jobMatchesCategory({title:'Astronaut'},'unclassified'),true);
assert.equal(jobMatchesCategory({title:'Astronaut'},''),true);
assert.deepEqual(suggestJobCategories('Ekonom på café','','Café/restaurang').ids,['finance']);
for(const invalid of [['bogus'],['cafe','cafe'],['cafe','finance','retail','warehouse'],null])assert.throws(()=>categories.validJobCategoryIds(invalid));
const draft=copy.createCopyJobDraft({...corrected,workplaces:[],city:'QA',address:'Gatan 1',postal_code:'11111',employment_type:'Deltid',salary_per_hour:'',benefits:'',requirements:'',image_url:''},null,()=>crypto.randomUUID());
assert.deepEqual(draft.categoryIds,['retail']);assert.equal(draft.categoryManual,true);assert.equal(draft.category,'Caféjobb');
const restored=copy.restoreJobBuilderDraft(JSON.parse(JSON.stringify(draft)));
assert.deepEqual(draftJobCategories({...restored,title:'Barista',description:'Caféjobb'}),['retail']);
assert.deepEqual(copy.restoreJobBuilderDraft({title:'Cafépersonal'}).categoryIds,[]);
assert.deepEqual(draftJobCategories(copy.restoreJobBuilderDraft({title:'Cafépersonal'})),['cafe']);
assert.deepEqual(draftJobCategories({...restored,categoryIds:[]}),[]);

function compile(file,imports={},extra='') {
 const module={exports:{}};
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('module','exports','require',code+extra)(module,module.exports,name=>imports[name]??require(name));return module.exports;
}
const route=compile('app/api/company/job/generate/route.ts',{'@/lib/job-categories':categories,'@/lib/job-ai-review':require('../lib/job-ai-review.ts'),'@/lib/api-auth':{},'@/lib/openai-config':{},'next/server':{}},'\nexports.fixture={fallback,normalizeResult};').fixture;
assert.equal(route.fallback('Ekonom på café','Café',{}).category,'Ekonomiarbete');
assert.equal(route.fallback('Astronaut','Café',{}).category,'');
const fallback=route.fallback('Barista','Café',{category:'Butiksarbete'});
assert.equal(route.normalizeResult({category:'Caféarbete'},fallback).category,'Butiksarbete','Model cannot overwrite supplied category');
const nodes=root=>!root||typeof root!=='object'?[]:[root,...(Array.isArray(root)?root:[root.props?.children]).flat(Infinity).flatMap(child=>nodes(child))];
const changes=[];
const {JobCategoryField}=compile('components/job-category-field.tsx',{'@/lib/job-categories':categories});
const tree=JobCategoryField({title:'Ekonom på café',description:'',value:['finance'],manual:false,onChange:(...args)=>changes.push(args)});
const select=nodes(tree).find(n=>n.type==='select');select.props.onChange({target:{value:'cafe'}});
assert.deepEqual(changes.pop(),[['finance','cafe'],true]);
const clear=nodes(tree).find(n=>n.type==='button'&&n.props.children==='Ingen av jobbtyperna passar');clear.props.onClick();assert.deepEqual(changes.pop(),[[],true]);

// The actual editor sends only canonical classification fields, preserving raw text.
const state=[];let cursor=0;const writes=[];
const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],value=>state[i]=value];}};
const Editor=compile('components/job-category-editor.tsx',{'react':react,'./modal-dialog':{ModalDialog:()=>null},'./job-category-field':{JobCategoryField},'@/lib/job-categories':categories,'@/lib/jobs':{updateJob:async(id,payload)=>{writes.push({id,payload});return{...corrected,...payload};}}}).JobCategoryEditor;
const renderEditor=()=>{cursor=0;return Editor({job:corrected,onClose(){},onSaved(){}});};
let editorTree=renderEditor();await nodes(editorTree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
assert.deepEqual(writes.pop(),{id:'cafe',payload:{job_category_ids:['retail'],job_category_manual:true}});
editorTree=renderEditor();nodes(editorTree).find(n=>n.type===JobCategoryField).props.onChange([],true);
editorTree=renderEditor();await nodes(editorTree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
assert.deepEqual(writes.pop().payload,{job_category_ids:[],job_category_manual:true});
editorTree=renderEditor();nodes(editorTree).find(n=>n.type===JobCategoryField).props.onChange([],false);
editorTree=renderEditor();await nodes(editorTree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
assert.deepEqual(writes.pop().payload,{job_category_ids:['cafe'],job_category_manual:false});

// Execute the real discovery function against simulated auth/data transport.
const profileModule=require('../lib/recruitment-profile.ts');
const withIds=profileModule.emptyRecruitmentProfile();withIds.preferences.categoryIds=['cafe'];withIds.preferences.roles=['söker caféjobb'];assert.deepEqual(profileModule.validateRecruitmentProfile(withIds).preferences,withIds.preferences);
assert.throws(()=>profileModule.validateRecruitmentProfile({...withIds,preferences:{...withIds.preferences,categoryIds:['bogus']}}));
const empty=profileModule.emptyRecruitmentProfile();empty.preferences.roles=['söker caféjobb'];
const jobs=[{...cafe,id:'one'},{...cafe,id:'two',title:'cafépersonal'},{...cafe,id:'three',title:'Barista'}, {...cafe,id:'finance',title:'Ekonom på café'}, {...cafe,id:'unknown',title:'Astronaut',category:''}, {...corrected,id:'corrected'}].map(j=>({...j,employment_type:'Deltid',city:'QA'}));
jobs.unshift(...jobs.splice(3,3));
const db={from(table){const chain={select(){return chain;},eq(){return chain;},order(){return chain;},limit(){return chain;},gt(){return chain;},maybeSingle(){return Promise.resolve({data:{recruitment_profile:empty},error:null});},then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);}};return chain;}};
const load=Module._load;
Module._load=function(request,parent,...rest){if(request==='@/lib/auth')return{getCurrentUser:async()=>({id:'qa'}),getUserProfile:async()=>({role:'youth'})};if(request==='@/lib/jobs')return{getDiscoveryJobs:async()=>jobs};if(request==='@/lib/chat')return{};if(request==='@/lib/supabase')return{getSupabaseClient:()=>db};if(request.startsWith('@/'))return load.call(this,path.resolve(request.slice(2)),parent,...rest);return load.call(this,request,parent,...rest);};
try {
 const {getSwipeJobs}=require('../lib/feeds.ts');
 assert.deepEqual((await getSwipeJobs({category:'cafe'})).map(j=>j.id),['one','three','two']);
 assert.deepEqual((await getSwipeJobs({query:'söker caféjobb'})).map(j=>j.id),['one','three','two']);
 assert.deepEqual((await getSwipeJobs({query:'caféjobb'})).map(j=>j.id),['one','three','two']);
 assert.equal((await getSwipeJobs()).length,6,'Unknown/corrected roles remain discoverable');
 assert.deepEqual((await getSwipeJobs()).slice(0,3).map(j=>j.id),['one','three','two'],'Synonyms have equal soft preference priority');
 assert.deepEqual((await getSwipeJobs({category:'unclassified'})).map(j=>j.id),['unknown']);
 empty.preferences.roles=[];empty.preferences.categoryIds=['cafe'];
 assert.deepEqual((await getSwipeJobs()).slice(0,3).map(j=>j.id),['one','three','two'],'Stored stable preference IDs contribute without a free-text role');
}finally{Module._load=load;}
const migration=readFileSync('supabase/migrations/'+(await import('node:fs')).readdirSync('supabase/migrations').find(f=>f.endsWith('_n17_job_categories.sql')),'utf8');
for(const c of categories.JOB_CATEGORIES)assert.ok(migration.includes(`'${c.id}'`),'SQL allowlist must include '+c.id);
console.log('PASS category synonyms, role/industry separation, ambiguous/unknown roles, explicit overrides, copy/resume, actual field callbacks, AI guard and discovery preference/filter/query paths. Transport simulated.');
