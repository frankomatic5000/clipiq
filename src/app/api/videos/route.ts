import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const videoSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  r2Key: z.string(),
  r2Bucket: z.string().default("clipiq-videos"),
  fileSizeBytes: z.number().optional(),
  mimeType: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = videoSchema.parse(body);

    // Insert video record
    const { data: video, error: insertError } = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        title: validated.title,
        description: validated.description,
        r2_key: validated.r2Key,
        r2_bucket: validated.r2Bucket,
        file_size_bytes: validated.fileSizeBytes,
        mime_type: validated.mimeType,
        status: "uploaded",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save video metadata:", insertError);
      return NextResponse.json(
        { error: "Failed to save video metadata" },
        { status: 500 }
      );
    }

    return NextResponse.json({ video });
  } catch (error) {
    console.error("Video creation error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create video record" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: videos, error } = await supabase
      .from("videos")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch videos:", error);
      return NextResponse.json(
        { error: "Failed to fetch videos" },
        { status: 500 }
      );
    }

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Video fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
}
