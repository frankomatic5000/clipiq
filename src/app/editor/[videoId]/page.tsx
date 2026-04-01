"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PromptInput } from "@/components/editor/prompt-input";
import { VideoPlayer } from "@/components/editor/video-player";
import { signOut } from "@/lib/supabase/auth";

interface Video {
  id: string;
  title: string;
  status: string;
  r2_key: string;
  duration_seconds?: number;
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export default function EditorPage() {
  const params = useParams();
  const videoId = params.videoId as string;
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<number>(-1);
  const [videoUrl, setVideoUrl] = useState<string>("");

  useEffect(() => {
    fetchVideo();
  }, [videoId]);

  async function fetchVideo() {
    try {
      // In production, you'd fetch from an API endpoint
      // For now, we'll mock this
      const response = await fetch(`/api/videos/${videoId}`);
      if (response.ok) {
        const data = await response.json();
        setVideo(data.video);
        
        // Generate signed URL for video playback
        // This would be a separate API endpoint
        setVideoUrl(`https://your-r2-bucket.r2.cloudflarestorage.com/${data.video.r2_key}`);
        
        // Load transcript if available
        if (data.video.transcript_srt_key) {
          await loadTranscript(data.video.transcript_srt_key);
        }
      }
    } catch (error) {
      console.error("Failed to fetch video:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTranscript(srtKey: string) {
    // Parse SRT file - in production, fetch from R2
    // Mock transcript for now
    const mockTranscript: TranscriptSegment[] = [
      { start: 0, end: 5, text: "Welcome to this video tutorial." },
      { start: 5, end: 10, text: "Today we're going to learn about AI video editing." },
      { start: 10, end: 15, text: "Let's get started with the basics." },
    ];
    setTranscript(mockTranscript);
  }

  async function handleCommand(command: string) {
    setProcessing(true);
    
    try {
      // Send command to API for processing
      const response = await fetch(`/api/videos/${videoId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Edit result:", result);
        // Refresh video if needed
      }
    } catch (error) {
      console.error("Command failed:", error);
    } finally {
      setProcessing(false);
    }
  }

  function handleTimeChange(time: number) {
    // Find current transcript segment
    const segmentIndex = transcript.findIndex(
      (seg) => time >= seg.start && time < seg.end
    );
    setCurrentSegment(segmentIndex);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg
          className="animate-spin h-8 w-8 text-primary"
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
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">Video not found</h1>
        <Button asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
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
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {video.title}
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/editor/${videoId}/export`}>Export</Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Editor */}
      <main className="flex-1 container py-6 px-4 md:px-6">
        <div className="grid lg:grid-cols-3 gap-6 h-full">
          {/* Left: Video Player */}
          <div className="lg:col-span-2 space-y-4">
            <VideoPlayer
              videoUrl={videoUrl || "/placeholder.mp4"}
              transcript={transcript}
              onTimeChange={handleTimeChange}
              highlightedSegment={currentSegment}
            />
            
            {/* Edit History / Commands */}
            <div className="border rounded-lg p-4 bg-card">
              <h3 className="text-sm font-semibold mb-2">Edit Commands</h3>
              <p className="text-xs text-muted-foreground">
                Your edit commands will appear here as a timeline
              </p>
            </div>
          </div>

          {/* Right: Prompt Interface */}
          <div className="lg:col-span-1">
            <PromptInput
              onCommandSubmit={handleCommand}
              isProcessing={processing}
            />
            
            {/* AI Suggestions Panel */}
            <div className="mt-4 border rounded-lg p-4 bg-card">
              <h3 className="text-sm font-semibold mb-3">AI Suggestions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleCommand("Remove awkward pause at 0:45")}
                  className="w-full text-left text-xs p-2 rounded hover:bg-muted transition-colors"
                >
                  🔇 Remove awkward pause at 0:45
                </button>
                <button
                  onClick={() => handleCommand("Add captions")}
                  className="w-full text-left text-xs p-2 rounded hover:bg-muted transition-colors"
                >
                  📝 Add captions to entire video
                </button>
                <button
                  onClick={() => handleCommand("Suggest better hook")}
                  className="w-full text-left text-xs p-2 rounded hover:bg-muted transition-colors"
                >
                  💡 Suggest a better opening hook
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
