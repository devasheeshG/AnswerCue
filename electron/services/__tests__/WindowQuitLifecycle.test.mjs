import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function fixture() {
  const windows = [];
  class FakeWindow extends EventEmitter {
    constructor() {
      super(); this.visible = false; this.destroyed = false;
      this.webContents = new EventEmitter();
      this.webContents.send = () => {};
      windows.push(this);
    }
    isVisible() { return this.visible; }
    isDestroyed() { return this.destroyed; }
    setContentProtection() {}
    setVisibleOnAllWorkspaces() {}
    setHiddenInMissionControl() {}
    setAlwaysOnTop() {}
    setOpacity() {}
    show() { this.visible = true; }
    hide() { this.visible = false; }
    focus() {}
    loadURL() { return Promise.resolve(); }
    destroy() { this.destroyed = true; this.visible = false; this.emit('closed'); }
    close() {
      let cancelled = false;
      this.emit('close', { preventDefault() { cancelled = true; } });
      if (!cancelled) this.destroy();
      return !cancelled;
    }
  }
  const exports = {};
  const source = fs.readFileSync(new URL('../../WindowHelper.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, __dirname: '/test/electron', setTimeout, clearTimeout,
    console: { log() {}, error() {}, warn() {} },
    process: { env: {}, resourcesPath: '/test/resources', execPath: '/Applications/AnswerCue.app/Contents/MacOS/AnswerCue', platform: 'darwin' },
    require: name => {
      if (name === 'node:path') return path;
      if (name === 'electron') return {
        app: { isPackaged: true }, BrowserWindow: FakeWindow, Menu: {},
        screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } }) },
      };
      if (name === './services/KeybindManager') return { KeybindManager: { getInstance: () => ({ setMode() {} }) } };
      if (name === './services/StealthKeyboardManager') return { StealthKeyboardManager: { getInstance: () => ({ setOverlayWindow() {} }) } };
      throw new Error(`Unexpected WindowHelper dependency: ${name}`);
    },
  });
  let quitting = false;
  let stops = 0;
  const helper = new exports.WindowHelper({
    getDisguise: () => 'none', getUndetectable: () => false,
    getIsMeetingActive: () => true, isQuitting: () => quitting,
    endMeeting: async () => { stops++; },
  });
  helper.createWindow();
  return { helper, windows, stops: () => stops, quit: () => { quitting = true; } };
}

test('a visible interview overlay cannot cancel application shutdown', () => {
  const { helper, quit } = fixture();
  const overlay = helper.getOverlayWindow();
  overlay.show();
  quit();
  assert.equal(overlay.close(), true);
  assert.equal(overlay.isDestroyed(), true);
});

test('closing and reopening the launcher destroys its old overlay instead of orphaning it', () => {
  const { helper, windows } = fixture();
  const oldOverlay = helper.getOverlayWindow();
  oldOverlay.show();
  helper.getLauncherWindow().close();
  assert.equal(oldOverlay.isDestroyed(), true);
  helper.createWindow();
  assert.notEqual(helper.getOverlayWindow(), oldOverlay);
  assert.equal(windows.filter(window => !window.isDestroyed()).length, 2);
});

test('closing the live popup stops the interview rather than leaving capture running', () => {
  const { helper, stops } = fixture();
  const overlay = helper.getOverlayWindow();
  overlay.show();
  assert.equal(overlay.close(), false);
  assert.equal(stops(), 1);
});
