import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

function loader(get) {
  const source = fs.readFileSync(new URL('../../utils/modelFetcher.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => {
    if (name === 'axios') return { get };
    if (name === '../llm/cloudModelCatalog') return { isRetiredOpenAiModel: id => /gpt-5\.5/.test(id) };
    throw new Error(`Unexpected discovery dependency: ${name}`);
  } });
  return exports.fetchProviderModels;
}

test('Claude discovery follows pagination and includes models outside the old preset list', async () => {
  const calls = [];
  const fetch = loader(async (url, options) => {
    calls.push(options.params);
    assert.equal(url, 'https://api.anthropic.com/v1/models');
    return options.params.after_id
      ? { data: { data: [{ id: 'claude-haiku-user-model', display_name: 'Haiku' }], has_more: false } }
      : { data: { data: [{ id: 'claude-opus-user-model', display_name: 'Opus' }], has_more: true, last_id: 'claude-opus-user-model' } };
  });
  const models = await fetch('claude', 'test-only-key');
  assert.deepEqual(Array.from(models, model => model.id), ['claude-haiku-user-model', 'claude-opus-user-model']);
  assert.equal(calls[1].after_id, 'claude-opus-user-model');
});

test('Gemini discovery follows pagination and excludes embedding-only models', async () => {
  const fetch = loader(async (_url, options) => ({ data: options.params.pageToken ? {
    models: [{ name: 'models/gemini-3.5-flash', displayName: 'Flash', supportedGenerationMethods: ['generateContent'] }],
  } : {
    models: [{ name: 'models/gemini-embedding', supportedGenerationMethods: ['embedContent'] }], nextPageToken: 'next',
  } }));
  const models = await fetch('gemini', 'test-only-key');
  assert.deepEqual(Array.from(models, model => model.id), ['gemini-3.5-flash']);
});

test('OpenAI discovery excludes non-chat audio/image models and keeps supported chat families', async () => {
  const fetch = loader(async () => ({ data: { data: ['gpt-4.1', 'gpt-4o', 'gpt-6.1-sol', 'gpt-4o-audio-preview', 'gpt-image-1', 'gpt-5.5'].map(id => ({ id })) } }));
  const models = await fetch('openai', 'test-only-key');
  assert.deepEqual(Array.from(models, model => model.id), ['gpt-4.1', 'gpt-4o', 'gpt-6.1-sol']);
});
