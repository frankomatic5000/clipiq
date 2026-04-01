"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type ExportFormat = "mp4-h264" | "mp4-h265" | "mov-prores";

interface ExportOption {
  id: ExportFormat;
  label: string;
  description: string;
  icon: string;
  recommended?: boolean;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: "mp4-h264",
    label: "MP4 (H.264)",
    description: "Best for YouTube, social media, web playback",
    icon: "📹",
    recommended: true,
  },
  {
    id: "mp4-h265",
    label: "MP4 (H.265/HEVC)",
    description: "Higher quality, smaller file size",
    icon: "✨",
  },
  {
    id: "mov-prores",
    label: "MOV (ProRes)",
    description: "Professional editing, highest quality",
    icon: "🎬",
  },
];

export default function ExportPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.videoId as string;
  
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  async function handleExport(format: ExportFormat) {
    setSelectedFormat(format);
    setProcessing(true);
    setProgress(0);

    try {
      const response = await fetch(`/api/videos/${videoId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Poll for progress
      const pollInterval = setInterval(async () => {
        const progressResponse = await fetch(`/api/videos/${videoId}/export/status`);
        if (progressResponse.ok) {
          const { progress: newProgress, downloadUrl: url, status } = await progressResponse.json();
          setProgress(newProgress);
          
          if (status === "completed" && url) {
            setDownloadUrl(url);
            clearInterval(pollInterval);
            setProcessing(false);
          } else if (status === "failed") {
            throw new Error("Export failed");
          }
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setProcessing(false);
      }, 300000);
    } catch (error) {
      console.error("Export error:", error);
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-primary">Clip</span>
            <span className="text-foreground">IQ</span>
          </Link>
          <Link href={`/editor/${videoId}`}>
            <Button variant="ghost" size="sm">Back to Editor</Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-12 px-4 md:px-6">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Export Your Video</h1>
            <p className="text-muted-foreground">
              Choose your preferred format and quality settings
            </p>
          </div>

          {downloadUrl ? (
            /* Download Success */
            <div className="rounded-lg border bg-card p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
                <svg
                  className="h-8 w-8 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Ready for Download!</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Your video has been processed and is ready to download.
                </p>
                <Button size="lg" asChild>
                  <a href={downloadUrl} download>
                    <svg
                      className="mr-2 h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download Video
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This download link will expire in 24 hours
              </p>
            </div>
          ) : processing ? (
            /* Processing */
            <div className="rounded-lg border bg-card p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-6 w-6 text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <h2 className="text-xl font-semibold">Processing Your Video</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  This may take a few minutes depending on video length
                </p>
              </div>
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-center text-muted-foreground">
                  {progress}% complete
                </p>
              </div>
            </div>
          ) : (
            /* Format Selection */
            <div className="space-y-4">
              {EXPORT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleExport(option.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedFormat === option.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{option.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{option.label}</h3>
                          {option.recommended && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {option.description}
                        </p>
                      </div>
                    </div>
                    <svg
                      className="h-5 w-5 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
