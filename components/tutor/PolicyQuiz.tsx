"use client";

import React, { useState, useCallback, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { policyQuizQuestions, type QuizQuestion } from "@/constants/policy-quiz";
// TODO: wire up backend when ready
// import { submitQuizCompletion } from "@/lib/actions/orientation/server.actions";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  ChevronRight,
  Sparkles,
  BookOpen,
  MessageSquare,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

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
type Phase = "answering" | "feedback" | "questions" | "complete";

export default function PolicyQuiz() {
  /* ---- state ---- */
  const [queue, setQueue] = useState<QuizQuestion[]>(policyQuizQuestions);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  // For single-select: stores the selected index. For multi-select: unused (see selectedMulti).
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  // For multi-select questions
  const [selectedMulti, setSelectedMulti] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<Phase>("answering");
  const [wasCorrect, setWasCorrect] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [slideDir, setSlideDir] = useState<"in" | "out" | "idle">("idle");
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [questionsText, setQuestionsText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  /* ---- helpers ---- */
  const hasSelection = current?.multiSelect
    ? selectedMulti.size > 0
    : selectedAnswer !== null;

  const toggleMultiOption = useCallback(
    (idx: number) => {
      if (phase !== "answering") return;
      setSelectedMulti((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) {
          next.delete(idx);
        } else {
          next.add(idx);
        }
        return next;
      });
    },
    [phase],
  );

  /* ---- handlers ---- */
  const handleCheck = useCallback(() => {
    if (!current) return;

    let correct: boolean;

    if (current.multiSelect) {
      // Multi-select: compare selected set vs correctIndices set
      if (selectedMulti.size === 0) return;
      const correctSet = new Set(current.correctIndices);
      correct =
        selectedMulti.size === correctSet.size &&
        [...selectedMulti].every((i) => correctSet.has(i));
    } else {
      // Single-select
      if (selectedAnswer === null) return;
      correct = current.correctIndices.includes(selectedAnswer);
    }

    setTotalAttempts((a) => a + 1);
    setWasCorrect(correct);

    if (correct) {
      setCorrectCount((c) => c + 1);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }

    setPhase("feedback");
  }, [selectedAnswer, selectedMulti, current]);

  const handleNext = useCallback(() => {
    if (!current) return;

    // Slide out animation
    setSlideDir("out");

    setTimeout(() => {
      if (wasCorrect) {
        // Pop from front, add to completed
        setCompleted((prev) => new Set(prev).add(current.id));
        setQueue((prev) => {
          const next = prev.slice(1);
          // If this was the last question, transition to questions phase
          if (next.length === 0) {
            setPhase("questions");
          } else {
            setPhase("answering");
          }
          return next;
        });
      } else {
        // Move to a random position in the back half of the queue
        setQueue((prev) => {
          const rest = prev.slice(1);
          if (rest.length === 0) return [current];
          const minPos = Math.max(1, Math.floor(rest.length / 2));
          const insertAt =
            minPos + Math.floor(Math.random() * (rest.length - minPos + 1));
          const next = [...rest];
          next.splice(insertAt, 0, current);
          return next;
        });
        setPhase("answering");
      }

      setSelectedAnswer(null);
      setSelectedMulti(new Set());
    }, 250);
  }, [current, wasCorrect]);

  const handleSubmitQuiz = useCallback(
    async (skipQuestions = false) => {
      setIsSubmitting(true);
      try {
        // TODO: call submitQuizCompletion server action when backend is ready
        console.log("Quiz completed:", {
          totalQuestions: total,
          totalAttempts: totalAttempts,
          retries: totalAttempts - total,
          questionsText: skipQuestions ? null : questionsText,
        });
        toast.success("Quiz submitted successfully!");
        setPhase("complete");
      } catch (err) {
        console.error("Failed to submit quiz:", err);
        toast.error("Failed to submit quiz. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [total, totalAttempts, questionsText],
  );

  const handleRestart = useCallback(() => {
    setQueue(shuffle(policyQuizQuestions));
    setCompleted(new Set());
    setSelectedAnswer(null);
    setSelectedMulti(new Set());
    setPhase("answering");
    setTotalAttempts(0);
    setCorrectCount(0);
    setQuestionsText("");
  }, []);

  /* ---- "Any Questions?" card ---- */
  if (phase === "questions") {
    return (
      <main className="relative min-h-screen p-8 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8">
            <h1 className="mb-1 text-3xl font-bold">Almost Done!</h1>
            <p className="text-sm text-muted-foreground">
              You&apos;ve answered all the questions correctly. One last thing before we finish.
            </p>
          </div>

          {/* full progress bar */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-green-600">
                {total} of {total} mastered ✓
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500 ease-out"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <Card className="overflow-hidden border bg-white shadow-md">
            <CardHeader className="border-b bg-gray-50/80 pb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-connect-me-blue-3" />
                <CardTitle className="text-lg">Do you have any questions?</CardTitle>
              </div>
              <CardDescription className="mt-2">
                If you have any questions about policies, your role, or anything else, write them
                below and our Operations team will get back to you.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              <Textarea
                placeholder="Type your questions here... (optional)"
                value={questionsText}
                onChange={(e) => setQuestionsText(e.target.value)}
                rows={5}
                className="resize-none"
                disabled={isSubmitting}
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-3 border-t bg-white px-6 py-4">
              <Button
                onClick={() => handleSubmitQuiz(false)}
                disabled={isSubmitting}
                className="w-full gap-2 bg-connect-me-blue-3 hover:bg-connect-me-blue-4"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit & Finish
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              <button
                onClick={() => handleSubmitQuiz(true)}
                disabled={isSubmitting}
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                Skip — I don&apos;t have any questions
              </button>
            </CardFooter>
          </Card>
        </div>
      </main>
    );
  }

  /* ---- completion screen ---- */
  if (phase === "complete") {
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
              <h1 className="mb-2 text-3xl font-bold">Wahoo! Quiz Completed</h1>
              <p className="text-lg text-blue-100">
                You&apos;ve mastered all the policies &amp; FAQs
              </p>
            </div>

            <CardContent className="space-y-6 p-8">
              {/* stats grid */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-xl bg-green-50 p-4">
                  <p className="text-2xl font-bold text-green-700">{total}</p>
                  <p className="text-sm text-green-600">Questions</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-2xl font-bold text-blue-700">{totalAttempts}</p>
                  <p className="text-sm text-blue-600">Total Attempts</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="text-2xl font-bold text-amber-700">{retries}</p>
                  <p className="text-sm text-amber-600">Retries Needed</p>
                </div>
              </div>

              {retries <= 0 ? (
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                  <Sparkles className="h-5 w-5 flex-shrink-0 text-green-600" />
                  <p className="text-sm text-green-800">
                    <strong>Perfect score!</strong> You answered every question correctly on your
                    first try. You&apos;re ready to start tutoring!
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <BookOpen className="h-5 w-5 flex-shrink-0 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    Great job working through the tricky questions! You now have a solid
                    understanding of Connect Me&apos;s policies.
                  </p>
                </div>
              )}

              <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <BookOpen className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500" />
                <p className="text-sm text-gray-600">
                  Don&apos;t worry if you can&apos;t memorize everything right away — you can
                  always refer to the{" "}
                  <strong className="text-gray-800">Tutor Manual</strong> and reach out to the{" "}
                  <strong className="text-gray-800">leadership team</strong> if you have any
                  questions.
                </p>
              </div>

              <div className="rounded-xl border-2 border-connect-me-blue-2 bg-gradient-to-r from-connect-me-blue-1/40 to-blue-50 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🎉</span>
                  <p className="text-base font-bold text-connect-me-blue-5">
                    Portal Access Unlocked
                  </p>
                </div>
                <p className="text-sm text-connect-me-blue-5/80">
                  You&apos;ve completed the orientation quiz and now have full access to the
                  Tutor Portal — including your students, sessions, resources, and chat.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 border-t bg-gray-50 px-8 py-4">
              <Button
                asChild
                className="w-full gap-2 bg-connect-me-blue-3 hover:bg-connect-me-blue-4"
              >
                <a href="/dashboard">
                  Go to Dashboard
                  <ChevronRight className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" onClick={handleRestart} className="w-full gap-2">
                <RotateCcw className="h-4 w-4" />
                Retake Quiz
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    );
  }

  /* ---- quiz card ---- */
  if (!current || !mounted) return null;

  const questionNumber = total - queue.length + 1;

  return (
    <main className="relative min-h-screen p-8 backdrop-blur-sm">
      <div className="mx-auto max-w-2xl">
        {/* header */}
        <div className="mb-8">
          <h1 className="mb-1 text-3xl font-bold">Policy &amp; FAQ Quiz</h1>
          <p className="text-sm text-muted-foreground">
            Answer all questions correctly to complete the quiz. Missed questions will come back
            later.
          </p>
        </div>

        {/* progress bar */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-muted-foreground">
              {completed.size} of {total} mastered
            </span>
            <span className="font-medium text-muted-foreground">{queue.length} remaining</span>
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
          className={`transition-all duration-300 ${slideDir === "in"
              ? "animate-[slideIn_0.35s_ease-out]"
              : slideDir === "out"
                ? "animate-[slideOut_0.25s_ease-in_forwards]"
                : ""
            } ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
        >
          <Card className="overflow-hidden border bg-white shadow-md">
            <CardHeader className="border-b bg-gray-50/80 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      current.category === "policy"
                        ? "bg-connect-me-blue-1 text-connect-me-blue-5"
                        : current.category === "protocol"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                    }
                  >
                    {current.category === "policy"
                      ? "Policy"
                      : current.category === "protocol"
                        ? "Protocol"
                        : "FAQ"}
                  </Badge>
                  {current.multiSelect && (
                    <Badge variant="outline" className="text-xs">
                      Select all that apply
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">Question {questionNumber}</span>
              </div>
              <CardTitle className="mt-3 text-lg leading-relaxed">{current.question}</CardTitle>
            </CardHeader>

            <CardContent className="p-6">
              {current.multiSelect ? (
                /* ---- multi-select: checkboxes ---- */
                <div className="space-y-3">
                  {current.options.map((option, idx) => {
                    let optionStyle = "";
                    if (phase === "feedback") {
                      if (current.correctIndices.includes(idx)) {
                        optionStyle = "border-green-300 bg-green-50 ring-1 ring-green-300";
                      } else if (selectedMulti.has(idx) && !wasCorrect) {
                        optionStyle = "border-red-300 bg-red-50 ring-1 ring-red-300";
                      }
                    } else if (selectedMulti.has(idx)) {
                      optionStyle =
                        "border-connect-me-blue-2 bg-blue-50/50 ring-1 ring-connect-me-blue-2";
                    }

                    return (
                      <Label
                        key={idx}
                        htmlFor={`option-multi-${idx}`}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover:bg-gray-50 ${optionStyle}`}
                        onClick={() => toggleMultiOption(idx)}
                      >
                        <Checkbox
                          id={`option-multi-${idx}`}
                          checked={selectedMulti.has(idx)}
                          disabled={phase === "feedback"}
                          className="mt-0.5"
                          onCheckedChange={() => toggleMultiOption(idx)}
                        />
                        <span className="text-sm leading-relaxed">{option}</span>
                      </Label>
                    );
                  })}
                </div>
              ) : (
                /* ---- single-select: radio buttons ---- */
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
                      if (current.correctIndices.includes(idx)) {
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
              )}
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
                      {wasCorrect ? "Correct!" : "Not quite — this one will come back later"}
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
                  disabled={!hasSelection}
                  className="w-full gap-2 bg-connect-me-blue-3 hover:bg-connect-me-blue-4"
                >
                  Check Answer
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className={`w-full gap-2 ${wasCorrect
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-connect-me-blue-3 hover:bg-connect-me-blue-4"
                    }`}
                >
                  {queue.length <= 1 && wasCorrect ? "Finish" : "Next"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* bottom hint */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {queue.length > 1
            ? `${queue.length - 1} more question${queue.length - 1 !== 1 ? "s" : ""} in the queue`
            : "Last question!"}
        </p>
      </div>
    </main>
  );
}
