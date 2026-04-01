import { transcriptionQueue, TranscriptionJobData, TranscriptionJobResult } from "@/lib/queue/transcription";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

// R2 Client
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

async function transcribeWithWhisper(videoPath: string, outputDir: string): Promise<{ srtPath: string; transcript: string; duration: number }> {
  // Use faster-whisper Python package
  const pythonScript = `
import sys
from faster_whisper import WhisperModel

video_path = sys.argv[1]
output_dir = sys.argv[2]

# Load model (use 'base' for speed, 'medium' or 'large' for accuracy)
model = WhisperModel("base", device="cpu", compute_type="int8")

# Transcribe
segments, info = model.transcribe(video_path, beam_size=5)

# Generate SRT
srt_path = f"{output_dir}/transcript.srt"
with open(srt_path, "w", encoding="utf-8") as f:
    for i, segment in enumerate(segments, start=1):
        start = format_timestamp(segment.start)
        end = format_timestamp(segment.end)
        text = segment.text.strip()
        f.write(f"{i}\\n{start} --> {end}\\n{text}\\n\\n")

# Generate plain transcript
transcript_path = f"{output_dir}/transcript.txt"
with open(transcript_path, "w", encoding="utf-8") as f:
    segments, _ = model.transcribe(video_path, beam_size=5)
    for segment in segments:
        f.write(segment.text + " ")

print(f"DURATION:{info.duration}")

def format_timestamp(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
`;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "whisper-"));
  
  try {
    // Write Python script
    const scriptPath = path.join(tempDir, "transcribe.py");
    fs.writeFileSync(scriptPath, pythonScript);

    // Run transcription
    const { stdout } = await execAsync(`python3 ${scriptPath} "${videoPath}" "${tempDir}"`);
    
    // Parse duration from output
    const durationMatch = stdout.match(/DURATION:(\d+)/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 0;

    return {
      srtPath: path.join(tempDir, "transcript.srt"),
      transcript: fs.readFileSync(path.join(tempDir, "transcript.txt"), "utf-8"),
      duration,
    };
  } catch (error) {
    console.error("Transcription failed:", error);
    throw error;
  } finally {
    // Cleanup temp files
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// Process transcription jobs
transcriptionQueue.process(async (job, progress) => {
  const data = job.data as TranscriptionJobData;
  const r2Client = createR2Client();
  
  try {
    await progress(10);
    console.log(`Starting transcription for video ${data.videoId}`);

    // Create temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clipiq-"));
    const videoPath = path.join(tempDir, "input.mp4");

    try {
      // Download video from R2
      await progress(20);
      console.log("Downloading video from R2...");
      await downloadFromR2(r2Client, data.r2Bucket, data.r2Key, videoPath);

      // Transcribe with Whisper
      await progress(30);
      console.log("Transcribing with Whisper...");
      const result = await transcribeWithWhisper(videoPath, tempDir);

      // Upload SRT to R2
      await progress(80);
      console.log("Uploading SRT to R2...");
      const srtKey = data.r2Key.replace(/\.[^/.]+$/, "") + ".srt";
      await uploadToR2(r2Client, data.r2Bucket, srtKey, result.srtPath, "text/srt");

      // Update Supabase with transcript info
      await progress(90);
      console.log("Updating database...");
      const supabase = await createClient();
      await supabase
        .from("videos")
        .update({
          status: "transcribed",
          transcript_srt_key: srtKey,
          duration_seconds: result.duration,
          metadata: {
            transcript: result.transcript,
          },
        })
        .eq("id", data.videoId);

      await progress(100);
      console.log(`Transcription complete for video ${data.videoId}`);

      return {
        srtKey,
        transcript: result.transcript,
        duration: result.duration,
      } as TranscriptionJobResult;
    } finally {
      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`Transcription failed for video ${data.videoId}:`, error);
    
    // Update status to failed
    const supabase = await createClient();
    await supabase
      .from("videos")
      .update({
        status: "failed",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      })
      .eq("id", data.videoId);

    throw error;
  }
});

console.log("Transcription worker started");
