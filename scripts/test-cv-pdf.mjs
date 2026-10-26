import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
let loggedIn=true,historyFails=false,historyReads=0;
const original=Module._load;
Module._load=function(name,parent,...rest){
 if(name==='@/lib/supabase')return{getSupabaseClient:()=>({auth:{getUser:async()=>({data:{user:loggedIn?{id:'qa-youth'}:null},error:loggedIn?null:{message:'Denied'}})}})};
 if(name==='@/lib/recruitment')return{getVerifiedExperience:async id=>{assert.equal(id,'qa-youth');historyReads++;if(historyFails)throw Error('History denied');return [];}};
 if(name.startsWith('@/'))return original.call(this,path.resolve(name.slice(2)),parent,...rest);
 return original.call(this,name,parent,...rest);
};
const {Font}=require('@react-pdf/renderer');
const registerFont=Font.register;
Font.register=definition=>registerFont.call(Font,{...definition,fonts:definition.fonts.map(face=>({...face,src:face.src.startsWith('/fonts/')?path.join(process.cwd(),'public',face.src):face.src}))});
const dir=mkdtempSync(path.join(tmpdir(),'mnw-cv-pdf-'));
try {
 const {parseCvPdfText}=require('../lib/cv-pdf-layout.ts');
 const {createCvPdfFile}=require('../lib/cv-pdf.tsx');
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const fontManifest=JSON.parse(readFileSync('public/fonts/cv-manifest.json','utf8'));
 assert.equal(createHash('sha256').update(readFileSync('public/fonts/'+fontManifest.source)).digest('hex'),fontManifest.sourceSha256);
 for(const font of fontManifest.faces){const bytes=readFileSync('public/fonts/'+font.file);assert.equal(bytes.readUInt32BE(0),0x00010000);assert.equal(createHash('sha256').update(bytes).digest('hex'),font.sha256);}
 assert.ok(readFileSync('public/fonts/'+fontManifest.license,'utf8').includes('SIL OPEN FONT LICENSE'));
 const name='Åsa Öberg';
 const splitHeadings='ÅSA ÖBERG\r\n\r\nPROFIL\r\n\r\nJag söker ett extrajobb.\r\n\r\nSPRÅK\r\n\r\nSvenska och engelska.\r\n\r\nENSAMRUBRIK';
 const parsed=parseCvPdfText(splitHeadings,name);
 assert.equal(parsed.name,name);assert.equal(parsed.sections.length,3);
 assert.deepEqual(parsed.sections.map(s=>s.heading),['PROFIL','SPRÅK','ENSAMRUBRIK']);
 assert.equal(parsed.sections[0].body,'Jag söker ett extrajobb.');assert.equal(parsed.sections[2].body,'','Do not drop a trailing standalone heading');
 const introduction='Jag söker ett extrajobb där jag får hjälpa människor.';
 assert.equal(parseCvPdfText(introduction,name).sections[0].body,introduction,'The introduction must not become an inferred name');
 assert.equal(parseCvPdfText('ANNAN PERSON\n\nMin text.',name).sections[0].heading,'ANNAN PERSON','Never remove a different first line');
 assert.equal(parseCvPdfText('Min profiltext','').name,'Mitt CV');
 const short='ÅSA ÖBERG\nStockholm | asa@example.test\n\nPROFIL\nJag söker ett extrajobb på café. Jag tycker om service och kan arbeta på helger.\n\nERFARENHET\nHjälpte till med försäljning vid skolans loppmarknad.\n\nSPRÅK\nSvenska – flytande. Engelska – god.\n\nFRITID\nLöpning och föreningsarbete. ÅÄÖ åäö.';
 const long=introduction+'\n\n'+Array.from({length:18},(_,i)=>`ERFARENHET ${i+1}\nJag hjälpte till med evenemang i skolan. Mina uppgifter var att förbereda material, välkomna besökare och städa efteråt. Vi arbetade i grupp och turades om att stå i försäljningen. Jag fick öva på att bemöta frågor och hålla ordning.\n- Planerade tillsammans med andra.\n- Gav information till besökare.\n- Tog hand om lokalen efteråt.\nSlutmarkör ${i+1}.`).join('\n\n')+'\n\nPORTFOLIO\nhttps://example.test/'+('mycketlangtord'.repeat(35))+'\nSLUTMARKERING';
 const fixtures=[['short',short,name],['headings',splitHeadings,name],['two-pages',long.split('\n\n').slice(0,7).join('\n\n'),name],['long',long,name],['long-name',short.replace('ÅSA ÖBERG','ÅSA ALEXANDRA VIKTORIA ELISABETH ÖBERG ANDERSSON LINDSTRÖM'),'Åsa Alexandra Viktoria Elisabeth Öberg Andersson Lindström']];
 const outputs=[];
 for(const [key,text,fullName] of fixtures){
  const file=await createCvPdfFile(text,fullName);assert.equal(file.type,'application/pdf');assert.ok(file.name.endsWith('-matchnwork-cv.pdf'));
  const bytes=new Uint8Array(await file.arrayBuffer());assert.ok(new TextDecoder().decode(bytes.subarray(0,8)).startsWith('%PDF-'));
  writeFileSync(path.join(dir,key+'.pdf'),bytes);
  const task=getDocument({data:bytes,standardFontDataUrl:path.join(process.cwd(),'node_modules/pdfjs-dist/standard_fonts')+'/',useSystemFonts:false,isEvalSupported:false});
  try{
   const pdf=await task.promise;const pages=[];
   for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i),viewport=page.getViewport({scale:1});const {items}=await page.getTextContent();
    const textItems=items.filter(item=>'str' in item&&item.str.trim());const text=textItems.map(item=>item.str).join('\n');
    assert.ok(text.includes(`MatchnWork - ${i} / ${pdf.numPages}`),'Every page needs the correct page count');
    for(const item of textItems){assert.ok(item.transform[4]>=45.5,`Left overflow: ${key}: ${item.str}`);assert.ok(item.transform[4]+item.width<=viewport.width-45.5,`Right overflow: ${key}: ${item.str}`);assert.ok(item.transform[5]>=20&&item.transform[5]<=viewport.height-20,`Vertical clipping: ${key}: ${item.str}`);}
    for(let j=0;j<textItems.length;j++)if(/^ERFARENHET \d+$/.test(textItems[j].str.trim())){assert.ok(textItems[j+1]?.str.startsWith('Jag hjälpte'),'Heading cannot be orphaned before a page break');assert.ok(textItems[j+1].transform[5]<textItems[j].transform[5]);}
    pages.push(text);page.cleanup();
   }
   const all=pages.join('\n');assert.ok(all.replace(/\s+/g," ").includes(fullName));assert.ok(!all.includes('undefined')&&!all.includes('NaN'));
   if(key==='short'){assert.equal(pdf.numPages,1);for(const expected of ['Åsa Öberg','PROFIL','ERFARENHET','SPRÅK','FRITID','Löpning och föreningsarbete.','ÅÄÖ åäö.'])assert.ok(all.includes(expected),expected);}
   if(key==='two-pages')assert.equal(pdf.numPages,2);
   if(key==='headings')for(const expected of ['PROFIL','SPRÅK','ENSAMRUBRIK'])assert.ok(all.includes(expected));
   if(key==='long'){assert.ok(pdf.numPages>1);assert.ok(all.includes(introduction));for(let i=1;i<=18;i++)assert.ok(all.includes(`Slutmarkör ${i}.`),`Lost content ${i}`);assert.ok(all.includes('SLUTMARKERING'));}
   outputs.push(`${key}: ${pdf.numPages} page(s)`);
  }finally{await task.destroy();}
 }
 const parallel=await Promise.all([createCvPdfFile('Jag söker jobb. KONTROLL A','Åsa Öberg'),createCvPdfFile('Jag kan arbeta helger. KONTROLL B','Örjan Test')]);
 for(let i=0;i<parallel.length;i++){const task=getDocument({data:new Uint8Array(await parallel[i].arrayBuffer()),standardFontDataUrl:path.join(process.cwd(),'node_modules/pdfjs-dist/standard_fonts')+'/'});try{const pdf=await task.promise;const page=await pdf.getPage(1);const data=await page.getTextContent();const text=data.items.map(item=>item.str??'').join(' ');assert.ok(text.includes(i===0?'KONTROLL A':'KONTROLL B'),'Concurrent renders must retain correct glyphs and source identity');assert.ok(!text.includes(i===0?'KONTROLL B':'KONTROLL A'));}finally{await task.destroy();}}
 loggedIn=false;const before=historyReads;await assert.rejects(()=>createCvPdfFile(short,name),/Logga in/);assert.equal(historyReads,before,'No history read before authenticated user');
 loggedIn=true;historyFails=true;await assert.rejects(()=>createCvPdfFile(short,name),/History denied/);historyFails=false;
 await assert.rejects(()=>createCvPdfFile('  ',name),/innan du exporterar/);
 console.log('PASS: actual PDF export/parser, Swedish characters, standalone headings, intro vs identity, long names/URLs, no lost content, no orphan headings, page geometry/counts, auth/history failures and blank CV. '+outputs.join('; '));
}finally{Font.register=registerFont;Module._load=original;rmSync(dir,{recursive:true,force:true});}
