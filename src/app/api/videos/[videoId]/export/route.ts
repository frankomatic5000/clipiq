import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const exportSchema = z.object({
  format: z.enum(["mp4-h264", "mp4-h265", "mov-prores"]),
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
    const validated = exportSchema.parse(body);

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

    // Create export job
    const ffmpegPreset = getFFmpegPreset(validated.format);

    const { data: editJob, error: jobError } = await supabase
      .from("edit_jobs")
      .insert({
        video_id: videoId,
        user_id: user.id,
        commands: [{ type: "export", format: validated.format }],
        status: "pending",
      })
      .select()
      .single();

    if (jobError) {
      console.error("Failed to create export job:", jobError);
      return NextResponse.json(
        { error: "Failed to create export job" },
        { status: 500 }
      );
    }

    // In production, queue with Bull here
    // For now, return job ID for polling
    return NextResponse.json({
      success: true,
      jobId: editJob.id,
      format: validated.format,
      preset: ffmpegPreset,
    });
  } catch (error) {
    console.error("Export error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid format", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to start export" },
      { status: 500 }
    );
  }
}

function getFFmpegPreset(format: string) {
  switch (format) {
    case "mp4-h264":
      return {
        codec: "libx264",
        crf: "23",
        preset: "medium",
        pixelFormat: "yuv420p",
      };
    case "mp4-h265":
      return {
        codec: "libx265",
        crf: "28",
        preset: "medium",
        pixelFormat: "yuv420p10le",
      };
    case "mov-prores":
      return {
        codec: "prores_ks",
        profile: "3", // ProRes 422 HQ
        pixelFormat: "yuv422p10le",
      };
    default:
      return {};
  }
}
