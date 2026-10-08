const fs = require('fs');
const path = require('path');
const assert = require('assert');
const asar = require('@electron/asar');
const [archive, arch] = process.argv.slice(2);
assert(archive && ['arm64', 'x64'].includes(arch), 'Usage: verify-package-layout.cjs app.asar arm64|x64');
const files = asar.listPackage(archive).map(file => file.replace(/^\//, ''));
const required = ['dist/index.html', 'dist/THIRD_PARTY_NOTICES.txt', 'dist-electron/THIRD_PARTY_NOTICES.txt', 'dist-electron/electron/main.js', 'dist-electron/electron/preload.js', 'dist-electron/electron/pdf.worker.mjs', `native-module/index.darwin-${arch}.node`, 'LICENSE'];
for (const pkg of ['better-sqlite3', 'keytar', 'sharp', 'pdf-parse', 'ajv', 'ajv-formats', 'google-auth-library', '@napi-rs/canvas', `@napi-rs/canvas-darwin-${arch}`, `@img/sharp-darwin-${arch}`, `@img/sharp-libvips-darwin-${arch}`]) required.push(`node_modules/${pkg}/package.json`);
for (const file of required) assert(files.includes(file), `Missing packaged runtime file: ${file}`);
for (const pkg of ['react', 'react-dom', 'react-icons', 'lucide-react', 'three', 'tap', 'typescript', '@typescript/native-preview', 'tesseract.js', 'tesseract.js-core', '@huggingface/transformers', 'onnxruntime-node', 'sqlite3', '@elevenlabs/client', '@google/stitch-sdk']) assert(!files.some(file => file.startsWith(`node_modules/${pkg}/`)), `Unneeded package included: ${pkg}`);
const other = arch === 'arm64' ? 'x64' : 'arm64';
assert(!files.includes(`native-module/index.darwin-${other}.node`), 'Other audio architecture was packaged');
for (const file of files) {
  assert(!/^(native-module\/target\/|electron\/|src\/|scripts\/|temp\/|\.env(?:$|\.))/.test(file), `Source/build artifact shipped: ${file}`);
  if (file.startsWith('node_modules/@img/') && /sharp.*darwin-/.test(file)) assert(!file.includes(`darwin-${other}`), `Other sharp architecture: ${file}`);
  if (file.startsWith('node_modules/@napi-rs/canvas-')) assert(file.startsWith(`node_modules/@napi-rs/canvas-darwin-${arch}/`) || file === `node_modules/@napi-rs/canvas-darwin-${arch}`, `Other canvas architecture: ${file}`);
  assert(!file.endsWith('.map'), `Source map shipped: ${file}`);
}
const sizes = new Map();
for (const file of files) {
  const stat = asar.statFile(archive, file);
  if (stat.files) continue;
  const category = file.startsWith('node_modules/') ? (file.split('/')[1].startsWith('@') ? file.split('/').slice(0, 3).join('/') : file.split('/').slice(0, 2).join('/')) : file.split('/')[0];
  sizes.set(category, (sizes.get(category) || 0) + (stat.size || 0));
}
console.log(`[verify-package-layout] PASS ${arch}: required runtime modules present, no development libraries, no other native architecture`);
for (const [name, size] of [...sizes].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`${(size / 1048576).toFixed(1)} MiB ${name}`);
console.log(`Archive: ${(fs.statSync(archive).size / 1048576).toFixed(1)} MiB`);
