"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/upload/upload-zone";
import { signOut } from "@/lib/supabase/auth";

interface Video {
  id: string;
  title: string;
  status: string;
  created_at: string;
  mime_type?: string;
}

export default function DashboardPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
  }, []);

  async function fetchVideos() {
    try {
      const response = await fetch("/api/videos");
      if (response.ok) {
        const { videos } = await response.json();
        setVideos(videos);
      }
    } catch (error) {
      console.error("Failed to fetch videos:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleUploadComplete(videoId: string) {
    // Refresh the video list
    fetchVideos();
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
            <Button variant="ghost" size="sm" asChild>
              <Link href="/editor">New Project</Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-8 px-4 md:px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Upload Section */}
          <section>
            <h1 className="text-3xl font-bold mb-2">Your Videos</h1>
            <p className="text-muted-foreground mb-6">
              Upload a video to start editing with AI
            </p>
            <UploadZone onUploadComplete={handleUploadComplete} />
          </section>

          {/* Videos Grid */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Recent Uploads</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
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
            ) : videos.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/30">
                <svg
                  className="mx-auto h-12 w-12 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium">No videos yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Upload your first video to get started
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((video) => (
                  <Link
                    key={video.id}
                    href={`/editor/${video.id}`}
                    className="group block rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    <div className="aspect-video rounded-md bg-muted mb-3 flex items-center justify-center">
                      <svg
                        className="h-12 w-12 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                      {video.title}
                    </h3>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(video.created_at).toLocaleDateString()}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          video.status === "transcribed"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : video.status === "processing"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {video.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
