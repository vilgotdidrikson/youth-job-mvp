import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(join(tmpdir(), 'mnw-video-'));
try {
  writeFileSync(join(dir, 'video.mjs'), ts.transpileModule(readFileSync('lib/profile-video.ts', 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
  }).outputText);
  const {PROFILE_VIDEO_POLICY: policy, validateProfileVideo: validate, isProfileVideoPath: validPath} =
    await import(pathToFileURL(join(dir, 'video.mjs')));
  const file = {name: 'presentation.mp4', type: 'video/mp4', size: 1024, durationSeconds: 30};
  assert.equal(validate(file).ok, true);
  assert.equal(validate({...file, size: policy.maxBytes, durationSeconds: 60}).ok, true);
  assert.equal(validate({...file, name: 'VIDEO.MOV', type: 'video/quicktime'}).ok, true);
  assert.equal(validate({...file, name: 'video.webm', type: 'video/webm'}).ok, true);
  for (const size of [0, -1, NaN, Infinity, 1.5]) assert.equal(validate({...file, size}).code, 'empty');
  assert.equal(validate({...file, size: policy.maxBytes + 1}).code, 'size');
  for (const durationSeconds of [0, -1, NaN, Infinity, 60.001]) {
    assert.equal(validate({...file, durationSeconds}).code, 'duration');
  }
  // No mandatory 30-second minimum: a short introduction remains optional.
  assert.equal(validate({...file, durationSeconds: 1}).ok, true);
  for (const override of [{type: ''}, {type: 'text/html'}, {name: 'file.mov'}, {name: 'file'},
    {name: 'file.mp4.exe'}, {type: '__proto__'}, {type: 'constructor'}]) {
    assert.equal(validate({...file, ...override}).code, 'format');
  }
  const owner = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const path = `${owner}/${other}.mp4`;
  assert.equal(validPath(path, owner), true);
  for (const bad of [null, '', `${other}/${other}.mp4`, `${owner}/../${other}.mp4`,
    `https://example.org/${path}`, `${path}?download=1`, `${path}/extra`, `${owner}/file.mp4`]) {
    assert.equal(validPath(bad, owner), false);
  }
  assert.equal(validPath(path, '.*'), false);
  console.log('PASS: shared chat-video format, size, duration boundaries and owner path validation. No live upload/access tests.');
} finally {
  rmSync(dir, {recursive: true, force: true});
}
