import cluster from 'cluster';
import { fork } from 'child_process';
import os from 'os';
import config from './config';
import Worker from './workers/Worker';

const numWorkers = config.worker.count || os.cpus().length;

console.log('='.repeat(60));
console.log('  DISTRIBUTED TASK QUEUE SYSTEM');
console.log('  Parallel & Distributed Computing Project');
console.log('='.repeat(60));
console.log();
console.log('Technology Stack:');
console.log('  - Node.js + TypeScript');
console.log('  - Express.js (API Server)');
console.log('  - Socket.io (Real-time Updates)');
console.log('  - Node.js Cluster (Worker Pool)');
console.log();
console.log('='.repeat(60));
console.log();

if (cluster.isPrimary) {
  console.log(`[Master] PID: ${process.pid}`);
  console.log(`[Master] CPU Cores: ${os.cpus().length}`);
  console.log(`[Master] Workers to spawn: ${numWorkers}`);
  console.log();

  // Start API Server in a separate process
  const apiProcess = fork('./src/api/server.ts', [], {
    execArgv: ['-r', 'ts-node/register'],
    stdio: 'inherit'
  });

  console.log(`[Master] API Server process started (PID: ${apiProcess.pid})`);

  // Spawn workers
  const workers = new Map<number, { index: number; pid: number }>();

  for (let i = 0; i < numWorkers; i++) {
    const worker = cluster.fork({
      WORKER_ID: `worker-${i + 1}`,
      WORKER_INDEX: String(i)
    });

    workers.set(worker.id, {
      index: i,
      pid: worker.process?.pid || 0
    });

    console.log(`[Master] Worker ${i + 1} started (PID: ${worker.process?.pid})`);
  }

  let shuttingDown = false;

  cluster.on('exit', (worker, code, signal) => {
    const workerInfo = workers.get(worker.id);
    workers.delete(worker.id);

    console.log(`[Master] Worker ${(workerInfo?.index || 0) + 1} died (${signal || code})`);

    if (!shuttingDown && workerInfo) {
      console.log(`[Master] Restarting worker ${workerInfo.index + 1}...`);
      setTimeout(() => {
        const newWorker = cluster.fork({
          WORKER_ID: `worker-${workerInfo.index + 1}`,
          WORKER_INDEX: String(workerInfo.index)
        });

        workers.set(newWorker.id, {
          index: workerInfo.index,
          pid: newWorker.process?.pid || 0
        });
      }, 1000);
    }
  });

  const shutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log('\n[Master] Initiating graceful shutdown...');

    apiProcess.kill('SIGTERM');

    for (const id in cluster.workers) {
      cluster.workers[id]?.kill('SIGTERM');
    }

    setTimeout(() => {
      console.log('[Master] Shutdown complete');
      process.exit(0);
    }, 5000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log();
  console.log('='.repeat(60));
  console.log('System is ready!');
  console.log('='.repeat(60));
  console.log();
  console.log('Access Points:');
  console.log(`  Dashboard & API: http://localhost:${config.api.port}`);
  console.log();
  console.log('Quick Test:');
  console.log(`  curl -X POST http://localhost:${config.api.port}/api/tasks \\`);
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"type": "email", "payload": {"to": "test@example.com"}}\'');
  console.log();
  console.log('Press Ctrl+C to stop all services');
  console.log('='.repeat(60));

} else {
  // Worker process
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
