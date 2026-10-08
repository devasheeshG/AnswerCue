import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

test('stopping a resumed interview appends transcript and usage to the same saved record', async () => {
  const source = fs.readFileSync(new URL('../../MeetingPersistence.ts', import.meta.url), 'utf8');
  const parsed = ts.createSourceFile('MeetingPersistence.ts', source, ts.ScriptTarget.Latest, true);
  const declaration = parsed.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'MeetingPersistence');
  const compiled = ts.transpileModule(declaration.getText(parsed), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const previous = { id: 'same-interview', duration: '1:00', transcript: [{ speaker: 'interviewer', text: 'Previous question', timestamp: 1 }], usage: [{ ai_response: 'Previous answer' }] };
  const saved = [], attached = [];
  const DatabaseManager = { getInstance: () => ({ getMeetingDetails: () => previous, saveMeeting: meeting => saved.push(meeting) }) };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, crypto, DatabaseManager,
    InterviewWorkspaceStateManager: { getInstance: () => ({ attachMeeting: (...args) => attached.push(args) }) },
    console: { log() {}, warn() {}, error() {} },
    require: name => {
      if (name === './services/SettingsManager') return { SettingsManager: { getInstance: () => ({ get: () => 'forever' }) } };
      if (name === './services/ModesManager') return { ModesManager: { getInstance: () => ({ getActiveMode: () => null }) } };
      if (name === 'electron') return { BrowserWindow: { getAllWindows: () => [] } };
      throw new Error(`Unmocked dependency: ${name}`);
    },
  });
  let reset = false;
  const session = {
    flushInterimTranscript() {}, getSessionStartTime: () => Date.now() - 1000,
    getFullTranscript: () => [{ speaker: 'user', text: 'New response', timestamp: 2, final: true }],
    getFullUsage: () => [{ ai_response: 'New answer' }], getFullSessionContext: () => 'All background and chat',
    getMeetingMetadata: () => ({ resumeMeetingId: 'same-interview', interviewContext: { workspaceStateId: 'same-workspace', contextMarkdown: 'Full preparation' } }),
    reset() { reset = true; },
  };
  const persistence = new exports.MeetingPersistence(session, {});
  persistence.processAndSaveMeeting = async () => {};
  assert.equal(await persistence.stopMeeting(), 'same-interview');
  assert.equal(reset, true); assert.equal(saved[0].id, previous.id);
  assert.deepEqual(Array.from(saved[0].transcript, segment => segment.text), ['Previous question', 'New response']);
  assert.equal(saved[0].usage.length, 2);
  assert.equal(attached[0][0], 'same-workspace'); assert.equal(attached[0][1], previous.id);
});

test('concurrent starts do not open a second session, and permission failures allow retry', async () => {
  const source = fs.readFileSync(new URL('../../main.ts', import.meta.url), 'utf8');
  const parsed = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true);
  const declaration = parsed.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'AppState');
  const compiled = ts.transpileModule(declaration.getText(parsed), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let releasePermission;
  let calls = 0;
  const permission = new Promise(resolve => { releasePermission = resolve; });
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, process: { platform: 'linux' },
    console: { log() {}, warn() {}, error() {} },
    ensureMacMicrophoneAccess: async () => { calls++; return permission; },
    formatPermissionMessage: () => 'Permission denied',
  });
  const app = Object.create(exports.AppState.prototype);
  app.isMeetingActive = false;
  app._startMeetingInFlight = false;
  app.broadcast = () => {};
  const first = app.startMeeting({ source: 'manual' });
  const second = app.startMeeting({ source: 'manual' });
  assert.equal(calls, 1);
  releasePermission(false);
  const results = await Promise.allSettled([first, second]);
  assert.ok(results.every(result => result.status === 'rejected'));
  assert.equal(app._startMeetingInFlight, false);
  await assert.rejects(app.startMeeting({ source: 'manual' }), /Permission denied/);
  assert.equal(calls, 2);
});
