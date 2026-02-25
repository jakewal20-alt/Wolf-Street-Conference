/**
 * Multi-Source Opportunity Ingestion Layer
 * =========================================
 * 
 * A unified abstraction for fetching opportunities:
 * - SAM.gov API (primary authority)
 * - SAM.gov HTML scraping (fallback for incomplete API data)
 * - Generic HTML extraction (for non-SAM URLs)
 */

export type ProviderName = 'sam_gov' | 'sam_gov_scraped' | 'manual' | 'other_url';

export interface NormalizedOpportunity {
  title: string;
  synopsis: string | null;
  description: string | null;
  agency: string | null;
  due_date: string | null; // ISO8601
  posted_date: string | null;
  notice_id: string | null;
  solicitation_number: string | null;
  external_url: string | null;
  external_metadata: Record<string, any>;
  naics: string | null;
  type: string | null;
  set_aside: string | null;
}

export interface SearchCriteria {
  keywords?: string[];
  naics?: string[];
  agencies?: string[];
  page?: number;
  limit?: number;
}

export interface MultiSourceResult {
  success: boolean;
  provider_used: ProviderName;
  items: NormalizedOpportunity[];
  total_found: number;
  rate_limited: boolean;
  fallback_used: boolean;
  error?: string;
  message?: string;
}

// Provider labels for UI display
export function getProviderLabels(): Record<ProviderName, string> {
  return {
    sam_gov: 'SAM.gov',
    sam_gov_scraped: 'SAM.gov (scraped)',
    manual: 'Manual Entry',
    other_url: 'External URL',
  };
}

// Static labels for backward compat
export const PROVIDER_LABELS: Record<ProviderName, string> = {
  sam_gov: 'SAM.gov',
  sam_gov_scraped: 'SAM.gov (scraped)',
  manual: 'Manual Entry',
  other_url: 'External URL',
};

/**
 * Detect the provider from a URL
 */
export function detectProviderFromUrl(url: string): ProviderName {
  if (!url) return 'other_url';
  
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('sam.gov')) return 'sam_gov';
  
  return 'other_url';
}

/**
 * Normalize opportunity data from various providers into a unified format
 */
export function normalizeOpportunityPayload(input: {
  provider: ProviderName;
  raw: any;
}): NormalizedOpportunity {
  const { provider, raw } = input;

  switch (provider) {
    case 'sam_gov':
    case 'sam_gov_scraped':
      return normalizeSamGovPayload(raw);
    default:
      return normalizeGenericPayload(raw);
  }
}

/**
 * Normalize SAM.gov API response
 */
function normalizeSamGovPayload(raw: any): NormalizedOpportunity {
  return {
    title: raw.title || '',
    synopsis: raw.description || raw.additionalInfoText || null,
    description: raw.description || raw.additionalInfoText || null,
    agency: raw.department || raw.subtier || raw.office || raw.fullParentPathName || null,
    due_date: raw.responseDeadLine || raw.archiveDate || null,
    posted_date: raw.postedDate || null,
    notice_id: raw.noticeId || null,
    solicitation_number: raw.solicitationNumber || null,
    external_url: raw.noticeId ? `https://sam.gov/opp/${raw.noticeId}/view` : null,
    external_metadata: { raw: raw, provider: 'sam_gov' },
    naics: raw.naicsCode || null,
    type: raw.type || raw.baseType || null,
    set_aside: raw.setAside || raw.typeOfSetAsideDescription || null,
  };
}

/**
 * Normalize generic/unknown payload (HTML extraction, etc.)
 */
function normalizeGenericPayload(raw: any): NormalizedOpportunity {
  return {
    title: raw.title || raw.name || 'Untitled Opportunity',
    synopsis: raw.synopsis || raw.description || raw.text || null,
    description: raw.description || raw.synopsis || raw.text || null,
    agency: raw.agency || raw.organization || null,
    due_date: raw.due_date || raw.deadline || null,
    posted_date: raw.posted_date || null,
    notice_id: raw.notice_id || raw.id || null,
    solicitation_number: raw.solicitation_number || null,
    external_url: raw.url || null,
    external_metadata: { raw: raw, provider: 'other_url' },
    naics: raw.naics || null,
    type: raw.type || null,
    set_aside: raw.set_aside || null,
  };
}

