import type OpenAI from 'openai';

export const OPENAI_SERVICE_TIERS = ['auto', 'default', 'fast', 'ultrafast'] as const;
export type OpenAiServiceTier = typeof OPENAI_SERVICE_TIERS[number];
export const ULTRAFAST_OPENAI_MODEL = 'gpt-6-astra';

export function isOpenAiServiceTier(value: unknown): value is OpenAiServiceTier {
  return typeof value === 'string' && (OPENAI_SERVICE_TIERS as readonly string[]).includes(value);
}

export function normalizeOpenAiServiceTier(value: unknown): OpenAiServiceTier {
  return isOpenAiServiceTier(value) ? value : 'auto';
}

export function resolveOpenAiTierModel(model: string, tier: OpenAiServiceTier): string {
  // Ultrafast is model-specific. The settings UI explicitly explains this override.
  return tier === 'ultrafast' ? ULTRAFAST_OPENAI_MODEL : model;
}

export interface OpenAiCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string | any[] }>;
  stream?: boolean;
  max_completion_tokens?: number;
  reasoning_effort?: string;
  prompt_cache_key?: string;
}

export function buildOpenAiResponsesRequest(request: OpenAiCompletionRequest) {
  return {
    model: ULTRAFAST_OPENAI_MODEL,
    service_tier: 'ultrafast',
    store: false,
    stream: !!request.stream,
    max_output_tokens: request.max_completion_tokens,
    ...(request.reasoning_effort ? { reasoning: { effort: request.reasoning_effort } } : {}),
    ...(request.prompt_cache_key ? { prompt_cache_key: request.prompt_cache_key } : {}),
    input: request.messages.map(message => ({
      role: message.role,
      content: typeof message.content === 'string' ? message.content : message.content.map(part => {
        if (part.type === 'text') return { type: 'input_text', text: part.text };
        if (part.type === 'image_url') return {
          type: 'input_image', image_url: part.image_url.url,
          ...(part.image_url.detail ? { detail: part.image_url.detail } : {}),
        };
        throw new Error(`Unsupported OpenAI Responses content type: ${part.type}`);
      }),
    })),
  };
}

function responseError(response: any): Error {
  return new Error(response?.error?.message || `OpenAI response ${response?.status || 'failed'}: ${response?.incomplete_details?.reason || 'no completed answer'}`);
}

// Keep the caller's Chat Completions shape so existing TTFT timers, image paths,
// cancellation, and token-by-token rendering work with both transports.
export async function createOpenAiCompletion(
  client: OpenAI, request: OpenAiCompletionRequest, tier: OpenAiServiceTier,
  options?: { signal?: AbortSignal },
): Promise<any> {
  if (tier !== 'ultrafast') {
    return client.chat.completions.create({
      ...request,
      // priority is the SDK-compatible alias for Fast mode.
      service_tier: tier === 'fast' ? 'priority' : tier,
    } as any, options);
  }

  const result: any = await client.responses.create(buildOpenAiResponsesRequest(request) as any, options);
  if (!request.stream) {
    if (result.status !== 'completed') throw responseError(result);
    console.log(`[OpenAI] requested tier=ultrafast served tier=${result.service_tier || 'unknown'}`);
    return { choices: [{ message: { content: result.output_text || '' } }], service_tier: result.service_tier };
  }

  const iterator = async function* () {
    let completed = false;
    try {
      for await (const event of result) {
        if (event.type === 'response.output_text.delta') {
          yield { choices: [{ delta: { content: event.delta } }] };
        } else if (event.type === 'response.completed') {
          completed = true;
          console.log(`[OpenAI] requested tier=ultrafast served tier=${event.response.service_tier || 'unknown'}`);
        } else if (event.type === 'response.failed' || event.type === 'response.incomplete') {
          throw responseError(event.response);
        } else if (event.type === 'error') {
          throw new Error(event.message || 'OpenAI response stream failed');
        }
      }
      if (!completed && !options?.signal?.aborted) throw new Error('OpenAI response stream ended before completion');
    } finally {
      result.controller?.abort();
    }
  };
  return { [Symbol.asyncIterator]: iterator, abort: () => result.controller?.abort() };
}
