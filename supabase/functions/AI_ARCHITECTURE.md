# AI Architecture Documentation

## Overview

This application uses a **hybrid AI architecture** designed to balance cost, performance, and quality:

- **Embeddings & Bulk Ingestion**: Lovable AI with `google/gemini-2.5-flash`
- **High-Impact Reasoning**: OpenAI with `gpt-5-2025-08-07`

## Centralized AI Clients

### 1. OpenAI Client (`_shared/openai-client.ts`)

**Use for:**
- Opportunity scoring (fit_score, ai_bucket, ai_tags, ai_reason, ai_summary)
- Daily BD Intelligence Brief generation
- Trend extraction and "Recommended Pursuits"
- Transcript → bd_opportunity_status summaries and health/band decisions

**Model:** `gpt-5-2025-08-07` (OpenAI GPT-5)

**Functions:**
- `callOpenAI(options)` - General purpose OpenAI API call
- `callOpenAIJSON<T>(options)` - Returns parsed JSON response

**Environment:** Requires `OPENAI_API_KEY`

**Important Notes:**
- GPT-5 uses `max_completion_tokens` instead of `max_tokens`
- GPT-5 does NOT support `temperature` parameter
- All errors are logged with detailed context

### 2. Embedding Client (`_shared/embedding-client.ts`)

**Use for:**
- Vectorizing all knowledge_base content (YouTube, publications, podcasts, SAM, Hatch, Defense contracts)
- Semantic similarity search
- Opportunity description embeddings for matching

**Model:** `google/gemini-2.5-flash` via Lovable AI Gateway

**Functions:**
- `generateEmbedding(text)` - Generate single embedding (1536 dimensions)
- `generateEmbeddings(texts[])` - Batch generate embeddings
- `cosineSimilarity(a, b)` - Calculate similarity between two vectors

**Environment:** Uses `LOVABLE_API_KEY` (auto-provisioned)

**Output:** 1536-dimensional vectors compatible with pgvector

**Rate Limiting:**
- 429 error: Rate limit exceeded, retry after delay
- 402 error: Credits exhausted, add credits to workspace

### 3. Knowledge Retrieval (`_shared/knowledge-retrieval.ts`)

**Use for:**
- Query the knowledge_base to enrich AI prompts with relevant context
- Find similar content across all BD intelligence sources

**Functions:**
- `getRelevantKnowledge(supabase, userId, queryText, options)` - Vector similarity search
- `getRelevantKnowledgeForOpportunity(supabase, userId, opportunity, limit)` - Opportunity-specific search
- `formatKnowledgeContext(entries)` - Format results for AI prompt injection

**How it works:**
1. Generates embedding for query text
2. Retrieves candidates from knowledge_base
3. Calculates cosine similarity for each candidate
4. Returns top N most similar entries

## Knowledge Base (`public.knowledge_base`)

Centralized table storing all BD intelligence sources with vector embeddings.

**Schema:**
- `id`: UUID primary key
- `user_id`: UUID reference to user
- `source_type`: Text enum (youtube, publication, podcast, hatch, defense_contract, sam, linkedin, newsletter)
- `source_url`: Text (original URL)
- `source_id`: Text (unique identifier from source)
- `title`: Text (headline/title)
- `summary`: Text (short summary)
- `full_text`: Text (complete content)
- `published_at`: Timestamptz (publication date)
- `ingested_at`: Timestamptz (when added to knowledge base)
- `embedding`: vector(1536) (pgvector embedding)
- `tags`: Text[] (categorization tags)
- `relevance_score`: Numeric (0-100)
- `metadata`: JSONB (source-specific data)

**Indexes:**
- `idx_knowledge_base_embedding` - HNSW index for fast vector similarity search
- `idx_knowledge_base_user_id` - User filtering
- `idx_knowledge_base_source_type` - Source filtering
- `idx_knowledge_base_published_at` - Time-based queries
- `idx_knowledge_base_tags` - GIN index for tag searches

## Ingestion Functions

### YouTube Knowledge (`ingest-youtube-knowledge`)

**Purpose:** Sync YouTube video transcripts to knowledge_base

**Process:**
1. Fetch YouTube entries from `youtube_knowledge`
2. For each entry, generate embedding from title + transcript + themes
3. Insert into `knowledge_base` with source_type='youtube'
4. Skip duplicates (based on video_id)

**Metadata stored:**
- channel_id
- best_practices
- win_strategies
- red_flags
- technical_approaches

### Publications (`ingest-publications`)

**Purpose:** Sync RSS feeds from defense/BD publications to knowledge_base

**Sources:**
- Defense News
- Breaking Defense
- GovConWire
- FedScoop
- Defense One

**Process:**
1. Fetch RSS feed XML
2. Parse items (title, link, description, pubDate)
3. Generate embedding from title + description
4. Insert into `knowledge_base` for all users
5. Skip duplicates (based on URL)

**Tags:** ['defense', 'news', 'industry'], ['govcon', 'contracts', 'news'], etc.

