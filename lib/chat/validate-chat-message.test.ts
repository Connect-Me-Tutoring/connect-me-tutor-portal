import { describe, expect, it } from "vitest";
import { ChatFileMaxBytes, ChatFileNameMaxLength, ChatMessageMaxLength } from "@/constants/chat";
import { validateChatMessage } from "./validate-chat-message";

const storagePublicUrlPrefix =
  "http://127.0.0.1:54321/storage/v1/object/public/enrollment-chat-files/";

const validFile = {
  name: "worksheet.pdf",
  url: `${storagePublicUrlPrefix}room-id/profile-id/worksheet.pdf`,
  type: "application/pdf",
  size: 1024,
};

describe("validateChatMessage", () => {
  it("accepts a normal message and trims surrounding whitespace", () => {
    const result = validateChatMessage({ content: "  hello there  ", storagePublicUrlPrefix });
    expect(result).toEqual({ ok: true, content: "hello there", file: null });
  });

  it("rejects empty and whitespace-only messages without a file", () => {
    for (const content of ["", "   ", " \n \t "]) {
      expect(validateChatMessage({ content, storagePublicUrlPrefix }).ok).toBe(false);
    }
  });

  it("rejects non-string content", () => {
    for (const content of [null, undefined, 42, { text: "hi" }]) {
      expect(validateChatMessage({ content, storagePublicUrlPrefix }).ok).toBe(false);
    }
  });

  it("strips control characters but keeps newlines", () => {
    const nul = String.fromCharCode(0);
    const bell = String.fromCharCode(7);
    const result = validateChatMessage({
      content: `line one\nline${nul} two${bell}`,
      storagePublicUrlPrefix,
    });
    expect(result).toEqual({ ok: true, content: "line one\nline two", file: null });
  });

  it("accepts content exactly at the max length and rejects one over", () => {
    const atLimit = "a".repeat(ChatMessageMaxLength);
    expect(validateChatMessage({ content: atLimit, storagePublicUrlPrefix })).toEqual({
      ok: true,
      content: atLimit,
      file: null,
    });
    expect(validateChatMessage({ content: `${atLimit}a`, storagePublicUrlPrefix }).ok).toBe(false);
  });

  it("accepts a valid file attachment with empty content", () => {
    const result = validateChatMessage({ content: "", file: validFile, storagePublicUrlPrefix });
    expect(result).toEqual({ ok: true, content: "", file: validFile });
  });

  it("rejects files over the size limit", () => {
    const result = validateChatMessage({
      content: "",
      file: { ...validFile, size: ChatFileMaxBytes + 1 },
      storagePublicUrlPrefix,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects zero, negative, and non-integer file sizes", () => {
    for (const size of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        validateChatMessage({ content: "", file: { ...validFile, size }, storagePublicUrlPrefix })
          .ok,
      ).toBe(false);
    }
  });

  it("rejects disallowed file types", () => {
    for (const type of ["application/x-msdownload", "text/html", "application/octet-stream", ""]) {
      expect(
        validateChatMessage({ content: "", file: { ...validFile, type }, storagePublicUrlPrefix })
          .ok,
      ).toBe(false);
    }
  });

  it("rejects file urls outside the portal chat bucket", () => {
    for (const url of [
      "https://evil.example.com/worksheet.pdf",
      "http://127.0.0.1:54321/storage/v1/object/public/other-bucket/worksheet.pdf",
    ]) {
      expect(
        validateChatMessage({ content: "", file: { ...validFile, url }, storagePublicUrlPrefix })
          .ok,
      ).toBe(false);
    }
  });

  it("rejects malformed file payloads", () => {
    for (const file of [
      "worksheet.pdf",
      ["not", "a", "file"],
      { ...validFile, name: 42 },
      { ...validFile, url: undefined },
      { name: "a.pdf" },
    ]) {
      expect(validateChatMessage({ content: "hi", file, storagePublicUrlPrefix }).ok).toBe(false);
    }
  });

  it("rejects empty and overlong file names", () => {
    expect(
      validateChatMessage({
        content: "",
        file: { ...validFile, name: "   " },
        storagePublicUrlPrefix,
      }).ok,
    ).toBe(false);
    expect(
      validateChatMessage({
        content: "",
        file: { ...validFile, name: `${"a".repeat(ChatFileNameMaxLength)}.pdf` },
        storagePublicUrlPrefix,
      }).ok,
    ).toBe(false);
  });
});
