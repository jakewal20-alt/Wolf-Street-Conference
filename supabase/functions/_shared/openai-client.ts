/**
 * Centralized OpenAI client for high-impact reasoning tasks
 * 
 * Use this for:
 * - Opportunity scoring (fit_score, ai_bucket, ai_tags, ai_reason, ai_summary)
 * - Daily BD Intelligence Brief generation
 * - Trend extraction and "Recommended Pursuits"
 * - Transcript → bd_opportunity_status summaries and health/band decisions
 * 
 * Default Model: gpt-4.1-mini-2025-04-14 (faster, cost-efficient)
 * Alternative: gpt-4.1-2025-04-14 (more capable for complex reasoning)
 * 
 * Requires: OPENAI_API_KEY environment variable
 * 
 * Note: Newer models (gpt-4.1+) use max_completion_tokens instead of max_tokens
 * and do not support the temperature parameter.
 */

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAICompletionOptions {
  model?: string;
  messages: OpenAIMessage[];
  max_completion_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
  temperature?: number; // Note: Not supported by GPT-5
}

export interface OpenAICompletionResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call OpenAI GPT-5 for high-quality reasoning tasks
 */
export async function callOpenAI(
  options: OpenAICompletionOptions
): Promise<OpenAICompletionResponse> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Use gpt-4.1-mini as default (valid model name)
  const model = options.model || 'gpt-4.1-mini-2025-04-14';
  
  // Prepare body - newer models use max_completion_tokens instead of max_tokens
  const body: any = {
    model,
    messages: options.messages,
    max_completion_tokens: options.max_completion_tokens || 1000,
  };

  // Only add response_format if specified
  if (options.response_format) {
    body.response_format = options.response_format;
  }

  // GPT-5 and newer models do NOT support temperature parameter
  // If temperature is specified, log a warning and skip it
  if (options.temperature !== undefined) {
    console.warn('Temperature parameter is not supported by newer OpenAI models, ignoring');
  }

  console.log(`[OpenAI] Calling ${model} with ${options.messages.length} messages...`);
  console.log(`[OpenAI] Request body:`, JSON.stringify(body, null, 2));

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  console.log(`[OpenAI] Response status: ${response.status} ${response.statusText}`);
  console.log(`[OpenAI] Response headers:`, Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    let errorText = '';
    let errorJson: any = null;
    
    try {
      errorText = await response.text();
      errorJson = JSON.parse(errorText);
      console.error(`[OpenAI] Error response body (parsed):`, errorJson);
    } catch {
      console.error(`[OpenAI] Error response body (raw):`, errorText);
    }
    
    const errorMessage = errorJson?.error?.message || errorText || 'Unknown OpenAI error';
    throw new Error(`OpenAI API error ${response.status}: ${errorMessage}`);
  }

  const responseText = await response.text();
  console.log(`[OpenAI] Response body (raw):`, responseText.substring(0, 500));
  
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error(`[OpenAI] Failed to parse response JSON:`, parseError);
    throw new Error(`Invalid JSON response from OpenAI: ${responseText.substring(0, 200)}`);
  }

  // Log token usage
  if (data.usage) {
    console.log(`[OpenAI] Token usage:`, data.usage);
  }

  return data as OpenAICompletionResponse;
}

/**
 * Call OpenAI and parse JSON response
 */
export async function callOpenAIJSON<T>(
  options: Omit<OpenAICompletionOptions, 'response_format'>
): Promise<T> {
  console.log('[OpenAI] Requesting JSON response format');
  
  const response = await callOpenAI({
    ...options,
    response_format: { type: 'json_object' },
  });

  const content = response.choices?.[0]?.message?.content?.trim();
  
  console.log(`[OpenAI] Response content length: ${content?.length || 0} characters`);
  
  if (!content) {
    console.error('[OpenAI] Empty content in response');
    console.error('[OpenAI] Full response object:', JSON.stringify(response, null, 2));
    throw new Error('Empty content from OpenAI - check API key, quota, and model access');
  }
  
  console.log(`[OpenAI] Parsing JSON content (first 200 chars): ${content.substring(0, 200)}`);
  
  try {
    const parsed = JSON.parse(content) as T;
    console.log('[OpenAI] Successfully parsed JSON response');
    return parsed;
  } catch (error) {
    console.error('[OpenAI] Failed to parse JSON response');
    console.error('[OpenAI] Raw content:', content);
    console.error('[OpenAI] Parse error:', error);
    throw new Error(`Invalid JSON from OpenAI: ${error instanceof Error ? error.message : 'Unknown parse error'}`);
  }
}
