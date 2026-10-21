import { Redis, type RedisOptions } from 'ioredis';

export type { Redis };

export function createRedis(url: string, options: RedisOptions = {}): Redis {
  return new Redis(url, { maxRetriesPerRequest: 2, ...options });
}
