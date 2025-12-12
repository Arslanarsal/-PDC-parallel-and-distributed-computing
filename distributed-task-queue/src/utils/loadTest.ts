import http from 'http';
import { TaskType, TaskPriority } from '../types';

const API_HOST = process.env.API_HOST || 'localhost';
const API_PORT = parseInt(process.env.API_PORT || '3000');

const TASK_TYPES: TaskType[] = ['email', 'image-processing', 'data-analysis', 'report-generation', 'notification', 'computation'];
const PRIORITIES: TaskPriority[] = ['high', 'normal', 'low'];

interface LoadTestConfig {
  totalTasks: number;
  concurrency: number;
  taskTypes: TaskType[];
  priorities: TaskPriority[];
  rampUpTime: number;
}

interface LoadTestResults {
  submitted: number;
  failed: number;
  startTime: number;
  endTime: number | null;
  responseTimes: number[];
  errors: string[];
}

async function submitTask(type: TaskType, priority: TaskPriority, payload: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ type, priority, payload });

    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/tasks',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ success: false, error: body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getStats(): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/stats',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ success: false, error: body });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function getRandomPayload(type: TaskType): Record<string, any> {
  switch (type) {
    case 'email':
      return { to: `user${Math.random().toString(36).slice(2)}@example.com`, subject: 'Load Test', body: 'Test email' };
    case 'image-processing':
      return { imageUrl: `https://example.com/img${Date.now()}.jpg`, operations: ['resize'] };
    case 'data-analysis':
      return { datasetId: `ds-${Date.now()}`, analysisType: 'statistical' };
    case 'report-generation':
      return { reportType: 'summary', format: 'pdf' };
    case 'notification':
      return { userId: `user-${Date.now()}`, message: 'Load test notification', channel: 'push' };
    case 'computation':
      return { operation: 'fibonacci', data: { n: 25 } };
    default:
      return { test: true };
  }
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function runLoadTest(config: LoadTestConfig): Promise<LoadTestResults> {
  const { totalTasks, concurrency, taskTypes, priorities, rampUpTime } = config;

  console.log('='.repeat(60));
  console.log('  DISTRIBUTED TASK QUEUE - LOAD TEST');
  console.log('='.repeat(60));
  console.log(`Total Tasks: ${totalTasks}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Task Types: ${taskTypes.join(', ')}`);
  console.log(`Priorities: ${priorities.join(', ')}`);
  console.log('='.repeat(60));
  console.log();

  const results: LoadTestResults = {
    submitted: 0,
    failed: 0,
    startTime: Date.now(),
    endTime: null,
    responseTimes: [],
    errors: []
  };

  const tasks: { type: TaskType; priority: TaskPriority }[] = [];
  for (let i = 0; i < totalTasks; i++) {
    tasks.push({
      type: taskTypes[Math.floor(Math.random() * taskTypes.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)]
    });
  }

  const delayBetweenBatches = rampUpTime > 0 ? rampUpTime / Math.ceil(totalTasks / concurrency) : 0;

  console.log('Submitting tasks...\n');

  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchPromises = batch.map(async (task) => {
      const startTime = Date.now();
      try {
        const payload = getRandomPayload(task.type);
        const response = await submitTask(task.type, task.priority, payload);

        if (response.success) {
          results.submitted++;
          results.responseTimes.push(Date.now() - startTime);
        } else {
          results.failed++;
          results.errors.push(response.error);
        }
      } catch (error) {
        results.failed++;
        results.errors.push((error as Error).message);
      }
    });

    await Promise.all(batchPromises);

    const progress = Math.min(i + concurrency, totalTasks);
    const percent = ((progress / totalTasks) * 100).toFixed(1);
    process.stdout.write(`\rProgress: ${progress}/${totalTasks} (${percent}%) - Submitted: ${results.submitted}, Failed: ${results.failed}`);

    if (delayBetweenBatches > 0 && i + concurrency < tasks.length) {
      await sleep(delayBetweenBatches);
    }
  }

  results.endTime = Date.now();

  console.log('\n\n' + '='.repeat(60));
  console.log('  LOAD TEST RESULTS');
  console.log('='.repeat(60));

  const totalTime = (results.endTime - results.startTime) / 1000;
  const avgResponseTime = results.responseTimes.length > 0
    ? results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length
    : 0;
  const minResponseTime = results.responseTimes.length > 0
    ? Math.min(...results.responseTimes)
    : 0;
  const maxResponseTime = results.responseTimes.length > 0
    ? Math.max(...results.responseTimes)
    : 0;
  const throughput = results.submitted / totalTime;

  console.log(`Tasks Submitted: ${results.submitted}`);
  console.log(`Tasks Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.submitted / totalTasks) * 100).toFixed(2)}%`);
  console.log(`Total Time: ${totalTime.toFixed(2)}s`);
  console.log(`Throughput: ${throughput.toFixed(2)} tasks/second`);
  console.log(`Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`Min Response Time: ${minResponseTime}ms`);
  console.log(`Max Response Time: ${maxResponseTime}ms`);
  console.log('='.repeat(60));

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    const uniqueErrors = [...new Set(results.errors)];
    uniqueErrors.slice(0, 5).forEach(err => console.log(`  - ${err}`));
    if (uniqueErrors.length > 5) {
      console.log(`  ... and ${uniqueErrors.length - 5} more unique errors`);
    }
  }

  console.log('\nWaiting for tasks to be processed...');
  await monitorProcessing();

  return results;
}

async function monitorProcessing(): Promise<void> {
  const startTime = Date.now();
  const timeout = 300000; // 5 minutes
  let lastCompleted = 0;

  while (Date.now() - startTime < timeout) {
    try {
      const response = await getStats();
      if (response.success && response.stats) {
        const { completedTasks, failedTasks, pendingTasks, processingTasks } = response.stats;
        const total = completedTasks + failedTasks;

        if (total !== lastCompleted) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`[${elapsed}s] Completed: ${completedTasks}, Failed: ${failedTasks}, Pending: ${pendingTasks}, Processing: ${processingTasks}`);
          lastCompleted = total;
        }

        if (pendingTasks === 0 && processingTasks === 0) {
          console.log('\n' + '='.repeat(60));
          console.log('  PROCESSING COMPLETE');
          console.log('='.repeat(60));
          console.log(`Total Completed: ${completedTasks}`);
          console.log(`Total Failed: ${failedTasks}`);
          console.log(`Total Time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
          console.log(`Avg Processing Time: ${response.stats.avgProcessingTime.toFixed(2)}ms`);
          console.log('='.repeat(60));
          return;
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', (error as Error).message);
    }

    await sleep(1000);
  }

  console.log('Monitoring timed out after 5 minutes');
}

// Main execution
const args = process.argv.slice(2);
const loadTestConfig: LoadTestConfig = {
  totalTasks: parseInt(args[0]) || 100,
  concurrency: parseInt(args[1]) || 10,
  rampUpTime: parseInt(args[2]) || 0,
  taskTypes: TASK_TYPES,
  priorities: PRIORITIES
};

console.log('\nStarting load test...\n');
console.log('Make sure API server and workers are running:');
console.log('  npm run start:api');
console.log('  npm run start:workers\n');

runLoadTest(loadTestConfig)
  .then(() => {
    console.log('\nLoad test completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Load test failed:', error);
    process.exit(1);
  });
