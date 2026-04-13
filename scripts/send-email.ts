/**
 * CLI: send a React Email template via Resend.
 *
 * Usage:
 *   npx tsx scripts/send-email.ts --to you@example.com --template chat-message
 *   npx tsx scripts/send-email.ts --to you@example.com --template chat-message --message "Your preview text"
 *   npx tsx scripts/send-email.ts --to you@example.com --template pairing-request
 *   npx tsx scripts/send-email.ts --to you@example.com --template student-confirmation
 *   npx tsx scripts/send-email.ts --to you@example.com --template tutor-confirmation
 *
 * Requires RESEND_API_KEY (load from env or .env.local in project root).
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { render } from "@react-email/components";
import React from "react";
import { Resend } from "resend";

import ChatMessageNotificationEmail from "../components/emails/chat-message-notification";
import PairingRequestNotificationEmail from "../components/emails/pairing-request-notification";
import StudentPairingConfirmationEmail from "../components/emails/student-confirmation-email";
import TutorPairingConfirmationEmail from "../components/emails/tutor-confirmation-email";

import type { PairingConfirmationEmailProps } from "../types/email";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const body = a.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      out[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    const key = body;
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

function mockStudent(): PairingConfirmationEmailProps["student"] {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    createdAt: new Date().toISOString(),
    role: "Student",
    userId: "user-student",
    firstName: "Jamie",
    lastName: "Learner",
    gender: "female",
    startDate: "2025-01-15",
    availability: [{ day: "Monday", startTime: "3:00 PM", endTime: "4:00 PM" }],
    email: "jamie@example.com",
    phoneNumber: "555-0100",
    timeZone: "America/New_York",
    subjects_of_interest: ["Mathematics", "Reading"],
    status: "Active",
    tutorIds: [],
    studentNumber: "S-1001",
    settingsId: "00000000-0000-0000-0000-000000000099",
    languages_spoken: ["English", "Spanish"],
  };
}

function mockTutor(): PairingConfirmationEmailProps["tutor"] {
  return {
    id: "00000000-0000-0000-0000-000000000002",
    createdAt: new Date().toISOString(),
    role: "Tutor",
    userId: "user-tutor",
    firstName: "Taylor",
    lastName: "Mentor",
    gender: "male",
    startDate: "2024-09-01",
    availability: [{ day: "Monday", startTime: "3:00 PM", endTime: "4:00 PM" }],
    email: "taylor@example.com",
    phoneNumber: "555-0200",
    timeZone: "America/New_York",
    subjects_of_interest: ["Mathematics"],
    status: "Active",
    tutorIds: [],
    studentNumber: null,
    settingsId: "00000000-0000-0000-0000-000000000098",
    languages_spoken: ["English"],
  };
}

function mockMeeting(): PairingConfirmationEmailProps["meeting"] {
  return {
    id: "00000000-0000-0000-0000-000000000010",
    createdAt: new Date().toISOString(),
    password: "sample",
    meetingId: "123456789",
    link: "https://zoom.us/j/123456789",
    name: "Connect Me tutoring session",
  };
}

const DEFAULT_FROM =
  "Connect Me Free Tutoring & Mentoring <notifications@connectmego.app>";

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv);

  if (args.help || args.h) {
    console.log(`
Usage:
  npx tsx scripts/send-email.ts --to <email> --template <id> [options]

Templates:
  chat-message           Chat notification (optional: --message, --recipient-name, --sender-name, --chat-url)
  pairing-request        Pairing request notification (sample data)
  student-confirmation   Student matched / confirmation (sample data)
  tutor-confirmation     Tutor confirmation (sample data)

Options:
  --subject <text>       Override email subject
`);
    process.exit(0);
  }

  const to = args.to;
  const template = args.template;

  if (!to || !template) {
    console.error("Error: --to and --template are required.");
    console.error('Example: npx tsx scripts/send-email.ts --to you@x.com --template chat-message');
    process.exit(1);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Error: RESEND_API_KEY is not set (env or .env.local).");
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.connectmego.app";
  const base = siteUrl.replace(/\/$/, "");

  let html: string;
  let subject: string;

  switch (template) {
    case "chat-message": {
      const messagePreview =
        args.message ??
        "This is a sample message for the template preview block.";
      subject = args.subject ?? "New message on Connect Me";
      html = await render(
        React.createElement(ChatMessageNotificationEmail, {
          recipientName: args["recipient-name"] ?? "Test Recipient",
          senderName: args["sender-name"] ?? "Sample Sender",
          messagePreview,
          chatRoomUrl: args["chat-url"] ?? `${base}/dashboard/announcements`,
        }),
      );
      break;
    }
    case "pairing-request": {
      subject = args.subject ?? "Connect Me Pairing Request";
      const tutor = mockTutor();
      const student = mockStudent();
      html = await render(
        React.createElement(PairingRequestNotificationEmail, {
          tutor,
          student,
        }),
      );
      break;
    }
    case "student-confirmation": {
      subject = args.subject ?? "You Have Been Matched!";
      const props: PairingConfirmationEmailProps = {
        student: mockStudent(),
        tutor: mockTutor(),
        startDate: new Date().toISOString(),
        availability: { day: "Monday", startTime: "3:00 PM", endTime: "4:00 PM" },
        meeting: mockMeeting(),
      };
      html = await render(
        React.createElement(StudentPairingConfirmationEmail, props),
      );
      break;
    }
    case "tutor-confirmation": {
      subject = args.subject ?? "Confirmed for Tutoring";
      const props: PairingConfirmationEmailProps = {
        student: mockStudent(),
        tutor: mockTutor(),
        startDate: new Date().toISOString(),
        availability: { day: "Monday", startTime: "3:00 PM", endTime: "4:00 PM" },
        meeting: mockMeeting(),
      };
      html = await render(
        React.createElement(TutorPairingConfirmationEmail, props),
      );
      break;
    }
    default:
      console.error(
        `Unknown template: "${template}". Use: chat-message | pairing-request | student-confirmation | tutor-confirmation`,
      );
      process.exit(1);
  }

  const { data, error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    process.exit(1);
  }

  console.log("Sent:", { to, template, id: data?.id });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
