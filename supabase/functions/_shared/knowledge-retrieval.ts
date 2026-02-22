/**
 * Centralized knowledge retrieval functions
 * 
 * Query the knowledge_base to enrich AI prompts with relevant context
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';
import { generateEmbedding } from './embedding-client.ts';

export interface KnowledgeEntry {
  id: string;
  source_type: string;
  source_url: string | null;
  title: string;
  summary: string | null;
  full_text: string | null;
  published_at: string | null;
  tags: string[] | null;
  relevance_score: number;
  similarity?: number;
  metadata?: any;
}

/**
 * Get relevant knowledge entries for a given query text
 * Uses vector similarity search to find the most relevant content
 */
export async function getRelevantKnowledge(
  supabase: SupabaseClient,
  userId: string,
  queryText: string,
  options: {
    limit?: number;
    source_types?: string[];
    min_score?: number;
  } = {}
): Promise<KnowledgeEntry[]> {
  const { limit = 10, source_types, min_score = 50 } = options;

  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(queryText);

    // Build query
    let query = supabase
      .from('knowledge_base')
      .select('*')
      .eq('user_id', userId)
      .gte('relevance_score', min_score)
      .order('ingested_at', { ascending: false });

    // Filter by source types if specified
    if (source_types && source_types.length > 0) {
      query = query.in('source_type', source_types);
    }

    const { data, error } = await query.limit(100); // Get more for re-ranking

    if (error) {
      console.error('Error fetching knowledge base:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Calculate similarity scores for each entry
    const entriesWithSimilarity = data
      .filter(entry => entry.embedding && entry.embedding.length > 0)
      .map(entry => {
        // Calculate cosine similarity
        const embedding = entry.embedding as number[];
        const similarity = cosineSimilarity(queryEmbedding, embedding);
        
        return {
          ...entry,
          similarity,
        } as KnowledgeEntry;
      })
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, limit);

    console.log(`Found ${entriesWithSimilarity.length} relevant knowledge entries`);
    
    return entriesWithSimilarity;

  } catch (error) {
    console.error('Error in getRelevantKnowledge:', error);
    return [];
  }
}

/**
 * Get relevant knowledge for an opportunity
 * Combines opportunity title, description, and agency to find relevant intel
 * Prioritizes explicitly linked company documents
 */
