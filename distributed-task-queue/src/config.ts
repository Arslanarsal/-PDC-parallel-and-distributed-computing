import dotenv from 'dotenv';
import os from 'os';
import { AppConfig } from './types';

dotenv.config();

const config: AppConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || null,
    db: parseInt(process.env.REDIS_DB || '0')
  },
  api: {
    port: parseInt(process.env.API_PORT || '3000'),
    host: process.env.API_HOST || 'localhost'
  },
  dashboard: {
    port: parseInt(process.env.DASHBOARD_PORT || '3001'),
    host: process.env.DASHBOARD_HOST || 'localhost'
  },
  worker: {
    count: parseInt(process.env.WORKER_COUNT || String(os.cpus().length)),
    pollInterval: parseInt(process.env.POLL_INTERVAL || '100'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.RETRY_DELAY || '1000')
  },
  queue: {
    prefix: 'dtq:',
    queues: {
      high: 'high-priority',
      normal: 'normal-priority',
      low: 'low-priority'
    },
    defaultPriority: 'normal'
  }
};

export default config;
