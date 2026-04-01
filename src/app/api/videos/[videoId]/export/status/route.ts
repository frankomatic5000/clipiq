import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ videoId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Get most recent export job for this video
    const { data: jobs, error } = await supabase
      .from("edit_jobs")
      .select("*")
      .eq("video_id", videoId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !jobs || jobs.length === 0) {
      return NextResponse.json(
        { error: "No export job found" },
        { status: 404 }
      );
    }

    const job = jobs[0];

    // Generate download URL if completed
    let downloadUrl = null;
    if (job.status === "completed" && job.output_r2_key) {
      // In production, generate a signed R2 URL here
      downloadUrl = `https://your-r2-bucket.r2.cloudflarestorage.com/${job.output_r2_key}`;
    }

    return NextResponse.json({
      status: job.status,
      progress: job.progress_percent || 0,
      downloadUrl,
      error: job.error_message,
    });
  } catch (error) {
    console.error("Export status error:", error);
    return NextResponse.json(
      { error: "Failed to get export status" },
      { status: 500 }
    );
  }
}
