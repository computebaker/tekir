/**
 * Browser fingerprinting and User Agent analysis for anti-abuse CAPTCHA system
 * Detects bots, suspicious patterns, and fake user agents
 */

export interface BrowserFingerprint {
  userAgent: string;
  headers: Record<string, string | undefined>;
  suspiciousPatterns: string[];
  riskScore: number; // 0-100
  isLikelyBot: boolean;
  reasons: string[];
}

// Common bot/crawler user agent patterns
const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /curl/i,
  /wget/i,
  /python/i,
  /java(?!script)/i,
  /perl/i,
  /ruby/i,
  /php/i,
  /go-http-client/i,
  /requests/i,
  /httpx/i,
  /scrapy/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /phantomjs/i,
  /headless/i,
  /chrome-lighthouse/i,
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baidu/i,
  /yandex/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegram/i,
  /applebot/i,
  /shodan/i,
  /masscan/i,
  /nmap/i,
];

// Expected headers for legitimate browsers
const REQUIRED_BROWSER_HEADERS = [
  'accept-language',
  'accept-encoding',
  'accept',
];

// Suspicious header combinations
const SUSPICIOUS_PATTERNS_MAP = [
  {
    check: (ua: string, headers: Record<string, string | undefined>) =>
      ua.includes('Mozilla') && !headers['accept-language'],
    reason: 'Real Mozilla browsers should have accept-language',
  },
  {
    check: (ua: string, headers: Record<string, string | undefined>) =>
      ua.includes('Chrome') && !headers['sec-ch-ua'],
      reason: 'Chrome browsers should include sec-ch-ua header',
  },
  {
    check: (ua: string, headers: Record<string, string | undefined>) =>
      ua.includes('Safari') && ua.includes('Chrome'),
      reason: 'User agent claims both Safari and Chrome',
  },
  {
    check: (ua: string, headers: Record<string, string | undefined>) =>
      ua.includes('Firefox') && headers['sec-ch-ua'],
      reason: 'Firefox should not have sec-ch-ua header',
  },
  {
    check: (ua: string, headers: Record<string, string | undefined>) =>
      !ua || ua.length === 0,
      reason: 'Empty user agent',
  },
  {
    check: (ua: string, headers: Record<string, string | undefined>) =>
      ua.length > 500,
      reason: 'Unusually long user agent string',
  },
  {
    check: (ua: string, headers: Record<string, string | undefined>) =>
      !headers['user-agent'] && ua,
      reason: 'User agent mismatch between sources',
  },
  {
    check: (ua: string, headers: Record<string, string | undefined>) =>
      !headers['sec-fetch-site'] && ua.includes('Mozilla'),
      reason: 'Modern browsers should include sec-fetch-site header',
  },
  {
    check: (ua: string, headers: Record<string, string | undefined>) =>
      headers['x-forwarded-for'] && !headers['cf-connecting-ip'] && !headers['x-real-ip'],
      reason: 'Suspicious proxy/VPN pattern',
  },
];

/**
 * Analyzes a request's user agent and headers to determine if it's likely a bot
 */
export function analyzeFingerprint(
  userAgent: string,
  headersInput: Record<string, string | undefined> = {},
): BrowserFingerprint {
  // Normalize header keys to lowercase for comparison
  const headers = Object.entries(headersInput).reduce(
    (acc, [key, value]) => {
      acc[key.toLowerCase()] = value;
      return acc;
    },
    {} as Record<string, string | undefined>,
  );

  const suspiciousPatterns: string[] = [];
  let riskScore = 0;

  // Check for known bot patterns
  const isBotUA = BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
  if (isBotUA) {
    suspiciousPatterns.push('Known bot user agent detected');
    // Treat known bot UAs as high confidence and push over hard threshold
    riskScore += 70;
  }

  // Check suspicious pattern combinations
  for (const pattern of SUSPICIOUS_PATTERNS_MAP) {
    if (pattern.check(userAgent, headers)) {
      suspiciousPatterns.push(pattern.reason);
      riskScore += 15;
    }
  }

  // Check for missing common browser headers
  const missingHeaders = REQUIRED_BROWSER_HEADERS.filter(
    (header) => !headers[header],
  );
  if (missingHeaders.length > 1) {
    suspiciousPatterns.push(
      `Missing headers: ${missingHeaders.join(', ')}`,
    );
    riskScore += 20;
  }

  // Check for VPN/Proxy indicators
  const vpnIndicators = [
    'x-forwarded-for',
    'x-forwarded-host',
    'x-proxy-authorization',
    'via',
    'x-via',
  ];
  const vpnCount = vpnIndicators.filter((header) => headers[header]).length;
  if (vpnCount > 2) {
    suspiciousPatterns.push('Multiple VPN/proxy indicators detected');
    riskScore += 25;
  }

  // Check for CloudFlare (legitimate but worth noting)
  if (headers['cf-ray'] || headers['cf-connecting-ip']) {
    suspiciousPatterns.push('CloudFlare detected (legitimate but monitored)');
    // Don't add risk, CloudFlare is legitimate
  }

  // Clamp risk score to 0-100
  riskScore = Math.min(100, Math.max(0, riskScore));

  return {
    userAgent,
    headers,
    suspiciousPatterns,
    riskScore,
    isLikelyBot: isBotUA || riskScore >= 40,
    reasons: suspiciousPatterns,
  };
}

