import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { MacDockVisibility } = require('../../../dist-electron/electron/services/MacDockVisibility.js');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(initial = true) {
  let visible = initial;
  let time = 0;
  const calls = [];
  const dock = {
    isVisible: () => visible,
    show: async () => { calls.push('show'); visible = true; },
    hide: () => { calls.push('hide'); visible = false; },
  };
  const controller = new MacDockVisibility(dock, () => time, async ms => { calls.push(`wait:${ms}`); time += ms; });
  return { dock, controller, calls, setVisible: value => { visible = value; } };
}

test('normal startup and repeated Dock activation reuse the existing icon', async () => {
  const { controller, calls } = fixture();
  for (let i = 0; i < 20; i++) await controller.setVisible(true);
  assert.deepEqual(calls, []);
});

test('concurrent reopen requests issue one native show operation', async () => {
  const { dock, controller, calls, setVisible } = fixture(false);
  const pending = deferred();
  dock.show = async () => { calls.push('show'); await pending.promise; setVisible(true); };
  const requests = Array.from({ length: 20 }, () => controller.setVisible(true));
  await Promise.resolve();
  assert.deepEqual(calls, ['show']);
  pending.resolve();
  await Promise.all(requests);
  assert.deepEqual(calls, ['show']);
});

test('a hide requested during show waits for completion and the Electron cooldown', async () => {
  const { dock, controller, calls, setVisible } = fixture(false);
  const pending = deferred();
  dock.show = async () => { calls.push('show'); await pending.promise; setVisible(true); };
  const showing = controller.setVisible(true);
  await Promise.resolve();
  const hiding = controller.setVisible(false);
  pending.resolve();
  await Promise.all([showing, hiding]);
  assert.deepEqual(calls, ['show', 'wait:1100', 'hide']);
});

test('rapid toggles converge on the latest state without showing a second tile', async () => {
  const { dock, controller, calls, setVisible } = fixture(false);
  const pending = deferred();
  dock.show = async () => { calls.push('show'); await pending.promise; setVisible(true); };
  const showing = controller.setVisible(true);
  await Promise.resolve();
  controller.setVisible(false);
  controller.setVisible(true);
  pending.resolve();
  await showing;
  assert.deepEqual(calls, ['show']);
});

test('a newer show request cancels a hide waiting for the cooldown', async () => {
  let visible = false;
  const calls = [];
  const wait = deferred();
  const controller = new MacDockVisibility({
    isVisible: () => visible,
    show: async () => { calls.push('show'); visible = true; },
    hide: () => { calls.push('hide'); visible = false; },
  }, () => 0, async () => { calls.push('wait'); await wait.promise; });
  await controller.setVisible(true);
  const hiding = controller.setVisible(false);
  await Promise.resolve();
  controller.setVisible(true);
  wait.resolve();
  await hiding;
  assert.deepEqual(calls, ['show', 'wait']);
});

test('a rejected native show clears the pending operation so later requests can retry', async () => {
  const { dock, controller, calls, setVisible } = fixture(false);
  dock.show = async () => { throw new Error('Dock unavailable'); };
  await assert.rejects(controller.setVisible(true), /Dock unavailable/);
  dock.show = async () => { calls.push('show'); setVisible(true); };
  await controller.setVisible(true);
  assert.deepEqual(calls, ['show']);
});

test('quitting cancels queued visibility changes', async () => {
  const { dock, controller, calls, setVisible } = fixture(false);
  const pending = deferred();
  dock.show = async () => { calls.push('show'); await pending.promise; setVisible(true); };
  const showing = controller.setVisible(true);
  await Promise.resolve();
  controller.setVisible(false);
  controller.dispose();
  pending.resolve();
  await showing;
  await controller.setVisible(true);
  assert.deepEqual(calls, ['show']);
});
