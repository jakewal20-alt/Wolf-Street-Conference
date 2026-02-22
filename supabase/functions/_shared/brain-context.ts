// Brain Context Helper
// Provides centralized access to user's AI Brain configuration (writing style, summary, tags, reference docs)

export interface BrainContext {
  writingStyle: string;
  brainSummary: string;
  tags: string[];
  referenceSnippets: Array<{ title: string; text: string }>;
  systemPromptSnippet: string;
  hasContext: boolean;
}

interface BrainSettings {
  writing_style?: string;
  brain_summary?: string;
  tags?: string[];
}

interface KnowledgeBaseDoc {
  title: string;
  summary?: string;
  full_text?: string;
}

const DEFAULT_WRITING_STYLE = `Write in a clear, concise, and professional tone suitable for DoD and federal proposals. 
- Use technical language appropriate for the audience
- Avoid fluff and unnecessary adjectives
- Structure responses with clear sections when applicable
- Follow Format-1 proposal structure when generating proposals
- No bold text in body paragraphs
- Lead with impact and value proposition`;

/**
 * Retrieves the complete Brain context for a user, including:
 * - Writing style preferences
 * - Brain summary (company context)
 * - Capability tags
 * - Reference document snippets
 * - Pre-formatted system prompt snippet ready to inject
 */
export async function getBrainContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<BrainContext> {
  console.log('[getBrainContext] Fetching brain context for user:', userId);

  // Fetch brain settings
  const { data: brainSettings, error } = await supabase
    .from('brain_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[getBrainContext] Error fetching brain settings:', error);
  }

  const settings = brainSettings as BrainSettings | null;
  const writingStyle = settings?.writing_style || DEFAULT_WRITING_STYLE;
  const brainSummary = settings?.brain_summary || '';
  const tags = settings?.tags || [];

  // Fetch brain reference documents
  const referenceSnippets = await getBrainReferenceDocuments(supabase, userId, 5);

  // Determine if we have meaningful context
  const hasContext = !!(brainSummary || tags.length > 0 || referenceSnippets.length > 0);

  // Build comprehensive system prompt snippet
  let systemPromptSnippet = '';
  
  if (brainSummary) {
    systemPromptSnippet += `\n\n## COMPANY CONTEXT\n${brainSummary}\n`;
  }
  
  if (writingStyle) {
    systemPromptSnippet += `\n\n## WRITING STYLE REQUIREMENTS\n${writingStyle}\n`;
  }
  
  if (tags.length > 0) {
    systemPromptSnippet += `\n\n## KEY CAPABILITY THEMES\nMaintain focus on these capability areas and vocabulary: ${tags.join(', ')}\n`;
    systemPromptSnippet += `Use these tags as hints for what kinds of work the company is best at.\n`;
  }

  if (referenceSnippets.length > 0) {
    systemPromptSnippet += `\n\n## REFERENCE DOCUMENTS\nThe following are excerpts from company reference documents that provide context:\n`;
    referenceSnippets.forEach((snippet, idx) => {
      systemPromptSnippet += `\n### ${idx + 1}. ${snippet.title}\n${snippet.text.substring(0, 2000)}${snippet.text.length > 2000 ? '...' : ''}\n`;
    });
  }

  console.log('[getBrainContext] Brain context loaded:', {
    brain_applied: hasContext,
    hasWritingStyle: !!writingStyle,
    hasSummary: !!brainSummary,
    tagCount: tags.length,
    referenceDocCount: referenceSnippets.length
  });

  return {
    writingStyle,
    brainSummary,
    tags,
    referenceSnippets,
    systemPromptSnippet,
    hasContext
  };
}

/**
 * Fetches brain reference documents from knowledge_base
 */
export async function getBrainReferenceDocuments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  limit: number = 5
): Promise<Array<{ title: string; text: string }>> {
  // Query by source_type OR metadata flag (support both patterns)
  const { data: docs, error } = await supabase
    .from('knowledge_base')
    .select('title, summary, full_text')
    .eq('user_id', userId)
    .or("source_type.eq.brain_reference,metadata->>is_brain_reference.eq.true")
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getBrainReferenceDocuments] Error:', error);
    return [];
  }

  return ((docs || []) as KnowledgeBaseDoc[]).map(doc => ({
    title: doc.title,
    text: doc.full_text || doc.summary || ''
  }));
}

/**
 * Builds a scoring-specific system prompt with Brain context injected
 */
export function buildScoringSystemPromptWithBrain(
  basePrompt: string,
  brainContext: BrainContext
): string {
  if (!brainContext.hasContext) {
    return basePrompt;
  }

  return `${basePrompt}

${brainContext.systemPromptSnippet}

SCORING INSTRUCTIONS WITH COMPANY CONTEXT:
- Use the company summary and capability tags above to decide fit_score and bucket
- Treat the capability themes as hints for what kinds of work this company is best at
- Opportunities that match the company's core capabilities should score higher
- Keep the tone concise and technical, following the writing style guidelines`;
}

/**
 * Builds a proposal-specific system prompt with Brain context injected
 */
export function buildProposalSystemPromptWithBrain(
  basePrompt: string,
  brainContext: BrainContext
): string {
  if (!brainContext.hasContext) {
    return basePrompt;
  }

  return `${basePrompt}

${brainContext.systemPromptSnippet}

PROPOSAL WRITING INSTRUCTIONS:
- Write as if you are this company. Use "we" and "our" language.
- Reflect the company's mission and differentiators from the company context above.
- Apply the writing style guidelines strictly.
- Reference the capability themes when discussing strengths and past performance.
- Be confident, authoritative, and mission-focused.`;
}

/**
 * Builds a copilot-specific system prompt with Brain context injected
 */
export function buildCopilotSystemPromptWithBrain(
  basePrompt: string,
  brainContext: BrainContext
): string {
  if (!brainContext.hasContext) {
    return basePrompt;
  }

  return `${basePrompt}

${brainContext.systemPromptSnippet}

COPILOT BEHAVIOR WITH COMPANY CONTEXT:
- You are the BD Radar Copilot for this specific company.
- Always answer as if you are on this company's capture team.
- Use the company context to guide fit analysis and opportunity recommendations.
- Apply the writing style when drafting any proposal content or recommendations.
- Reference capability themes when discussing what opportunities are a good fit.`;
}