export async function getRelevantKnowledgeForOpportunity(
  supabase: SupabaseClient,
  userId: string,
  opportunity: {
    id?: string;
    title: string;
    description?: string;
    agency?: string;
    naics?: string;
    psc?: string;
  },
  limit: number = 10,
  priorityKnowledgeIds: string[] = [] // IDs to always include (e.g., linked company docs)
): Promise<KnowledgeEntry[]> {
  console.log('[Knowledge Retrieval] Starting for opportunity:', opportunity.title);

  // Build query from opportunity details
  const queryParts = [
    opportunity.title,
    opportunity.description?.substring(0, 500),
    opportunity.agency,
    opportunity.naics,
    opportunity.psc,
  ].filter(Boolean);

  const queryText = queryParts.join(' ');

  // 1) Always try to load company profile knowledge entry first
  let companyProfileEntry: KnowledgeEntry | null = null;
  try {
    const { data: companyProfileData, error: companyProfileError } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('user_id', userId)
      .eq('metadata->>is_company_profile', 'true')
      .order('relevance_score', { ascending: false })
      .limit(1);

    if (companyProfileError) {
      console.error('[Knowledge Retrieval] Error fetching company profile:', companyProfileError);
    } else if (companyProfileData && companyProfileData.length > 0) {
      companyProfileEntry = {
        ...(companyProfileData[0] as any),
        similarity: 1.0,
      } as KnowledgeEntry;
      console.log('[Knowledge Retrieval] ✅ Company profile loaded:', companyProfileData[0].title);
    } else {
      console.warn('[Knowledge Retrieval] ⚠️ Company profile missing from knowledge base.');
    }
  } catch (err) {
    console.error('[Knowledge Retrieval] Exception fetching company profile:', err);
  }

  // 2) Fetch PWS/SOW documents for this specific opportunity (if opportunity.id provided)
  let pwsEntry: KnowledgeEntry | null = null;
  if (opportunity.id) {
    try {
      const { data: pwsData, error: pwsError } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('user_id', userId)
        .filter('metadata->>opportunity_id', 'eq', opportunity.id)
        .or('metadata->>is_pws.eq.true,metadata->>is_sow.eq.true')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pwsError) {
        console.error('[Knowledge Retrieval] Error fetching PWS/SOW:', pwsError);
      } else if (pwsData) {
        pwsEntry = {
          ...(pwsData as any),
          similarity: 1.0,
        } as KnowledgeEntry;
        console.log('[Knowledge Retrieval] ✅ PWS/SOW document loaded:', pwsData.title);
      }
    } catch (err) {
      console.error('[Knowledge Retrieval] Exception fetching PWS/SOW:', err);
    }
  }

  // 3) Check if we should load an exemplar proposal based on opportunity keywords
  let exemplarEntry: KnowledgeEntry | null = null;
  try {
    // Check if opportunity title or description contains keywords that match an exemplar
    const opportunityText = `${opportunity.title} ${opportunity.description || ''}`.toLowerCase();
    
    // First, try to find exemplars with matching keywords in metadata
    const { data: exemplarData, error: exemplarError } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('user_id', userId)
      .eq('metadata->>is_exemplar', 'true')
      .order('relevance_score', { ascending: false });

    if (!exemplarError && exemplarData && exemplarData.length > 0) {
      // Find the best matching exemplar based on opportunity_keyword in metadata
      for (const candidate of exemplarData) {
        const metadata = candidate.metadata || {};
        const exemplarKeyword = (metadata.opportunity_keyword || '').toLowerCase();
        
        if (exemplarKeyword && opportunityText.includes(exemplarKeyword)) {
          exemplarEntry = {
            ...(candidate as any),
            similarity: 1.0,
          } as KnowledgeEntry;
          console.log(`Loaded exemplar proposal "${candidate.title}" matching keyword "${exemplarKeyword}"`);
          break;
        }
      }
    }
  } catch (err) {
    console.error('Error loading exemplar proposal:', err);
  }

  // 4) If we have priority knowledge IDs (e.g., linked company docs), fetch them next
  let priorityEntries: KnowledgeEntry[] = [];
  if (priorityKnowledgeIds.length > 0) {
    const { data: priorityData, error: priorityError } = await supabase
      .from('knowledge_base')
      .select('*')
      .in('id', priorityKnowledgeIds)
      .eq('user_id', userId);

    if (!priorityError && priorityData) {
      priorityEntries = priorityData.map(entry => ({
        ...(entry as any),
        similarity: 1.0, // Max similarity for explicitly linked docs
      })) as KnowledgeEntry[];
      console.log(`Loaded ${priorityEntries.length} priority knowledge entries (linked company docs)`);
    }
  }

  // 5) Fetch additional relevant entries
  const alreadyIncludedCount = (companyProfileEntry ? 1 : 0) + (pwsEntry ? 1 : 0) + (exemplarEntry ? 1 : 0) + priorityEntries.length;
  const remainingLimit = Math.max(0, limit - alreadyIncludedCount);
  const results = await getRelevantKnowledge(supabase, userId, queryText, {
    limit: remainingLimit,
    min_score: 50,
  });

  // 6) Combine in priority order: company profile, PWS/SOW, exemplar (if matched), priority entries, then other relevant entries
  const combined: KnowledgeEntry[] = [];
  if (companyProfileEntry) {
    combined.push(companyProfileEntry);
  }
  if (pwsEntry) {
    combined.push(pwsEntry);
  }
  if (exemplarEntry) {
    combined.push(exemplarEntry);
  }
  combined.push(...priorityEntries, ...results);

  // Remove duplicates by ID while preserving first occurrence
  const uniqueEntries: KnowledgeEntry[] = [];
  const seenIds = new Set<string>();
  for (const entry of combined) {
    if (!seenIds.has(entry.id)) {
      seenIds.add(entry.id);
      uniqueEntries.push(entry);
    }
  }

  return uniqueEntries.slice(0, limit);
}

