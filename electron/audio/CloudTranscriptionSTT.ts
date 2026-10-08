import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { streamingStttWsOptions } from './dnsHelpers';
import { RECOGNITION_LANGUAGES } from '../config/languages';
import { getTranscriptionModel } from './transcriptionModels';

/** Stateless PCM conversion: stereo is mixed before resampling to provider mono. */
export function convertTranscriptionPcm(chunk: Buffer, inputRate: number, channels: number, outputRate: number): Buffer {
  const frames = Math.floor(chunk.length / (2 * channels));
  const count = Math.floor(frames * outputRate / inputRate);
  const output = Buffer.alloc(count * 2);
  const sample = (frame: number) => {
    let value = 0;
    for (let channel = 0; channel < channels; channel++) value += chunk.readInt16LE((Math.min(frame, frames - 1) * channels + channel) * 2);
    return value / channels;
  };
  for (let i = 0; i < count; i++) {
    const position = i * inputRate / outputRate;
    const index = Math.floor(position);
    output.writeInt16LE(Math.round(sample(index) * (1 - (position - index)) + sample(index + 1) * (position - index)), i * 2);
  }
  return output;
}

/** One cloud session per captured speaker; no model switching or local inference. */
export class CloudTranscriptionSTT extends EventEmitter {
  private readonly provider: 'openai' | 'elevenlabs';
  private readonly rate: number;
  private inputRate = 48000;
  private channels = 1;
  private language = 'en';
  private ws: WebSocket | null = null;
  private active = false;
  private ready = false;
  private finishing = false;
  private buffer: Buffer[] = [];
  private bufferedBytes = 0;
  private audioBytes = 0;
  private batch: Buffer[] = [];
  private batchBytes = 0;
  private pendingCommit = false;
  private pendingFinals = 0;
  private partials = new Map<string, string>();
  private completed = new Set<string>();
  private turnOrder: string[] = [];
  private finalResults = new Map<string, string>();
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private setupTimer: ReturnType<typeof setTimeout> | null = null;
  private keepalive: ReturnType<typeof setInterval> | null = null;
  private lastAudioAt = 0;

