import { createClient, RedisClientType, RedisFunctions, RedisModules, RedisScripts } from 'redis';
import { randomBytes } from 'crypto';

interface CachedSession {
  isValid: boolean;
  requestCount: number;
  lastUpdated: number;
  expiresAt: number;
  userId?: string; 
  requestLimit?: number; 
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
  expirationInSeconds: number = 24 * 60 * 60,
  userId: string | null = null
): Promise<string | null> { 
  if (!isRedisConfigured || !redis) {
    console.warn("Redis is not configured or not connected. Cannot register session token.");
    return null;
  }

  try {
    // If this is a user-linked session, check for existing user session first
    if (userId) {
      const userSessionKey = `user_session:${userId}`;
      const existingToken = await redis.get(userSessionKey);
      
      if (existingToken) {
        const sessionKey = `session:${existingToken}`;
        if (await redis.exists(sessionKey)) {
          // Extend existing user session
          const multi = redis.multi();
          multi.expire(sessionKey, expirationInSeconds);
          multi.expire(userSessionKey, expirationInSeconds);
          
          const sessionRequestsKey = `session_requests:${existingToken}`;
          if (await redis.exists(sessionRequestsKey)) {
            multi.expire(sessionRequestsKey, expirationInSeconds);
          } else {
            multi.setEx(sessionRequestsKey, expirationInSeconds, "0");
          }
          
          await multi.exec();
          
          // Update cache with user info and higher limit
          memoryCache.sessions.set(existingToken, {
            isValid: true,
            requestCount: 0,
            lastUpdated: Date.now(),
            expiresAt: Date.now() + CACHE_TTL_MS,
            userId: userId,
            requestLimit: 1200 // Higher limit for authenticated users
          });
          
          console.log(`Extended existing user session for user ${userId}: ${existingToken}`);
          return existingToken;
        }
      }
    }
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

    // Link session to user if userId provided
    if (userId) {
      const userSessionKey = `user_session:${userId}`;
      multi.setEx(userSessionKey, expirationInSeconds, newToken);
      console.log(`Registered new user session token: ${newToken} for user: ${userId}`);
    }

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
      expiresAt: Date.now() + CACHE_TTL_MS,
      userId: userId || undefined,
      requestLimit: userId ? 1200 : 600 // Higher limit for authenticated users
    });
    
    return newToken; 

  } catch (error) {
    console.error("Error in registerSessionToken with IP hash:", error);
    return null;
  }
}

const MAX_REQUESTS_PER_SESSION = 600; // Default for anonymous users
const MAX_REQUESTS_PER_USER_SESSION = 1200; // Higher limit for authenticated users

export async function incrementAndCheckRequestCount(token: string): Promise<{ allowed: boolean; currentCount: number }> {
  cleanExpiredCache();
  const cached = memoryCache.sessions.get(token);
  
  // Determine the request limit for this session
  let requestLimit = MAX_REQUESTS_PER_SESSION;
  if (cached?.requestLimit) {
    requestLimit = cached.requestLimit;
  } else if (cached?.userId) {
    requestLimit = MAX_REQUESTS_PER_USER_SESSION;
  }
  
  if (cached && cached.expiresAt > Date.now()) {
    const timeSinceLastUpdate = Date.now() - cached.lastUpdated;
    
    if (timeSinceLastUpdate < 60000 && cached.requestCount < requestLimit) {
      cached.requestCount++;
      cached.lastUpdated = Date.now();
      return { allowed: cached.requestCount <= requestLimit, currentCount: cached.requestCount };
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

    // Check if this session is linked to a user to determine the correct limit
    let sessionUserId = cached?.userId;
    if (!sessionUserId) {
      // Check Redis for user link if not in cache
      const sessionKeys = await redis.keys(`user_session:*`);
      for (const userKey of sessionKeys) {
        const userToken = await redis.get(userKey);
        if (userToken === token) {
          sessionUserId = userKey.replace('user_session:', '');
          requestLimit = MAX_REQUESTS_PER_USER_SESSION;
          break;
        }
      }
    }

    memoryCache.sessions.set(token, {
      isValid: cached?.isValid ?? true,
      requestCount: currentCount,
      lastUpdated: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS,
      userId: sessionUserId,
      requestLimit: requestLimit
    });

    if (currentCount > requestLimit) {
      return { allowed: false, currentCount };
    }
    return { allowed: true, currentCount };
  } catch (error) {
    console.error("Error incrementing or checking request count in Redis:", error);
    return { allowed: false, currentCount: -1 };
  }
}

export async function linkSessionToUser(token: string, userId: string): Promise<boolean> {
  if (!isRedisConfigured || !redis) {
    console.warn("Redis is not configured or not connected. Cannot link session to user.");
    return false;
  }

  try {
    if (!redis.isOpen) {
      await redis.connect();
    }

    const sessionKey = `session:${token}`;
    const sessionExists = await redis.exists(sessionKey);
    
    if (!sessionExists) {
      console.warn(`Session ${token} does not exist, cannot link to user ${userId}`);
      return false;
    }

    // Check if user already has a session
    const userSessionKey = `user_session:${userId}`;
    const existingUserToken = await redis.get(userSessionKey);
    
    if (existingUserToken && existingUserToken !== token) {
      // User already has a different session, remove the old one
      await redis.del(`session:${existingUserToken}`);
      await redis.del(`session_requests:${existingUserToken}`);
      memoryCache.sessions.delete(existingUserToken);
      console.log(`Removed old session ${existingUserToken} for user ${userId}`);
    }

    // Link the current session to the user
    const sessionTTL = await redis.ttl(sessionKey);
    const ttl = sessionTTL > 0 ? sessionTTL : 24 * 60 * 60;
    
    await redis.setEx(userSessionKey, ttl, token);
    
    // Update cache with user info and higher request limit
    const cached = memoryCache.sessions.get(token);
    memoryCache.sessions.set(token, {
      isValid: cached?.isValid ?? true,
      requestCount: cached?.requestCount ?? 0,
      lastUpdated: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS,
      userId: userId,
      requestLimit: MAX_REQUESTS_PER_USER_SESSION
    });

    console.log(`Successfully linked session ${token} to user ${userId} with upgraded limit`);
    return true;
  } catch (error) {
    console.error("Error linking session to user:", error);
    return false;
  }
}