/**
 * Format knowledge entries as context for AI prompts
 * Highlights linked company documents separately
 */
export function formatKnowledgeContext(entries: KnowledgeEntry[], linkedDocCount: number = 0): string {
  if (entries.length === 0) {
    return 'No relevant intelligence available.';
  }

  let formatted = '';

  // Identify special entries by metadata flags
  const companyProfile = entries.find(e => e.metadata?.is_company_profile === true || e.metadata?.is_company_profile === 'true');
  const pwsSow = entries.find(e => e.metadata?.is_pws === true || e.metadata?.is_sow === true);
  const exemplar = entries.find(e => e.metadata?.is_exemplar === true || e.metadata?.is_exemplar === 'true');
  
  // Separate linked company docs from other intel (excluding special entries)
  const linkedDocs = entries.filter((e, i) => 
    i < linkedDocCount && 
    e.id !== companyProfile?.id && 
    e.id !== exemplar?.id &&
    e.id !== pwsSow?.id
  );
  const otherIntel = entries.filter((e, i) => 
    i >= linkedDocCount && 
    e.id !== companyProfile?.id && 
    e.id !== exemplar?.id &&
    e.id !== pwsSow?.id
  );

  // PWS/SOW document gets highest priority (after company profile)
  if (pwsSow) {
    formatted += '\n\n📄 PWS/SOW EXTRACT (Requirements Document):\n\n';
    formatted += '**This is the actual solicitation document. Use it as the PRIMARY source of requirements.**\n\n';
    formatted += `[PWS] ${pwsSow.title}\n`;
    if (pwsSow.tags && pwsSow.tags.length > 0) {
      formatted += `Tags: ${pwsSow.tags.join(', ')}\n`;
    }
    formatted += `\n${pwsSow.full_text?.substring(0, 10000) || pwsSow.summary || 'No content available'}\n`;
    formatted += '\n...\n';
  }

  // Exemplar proposal gets special formatting
  if (exemplar) {
    formatted += '\n\n📖 EXEMPLAR PROPOSAL (Style & Structure Reference):\n\n';
    formatted += `[EXEMPLAR] ${exemplar.title}\n`;
    if (exemplar.tags && exemplar.tags.length > 0) {
      formatted += `Tags: ${exemplar.tags.join(', ')}\n`;
    }
    formatted += `\n${exemplar.full_text?.substring(0, 2000) || exemplar.summary || 'No content available'}\n`;
    formatted += '\n(Use this as a style guide for structure, depth, and tone. Do not copy verbatim.)\n';
  }

  if (linkedDocs.length > 0) {
    formatted += '\n\n🏢 LINKED COMPANY DOCUMENTS (Trusted Context):\n\n';
    formatted += linkedDocs.map((entry, i) => {
      const parts = [
        `[COMPANY DOC ${i + 1}] ${entry.title}`,
        entry.tags && entry.tags.length > 0 ? `Tags: ${entry.tags.join(', ')}` : null,
        entry.summary || entry.full_text?.substring(0, 400),
      ].filter(Boolean);
      return parts.join('\n');
    }).join('\n\n---\n\n');
  }

  if (otherIntel.length > 0) {
    formatted += '\n\nRELEVANT INTELLIGENCE:\n\n';
    formatted += otherIntel.map((entry, i) => {
      const parts = [
        `[${i + 1}] ${entry.title}`,
        entry.source_type ? `Source: ${entry.source_type}` : null,
        entry.published_at ? `Date: ${new Date(entry.published_at).toLocaleDateString()}` : null,
        entry.tags && entry.tags.length > 0 ? `Tags: ${entry.tags.join(', ')}` : null,
        entry.summary || entry.full_text?.substring(0, 300),
        entry.similarity ? `Relevance: ${Math.round(entry.similarity * 100)}%` : null,
      ].filter(Boolean);
      return parts.join('\n');
    }).join('\n\n---\n\n');
  }

  return formatted;
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
