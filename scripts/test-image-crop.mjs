import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(join(tmpdir(), 'mnw-crop-'));
try {
  const code = ts.transpileModule(readFileSync('lib/image-crop-geometry.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const path = join(dir, 'geometry.mjs');
  writeFileSync(path, code);
  const { panCrop, zoomCrop, cropSourceRect } = await import(pathToFileURL(path));
  const viewport = { width: 400, height: 300 };
  const centered = { zoom: 1, offsetX: 0, offsetY: 0 };
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
  for (const image of [{ width: 2000, height: 1000 }, { width: 800, height: 2400 }, { width: 1200, height: 900 }]) {
    const zoomed = zoomCrop(centered, image, viewport, 2, 200, 150);
    const before = cropSourceRect(image, zoomed);
    const moved = cropSourceRect(image, panCrop(zoomed, image, viewport, 30, -20));
    near(moved.x, before.x - 30 * before.width / viewport.width);
    near(moved.y, before.y + 20 * before.height / viewport.height);
    // Off-center zoom keeps the same original pixel under the pointer.
    const anchored = cropSourceRect(image, zoomCrop(zoomed, image, viewport, 2.5, 250, 100));
    near(before.x + before.width * 250 / 400, anchored.x + anchored.width * 250 / 400);
    near(before.y + before.height * 100 / 300, anchored.y + anchored.height * 100 / 300);
    for (const zoom of [0.1, 1, 2, 3, 20]) {
      for (const delta of [-100000, 100000]) {
        const position = panCrop(zoomCrop(centered, image, viewport, zoom, 0, 0), image, viewport, delta, delta);
        assert.ok(position.zoom >= 1 && position.zoom <= 3);
        const rect = cropSourceRect(image, position);
        near(rect.width / rect.height, 4 / 3);
        assert.ok(rect.x >= 0 && rect.y >= 0);
        assert.ok(rect.x + rect.width <= image.width + 1e-8 && rect.y + rect.height <= image.height + 1e-8);
      }
    }
  }
  assert.deepEqual(panCrop(centered, { width: 1200, height: 900 }, viewport, 100, 100), centered);
  console.log('PASS: mouse/touch pan distance, pointer-anchored zoom, zoom limits, image edges and 4:3 output.');
} finally { rmSync(dir, { recursive: true, force: true }); }
