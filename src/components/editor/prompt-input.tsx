"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface Suggestion {
  label: string;
  command: string;
  icon: string;
}

interface PromptInputProps {
  onCommandSubmit?: (command: string) => void;
  isProcessing?: boolean;
}

const SUGGESTIONS: Suggestion[] = [
  {
    label: "Remove silence",
    command: "remove silence",
    icon: "🔇",
  },
  {
    label: "Add captions",
    command: "add captions",
    icon: "📝",
  },
  {
    label: "Trim clip",
    command: "trim 0:00 to 0:30",
    icon: "✂️",
  },
  {
    label: "Improve hook",
    command: "suggest better hook",
    icon: "💡",
  },
];

export function PromptInput({ onCommandSubmit, isProcessing }: PromptInputProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Send command to parent
    onCommandSubmit?.(userMessage.content);

    // Simulate AI response (will be replaced with actual API call)
    setTimeout(() => {
      const assistantMessage: Message = {
        role: "assistant",
        content: generateAIResponse(userMessage.content),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 1000);
  };

  const handleSuggestionClick = (command: string) => {
    setInput(command);
    textareaRef.current?.focus();
  };

  const generateAIResponse = (command: string): string => {
    // Simple command parser - will be enhanced with actual AI
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes("silence") || lowerCommand.includes("pause")) {
      return "I'll remove silent sections from your video. This will use FFmpeg's silencedetect and silenceremove filters to identify and cut out pauses longer than 0.5 seconds.";
    }

    if (lowerCommand.includes("caption") || lowerCommand.includes("subtitle")) {
      return "I'll add captions to your video using the transcript. The text will be burned in with styling that matches your brand.";
    }

    if (lowerCommand.includes("trim") || lowerCommand.includes("cut")) {
      return "I'll trim your video to the specified timestamps. Let me know the exact start and end times you want.";
    }

    if (lowerCommand.includes("hook") || lowerCommand.includes("intro") || lowerCommand.includes("opening")) {
      return "Based on your content, I suggest starting with the most engaging moment at 0:15 where you mention the key benefit. Want me to move that to the beginning?";
    }

    return "I've processed your request. What would you like to do next?";
  };

  return (
    <div className="flex flex-col h-full bg-card border rounded-lg">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">
              Ask me to edit your video. Try one of these:
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-60 mt-1">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="border-t p-3">
          <p className="text-xs text-muted-foreground mb-2">Quick actions:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleSuggestionClick(suggestion.command)}
                className="text-xs"
              >
                <span className="mr-1">{suggestion.icon}</span>
                {suggestion.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a command... (e.g., &quot;Remove all pauses&quot;, &quot;Add captions&quot;, &quot;Trim to 30 seconds&quot;)"
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            rows={1}
            disabled={isProcessing}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button type="submit" disabled={!input.trim() || isProcessing}>
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </form>
    </div>
  );
}
