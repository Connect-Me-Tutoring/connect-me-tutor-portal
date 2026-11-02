"use client";

import { useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_TUTOR_MANUAL_SECTIONS,
  TUTOR_MANUAL_LIMITS,
  tutorManualSchema,
  type TutorManual,
  type TutorManualSection,
} from "@/constants/tutor-manual";
import { saveTutorManual } from "@/lib/actions/tutor-manual/server.actions";

import ManualMarkdown from "./ManualMarkdown";

type ManualFormValues = { sections: TutorManualSection[] };

function SectionPreview({ control, index }: { control: Control<ManualFormValues>; index: number }) {
  const body = useWatch({ control, name: `sections.${index}.body` });
  return body?.trim() ? (
    <div className="rounded-md border border-border p-4">
      <ManualMarkdown>{body}</ManualMarkdown>
    </div>
  ) : (
    <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
      Nothing to preview yet.
    </p>
  );
}

export default function TutorManualEditor({
  sections,
  onCancel,
  onSaved,
}: {
  sections: TutorManualSection[];
  onCancel: () => void;
  onSaved: (manual: TutorManual) => void;
}) {
  const form = useForm<ManualFormValues>({
    resolver: zodResolver(tutorManualSchema),
    defaultValues: { sections },
  });
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "sections",
  });
  const { isDirty, isSubmitting } = form.formState;
  const sectionsError = form.formState.errors.sections?.root?.message;

  const onSubmit = async (values: ManualFormValues) => {
    try {
      const saved = await saveTutorManual(values.sections);
      toast.success("Manual saved. Tutors will see the new version.");
      onSaved(saved);
    } catch (error) {
      console.error("Unable to save tutor manual", error);
      toast.error("We couldn't save the manual. Your edits are still here. Please try again.");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="border-connect-me-blue-2 bg-connect-me-blue-1/20">
          <CardContent className="space-y-1 pt-6 text-sm text-connect-me-gray-3">
            <p className="font-medium text-connect-me-blue-4">Editing the Tutor Portal Manual</p>
            <p>
              Sections are written in Markdown: <code>**bold**</code>, <code>### Heading</code>,{" "}
              <code>- bullet</code>, <code>1. step</code>,{" "}
              <code>[text](/dashboard/my-students)</code> for portal links (other links open in a
              new tab), <code>&gt; note</code> for a highlighted callout, and <code>| a | b |</code>{" "}
              tables. Nothing changes for tutors until you save.
            </p>
          </CardContent>
        </Card>

        {fields.map((field, index) => (
          <Card key={field.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <span className="text-sm font-semibold text-connect-me-gray-2">
                Section {index + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move section ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move section ${index + 1} down`}
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete section ${index + 1}`}
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name={`sections.${index}.title`}
                render={({ field: titleField }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input maxLength={TUTOR_MANUAL_LIMITS.title} {...titleField} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`sections.${index}.body`}
                render={({ field: bodyField }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <Tabs defaultValue="write">
                      <TabsList>
                        <TabsTrigger value="write">Write</TabsTrigger>
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                      </TabsList>
                      <TabsContent value="write">
                        <FormControl>
                          <Textarea
                            rows={12}
                            className="font-mono text-xs"
                            maxLength={TUTOR_MANUAL_LIMITS.body}
                            {...bodyField}
                          />
                        </FormControl>
                      </TabsContent>
                      <TabsContent value="preview">
                        <SectionPreview control={form.control} index={index} />
                      </TabsContent>
                    </Tabs>
                    <FormDescription>
                      Markdown. Preview shows exactly what tutors see.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        ))}

        {sectionsError && <p className="text-sm font-medium text-destructive">{sectionsError}</p>}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={fields.length >= TUTOR_MANUAL_LIMITS.sections}
              onClick={() => append({ title: "New section", body: "" })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add section
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore default content
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restore the default manual?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This replaces everything in the editor with the manual that ships with the
                    portal. Nothing is saved until you click Save.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep my edits</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      form.reset(
                        { sections: DEFAULT_TUTOR_MANUAL_SECTIONS },
                        { keepDefaultValues: true },
                      )
                    }
                  >
                    Restore default
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {isDirty ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your edits haven&apos;t been saved and will be lost.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep editing</AlertDialogCancel>
                    <AlertDialogAction onClick={onCancel}>Discard</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="bg-connect-me-blue-3 hover:bg-connect-me-blue-4"
            >
              {isSubmitting ? "Saving..." : "Save manual"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
