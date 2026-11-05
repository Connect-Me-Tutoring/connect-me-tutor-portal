"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SERIOUS_INCIDENT_FORM_URL,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_URGENCIES,
  TICKET_URGENCY_LABELS,
  ticketFormSchema,
  type TicketFormValues,
} from "@/constants/tickets";
import { submitTicket } from "@/lib/actions/ticket/server.actions";

interface ReportIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReportIssueDialog({ open, onOpenChange }: ReportIssueDialogProps) {
  const pathname = usePathname();
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      category: undefined,
      urgency: "low",
      subject: "",
      description: "",
      pageUrl: pathname,
    },
  });

  // Reset each time the dialog opens so it reflects the current page and profile.
  useEffect(() => {
    if (open) {
      setSubmittedTicketId(null);
      form.reset({
        category: undefined,
        urgency: "low",
        subject: "",
        description: "",
        pageUrl: pathname,
      });
    }
  }, [open, pathname, form]);

  const onSubmit = async (values: TicketFormValues) => {
    try {
      const result = await submitTicket(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSubmittedTicketId(result.ticketId);
    } catch (error) {
      console.error("Unable to submit ticket", error);
      toast.error("We couldn't submit your ticket. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {submittedTicketId ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <DialogTitle>Ticket submitted</DialogTitle>
            <DialogDescription>
              Thanks for letting us know. We've emailed you a copy, and our team will follow up
              there.
              <br />
              <span className="text-xs">Reference: {submittedTicketId.slice(0, 8)}</span>
            </DialogDescription>
            <Button className="mt-2" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Contact Support</DialogTitle>
              <DialogDescription>
                Answer a few quick questions and we&apos;ll open a support ticket for you.
              </DialogDescription>
            </DialogHeader>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Serious incidents only</AlertTitle>
              <AlertDescription>
                For safety concerns, harassment, misconduct, or other serious incidents, please use
                the{" "}
                <a
                  href={SERIOUS_INCIDENT_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium underline"
                >
                  serious incident report form
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                instead of this ticket form.
              </AlertDescription>
            </Alert>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>1. What is this about?</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TICKET_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {TICKET_CATEGORY_LABELS[category]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="urgency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>2. How much is this affecting you?</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="gap-3"
                        >
                          {TICKET_URGENCIES.map((urgency) => (
                            <FormItem key={urgency} className="flex items-start gap-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value={urgency} className="mt-0.5" />
                              </FormControl>
                              <FormLabel className="font-normal leading-snug">
                                <span className="font-medium">
                                  {TICKET_URGENCY_LABELS[urgency].label}
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  — {TICKET_URGENCY_LABELS[urgency].description}
                                </span>
                              </FormLabel>
                            </FormItem>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>3. Summarize the issue in one line</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Zoom link missing for my Tuesday session"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>4. What happened?</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={5}
                          placeholder="What were you trying to do, what did you expect, and what happened instead? Include any session dates or names that help us find it."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Submitting..." : "Submit ticket"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
