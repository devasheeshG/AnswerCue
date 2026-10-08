import type OpenAI from 'openai';

export const OPENAI_SERVICE_TIERS = ['auto', 'default', 'fast'] as const;
export type OpenAiServiceTier = typeof OPENAI_SERVICE_TIERS[number];

export function isOpenAiServiceTier(value: unknown): value is OpenAiServiceTier {
  return typeof value === 'string' && (OPENAI_SERVICE_TIERS as readonly string[]).includes(value);
}

export function normalizeOpenAiServiceTier(value: unknown): OpenAiServiceTier {
  // Preserve the faster-request preference when upgrading from the removed tier.
  if (value === 'ultrafast') return 'fast';
  return isOpenAiServiceTier(value) ? value : 'auto';
}

export function resolveOpenAiTierModel(model: string, _tier: OpenAiServiceTier): string { return model; }

export interface OpenAiCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string | any[] }>;
  stream?: boolean;
  max_completion_tokens?: number;
  reasoning_effort?: string;
  prompt_cache_key?: string;
}

export async function createOpenAiCompletion(client: OpenAI, request: OpenAiCompletionRequest, tier: OpenAiServiceTier, options?: { signal?: AbortSignal }): Promise<any> {
  const serviceTier = tier === 'fast' ? 'priority' : tier;
  if (!/codex|(?:^|-)pro(?:-|$)/.test(request.model)) {
    const payload: any = { ...request, service_tier: serviceTier };
    if (/^gpt-(3\.5|4)/.test(request.model) && request.max_completion_tokens !== undefined) {
      payload.max_tokens = request.max_completion_tokens;
      delete payload.max_completion_tokens;
    }
    return client.chat.completions.create(payload, options);
  }
  // Responses-only model families keep their selected model and normal tier.
  // This does not reintroduce the removed Ultrafast option or an Astra override.
  const result: any = await client.responses.create({
    model: request.model, service_tier: serviceTier, store: false, stream: !!request.stream,
    max_output_tokens: request.max_completion_tokens,
    ...(request.reasoning_effort ? { reasoning: { effort: request.reasoning_effort } } : {}),
    ...(request.prompt_cache_key ? { prompt_cache_key: request.prompt_cache_key } : {}),
    input: request.messages.map(message => ({ role: message.role, content: typeof message.content === 'string' ? message.content : message.content.map(part => {
      if (part.type === 'text') return { type: 'input_text', text: part.text };
      if (part.type === 'image_url') return { type: 'input_image', image_url: part.image_url.url, detail: part.image_url.detail || 'auto' };
      throw new Error(`Unsupported model input: ${part.type}`);
    }) })),
  } as any, options);
  if (!request.stream) {
    if (result.status !== 'completed') throw new Error(result.error?.message || `Model response ${result.status}`);
    return { choices: [{ message: { content: result.output_text || '' } }] };
  }
  return {
    abort: () => result.controller?.abort(),
    async *[Symbol.asyncIterator]() {
      let completed = false;
      try {
        for await (const event of result) {
          if (event.type === 'response.output_text.delta') yield { choices: [{ delta: { content: event.delta } }] };
          else if (event.type === 'response.completed') completed = true;
          else if (event.type === 'error' || event.type === 'response.failed' || event.type === 'response.incomplete') throw new Error(event.message || event.response?.error?.message || 'Model response did not complete');
        }
        if (!completed && !options?.signal?.aborted) throw new Error('Model stream ended before completion');
      } finally { result.controller?.abort(); }
    },
  };
}
