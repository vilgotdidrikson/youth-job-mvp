import type { StructuredCvData } from "./structured-cv";
export const CV_DRAFT_FIELDS=["about","school","program","graduation","experience","skills","languages","merits","linkedin","portfolio","otherLink"] as const;
export const CV_DRAFT_STEPS=["start","pdf","preview","review","about","education","experience","skills","languages","merits"] as const;
export type CvDraftStep=typeof CV_DRAFT_STEPS[number];
export type CvFormDraft=Record<typeof CV_DRAFT_FIELDS[number],string>&{noExperience:boolean};
export interface AccountCvDraft {version:1;method:"manual"|"ai";step:CvDraftStep;draft:CvFormDraft;returnToReview:boolean;editedSections:string[];generated:{text:string;structured:StructuredCvData}|null;reviewSource:string}
export interface AccountCvDraftRow {userId:string;revision:string|null;content:AccountCvDraft|null;updatedAt:string|null;invalid?:boolean}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==="string"&&v.length<=32000;
const list=(v:unknown)=>Array.isArray(v)&&v.length<=100&&v.every(text);
const fields=(v:unknown,required:string[],optional:string[]=[])=>object(v)&&required.every(k=>k in v)&&Object.keys(v).every(k=>[...required,...optional].includes(k));
function shape(v:unknown,arrays:string[],strings:string[]){return fields(v,arrays,strings)&&object(v)&&arrays.every(k=>list(v[k]))&&strings.every(k=>v[k]===undefined||text(v[k]));}
function structured(v:unknown):v is StructuredCvData{
 if(!fields(v,["personalInfo","profile","workExperience","education","projects","skills","certifications","languages","otherExperience"],["textBasis"])||!object(v)||v.textBasis!==undefined&&!text(v.textBasis))return false;
 if(!fields(v.personalInfo,[],["name","city","phone","email","linkedin","portfolio","sourceNotes"])||!object(v.personalInfo)||!Object.entries(v.personalInfo).every(([k,x])=>k==="sourceNotes"?list(x):text(x)))return false;
 if(!shape(v.profile,["strengths","traits","interests","targetRoles","differentiators","sourceNotes"],["summary"]))return false;
 const collections:Record<string,(x:unknown)=>boolean>={
  workExperience:x=>shape(x,["responsibilities","tools","projects","achievements","learnings","sourceNotes"],["employer","role","location","startDate","endDate","duration","collaboration"]),
  education:x=>shape(x,["courses","projects","achievements","sourceNotes"],["description","school","program","city","startDate","endDate","expectedGraduation"]),
  projects:x=>shape(x,["contributions","tools","results","sourceNotes"],["name","description","role"]),
  certifications:x=>shape(x,["sourceNotes"],["name","issuer","year","reason"]),
  otherExperience:x=>shape(x,["details","sourceNotes"],["title","type","organization","period"]),
  skills:x=>fields(x,["name","category","evidence"])&&object(x)&&text(x.name)&&text(x.evidence)&&["technical","digital","language","other"].includes(String(x.category)),
  languages:x=>fields(x,["name","abilities","evidence"],["level"])&&object(x)&&text(x.name)&&text(x.evidence)&&list(x.abilities)&&(x.level===undefined||["Modersmål","Flytande","Mycket god","God","Grundläggande"].includes(String(x.level))),
 };
 return Object.entries(collections).every(([k,check])=>Array.isArray(v[k])&&v[k].length<=100&&(v[k] as unknown[]).every(check));
}
export function parseAccountCvDraft(value:unknown):AccountCvDraft{
 const fail=()=>{throw new Error("CV-utkastet kunde inte läsas säkert. Ditt lokala utkast finns kvar.");};
 if(!fields(value,["version","method","step","draft","returnToReview","editedSections","generated","reviewSource"])||!object(value))return fail();
 if(value.version!==1||!["manual","ai"].includes(String(value.method))||!CV_DRAFT_STEPS.includes(value.step as CvDraftStep)||typeof value.returnToReview!=="boolean"||!text(value.reviewSource))return fail();
 const draft=value.draft;
 if(!fields(draft,[...CV_DRAFT_FIELDS,"noExperience"])||!object(draft)||typeof draft.noExperience!=="boolean"||!CV_DRAFT_FIELDS.every(k=>typeof draft[k]==="string"&&(draft[k] as string).length<=12000))return fail();
 if(!Array.isArray(value.editedSections)||value.editedSections.length>6||new Set(value.editedSections).size!==value.editedSections.length||!value.editedSections.every(s=>CV_DRAFT_STEPS.slice(4).includes(s)))return fail();
 if(value.generated!==null&&(!fields(value.generated,["text","structured"])||!object(value.generated)||!text(value.generated.text)||!structured(value.generated.structured)))return fail();
 if(value.step==="preview"&&!value.generated)return fail();
 const serialized=JSON.stringify(value);if(new TextEncoder().encode(serialized).length>120000)return fail();
 return JSON.parse(serialized) as AccountCvDraft;
}
export function cvDraftFingerprint(value:unknown):string{
 if(Array.isArray(value))return `[${value.map(cvDraftFingerprint).join(",")}]`;
 if(object(value))return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${cvDraftFingerprint(v)}`).join(",")}}`;
 return JSON.stringify(value)??"null";
}
