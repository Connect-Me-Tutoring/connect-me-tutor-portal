export type OrientationSlideTranscriptBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: readonly string[] };

export interface OrientationSlideTranscriptLink {
  href: string;
  label: string;
}

export interface OrientationSlideTranscript {
  title: string;
  blocks: readonly OrientationSlideTranscriptBlock[];
  links?: readonly OrientationSlideTranscriptLink[];
}

/**
 * Accessible equivalents for the image-only orientation deck.
 * Keep this array in the same order as ORIENTATION_SLIDES.
 */
export const ORIENTATION_SLIDE_TRANSCRIPTS: readonly OrientationSlideTranscript[] = [
  {
    title: "New Tutor Orientation",
    blocks: [
      { type: "paragraph", text: "Connect Me Tutoring new tutor orientation." },
      {
        type: "paragraph",
        text: "Our mission is to give back and support our community as volunteers with a passion for tutoring.",
      },
      {
        type: "paragraph",
        text: "Instagram: @connectmetutoring. Remind groups: @cmtutors, @connectme2, @connectme3, and @connectme4.",
      },
    ],
  },
  {
    title: "Executive Team",
    blocks: [
      {
        type: "paragraph",
        text: "A group photo introduces executive team members Hasini Anand, Jimena Ham, Ashritaa Polavalli, Vaibhav Bhaskar, Claudia Wang, Alexander Hu, Mateo Atun, and Amy Mao.",
      },
    ],
  },
  {
    title: "Discord",
    blocks: [
      {
        type: "list",
        items: [
          "Discord will be used as a form of communication within Connect Me.",
          "Change your Discord nickname to your first and last name. The slide illustrates using the /nick command.",
        ],
      },
    ],
  },
  {
    title: "Tutor documents Discord channel",
    blocks: [
      {
        type: "paragraph",
        text: "Find the #tutor-documents channel in Discord. It contains all of the information presented in these slides.",
      },
    ],
  },
  {
    title: "Mentorship Program",
    blocks: [
      {
        type: "paragraph",
        text: "We highly encourage you to sign up as a mentee to receive guidance from a mentor.",
      },
      {
        type: "list",
        items: [
          "A mentor will help you learn how to navigate the portal and Discord, shadow your sessions, and answer other questions.",
          "The program is a great way to make connections with other tutors.",
        ],
      },
      {
        type: "paragraph",
        text: "Use the Mentorship Program Graphic link below to view the signup information.",
      },
    ],
    links: [
      {
        href: "https://drive.google.com/file/d/1nP7FV-oNbM8JlLcyo07LKl4he00cuQjZ/view?usp=sharing",
        label: "Open the Mentorship Program Graphic",
      },
    ],
  },
  {
    title: "Tutor Portal",
    blocks: [
      {
        type: "paragraph",
        text: "The Tutor Portal is where you view upcoming tutoring sessions and student information and track your hours.",
      },
      {
        type: "list",
        items: [
          "You should receive a signup email within two to three days of joining Discord. Check your inbox and spam folder.",
          "Use the email link to set your password and complete your registration.",
          "If you do not receive the registration email, contact Claudia on Discord.",
        ],
      },
    ],
  },
  {
    title: "Navigating the Platform and Setting Up Your Availability",
    blocks: [
      { type: "heading", text: "Tutor Portal Manual" },
      {
        type: "paragraph",
        text: "Refer to the manual for instructions on navigating the portal and using its features.",
      },
      { type: "heading", text: "Edit Profile Settings" },
      {
        type: "list",
        items: [
          "Go to the Pairings tab and select Edit profile settings on the right side.",
          "Enter your availability schedule, subjects of interest, and languages spoken, then select Update profile.",
        ],
      },
    ],
    links: [{ href: "https://connectmego.app/", label: "Open the Connect Me Portal" }],
  },
  {
    title: "Getting a Student: Part 1",
    blocks: [
      {
        type: "list",
        items: [
          "Check the #role-select channel on Discord.",
          "Make sure you have the Looking for Students role.",
          "React to the role-selection message to join Looking for Students or the Sub Hotline.",
        ],
      },
    ],
  },
  {
    title: "Getting a Student: Part 2",
    blocks: [
      {
        type: "paragraph",
        text: "Student opportunities are posted in three separate Discord channels based on grade level: #k-5th-student-pairings, #6th-8th-student-pairings, and #9th-12th-student-pairings.",
      },
      {
        type: "list",
        items: [
          "If you are interested in a student, direct-message the Admissions member who posted the opportunity.",
          "Include your name, the student number, and the days and times you can tutor within the student's availability.",
          "You have 12 hours to claim an opportunity.",
          "The Admissions member will confirm whether the time works for the student.",
          "A crossed-out opportunity means the student is no longer available.",
        ],
      },
    ],
  },
  {
    title: "Check Discord Channel",
    blocks: [
      {
        type: "paragraph",
        text: "Take a few minutes to check the student-pairings channel and contact an Admissions member if you find a student you are interested in tutoring.",
      },
    ],
  },
  {
    title: "Getting a Student: Part 3",
    blocks: [
      {
        type: "paragraph",
        text: "The Admissions member will share key session details, including the date, time, message template, and student and parent names. Additional information, such as the Zoom link and parent contact information, is available on the Tutor Portal.",
      },
      { type: "heading", text: "Before your first session" },
      {
        type: "list",
        items: [
          "Read the tutor starter packet before the session.",
          "Send a welcome message to the student's parent at least four days before your first session. The welcome-message template is included in the tutor materials.",
        ],
      },
    ],
    links: [
      {
        href: "https://docs.google.com/document/d/1Tzc0JA90Ghy76UdBPCRFrUcT27jOxTvqh4yxq1_xVXY/edit?tab=t.0",
        label: "Open the Tutor Portal Manual",
      },
    ],
  },
  {
    title: "Text the Parent or Guardian and Read the Tutor Starter Packet",
    blocks: [
      { type: "heading", text: "Text the parent or guardian" },
      {
        type: "list",
        items: [
          "You must send a welcome message to the student's parent or guardian to introduce yourself as the tutor. The Admissions member will send you a template after the student pairing.",
          "Remember to send a reminder and return the following week for the next session.",
        ],
      },
      { type: "heading", text: "Tutor Starter Packet" },
      {
        type: "paragraph",
        text: "Read through the Tutor Starter Packet carefully before your first tutoring session.",
      },
    ],
  },
  {
    title: "Editing or Adding Enrollments",
    blocks: [
      {
        type: "list",
        items: [
          "Use an enrollment when adding new weekly recurring sessions.",
          "Edit an enrollment when permanently rescheduling sessions.",
          "The enrollment form asks you to select the student, tutor, an available time, a summary, start date, and meeting link.",
        ],
      },
    ],
  },
  {
    title: "Pairing Time Limit",
    blocks: [
      {
        type: "list",
        items: [
          "After an Admissions Department member confirms the session time, you have 12 hours to respond and accept the pairing.",
          "If you are looking for another student, turn on Discord notifications and check Discord frequently.",
          "Failure to respond in a timely manner will result in a warning.",
        ],
      },
    ],
  },
  {
    title: "What If Your Student Doesn't Show Up?",
    blocks: [
      {
        type: "list",
        items: [
          "Wait five minutes past the start time.",
          "Call the parent using the number on the Tutor Portal to check whether the student plans to attend. They may have forgotten, or they may need to reschedule or meet the following week.",
          "If there is no answer, send a text asking whether the student will join.",
          "Wait up to 15 minutes total before leaving.",
          "If the parent replies that the student can join and it is still within your session time, rejoin Zoom. You may end at the original time or extend to a full hour. Extra time counts, but end on time if another session needs the same Zoom link.",
        ],
      },
    ],
  },
  {
    title: "After Your Sessions",
    blocks: [
      {
        type: "paragraph",
        text: "Fill out the Session Exit Form after every session. If you do not, you risk not receiving volunteer hours and may be removed from the organization.",
      },
      {
        type: "paragraph",
        text: "The slide highlights the SEF button in the Session Exit Form column of the Tutor Dashboard.",
      },
    ],
  },
  {
    title: "Possible Situations",
    blocks: [
      {
        type: "list",
        items: [
          "If your student disconnects during a session, give them a couple of minutes to return before contacting their parent.",
          "If your student says they have no homework, use resources on the portal to expand on their subjects.",
          "If you forget to attend, you will not receive volunteer hours and will receive a warning. Do not fill out the Session Exit Form for a session you did not attend. Falsifying it may result in termination from Connect Me in bad standing and revocation of all Connect Me hours.",
        ],
      },
    ],
  },
  {
    title: "Requesting a Substitute",
    blocks: [
      {
        type: "list",
        items: [
          "To qualify for a substitute, submit the request at least 24 hours before the session start time, and the request must be your first request that month.",
          "Fill out the Substitute Request form on the Tutor Portal.",
          "Wait for a reply from the Operations Department.",
        ],
      },
    ],
  },
  {
    title: "Referring Tutors and Requesting Hours",
    blocks: [
      {
        type: "list",
        items: [
          "Hours are tracked using the Tutor Portal.",
          "Tell friends to apply to Connect Me and refer you for service hours.",
          "You receive 0.5 extra hours for each new tutor you refer. The application prompts the applicant to enter who referred them.",
          "To request a certificate for volunteer hours, fill out the Certificate Request Form in the FAQ.",
        ],
      },
    ],
  },
  {
    title: "Department Applications",
    blocks: [
      {
        type: "paragraph",
        text: "Leadership positions are open. Departments are the backbone of Connect Me and work together to run the organization, including Admissions, Advertising, Chapters, Media, Operations, Partnerships, and Software.",
      },
      {
        type: "list",
        items: [
          "Joining a department helps you gain new skills and leadership experience.",
          "To apply, complete three successful tutoring sessions and either refer one new tutor or leave one five-star Google review, then submit the department application.",
        ],
      },
      {
        type: "paragraph",
        text: "The slide shows a preview of the Connect Me Department Application form.",
      },
    ],
  },
  {
    title: "Questions?",
    blocks: [
      {
        type: "paragraph",
        text: "This concludes the new tutor orientation slideshow. Ask the Connect Me team any remaining questions.",
      },
    ],
  },
];
