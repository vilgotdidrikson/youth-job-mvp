import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const load = Module._load;
// The Supabase client is not needed for the pure helpers.
Module._load = function (request, parent, ...rest) { if (request === './supabase') return { getSupabaseClient: () => { throw new Error('offline'); } }; return load.call(this, request, parent, ...rest); };
const { safeExternalUrl, readPublicCompanyProfile, companyFacts } = require('../lib/company-public-profile.ts');
Module._load = load;

// Only http(s) links survive; bare domains get https.
assert.equal(safeExternalUrl('matchnwork.se'), 'https://matchnwork.se/');
assert.equal(safeExternalUrl('http://exempel.se/om'), 'http://exempel.se/om');
assert.equal(safeExternalUrl('javascript:alert(1)'), '');
assert.equal(safeExternalUrl('data:text/html,hej'), '');
assert.equal(safeExternalUrl('  '), '');
assert.equal(safeExternalUrl(42), '');

// Reading the RPC result keeps only the public shape.
const profile = readPublicCompanyProfile({ company_name: ' QA Café ', industry: 'Café', description: 'Vi bakar.', city: 'Solna', employee_count: '10–49', logo_url: 'javascript:x', website_url: 'qa.example', verified: true, open_jobs: 2, administrator: 'Hemlig', organization_number: '5560000000' });
assert.deepEqual(profile, { companyName: 'QA Café', industry: 'Café', description: 'Vi bakar.', city: 'Solna', employeeCount: '10–49', logoUrl: '', websiteUrl: 'https://qa.example/', verified: true, openJobs: 2 });
assert.equal(readPublicCompanyProfile(null), null);
assert.equal(readPublicCompanyProfile([]), null);
assert.equal(readPublicCompanyProfile({ verified: 'true', open_jobs: -1 }).verified, false, 'Only a real boolean counts as verified');
assert.equal(readPublicCompanyProfile({ open_jobs: 'x' }).openJobs, 0);
assert.deepEqual(companyFacts(profile), ['Café', 'Solna', '10–49 anställda']);
assert.deepEqual(companyFacts({ ...profile, industry: '', employeeCount: '5 anställda' }), ['Solna', '5 anställda']);

// The migration exposes only descriptive fields, mirrors job visibility and keeps RLS untouched.
const sql = readFileSync('supabase/migrations/20261025120000_n04_job_company_profile.sql', 'utf8');
const output = sql.slice(sql.indexOf('jsonb_build_object('), sql.indexOf('into result'));
for (const hidden of ['administrator', 'organization_number', 'address', 'linkedin', 'instagram', 'company_match_profiles', 'hiring_priorities']) assert.ok(!output.includes(hidden), `${hidden} must not leave the function`);
assert.match(sql, /private\.get_job_company_profile\(p_job_id uuid\)\s+returns jsonb language plpgsql stable security definer set search_path=''/);
assert.match(sql, /j\.company_user_id=auth\.uid\(\) or \(j\.is_active and j\.status='active' and j\.publication_status='published'\)/);
assert.match(sql, /not public\.users_are_blocked\(auth\.uid\(\), j\.company_user_id\)/);
assert.match(sql, /revoke all on function public\.get_job_company_profile\(uuid\) from public,anon;/);
assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /policy|alter table/i, 'No RLS or table change');

// The job page shows the card only to signed-in users.
const page = readFileSync('app/jobb/[jobId]/page.tsx', 'utf8');
assert.match(page, /\{user && <JobCompanyCard key=\{job\.id\} jobId=\{job\.id\}/);
console.log('PASS company public profile: safe links, public fields only, job visibility and blocks in the RPC, no RLS change, signed-in card.');