  constructor(private apiKey: string, private model: string) {
    super();
    const config = getTranscriptionModel(model);
    if (!config) throw new Error('Unsupported transcription model');
    this.provider = config.provider;
    this.rate = this.provider === 'openai' ? 24000 : 16000;
  }
  setSampleRate(rate: number): void { if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid audio sample rate'); this.inputRate = rate; }
  setAudioChannelCount(channels: number): void { if (channels !== 1 && channels !== 2) throw new Error('Transcription supports mono or stereo capture'); this.channels = channels; }
  setRecognitionLanguage(key: string): void { this.language = key === 'auto' ? '' : RECOGNITION_LANGUAGES[key]?.iso639 || 'en'; }
  start(): void {
    if (this.active) return;
    if (!this.apiKey.trim()) throw new Error('Configure a transcription API key in Settings → AI Providers');
    this.active = true; this.finishing = false; this.retries = 0; this.connect();
  }
  stop(): void {
    this.active = false; this.ready = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.setupTimer) clearTimeout(this.setupTimer);
    if (this.keepalive) clearInterval(this.keepalive);
    this.retryTimer = this.setupTimer = null; this.keepalive = null;
    const socket = this.ws; this.ws = null;
    // Keep the error listener installed until close: ws emits error when a
    // connecting socket is terminated. Each handler rejects stale sockets.
    socket?.terminate();
    this.batch = []; this.batchBytes = 0;
    this.buffer = []; this.bufferedBytes = this.audioBytes = this.pendingFinals = 0;
    this.pendingCommit = false; this.partials.clear(); this.completed.clear(); this.turnOrder = []; this.finalResults.clear();
  }
  write(chunk: Buffer): void {
    if (!this.active || this.finishing) return;
    const pcm = convertTranscriptionPcm(chunk, this.inputRate, this.channels, this.rate);
    if (!pcm.length) return;
    if (!this.ready) {
      this.buffer.push(pcm); this.bufferedBytes += pcm.length;
      const limit = this.rate * 2 * 10;
      while (this.bufferedBytes > limit && this.buffer.length) {
        this.bufferedBytes -= this.buffer.shift()!.length;
        this.emit('warning', { code: 'transcription_buffer_full', message: 'Connection is slow; leading audio was dropped.' });
      }
      return;
    }
    this.batch.push(pcm); this.batchBytes += pcm.length;
    if (this.batchBytes >= this.rate * 2 / 10) this.flushBatch();
  }
  private flushBatch(): void {
    if (!this.batchBytes) return;
    const pcm = Buffer.concat(this.batch); this.batch = []; this.batchBytes = 0;
    this.sendAudio(pcm);
  }
  private sendAudio(pcm: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.ws.bufferedAmount > this.rate * 2 * 10) { this.emit('error', new Error('Transcription network is too slow')); this.ws.terminate(); return; }
    this.send(this.provider === 'openai'
      ? { type: 'input_audio_buffer.append', audio: pcm.toString('base64') }
      : { message_type: 'input_audio_chunk', audio_base_64: pcm.toString('base64'), sample_rate: this.rate });
    this.audioBytes += pcm.length; this.lastAudioAt = Date.now();
  }
  private send(message: unknown): void { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message)); }
  notifySpeechEnded(): void { this.finalize(); }
  finalize(): void {
    if (!this.active) return;
    if (!this.ready) { this.pendingCommit = true; return; }
    this.flushBatch();
    // OpenAI requires at least 100ms; avoid duplicate/empty commits on Stop.
    if (this.audioBytes < this.rate * 2 / 10) return;
    this.send(this.provider === 'openai' ? { type: 'input_audio_buffer.commit' }
      : { message_type: 'input_audio_chunk', audio_base_64: '', sample_rate: this.rate, commit: true });
    this.audioBytes = 0; this.pendingFinals++;
  }
  async drain(timeoutMs = 2000): Promise<void> {
    this.finalize(); this.finishing = true;
    const deadline = Date.now() + timeoutMs;
    while (this.active && (this.pendingFinals || this.pendingCommit || this.buffer.length) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    if (this.pendingFinals || this.pendingCommit || this.buffer.length) this.emit('warning', { code: 'transcription_drain_timeout', message: 'Timed out waiting for trailing transcription.' });
  }
  private connect(): void {
    if (!this.active || this.finishing) return;
    const query = new URLSearchParams({ model_id: this.model, audio_format: 'pcm_16000', commit_strategy: 'manual' });
    if (this.language) query.set('language_code', this.language);
    const url = this.provider === 'openai' ? 'wss://api.openai.com/v1/realtime?intent=transcription'
      : `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${query}`;
    const headers = this.provider === 'openai' ? { Authorization: `Bearer ${this.apiKey}` } : { 'xi-api-key': this.apiKey };
    const socket = new WebSocket(url, streamingStttWsOptions({ headers }) as any);
    this.ws = socket; this.ready = false; this.audioBytes = 0; this.pendingFinals = 0;
    this.partials.clear(); this.completed.clear(); this.turnOrder = []; this.finalResults.clear();
    const current = () => this.active && this.ws === socket;
    this.setupTimer = setTimeout(() => { if (current() && !this.ready) { this.emit('error', new Error('Transcription session setup timed out')); socket.terminate(); } }, 15000);
    socket.on('open', () => {
      if (!current()) return;
      if (this.provider === 'openai') this.send({ type: 'session.update', session: { type: 'transcription', audio: { input: {
        format: { type: 'audio/pcm', rate: this.rate },
        transcription: { model: this.model, delay: 'minimal', ...(this.language ? { languages: [this.language] } : {}) }, turn_detection: null,
      } } } });
    });
    socket.on('message', data => {
      if (!current()) return;
      try {
        const message = JSON.parse(data.toString());
        const type = message.type || message.message_type;
        if (type === 'session.updated' || type === 'session_started') {
          this.ready = true;
          if (this.setupTimer) clearTimeout(this.setupTimer);
          this.setupTimer = null;
          this.emit('connected');
          if (!current()) return; // Connection tests stop synchronously here.
          const queued = this.buffer; this.buffer = []; this.bufferedBytes = 0;
          const backlog = Buffer.concat(queued);
          const packetBytes = this.rate * 2 / 10;
          for (let offset = 0; offset < backlog.length; offset += packetBytes) {
            const packet = backlog.subarray(offset, offset + packetBytes);
            if (packet.length === packetBytes) this.sendAudio(packet);
            else { this.batch.push(packet); this.batchBytes += packet.length; }
          }
          if (this.pendingCommit) { this.pendingCommit = false; this.finalize(); }
          if (this.keepalive) clearInterval(this.keepalive);
          this.keepalive = setInterval(() => {
            if (!current()) return;
            socket.ping();
            if (this.provider === 'elevenlabs' && !this.finishing && Date.now() - this.lastAudioAt > 5000) this.sendAudio(Buffer.alloc(this.rate / 5));
          }, 5000);
        } else if (type === 'input_audio_buffer.committed') {
          if (!this.turnOrder.includes(message.item_id) && !this.completed.has(message.item_id)) this.turnOrder.push(message.item_id);
        } else if (type === 'conversation.item.input_audio_transcription.delta') {
          const id = message.item_id;
          const text = (this.partials.get(id) || '') + (message.delta || ''); this.partials.set(id, text);
          this.emit('transcript', { text, isFinal: false });
        } else if (type === 'conversation.item.input_audio_transcription.completed') {
          if (!this.completed.has(message.item_id)) {
            this.completed.add(message.item_id); this.partials.delete(message.item_id);
            if (!this.turnOrder.includes(message.item_id)) this.turnOrder.push(message.item_id);
            this.finalResults.set(message.item_id, message.transcript || '');
            while (this.turnOrder.length && this.finalResults.has(this.turnOrder[0])) {
              const next = this.turnOrder.shift()!;
              const text = this.finalResults.get(next)!; this.finalResults.delete(next);
              if (text.trim()) this.emit('transcript', { text, isFinal: true });
            }
            this.pendingFinals = Math.max(0, this.pendingFinals - 1); this.retries = 0;
            if (this.completed.size > 500) this.completed.delete(this.completed.values().next().value!);
          }
        } else if (type === 'partial_transcript') {
          if (message.text?.trim()) this.emit('transcript', { text: message.text, isFinal: false });
        } else if (type === 'committed_transcript') {
          if (message.text?.trim()) this.emit('transcript', { text: message.text, isFinal: true });
          this.pendingFinals = Math.max(0, this.pendingFinals - 1); this.retries = 0;
        } else if (type === 'error' || String(type).endsWith('_error') || ['auth_error', 'quota_exceeded', 'rate_limited', 'insufficient_credits', 'commit_throttled', 'session_time_limit_exceeded'].includes(type) || type === 'conversation.item.input_audio_transcription.failed') {
          // Do not echo vendor payloads: they can contain keys or audio text.
          this.emit('error', Object.assign(new Error(`Transcription provider rejected the request (${message.error?.code || type}). Check the key, model access, and API quota.`), { fatal: true }));
          this.stop();
        }
      } catch { this.emit('error', new Error('Invalid transcription provider response')); }
    });
    socket.on('error', () => { if (current()) this.emit('error', new Error('Transcription connection failed. Check your key and network.')); });
    socket.on('unexpected-response', (_request, response) => {
      if (!current()) return;
      this.emit('error', Object.assign(new Error(`Transcription authentication or model access failed (HTTP ${response.statusCode})`), { fatal: true }));
      response.resume(); this.stop();
    });
    socket.on('close', () => {
      if (!current()) return;
      this.ready = false; this.ws = null;
      if (this.batchBytes) { this.buffer.unshift(Buffer.concat(this.batch)); this.bufferedBytes += this.batchBytes; this.batch = []; this.batchBytes = 0; }
      if (this.setupTimer) clearTimeout(this.setupTimer);
      if (this.keepalive) clearInterval(this.keepalive);
      this.setupTimer = null; this.keepalive = null;
      if (this.finishing) { this.active = false; return; }
      this.emit('error', new Error('Transcription connection closed; reconnecting.'));
      if (++this.retries > 5) { this.emit('error', new Error('Transcription reconnect limit reached. Restart the interview to retry.')); this.stop(); return; }
      this.retryTimer = setTimeout(() => { this.retryTimer = null; this.connect(); }, Math.min(1000 * 2 ** (this.retries - 1), 10000));
    });
  }
}
