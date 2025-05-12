import { createClient, RedisClientType, RedisFunctions, RedisModules, RedisScripts } from 'redis';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.warn("REDIS_URL environment variable is not set. Session functionality will be limited.");
}

let redis: RedisClientType<RedisModules, RedisFunctions, RedisScripts> | null = null;

if (redisUrl) {
  try {
    redis = createClient({
      username: process.env.REDIS_USERNAME,
      password: process.env.REDIS_PASSWORD,
      socket: { 
        host: process.env.REDIS_URL,
        port: 19485
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

export const isRedisConfigured = !!redisUrl && !!redis;

export async function isValidSessionToken(token: string): Promise<boolean> {
  if (!isRedisConfigured || !redis) {
    console.warn("Redis is not configured or not connected. Cannot validate session token.");
    return true; // Or false, based on policy
  }
  try {
    const result = await redis.exists(`session:${token}`);
    return result === 1;
  } catch (error) {
    console.error("Error validating session token in Redis:", error);
    return false;
  }
}

export async function registerSessionToken(token: string, expirationInSeconds: number = 24 * 60 * 60): Promise<boolean> {
  if (!isRedisConfigured || !redis) {
    console.warn("Redis is not configured or not connected. Cannot register session token.");
    return false;
  }
  try {
    const multi = redis.multi();
    multi.setEx(`session:${token}`, expirationInSeconds, "active");
    multi.setEx(`session_requests:${token}`, expirationInSeconds, "0");
    await multi.exec();
    return true;
  } catch (error) {
    console.error("Error registering session token or initializing request count in Redis:", error);
    return false;
  }
}

const MAX_REQUESTS_PER_SESSION = 600;

export async function incrementAndCheckRequestCount(token: string): Promise<{ allowed: boolean; currentCount: number }> {
  if (!isRedisConfigured || !redis) {
    console.warn("Redis is not configured or not connected. Cannot check request count.");
    return { allowed: true, currentCount: 0 };
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