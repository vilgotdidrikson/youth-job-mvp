import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { EventEmitter } from 'node:events';
import { mock } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
Module._extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const sockets=[];
class FakeRealtime extends EventEmitter {
  socket = new EventEmitter(); sent=[]; closed=false;
  constructor(props) { super(); this.props=props; sockets.push(this); }
  send(event) { this.sent.push(event); }
  close() { this.closed=true; }
}
const originalLoad=Module._load;
Module._load=function(name,...args) {
  if(name==='openai/realtime/ws') return {OpenAIRealtimeWS:FakeRealtime};
  return originalLoad.call(this,name,...args);
};
const {synthesizeQuestion,pcmToWav}=require('../lib/realtime-speech.ts');
const pcm=Buffer.from([1,0,2,0]);
const wav=pcmToWav(pcm);
assert.equal(wav.toString('ascii',0,4),'RIFF'); assert.equal(wav.readUInt32LE(24),24000);
assert.equal(wav.readUInt16LE(34),16); assert.equal(wav.readUInt32LE(40),pcm.length);
assert.throws(()=>pcmToWav(Buffer.alloc(0)));assert.throws(()=>pcmToWav(Buffer.alloc(3)));
const pending=synthesizeQuestion('Vilka språk kan du?','gpt-realtime-2.1-mini','fictional-test-key');
let rt=sockets.at(-1);rt.socket.emit('open');
assert.equal(rt.props.model,'gpt-realtime-2.1-mini');
assert.equal(rt.sent[0].session.audio.output.format.type,'audio/pcm');
rt.emit('session.updated',{});rt.emit('session.updated',{});
assert.equal(rt.sent.filter(e=>e.type==='response.create').length,1);
assert.equal(rt.sent[1].item.content[0].type,'input_text');
assert.equal(rt.sent[1].item.content[0].text,'Vilka språk kan du?');
rt.emit('response.output_audio.delta',{delta:pcm.toString('base64')});
rt.emit('response.done',{response:{status:'completed'}});
assert.equal((await pending).byteLength,48);assert(rt.closed);
for(const failure of ['error','close','incomplete','empty','oversize']) {
 const task=synthesizeQuestion('Generisk QA-fråga','gpt-realtime-2.1-mini','fictional-test-key');
 const rejected=assert.rejects(task);rt=sockets.at(-1);
 if(failure==='error')rt.emit('error',new Error('service unavailable'));
 if(failure==='close')rt.socket.emit('close');
 if(failure==='incomplete')rt.emit('response.done',{response:{status:'incomplete'}});
 if(failure==='empty')rt.emit('response.done',{response:{status:'completed'}});
 if(failure==='oversize')rt.emit('response.output_audio.delta',{delta:Buffer.alloc(2000002).toString('base64')});
 await rejected;assert(rt.closed);
}
const controller=new AbortController();
const abortTask=synthesizeQuestion('QA','gpt-realtime-2.1-mini','fictional-test-key',controller.signal);
const rejected=assert.rejects(abortTask,/aborted/);controller.abort();await rejected;
mock.timers.enable({apis:['setTimeout']});
try {
 const timed=synthesizeQuestion('QA','gpt-realtime-2.1-mini','fictional-test-key');
 const rejected=assert.rejects(timed,/timed out/);
 mock.timers.tick(20001);await rejected;assert(sockets.at(-1).closed);
} finally { mock.timers.reset(); }
Module._load=originalLoad;

// Actual SDK multipart serialization against a fake transport, never the network.
const {default:OpenAI}=await import('openai');
let form;
const client=new OpenAI({apiKey:'fictional-test-key',fetch:async(url,init)=>{
 assert.equal(String(url),'https://api.openai.com/v1/audio/transcriptions');
 form=init.body;return Response.json({text:'Jag talar svenska.'});
}});
const request={file:new File([wav],'qa.wav',{type:'audio/wav'}),model:'gpt-transcribe'};
assert.equal((await client.audio.transcriptions.create(request,{body:{...request,languages:['sv']}})).text,'Jag talar svenska.');
assert.equal(form.get('model'),'gpt-transcribe');assert.equal(form.get('languages[]'),'sv');assert.equal(form.has('language'),false);
assert.equal(form.get('file').name,'qa.wav');
console.log('PASS L11: Realtime speech events, bounded WAV, incomplete/close/error/oversize/abort, and actual SDK Swedish transcription multipart contract');
