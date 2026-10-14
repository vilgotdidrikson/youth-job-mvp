import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

// Small deterministic hook harness: tests the actual component callbacks with
// simulated device/recorder APIs. It does not claim a physical camera test.
const dir=mkdtempSync(join(tmpdir(),'mnw-video-recorder-'));
const saved=Object.fromEntries(['navigator','MediaRecorder','setInterval','clearInterval'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
const nowDescriptor=Object.getOwnPropertyDescriptor(performance,'now');
let time=0,intervalCallback=null,request=null,instance=null,stopped=0;
class Recorder {
  static isTypeSupported(type){return type==='video/webm';}
  // Keep the mock instance so tests can emit native recorder events.
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  constructor(_stream,options){this.mimeType=options.mimeType;this.state='inactive';instance=this;}
  start(){this.state='recording';}
  stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['test'],{type:'video/webm'})});this.onstop?.();}
}
const media=()=>({getTracks:()=>[{stop:()=>stopped++},{stop:()=>stopped++}]});
let slots=[],cursor=0,effects=[];
const hooks={
  useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];},
  useRef(initial){const index=cursor++;return slots[index]??(slots[index]={current:initial});},
  useEffect(callback,deps){const index=cursor++;const old=slots[index];if(!old||deps.some((value,i)=>value!==old.deps[i])){effects.push(()=>{old?.cleanup?.();slots[index]={deps,cleanup:callback()};});}},
  jsx:(type,props)=>({type,props}),
};
globalThis.__recorderHooks=hooks;
try{
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>request()}}});
  globalThis.MediaRecorder=Recorder;
  globalThis.setInterval=callback=>{intervalCallback=callback;return 1;};
  globalThis.clearInterval=()=>{intervalCallback=null;};
  Object.defineProperty(performance,'now',{configurable:true,value:()=>time});
  let code=ts.transpileModule(readFileSync('components/video-recorder.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  code=code.replace(/import .* from "react\/jsx-runtime";/,'const {jsx:_jsx,jsx:_jsxs}=globalThis.__recorderHooks; const _Fragment="fragment";')
    .replace(/import .* from "react";/,'const {useState,useRef,useEffect}=globalThis.__recorderHooks;')
    .replace(/import .* from "@\/lib\/profile-video";/,'const PROFILE_VIDEO_POLICY={maxBytes:31457280};')
    .replace(/import styles from ".\/video.module.css";/,'const styles={};');
  writeFileSync(join(dir,'recorder.mjs'),code);
  const {VideoRecorder}=await import(pathToFileURL(join(dir,'recorder.mjs')));
  const results=[];
  const render=()=>{cursor=0;const tree=VideoRecorder({disabled:false,onRecorded:(...args)=>results.push(args)});effects.splice(0).forEach(run=>run());return tree;};
  const nodes=tree=>Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];
  const button=(tree,label)=>nodes(tree).find(node=>node.type==='button'&&node.props.children===label);
  const unmount=()=>{slots.forEach(slot=>slot?.cleanup?.());slots=[];effects=[];};
  request=async()=>media();let tree=render();await button(tree,'Spela in med kamera').props.onClick();tree=render();
  time=2500;button(tree,'Stoppa och förhandsvisa').props.onClick();render();
  assert.equal(results.length,1);assert.equal(results[0][0].type,'video/webm');assert.equal(results[0][1],2.5);assert.equal(stopped,2);assert.equal(intervalCallback,null);
  tree=render();await button(tree,'Spela in med kamera').props.onClick();tree=render();button(tree,'Avbryt inspelning').props.onClick();render();assert.equal(results.length,1);assert.equal(stopped,4);
  tree=render();await button(tree,'Spela in med kamera').props.onClick();render();time+=61000;intervalCallback();render();assert.equal(results.length,2);assert.equal(results[1][1],60);assert.equal(stopped,6);
  tree=render();await button(tree,'Spela in med kamera').props.onClick();render();instance.ondataavailable({data:{size:31457281}});render();assert.equal(results.length,2);assert.equal(stopped,8);
  tree=render();await button(tree,'Spela in med kamera').props.onClick();render();unmount();assert.equal(stopped,10);assert.equal(results.length,2);
  let permissionResolve;request=()=>new Promise(resolve=>{permissionResolve=resolve;});
  tree=render();const starting=button(tree,'Spela in med kamera').props.onClick();render();unmount();permissionResolve(media());await starting;assert.equal(stopped,12,'Late permission tracks must close');assert.equal(results.length,2);
  request=async()=>{throw new DOMException('Denied','NotAllowedError');};tree=render();await button(tree,'Spela in med kamera').props.onClick();tree=render();assert.ok(JSON.stringify(tree).includes('nekades'));unmount();
  let rejectOld;request=()=>new Promise((_resolve,reject)=>{rejectOld=reject;});
  tree=render();button(tree,'Spela in med kamera').props.onClick();tree=render();button(tree,'Avbryt inspelning').props.onClick();
  request=async()=>media();tree=render();await button(tree,'Spela in med kamera').props.onClick();tree=render();
  const beforeLateError=stopped;rejectOld(new DOMException('Late denied','NotAllowedError'));await Promise.resolve();
  assert.equal(stopped,beforeLateError,'Old permission rejection must not stop a new recording');
  const oldRecorder=instance;button(tree,'Avbryt inspelning').props.onClick();tree=render();await button(tree,'Spela in med kamera').props.onClick();tree=render();
  const beforeOldEvents=stopped;oldRecorder.onstop();oldRecorder.onerror();oldRecorder.ondataavailable({data:{size:31457281}});
  assert.equal(stopped,beforeOldEvents,'Stale recorder events must not stop newer tracks');assert.ok(intervalCallback);unmount();
  console.log('PASS actual recorder callbacks with mocked media: preview-only, cancel, unmount, late permission, 60 sec, byte cap, denied permission and track cleanup.');
}finally{
  delete globalThis.__recorderHooks;
  for(const [key,descriptor] of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  if(nowDescriptor)Object.defineProperty(performance,'now',nowDescriptor);else delete performance.now;
  rmSync(dir,{recursive:true,force:true});
}
