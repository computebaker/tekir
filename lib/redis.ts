import { createClient, RedisClientType, RedisFunctions, RedisModules, RedisScripts } from 'redis';
import { randomBytes } from 'crypto';

interface CachedSession {
  isValid: boolean;
  requestCount: number;
  lastUpdated: number;
  expiresAt: number;
}

interface MemoryCache {
  sessions: Map<string, CachedSession>;
  ipTokens: Map<string, { token: string; expiresAt: number }>;
}

const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes
const memoryCache: MemoryCache = {
  sessions: new Map(),
  ipTokens: new Map()
};

function cleanExpiredCache() {
  const now = Date.now();
  
  memoryCache.sessions.forEach((session, token) => {
    if (session.expiresAt < now) {
      memoryCache.sessions.delete(token);
    }
  });
  
  memoryCache.ipTokens.forEach((data, ip) => {
    if (data.expiresAt < now) {
      memoryCache.ipTokens.delete(ip);
    }
  });
} 

const redisUsername = process.env.REDIS_USERNAME;
const redisPassword = process.env.REDIS_PASSWORD;
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined;

if (!redisUsername || !redisPassword || !redisHost || !redisPort) {
  console.warn("Redis environment variables (REDIS_USERNAME, REDIS_PASSWORD, REDIS_HOST, REDIS_PORT) are not fully set. Session functionality will be limited.");
}

let redis: RedisClientType<RedisModules, RedisFunctions, RedisScripts> | null = null;

if (redisUsername && redisPassword && redisHost && redisPort) {
  try {
    redis = createClient({
      username: redisUsername,
      password: redisPassword,
      socket: {
        host: redisHost,
        port: redisPort,
      },
    });

    redis.on('connect', () => {
      console.log('Connecting to Redis...');
    });

    redis.on('ready', () => {
      console.log('Connected to Redis and ready to use.');
    });

    redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redis.connect().catch(err => {
      console.error('Failed to connect to Redis on startup:', err);
      redis = null;
    });

  } catch (error) {
    console.error("Failed to create Redis client:", error);
    redis = null;
  }
}

export default redis;

export const isRedisConfigured = !!redisUsername && !!redisPassword && !!redisHost && !!redisPort && !!redis;

export async function isValidSessionToken(token: string): Promise<boolean> {
  cleanExpiredCache();
  const cached = memoryCache.sessions.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.isValid;
  }

  if (!redis) {
    console.warn("Redis client is not initialized. Cannot validate session token.");
    return false;
  }
  if (!redis.isOpen) {
    try {
      await redis.connect();
    } catch (err) {
      console.error("Redis reconnection failed:", err);
      return false;
    }
  }
  try {
    const exists = await redis.exists(`session:${token}`);
    if (exists !== 1) {
      memoryCache.sessions.set(token, {
        isValid: false,
        requestCount: 0,
        lastUpdated: Date.now(),
        expiresAt: Date.now() + (CACHE_TTL_MS / 2)
      });
      return false;
    }
    const ttl = await redis.ttl(`session:${token}`);
    const isValid = ttl > 0;
    
    memoryCache.sessions.set(token, {
      isValid,
      requestCount: cached?.requestCount || 0, 
      lastUpdated: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS
    });
    
    return isValid;
  } catch (error) {
    console.error("Error validating session token in Redis:", error);
    return false;
  }
}

