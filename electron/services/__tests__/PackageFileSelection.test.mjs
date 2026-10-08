import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { FileMatcher, getNodeModuleFileMatcher } = require('app-builder-lib/out/fileMatcher.js');
const config = require('../../../package.json').build;
const root = path.resolve('/packaging-fixture');
const file = { isDirectory: () => false };
const directory = { isDirectory: () => true };
for (const arch of ['arm64', 'x64']) test(`actual electron-builder file filters retain ${arch} native libraries and omit other architectures`, () => {
  const other = arch === 'arm64' ? 'x64' : 'arm64';
  const expand = text => text.replaceAll('${arch}', arch).replaceAll('${platform}', 'darwin').replaceAll('${os}', 'mac');
  const nodeMatcher = getNodeModuleFileMatcher(root, root, expand, config.mac, { config, debugLogger: { isEnabled: false } }).createFilter();
  for (const pkg of [`@img/sharp-darwin-${arch}`, `@img/sharp-libvips-darwin-${arch}`, '@img/colour', '@napi-rs/canvas', `@napi-rs/canvas-darwin-${arch}`]) {
    assert.equal(nodeMatcher(path.join(root, 'node_modules', pkg), directory), true, pkg);
    assert.equal(nodeMatcher(path.join(root, 'node_modules', pkg, 'package.json'), file), true, pkg);
  }
  for (const pkg of [`@img/sharp-darwin-${other}`, `@img/sharp-libvips-darwin-${other}`, '@img/sharp-linux-arm64', `@napi-rs/canvas-darwin-${other}`, '@napi-rs/canvas-linux-x64-gnu']) assert.equal(nodeMatcher(path.join(root, 'node_modules', pkg, 'binary.node'), file), false, pkg);
  assert.equal(nodeMatcher(path.join(root, 'node_modules/pdf-parse/dist/pdf-parse/cjs/index.cjs'), file), true);
  assert.equal(nodeMatcher(path.join(root, 'node_modules/pdf-parse/dist/pdf-parse/web/pdf-parse.es.js'), file), false);
  const appMatcher = new FileMatcher(root, root, expand, config.files).createFilter();
  assert.equal(appMatcher(path.join(root, `native-module/index.darwin-${arch}.node`), file), true);
  assert.equal(appMatcher(path.join(root, `native-module/index.darwin-${other}.node`), file), false);
});
