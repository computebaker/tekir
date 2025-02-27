let bangsCache: Record<string, {name: string, url: string}> | null = null;
const BANGS_CACHE_KEY = 'tekir_bangs_cache';
const BANGS_CACHE_EXPIRY_KEY = 'tekir_bangs_cache_expiry';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

/**
 * Prefetch the bangs data and store it in memory and localStorage
 * This should be called when the application initializes
 */
export async function prefetchBangs(): Promise<void> {
  // Check if we already have bangs in memory
  if (bangsCache) return;
  
  // Check if we have a valid cache in localStorage
  if (typeof window !== 'undefined') {
    const cachedBangs = localStorage.getItem(BANGS_CACHE_KEY);
    const cacheExpiry = localStorage.getItem(BANGS_CACHE_EXPIRY_KEY);
    
    if (cachedBangs && cacheExpiry) {
      const expiryDate = parseInt(cacheExpiry, 10);
      // If the cache hasn't expired, use it
      if (Date.now() < expiryDate) {
        try {
          bangsCache = JSON.parse(cachedBangs);
          return;
        } catch (e) {
          console.warn('Failed to parse cached bangs', e);
          // Continue to fetch if parsing fails
        }
      }
    }
  }
  
  // Fetch and cache the bangs
  await refreshBangsCache();
}

/**
 * Fetch the latest bangs data and update both memory and localStorage
 */
async function refreshBangsCache(): Promise<void> {
  try {
    const response = await fetch('/bangs.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch bangs: ${response.statusText}`);
    }
    
    bangsCache = await response.json();
    
    // Update localStorage cache
    if (typeof window !== 'undefined') {
      localStorage.setItem(BANGS_CACHE_KEY, JSON.stringify(bangsCache));
      localStorage.setItem(BANGS_CACHE_EXPIRY_KEY, (Date.now() + CACHE_TTL).toString());
    }
  } catch (err) {
    console.error('Error refreshing bangs cache:', err);
    // If we fail to fetch, we'll try to use any existing cache
    if (!bangsCache && typeof window !== 'undefined') {
      const cachedBangs = localStorage.getItem(BANGS_CACHE_KEY);
      if (cachedBangs) {
        try {
          bangsCache = JSON.parse(cachedBangs);
        } catch (e) {
          console.error('Failed to use backup cached bangs', e);
        }
      }
    }
  }
}

export async function handleBangRedirect(query: string): Promise<boolean> {
  // Ensure bangs are loaded
  if (!bangsCache) {
    await prefetchBangs();
  }
  
  // Check if it's a pure bang command (starts with !)
  const bangMatch = query.match(/^(![\w]+)(?:\s+(.*))?$/);
  
  // Check if it contains an embedded bang (anywhere in the query)
  const embeddedBangMatch = bangMatch ? null : query.match(/(?:^|\s)(![a-z]+)(?:\s+(.*))?/i);
  
  if (!bangMatch && !embeddedBangMatch) {
    return false; // No bang found
  }
  
  // Use the appropriate match pattern
  const matchToUse = bangMatch || embeddedBangMatch;
  if (!matchToUse) return false;
  
  let bangCommand = matchToUse[1];
  let searchTerms = '';
  
  if (bangMatch) {
    // If it's a pure bang command, the search terms follow the bang
    searchTerms = matchToUse[2] ? matchToUse[2].trim() : '';
  } else if (embeddedBangMatch) {
    // If it's an embedded bang, we use everything except the bang as search terms
    const beforeBang = query.substring(0, query.indexOf(bangCommand)).trim();
    const afterBang = matchToUse[2] ? matchToUse[2].trim() : '';
    searchTerms = (beforeBang + ' ' + afterBang).trim();
  }
  
  // If bangs still aren't loaded (unlikely after the earlier check), try again
  if (!bangsCache) {
    try {
      await refreshBangsCache();
    } catch (err) {
      console.error('Failed to load bangs after retry:', err);
      return false;
    }
  }
  
  // Find matching bang
  const bang = bangsCache ? bangsCache[bangCommand] : undefined;
  
  if (bang) {
    const encodedTerms = encodeURIComponent(searchTerms);
    const redirectUrl = bang.url.replace('{search}', encodedTerms);
    window.location.href = redirectUrl;
    return true;
  }
  
  return false; // No matching bang found
}
