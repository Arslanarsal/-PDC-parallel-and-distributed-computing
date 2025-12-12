import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import config from '../config';
import {
  Task,
  TaskCreateRequest,
  TaskPriority,
  QueueStats,
  Worker,
  QueueEvent,
  TaskEventData
} from '../types';

class QueueManager extends EventEmitter {
  private prefix: string;
  private queues: { high: string[]; normal: string[]; low: string[] };
  private processing: string[];
  private tasks: Map<string, Task>;
  private results: Map<string, any>;
  private workers: Map<string, Worker>;
  private stats: QueueStats;

  constructor() {
    super();
    this.prefix = config.queue.prefix;
    this.queues = {
      high: [],
      normal: [],
      low: []
    };
    this.processing = [];
    this.tasks = new Map();
    this.results = new Map();
    this.workers = new Map();
    this.stats = {
      tasksCreated: 0,
      pendingTasks: 0,
      processingTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      retriedTasks: 0,
      avgProcessingTime: 0,
      activeWorkers: 0,
      queueLengths: { high: 0, normal: 0, low: 0 },
      processingCount: 0
    };
  }

  initialize(): QueueManager {
    console.log('[QueueManager] Initialized in-memory queue');
    return this;
  }

  async addTask(taskData: TaskCreateRequest, priority: TaskPriority = 'normal'): Promise<Task> {
    const taskId = uuidv4();
    const task: Task = {
      id: taskId,
      type: taskData.type || 'default',
      payload: taskData.payload || {},
      priority,
      status: 'pending',
      retries: 0,
      maxRetries: taskData.maxRetries || config.worker.maxRetries,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.tasks.set(taskId, task);
    this.queues[priority].unshift(taskId);
    this.stats.tasksCreated++;
    this.stats.pendingTasks++;

    this.emitEvent('task:created', { task: { id: taskId, type: task.type, priority, status: 'pending' } });

    return task;
  }

  async getNextTask(workerId: string): Promise<Task | null> {
    const priorities: TaskPriority[] = ['high', 'normal', 'low'];

    for (const priority of priorities) {
      if (this.queues[priority].length > 0) {
        const taskId = this.queues[priority].pop();
        if (!taskId) continue;

        const task = this.tasks.get(taskId);
        if (task) {
          task.status = 'processing';
          task.workerId = workerId;
          task.startedAt = Date.now();
          task.updatedAt = Date.now();

          this.processing.push(taskId);
          this.stats.pendingTasks--;
          this.stats.processingTasks++;

          this.emitEvent('task:processing', { task: { id: taskId, workerId, type: task.type } });

          return { ...task };
        }
      }
    }

    return null;
  }

  async completeTask(taskId: string, result: any): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = 'completed';
    task.completedAt = Date.now();
    task.updatedAt = Date.now();

    this.results.set(taskId, result);

    const idx = this.processing.indexOf(taskId);
    if (idx > -1) this.processing.splice(idx, 1);

    this.stats.processingTasks--;
    this.stats.completedTasks++;

    const processingTime = task.completedAt - (task.startedAt || task.createdAt);
    this.updateAverageProcessingTime(processingTime);

    this.emitEvent('task:completed', { task: { id: taskId, type: task.type, processingTime } });

    return true;
  }

  async failTask(taskId: string, error: Error): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const idx = this.processing.indexOf(taskId);
    if (idx > -1) this.processing.splice(idx, 1);
    this.stats.processingTasks--;

    if (task.retries < task.maxRetries) {
      const retryDelay = config.worker.retryDelay * Math.pow(2, task.retries);
      task.status = 'retrying';
      task.retries++;
      task.lastError = error.message;
      task.nextRetryAt = Date.now() + retryDelay;
      task.updatedAt = Date.now();

      setTimeout(() => {
        this.queues[task.priority].unshift(taskId);
        task.status = 'pending';
        task.updatedAt = Date.now();
        this.stats.pendingTasks++;
        this.stats.retriedTasks++;

        this.emitEvent('task:retrying', { task: { id: taskId, retries: task.retries, maxRetries: task.maxRetries } });
      }, retryDelay);

    } else {
      task.status = 'failed';
      task.failedAt = Date.now();
      task.lastError = error.message;
      task.updatedAt = Date.now();

      this.stats.failedTasks++;
      this.emitEvent('task:failed', { task: { id: taskId, type: task.type, error: error.message } });
    }

    return true;
  }

  async getTaskStatus(taskId: string): Promise<Task | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const taskCopy = { ...task };
    if (task.status === 'completed') {
      taskCopy.result = this.results.get(taskId);
    }

    return taskCopy;
  }

  async getQueueStats(): Promise<QueueStats> {
    return {
      ...this.stats,
      queueLengths: {
        high: this.queues.high.length,
        normal: this.queues.normal.length,
        low: this.queues.low.length
      },
      processingCount: this.processing.length
    };
  }

  async registerWorker(workerId: string, info: Partial<Worker> = {}): Promise<void> {
    const worker: Worker = {
      id: workerId,
      status: 'idle',
      tasksProcessed: 0,
      startedAt: Date.now(),
      lastHeartbeat: Date.now(),
      ...info
    };
    this.workers.set(workerId, worker);
    this.stats.activeWorkers++;
    this.emitEvent('worker:registered', { worker: { id: workerId } });
  }

  async updateWorkerHeartbeat(workerId: string, status: 'idle' | 'busy' = 'idle', currentTask?: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.status = status;
      worker.currentTask = currentTask || '';
      worker.lastHeartbeat = Date.now();
    }
  }

  async incrementWorkerTaskCount(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.tasksProcessed++;
    }
  }

  async unregisterWorker(workerId: string): Promise<void> {
    this.workers.delete(workerId);
    this.stats.activeWorkers--;
    this.emitEvent('worker:unregistered', { worker: { id: workerId } });
  }

  async getActiveWorkers(): Promise<Worker[]> {
    return Array.from(this.workers.values());
  }

  private updateAverageProcessingTime(newTime: number): void {
    const completed = this.stats.completedTasks || 1;
    const currentAvg = this.stats.avgProcessingTime || 0;
    this.stats.avgProcessingTime = ((currentAvg * (completed - 1)) + newTime) / completed;
  }

  private emitEvent(event: string, data: Partial<QueueEvent>): void {
    this.emit('queue:event', { event, ...data, timestamp: Date.now() });
  }

  async clearAll(): Promise<void> {
    this.queues = { high: [], normal: [], low: [] };
    this.processing = [];
    this.tasks.clear();
    this.results.clear();
    this.stats = {
      tasksCreated: 0,
      pendingTasks: 0,
      processingTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      retriedTasks: 0,
      avgProcessingTime: 0,
      activeWorkers: this.workers.size,
      queueLengths: { high: 0, normal: 0, low: 0 },
      processingCount: 0
    };
  }
}

export const queueManager = new QueueManager();
export default queueManager;