// Date helpers
function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Fetch opportunities from SAM.gov search API
 */
export async function fetchFromSamGovSearch(
  criteria: SearchCriteria,
  samApiKey: string
): Promise<{ success: boolean; items: NormalizedOpportunity[]; total: number; rate_limited: boolean; error?: string }> {
  const baseUrl = 'https://api.sam.gov/prod/opportunities/v2/search';
  const limit = criteria.limit || 25;
  const offset = (criteria.page || 0) * limit;

  const params = new URLSearchParams({
    api_key: samApiKey,
    limit: String(limit),
    offset: String(offset),
    postedFrom: getDateDaysAgo(90),
    postedTo: getTodayDate(),
  });

  // Add keywords as title or keyword search
  if (criteria.keywords && criteria.keywords.length > 0) {
    params.append('keywords', criteria.keywords.join(' '));
  }

  // Add NAICS codes
  if (criteria.naics && criteria.naics.length > 0) {
    params.append('ncode', criteria.naics.join(','));
  }

  // Add agencies
  if (criteria.agencies && criteria.agencies.length > 0) {
    params.append('orgKey', criteria.agencies.join(','));
  }

  const apiUrl = `${baseUrl}?${params.toString()}`;
  console.log(`[multi-source] SAM.gov search: keywords=${criteria.keywords?.join(',')}, naics=${criteria.naics?.join(',')}`);

  try {
    const response = await fetch(apiUrl);

    if (response.status === 429) {
      console.warn('[multi-source] SAM.gov rate limited');
      return { success: false, items: [], total: 0, rate_limited: true, error: 'rate_limited' };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[multi-source] SAM.gov API error:', response.status, errorText);
      return { success: false, items: [], total: 0, rate_limited: false, error: `SAM API error: ${response.status}` };
    }

    const data = await response.json();
    const opportunities = data.opportunitiesData || [];
    const total = data.totalRecords || opportunities.length;

    const items = opportunities.map((opp: any) => normalizeOpportunityPayload({
      provider: 'sam_gov',
      raw: opp,
    }));

    console.log(`[multi-source] SAM.gov returned ${items.length} results (total: ${total})`);
    return { success: true, items, total, rate_limited: false };
  } catch (error) {
    console.error('[multi-source] SAM.gov search error:', error);
    return { success: false, items: [], total: 0, rate_limited: false, error: String(error) };
  }
}

/**
 * Fetch a single opportunity from SAM.gov by notice ID
 */
export async function fetchFromSamGovDetail(
  noticeIdOrUrl: string,
  samApiKey: string
): Promise<{ success: boolean; item: NormalizedOpportunity | null; rate_limited: boolean; error?: string }> {
  // Extract notice ID from URL if needed
  let noticeId = noticeIdOrUrl.trim();
  const urlMatch = noticeId.match(/opp\/([a-f0-9-]+)/i);
  if (urlMatch && urlMatch[1]) {
    noticeId = urlMatch[1];
  }

  const isUuid = /^[a-f0-9-]{36}$/i.test(noticeId);
  const baseUrl = 'https://api.sam.gov/prod/opportunities/v2/search';
  const params = new URLSearchParams({
    api_key: samApiKey,
    limit: '10',
  });

  if (isUuid) {
    params.append('noticeid', noticeId);
  } else {
    params.append('solnum', noticeId);
  }

  const apiUrl = `${baseUrl}?${params.toString()}`;
  console.log(`[multi-source] SAM.gov detail lookup: ${isUuid ? 'noticeid' : 'solnum'}=${noticeId}`);

  try {
    const response = await fetch(apiUrl);

    if (response.status === 429) {
      console.warn('[multi-source] SAM.gov rate limited on detail lookup');
      return { success: false, item: null, rate_limited: true, error: 'rate_limited' };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[multi-source] SAM.gov detail error:', response.status, errorText);
      return { success: false, item: null, rate_limited: false, error: `SAM API error: ${response.status}` };
    }

    const data = await response.json();
    if (!data.opportunitiesData || data.opportunitiesData.length === 0) {
      return { success: false, item: null, rate_limited: false, error: 'Opportunity not found' };
    }

    const item = normalizeOpportunityPayload({
      provider: 'sam_gov',
      raw: data.opportunitiesData[0],
    });

    console.log(`[multi-source] SAM.gov detail found: ${item.title}`);
    return { success: true, item, rate_limited: false };
  } catch (error) {
    console.error('[multi-source] SAM.gov detail error:', error);
    return { success: false, item: null, rate_limited: false, error: String(error) };
  }
}

