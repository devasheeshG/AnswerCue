import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function manager(credentials) {
  const source = fs.readFileSync(new URL('../CredentialsManager.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, console: { log() {}, warn() {}, error() {} }, process, Buffer,
    require: name => {
      if (name === 'electron') return { app: { getPath: () => '/tmp/unused-test-path' }, safeStorage: {} };
      if (name === '../llm/cloudModelCatalog') return { isRetiredOpenAiModel: () => false };
      if (name === '../audio/transcriptionModels') return { getTranscriptionModel: id => id === 'gpt-live-transcribe' ? { provider: 'openai' } : id === 'scribe_v2_realtime' ? { provider: 'elevenlabs' } : undefined };
      return require(name);
    },
  });
  const cm = Object.create(exports.CredentialsManager.prototype); cm.credentials = { ...credentials };
  cm.saveCredentials = () => { cm.persisted = structuredClone(cm.credentials); };
  return cm;
}
test('upgrading local-only configuration reuses OpenAI key without changing LLM selection', () => {
  const cm = manager({ sttProvider: 'local-whisper', openaiApiKey: 'test-key', defaultModel: 'claude-opus' });
  assert.equal(cm.getSttProvider(), 'openai'); assert.equal(cm.getTranscriptionModel(), 'gpt-live-transcribe');
  assert.equal(cm.isTranscriptionConfigured(), true); assert.equal(cm.getOpenAiSttApiKey(), 'test-key');
  assert.equal(cm.credentials.defaultModel, 'claude-opus'); assert.equal(cm.persisted, undefined);
});
test('ElevenLabs-only credentials choose Scribe and selected model survives reload', () => {
  const cm = manager({ sttProvider: 'local-whisper', elevenLabsApiKey: 'test-eleven-key' });
  assert.equal(cm.getTranscriptionModel(), 'scribe_v2_realtime'); assert.equal(cm.isTranscriptionConfigured(), true);
  cm.setTranscriptionModel('scribe_v2_realtime'); const restored = manager(cm.persisted);
  assert.equal(restored.getSttProvider(), 'elevenlabs'); assert.equal(restored.getTranscriptionModel(), 'scribe_v2_realtime');
});
test('explicit model selection remains selected when its key is removed and readiness becomes false', () => {
  const cm = manager({ transcriptionModel: 'scribe_v2_realtime', openaiApiKey: 'test-openai-key' });
  assert.equal(cm.getSttProvider(), 'elevenlabs'); assert.equal(cm.isTranscriptionConfigured(), false);
  assert.throws(() => cm.setTranscriptionModel('whisper-local'), /Unsupported/);
  assert.throws(() => cm.setSttProvider('local-whisper'), /Choose OpenAI or ElevenLabs/);
});
test('separate OpenAI transcription key overrides the LLM key and removal restores fallback', () => {
  const cm = manager({ openaiApiKey: 'test-llm-key', openAiSttApiKey: 'test-stt-key' });
  assert.equal(cm.getOpenAiSttApiKey(), 'test-stt-key'); cm.setOpenAiSttApiKey('');
  assert.equal(cm.getOpenAiSttApiKey(), 'test-llm-key');
});
