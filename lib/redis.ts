import { createClient, RedisClientType, RedisFunctions, RedisModules, RedisScripts } from 'redis';
import { randomBytes } from 'crypto'; 

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
      return false;
    }
    const ttl = await redis.ttl(`session:${token}`);
    return ttl > 0;
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
          console.log(`Refreshed session for existing token: ${existingToken} for IP hash: ${hashedIp}`);
          return existingToken; 
        } else {
          console.log(`Found stale token ${existingToken} for IP hash ${hashedIp}. Creating new token.`);
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
    } else {
      console.log(`Registered new session token: ${newToken} (not linked to IP)`);
    }
    
    await multi.exec();
    return newToken; 

  } catch (error) {
    console.error("Error in registerSessionToken with IP hash:", error);
    return null;
  }
}

const MAX_REQUESTS_PER_SESSION = 600;

export async function incrementAndCheckRequestCount(token: string): Promise<{ allowed: boolean; currentCount: number }> {
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

    if (currentCount > MAX_REQUESTS_PER_SESSION) {
      return { allowed: false, currentCount };
    }
    return { allowed: true, currentCount };
  } catch (error) {
    console.error("Error incrementing or checking request count in Redis:", error);
    return { allowed: false, currentCount: -1 };
  }
}