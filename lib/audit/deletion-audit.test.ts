import { describe, expect, it } from "vitest";
import {
  buildEnrollmentDeletionSnapshot,
  buildPairingDeletionSnapshot,
  buildProfileDeletionSnapshot,
  enrollmentDeletionProperties,
  pairingDeletionProperties,
  profileDeletionProperties,
} from "./deletion-audit";

const profileRow = {
  age: "16",
  ai_tutor_chatlogs: "not part of deletion audit",
  availability: [],
  created_at: "2026-01-01T00:00:00.000Z",
  date_of_birth: "2010-01-01",
  deactivated_at: null,
  deactivated_by: null,
  email: "student@example.com",
  first_name: "Sam",
  gender: "Non-binary",
  grade: "10",
  id: "student-profile-1",
  languages_spoken: ["English"],
  last_name: "Student",
  orientation_completed_at: null,
  parent_email: "parent@example.com",
  parent_name: "Pat Parent",
  parent_phone: "555-0100",
  phone_number: "555-0101",
  role: "Student",
  settings_id: "settings-1",
  start_date: "2026-01-01",
  status: "Active" as const,
  student_number: "S-100",
  subject_embed: "not part of deletion audit",
  subjects_of_interest: ["Math"],
  timezone: "America/New_York",
  tutor_ids: ["tutor-profile-1"],
  tutoring_hours: 12,
  user_id: "student-user-1",
};

const tutorRow = {
  ...profileRow,
  age: "20",
  date_of_birth: "2006-01-01",
  email: "tutor@example.com",
  first_name: "Taylor",
  grade: null,
  id: "tutor-profile-1",
  last_name: "Tutor",
  parent_email: null,
  parent_name: null,
  parent_phone: null,
  phone_number: "555-0200",
  role: "Tutor",
  settings_id: "settings-2",
  student_number: null,
  tutor_ids: null,
  user_id: "tutor-user-1",
};

describe("deletion audit snapshots", () => {
  it("keeps only the profile name and email plus its audit identifier", () => {
    const snapshot = buildProfileDeletionSnapshot(profileRow);
    const properties = profileDeletionProperties(snapshot);

    expect(snapshot).toEqual({
      id: "student-profile-1",
      name: "Sam Student",
      email: "student@example.com",
    });
    expect(properties).toEqual({
      profile_name: "Sam Student",
      profile_email: "student@example.com",
    });
  });

  it("keeps only enrollment date, duration, and participant names and emails", () => {
    const enrollment = {
      availability: null,
      created_at: "2026-02-01T00:00:00.000Z",
      day: "Monday",
      duration: 60,
      end_date: "2026-12-01",
      end_time: "17:00",
      frequency: "weekly" as const,
      id: "enrollment-1",
      inactivity_warning_sent_at: null,
      meetingId: "meeting-1",
      pairing_id: "pairing-1",
      paused: false,
      start_date: "2026-02-01",
      start_time: "16:00",
      student_id: profileRow.id,
      summary: "Algebra tutoring",
      tutor_id: tutorRow.id,
    };
    const snapshot = buildEnrollmentDeletionSnapshot(enrollment, profileRow, tutorRow);
    const properties = enrollmentDeletionProperties(snapshot);

    expect(snapshot).toEqual({
      id: "enrollment-1",
      date: "2026-02-01",
      duration: 60,
      student: { name: "Sam Student", email: "student@example.com" },
      tutor: { name: "Taylor Tutor", email: "tutor@example.com" },
    });
    expect(properties).toEqual({
      enrollment_date: "2026-02-01",
      enrollment_duration: 60,
      student_name: "Sam Student",
      student_email: "student@example.com",
      tutor_name: "Taylor Tutor",
      tutor_email: "tutor@example.com",
    });
  });

  it("combines pairing data with both participant profiles", () => {
    const pairing = {
      created_at: "2026-02-01T00:00:00.000Z",
      id: "pairing-1",
      student_id: profileRow.id,
      tutor_id: tutorRow.id,
    };
    const snapshot = buildPairingDeletionSnapshot(pairing, profileRow, tutorRow);
    const properties = pairingDeletionProperties(snapshot);

    expect(snapshot).toEqual({
      id: "pairing-1",
      student: { name: "Sam Student", email: "student@example.com" },
      tutor: { name: "Taylor Tutor", email: "tutor@example.com" },
    });
    expect(properties).toEqual({
      student_name: "Sam Student",
      student_email: "student@example.com",
      tutor_name: "Taylor Tutor",
      tutor_email: "tutor@example.com",
    });
  });
});