## AI-Enhanced Workflows

### Opportunity Scoring (`ai-score-opportunity`)

**Enhanced with knowledge base:**
1. Fetch opportunity details
2. Query knowledge_base for relevant intel (vector search on title + description)
3. Inject top 10 relevant entries into GPT-5 prompt
4. Score opportunity with context-aware reasoning
5. Store ai_fit_score, ai_bucket, ai_tags, ai_reason, ai_summary

**Why this matters:**
- AI now "knows" about recent defense contracts, news, trends
- Scoring considers market context, not just opportunity text
- More accurate HIGH_PRIORITY vs WATCH vs INFO_ONLY classification

### Opportunity AI Brief (`opportunity-ai-brief`)

**NEW: Strategic brief for individual opportunities**

**Input:** `opportunity_id`

**Process:**
1. Fetch opportunity + matched hunts
2. Query knowledge_base for top 10 relevant intel entries (embedding similarity)
3. Build enriched prompt with:
   - Opportunity details (title, agency, description, deadlines, scores, tags)
   - Matched hunts
   - Relevant intelligence summaries
4. Call OpenAI GPT-5 for strategic analysis
5. Store structured brief in `ai_brief` jsonb column

**Output Structure:**
```json
{
  "why_it_matters": "2-3 paragraphs explaining strategic importance",
  "fit_analysis": [
    "Bullet about alignment with capabilities",
    "Bullet about risks/gaps",
    "Bullet about competitive context"
  ],
  "next_7_days_plan": [
    "Specific action item 1 with deadline",
    "Specific action item 2 with deadline",
    "Specific action item 3 with deadline"
  ],
  "intel_used": [
    { "id": "uuid", "title": "Intel title", "source_type": "youtube" }
  ]
}
```

**UI Access:**
- **Opportunity Detail Page**: New "AI Briefing" tab
- **Dashboard Cards**: Sparkles icon button → opens dialog
- **Kanban Board**: Sparkles icon button → opens dialog
- **Auto-refresh**: Briefs older than 48 hours are regenerated automatically

**Error Handling:**
- On GPT-5 failure: Returns fallback brief with "temporarily unavailable" message
- Shows warning banner in UI
- "Regenerate" button allows manual retry

### Daily Intelligence Brief (`generate-daily-digest`)

**Enhanced with knowledge base:**
1. Gather last 24h data from YouTube, podcasts, news, Hatch, opportunities
2. Query knowledge_base for last 7 days of relevant intel
3. Send enriched context to GPT-5
4. Generate executive summary + trending topics + recommended pursuits + action items
5. Store in `knowledge_digests` table

**Output includes:**
- Executive Summary (2-3 paragraphs)
- Top 3 Trending Topics (based on frequency across sources)
- Top 3 Companies in the News (entity recognition)
- Recommended Pursuits (opportunities matching trending tags)
- Action Items (3-5 specific next steps)
- Market Trends (emerging patterns with impact assessment)

## Usage Examples

### Score an opportunity with intelligence context

```typescript
import { supabase } from './client';

const { data } = await supabase.functions.invoke('ai-score-opportunity', {
  body: { opportunityId: 'uuid-here' }
});

// Returns: { score, bucket, tags, reason, summary }
```

### Ingest YouTube knowledge

```typescript
const { data } = await supabase.functions.invoke('ingest-youtube-knowledge');

// Returns: { ingested, skipped, total }
```

### Ingest publications

```typescript
const { data } = await supabase.functions.invoke('ingest-publications');

// Returns: { ingested, skipped, feeds_processed }
```

### Generate daily brief

```typescript
const { data } = await supabase.functions.invoke('generate-daily-digest', {
  body: { userId: 'uuid-here' }
});

// Returns: { digest }
```

## Best Practices

### When to use OpenAI GPT-5
- Complex reasoning requiring nuance
- Multi-step analysis (scoring, summarization, recommendations)
- Business-critical decisions (opportunity scoring, strategic briefs)

### When to use Lovable AI / Gemini
- Embeddings (always)
- Bulk processing (transcripts, publications)
- Classification and tagging
- Simple summaries

### Knowledge Base Strategy
- Ingest everything that could influence BD decisions
- Use vector search to find relevant context
- Inject into AI prompts to ground reasoning in real data
- Keep embeddings fresh (re-ingest periodically)

### Rate Limiting
- YouTube ingestion: 100ms delay between embeddings
- Publications: 200ms delay between embeddings
- Batch operations when possible
- Handle 429/402 errors gracefully

## Future Enhancements

1. **Podcast Ingestion**: Extract transcripts, embed, store in knowledge_base
2. **LinkedIn/Substack**: Track key BD influencers, embed posts
3. **Contract Awards**: Embed Defense.gov contract descriptions
4. **SAM.gov Descriptions**: Embed opportunity descriptions for better matching
5. **Trend Analysis**: Time-series analysis of topic frequency
6. **Company Tracking**: Entity recognition + competitive intelligence
7. **Recommendation Engine**: ML-based opportunity recommendations
