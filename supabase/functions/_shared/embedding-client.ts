/**
 * Centralized embedding client using OpenAI text-embedding-3-small
 * 
 * Use this for:
 * - Vectorizing all knowledge_base content (YouTube, publications, podcasts, etc.)
 * - Semantic similarity search
 * - Opportunity description embeddings
 * 
 * Model: text-embedding-3-small via OpenAI API (not Lovable AI Gateway)
 * Requires: OPENAI_API_KEY environment variable
 * 
 * Output: 1536-dimensional embeddings compatible with pgvector
 * 
 * Note: Lovable AI Gateway doesn't support embeddings, so we use OpenAI directly
 */

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generate embeddings using OpenAI text-embedding-3-small
 * Lovable AI Gateway doesn't support embeddings, so we use OpenAI directly
 * Returns a 1536-dimensional vector suitable for pgvector storage
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured - required for embeddings');
  }

  // Truncate text to avoid token limits (roughly 8000 chars = ~2000 tokens)
  const truncatedText = text.substring(0, 8000);

  console.log(`Generating embedding for text of length ${truncatedText.length}...`);

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: truncatedText,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI embedding error:', response.status, errorText);
    
    // Handle rate limiting
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  
  // OpenAI embeddings format: { data: [{ embedding: [...] }] }
  if (!Array.isArray(data.data) || !data.data[0]?.embedding) {
    console.error('Unexpected embedding response shape:', JSON.stringify(data).slice(0, 500));
    throw new Error('Invalid embedding response format');
  }

  const embedding = data.data[0].embedding as number[];
  console.log(`Generated embedding with ${embedding.length} dimensions`);
  
  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 * Uses OpenAI's native embeddings API
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured - required for embeddings');
  }

  // Truncate each text
  const truncatedTexts = texts.map(t => t.substring(0, 8000));

  console.log(`Generating embeddings for ${truncatedTexts.length} texts...`);

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: truncatedTexts,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI embedding error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  
  // OpenAI format: { data: [{ embedding: [...] }, ...] }
  if (!Array.isArray(data.data)) {
    console.error('Unexpected batch embedding response shape:', JSON.stringify(data).slice(0, 500));
    throw new Error('Invalid embedding response format');
  }

  const embeddings = data.data.map((item: any) => item.embedding as number[]);
  console.log(`Generated ${embeddings.length} embeddings`);
  
  return embeddings;
}

/**
 * Calculate cosine similarity between two embedding vectors
 * Returns a value between -1 and 1, where 1 means identical
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
