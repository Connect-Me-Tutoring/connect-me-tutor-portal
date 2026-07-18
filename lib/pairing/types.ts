export type PairingLogSchemaType = {
  message: string;
  type:
    | "pairing-que-entered"
    | "pairing-match"
    | "pairing-match-rejected"
    | "pairing-match-accepted"
    | "pairing-selection-failed";
  error?: boolean;
  role?: "student" | "tutor";
  metadata?: Record<string, any>;
};
