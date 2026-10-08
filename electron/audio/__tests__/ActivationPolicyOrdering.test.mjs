import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const source = readFileSync(path.join(root, 'electron/main.ts'), 'utf8');

test('normal startup preserves the existing macOS Dock policy instead of demoting and promoting it', () => {
  assert.doesNotMatch(source, /app\.setActivationPolicy\s*\(/);
  const start = source.indexOf('let isUndetectableOnStartup');
  const end = source.indexOf('process.title = APP_NAME', start);
  assert.match(source.slice(start, end), /if \(isUndetectableOnStartup\) await setMacDockVisible\(false\)/);
});

test('reopening and stealth changes share the serialized Dock controller', () => {
  assert.doesNotMatch(source, /^[ \t]*app\.dock\.(show|hide)\s*\(/m);
  assert.match(source, /new MacDockVisibility\(app\.dock\)/);
  const start = source.indexOf('app.on("activate"');
  const end = source.indexOf('app.on("window-all-closed"', start);
  assert.match(source.slice(start, end), /!appState\.getUndetectable\(\) && !appState\.getIsMeetingActive\(\)/);
  assert.match(source.slice(start, end), /setMacDockVisible\(true\)/);
  assert.match(source, /macDockVisibility\?\.dispose\(\)/);
});
