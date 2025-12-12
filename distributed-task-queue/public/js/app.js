// DOM Elements
const elements = {
  connectionStatus: document.getElementById('connectionStatus'),
  totalTasks: document.getElementById('totalTasks'),
  pendingTasks: document.getElementById('pendingTasks'),
  processingTasks: document.getElementById('processingTasks'),
  completedTasks: document.getElementById('completedTasks'),
  failedTasks: document.getElementById('failedTasks'),
  avgProcessingTime: document.getElementById('avgProcessingTime'),
  queueHealth: document.getElementById('queueHealth'),
  highQueueBar: document.getElementById('highQueueBar'),
  highQueueCount: document.getElementById('highQueueCount'),
  normalQueueBar: document.getElementById('normalQueueBar'),
  normalQueueCount: document.getElementById('normalQueueCount'),
  lowQueueBar: document.getElementById('lowQueueBar'),
  lowQueueCount: document.getElementById('lowQueueCount'),
  workerCount: document.getElementById('workerCount'),
  workersGrid: document.getElementById('workersGrid'),
  eventsList: document.getElementById('eventsList'),
  taskType: document.getElementById('taskType'),
  taskPriority: document.getElementById('taskPriority'),
  taskCount: document.getElementById('taskCount'),
  submitTasks: document.getElementById('submitTasks'),
  clearAll: document.getElementById('clearAll'),
  clearEvents: document.getElementById('clearEvents')
};

let maxQueueLength = 50;
let socket;

// Initialize Socket.IO
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('Connected to server');
    updateConnectionStatus('connected', 'Connected');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateConnectionStatus('disconnected', 'Disconnected');
  });

  socket.on('connect_error', () => {
    updateConnectionStatus('disconnected', 'Connection Error');
  });

  socket.on('initial:stats', (data) => {
    console.log('Initial stats:', data);
    updateStats(data.stats);
    updateWorkers(data.workers);
  });

  socket.on('stats:update', (data) => {
    updateStats(data.stats);
    updateWorkers(data.workers);
  });

  socket.on('queue:event', (event) => {
    console.log('Queue event:', event);
    addEvent(event);
  });
}

// Update connection status
function updateConnectionStatus(status, text) {
  elements.connectionStatus.className = `connection-status ${status}`;
  elements.connectionStatus.querySelector('.status-text').textContent = text;
}

// Update stats
function updateStats(stats) {
  if (!stats) return;

  animateValue(elements.totalTasks, stats.tasksCreated);
  animateValue(elements.pendingTasks, stats.pendingTasks);
  animateValue(elements.processingTasks, stats.processingTasks);
  animateValue(elements.completedTasks, stats.completedTasks);
  animateValue(elements.failedTasks, stats.failedTasks);
  elements.avgProcessingTime.textContent = Math.round(stats.avgProcessingTime) + 'ms';

  // Update queue bars
  if (stats.queueLengths) {
    const total = Object.values(stats.queueLengths).reduce((a, b) => a + b, 0);
    maxQueueLength = Math.max(maxQueueLength, total, 10);

    updateQueueBar('high', stats.queueLengths.high || 0);
    updateQueueBar('normal', stats.queueLengths.normal || 0);
    updateQueueBar('low', stats.queueLengths.low || 0);

    // Update health badge
    updateHealthBadge(total);
  }
}

// Animate value change
function animateValue(element, newValue) {
  const currentValue = parseInt(element.textContent) || 0;
  if (currentValue === newValue) return;

  const diff = newValue - currentValue;
  const steps = 10;
  const stepValue = diff / steps;
  let step = 0;

  const animate = () => {
    step++;
    const value = Math.round(currentValue + (stepValue * step));
    element.textContent = value;
    if (step < steps) {
      requestAnimationFrame(animate);
    } else {
      element.textContent = newValue;
    }
  };

  requestAnimationFrame(animate);
}

// Update queue bar
function updateQueueBar(priority, count) {
  const bar = elements[`${priority}QueueBar`];
  const countEl = elements[`${priority}QueueCount`];

  if (bar && countEl) {
    const percentage = Math.min((count / maxQueueLength) * 100, 100);
    bar.style.width = `${percentage}%`;
    countEl.textContent = count;
  }
}

// Update health badge
function updateHealthBadge(totalQueued) {
  const badge = elements.queueHealth;
  if (totalQueued < 50) {
    badge.textContent = 'Healthy';
    badge.className = 'badge';
  } else if (totalQueued < 200) {
    badge.textContent = 'Moderate';
    badge.className = 'badge warning';
  } else {
    badge.textContent = 'Overloaded';
    badge.className = 'badge danger';
  }
}

// Update workers
function updateWorkers(workers) {
  elements.workerCount.textContent = `${workers?.length || 0} workers`;

  if (!workers || workers.length === 0) {
    elements.workersGrid.innerHTML = '<div class="no-workers">No active workers</div>';
    return;
  }

  elements.workersGrid.innerHTML = workers.map(worker => {
    const status = worker.status || 'idle';
    const tasks = worker.tasksProcessed || 0;
    const uptime = worker.startedAt ? formatUptime(Date.now() - worker.startedAt) : 'N/A';

    return `
      <div class="worker-card ${status}">
        <div class="worker-id">${worker.id}</div>
        <span class="worker-status ${status}">${status}</span>
        <div class="worker-meta">
          Tasks: ${tasks} | Uptime: ${uptime}
        </div>
      </div>
    `;
  }).join('');
}

