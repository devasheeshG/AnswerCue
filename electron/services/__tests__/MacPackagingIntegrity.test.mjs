import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function signingHook({ failNative = false, production = false } = {}) {
  const commands = [];
  const exports = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts/ad-hoc-sign.js'), 'utf8'), {
    exports,
    console: { log() {}, warn() {}, error() {} },
    process: { platform: 'darwin', env: production ? { ANSWERCUE_PRODUCTION_SIGN: '1' } : {} },
    require: name => {
      if (name === 'path') return path;
      if (name === 'fs') return {
        existsSync: p => p.endsWith('native-module'),
        readdirSync: () => ['index.darwin-arm64.node', 'index.darwin-x64.node'],
      };
      if (name === 'child_process') return { execSync: command => {
        commands.push(command);
        if (failNative && command.includes('index.darwin-arm64.node')) throw new Error('Native signature failed');
      } };
      throw new Error(`Unmocked dependency: ${name}`);
    },
  });
  return { hook: exports.default, commands };
}

const context = {
  appOutDir: '/tmp/mac-build', electronPlatformName: 'darwin',
  packager: { appInfo: { productFilename: 'AnswerCue' }, info: { projectDir: root } },
};

test('Ad-hoc packaging seals the outer app after all native module edits, then verifies it', async () => {
  const { hook, commands } = signingHook();
  await hook(context);
  const nativeIndexes = commands.map((c, i) => c.includes('.node') ? i : -1).filter(i => i >= 0);
  const seal = commands.at(-2);
  assert.ok(nativeIndexes.every(i => i < commands.length - 2));
  assert.match(seal, /codesign --force .*--sign - "\/tmp\/mac-build\/AnswerCue\.app"/);
  assert.ok(!seal.includes('--deep'), 'Final seal must preserve nested entitlements');
  assert.match(commands.at(-1), /codesign --verify --deep --strict/);
});

test('Native signing failures stop packaging instead of shipping a partially signed app', async () => {
  const { hook } = signingHook({ failNative: true });
  await assert.rejects(hook(context), /Native signature failed/);
});

test('Ad-hoc signing never overwrites the Developer ID production path', async () => {
  const { hook, commands } = signingHook({ production: true });
  await hook(context);
  assert.equal(commands.length, 0);
});
