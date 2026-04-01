import Queue from "bull";
import { Redis } from "ioredis";

// Create Redis connection
const redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Transcription queue
export const transcriptionQueue = new Queue("video-transcription", {
  redis: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
});

// Job types
export interface TranscriptionJobData {
  videoId: string;
  r2Key: string;
  r2Bucket: string;
}

export interface TranscriptionJobResult {
  srtKey: string;
  transcript: string;
  duration: number;
}

// Add job to queue
export async function addTranscriptionJob(data: TranscriptionJobData) {
  const job = await transcriptionQueue.add(data, {
    timeout: 30 * 60 * 1000, // 30 minutes timeout
  });
  return job;
}

// Queue events
transcriptionQueue.on("completed", (job, result) => {
  console.log(`Transcription job ${job.id} completed`);
});

transcriptionQueue.on("failed", (job, err) => {
  console.error(`Transcription job ${job?.id} failed:`, err);
});

transcriptionQueue.on("progress", (job, progress) => {
  console.log(`Transcription job ${job?.id} progress: ${progress}%`);
});
