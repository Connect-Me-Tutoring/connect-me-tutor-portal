"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  MessageSquareText,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ORIENTATION_TRAINING_CLIPS } from "@/constants/orientation-training-clips";
import {
  readOrientationTrainingProgress,
  writeOrientationTrainingProgress,
} from "@/lib/orientation/training-progress";
import { cn } from "@/lib/utils";

const SEEK_TOLERANCE_SECONDS = 0.5;

export function clampUnwatchedSeek(
  requestedTime: number,
  furthestWatchedTime: number,
  hasWatchedClip: boolean,
) {
  if (hasWatchedClip || requestedTime <= furthestWatchedTime + SEEK_TOLERANCE_SECONDS) {
    return requestedTime;
  }

  return furthestWatchedTime;
}

export function ExperiencedTutorTraining({ profileId }: { profileId: string }) {
  const [clipIndex, setClipIndex] = useState(0);
  const [watchedClipIds, setWatchedClipIds] = useState<Set<string>>(new Set());
  const [completedClipIds, setCompletedClipIds] = useState<Set<string>>(new Set());
  const [reflections, setReflections] = useState<Record<string, string>>({});
  const [furthestWatchedSeconds, setFurthestWatchedSeconds] = useState<Record<string, number>>({});
  const [hydratedProfileId, setHydratedProfileId] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const furthestWatchedTimeRef = useRef(0);

  const clip = ORIENTATION_TRAINING_CLIPS[clipIndex];
  const isFirstClip = clipIndex === 0;
  const isLastClip = clipIndex === ORIENTATION_TRAINING_CLIPS.length - 1;
  const hasFinishedClip = watchedClipIds.has(clip.id);
  const reflection = reflections[clip.id] ?? "";
  const reflectionSubmitted = completedClipIds.has(clip.id);
  const isProgressHydrated = hydratedProfileId === profileId;

  useEffect(() => {
    const savedProgress = readOrientationTrainingProgress(window.localStorage, profileId);
    const savedClipIndex = ORIENTATION_TRAINING_CLIPS.findIndex(
      (item) => item.id === savedProgress.activeClipId,
    );
    const restoredClipIndex = savedClipIndex >= 0 ? savedClipIndex : 0;
    const restoredClip = ORIENTATION_TRAINING_CLIPS[restoredClipIndex];
    const restoredTime = savedProgress.furthestWatchedSeconds[restoredClip.id] ?? 0;

    setClipIndex(restoredClipIndex);
    setWatchedClipIds(new Set(savedProgress.watchedClipIds));
    setCompletedClipIds(new Set(savedProgress.completedClipIds));
    setReflections(savedProgress.reflections);
    setFurthestWatchedSeconds(savedProgress.furthestWatchedSeconds);
    furthestWatchedTimeRef.current = restoredTime;

    const currentVideo = videoRef.current;
    if (currentVideo?.dataset.clipId === restoredClip.id && currentVideo.readyState >= 1) {
      currentVideo.currentTime = Math.min(restoredTime, currentVideo.duration);
    }

    setHydratedProfileId(profileId);
  }, [profileId]);

  useEffect(() => {
    if (!isProgressHydrated) return;

    writeOrientationTrainingProgress(window.localStorage, profileId, {
      activeClipId: clip.id,
      completedClipIds: Array.from(completedClipIds),
      furthestWatchedSeconds,
      reflections,
      watchedClipIds: Array.from(watchedClipIds),
    });
  }, [
    clip.id,
    completedClipIds,
    furthestWatchedSeconds,
    isProgressHydrated,
    profileId,
    reflections,
    watchedClipIds,
  ]);

  const recordVideoProgress = (video: HTMLVideoElement, force = false) => {
    if (video.seeking) return;

    const nextProgress = Math.max(furthestWatchedTimeRef.current, video.currentTime);
    furthestWatchedTimeRef.current = nextProgress;
    setFurthestWatchedSeconds((current) => {
      const savedProgress = current[clip.id] ?? 0;
      if (nextProgress <= savedProgress || (!force && nextProgress - savedProgress < 1)) {
        return current;
      }

      return { ...current, [clip.id]: nextProgress };
    });
  };

  const selectClip = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= ORIENTATION_TRAINING_CLIPS.length || nextIndex === clipIndex)
      return;

    if (videoRef.current) recordVideoProgress(videoRef.current, true);

    const nextClip = ORIENTATION_TRAINING_CLIPS[nextIndex];
    setClipIndex(nextIndex);
    setVideoError(false);
    furthestWatchedTimeRef.current = furthestWatchedSeconds[nextClip.id] ?? 0;
  };

  const handleTimeUpdate = (event: SyntheticEvent<HTMLVideoElement>) => {
    recordVideoProgress(event.currentTarget);
  };

  const handleSeeking = (event: SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    const allowedTime = clampUnwatchedSeek(
      video.currentTime,
      furthestWatchedTimeRef.current,
      hasFinishedClip,
    );

    if (allowedTime !== video.currentTime) {
      video.currentTime = allowedTime;
    }
  };

  const markClipWatched = (event: SyntheticEvent<HTMLVideoElement>) => {
    const { duration } = event.currentTarget;
    furthestWatchedTimeRef.current = duration;
    setFurthestWatchedSeconds((current) => ({
      ...current,
      [clip.id]: duration,
    }));
    setWatchedClipIds((current) => new Set(current).add(clip.id));
  };

  const resumeSavedProgress = (event: SyntheticEvent<HTMLVideoElement>) => {
    const savedProgress = furthestWatchedSeconds[clip.id] ?? 0;
    furthestWatchedTimeRef.current = savedProgress;

    if (savedProgress > 0 && savedProgress < event.currentTarget.duration) {
      event.currentTarget.currentTime = savedProgress;
    }
  };

  const updateReflection = (value: string) => {
    setReflections((current) => ({ ...current, [clip.id]: value }));
    setCompletedClipIds((current) => {
      if (!current.has(clip.id)) return current;

      const next = new Set(current);
      next.delete(clip.id);
      return next;
    });
  };

  const submitReflection = () => {
    if (!reflection.trim()) return;
    setCompletedClipIds((current) => new Set(current).add(clip.id));
  };

  return (
    <div className="p-4 sm:p-8">
      <header className="mx-auto mb-8 max-w-6xl">
        <div className="mb-3 flex items-center gap-2">
          <Video aria-hidden="true" className="h-7 w-7" />
          <h1 className="text-3xl font-bold">Experienced Tutor Examples</h1>
        </div>
        <p className="max-w-3xl text-muted-foreground">
          Watch real tutoring moments and reflect on the teaching decisions behind them.
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
                {reflectionSubmitted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 font-medium text-green-700">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                    Completed
                  </span>
                )}
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
                  data-clip-id={clip.id}
                  key={clip.src}
                  onEnded={markClipWatched}
                  onError={() => setVideoError(true)}
                  onLoadedMetadata={resumeSavedProgress}
                  onPause={(event) => recordVideoProgress(event.currentTarget, true)}
                  onSeeking={handleSeeking}
                  onTimeUpdate={handleTimeUpdate}
                  playsInline
                  preload="metadata"
                  ref={videoRef}
                  src={clip.src}
                >
                  Your browser does not support embedded video.
                </video>
              )}
            </div>
          </Card>

          <Card aria-live="polite">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquareText aria-hidden="true" className="h-5 w-5" />
                <CardTitle>Self-Reflection</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">
                  Reflection question
                </p>
                <p className="font-medium leading-7">{clip.reflectionPrompt}</p>
              </div>

              {hasFinishedClip ? (
                <div className="space-y-4">
                  <div>
                    <label className="sr-only" htmlFor={`reflection-${clip.id}`}>
                      Your reflection
                    </label>
                    <Textarea
                      autoComplete="off"
                      id={`reflection-${clip.id}`}
                      onChange={(event) => updateReflection(event.target.value)}
                      maxLength={4000}
                      placeholder="Write your response here…"
                      rows={5}
                      value={reflection}
                    />
                  </div>

                  <Button
                    disabled={!reflection.trim()}
                    onClick={submitReflection}
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
                    You can replay any part you have already watched.
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
                  {completedClipIds.has(item.id) && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green-700">
                      <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                      Completed
                    </span>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