export async function registerSessionToken(
  hashedIp: string | null, 
  expirationInSeconds: number = 24 * 60 * 60
): Promise<string | null> { 
  if (!isRedisConfigured || !redis) {
    console.warn("Redis is not configured or not connected. Cannot register session token.");
    return null;
  }

  try {
    if (hashedIp) {
      cleanExpiredCache();
      const cachedIpData = memoryCache.ipTokens.get(hashedIp);
      if (cachedIpData && cachedIpData.expiresAt > Date.now()) {
        const cachedSession = memoryCache.sessions.get(cachedIpData.token);
        if (cachedSession && cachedSession.isValid && cachedSession.expiresAt > Date.now()) {
          return cachedIpData.token;
        }
      }

      const ipSessionKey = `ip_session:${hashedIp}`;
      const existingToken = await redis.get(ipSessionKey);

      if (existingToken) {
        const sessionKey = `session:${existingToken}`;
        if (await redis.exists(sessionKey)) {
          const multi = redis.multi();
          multi.expire(sessionKey, expirationInSeconds);
          multi.expire(ipSessionKey, expirationInSeconds);
          
          const sessionRequestsKey = `session_requests:${existingToken}`;
          if (await redis.exists(sessionRequestsKey)) {
              multi.expire(sessionRequestsKey, expirationInSeconds);
          } else {
              multi.setEx(sessionRequestsKey, expirationInSeconds, "0");
          }
          
          await multi.exec();
          
          memoryCache.sessions.set(existingToken, {
            isValid: true,
            requestCount: 0,
            lastUpdated: Date.now(),
            expiresAt: Date.now() + CACHE_TTL_MS
          });
          
          memoryCache.ipTokens.set(hashedIp, {
            token: existingToken,
            expiresAt: Date.now() + CACHE_TTL_MS
          });
          
          return existingToken; 
        } 
      }
    }

    const newToken = randomBytes(32).toString('hex');
    const newSessionKey = `session:${newToken}`;
    const newSessionRequestsKey = `session_requests:${newToken}`;

    const multi = redis.multi();
    multi.setEx(newSessionKey, expirationInSeconds, "active"); 
    multi.setEx(newSessionRequestsKey, expirationInSeconds, "0"); 

    if (hashedIp) {
      const ipSessionKey = `ip_session:${hashedIp}`; 
      multi.setEx(ipSessionKey, expirationInSeconds, newToken); 
      console.log(`Registered new session token: ${newToken} and linked to IP hash: ${hashedIp}`);
      
      memoryCache.ipTokens.set(hashedIp, {
        token: newToken,
        expiresAt: Date.now() + CACHE_TTL_MS
      });
    } else {
      console.log(`Registered new session token: ${newToken} (not linked to IP)`);
    }
    
    await multi.exec();
    
    memoryCache.sessions.set(newToken, {
      isValid: true,
      requestCount: 0,
      lastUpdated: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS
    });
    
    return newToken; 

  } catch (error) {
    console.error("Error in registerSessionToken with IP hash:", error);
    return null;
  }
}

const MAX_REQUESTS_PER_SESSION = 600;

export async function incrementAndCheckRequestCount(token: string): Promise<{ allowed: boolean; currentCount: number }> {
  cleanExpiredCache();
  const cached = memoryCache.sessions.get(token);
  
  if (cached && cached.expiresAt > Date.now()) {
    const timeSinceLastUpdate = Date.now() - cached.lastUpdated;
    
    if (timeSinceLastUpdate < 60000 && cached.requestCount < MAX_REQUESTS_PER_SESSION) {
      cached.requestCount++;
      cached.lastUpdated = Date.now();
      return { allowed: cached.requestCount <= MAX_REQUESTS_PER_SESSION, currentCount: cached.requestCount };
    }
  }

  if (!redis) {
    console.warn("Redis client is not initialized. Cannot check request count.");
    return { allowed: false, currentCount: 0 };
  }
  if (!redis.isOpen) {
    try {
      await redis.connect();
    } catch (err) {
      console.error("Redis reconnection failed:", err);
      return { allowed: false, currentCount: 0 };
    }
  }
  try {
    const countKey = `session_requests:${token}`;
    const currentCount = await redis.incr(countKey);

    const sessionTTL = await redis.ttl(`session:${token}`);
    if (sessionTTL > 0) {
      await redis.expire(countKey, sessionTTL);
    } else if (sessionTTL === -1) {
      await redis.expire(countKey, 24 * 60 * 60);
    } else {
      return { allowed: false, currentCount };
    }

    memoryCache.sessions.set(token, {
      isValid: cached?.isValid ?? true,
      requestCount: currentCount,
      lastUpdated: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    if (currentCount > MAX_REQUESTS_PER_SESSION) {
      return { allowed: false, currentCount };
    }
    return { allowed: true, currentCount };
  } catch (error) {
    console.error("Error incrementing or checking request count in Redis:", error);
    return { allowed: false, currentCount: -1 };
  }
}