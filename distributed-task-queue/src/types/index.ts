// Task Types
export type TaskPriority = 'high' | 'normal' | 'low';
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
export type TaskType = 'email' | 'image-processing' | 'data-analysis' | 'report-generation' |
                       'notification' | 'file-upload' | 'database-backup' | 'computation' | 'default';

export interface Task {
  id: string;
  type: TaskType;
  payload: Record<string, any>;
  priority: TaskPriority;
  status: TaskStatus;
  retries: number;
  maxRetries: number;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
  workerId?: string;
  lastError?: string;
  nextRetryAt?: number;
  result?: any;
}

export interface TaskCreateRequest {
  type: TaskType;
  payload?: Record<string, any>;
  priority?: TaskPriority;
  maxRetries?: number;
}

export interface TaskResult {
  success: boolean;
  message?: string;
  data?: any;
  processingTime?: string;
  error?: string;
}

// Worker Types
export interface Worker {
  id: string;
  status: 'idle' | 'busy';
  tasksProcessed: number;
  currentTask?: string;
  startedAt: number;
  lastHeartbeat: number;
  pid?: number;
}

// Queue Stats Types
export interface QueueStats {
  tasksCreated: number;
  pendingTasks: number;
  processingTasks: number;
  completedTasks: number;
  failedTasks: number;
  retriedTasks: number;
  avgProcessingTime: number;
  activeWorkers: number;
  queueLengths: {
    high: number;
    normal: number;
    low: number;
  };
  processingCount: number;
}

// Event Types
export type QueueEventType =
  | 'task:created'
  | 'task:processing'
  | 'task:completed'
  | 'task:failed'
  | 'task:retrying'
  | 'worker:registered'
  | 'worker:unregistered';

export interface TaskEventData {
  id?: string;
  type?: TaskType;
  priority?: TaskPriority;
  status?: TaskStatus;
  workerId?: string;
  retries?: number;
  maxRetries?: number;
  processingTime?: number;
  error?: string;
}

export interface QueueEvent {
  event: QueueEventType;
  task?: TaskEventData;
  worker?: Partial<Worker>;
  timestamp?: number;
}

// Config Types
export interface RedisConfig {
  host: string;
  port: number;
  password: string | null;
  db: number;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface WorkerConfig {
  count: number;
  pollInterval: number;
  maxRetries: number;
  retryDelay: number;
}

export interface QueueConfig {
  prefix: string;
  queues: {
    high: string;
    normal: string;
    low: string;
  };
  defaultPriority: TaskPriority;
}

export interface AppConfig {
  redis: RedisConfig;
  api: ServerConfig;
  dashboard: ServerConfig;
  worker: WorkerConfig;
  queue: QueueConfig;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  status?: number;
}

export interface TaskResponse {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  retries?: number;
  workerId?: string;
  result?: any;
  lastError?: string;
}
