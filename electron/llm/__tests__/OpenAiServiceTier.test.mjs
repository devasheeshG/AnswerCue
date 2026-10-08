import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createOpenAiCompletion, normalizeOpenAiServiceTier, isOpenAiServiceTier, OPENAI_SERVICE_TIERS } = require('../../../dist-electron/electron/llm/openAiServiceTier.js');
test('Auto, Standard, and Fast preserve the selected model and pass explicit request tiers', async () => {
  const request = { model: 'gpt-6.1-sol', messages: [{ role: 'user', content: 'Hello' }], stream: true };
  const signal = new AbortController().signal;
  for (const [tier, expected] of [['auto', 'auto'], ['default', 'default'], ['fast', 'priority']]) {
    let sent, options; const stream = {};
    const client = { chat: { completions: { create: async (body, opts) => { sent = body; options = opts; return stream; } } } };
    assert.equal(await createOpenAiCompletion(client, request, tier, { signal }), stream);
    assert.equal(sent.model, request.model); assert.equal(sent.service_tier, expected);
    assert.deepEqual(sent.messages, request.messages); assert.equal(options.signal, signal);
  }
});
test('the removed Ultrafast setting migrates to Fast and cannot be selected again', () => {
  assert.deepEqual(OPENAI_SERVICE_TIERS, ['auto', 'default', 'fast']);
  assert.equal(isOpenAiServiceTier('ultrafast'), false);
  assert.equal(normalizeOpenAiServiceTier('ultrafast'), 'fast');
  assert.equal(normalizeOpenAiServiceTier('bad'), 'auto');
});

test('Responses-only models retain their model, tier, complete text and image input', async () => {
  let sent;
  const client = { responses: { create: async body => { sent = body; return { status: 'completed', output_text: 'OK' }; } } };
  const result = await createOpenAiCompletion(client, { model: 'gpt-5.4-pro', messages: [{ role: 'user', content: [
    { type: 'text', text: 'Complete attached file and Persona' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,test' } },
  ] }], max_completion_tokens: 1024 }, 'default');
  assert.equal(sent.model, 'gpt-5.4-pro');
  assert.equal(sent.service_tier, 'default');
  assert.equal(sent.input[0].content[0].text, 'Complete attached file and Persona');
  assert.equal(sent.input[0].content[1].image_url, 'data:image/png;base64,test');
  assert.equal(result.choices[0].message.content, 'OK');
});

test('legacy chat models use their compatible output-token parameter', async () => {
  let sent;
  const client = { chat: { completions: { create: async body => { sent = body; return {}; } } } };
  await createOpenAiCompletion(client, { model: 'gpt-4o', messages: [], max_completion_tokens: 4096 }, 'fast');
  assert.equal(sent.max_tokens, 4096);
  assert.equal(sent.max_completion_tokens, undefined);
  assert.equal(sent.service_tier, 'priority');
});
