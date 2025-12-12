import { v4 as uuidv4 } from 'uuid';
import queueManager from '../queue/QueueManager';
import taskHandlers from './taskHandlers';
import config from '../config';
import { Task, TaskType } from '../types';

export class Worker {
  public id: string;
  private isRunning: boolean;
  private currentTask: Task | null;
  private tasksProcessed: number;
  private pollInterval: number;
  private heartbeatInterval: NodeJS.Timeout | null;

  constructor(id?: string) {
    this.id = id || `worker-${uuidv4().slice(0, 8)}`;
    this.isRunning = false;
    this.currentTask = null;
    this.tasksProcessed = 0;
    this.pollInterval = config.worker.pollInterval;
    this.heartbeatInterval = null;
  }

  async start(): Promise<void> {
    console.log(`[Worker ${this.id}] Starting...`);

    queueManager.initialize();
    await queueManager.registerWorker(this.id, {
      pid: process.pid
    });

    this.isRunning = true;
    this.startHeartbeat();
    this.poll();

    console.log(`[Worker ${this.id}] Ready to process tasks`);
  }

  async stop(): Promise<void> {
    console.log(`[Worker ${this.id}] Stopping...`);
    this.isRunning = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    await queueManager.unregisterWorker(this.id);
    console.log(`[Worker ${this.id}] Stopped. Processed ${this.tasksProcessed} tasks.`);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        const status = this.currentTask ? 'busy' : 'idle';
        await queueManager.updateWorkerHeartbeat(
          this.id,
          status,
          this.currentTask?.id
        );
      } catch (error) {
        console.error(`[Worker ${this.id}] Heartbeat error:`, (error as Error).message);
      }
    }, 5000);
  }

  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        const task = await queueManager.getNextTask(this.id);

        if (task) {
          await this.processTask(task);
        } else {
          await this.sleep(this.pollInterval);
        }
      } catch (error) {
        console.error(`[Worker ${this.id}] Poll error:`, (error as Error).message);
        await this.sleep(1000);
      }
    }
  }

  private async processTask(task: Task): Promise<void> {
    this.currentTask = task;
    console.log(`[Worker ${this.id}] Processing task ${task.id} (${task.type})`);

    const startTime = Date.now();

    try {
      const handler = taskHandlers[task.type as TaskType] || taskHandlers['default'];
      const payload = typeof task.payload === 'string'
        ? JSON.parse(task.payload)
        : task.payload;

      const result = await handler(payload);

      await queueManager.completeTask(task.id, result);
      this.tasksProcessed++;

      const duration = Date.now() - startTime;
      console.log(`[Worker ${this.id}] Completed task ${task.id} in ${duration}ms`);

      await queueManager.incrementWorkerTaskCount(this.id);

      if (process.send) {
        process.send({
          type: 'task:completed',
          workerId: this.id,
          taskId: task.id,
          duration
        });
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Worker ${this.id}] Task ${task.id} failed after ${duration}ms:`, (error as Error).message);

      await queueManager.failTask(task.id, error as Error);

      if (process.send) {
        process.send({
          type: 'task:failed',
          workerId: this.id,
          taskId: task.id,
          error: (error as Error).message
        });
      }
    } finally {
      this.currentTask = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default Worker;
