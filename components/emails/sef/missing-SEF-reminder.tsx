
/**
 * 
 * @returns SEF reminder email
 */

import { Profile } from "@/types"

export const missingSEFReminderEmail = (
  tutor: Profile,
  student: Profile
) => {
  return `
    <p>
      Hi ${tutor.firstName},<br><br>

      This is a reminder to complete the Session Exit Forms (SEFs) for your
      recent tutoring sessions with
      <strong>${student.firstName} ${student.lastName}</strong>.<br><br>

      Our records show that the last two sessions in the past two weeks
      are still marked as incomplete.<br><br>

      Please visit
      <a href="https://www.connectmego.app/">ConnectMe Tutor Portal</a>
      and submit the required SEFs as soon as possible.<br><br>

      If you have any questions, feel free to reach out to us on Discord.<br><br>

      Best,<br>
      The Connect Me Free Tutoring & Mentoring Team
    </p>
  `;
};