/**
 * Determines if a request should be challenged based on risk level
 * Uses a tiered approach with different thresholds
 */
export function shouldChallenge(
  fingerprint: BrowserFingerprint,
  options: {
    hardThreshold?: number; // Always challenge
    softThreshold?: number; // Challenge with some variance
    rateLimit?: boolean; // Apply stricter rules
  } = {},
): { shouldChallenge: boolean; reason: string; severity: 'low' | 'medium' | 'high' } {
  const hardThreshold = options.hardThreshold ?? 60;
  const softThreshold = options.softThreshold ?? 40;

  // If likely bot, always challenge
  if (fingerprint.isLikelyBot) {
    return {
      shouldChallenge: true,
      reason: 'Known bot patterns detected',
      severity: 'high',
    };
  }

  // Hard threshold - always challenge
  if (fingerprint.riskScore >= hardThreshold) {
    return {
      shouldChallenge: true,
      reason: `Risk score ${fingerprint.riskScore} exceeds hard threshold`,
      severity: 'high',
    };
  }

  // Soft threshold - challenge with variance (simulates natural variance)
  if (fingerprint.riskScore >= softThreshold) {
    // Add some randomness: more likely to challenge as risk increases
    const variance = (fingerprint.riskScore - softThreshold) / (hardThreshold - softThreshold);
    const shouldRandomlyChallenge = Math.random() < variance;

    if (shouldRandomlyChallenge) {
      return {
        shouldChallenge: true,
        reason: `Risk score ${fingerprint.riskScore} warrants additional verification`,
        severity: 'medium',
      };
    }
  }

  return {
    shouldChallenge: false,
    reason: 'Risk assessment passed',
    severity: 'low',
  };
}

/**
 * Creates a challenge token payload that can be used to verify
 * if the client properly loads and executes JavaScript/CSS
 */
export interface ChallengePayload {
  id: string;
  timestamp: number;
  fingerprint: BrowserFingerprint;
  jsLoaded: boolean;
  cssLoaded: boolean;
  requiredResources: {
    js: string;
    css: string;
  };
}

export function generateChallengePayload(
  fingerprint: BrowserFingerprint,
): ChallengePayload {
  return {
    id: generateChallengeId(),
    timestamp: Date.now(),
    fingerprint,
    jsLoaded: false,
    cssLoaded: false,
    requiredResources: {
      js: `/captcha/resources/${generateChallengeId()}.js`,
      css: `/captcha/resources/${generateChallengeId()}.css`,
    },
  };
}

export function generateChallengeId(): string {
  return `challenge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Rates the severity of a bot detection
 */
export function rateAbuseRisk(
  fingerprint: BrowserFingerprint,
): {
  isAbuser: boolean;
  confidence: number;
  pattern: string;
} {
  // High confidence bot detection
  if (fingerprint.riskScore >= 70) {
    return {
      isAbuser: true,
      confidence: fingerprint.riskScore / 100,
      pattern: fingerprint.reasons.join('; '),
    };
  }

  // Medium confidence
  if (fingerprint.riskScore >= 50) {
    return {
      isAbuser: fingerprint.isLikelyBot,
      confidence: fingerprint.riskScore / 100,
      pattern: fingerprint.reasons.join('; '),
    };
  }

  return {
    isAbuser: false,
    confidence: 0,
    pattern: 'Clean',
  };
}
