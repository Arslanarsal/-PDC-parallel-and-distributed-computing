import { Router, Request, Response, NextFunction } from 'express';
import queueManager from '../../queue/QueueManager';
import { TaskPriority, TaskCreateRequest } from '../../types';

const router = Router();

// Create a new task
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, payload, priority } = req.body as TaskCreateRequest & { priority?: TaskPriority };

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Task type is required'
      });
    }

    const validPriorities: TaskPriority[] = ['high', 'normal', 'low'];
    const taskPriority: TaskPriority = validPriorities.includes(priority as TaskPriority)
      ? priority as TaskPriority
      : 'normal';

    const task = await queueManager.addTask(
      { type, payload: payload || {} },
      taskPriority
    );

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task: {
        id: task.id,
        type: task.type,
        priority: task.priority,
        status: task.status,
        createdAt: new Date(task.createdAt).toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create batch tasks
router.post('/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tasks } = req.body as { tasks: (TaskCreateRequest & { priority?: TaskPriority })[] };

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tasks array is required and must not be empty'
      });
    }

    const createdTasks = [];
    const validPriorities: TaskPriority[] = ['high', 'normal', 'low'];

    for (const taskData of tasks) {
      const { type, payload, priority } = taskData;

      if (!type) continue;

      const taskPriority: TaskPriority = validPriorities.includes(priority as TaskPriority)
        ? priority as TaskPriority
        : 'normal';

      const task = await queueManager.addTask(
        { type, payload: payload || {} },
        taskPriority
      );

      createdTasks.push({
        id: task.id,
        type: task.type,
        priority: task.priority,
        status: task.status
      });
    }

    res.status(201).json({
      success: true,
      message: `${createdTasks.length} tasks created successfully`,
      tasks: createdTasks
    });
  } catch (error) {
    next(error);
  }
});

// Get task status
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const task = await queueManager.getTaskStatus(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.json({
      success: true,
      task: {
        id: task.id,
        type: task.type,
        priority: task.priority,
        status: task.status,
        retries: task.retries || 0,
        createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : null,
        startedAt: task.startedAt ? new Date(task.startedAt).toISOString() : null,
        completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
        failedAt: task.failedAt ? new Date(task.failedAt).toISOString() : null,
        workerId: task.workerId || null,
        result: task.result || null,
        lastError: task.lastError || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// Clear all tasks
router.delete('/clear', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await queueManager.clearAll();
    res.json({
      success: true,
      message: 'All tasks and queues cleared'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
