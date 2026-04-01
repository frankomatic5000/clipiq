import Queue from "bull";
import { Redis } from "ioredis";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

// Redis connection
const redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// FFmpeg processing queue
export const ffmpegQueue = new Queue("video-ffmpeg", {
  redis: redisConnection,
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

async function processWithFFmpeg(inputPath: string, outputPath: string, jobData: FFmpegJobData): Promise<void> {
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
          // SRT file should be downloaded first
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

// Process FFmpeg jobs
ffmpegQueue.process(async (job, progress) => {
  const data = job.data as FFmpegJobData;
  const r2Client = createR2Client();
  
  try {
    await progress(10);
    console.log(`Starting FFmpeg processing for job ${data.jobId}`);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clipiq-ffmpeg-"));
    const inputPath = path.join(tempDir, "input.mp4");
    const outputPath = path.join(tempDir, "output.mp4");

    try {
      // Download source video
      await progress(20);
      console.log("Downloading source video...");
      await downloadFromR2(r2Client, data.r2Bucket, data.r2Key, inputPath);

      // If there's an SRT file for captions, download it too
      if (data.commands.some(c => c.type === "captions" && c.params?.srtKey)) {
        const srtCmd = data.commands.find(c => c.type === "captions");
        const srtPath = path.join(tempDir, "subtitles.srt");
        await downloadFromR2(r2Client, data.r2Bucket, srtCmd!.params.srtKey, srtPath);
      }

      // Process with FFmpeg
      await progress(40);
      console.log("Processing with FFmpeg...");
      await processWithFFmpeg(inputPath, outputPath, data);

      // Upload processed video
      await progress(80);
      console.log("Uploading processed video...");
      const outputKey = data.r2Key.replace(/\.[^/.]+$/, "") + "_processed.mp4";
      await uploadToR2(r2Client, data.r2Bucket, outputKey, outputPath, "video/mp4");

      // Update database
      await progress(90);
      console.log("Updating database...");
      const supabase = await createSupabaseClient();
      await supabase
        .from("edit_jobs")
        .update({
          status: "completed",
          output_r2_key: outputKey,
          progress_percent: 100,
        })
        .eq("id", data.jobId);

      // Also update video status
      await supabase
        .from("videos")
        .update({
          status: "processed",
        })
        .eq("id", data.videoId);

      await progress(100);
      console.log(`FFmpeg processing complete for job ${data.jobId}`);
    } finally {
      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`FFmpeg processing failed for job ${data.jobId}:`, error);
    
    // Update status to failed
    const supabase = await createSupabaseClient();
    await supabase
      .from("edit_jobs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", data.jobId);

    throw error;
  }
});

console.log("FFmpeg worker started");
