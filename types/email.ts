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

export interface TutorMonthlyCheckInEmailProps {
  tutor: Profile;
  student: Profile;
  monthsSinceStart: number;
  isPreview?: boolean;
}

export interface ParentMonthlyCheckInEmailProps {
  parentName: string;
  parentEmail: string;
  student: Profile;
  tutor: Profile;
  monthsSinceStart: number;
  isPreview?: boolean;
}
