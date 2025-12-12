import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import config from '../config';
import taskRoutes from './routes/tasks';
import statsRoutes from './routes/stats';
import queueManager from '../queue/QueueManager';

const app = express();
const server = http.createServer(app);

// Socket.io for real-time updates
const io = new SocketServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../../public')));

// Initialize queue manager
queueManager.initialize();

// API Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/stats', statsRoutes);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'distributed-task-queue-api'
  });
});

// Serve frontend
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found'
  });
});

// Socket.io connection handling
io.on('connection', async (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Send initial stats
  try {
    const stats = await queueManager.getQueueStats();
    const workers = await queueManager.getActiveWorkers();
    socket.emit('initial:stats', { stats, workers });
  } catch (error) {
    console.error('[Socket] Error sending initial stats:', (error as Error).message);
  }

  // Handle stats request
  socket.on('request:stats', async () => {
    try {
      const stats = await queueManager.getQueueStats();
      const workers = await queueManager.getActiveWorkers();
      socket.emit('stats:update', { stats, workers });
    } catch (error) {
      console.error('[Socket] Error fetching stats:', (error as Error).message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Listen for queue events and broadcast to all clients
queueManager.on('queue:event', (event) => {
  io.emit('queue:event', event);
});

// Periodic stats broadcast
setInterval(async () => {
  try {
    const stats = await queueManager.getQueueStats();
    const workers = await queueManager.getActiveWorkers();
    io.emit('stats:update', { stats, workers });
  } catch (error) {
    console.error('[Socket] Error broadcasting stats:', (error as Error).message);
  }
}, 1000);

// Start server
const PORT = config.api.port;

server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('  DISTRIBUTED TASK QUEUE - API SERVER');
  console.log('='.repeat(50));
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log('[Server] Endpoints:');
  console.log('  POST /api/tasks           - Create a task');
  console.log('  POST /api/tasks/batch     - Create batch tasks');
  console.log('  GET  /api/tasks/:id       - Get task status');
  console.log('  DELETE /api/tasks/clear   - Clear all tasks');
  console.log('  GET  /api/stats           - Get queue statistics');
  console.log('  GET  /api/stats/workers   - Get active workers');
  console.log('  GET  /api/stats/summary   - Get summary');
  console.log('  GET  /api/health          - Health check');
  console.log('');
  console.log(`[Dashboard] Open http://localhost:${PORT} in browser`);
  console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] Shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

export { app, io, server };
