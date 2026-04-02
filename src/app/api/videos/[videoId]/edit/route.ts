import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const editCommandSchema = z.object({
  command: z.string().min(1),
});

interface RouteParams {
  params: Promise<{ videoId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { videoId } = await params;
    const body = await request.json();
    const validated = editCommandSchema.parse(body);

    // Verify video belongs to user
    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .eq("user_id", user.id)
      .single();

    if (videoError || !video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    // Parse command and create FFmpeg job
    const parsedCommand = parseEditCommand(validated.command, video);

    // Create edit job in database
    const { data: editJob, error: jobError } = await supabase
      .from("edit_jobs")
      .insert({
        video_id: videoId,
        user_id: user.id,
        commands: [parsedCommand],
        status: "pending",
      })
      .select()
      .single();

    if (jobError) {
      console.error("Failed to create edit job:", jobError);
      return NextResponse.json(
        { error: "Failed to create edit job" },
        { status: 500 }
      );
    }

    // In production, queue the job with Bull here
    // For now, return success
    return NextResponse.json({
      success: true,
      jobId: editJob.id,
      message: "Edit command queued for processing",
      parsedCommand,
    });
  } catch (error) {
    console.error("Edit command error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid command", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process command" },
      { status: 500 }
    );
  }
}

// Simple command parser - will be enhanced with AI
function parseEditCommand(command: string, video: any) {
  const lowerCommand = command.toLowerCase();
  
  // Silence removal
  if (lowerCommand.includes("silence") || lowerCommand.includes("pause")) {
    return {
      type: "silence_removal",
      params: {
        threshold: "-50dB",
        minimumDuration: 0.5,
      },
      ffmpegFilter: "silenceremove=start_periods=1:start_duration=0.5:start_threshold=-50dB",
    };
  }

  // Caption burn-in
  if (lowerCommand.includes("caption") || lowerCommand.includes("subtitle")) {
    return {
      type: "captions",
      params: {
        srtKey: video.transcript_srt_key,
        style: "default",
      },
      ffmpegFilter: `subtitles=${video.transcript_srt_key}`,
    };
  }

  // Trim/cut
  const trimMatch = lowerCommand.match(/trim\s*(\d+):(\d+)\s*(?:to|until|-)\s*(\d+):(\d+)/);
  if (trimMatch || lowerCommand.includes("trim")) {
    return {
      type: "trim",
      params: {
        start: trimMatch ? `${trimMatch[1]}:${trimMatch[2]}` : "0:00",
        end: trimMatch ? `${trimMatch[3]}:${trimMatch[4]}` : "0:30",
      },
      ffmpegFilter: "trim=start=0:end=30",
    };
  }

  // Format conversion
  if (lowerCommand.includes("convert") || lowerCommand.includes("format")) {
    return {
      type: "convert",
      params: {
        format: "mp4",
        codec: "libx264",
      },
    };
  }

  // Default: unknown command
  return {
    type: "unknown",
    originalCommand: command,
    message: "Command recognized but not yet implemented",
  };
}
