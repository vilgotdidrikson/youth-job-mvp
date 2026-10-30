import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url);
/** Append reviewed metadata only; an addition cannot rewrite an existing table
 * or bucket. Keeps historical Auth metadata byte-identical when publishing a
 * narrowly scoped schema change. This is a local audit tool, never runtime auth. */
export function mergeReviewedCatalogAdditions(base,additions) {
 if(!base||!additions||additions.mode!=='additions-only'||additions.projectRef!==base.projectRef||!/^\d{4}-\d{2}-\d{2}$/.test(additions.capturedOn)||!Array.isArray(base.relations)||!Array.isArray(base.buckets)||!Array.isArray(additions.relations)||!Array.isArray(additions.buckets))throw Error('Malformed reviewed catalog additions.');
 const relations=[...base.relations,...additions.relations],buckets=[...base.buckets,...additions.buckets];
 if(new Set(relations.map(r=>r.schema_name+'.'+r.table_name)).size!==relations.length||new Set(buckets.map(b=>b.id)).size!==buckets.length)throw Error('Catalog additions cannot replace existing metadata.');
 return{...base,capturedOn:additions.capturedOn,relations,buckets};
}
export const readReviewedCatalog=()=>mergeReviewedCatalogAdditions(
 JSON.parse(readFileSync(new URL('docs/privacy/catalog.dev-2026-10-28.json',root),'utf8')),
 JSON.parse(readFileSync(new URL('docs/privacy/catalog.export-storage-2026-10-30.json',root),'utf8')),
);
export const readInventory=()=>JSON.parse(readFileSync(new URL('docs/privacy/personal-data-inventory.json',root),'utf8'));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const name=value=>typeof value==='string'&&value.length>0&&value.length<256;
const text=value=>typeof value==='string'&&value.trim().length>0;
const unique=values=>new Set(values).size===values.length;
const sorted=value=>JSON.stringify([...value].sort());

/** Metadata coverage only. Never queries user rows or authorizes an export. */
export function auditInventory(catalog,inventory=readInventory(),reviewed=readReviewedCatalog()) {
 const errors=[];
 const validCatalog=value=>object(value)&&Array.isArray(value.relations)&&value.relations.length>0
  &&Array.isArray(value.buckets)&&value.relations.every(r=>object(r)&&name(r.schema_name)&&name(r.table_name)
   &&['r','p','v','m'].includes(r.relkind)&&typeof r.rls_enabled==='boolean'
   &&Array.isArray(r.foreign_keys)&&r.foreign_keys.every(f=>typeof f==='string')
   &&Array.isArray(r.columns)&&r.columns.length>0&&r.columns.every(c=>object(c)&&name(c.name)&&typeof c.type==='string'&&c.type.length>0)
   &&unique(r.columns.map(c=>c.name)))
  &&unique(value.relations.map(r=>`${r.schema_name}.${r.table_name}`))
  &&value.buckets.every(b=>object(b)&&name(b.id)&&typeof b.public==='boolean')&&unique(value.buckets.map(b=>b.id));
 if(!validCatalog(catalog)||!validCatalog(reviewed))return['Malformed catalog metadata; expected relations/columns/foreign_keys and bucket configuration, not data rows.'];
 if(!object(inventory)||inventory.version!==1||inventory.mode!=='inventory-only'||inventory.automaticExportEnabled!==false
  ||!Array.isArray(inventory.groups)||!Array.isArray(inventory.buckets)||!Array.isArray(inventory.outsideCatalog))return['Malformed inventory or unsupported export activation. This register cannot enable automatic export.'];
 const mapped=new Map();const groupIds=new Set();
 for(const group of inventory.groups){
  if(!object(group)||!name(group.id)||groupIds.has(group.id)||!['subject','mixed','review','context'].includes(group.classification)
   ||!['subjectScope','data','review'].every(k=>text(group[k]))
   ||!Array.isArray(group.relations)||group.relations.length===0||!group.relations.every(name)){errors.push('Malformed/duplicate inventory group.');continue;}
  groupIds.add(group.id);
  for(const relation of group.relations){if(mapped.has(relation))errors.push(`Duplicate classification: ${relation}`);mapped.set(relation,group.id);}
 }
 const relations=new Map(catalog.relations.map(r=>[`${r.schema_name}.${r.table_name}`,r]));
 const baseline=new Map(reviewed.relations.map(r=>[`${r.schema_name}.${r.table_name}`,r]));
 for(const [id,row] of relations){
  if(!mapped.has(id))errors.push(`Unclassified relation: ${id}`);
  const old=baseline.get(id);
  if(!old){errors.push(`Unreviewed relation: ${id}`);continue;}
  if(row.relkind!==old.relkind||row.rls_enabled!==old.rls_enabled)errors.push(`Relation kind/RLS changed: ${id}`);
  const columns=new Map(row.columns.map(c=>[c.name,c.type]));const oldColumns=new Map(old.columns.map(c=>[c.name,c.type]));
  for(const [column,type] of columns)if(oldColumns.get(column)!==type)errors.push(`New/changed column: ${id}.${column}`);
  for(const column of oldColumns.keys())if(!columns.has(column))errors.push(`Removed column: ${id}.${column}`);
  if(sorted(row.foreign_keys)!==sorted(old.foreign_keys))errors.push(`Ownership/foreign keys changed: ${id}`);
 }
 for(const id of new Set([...mapped.keys(),...baseline.keys()]))if(!relations.has(id))errors.push(`Missing relation: ${id}`);
 const buckets=new Map(catalog.buckets.map(b=>[b.id,b]));const oldBuckets=new Map(reviewed.buckets.map(b=>[b.id,b]));
 const bucketIds=new Set();
 for(const b of inventory.buckets){
  if(!object(b)||!name(b.id)||!['scope','data','review'].every(k=>typeof b[k]==='string'&&b[k].trim())){errors.push('Malformed bucket classification.');continue;}
  if(bucketIds.has(b.id))errors.push(`Duplicate bucket classification: ${b.id}`);bucketIds.add(b.id);
 }
 for(const [id,b] of buckets){if(!bucketIds.has(id))errors.push(`Unclassified bucket: ${id}`);if(!oldBuckets.has(id)||oldBuckets.get(id).public!==b.public)errors.push(`Bucket visibility/configuration changed: ${id}`);}
 for(const id of new Set([...bucketIds,...oldBuckets.keys()]))if(!buckets.has(id))errors.push(`Missing bucket: ${id}`);
 if(!unique(inventory.outsideCatalog.map(s=>s?.id))||inventory.outsideCatalog.length===0||!inventory.outsideCatalog.every(s=>object(s)&&['id','location','data','review'].every(k=>typeof s[k]==='string'&&s[k].trim())))errors.push('Malformed external/local inventory.');
 return errors;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {
  if(process.argv.length!==4||process.argv[2]!=='--catalog')throw Error('Usage: npm run check:personal-data-inventory -- --catalog /path/to/metadata.json (run capture-personal-data-catalog.sql first).');
  const catalog=JSON.parse(readFileSync(process.argv[3],'utf8'));
  const errors=auditInventory(catalog);
  if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
  else console.log(`PASS metadata coverage: ${catalog.relations.length} relations and ${catalog.buckets.length} buckets match the reviewed inventory. No live connection, row-content review or export verification was performed by this command.`);
 }catch(error){console.error(error instanceof SyntaxError?'Invalid metadata JSON.':error.message);process.exitCode=1;}
}
