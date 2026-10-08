import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
function harness() {
  const source = fs.readFileSync(new URL('../../main.ts', import.meta.url), 'utf8');
  const parsed = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true);
  const cls = parsed.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'AppState');
  const code = ts.transpileModule(cls.getText(parsed), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = { name: [], icon: [], timers: 0 }; const exports = {};
  const process = { platform: 'darwin', env: {}, resourcesPath: '/app/resources', title: 'AnswerCue' };
  vm.runInNewContext(code, { exports, process, APP_NAME: 'AnswerCue', APP_ID: 'com.answercue.desktop', path, fs: { existsSync: () => true },
    console: { log() {}, warn() {} }, app: { isPackaged: true, getAppPath: () => '/app', setName: value => calls.name.push(value), dock: { setIcon: value => calls.icon.push(value) } }, nativeImage: { createFromPath: value => value },
    setTimeout: () => ++calls.timers, clearTimeout() {},
  });
  const state = Object.create(exports.AppState.prototype); state._disguiseTimers = []; state.isUndetectable = false;
  const window = { isDestroyed: () => false, setTitle() {}, webContents: { send() {} } };
  state.windowHelper = { getLauncherWindow: () => window, getOverlayWindow: () => window };
  state.settingsWindowHelper = { getSettingsWindow: () => window };
  return { state, calls, process };
}
test('normal Mac disguise application leaves bundle name and packaged Dock icon untouched', () => {
  const { state, calls, process } = harness(); state._applyDisguise('none'); state._applyDisguise('none');
  assert.equal(calls.name.length, 0); assert.equal(calls.icon.length, 0); assert.equal(calls.timers, 0);
  assert.equal(process.env.CFBundleName, undefined);
});
test('explicit disguise changes presentation once and restores default icon without renaming Mac app', () => {
  const { state, calls, process } = harness(); state._applyDisguise('terminal'); state._applyDisguise('terminal');
  assert.equal(calls.icon.length, 1); assert.equal(calls.timers, 3);
  state._applyDisguise('none'); state._applyDisguise('none'); assert.equal(calls.icon.length, 2);
  assert.equal(calls.name.length, 0); assert.equal(process.env.CFBundleName, undefined);
});
