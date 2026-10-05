import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const tmp=mkdtempSync(resolve('.matching-tests-'));
try {
 for(const name of ['application-evidence','fixed-match-rules','candidate-assessment','cv-document-path','pdf-cv-source','job-match-criteria','application-followup-rules']) {
  let code=ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  code=code.replace(/from "\.\/([^"]+)"/g,'from "./$1.mjs"');
  writeFileSync(`${tmp}/${name}.mjs`,code);
 }
 const load=name=>import(pathToFileURL(`${tmp}/${name}.mjs`));
 const {assessCandidate,matchingCriteria,candidateSource}=await load('candidate-assessment');
 const {missingApplicationCriteria}=await load('application-followup-rules');
 const {verifiedApplicationAnswers}=await load('application-evidence');
 const {jobMatchProfilePayload}=await load('job-match-criteria');
 const base={jobId:'job',roleSummary:'Service',mustHaves:['B-körkort',' B-körkort '],trainableRequirements:[],topTraits:[],candidateQuestions:[]};
 assert.equal(jobMatchProfilePayload(base).must_haves.length,1);
 assert.throws(()=>jobMatchProfilePayload({...base,topTraits:Array.from({length:6},(_,i)=>String(i))}));
 assert.throws(()=>jobMatchProfilePayload({...base,candidateQuestions:['A','B','C','D']}));
 assert.throws(()=>jobMatchProfilePayload({...base,roleSummary:''}));
 const {uploadedCvPath}=await load('cv-document-path');
 const {extractPdfText,pdfCvSource}=await load('pdf-cv-source');
 const criteria=matchingCriteria([{label:'B-körkort',required:true},{label:'Kan arbeta helger',required:true},{label:'Social',category:'trait'},{label:'Kassa',category:'trainable'}]);
 let source=candidateSource({certificates:'B-körkort',cv_text:'Jag kan inte arbeta helger.'});
 let a=assessCandidate(criteria,[{id:'c2',status:'fulfilled',evidence:'Jag kan inte arbeta helger'}],source);
 assert.equal(a.score,50);assert.equal(a.criteria[0].status,'fulfilled');assert.equal(a.criteria[1].status,'unfulfilled');assert.equal(a.criteria[2].status,'unknown');assert.equal(a.criteria[3].weight,0);
 for(const text of ['Jag vill ta B-körkort.','Jag kan arbeta helger om det passar.','Jag arbetade helger förra året.','']) assert.equal(assessCandidate(criteria,[],candidateSource({cv_text:text})).score,null);
 assert.equal(assessCandidate(criteria,[],candidateSource({cv_text:'Jag kan arbeta helger. Jag kan inte arbeta helger.'})).criteria[1].status,'unknown');
 assert.equal(assessCandidate(matchingCriteria([{label:'React',required:true}]),[{id:'c0',status:'fulfilled',evidence:'Påhittad erfarenhet'}],'Annan text').score,null);
 assert.deepEqual(verifiedApplicationAnswers([{id:'q1',evidence:'Saknas i källan'}],[{id:'q1'}],'Källtext'),{});
 assert.deepEqual(verifiedApplicationAnswers([{id:'q2',evidence:'Jag har B-körkort'}],[{id:'q1'}],'Jag har B-körkort'),{});
 const supplementSource=candidateSource({followup_answers:[{question:'Can you work weekends?',answer:'Jag kan arbeta helger.'}]});
 assert.equal(assessCandidate(criteria,[],supplementSource).criteria[1].status,'fulfilled');
 assert.ok(!supplementSource.includes('Can you work weekends?'));
 const eligible=assessCandidate(matchingCriteria([{label:'React',required:true},{label:'Social',category:'trait'},{label:'Kassa',category:'trainable'},{label:'Nationalitet'},{label:'Körkort'}]),[], '');
 assert.deepEqual(missingApplicationCriteria(eligible),['React','Körkort']);
 assert.deepEqual(missingApplicationCriteria(eligible,['React']),['Körkort']);
 const uid='test-user';
 for(const url of ['other/cv.pdf','test-user/../other/cv.pdf','https://evil.test/cv.pdf','test-user/cv.docx']) assert.equal(uploadedCvPath([{type:'cv',url}],uid),null);
 assert.equal(uploadedCvPath([{type:'other',url:'test-user/not-cv.pdf'},{type:'cv',url:'test-user/cv.pdf'}],uid),'test-user/cv.pdf');
 // A real PDF text stream exercises PDF.js and the worker in Node, without OCR.
 const text='Jag har B-korkort. Jag kan arbeta helger.';
 const stream=`BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const bytes=new Uint8Array(Buffer.from(pdf));writeFileSync('/tmp/mnw-qa-cv.pdf',bytes);
 assert.ok((await extractPdfText(bytes.slice())).includes(text));
 await assert.rejects(extractPdfText(new Uint8Array(Buffer.from('not a PDF'))));
 const mock={storage:{from:()=>({download:async()=>({data:new Blob([bytes]),error:null})})}};
 assert.equal((await pdfCvSource(mock,[{type:'cv',url:uid+'/cv.pdf'}],uid)).status,'read');
 assert.equal((await pdfCvSource({storage:{from:()=>({download:async()=>({error:true})})}},[{type:'cv',url:uid+'/cv.pdf'}],uid)).status,'unreadable');
 assert.ok(candidateSource({pdf_cv_text:text,full_name:'SECRET NAME',date_of_birth:'2001-01-01',answers:{q1:'Jag kan arbeta kvällar'}}).includes(text));
 assert.ok(!candidateSource({full_name:'SECRET NAME'}).includes('SECRET NAME'));
 console.log('PASS: weighted scoring, unknowns, traits, explicit contradictions, trainable requirements, literal evidence, path isolation, real PDF extraction and unreadable fallback.');
} finally {rmSync(tmp,{recursive:true,force:true});}
