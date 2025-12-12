import cluster from 'cluster';
import os from 'os';
import config from '../config';
import Worker from './Worker';

interface WorkerInfo {
  index: number;
  pid: number;
  startedAt: number;
  tasksCompleted: number;
  tasksFailed: number;
}

const numWorkers = config.worker.count || os.cpus().length;

if (cluster.isPrimary) {
  console.log('='.repeat(50));
  console.log('  DISTRIBUTED TASK QUEUE - WORKER CLUSTER');
  console.log('='.repeat(50));
  console.log(`[Master ${process.pid}] Starting cluster with ${numWorkers} workers`);
  console.log(`[Master ${process.pid}] CPU cores available: ${os.cpus().length}`);
  console.log('='.repeat(50));

  const workers = new Map<number, WorkerInfo>();
  let totalTasksCompleted = 0;
  let totalTasksFailed = 0;

  function spawnWorker(index: number): void {
    const worker = cluster.fork({
      WORKER_ID: `worker-${index + 1}`
    });

    workers.set(worker.id, {
      index,
      pid: worker.process?.pid || 0,
      startedAt: Date.now(),
      tasksCompleted: 0,
      tasksFailed: 0
    });

    console.log(`[Master] Worker ${index + 1} spawned (PID: ${worker.process?.pid})`);

    worker.on('message', (msg: { type: string; workerId: string; taskId: string }) => {
      if (msg.type === 'task:completed') {
        totalTasksCompleted++;
        const workerInfo = workers.get(worker.id);
        if (workerInfo) {
          workerInfo.tasksCompleted++;
        }
      } else if (msg.type === 'task:failed') {
        totalTasksFailed++;
        const workerInfo = workers.get(worker.id);
        if (workerInfo) {
          workerInfo.tasksFailed++;
        }
      }
    });

    worker.on('exit', (code, signal) => {
      const workerInfo = workers.get(worker.id);
      workers.delete(worker.id);

      if (signal) {
        console.log(`[Master] Worker ${(workerInfo?.index || 0) + 1} killed by signal: ${signal}`);
      } else if (code !== 0) {
        console.log(`[Master] Worker ${(workerInfo?.index || 0) + 1} exited with code: ${code}`);
      }

      if (workerInfo) {
        console.log(`[Master] Restarting worker ${workerInfo.index + 1}...`);
        setTimeout(() => spawnWorker(workerInfo.index), 1000);
      }
    });
  }

  for (let i = 0; i < numWorkers; i++) {
    spawnWorker(i);
  }

  cluster.on('online', (worker) => {
    console.log(`[Master] Worker ${worker.id} is online`);
  });

  const statsInterval = setInterval(() => {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    console.log('\n--- Cluster Statistics ---');
    console.log(`Uptime: ${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`);
    console.log(`Active Workers: ${workers.size}/${numWorkers}`);
    console.log(`Tasks Completed: ${totalTasksCompleted}`);
    console.log(`Tasks Failed: ${totalTasksFailed}`);
    console.log(`Memory (Master): ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    console.log('-'.repeat(26) + '\n');
  }, 30000);

  async function gracefulShutdown(): Promise<void> {
    console.log('\n[Master] Graceful shutdown initiated...');
    clearInterval(statsInterval);

    const shutdownTimeout = setTimeout(() => {
      console.log('[Master] Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);

    for (const [id] of workers) {
      const worker = cluster.workers?.[id];
      if (worker) {
        const workerInfo = workers.get(id);
        console.log(`[Master] Stopping worker ${(workerInfo?.index || 0) + 1}...`);
        worker.kill('SIGTERM');
      }
    }

    const checkInterval = setInterval(() => {
      if (workers.size === 0) {
        clearInterval(checkInterval);
        clearTimeout(shutdownTimeout);
        console.log('[Master] All workers stopped. Exiting.');
        console.log(`[Master] Final Stats - Completed: ${totalTasksCompleted}, Failed: ${totalTasksFailed}`);
        process.exit(0);
      }
    }, 100);
  }

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

} else {
  const worker = new Worker(process.env.WORKER_ID);

  process.on('SIGTERM', async () => {
    await worker.stop();
    process.exit(0);
  });

  worker.start().catch(error => {
    console.error(`[Worker ${process.env.WORKER_ID}] Startup failed:`, error);
    process.exit(1);
  });
}
