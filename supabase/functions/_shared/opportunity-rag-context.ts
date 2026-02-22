/**
 * Unified RAG Context Builder for Opportunity-Specific AI Tools
 * 
 * This module provides a single source of truth for building context
 * that ALL proposal tools use: generate-outline, generate-proposal-document,
 * proposal-fact-checker, compliance-analyzer, proposal-evaluation, copilot-chat
 */

// Use 'any' type for SupabaseClient to avoid version mismatch issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export interface OpportunityDocument {
  id: string;
  title: string;
  doc_type: 'pws' | 'sow' | 'rfp' | 'qna' | 'exemplar' | 'other';
  full_text: string;
  summary?: string;
  tags?: string[];
}

export interface OpportunityContext {
  id: string;
  title: string;
  agency: string | null;
  naics: string | null;
  psc: string | null;
  due_date: string | null;
  set_aside: string | null;
  source_provider: string;
  synopsis: string | null;
  description: string | null;
  description_enriched: string | null;
  ai_summary: string | null;
  ai_brief: any | null;
}

export interface BrainContext {
  writing_style: string | null;
  brain_summary: string | null;
  tags: string[];
}

export interface Capability {
  capability_name: string;
  description: string | null;
  keywords: string[];
  priority: number | null;
}

export interface RAGBundle {
  // Brain (global user context)
  brain: BrainContext;
  capabilities: Capability[];
  
  // Opportunity-specific
  opportunity: OpportunityContext;
  
  // Documents attached to THIS opportunity
  documents: {
    pws: OpportunityDocument[];
    sow: OpportunityDocument[];
    rfp: OpportunityDocument[];
    qna: OpportunityDocument[];
    exemplar: OpportunityDocument[];
    other: OpportunityDocument[];
  };
  
  // Metadata
  totalDocsLoaded: number;
  docTypesSummary: string[];
}

/**
 * Build the complete RAG context bundle for an opportunity
 * This is THE function all proposal AI tools should call
 */
