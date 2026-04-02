import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// FFmpeg processing queue
export const ffmpegQueue = new Queue("video-ffmpeg", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 10000,
    },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

interface FFmpegJobData {
  jobId: string;
  videoId: string;
  r2Key: string;
  r2Bucket: string;
  commands: Array<{
    type: string;
    params?: Record<string, any>;
    ffmpegFilter?: string;
  }>;
  format?: string;
}

function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

async function downloadFromR2(r2Client: S3Client, bucket: string, key: string, outputPath: string) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await r2Client.send(command);
  
  if (!response.Body) {
    throw new Error("No body in response");
  }

  const streamToBuffer = (stream: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  };

  const buffer = await streamToBuffer(response.Body as any);
  fs.writeFileSync(outputPath, buffer);
}

async function uploadToR2(r2Client: S3Client, bucket: string, key: string, filePath: string, contentType: string) {
  const fileContent = fs.readFileSync(filePath);
  
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
  });

  await r2Client.send(command);
}

function buildFFmpegCommand(filters: string[], outputParams: Record<string, string>): string {
  const filterComplex = filters.filter(Boolean).join(",");
  const params = Object.entries(outputParams)
    .map(([key, value]) => `-${key} ${value}`)
    .join(" ");
  
  return `${filterComplex ? `-vf "${filterComplex}"` : ""} ${params}`;
}

export async function processWithFFmpeg(inputPath: string, outputPath: string, jobData: FFmpegJobData): Promise<void> {
  const filters: string[] = [];
  const outputParams: Record<string, string> = {};

  // Build filter chain based on commands
  for (const cmd of jobData.commands) {
    switch (cmd.type) {
      case "silence_removal":
        filters.push("silenceremove=start_periods=1:start_duration=0.5:start_threshold=-50dB");
        break;
      
      case "trim":
        const { start, end } = cmd.params || {};
        filters.push(`trim=start=${start}:end=${end}`);
        break;
      
      case "captions":
        if (cmd.params?.srtKey) {
          filters.push(`subtitles=${cmd.params.srtKey}`);
        }
        break;
      
      case "export":
        const preset = getFFmpegPreset(jobData.format || "mp4-h264");
        Object.assign(outputParams, preset);
        break;
    }
  }

  // Default codec if not set
  if (!outputParams.c) {
    outputParams.c = "libx264";
    outputParams.crf = "23";
    outputParams.pix_fmt = "yuv420p";
  }

  const ffmpegCommand = `ffmpeg -i "${inputPath}" ${buildFFmpegCommand(filters, outputParams)} -y "${outputPath}"`;
  
  console.log("Running FFmpeg:", ffmpegCommand);
  
  const { stdout, stderr } = await execAsync(ffmpegCommand);
  console.log("FFmpeg output:", stdout, stderr);
}

function getFFmpegPreset(format?: string): Record<string, string> {
  switch (format) {
    case "mp4-h265":
      return { c: "libx265", crf: "28", pix_fmt: "yuv420p10le" };
    case "mov-prores":
      return { c: "prores_ks", profile: "3", pix_fmt: "yuv422p10le" };
    default: // mp4-h264
      return { c: "libx264", crf: "23", pix_fmt: "yuv420p" };
  }
}

// Note: Worker processing is disabled for Vercel serverless
// For production, use a separate worker service or process inline
// export const processFFmpegJob = async (data: FFmpegJobData) => { ... }

console.log("FFmpeg queue initialized");
