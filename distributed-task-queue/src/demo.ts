/**
 * DISTRIBUTED TASK QUEUE - DEMO
 * Demonstrates Parallel vs Sequential Processing Performance
 */

import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import cors from 'cors';

// ============ CONFIGURATION ============
const NUM_WORKERS = 4;  // Number of parallel workers
const API_PORT = 3000;

// ============ TASK QUEUE ============
interface Task {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  workerId?: string;
  result?: any;
}

class TaskQueue {
  private queue: Task[] = [];
  private tasks = new Map<string, Task>();
  private stats = {
    created: 0,
    completed: 0,
    failed: 0,
    totalProcessingTime: 0
  };

  addTask(type: string): Task {
    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      status: 'pending',
      createdAt: Date.now()
    };
    this.tasks.set(task.id, task);
    this.queue.push(task);
    this.stats.created++;
    return task;
  }

  getNextTask(): Task | null {
    const task = this.queue.shift();
    if (task) {
      task.status = 'processing';
      task.startedAt = Date.now();
    }
    return task || null;
  }

  completeTask(taskId: string, result: any): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = Date.now();
      task.result = result;
      this.stats.completed++;
      this.stats.totalProcessingTime += (task.completedAt - (task.startedAt || task.createdAt));
    }
  }

  getStats() {
    return {
      ...this.stats,
      pending: this.queue.length,
      avgProcessingTime: this.stats.completed > 0
        ? Math.round(this.stats.totalProcessingTime / this.stats.completed)
        : 0
    };
  }

  clear() {
    this.queue = [];
    this.tasks.clear();
    this.stats = { created: 0, completed: 0, failed: 0, totalProcessingTime: 0 };
  }
}

// ============ WORKER CLASS ============
class Worker {
  id: string;
  isRunning = false;
  tasksProcessed = 0;
  private queue: TaskQueue;
  private onTaskComplete: (workerId: string, task: Task) => void;

  constructor(id: string, queue: TaskQueue, onComplete: (workerId: string, task: Task) => void) {
    this.id = id;
    this.queue = queue;
    this.onTaskComplete = onComplete;
  }

  async start() {
    this.isRunning = true;
    console.log(`[${this.id}] Started`);

    while (this.isRunning) {
      const task = this.queue.getNextTask();

      if (task) {
        task.workerId = this.id;
        console.log(`[${this.id}] Processing ${task.id}`);

        // Simulate work (1-3 seconds)
        const workTime = 1000 + Math.random() * 2000;
        await this.sleep(workTime);

        this.queue.completeTask(task.id, {
          processedBy: this.id,
          duration: Math.round(workTime)
        });

        this.tasksProcessed++;
        console.log(`[${this.id}] Completed ${task.id} in ${Math.round(workTime)}ms`);

        this.onTaskComplete(this.id, task);
      } else {
        await this.sleep(100); // Wait if no tasks
      }
    }
  }

  stop() {
    this.isRunning = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============ MAIN APPLICATION ============
const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Shared queue
const taskQueue = new TaskQueue();
const workers: Worker[] = [];

// Create workers
for (let i = 1; i <= NUM_WORKERS; i++) {
  const worker = new Worker(`worker-${i}`, taskQueue, (workerId, task) => {
    io.emit('task:completed', { workerId, taskId: task.id });
    io.emit('stats:update', getFullStats());
  });
  workers.push(worker);
}

function getFullStats() {
  return {
    ...taskQueue.getStats(),
    workers: workers.map(w => ({
      id: w.id,
      status: w.isRunning ? 'active' : 'stopped',
      tasksProcessed: w.tasksProcessed
    }))
  };
}

// ============ API ROUTES ============

// Create task
app.post('/api/tasks', (req, res) => {
  const { type = 'default', count = 1 } = req.body;
  const tasks = [];

  for (let i = 0; i < Math.min(count, 100); i++) {
    const task = taskQueue.addTask(type);
    tasks.push(task);
    io.emit('task:created', task);
  }

  io.emit('stats:update', getFullStats());
  res.json({ success: true, created: tasks.length, tasks });
});

// Get stats
app.get('/api/stats', (req, res) => {
  res.json({ success: true, stats: getFullStats() });
});

// Clear all
app.delete('/api/tasks/clear', (req, res) => {
  taskQueue.clear();
  workers.forEach(w => w.tasksProcessed = 0);
  io.emit('stats:update', getFullStats());
  res.json({ success: true, message: 'Cleared' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', workers: NUM_WORKERS });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============ SOCKET.IO ============
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socket.emit('stats:update', getFullStats());

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Broadcast stats every second
setInterval(() => {
  io.emit('stats:update', getFullStats());
}, 1000);

// ============ START SERVER ============
server.listen(API_PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('  DISTRIBUTED TASK QUEUE - DEMO');
  console.log('  Parallel vs Sequential Computing');
  console.log('='.repeat(60));
  console.log(`\n  Server: http://localhost:${API_PORT}`);
  console.log(`  Workers: ${NUM_WORKERS} parallel workers`);
  console.log('\n  Open the URL in your browser to see the dashboard!');
  console.log('='.repeat(60) + '\n');

  // Start all workers
  workers.forEach(w => w.start());
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  workers.forEach(w => w.stop());
  process.exit(0);
});
