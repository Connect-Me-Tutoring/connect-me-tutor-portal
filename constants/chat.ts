export const TutorAnnouncementRoomId = "aeff2967-75be-4af7-b7b4-8414e659ca16";
export const StudentAnnouncementsRoomId = "9916f82f-0bbf-4af5-ac5c-91add30d7941";

export const ChatFileBucket = "enrollment-chat-files";

// Enforced server-side in sendChatMessage; the chat UI mirrors them for early feedback.
export const ChatMessageMaxLength = 2000;

// Per-room cap keeps one conversation usable; the wider global ceiling still
// bounds multi-room bursts without blocking normal cross-room activity such
// as admin triage.
export const ChatRateLimitMaxMessages = 10;
export const ChatRateLimitGlobalMaxMessages = 30;
export const ChatRateLimitWindowSeconds = 30;

// A sender's follow-up messages in the same room within this window do not
// trigger another round of notification emails.
export const ChatEmailDebounceSeconds = 120;

export const ChatFileMaxBytes = 10 * 1024 * 1024;
export const ChatFileMaxMegabytes = Math.floor(ChatFileMaxBytes / (1024 * 1024));
export const ChatFileNameMaxLength = 200;
export const ChatAllowedFileMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;
