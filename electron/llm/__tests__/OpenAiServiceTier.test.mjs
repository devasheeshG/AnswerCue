import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createOpenAiCompletion, normalizeOpenAiServiceTier, resolveOpenAiTierModel } =
  require('../../../dist-electron/electron/llm/openAiServiceTier.js');

const request = {
  model: 'gpt-6.1-sol',
  messages: [{ role: 'system', content: 'Be concise.' }, { role: 'user', content: 'Hello' }],
  max_completion_tokens: 1024,
  reasoning_effort: 'low',
  prompt_cache_key: 'stable-prefix',
};

test('Auto preserves project settings; Standard and Fast select their explicit tiers', async () => {
  for (const [tier, expected] of [['auto', 'auto'], ['default', 'default'], ['fast', 'priority']]) {
    let sent;
    const client = { chat: { completions: { create: async body => {
      sent = body;
      return { choices: [{ message: { content: 'OK' } }] };
    } } } };
    const result = await createOpenAiCompletion(client, request, tier);
    assert.equal(sent.service_tier, expected);
    assert.equal(sent.model, request.model);
    assert.deepEqual(sent.messages, request.messages);
    assert.equal(result.choices[0].message.content, 'OK');
  }
  assert.equal(normalizeOpenAiServiceTier('unknown'), 'auto');
  assert.equal(normalizeOpenAiServiceTier(null), 'auto');
  assert.equal(resolveOpenAiTierModel(request.model, 'ultrafast'), 'gpt-6-astra');
});

test('Ultrafast uses Responses, preserving system text, images, reasoning and caching', async () => {
  let sent;
  const client = { responses: { create: async body => {
    sent = body;
    return { status: 'completed', output_text: 'A diagram', service_tier: 'ultrafast' };
  } } };
  const result = await createOpenAiCompletion(client, {
    ...request,
    messages: [request.messages[0], { role: 'user', content: [
      { type: 'text', text: 'Explain this' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,test', detail: 'low' } },
    ] }],
  }, 'ultrafast');
  assert.equal(sent.model, 'gpt-6-astra');
  assert.equal(sent.service_tier, 'ultrafast');
  assert.equal(sent.store, false);
  assert.equal(sent.max_output_tokens, 1024);
  assert.deepEqual(sent.reasoning, { effort: 'low' });
  assert.equal(sent.prompt_cache_key, 'stable-prefix');
  assert.deepEqual(sent.input, [request.messages[0], { role: 'user', content: [
    { type: 'input_text', text: 'Explain this' },
    { type: 'input_image', image_url: 'data:image/png;base64,test', detail: 'low' },
  ] }]);
  assert.equal(result.choices[0].message.content, 'A diagram');
});

function streamClient(events) {
  let aborted = false;
  let options;
  return {
    get aborted() { return aborted; },
    get options() { return options; },
    responses: { create: async (_body, receivedOptions) => {
      options = receivedOptions;
      return {
        controller: { abort() { aborted = true; } },
        async *[Symbol.asyncIterator]() { yield* events; },
      };
    } },
  };
}

test('Ultrafast streams text immediately, ignores reasoning events, and cleans up', async () => {
  const client = streamClient([
    { type: 'response.reasoning_summary_text.delta', delta: 'private' },
    { type: 'response.output_text.delta', delta: 'Hel' },
    { type: 'response.output_text.delta', delta: 'lo' },
    { type: 'response.completed', response: { service_tier: 'ultrafast' } },
  ]);
  const signal = new AbortController().signal;
  const stream = await createOpenAiCompletion(client, { ...request, stream: true }, 'ultrafast', { signal });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk.choices[0].delta.content);
  assert.deepEqual(chunks, ['Hel', 'lo']);
  assert.equal(client.options.signal, signal);
  assert.equal(client.aborted, true);
});

test('Cancelling a Responses stream aborts its underlying connection', async () => {
  const client = streamClient([{ type: 'response.output_text.delta', delta: 'Hello' }]);
  const stream = await createOpenAiCompletion(client, { ...request, stream: true }, 'ultrafast');
  for await (const _chunk of stream) break;
  assert.equal(client.aborted, true);
  stream.abort();
});

test('Failed, incomplete and truncated Responses surface errors instead of successful answers', async () => {
  for (const event of [
    { type: 'response.failed', response: { status: 'failed', error: { message: 'Tier unavailable' } } },
    { type: 'response.incomplete', response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } } },
    { type: 'error', message: 'Rate limited' },
  ]) {
    const client = streamClient([event]);
    const stream = await createOpenAiCompletion(client, { ...request, stream: true }, 'ultrafast');
    await assert.rejects(async () => { for await (const _chunk of stream) {} });
    assert.equal(client.aborted, true);
  }
  const stream = await createOpenAiCompletion(streamClient([]), { ...request, stream: true }, 'ultrafast');
  await assert.rejects(async () => { for await (const _chunk of stream) {} }, /before completion/);
  await assert.rejects(createOpenAiCompletion({ responses: { create: async () => ({
    status: 'failed', error: { message: 'Not allowed' },
  }) } }, request, 'ultrafast'), /Not allowed/);
});
