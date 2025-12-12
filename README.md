# Distributed Task Queue System

A Scalable Job Processing Architecture using Node.js & TypeScript

## Project Overview

This project implements a distributed task queue system demonstrating core concepts of parallel and distributed computing:

- **Producer-Consumer Pattern**: Decoupled task creation and execution
- **Load Balancing**: Even distribution of tasks across workers
- **Fault Tolerance**: Automatic retry with exponential backoff
- **Horizontal Scaling**: Linear throughput increase with more workers
- **Real-time Monitoring**: Live dashboard with Socket.io

## Technology Stack

| Technology | Purpose |
|------------|---------|
| Node.js | Runtime environment |
| TypeScript | Type-safe development |
| Express.js | REST API framework |
| Socket.io | Real-time communication |
| Node.js Cluster | Worker pool management |
| UUID | Unique task identification |

## Prerequisites

- Node.js >= 16.x
- npm package manager

## Installation

```bash
# Navigate to project directory
cd distributed-task-queue

# Install dependencies
npm install
```

## Running the System

### Option 1: Run Services Separately

```bash
# Terminal 1: Start API Server (includes dashboard)
npm run start:api

# Terminal 2: Start Worker Cluster
npm run start:workers
```

### Option 2: Run All Together

```bash
npm run start:all
```

### Option 3: Development Mode

```bash
npm run dev
```

## Accessing the Application

- **Dashboard**: http://localhost:3000
- **API**: http://localhost:3000/api

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/tasks | Create a new task |
| POST | /api/tasks/batch | Create multiple tasks |
| GET | /api/tasks/:id | Get task status |
| DELETE | /api/tasks/clear | Clear all tasks |
| GET | /api/stats | Get queue statistics |
| GET | /api/stats/workers | Get active workers |
| GET | /api/stats/summary | Get summary |

## Task Types

- `email` - Send emails
- `image-processing` - Image manipulation
- `data-analysis` - Statistical analysis
- `report-generation` - PDF/Excel reports
- `notification` - Push notifications
- `file-upload` - File storage
- `database-backup` - Backup operations
- `computation` - CPU-intensive tasks

## Priority Levels

- `high` - Processed first
- `normal` - Default priority
- `low` - Processed last

## Quick Test

```bash
# Create a single task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"type": "email", "priority": "normal", "payload": {"to": "test@example.com"}}'

# Create batch tasks
curl -X POST http://localhost:3000/api/tasks/batch \
  -H "Content-Type: application/json" \
  -d '{"tasks": [{"type": "email"}, {"type": "notification"}, {"type": "computation"}]}'
```

## Load Testing

```bash
# Default: 100 tasks, 10 concurrent
npm run test:load

# Custom: 500 tasks, 20 concurrent
npx ts-node src/utils/loadTest.ts 500 20
```

## Project Structure

```
distributed-task-queue/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── tasks.ts
│   │   │   └── stats.ts
│   │   └── server.ts
│   ├── queue/
│   │   └── QueueManager.ts
│   ├── workers/
│   │   ├── cluster.ts
│   │   ├── Worker.ts
│   │   └── taskHandlers.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   └── loadTest.ts
│   ├── config.ts
│   └── index.ts
├── public/
│   ├── css/style.css
│   ├── js/app.js
│   └── index.html
├── package.json
├── tsconfig.json
├── DOCUMENTATION.html
└── README.md
```

## Key Features

1. **Task Queue with Priorities**: High, normal, and low priority queues
2. **Worker Pool**: Multiple workers using Node.js Cluster module
3. **Fault Tolerance**: Automatic retry with exponential backoff (max 3 retries)
4. **Real-time Dashboard**: Live monitoring via Socket.io
5. **Type Safety**: Complete TypeScript implementation
6. **8 Task Types**: Simulating real-world operations

## Documentation

Open `DOCUMENTATION.html` in a browser and print to PDF for submission.

## Authors

**Group Members:**
- M. Arslan (22021519-009)
- Hamza Ehsan Butt (22021519-085)
- Talha Adalat (22021519-040)

Parallel & Distributed Computing Project - Submitted to Dr. Umar Shoaib

## License

MIT
