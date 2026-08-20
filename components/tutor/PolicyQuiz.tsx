"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { policyQuizQuestions, type QuizQuestion } from "@/constants/policy-quiz";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  ChevronRight,
  Sparkles,
  BookOpen,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Utility: Fisher-Yates shuffle                                      */
/* ------------------------------------------------------------------ */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
type Phase = "answering" | "feedback" | "complete";

export default function PolicyQuiz() {
  const t = useTranslations("tutorPages.policyQuiz");
  /* ---- state ---- */
  const [queue, setQueue] = useState<QuizQuestion[]>(policyQuizQuestions);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [wasCorrect, setWasCorrect] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [slideDir, setSlideDir] = useState<"in" | "out" | "idle">("idle");
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);

  const total = policyQuizQuestions.length;
  const current = queue[0] ?? null;
  const progress = completed.size / total;

  useEffect(() => {
    setQueue(shuffle(policyQuizQuestions));
    setMounted(true);
  }, []);

  /* ---- animations ---- */
  // Slide in when the current card changes
  useEffect(() => {
    setSlideDir("in");
    const t = setTimeout(() => setSlideDir("idle"), 350);
    return () => clearTimeout(t);
  }, [current?.id]);

  /* ---- handlers ---- */
  const handleCheck = useCallback(() => {
    if (selectedAnswer === null || !current) return;

    setTotalAttempts((a) => a + 1);
    const correct = selectedAnswer === current.correctIndex;
    setWasCorrect(correct);

    if (correct) {
      setCorrectCount((c) => c + 1);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }

    setPhase("feedback");
  }, [selectedAnswer, current]);

  const handleNext = useCallback(() => {
    if (!current) return;

    // Slide out animation
    setSlideDir("out");

    setTimeout(() => {
      if (wasCorrect) {
        // Pop from front, add to completed
        setCompleted((prev) => new Set(prev).add(current.id));
        setQueue((prev) => prev.slice(1));
      } else {
        // Move to a random position in the back half of the queue
        setQueue((prev) => {
          const rest = prev.slice(1);
          if (rest.length === 0) return [current];
          const minPos = Math.max(1, Math.floor(rest.length / 2));
          const insertAt = minPos + Math.floor(Math.random() * (rest.length - minPos + 1));
          const next = [...rest];
          next.splice(insertAt, 0, current);
          return next;
        });
      }

      setSelectedAnswer(null);
      setPhase("answering");
    }, 250);
  }, [current, wasCorrect]);

  const handleRestart = useCallback(() => {
    setQueue(shuffle(policyQuizQuestions));
    setCompleted(new Set());
    setSelectedAnswer(null);
    setPhase("answering");
    setTotalAttempts(0);
    setCorrectCount(0);
  }, []);

  /* ---- completion screen ---- */
  if (queue.length === 0 || phase === "complete") {
    const retries = totalAttempts - total;
    return (
      <main className="relative min-h-screen p-8 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl">
          <Card className="overflow-hidden border-0 bg-white shadow-lg">
            {/* celebration banner */}
            <div className="bg-gradient-to-br from-connect-me-blue-3 to-connect-me-blue-5 px-8 py-12 text-center text-white">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-white/20 p-4 backdrop-blur-sm">
                  <Trophy className="h-12 w-12 text-yellow-300" />
                </div>
              </div>
              <h1 className="mb-2 text-3xl font-bold">{t("complete.title")}</h1>
              <p className="text-lg text-blue-100">{t("complete.subtitle")}</p>
            </div>

            <CardContent className="space-y-6 p-8">
              {/* stats grid */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-xl bg-green-50 p-4">
                  <p className="text-2xl font-bold text-green-700">{total}</p>
                  <p className="text-sm text-green-600">{t("complete.questions")}</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-2xl font-bold text-blue-700">{totalAttempts}</p>
                  <p className="text-sm text-blue-600">{t("complete.totalAttempts")}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="text-2xl font-bold text-amber-700">{retries}</p>
                  <p className="text-sm text-amber-600">{t("complete.retriesNeeded")}</p>
                </div>
              </div>

              {retries === 0 ? (
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                  <Sparkles className="h-5 w-5 flex-shrink-0 text-green-600" />
                  <p className="text-sm text-green-800">
                    <strong>{t("complete.perfectTitle")}</strong> {t("complete.perfectBody")}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <BookOpen className="h-5 w-5 flex-shrink-0 text-blue-600" />
                  <p className="text-sm text-blue-800">{t("complete.goodJobBody")}</p>
                </div>
              )}
            </CardContent>

            <CardFooter className="border-t bg-gray-50 px-8 py-4">
              <Button variant="outline" onClick={handleRestart} className="w-full gap-2">
                <RotateCcw className="h-4 w-4" />
                {t("complete.retakeQuiz")}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    );
  }

  /* ---- quiz card ---- */
  const questionNumber = total - queue.length + 1;

  return (
    <main className="relative min-h-screen p-8 backdrop-blur-sm">
      <div className="mx-auto max-w-2xl">
        {/* header */}
        <div className="mb-8">
          <h1 className="mb-1 text-3xl font-bold">{t("heading")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        {/* progress bar */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-muted-foreground">
              {t("mastered", { completed: completed.size, total })}
            </span>
            <span className="font-medium text-muted-foreground">
              {t("remainingCount", { count: queue.length })}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-connect-me-blue-2 to-connect-me-blue-3 transition-all duration-500 ease-out"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* question card */}
        <div
          className={`transition-all duration-300 ${
            slideDir === "in"
              ? "animate-[slideIn_0.35s_ease-out]"
              : slideDir === "out"
                ? "animate-[slideOut_0.25s_ease-in_forwards]"
                : ""
          } ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
        >
          <Card className="overflow-hidden border bg-white shadow-md">
            <CardHeader className="border-b bg-gray-50/80 pb-4">
              <div className="flex items-center justify-between">
                <Badge
                  variant="secondary"
                  className={
                    current.category === "policy"
                      ? "bg-connect-me-blue-1 text-connect-me-blue-5"
                      : "bg-amber-100 text-amber-800"
                  }
                >
                  {current.category === "policy" ? t("categoryPolicy") : t("categoryFaq")}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {t("questionLabel", { number: questionNumber })}
                </span>
              </div>
              <CardTitle className="mt-3 text-lg leading-relaxed">{current.question}</CardTitle>
            </CardHeader>

            <CardContent className="p-6">
              <RadioGroup
                value={selectedAnswer !== null ? selectedAnswer.toString() : ""}
                onValueChange={(v) => {
                  if (phase === "answering") setSelectedAnswer(Number(v));
                }}
                className="space-y-3"
              >
                {current.options.map((option, idx) => {
                  let optionStyle = "";
                  if (phase === "feedback") {
                    if (idx === current.correctIndex) {
                      optionStyle = "border-green-300 bg-green-50 ring-1 ring-green-300";
                    } else if (idx === selectedAnswer && !wasCorrect) {
                      optionStyle = "border-red-300 bg-red-50 ring-1 ring-red-300";
                    }
                  } else if (selectedAnswer === idx) {
                    optionStyle =
                      "border-connect-me-blue-2 bg-blue-50/50 ring-1 ring-connect-me-blue-2";
                  }

                  return (
                    <Label
                      key={idx}
                      htmlFor={`option-${idx}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover:bg-gray-50 ${optionStyle}`}
                    >
                      <RadioGroupItem
                        value={idx.toString()}
                        id={`option-${idx}`}
                        disabled={phase === "feedback"}
                        className="mt-0.5"
                      />
                      <span className="text-sm leading-relaxed">{option}</span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </CardContent>

            {/* feedback banner */}
            {phase === "feedback" && (
              <div className={`border-t px-6 py-4 ${wasCorrect ? "bg-green-50" : "bg-red-50"}`}>
                <div className="flex items-start gap-3">
                  {wasCorrect ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-semibold ${wasCorrect ? "text-green-800" : "text-red-800"}`}
                    >
                      {wasCorrect ? t("correct") : t("incorrect")}
                    </p>
                    <p className={`mt-1 text-sm ${wasCorrect ? "text-green-700" : "text-red-700"}`}>
                      {current.explanation}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <CardFooter className="border-t bg-white px-6 py-4">
              {phase === "answering" ? (
                <Button
                  onClick={handleCheck}
                  disabled={selectedAnswer === null}
                  className="w-full gap-2 bg-connect-me-blue-3 hover:bg-connect-me-blue-4"
                >
                  {t("checkAnswer")}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className={`w-full gap-2 ${
                    wasCorrect
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-connect-me-blue-3 hover:bg-connect-me-blue-4"
                  }`}
                >
                  {queue.length <= 1 && wasCorrect ? t("finish") : t("next")}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* bottom hint */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {queue.length > 1
            ? t("remaining", { count: queue.length - 1 })
            : t("lastQuestion")}
        </p>
      </div>
    </main>
  );
}
