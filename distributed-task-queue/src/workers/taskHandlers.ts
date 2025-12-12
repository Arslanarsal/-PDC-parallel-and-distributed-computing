import { TaskType, TaskResult } from '../types';

type TaskHandler = (payload: Record<string, any>) => Promise<TaskResult>;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const taskHandlers: Record<TaskType, TaskHandler> = {
  'email': async (payload) => {
    const { to, subject } = payload;
    const processingTime = Math.random() * 2000 + 500;
    await sleep(processingTime);

    if (Math.random() < 0.1) {
      throw new Error('SMTP connection failed');
    }

    return {
      success: true,
      message: `Email sent to ${to}`,
      data: { subject, deliveredAt: new Date().toISOString() },
      processingTime: processingTime.toFixed(0) + 'ms'
    };
  },

  'image-processing': async (payload) => {
    const { imageUrl, operations } = payload;
    const processingTime = Math.random() * 5000 + 1000;
    await sleep(processingTime);

    if (Math.random() < 0.05) {
      throw new Error('Image processing failed: corrupt file');
    }

    return {
      success: true,
      message: 'Image processed successfully',
      data: {
        originalUrl: imageUrl,
        processedUrl: `processed_${Date.now()}.jpg`,
        operations: operations || ['resize', 'compress']
      },
      processingTime: processingTime.toFixed(0) + 'ms'
    };
  },

  'data-analysis': async (payload) => {
    const { datasetId, analysisType } = payload;
    const processingTime = Math.random() * 8000 + 2000;
    await sleep(processingTime);

    return {
      success: true,
      message: 'Analysis completed',
      data: {
        datasetId,
        analysisType: analysisType || 'statistical',
        results: {
          mean: (Math.random() * 100).toFixed(2),
          median: (Math.random() * 100).toFixed(2),
          stdDev: (Math.random() * 20).toFixed(2),
          count: Math.floor(Math.random() * 10000)
        }
      },
      processingTime: processingTime.toFixed(0) + 'ms'
    };
  },

  'report-generation': async (payload) => {
    const { reportType, format } = payload;
    const processingTime = Math.random() * 6000 + 2000;
    await sleep(processingTime);

    if (Math.random() < 0.08) {
      throw new Error('Report generation failed: insufficient data');
    }

    return {
      success: true,
      message: 'Report generated',
      data: {
        reportType: reportType || 'summary',
        format: format || 'pdf',
        downloadUrl: `/reports/report_${Date.now()}.${format || 'pdf'}`,
        pages: Math.floor(Math.random() * 50) + 5
      },
      processingTime: processingTime.toFixed(0) + 'ms'
    };
  },

  'notification': async (payload) => {
    const { userId, message, channel } = payload;
    const processingTime = Math.random() * 500 + 100;
    await sleep(processingTime);

    return {
      success: true,
      message: 'Notification sent',
      data: {
        userId,
        channel: channel || 'push',
        content: message,
        delivered: true,
        timestamp: new Date().toISOString()
      },
      processingTime: processingTime.toFixed(0) + 'ms'
    };
  },

  'file-upload': async (payload) => {
    const { filename, size, destination } = payload;
    const processingTime = (size || 1024) / 100 + Math.random() * 1000;
    await sleep(processingTime);

    if (Math.random() < 0.03) {
      throw new Error('Storage service unavailable');
    }

    return {
      success: true,
      message: 'File uploaded',
      data: {
        filename,
        size: size || 1024,
        destination: destination || 'cloud-storage',
        url: `/files/${Date.now()}_${filename}`
      },
      processingTime: processingTime.toFixed(0) + 'ms'
    };
  },

  'database-backup': async (payload) => {
    const { database, tables } = payload;
    const processingTime = Math.random() * 10000 + 5000;
    await sleep(processingTime);

    return {
      success: true,
      message: 'Backup completed',
      data: {
        database: database || 'main',
        tablesBackedUp: tables || ['all'],
        backupSize: Math.floor(Math.random() * 500) + 'MB',
        backupFile: `backup_${Date.now()}.sql.gz`
      },
      processingTime: processingTime.toFixed(0) + 'ms'
    };
  },

  'computation': async (payload) => {
    const { operation, data } = payload;
    const processingTime = Math.random() * 3000 + 500;

    let result: any;
    switch (operation) {
      case 'fibonacci':
        const n = data?.n || 30;
        result = fibonacci(n);
        break;
      case 'prime':
        const limit = data?.limit || 1000;
        result = countPrimes(limit);
        break;
      case 'factorial':
        const num = data?.n || 20;
        result = factorial(num);
        break;
      default:
        await sleep(processingTime);
        result = Math.random() * 1000;
    }

    return {
      success: true,
      message: 'Computation completed',
      data: {
        operation: operation || 'random',
        input: data,
        result
      },
      processingTime: processingTime.toFixed(0) + 'ms'
    };
  },

  'default': async (payload) => {
    const processingTime = Math.random() * 2000 + 500;
    await sleep(processingTime);

    return {
      success: true,
      message: 'Task completed',
      data: payload,
      processingTime: processingTime.toFixed(0) + 'ms'
    };
  }
};

function fibonacci(n: number): number {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

function countPrimes(limit: number): number {
  const sieve = new Array(limit + 1).fill(true);
  sieve[0] = sieve[1] = false;
  for (let i = 2; i * i <= limit; i++) {
    if (sieve[i]) {
      for (let j = i * i; j <= limit; j += i) {
        sieve[j] = false;
      }
    }
  }
  return sieve.filter(Boolean).length;
}

function factorial(n: number): string {
  if (n <= 1) return '1';
  let result = 1n;
  for (let i = 2n; i <= BigInt(n); i++) {
    result *= i;
  }
  return result.toString();
}

export default taskHandlers;
