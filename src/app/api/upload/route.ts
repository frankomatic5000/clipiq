import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

const uploadSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  fileSize: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = uploadSchema.parse(body);

    // Create R2 client
    const r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    // Generate unique key for the video
    const fileKey = `videos/${user.id}/${Date.now()}-${validated.filename}`;
    const bucketName = process.env.R2_BUCKET_NAME || "clipiq-videos";

    // Create signed URL for upload
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      ContentType: validated.contentType,
      ContentLength: validated.fileSize,
    });

    const signedUrl = await getSignedUrl(r2Client, putCommand, {
      expiresIn: 3600, // 1 hour
    });

    return NextResponse.json({
      uploadUrl: signedUrl,
      fileKey,
      bucketName,
    });
  } catch (error) {
    console.error("Upload error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