export async function buildOpportunityRAGBundle(
  supabase: SupabaseClient,
  userId: string,
  opportunityId: string
): Promise<RAGBundle> {
  console.log('[RAG] Building context bundle for opportunity:', opportunityId);
  
  // 1. Fetch Brain context (global user settings)
  const brainPromise = supabase
    .from('brain_settings')
    .select('writing_style, brain_summary, tags')
    .eq('user_id', userId)
    .single();
  
  // 2. Fetch capabilities
  const capabilitiesPromise = supabase
    .from('company_capabilities')
    .select('capability_name, description, keywords, priority')
    .eq('user_id', userId)
    .order('priority', { ascending: false })
    .limit(15);
  
  // 3. Fetch opportunity details
  const opportunityPromise = supabase
    .from('opportunities')
    .select('id, title, agency, naics, psc, due_date, set_aside, source_provider, synopsis, description, description_enriched, ai_summary, ai_brief')
    .eq('id', opportunityId)
    .eq('user_id', userId)
    .single();
  
  // 4. Fetch ALL documents linked to this opportunity from knowledge_base
  const documentsPromise = supabase
    .from('knowledge_base')
    .select('id, title, full_text, summary, tags, metadata, source_type')
    .eq('user_id', userId)
    .filter('metadata->>opportunity_id', 'eq', opportunityId)
    .order('created_at', { ascending: false });
  
  // Execute all queries in parallel
  const [brainResult, capabilitiesResult, opportunityResult, documentsResult] = await Promise.all([
    brainPromise,
    capabilitiesPromise,
    opportunityPromise,
    documentsPromise
  ]);
  
  // Process Brain
  const brain: BrainContext = {
    writing_style: brainResult.data?.writing_style || null,
    brain_summary: brainResult.data?.brain_summary || null,
    tags: brainResult.data?.tags || []
  };
  
  if (brainResult.error) {
    console.warn('[RAG] No brain settings found for user');
  } else {
    console.log('[RAG] Brain loaded:', {
      hasWritingStyle: !!brain.writing_style,
      hasSummary: !!brain.brain_summary,
      tagCount: brain.tags.length
    });
  }
  
  // Process Capabilities
  const capabilities: Capability[] = (capabilitiesResult.data || []).map((c: any) => ({
    capability_name: c.capability_name,
    description: c.description,
    keywords: c.keywords || [],
    priority: c.priority
  }));
  console.log('[RAG] Capabilities loaded:', capabilities.length);
  
  // Process Opportunity
  if (opportunityResult.error || !opportunityResult.data) {
    throw new Error(`Opportunity not found: ${opportunityId}`);
  }
  const opportunity: OpportunityContext = opportunityResult.data;
  console.log('[RAG] Opportunity loaded:', opportunity.title);
  
  // Process Documents - categorize by type
  const documents: RAGBundle['documents'] = {
    pws: [],
    sow: [],
    rfp: [],
    qna: [],
    exemplar: [],
    other: []
  };
  
  for (const doc of documentsResult.data || []) {
    const metadata = doc.metadata || {};
    const fileName = (metadata.file_name || doc.title || '').toLowerCase();
    
    // Determine document type
    let docType: OpportunityDocument['doc_type'] = 'other';
    
    if (metadata.is_pws === true || metadata.is_pws === 'true' || fileName.includes('pws')) {
      docType = 'pws';
    } else if (metadata.is_sow === true || metadata.is_sow === 'true' || fileName.includes('sow')) {
      docType = 'sow';
    } else if (metadata.is_rfp === true || fileName.includes('rfp') || fileName.includes('solicitation')) {
      docType = 'rfp';
    } else if (metadata.is_qna === true || fileName.includes('q&a') || fileName.includes('qna') || fileName.includes('question')) {
      docType = 'qna';
    } else if (metadata.is_exemplar === true || metadata.is_exemplar === 'true' || fileName.includes('exemplar')) {
      docType = 'exemplar';
    }
    
    const opportunityDoc: OpportunityDocument = {
      id: doc.id,
      title: doc.title,
      doc_type: docType,
      full_text: doc.full_text || '',
      summary: doc.summary || undefined,
      tags: doc.tags || undefined
    };
    
    documents[docType].push(opportunityDoc);
  }
  
  const totalDocsLoaded = Object.values(documents).flat().length;
  const docTypesSummary = Object.entries(documents)
    .filter(([_, docs]) => docs.length > 0)
    .map(([type, docs]) => `${type.toUpperCase()}(${docs.length})`);
  
  console.log('[RAG] Documents loaded:', totalDocsLoaded, docTypesSummary.join(', '));
  
  return {
    brain,
    capabilities,
    opportunity,
    documents,
    totalDocsLoaded,
    docTypesSummary
  };
}

/**
 * Format the RAG bundle into a structured prompt section
 * Use this in system prompts for AI tools
 */
