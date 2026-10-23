import { describe, expect, it } from "vitest";

import type { CreatedProfileData } from "@/types";
import { buildUserMetadata } from "./profile-insert";

const profileData: CreatedProfileData = {
  age: "",
  availability: [],
  email: "new.user@example.com",
  firstName: "New",
  gender: "",
  grade: "",
  languages_spoken: [],
  lastName: "User",
  parentEmail: "",
  parentName: "",
  parentPhone: "",
  password: "unused-in-profile-row",
  phoneNumber: "",
  role: "Tutor",
  startDate: "2026-10-08",
  status: "Active",
  studentNumber: "",
  subjects_of_interest: [],
  timezone: "America/New_York",
};

describe("buildUserMetadata", () => {
  it("explicitly creates tutors with incomplete orientation", () => {
    expect(buildUserMetadata(profileData, "user-1")).toMatchObject({
      orientation_completed_at: null,
      role: "Tutor",
      user_id: "user-1",
    });
  });

  it("does not attach tutor orientation state to non-tutor profiles", () => {
    const metadata = buildUserMetadata({ ...profileData, role: "Student" }, "user-2");

    expect(metadata).not.toHaveProperty("orientation_completed_at");
  });
});
