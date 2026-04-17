import { Profile, Meeting, Availability } from "@/types";


export interface PairingConfirmationEmailProps {
  tutor: Profile;
  student: Profile;
  startDate: string;
  availability: Availability;
  meeting: Meeting;
  isPreview?: boolean;
}

export interface PairingRequestNotificationEmailProps {
  tutor: Profile;
  student: Profile;
  isPreview?: boolean;
}

/** Early check-in after the first one or two tutoring sessions (tutor vs parent copy). */
export interface EarlySessionCheckInEmailProps {
  recipientRole: "tutor" | "parent";
  tutor: Profile;
  student: Profile;
  portalUrl?: string;
  guidebookUrl?: string;
  isPreview?: boolean;
}