/**
 * Normalize SAM.gov URL - convert workspace URLs to public format
 */
export function normalizeSamGovUrl(url: string): string {
  // Convert workspace URLs to public format
  // /workspace/contract/opp/{id}/view -> /opp/{id}/view
  const workspaceMatch = url.match(/sam\.gov\/workspace\/contract\/opp\/([a-f0-9-]+)/i);
  if (workspaceMatch) {
    return `https://sam.gov/opp/${workspaceMatch[1]}/view`;
  }
  return url;
}

/**
 * Extract notice ID from various SAM.gov URL formats
 */
export function extractNoticeIdFromUrl(url: string): string | null {
  // Pattern 1: /opp/{id} (public)
  const p1 = url.match(/sam\.gov\/opp\/([a-f0-9-]+)/i);
  if (p1) return p1[1];
  
  // Pattern 2: /workspace/contract/opp/{id} (authenticated)
  const p2 = url.match(/sam\.gov\/workspace\/contract\/opp\/([a-f0-9-]+)/i);
  if (p2) return p2[1];
  
  // Pattern 3: opportunityId query param
  const p3 = url.match(/opportunityId=([a-f0-9-]+)/i);
  if (p3) return p3[1];
  
  return null;
}

/**
 * Scrape SAM.gov opportunity page using Firecrawl (handles JS-rendered pages)
 */
export async function scrapeWithFirecrawl(
  url: string,
  firecrawlApiKey: string
): Promise<{ success: boolean; markdown: string | null; error?: string }> {
  console.log(`[multi-source] Scraping with Firecrawl: ${url}`);
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000, // Wait for JS to render
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[multi-source] Firecrawl error:', response.status, errorText);
      return { success: false, markdown: null, error: `Firecrawl error: ${response.status}` };
    }
    
    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown;
    
    if (!markdown || markdown.length < 100) {
      console.warn('[multi-source] Firecrawl returned minimal content');
      return { success: false, markdown: null, error: 'Minimal content returned' };
    }
    
    console.log(`[multi-source] Firecrawl success: ${markdown.length} chars`);
    return { success: true, markdown };
  } catch (error) {
    console.error('[multi-source] Firecrawl exception:', error);
    return { success: false, markdown: null, error: String(error) };
  }
}

/**
 * Scrape SAM.gov opportunity page and extract data using AI
 * Uses Firecrawl for JS-rendered pages when available
 */
