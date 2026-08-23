"use client";

import { ChevronLeft, ChevronRight, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { ORIENTATION_SLIDES } from "@/constants/orientation-slides";
import { cn } from "@/lib/utils";

export interface OrientationSlideshowProps {
  className?: string;
}

function clampSlideIndex(index: number) {
  const safeIndex = Number.isFinite(index) ? Math.trunc(index) : 0;
  return Math.min(Math.max(safeIndex, 0), ORIENTATION_SLIDES.length - 1);
}

export function OrientationSlideshow({ className }: OrientationSlideshowProps) {
  const slideshowRef = useRef<HTMLElement>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);
  const isFullscreen = isNativeFullscreen || isFallbackFullscreen;
  const slide = ORIENTATION_SLIDES[slideIndex];
  const isFirstSlide = slideIndex === 0;
  const isLastSlide = slideIndex === ORIENTATION_SLIDES.length - 1;
  const slideNumber = slideIndex + 1;

  const goToSlide = useCallback((nextIndex: number) => {
    setSlideIndex(clampSlideIndex(nextIndex));
  }, []);

  const goBack = useCallback(() => {
    goToSlide(slideIndex - 1);
  }, [goToSlide, slideIndex]);

  const goForward = useCallback(() => {
    if (isLastSlide) {
      window.location.assign("/orientation");
      return;
    }

    goToSlide(slideIndex + 1);
  }, [goToSlide, isLastSlide, slideIndex]);

  useEffect(() => {
    const previousSlide = ORIENTATION_SLIDES[slideIndex - 1];
    const nextSlide = ORIENTATION_SLIDES[slideIndex + 1];

    for (const adjacentSlide of [previousSlide, nextSlide]) {
      if (!adjacentSlide) continue;
      const image = new window.Image();
      image.src = adjacentSlide;
    }
  }, [slideIndex]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(document.fullscreenElement === slideshowRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isFallbackFullscreen) {
      setIsFallbackFullscreen(false);
      return;
    }

    if (document.fullscreenElement === slideshowRef.current) {
      await document.exitFullscreen();
      return;
    }

    if (slideshowRef.current?.requestFullscreen) {
      try {
        await slideshowRef.current.requestFullscreen();
        return;
      } catch {
        // Fall through to the full-window presentation mode below.
      }
    }

    setIsFallbackFullscreen(true);
  }, [isFallbackFullscreen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        goBack();
      }

      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        goForward();
      }

      if (event.key === "Escape" && isFallbackFullscreen) {
        setIsFallbackFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goBack, goForward, isFallbackFullscreen]);

  return (
    <section
      aria-label="New tutor orientation"
      ref={slideshowRef}
      className={cn(
        "w-full overflow-hidden text-white",
        isFullscreen
          ? "fixed inset-0 z-[100] grid h-screen h-dvh grid-rows-[minmax(0,1fr)_3.25rem] bg-white"
          : "flex flex-col rounded-lg border border-black bg-white",
        className,
      )}
    >
      <h2 className="sr-only">Orientation slides</h2>

      <div
        className={cn(
          "relative overflow-hidden bg-white",
          isFullscreen ? "min-h-0" : "aspect-video w-full shrink-0",
        )}
      >
        <Image
          alt={`Connect Me tutor orientation slide ${slideNumber} of ${ORIENTATION_SLIDES.length}`}
          className="animate-in select-none object-contain fade-in duration-200"
          draggable={false}
          fill
          key={slide}
          priority={isFirstSlide}
          sizes="(min-width: 1536px) 1536px, 100vw"
          src={slide}
          unoptimized
        />

        <button
          aria-label="Previous slide"
          className="absolute inset-y-0 left-0 w-1/3 cursor-pointer disabled:cursor-default"
          disabled={isFirstSlide}
          onClick={goBack}
          tabIndex={-1}
          type="button"
        />
        <button
          aria-label={isLastSlide ? "Back to modules" : "Next slide"}
          className="absolute inset-y-0 right-0 w-2/3 cursor-pointer"
          onClick={goForward}
          tabIndex={-1}
          type="button"
        />
      </div>

      <nav
        aria-label="Orientation slide controls"
        className="relative z-20 flex h-[3.25rem] items-center justify-center border-t border-white/10 bg-zinc-950 px-4"
      >
        <div className="flex items-center gap-1">
          <button
            aria-label="Previous slide"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
            disabled={isFirstSlide}
            onClick={goBack}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </button>

          <span
            aria-live="polite"
            className="min-w-16 text-center text-sm font-medium tabular-nums text-zinc-200"
          >
            {slideNumber} / {ORIENTATION_SLIDES.length}
          </span>

          <button
            aria-label={isLastSlide ? "Back to modules" : "Next slide"}
            className="inline-flex h-9 min-w-9 items-center justify-center rounded-md px-1 text-zinc-200 transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={goForward}
            title={isLastSlide ? "Back to modules" : "Next slide"}
            type="button"
          >
            {isLastSlide ? (
              <span className="px-2 text-sm font-medium">Back to modules</span>
            ) : (
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>

        <div className="absolute right-4 flex items-center gap-1">
          <button
            aria-label="Restart orientation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => goToSlide(0)}
            title="Restart orientation"
            type="button"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => void toggleFullscreen()}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            type="button"
          >
            {isFullscreen ? (
              <Minimize2 aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Maximize2 aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>
      </nav>
    </section>
  );
}