export function formatRAGBundleForPrompt(bundle: RAGBundle): string {
  const sections: string[] = [];
  
  // === BRAIN CONTEXT ===
  if (bundle.brain.brain_summary || bundle.brain.writing_style) {
    sections.push('=== COMPANY BRAIN CONTEXT ===');
    if (bundle.brain.brain_summary) {
      sections.push(`COMPANY SUMMARY:\n${bundle.brain.brain_summary}`);
    }
    if (bundle.brain.writing_style) {
      sections.push(`\nWRITING STYLE INSTRUCTIONS:\n${bundle.brain.writing_style}`);
    }
    if (bundle.brain.tags.length > 0) {
      sections.push(`\nFOCUS TAGS: ${bundle.brain.tags.join(', ')}`);
    }
  }
  
  // === CAPABILITIES ===
  if (bundle.capabilities.length > 0) {
    sections.push('\n=== COMPANY CAPABILITIES ===');
    for (const cap of bundle.capabilities) {
      const priorityLabel = cap.priority && cap.priority >= 8 ? '⭐ CORE' : '';
      sections.push(`\n${priorityLabel} ${cap.capability_name}:`);
      if (cap.description) {
        sections.push(`  ${cap.description}`);
      }
      if (cap.keywords.length > 0) {
        sections.push(`  Keywords: ${cap.keywords.slice(0, 10).join(', ')}`);
      }
    }
  }
  
  // === OPPORTUNITY DETAILS ===
  sections.push('\n=== OPPORTUNITY DETAILS ===');
  sections.push(`Title: ${bundle.opportunity.title}`);
  sections.push(`Agency: ${bundle.opportunity.agency || 'Not specified'}`);
  if (bundle.opportunity.naics) sections.push(`NAICS: ${bundle.opportunity.naics}`);
  if (bundle.opportunity.psc) sections.push(`PSC: ${bundle.opportunity.psc}`);
  if (bundle.opportunity.due_date) sections.push(`Due Date: ${bundle.opportunity.due_date}`);
  if (bundle.opportunity.set_aside) sections.push(`Set-Aside: ${bundle.opportunity.set_aside}`);
  
  // Best available description
  const description = bundle.opportunity.description_enriched || 
                      bundle.opportunity.synopsis || 
                      bundle.opportunity.description || 
                      bundle.opportunity.ai_summary;
  if (description) {
    sections.push(`\nDESCRIPTION:\n${description}`);
  }
  
  if (bundle.opportunity.ai_summary && bundle.opportunity.ai_summary !== description) {
    sections.push(`\nAI ANALYSIS:\n${bundle.opportunity.ai_summary}`);
  }
  
  // === ATTACHED DOCUMENTS ===
  if (bundle.totalDocsLoaded > 0) {
    sections.push(`\n=== ATTACHED OPPORTUNITY DOCUMENTS (${bundle.totalDocsLoaded} total) ===`);
    sections.push(`Document types: ${bundle.docTypesSummary.join(', ')}`);
    
    // PWS/SOW get full priority - these are THE requirements
    const requirementsDocs = [...bundle.documents.pws, ...bundle.documents.sow, ...bundle.documents.rfp];
    if (requirementsDocs.length > 0) {
      sections.push('\n📋 REQUIREMENTS DOCUMENTS (PWS/SOW/RFP):');
      sections.push('**These are the actual solicitation requirements. Use as PRIMARY source.**');
      for (const doc of requirementsDocs) {
        sections.push(`\n[${doc.doc_type.toUpperCase()}] ${doc.title}`);
        // Include full text for requirements docs (up to 15k chars)
        if (doc.full_text) {
          sections.push(doc.full_text.substring(0, 15000));
          if (doc.full_text.length > 15000) {
            sections.push('...[truncated]');
          }
        }
      }
    }
    
    // Q&A documents
    if (bundle.documents.qna.length > 0) {
      sections.push('\n❓ Q&A / CLARIFICATIONS:');
      for (const doc of bundle.documents.qna) {
        sections.push(`\n[Q&A] ${doc.title}`);
        if (doc.full_text) {
          sections.push(doc.full_text.substring(0, 8000));
        }
      }
    }
    
    // Exemplar proposals
    if (bundle.documents.exemplar.length > 0) {
      sections.push('\n📖 EXEMPLAR PROPOSALS (style reference):');
      sections.push('Use these as structural and tone guides. Do NOT copy verbatim.');
      for (const doc of bundle.documents.exemplar) {
        sections.push(`\n[EXEMPLAR] ${doc.title}`);
        if (doc.full_text) {
          sections.push(doc.full_text.substring(0, 3000));
        }
      }
    }
    
    // Other documents
    if (bundle.documents.other.length > 0) {
      sections.push('\n📎 OTHER ATTACHED DOCUMENTS:');
      for (const doc of bundle.documents.other) {
        sections.push(`\n[DOC] ${doc.title}`);
        if (doc.summary) {
          sections.push(doc.summary);
        } else if (doc.full_text) {
          sections.push(doc.full_text.substring(0, 2000));
        }
      }
    }
  } else {
    sections.push('\n⚠️ No documents attached to this opportunity yet.');
  }
  
  return sections.join('\n');
}

/**
 * Get a summary of loaded documents for UI display
 */
export function getDocumentsSummary(bundle: RAGBundle): {
  loaded: boolean;
  count: number;
  types: string[];
  label: string;
} {
  const types: string[] = [];
  if (bundle.documents.pws.length > 0) types.push('PWS');
  if (bundle.documents.sow.length > 0) types.push('SOW');
  if (bundle.documents.rfp.length > 0) types.push('RFP');
  if (bundle.documents.qna.length > 0) types.push('Q&A');
  if (bundle.documents.exemplar.length > 0) types.push('Exemplar');
  if (bundle.documents.other.length > 0) types.push(`${bundle.documents.other.length} other`);
  
  return {
    loaded: bundle.totalDocsLoaded > 0,
    count: bundle.totalDocsLoaded,
    types,
    label: types.length > 0 ? `Docs: ${types.join(', ')}` : 'No docs'
  };
}
