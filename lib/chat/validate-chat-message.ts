import {
  ChatAllowedFileMimeTypes,
  ChatFileMaxBytes,
  ChatFileMaxMegabytes,
  ChatFileNameMaxLength,
  ChatMessageMaxLength,
} from "@/constants/chat";

export type ChatMessageFile = {
  name: string;
  url: string;
  type: string;
  size: number;
};

export type ChatMessageValidation =
  { ok: true; content: string; file: ChatMessageFile | null } | { ok: false; message: string };

// Postgres text/jsonb cannot store the NUL character, and the other control
// characters are invisible in the UI, so they are stripped rather than stored.
// Newlines and tabs are kept.
const ControlCharacters = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", "g");

export function isAllowedChatFileType(mimeType: string): boolean {
  return (ChatAllowedFileMimeTypes as readonly string[]).includes(mimeType);
}

export function validateChatMessage(params: {
  content: unknown;
  file?: unknown;
  storagePublicUrlPrefix: string;
}): ChatMessageValidation {
  if (typeof params.content !== "string") {
    return { ok: false, message: "Message content must be text" };
  }

  const content = params.content.replace(ControlCharacters, "").trim();
  if (content.length > ChatMessageMaxLength) {
    return { ok: false, message: `Message is too long (max ${ChatMessageMaxLength} characters)` };
  }

  const rawFile = params.file ?? null;
  if (rawFile === null) {
    if (!content) return { ok: false, message: "Message cannot be empty" };
    return { ok: true, content, file: null };
  }

  if (typeof rawFile !== "object" || Array.isArray(rawFile)) {
    return { ok: false, message: "Invalid file attachment" };
  }

  const candidate = rawFile as Record<string, unknown>;
  if (
    typeof candidate.name !== "string" ||
    typeof candidate.url !== "string" ||
    typeof candidate.type !== "string" ||
    typeof candidate.size !== "number"
  ) {
    return { ok: false, message: "Invalid file attachment" };
  }

  const name = candidate.name.replace(ControlCharacters, "").trim();
  if (!name || name.length > ChatFileNameMaxLength) {
    return { ok: false, message: "Invalid file name" };
  }

  if (!Number.isInteger(candidate.size) || candidate.size <= 0) {
    return { ok: false, message: "Invalid file attachment" };
  }
  if (candidate.size > ChatFileMaxBytes) {
    return { ok: false, message: `File is too large (max ${ChatFileMaxMegabytes} MB)` };
  }

  if (!isAllowedChatFileType(candidate.type)) {
    return { ok: false, message: "This file type is not allowed" };
  }

  if (!candidate.url.startsWith(params.storagePublicUrlPrefix)) {
    return { ok: false, message: "File attachments must be uploaded through the portal" };
  }

  return {
    ok: true,
    content,
    file: { name, url: candidate.url, type: candidate.type, size: candidate.size },
  };
}
