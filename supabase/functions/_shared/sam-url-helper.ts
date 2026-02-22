/**
 * SAM.gov URL Helper
 * 
 * Validates and normalizes SAM.gov opportunity URLs
 * Provides fallback search URLs when direct links fail
 */

/**
 * Extract Notice ID from various SAM.gov URL formats
 */
export function extractNoticeId(url: string): string | null {
  if (!url) return null;
  
  // Pattern 1: https://sam.gov/opp/{noticeId}
  const pattern1 = url.match(/sam\.gov\/opp\/([a-f0-9-]+)/i);
  if (pattern1) return pattern1[1];
  
  // Pattern 2: https://sam.gov/workspace/contract/opp/{noticeId}/view
  const pattern2 = url.match(/sam\.gov\/workspace\/contract\/opp\/([a-f0-9-]+)/i);
  if (pattern2) return pattern2[1];
  
  // Pattern 3: opportunityId parameter
  const pattern3 = url.match(/opportunityId=([a-f0-9-]+)/i);
  if (pattern3) return pattern3[1];
  
  return null;
}

/**
 * Generate a valid SAM.gov opportunity URL from a notice ID
 */
export function buildSamUrl(noticeId: string): string {
  return `https://sam.gov/opp/${noticeId}/view`;
}

/**
 * Generate a SAM.gov search URL as fallback when direct link fails
 */
export function buildSamSearchUrl(params: {
  noticeId?: string;
  title?: string;
  agency?: string;
}): string {
  const searchParams = new URLSearchParams();
  searchParams.set('index', 'opp');
  searchParams.set('page', '1');
  searchParams.set('sort', '-relevance');
  
  // Build search query
  const queryParts: string[] = [];
  
  if (params.noticeId) {
    queryParts.push(params.noticeId);
  } else {
    if (params.title) {
      queryParts.push(params.title);
    }
    if (params.agency) {
      queryParts.push(params.agency);
    }
  }
  
  if (queryParts.length > 0) {
    searchParams.set('q', queryParts.join(' '));
  }
  
  return `https://sam.gov/search/?${searchParams.toString()}`;
}

/**
 * Validate and normalize a SAM.gov URL
 * Returns a valid URL or a fallback search URL
 */
export function normalizeSamUrl(
  url: string | null | undefined,
  fallbackParams: {
    noticeId?: string;
    title?: string;
    agency?: string;
  }
): string {
  // If no URL, return search fallback
  if (!url || url === 'Not_Available') {
    return buildSamSearchUrl(fallbackParams);
  }
  
  // Try to extract notice ID and rebuild URL
  const noticeId = extractNoticeId(url);
  
  if (noticeId) {
    return buildSamUrl(noticeId);
  }
  
  // If we can't parse it, return search fallback
  return buildSamSearchUrl(fallbackParams);
}
