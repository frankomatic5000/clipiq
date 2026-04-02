import { Queue } from "bullmq";
import { Redis } from "ioredis";

// Create Redis connection
const redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Transcription queue
export const transcriptionQueue = new Queue("video-transcription", {
  connection: redisConnection,
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
  const job = await transcriptionQueue.add("transcribe", data, {
    timeout: 30 * 60 * 1000, // 30 minutes timeout
  });
  return job;
}

// Queue events
transcriptionQueue.on("completed", (job) => {
  console.log(`Transcription job ${job.id} completed`);
});

transcriptionQueue.on("failed", (job, err) => {
  console.error(`Transcription job ${job?.id} failed:`, err);
});

transcriptionQueue.on("progress", (job) => {
  console.log(`Transcription job ${job?.id} progress updated`);
});
