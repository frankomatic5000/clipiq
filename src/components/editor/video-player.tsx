"use client";

import { useRef, useState, useEffect } from "react";
import ReactPlayer from "react-player";

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface VideoPlayerProps {
  videoUrl: string;
  transcript?: TranscriptSegment[];
  onTimeChange?: (time: number) => void;
  highlightedSegment?: number;
}

export function VideoPlayer({
  videoUrl,
  transcript,
  onTimeChange,
  highlightedSegment,
}: VideoPlayerProps) {
  const playerRef = useRef<ReactPlayer>(null);
  const [playing, setPlaying] = useState(false);
  [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const handleProgress = ({ playedSeconds }: { playedSeconds: number }) => {
    setCurrentTime(playedSeconds);
    onTimeChange?.(playedSeconds);
  };

  const handleDuration = (dur: number) => {
    setDuration(dur);
  };

  const jumpToTime = (seconds: number) => {
    playerRef.current?.seekTo(seconds);
    setCurrentTime(seconds);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Auto-scroll transcript to current segment
  useEffect(() => {
    if (highlightedSegment !== undefined && transcriptRef.current) {
      const element = transcriptRef.current.querySelector(
        `[data-segment-index="${highlightedSegment}"]`
      );
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [highlightedSegment]);

  return (
    <div className="space-y-4">
      {/* Video Player */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <ReactPlayer
          ref={playerRef}
          url={videoUrl}
          width="100%"
          height="100%"
          playing={playing}
          controls={false}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onProgress={handleProgress}
          onDuration={handleDuration}
          config={{
            file: {
              attributes: {
                controlsList: "nodownload",
              },
            },
          }}
        />
        
        {/* Custom Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPlaying(!playing)}
              className="text-white hover:text-primary transition-colors"
            >
              {playing ? (
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            
            {/* Progress Bar */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs text-white tabular-nums">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => jumpToTime(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
              />
              <span className="text-xs text-white tabular-nums">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transcript */}
      {transcript && transcript.length > 0 && (
        <div
          ref={transcriptRef}
          className="max-h-48 overflow-y-auto border rounded-lg p-4 space-y-2 bg-muted/30"
        >
          <h3 className="text-sm font-semibold mb-2">Transcript</h3>
          {transcript.map((segment, index) => (
            <div
              key={index}
              data-segment-index={index}
              onClick={() => jumpToTime(segment.start)}
              className={`text-sm p-2 rounded cursor-pointer transition-colors ${
                index === highlightedSegment
                  ? "bg-primary/20 border-l-2 border-primary"
                  : "hover:bg-muted"
              }`}
            >
              <span className="text-xs text-muted-foreground mr-2">
                {formatTime(segment.start)}
              </span>
              <span className="text-foreground">{segment.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