export async function scrapeAndExtractSamGov(
  noticeIdOrUrl: string,
  openaiApiKey: string,
  firecrawlApiKey?: string
): Promise<{ success: boolean; item: NormalizedOpportunity | null; error?: string }> {
  // Build and normalize the SAM.gov URL
  let url = noticeIdOrUrl;
  if (!url.startsWith('http')) {
    url = `https://sam.gov/opp/${noticeIdOrUrl}/view`;
  } else {
    url = normalizeSamGovUrl(url);
  }
  
  console.log(`[multi-source] Scraping SAM.gov page: ${url}`);
  
  let htmlContent: string | null = null;
  
  // Try Firecrawl first if available (handles JS-rendered pages better)
  if (firecrawlApiKey) {
    const firecrawlResult = await scrapeWithFirecrawl(url, firecrawlApiKey);
    if (firecrawlResult.success && firecrawlResult.markdown) {
      htmlContent = firecrawlResult.markdown;
      console.log(`[multi-source] Using Firecrawl content for extraction`);
    }
  }
  
  // Fallback to direct fetch if Firecrawl unavailable or failed
  if (!htmlContent) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });
      
      if (!response.ok) {
        console.error(`[multi-source] SAM.gov scrape failed: ${response.status}`);
        return { success: false, item: null, error: `Failed to fetch page: ${response.status}` };
      }
      
      htmlContent = await response.text();
      console.log(`[multi-source] Got HTML via direct fetch (${htmlContent.length} chars)`);
    } catch (error) {
      console.error('[multi-source] SAM.gov direct fetch error:', error);
      return { success: false, item: null, error: String(error) };
    }
  }
  
  if (!htmlContent) {
    return { success: false, item: null, error: 'No content retrieved' };
  }
  
  // Use AI to extract opportunity data
  const extractResult = await extractFromHtml(htmlContent, url, openaiApiKey);
  
  if (extractResult.success && extractResult.item) {
    extractResult.item.external_metadata = {
      ...extractResult.item.external_metadata,
      provider: 'sam_gov_scraped',
      scraped_at: new Date().toISOString(),
    };
    return { success: true, item: extractResult.item };
  }
  
  return { success: false, item: null, error: extractResult.error || 'Extraction failed' };
}

/**
 * Extract opportunity data from HTML using AI (OpenAI)
 */
export async function extractFromHtml(
  html: string,
  sourceUrl: string,
  openaiApiKey: string
): Promise<{ success: boolean; item: NormalizedOpportunity | null; error?: string }> {
  console.log(`[multi-source] Extracting opportunity data from HTML (${html.length} chars)`);

  // Truncate HTML if too long
  const maxChars = 50000;
  const truncatedHtml = html.length > maxChars ? html.substring(0, maxChars) : html;

  const systemPrompt = `You are an expert at extracting government contracting opportunity information from web pages.
Extract the following fields from the HTML content:
- title: The opportunity title/name
- description: The full description or synopsis
- agency: The issuing agency/department
- due_date: Response deadline (ISO8601 format if possible)
- posted_date: When it was posted (ISO8601 format if possible)
- notice_id: Notice ID or solicitation number
- naics: NAICS code
- type: Notice type (e.g., Solicitation, Sources Sought)
- set_aside: Set-aside type (e.g., Small Business, 8(a))

Return ONLY valid JSON with these fields. Use null for fields you cannot find.`;

  const userPrompt = `Extract opportunity information from this page (${sourceUrl}):\n\n${truncatedHtml}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[multi-source] AI extraction error:', response.status, errorText);
      return { success: false, item: null, error: `AI error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, item: null, error: 'No AI response' };
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const extracted = JSON.parse(jsonStr);
    
    const item: NormalizedOpportunity = {
      title: extracted.title || 'Untitled Opportunity',
      synopsis: extracted.description || null,
      description: extracted.description || null,
      agency: extracted.agency || null,
      due_date: extracted.due_date || null,
      posted_date: extracted.posted_date || null,
      notice_id: extracted.notice_id || null,
      solicitation_number: extracted.notice_id || extracted.solicitation_number || null,
      external_url: sourceUrl,
      external_metadata: { 
        extracted_from_html: true,
        source_url: sourceUrl,
        extracted_at: new Date().toISOString(),
      },
      naics: extracted.naics || null,
      type: extracted.type || null,
      set_aside: extracted.set_aside || null,
    };

    console.log(`[multi-source] AI extracted: ${item.title}`);
    return { success: true, item };
  } catch (error) {
    console.error('[multi-source] AI extraction error:', error);
    return { success: false, item: null, error: String(error) };
  }
}
