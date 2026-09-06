"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  LockKeyhole,
  MessageSquareText,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ORIENTATION_TRAINING_CLIPS } from "@/constants/orientation-training-clips";
import { cn } from "@/lib/utils";

export function ExperiencedTutorTraining() {
  const [clipIndex, setClipIndex] = useState(0);
  const [hasFinishedClip, setHasFinishedClip] = useState(false);
  const [reflection, setReflection] = useState("");
  const [reflectionSubmitted, setReflectionSubmitted] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const clip = ORIENTATION_TRAINING_CLIPS[clipIndex];
  const isFirstClip = clipIndex === 0;
  const isLastClip = clipIndex === ORIENTATION_TRAINING_CLIPS.length - 1;

  const selectClip = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= ORIENTATION_TRAINING_CLIPS.length) return;
    setClipIndex(nextIndex);
    setHasFinishedClip(false);
    setReflection("");
    setReflectionSubmitted(false);
    setVideoError(false);
  };

  return (
    <div className="p-4 sm:p-8">
      <header className="mx-auto mb-8 max-w-6xl">
        <div className="mb-3 flex items-center gap-2">
          <Video aria-hidden="true" className="h-7 w-7" />
          <h1 className="text-3xl font-bold">Experienced Tutor Examples</h1>
        </div>
        <p className="max-w-3xl text-muted-foreground">
          Watch real tutoring moments and reflect on the teaching decisions behind them. Your
          responses stay in this activity and are not saved.
        </p>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  Clip {clipIndex + 1} of {ORIENTATION_TRAINING_CLIPS.length}
                </span>
                <span>
                  Source {clip.sourceTime} · {clip.durationLabel}
                </span>
              </div>
              <CardTitle className="text-2xl">{clip.title}</CardTitle>
            </CardHeader>

            <div className="aspect-video bg-black">
              {videoError ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white">
                  This clip could not be loaded. Refresh the page and try again.
                </div>
              ) : (
                <video
                  aria-label={`${clip.title} training clip`}
                  className="h-full w-full object-contain"
                  controls
                  key={clip.src}
                  onEnded={() => setHasFinishedClip(true)}
                  onError={() => setVideoError(true)}
                  playsInline
                  preload="metadata"
                  src={clip.src}
                >
                  Your browser does not support embedded video.
                </video>
              )}
            </div>

            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start gap-3 rounded-lg border bg-blue-50 p-4 text-blue-950">
                <Lightbulb aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Teaching focus</p>
                  <p className="mt-1 text-sm leading-6">{clip.focus}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card aria-live="polite">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquareText aria-hidden="true" className="h-5 w-5" />
                <CardTitle>Self-Reflection</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {hasFinishedClip ? (
                <div className="space-y-4">
                  <p className="font-medium leading-7">{clip.reflectionPrompt}</p>
                  <div>
                    <label className="sr-only" htmlFor={`reflection-${clip.id}`}>
                      Your reflection
                    </label>
                    <Textarea
                      autoComplete="off"
                      id={`reflection-${clip.id}`}
                      onChange={(event) => {
                        setReflection(event.target.value);
                        setReflectionSubmitted(false);
                      }}
                      placeholder="Write your response here…"
                      rows={5}
                      value={reflection}
                    />
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
                      Your response is not saved.
                    </div>
                  </div>

                  <Button
                    disabled={!reflection.trim()}
                    onClick={() => setReflectionSubmitted(true)}
                    variant="outline"
                  >
                    Submit response
                  </Button>

                  {reflectionSubmitted && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-950">
                      Response submitted. Continue when you are ready.
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
                  <LockKeyhole aria-hidden="true" className="mb-3 h-5 w-5 text-muted-foreground" />
                  <p className="font-medium">Watch the full clip to unlock the reflection.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You can replay or scrub within the video at any time.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              disabled={isFirstClip}
              onClick={() => selectClip(clipIndex - 1)}
              variant="outline"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              Previous clip
            </Button>

            {isLastClip ? (
              <Button asChild>
                <Link href="/orientation">
                  Return to orientation
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button onClick={() => selectClip(clipIndex + 1)}>
                Next clip
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Button>
            )}
          </div>
        </main>

        <aside aria-label="Training clips">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle className="text-base">Clip Library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ORIENTATION_TRAINING_CLIPS.map((item, index) => (
                <button
                  className={cn(
                    "w-full rounded-md border px-3 py-3 text-left transition-colors",
                    index === clipIndex
                      ? "border-blue-300 bg-blue-50 text-blue-950"
                      : "hover:bg-muted/50",
                  )}
                  key={item.id}
                  onClick={() => selectClip(index)}
                  type="button"
                >
                  <span className="block text-xs text-muted-foreground">
                    {index + 1}. {item.durationLabel}
                  </span>
                  <span className="mt-0.5 block text-sm font-medium leading-5">{item.title}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
