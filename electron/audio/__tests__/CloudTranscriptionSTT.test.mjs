import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function harness(model = 'gpt-live-transcribe') {
  const sockets = [];
  class Socket extends EventEmitter {
    static OPEN = 1;
    readyState = 1; bufferedAmount = 0; messages = []; terminated = false;
    constructor(url, options) { super(); this.url = url; this.options = options; sockets.push(this); }
    send(data) { this.messages.push(JSON.parse(data)); }
    ping() {}
    terminate() { this.terminated = true; this.readyState = 3; this.emit('close'); }
    receive(data) { this.emit('message', Buffer.from(JSON.stringify(data))); }
  }
  const source = fs.readFileSync(new URL('../CloudTranscriptionSTT.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, Buffer, URLSearchParams, Date, setTimeout, clearTimeout, setInterval, clearInterval,
    require: name => {
      if (name === 'events') return { EventEmitter };
      if (name === 'ws') return Socket;
      if (name === './dnsHelpers') return { streamingStttWsOptions: options => options };
      if (name === '../config/languages') return { RECOGNITION_LANGUAGES: { 'english-us': { iso639: 'en' } } };
      if (name === './transcriptionModels') return { getTranscriptionModel: id => ({ provider: id.startsWith('gpt-') ? 'openai' : 'elevenlabs' }) };
      throw new Error(name);
    },
  });
  const stt = new exports.CloudTranscriptionSTT('test-key', model);
  const transcripts = []; const errors = [];
  stt.on('transcript', item => transcripts.push(item)); stt.on('error', error => errors.push(error));
  stt.setSampleRate(model.startsWith('gpt-') ? 24000 : 16000);
  const open = () => { stt.start(); const socket = sockets.at(-1); socket.emit('open'); socket.receive(model.startsWith('gpt-') ? { type: 'session.updated' } : { message_type: 'session_started' }); return socket; };
  return { stt, sockets, transcripts, errors, open, convert: exports.convertTranscriptionPcm };
}

test('OpenAI buffers audio until session acceptance and uses low-delay live transcription', () => {
  const h = harness(); h.stt.start(); const socket = h.sockets[0];
  h.stt.write(Buffer.alloc(4800)); assert.equal(socket.messages.length, 0);
  socket.emit('open'); const setup = socket.messages[0];
  assert.equal(setup.session.audio.input.transcription.model, 'gpt-live-transcribe');
  assert.equal(setup.session.audio.input.transcription.delay, 'minimal');
  assert.equal(setup.session.audio.input.turn_detection, null);
  socket.receive({ type: 'session.updated' }); assert.equal(socket.messages[1].type, 'input_audio_buffer.append'); h.stt.stop();
});
test('OpenAI partials accumulate; out-of-order finals emit once in committed-turn order', () => {
  const h = harness(); const socket = h.open();
  socket.receive({ type: 'input_audio_buffer.committed', item_id: 'first' });
  socket.receive({ type: 'input_audio_buffer.committed', item_id: 'second' });
  socket.receive({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'first', delta: 'Hello' });
  socket.receive({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'first', delta: ' world' });
  assert.equal(h.transcripts.at(-1).text, 'Hello world');
  socket.receive({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'second', transcript: 'Second turn' });
  assert.equal(h.transcripts.filter(x => x.isFinal).length, 0);
  socket.receive({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'first', transcript: 'First turn' });
  socket.receive({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'first', transcript: 'First turn' });
  assert.deepEqual(h.transcripts.filter(x => x.isFinal).map(x => x.text), ['First turn', 'Second turn']); h.stt.stop();
});
test('ElevenLabs authenticates with xi-api-key, sends mono PCM and explicit final commit', async () => {
  const h = harness('scribe_v2_realtime'); const socket = h.open();
  assert.equal(socket.options.headers['xi-api-key'], 'test-key');
  assert.ok(socket.url.includes('audio_format=pcm_16000')); assert.ok(socket.url.includes('commit_strategy=manual'));
  h.stt.write(Buffer.alloc(3200)); h.stt.write(Buffer.alloc(320));
  const draining = h.stt.drain(200);
  assert.equal(socket.messages.at(-1).commit, true);
  assert.equal(socket.messages.at(-2).audio_base_64.length > 0, true);
  socket.receive({ message_type: 'committed_transcript', text: 'Trailing words' });
  await draining; assert.equal(h.transcripts.at(-1).text, 'Trailing words'); h.stt.stop();
});
test('PCM resampling mixes stereo safely and accepts odd trailing bytes', () => {
  const h = harness(); const pcm = Buffer.alloc(480 * 4 + 1);
  for (let i = 0; i < 480; i++) { pcm.writeInt16LE(1000, i * 4); pcm.writeInt16LE(3000, i * 4 + 2); }
  const output = h.convert(pcm, 48000, 2, 16000);
  assert.equal(output.length, 320); assert.equal(output.readInt16LE(0), 2000);
});
test('Stop cancels reconnect and stale sockets cannot write into a restarted session', () => {
  const h = harness(); const old = h.open(); old.emit('close'); h.stt.stop();
  const next = h.open(); old.receive({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'old', transcript: 'Old text' });
  assert.equal(h.transcripts.length, 0); assert.equal(next.terminated, false); h.stt.stop();
});
test('Provider rejection stops the session without echoing keys or retrying', () => {
  const h = harness('scribe_v2_realtime'); const socket = h.open();
  socket.receive({ message_type: 'auth_error', error: 'test-key' });
  assert.equal(socket.terminated, true); assert.equal(h.errors[0].fatal, true);
  assert.equal(h.errors[0].message.includes('test-key'), false); h.stt.stop();
});
test('No audio is sent before start; startup buffer is bounded', () => {
  const h = harness(); const warnings = []; h.stt.on('warning', w => warnings.push(w));
  h.stt.write(Buffer.alloc(4800)); assert.equal(h.sockets.length, 0);
  h.stt.start(); for (let i = 0; i < 120; i++) h.stt.write(Buffer.alloc(4800));
  assert.ok(warnings.length > 0); h.stt.stop(); assert.equal(h.sockets[0].terminated, true);
});

test('connection test can stop from accepted-session callback without leaking keepalive', () => {
  const h = harness(); h.stt.on('connected', () => h.stt.stop());
  h.open(); assert.equal(h.stt.keepalive, null); assert.equal(h.sockets[0].terminated, true);
});
