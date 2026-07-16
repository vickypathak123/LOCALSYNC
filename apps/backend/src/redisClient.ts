import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});

export async function connectRedis(): Promise<void> {
  await redisClient.connect();
  console.log(`[redis] connected successfully to ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
}

export default redisClient;
