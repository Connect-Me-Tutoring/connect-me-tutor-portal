/**
 *
 * @returns SEF reminder email
 */

import { Profile } from "@/types";
import {
  emailBadgeHtml,
  emailButtonHtml,
  emailHeadingHtml,
  emailLayoutHtml,
  emailSignatureHtml,
  emailTextHtml,
  escapeHtml,
} from "@/components/emails/layout/html";

export const missingSEFReminderEmail = (tutor: Profile, student: Profile) => {
  const studentFull = `${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}`;

  return emailLayoutHtml({
    preview: `Reminder: complete your Session Exit Forms for ${student.firstName} ${student.lastName}`,
    content: [
      emailBadgeHtml("Reminder", "warning"),
      emailHeadingHtml("Complete your Session Exit Forms"),
      emailTextHtml(`Hi ${escapeHtml(tutor.firstName)},`),
      emailTextHtml(
        `This is a reminder to complete the Session Exit Forms (SEFs) for your recent tutoring sessions with <strong>${studentFull}</strong>.`,
      ),
      emailTextHtml(
        "Our records show that the last two sessions in the past two weeks are still marked as incomplete.",
      ),
      emailTextHtml(
        "Please visit the Connect Me Tutor Portal and submit the required SEFs as soon as possible.",
      ),
      emailButtonHtml("https://www.connectmego.app/", "Open the Tutor Portal"),
      emailTextHtml("If you have any questions, feel free to reach out to us on Discord."),
      emailSignatureHtml("Best,", "The Connect Me Free Tutoring & Mentoring Team"),
    ].join(""),
  });
};
