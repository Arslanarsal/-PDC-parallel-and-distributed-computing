import { Router, Request, Response, NextFunction } from 'express';
import queueManager from '../../queue/QueueManager';

const router = Router();

// Get queue statistics
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await queueManager.getQueueStats();

    res.json({
      success: true,
      stats: {
        ...stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get active workers
router.get('/workers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const workers = await queueManager.getActiveWorkers();

    const formattedWorkers = workers.map(worker => ({
      id: worker.id,
      status: worker.status,
      tasksProcessed: worker.tasksProcessed || 0,
      currentTask: worker.currentTask || null,
      startedAt: worker.startedAt ? new Date(worker.startedAt).toISOString() : null,
      lastHeartbeat: worker.lastHeartbeat ? new Date(worker.lastHeartbeat).toISOString() : null,
      uptime: worker.startedAt ? Date.now() - worker.startedAt : 0
    }));

    res.json({
      success: true,
      workerCount: formattedWorkers.length,
      workers: formattedWorkers
    });
  } catch (error) {
    next(error);
  }
});

// Get summary
router.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await queueManager.getQueueStats();
    const workers = await queueManager.getActiveWorkers();

    const totalQueued = Object.values(stats.queueLengths).reduce((a, b) => a + b, 0);
    const busyWorkers = workers.filter(w => w.status === 'busy').length;

    res.json({
      success: true,
      summary: {
        totalTasks: stats.tasksCreated,
        pendingTasks: totalQueued,
        processingTasks: stats.processingTasks,
        completedTasks: stats.completedTasks,
        failedTasks: stats.failedTasks,
        successRate: stats.tasksCreated > 0
          ? ((stats.completedTasks / stats.tasksCreated) * 100).toFixed(2) + '%'
          : '0%',
        activeWorkers: workers.length,
        busyWorkers,
        idleWorkers: workers.length - busyWorkers,
        avgProcessingTime: stats.avgProcessingTime.toFixed(2) + 'ms',
        queueHealth: totalQueued < 100 ? 'healthy' : totalQueued < 500 ? 'moderate' : 'overloaded'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
