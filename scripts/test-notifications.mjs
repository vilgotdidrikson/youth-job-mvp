import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);

// Simulated Supabase client recording each query's filters. Fictional data only.
const calls = [];
let next = { data: [], error: null };
const client = { from(table) {
  const call = { table, filters: [] }; calls.push(call);
  const query = {
    update(values) { call.update = values; return query; }, select(columns) { call.select = columns; return query; },
    eq(column, value) { call.filters.push(['eq', column, value]); return query; }, is(column, value) { call.filters.push(['is', column, value]); return query; },
    limit() { return query; }, then(resolve) { resolve(next); },
  };
  return query;
} };
const load = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === '@/lib/supabase') return { getSupabaseClient: () => client };
  return load.call(this, request, parent, ...rest);
};
const { splitNotifications, notificationIcon, markMatchNotificationsRead, markAllNotificationsRead } = require('../lib/notifications.ts');
const { countPendingInterests } = require('../lib/youth-activity.ts');
const { pendingInterestReminder } = require('../lib/application-overview.ts');
Module._load = load;

// Unread notices are what still needs attention; read ones are history.
const items = [{ id: 'a', read_at: null }, { id: 'b', read_at: '2026-10-21T08:00:00Z' }, { id: 'c', read_at: null }];
assert.deepEqual(splitNotifications(items).unread.map(item => item.id), ['a', 'c']);
assert.deepEqual(splitNotifications(items).earlier.map(item => item.id), ['b']);
assert.equal(notificationIcon('message'), 'chat');
assert.equal(notificationIcon('match'), 'chat');
assert.equal(notificationIcon('application_update'), 'briefcase');
assert.equal(notificationIcon('moderation'), 'bell');

// Opening a chat marks only this person's unread notices for that match.
next = { data: [{ id: 'n1' }], error: null };
assert.equal(await markMatchNotificationsRead('youth-a', 'match-1'), true);
let call = calls.pop();
assert.equal(call.table, 'notifications');
assert.ok(call.update.read_at);
assert.deepEqual(call.filters, [['eq', 'user_id', 'youth-a'], ['eq', 'match_id', 'match-1'], ['is', 'read_at', null]]);
next = { data: [], error: null };
assert.equal(await markMatchNotificationsRead('youth-a', 'match-1'), false, 'No badge refresh when nothing changed');
// Before the migration is applied the column is missing; the chat keeps working.
next = { data: null, error: { message: 'column notifications.match_id does not exist' } };
assert.equal(await markMatchNotificationsRead('youth-a', 'match-1'), false);
calls.length = 0;

next = { data: null, error: null };
assert.ok(await markAllNotificationsRead('company-b'));
assert.deepEqual(calls.pop().filters, [['eq', 'user_id', 'company-b'], ['is', 'read_at', null]]);
next = { data: null, error: { message: 'denied' } };
await assert.rejects(markAllNotificationsRead('company-b'), /Kunde inte markera notiserna som lästa/);

// The CV reminder counts only saved interests that can still be sent.
const job = (status, publication_status = 'published', is_active = true) => ({ title: 'QA', company_name: 'QA', status, is_active, publication_status });
next = { data: [{ job_id: 'open', jobs: job('active') }, { job_id: 'paused', jobs: job('paused') }, { job_id: 'hidden', jobs: null }, { job_id: 'waiting', jobs: job('active', 'pending_verification') }, { job_id: 'array', jobs: [job('active')] }], error: null };
assert.equal(await countPendingInterests('youth-a'), 2);
call = calls.pop();
assert.equal(call.table, 'youth_application_drafts');
assert.deepEqual(call.filters, [['eq', 'youth_user_id', 'youth-a']]);
next = { data: null, error: { message: 'denied' } };
await assert.rejects(countPendingInterests('youth-a'));
assert.match(pendingInterestReminder(0), /Ett CV behövs innan ansökningarna skickas/);
assert.equal(pendingInterestReminder(1), 'Du har 1 sparat intresse som inte är skickat till företaget ännu. Det skickas automatiskt när ditt CV är sparat, så länge annonsen är öppen.');
assert.match(pendingInterestReminder(3), /^Du har 3 sparade intressen som inte är skickade till företagen ännu\. De skickas automatiskt/);

// Wiring in the views.
const chat = readFileSync('app/chats/page.tsx', 'utf8');
assert.match(chat, /markMatchNotificationsRead\(userId,matchId\)/);
assert.match(chat, /document\.visibilityState === "visible"/, 'Only a visible conversation counts as seen');
assert.match(chat, /if\(changed\) window\.dispatchEvent\(new Event\("mnw-navigation-refresh"\)\)/);
assert.match(chat, /loadedId && loadedId === selectedId/, 'Notices clear after the messages are shown, not on selection');
const page = readFileSync('app/notifications/page.tsx', 'utf8');
assert.match(page, /splitNotifications\(current\.items\)/);
assert.match(page, /Markera alla som lästa/);
assert.match(page, /markAllNotificationsRead\(userId\)/);
assert.match(page, /notificationIcon\(item\.type\)/);
const notice = readFileSync('components/profile-completion-notice.tsx', 'utf8');
assert.match(notice, /youth && !cvLoading && !cvCompleted \? user\?\.id : undefined/, 'Reminder is read only for youth without a finished CV');
assert.match(notice, /pendingInterestReminder\(pendingCount\)/);
const indicators = readFileSync('hooks/use-navigation-indicators.tsx', 'utf8');
assert.match(indicators, /item\.type==="message" \|\| item\.type==="match"/, 'Meddelanden badge follows unread match and message notices');

// Migration: exact links, names and a single unread message notice per match.
const sql = readFileSync('supabase/migrations/20261021090000_f14_notification_context.sql', 'utf8');
assert.match(sql, /add column if not exists match_id uuid references public\.matches\(id\) on delete cascade/);
assert.match(sql, /'\/chats\?match=' \|\| match_row\.id/);
assert.match(sql, /'\/chats\?conversation=' \|\| new\.conversation_id/);
assert.ok(sql.indexOf('update public.notifications') < sql.indexOf("values (recipient, 'message'"), 'Unread message notice is reused before a new one is inserted');
assert.match(sql, /and read_at is null;\s+if not found then/);
assert.match(sql, /revoke all on function public\.create_mvp_notification\(\) from public, anon, authenticated;/);
assert.doesNotMatch(sql, /message_text/, 'Message contents are never copied into notices');
console.log('PASS notifications: unread/history split, read state per match, mark all, CV reminder count and text, view wiring, migration links and single unread message notice.');
