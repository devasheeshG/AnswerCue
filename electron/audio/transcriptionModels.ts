export const TRANSCRIPTION_MODELS = [
  { id: 'gpt-live-transcribe', name: 'GPT Live Transcribe', provider: 'openai' },
  { id: 'scribe_v2_realtime', name: 'Scribe v2 Realtime', provider: 'elevenlabs' },
] as const;
export type TranscriptionModel = typeof TRANSCRIPTION_MODELS[number]['id'];
export type TranscriptionProvider = typeof TRANSCRIPTION_MODELS[number]['provider'];
export function getTranscriptionModel(id: string) { return TRANSCRIPTION_MODELS.find(model => model.id === id); }