// Format uptime
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Add event to list
function addEvent(event) {
  // Remove "waiting" message if present
  const waitingMsg = elements.eventsList.querySelector('.event-item.info');
  if (waitingMsg) {
    waitingMsg.remove();
  }

  const eventEl = document.createElement('div');
  const eventType = event.event.split(':')[1] || event.event;
  let className = eventType;
  let message = '';

  switch (event.event) {
    case 'task:created':
      message = `Task created: ${event.task?.id?.slice(0, 8)}... (${event.task?.type}, ${event.task?.priority})`;
      break;
    case 'task:processing':
      message = `Processing: ${event.task?.id?.slice(0, 8)}... by ${event.task?.workerId}`;
      break;
    case 'task:completed':
      message = `Completed: ${event.task?.id?.slice(0, 8)}... in ${event.task?.processingTime}ms`;
      break;
    case 'task:failed':
      message = `Failed: ${event.task?.id?.slice(0, 8)}... - ${event.task?.error}`;
      break;
    case 'task:retrying':
      message = `Retrying: ${event.task?.id?.slice(0, 8)}... (attempt ${event.task?.retries}/${event.task?.maxRetries})`;
      break;
    case 'worker:registered':
      className = 'worker';
      message = `Worker registered: ${event.worker?.id}`;
      break;
    case 'worker:unregistered':
      className = 'worker';
      message = `Worker unregistered: ${event.worker?.id}`;
      break;
    default:
      message = event.event;
  }

  eventEl.className = `event-item ${className}`;
  eventEl.innerHTML = `
    <span class="event-message">${message}</span>
    <span class="event-time">${new Date().toLocaleTimeString()}</span>
  `;

  elements.eventsList.insertBefore(eventEl, elements.eventsList.firstChild);

  // Keep only last 50 events
  while (elements.eventsList.children.length > 50) {
    elements.eventsList.removeChild(elements.eventsList.lastChild);
  }
}

// Get payload for task type
function getPayload(type) {
  switch (type) {
    case 'email':
      return {
        to: `user${Math.floor(Math.random() * 1000)}@example.com`,
        subject: 'Test Email',
        body: 'This is a test email.'
      };
    case 'image-processing':
      return {
        imageUrl: `https://example.com/img${Date.now()}.jpg`,
        operations: ['resize', 'compress']
      };
    case 'data-analysis':
      return {
        datasetId: `dataset-${Date.now()}`,
        analysisType: 'statistical'
      };
    case 'report-generation':
      return {
        reportType: 'summary',
        format: 'pdf'
      };
    case 'notification':
      return {
        userId: `user-${Date.now()}`,
        message: 'Test notification',
        channel: 'push'
      };
    case 'computation':
      return {
        operation: 'fibonacci',
        data: { n: Math.floor(Math.random() * 20) + 15 }
      };
    default:
      return { test: true, timestamp: Date.now() };
  }
}

// Submit tasks
async function submitTasks() {
  const type = elements.taskType.value;
  const priority = elements.taskPriority.value;
  const count = parseInt(elements.taskCount.value) || 1;

  elements.submitTasks.disabled = true;
  elements.submitTasks.textContent = 'Submitting...';

  try {
    if (count === 1) {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          priority,
          payload: getPayload(type)
        })
      });
    } else {
      const tasks = Array(count).fill(null).map(() => ({
        type,
        priority,
        payload: getPayload(type)
      }));

      await fetch('/api/tasks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks })
      });
    }

    console.log(`Submitted ${count} task(s)`);
  } catch (error) {
    console.error('Failed to submit tasks:', error);
    alert('Failed to submit tasks. Check console for details.');
  } finally {
    elements.submitTasks.disabled = false;
    elements.submitTasks.textContent = 'Submit';
  }
}

// Clear all tasks
async function clearAllTasks() {
  if (!confirm('Are you sure you want to clear all tasks?')) return;

  try {
    await fetch('/api/tasks/clear', { method: 'DELETE' });
    console.log('All tasks cleared');
  } catch (error) {
    console.error('Failed to clear tasks:', error);
    alert('Failed to clear tasks. Check console for details.');
  }
}

// Clear events
function clearEvents() {
  elements.eventsList.innerHTML = '<div class="event-item info"><span class="event-message">Waiting for events...</span></div>';
}

// Event listeners
elements.submitTasks.addEventListener('click', submitTasks);
elements.clearAll.addEventListener('click', clearAllTasks);
elements.clearEvents.addEventListener('click', clearEvents);

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    submitTasks();
  }
});

// Initialize
initSocket();

// Request stats periodically
setInterval(() => {
  if (socket && socket.connected) {
    socket.emit('request:stats');
  }
}, 5000);
