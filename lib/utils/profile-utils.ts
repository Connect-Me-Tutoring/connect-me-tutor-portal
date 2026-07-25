import type { ProfilePairingMetadata } from "@/types/profile";

// Mock data for demonstration
// In a real app, this would fetch from your API
export async function fetchProfileData(): Promise<ProfilePairingMetadata> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    profileId: "current-user-id",
    availability: [
      { day: "Monday", startTime: "2:00 PM", endTime: "5:00 PM" },
      { day: "Thursday", startTime: "3:00 PM", endTime: "7:00 PM" },
    ],
    subjectsOfInterest: ["Mathematics", "Computer Science", "Physics"],
    languagesSpoken: ["English", "Spanish"],
  };
}

export async function updateProfileData(
  data: ProfilePairingMetadata,
): Promise<ProfilePairingMetadata> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // In a real app, this would send data to your API

  return data;
}
