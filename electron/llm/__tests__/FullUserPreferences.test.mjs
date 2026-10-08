import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const { buildUserPreferenceContext } = require('../../../dist-electron/electron/llm/userPreferences.js');

test('full custom files and Persona survive beyond former context limits', () => {
  const file = `FILE-BEGIN\n${'resume and background\n'.repeat(15000)}FILE-END`;
  const context = buildUserPreferenceContext('Conversation', file, 'Concise interview copilot');
  assert.ok(context.includes(file));
  assert.ok(context.includes('FILE-END'));
  assert.ok(context.includes('Concise interview copilot'));
  assert.ok(context.includes('Conversation'));
  assert.equal(context.includes('truncated'), false);
});

test('preferences already present in the context are not appended a second time', () => {
  const context = 'Instructions: unique-instructions\nPersona: unique-persona';
  assert.equal(buildUserPreferenceContext(context, 'unique-instructions', 'unique-persona'), context);
});

test('chat and stream wrappers include both preferences before provider routing', async () => {
  const source = fs.readFileSync(new URL('../../LLMHelper.ts', import.meta.url), 'utf8');
  const parsed = ts.createSourceFile('LLMHelper.ts', source, ts.ScriptTarget.Latest, true);
  const declaration = parsed.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'LLMHelper');
  const compiled = ts.transpileModule(declaration.getText(parsed), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, AbortSignal, buildUserPreferenceContext,
    require: name => { if (name === './llm/postProcessor') return { reduceDashesInChunk: value => value }; throw new Error(`Unexpected dependency: ${name}`); },
  });
  const helper = Object.create(exports.LLMHelper.prototype);
  helper.customNotes = `START\n${'complete-file\n'.repeat(5000)}END`;
  helper.personaPrompt = 'My saved Persona';
  const captured = [];
  helper._streamChatInner = async function* (_message, _images, context) { captured.push(context); yield 'Answer'; };
  for (const model of ['gpt-6.1-sol', 'claude-opus-5-5', 'gemini-3.5-flash']) {
    helper.currentModelId = model;
    assert.equal(await helper.chat('Question', undefined, 'Earlier conversation'), 'Answer');
    assert.ok(captured.at(-1).includes(helper.customNotes));
    assert.ok(captured.at(-1).includes(helper.personaPrompt));
    assert.ok(captured.at(-1).includes('Earlier conversation'));
  }
});
